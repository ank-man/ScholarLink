import type { Config } from "@netlify/functions"
import { load, transact, type Key } from "../../src/store.mts"
import {
  HttpError, applyUpdate, authenticate, publicConfig, registerMentee, registerMentor, requestHelp, stats, viewFor,
} from "../../src/logic.mts"
import { adminAction, adminLogin, adminSetup, currentAdmin, overview, userLogin } from "../../src/admin.mts"
import { limit, sign, verify } from "../../src/auth.mts"

const getEnv = (key: string): string | undefined => (globalThis as any).Netlify?.env?.get(key) ?? process.env[key]
const ip = (req: Request, ctx: any) => ctx?.ip || req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "local"

const ALL: Key[] = ["config", "mentors", "mentees", "matches", "help"]
const ADMIN: Key[] = [...ALL, "admins", "audit"]
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

export default async (req: Request, ctx?: any) => {
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
    // ---------- user sign-in (email + password set from the private page) ----------
    if (req.method === "POST" && route === "login") {
      const body = await readBody(req)
      limit("login:" + ip(req, ctx))
      const { data } = await load(ALL)
      const rec = userLogin(data, body)
      return json({ session: sign({ k: "user", id: rec.id }, 30), view: viewFor(data, rec.id) })
    }
    if (req.method === "GET" && route === "me") {
      const s = verify(req, "user")
      const { data } = await load(ALL)
      return json(viewFor(data, s.id))
    }
    if (req.method === "POST" && route === "me/update") {
      const s = verify(req, "user")
      const body = await readBody(req)
      const result = await transact(ALL, (data) => applyUpdate(data, body, now, s.id))
      cache.delete("stats")
      return json(result)
    }

    // ---------- admin ----------
    if (req.method === "GET" && route === "admin/setup") {
      const { data } = await load(["admins"])
      return json({ needsSetup: !data.admins.length, setupEnabled: !!getEnv("ADMIN_SETUP_CODE") })
    }
    if (req.method === "POST" && route === "admin/setup") {
      const body = await readBody(req)
      limit("setup:" + ip(req, ctx), 5)
      const r = await transact(ADMIN, (data) => adminSetup(data, body, now, getEnv("ADMIN_SETUP_CODE")))
      return json({ session: sign({ k: "admin", id: r.admin.id }, 1), admin: r.admin }, 201)
    }
    if (req.method === "POST" && route === "admin/login") {
      const body = await readBody(req)
      limit("admin:" + ip(req, ctx), 6)
      const r = await transact(ADMIN, (data) => adminLogin(data, body, now))
      if (r.error) throw new HttpError(401, "That email and password don't match an active admin account.")
      return json({ session: sign({ k: "admin", id: r.admin.id }, 1), admin: r.admin })
    }
    if (req.method === "GET" && route === "admin/overview") {
      const s = verify(req, "admin")
      const { data } = await load(ADMIN)
      return json(overview(data, currentAdmin(data, s), now))
    }
    if (req.method === "POST" && route === "admin/action") {
      const s = verify(req, "admin")
      const body = await readBody(req)
      const result = await transact(ADMIN, (data) => adminAction(data, currentAdmin(data, s), body, now, url.origin))
      cache.delete("stats")
      return json(result)
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
    return json({ error: "Something went wrong on our end. Please try again in a minute." }, 500)
  }
}

export const config: Config = { path: "/api/*" }
