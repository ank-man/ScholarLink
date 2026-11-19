// Passwords and signed sessions for user and admin sign-in.
// Passwords: scrypt with a random salt, stored as "scrypt$<salt>$<hash>". Sessions: HMAC-SHA256-signed JSON,
// sent as "Authorization: Bearer <session>". Needs SESSION_SECRET (any long random string) in production.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { HttpError } from "./logic.mts"

const getEnv = (key: string): string | undefined =>
  (globalThis as any).Netlify?.env?.get(key) ?? process.env[key]

function secret(): string {
  const s = getEnv("SESSION_SECRET")
  if (s && s.length >= 16) return s
  if (getEnv("LOCAL_DATA_DIR")) return "local-dev-only-session-secret"
  throw new HttpError(500, "Sign-in isn't set up yet (SESSION_SECRET is missing).")
}

// ---------- passwords ----------
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("base64url")
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString("base64url")}`
}
export function checkPassword(pw: string, stored: string | undefined): boolean {
  const [kind, salt, h] = String(stored || "").split("$")
  // Always run scrypt so a missing account takes as long as a wrong password.
  const got = scryptSync(String(pw || ""), salt || "no-salt-here", 32)
  if (kind !== "scrypt" || !h) return false
  const want = Buffer.from(h, "base64url")
  return want.length === got.length && timingSafeEqual(want, got)
}
export function validPassword(pw: unknown): string {
  const p = typeof pw === "string" ? pw : ""
  if (p.length < 10) throw new HttpError(400, "Use a password of at least 10 characters.")
  if (p.length > 200) throw new HttpError(400, "That password is too long.")
  return p
}

// ---------- sessions ----------
const b64 = (s: string) => Buffer.from(s).toString("base64url")
const sig = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url")

export function sign(payload: Record<string, unknown>, days: number): string {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + days * 86400 }))
  return `${body}.${sig(body)}`
}
export function verify(req: Request, kind: "user" | "admin"): any {
  const raw = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "")
  const [body, s] = raw.split(".")
  if (!body || !s) throw new HttpError(401, "Please sign in.")
  const want = Buffer.from(sig(body)), got = Buffer.from(s)
  if (want.length !== got.length || !timingSafeEqual(want, got)) throw new HttpError(401, "Please sign in again.")
  const p = JSON.parse(Buffer.from(body, "base64url").toString())
  if (p.k !== kind || !p.exp || p.exp < Date.now() / 1000) throw new HttpError(401, "Your session has expired. Please sign in again.")
  return p
}

// ---------- login rate limit (per instance) ----------
const tries = new Map<string, { n: number; reset: number }>()
export function limit(key: string, max = 8, windowMs = 15 * 60_000) {
  const now = Date.now(), t = tries.get(key)
  if (!t || t.reset < now) { tries.set(key, { n: 1, reset: now + windowMs }); return }
  if (++t.n > max) throw new HttpError(429, "Too many sign-in attempts. Please wait 15 minutes and try again.")
}
