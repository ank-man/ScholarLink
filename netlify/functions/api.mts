import type { Config } from "@netlify/functions"
import { load, transact, type Key } from "../../src/store.mts"
import {
  HttpError, applyUpdate, authenticate, publicConfig, registerMentee, registerMentor, requestHelp, stats, viewFor,
} from "../../src/logic.mts"

const ALL: Key[] = ["config", "mentors", "mentees", "matches", "help"]
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } })

// Short in-memory caches for the public, non-personal endpoints.
const cache = new Map<string, { at: number; value: unknown }>()
async function cached(key: string, ttlMs: number, make: () => Promise<unknown>) {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value
  const value = await make()
  cache.set(key, { at: Date.now(), value })
  return value
}

async function readBody(req: Request) {
  const text = await req.text()
  if (text.length > 20_000) throw new HttpError(413, "Submission is too long.")
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, "Invalid submission.")
  }
}

export default async (req: Request) => {
  const url = new URL(req.url)
  const route = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "")
  const now = new Date().toISOString()
  try {
    if (req.method === "GET" && route === "config") {
      return json(await cached("config", 60_000, async () => publicConfig((await load(["config"])).data.config)))
    }
    if (req.method === "GET" && route === "stats") {
      return json(await cached("stats", 30_000, async () => stats((await load(ALL)).data)))
    }
    if (req.method === "GET" && route === "status") {
      const id = url.searchParams.get("id") || ""
      const { data } = await load(ALL)
      authenticate(data, id, url.searchParams.get("t") || "")
      return json(viewFor(data, id))
    }
    if (req.method === "POST") {
      const body = await readBody(req)
      const handlers: Record<string, typeof registerMentee> = {
        mentee: registerMentee,
        mentor: registerMentor,
        help: requestHelp,
        update: applyUpdate,
      }
      const handler = handlers[route]
      if (handler) {
        const result = await transact(ALL, (data) => handler(data, body, now))
        cache.delete("stats")
        return json(result, route === "update" ? 200 : 201)
      }
    }
    return json({ error: "Not found" }, 404)
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status)
    console.error(e)
    return json({ error: "Something went wrong saving your response. Please try again in a minute." }, 500)
  }
}

export const config: Config = { path: "/api/*" }
