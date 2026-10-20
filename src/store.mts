// Stores ScholarLink data as JSON text files in a private GitHub repo.
// Every write is a single commit; if two people submit at once, the loser re-reads and retries.

export const FILES = {
  config: "config.json",
  mentors: "mentors.json",
  mentees: "mentees.json",
  matches: "matches.json",
  help: "help-requests.json",
} as const

export type Key = keyof typeof FILES
export type Data = Record<Key, any>
export type Changes = Partial<Record<Key, unknown>>
export type TxResult<T> = { changes?: Changes; message?: string; result: T }

const getEnv = (key: string): string | undefined =>
  (globalThis as any).Netlify?.env?.get(key) ?? process.env[key]

function settings() {
  const token = getEnv("GITHUB_TOKEN")
  const repo = getEnv("DATA_REPO")
  if (!token || !repo) throw new Error("GITHUB_TOKEN and DATA_REPO must be set")
  return { token, repo, branch: getEnv("DATA_BRANCH") || "main" }
}

class ConflictError extends Error {}

async function gh(path: string, init: RequestInit = {}): Promise<Response> {
  const { token, repo } = settings()
  return fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "scholarlink-app",
      ...(init.headers || {}),
    },
  })
}

async function ok(res: Response, what: string): Promise<any> {
  if (!res.ok) throw new Error(`GitHub ${what} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

async function headSha(): Promise<string> {
  const { branch } = settings()
  const ref = await ok(await gh(`/git/ref/heads/${branch}`), "read branch")
  return ref.object.sha
}

async function readFile(path: string, ref: string): Promise<any> {
  const res = await gh(`/contents/${path}?ref=${ref}`, {
    headers: { Accept: "application/vnd.github.raw+json" },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub read ${path} failed: ${res.status}`)
  return JSON.parse(await res.text())
}

export async function load(keys: Key[]): Promise<{ sha: string; data: Data }> {
  const sha = await headSha()
  const data = {} as Data
  await Promise.all(
    keys.map(async (k) => {
      const value = await readFile(FILES[k], sha)
      data[k] = value ?? (k === "config" ? null : [])
    }),
  )
  if (keys.includes("config") && !data.config) throw new Error("config.json is missing from the data repo")
  return { sha, data }
}

async function commit(parent: string, changes: Changes, message: string): Promise<void> {
  const { branch } = settings()
  const parentCommit = await ok(await gh(`/git/commits/${parent}`), "read commit")
  const tree = await ok(
    await gh(`/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: parentCommit.tree.sha,
        tree: Object.entries(changes).map(([k, v]) => ({
          path: FILES[k as Key],
          mode: "100644",
          type: "blob",
          content: JSON.stringify(v, null, 2) + "\n",
        })),
      }),
    }),
    "create tree",
  )
  const newCommit = await ok(
    await gh(`/git/commits`, {
      method: "POST",
      body: JSON.stringify({ message, tree: tree.sha, parents: [parent] }),
    }),
    "create commit",
  )
  const res = await gh(`/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha, force: false }),
  })
  if (res.status === 422 || res.status === 409) throw new ConflictError()
  await ok(res, "update branch")
}

// Read the files, let `fn` change them, and commit. Retries when another write lands first.
export async function transact<T>(keys: Key[], fn: (data: Data) => TxResult<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { sha, data } = await load(keys)
    const out = fn(data)
    if (!out.changes || Object.keys(out.changes).length === 0) return out.result
    try {
      await commit(sha, out.changes, out.message || "Update data")
      return out.result
    } catch (e) {
      if (!(e instanceof ConflictError)) throw e
      await new Promise((r) => setTimeout(r, 150 * (attempt + 1) + Math.random() * 200))
    }
  }
  throw new Error("Too many simultaneous submissions; please try again.")
}
