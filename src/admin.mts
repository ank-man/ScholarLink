// Admin accounts, monitoring and management actions.
// Roles: "admin" sees and manages everything (including other admins); "lead" (a GSA Mentor Lead)
// sees and manages only their departments. Every sign-in and action is written to audit.json.
import type { Data, TxResult } from "./store.mts"
import { ACTIVE, HttpError, autoAssignHelp, autoMatch, hash, newToken, nextId, openSlots } from "./logic.mts"
import { checkPassword, hashPassword, validPassword } from "./auth.mts"

const DAY = 86_400_000
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "")
const days = (from: string | null | undefined, now: string) => (from ? Math.floor((Date.parse(now) - Date.parse(from)) / DAY) : null)
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null)

export const STALL_DAYS = 21 // no first meeting three weeks after matching
export const OVERDUE_DAYS = 56 // eight-week window over without a second meeting
export const WAIT_DAYS = 3 // student waiting for a mentor
export const HELP_DAYS = 14 // help request open this long

function audit(data: Data, now: string, who: any, action: string, detail = "") {
  data.audit = Array.isArray(data.audit) ? data.audit : []
  data.audit.unshift({ at: now, by: who ? `${who.name} <${who.email}>` : "system", role: who?.role || "", action, detail })
  data.audit = data.audit.slice(0, 2000)
}

const publicAdmin = (a: any) => ({ id: a.id, name: a.name, email: a.email, role: a.role, departments: a.departments || [], createdAt: a.createdAt, lastLogin: a.lastLogin || null, active: a.active !== false })

// ---------- accounts ----------
export function adminLogin(data: Data, body: any, now: string): TxResult<any> {
  const email = clean(body.email, 120).toLowerCase()
  const a = (data.admins || []).find((x: any) => x.email === email && x.active !== false)
  const ok = checkPassword(String(body.password || ""), a?.passwordHash)
  if (!a || !ok) {
    audit(data, now, null, "Failed admin sign-in", email)
    return { changes: { audit: data.audit }, message: "Failed admin sign-in", result: { error: true } }
  }
  a.lastLogin = now
  audit(data, now, a, "Signed in")
  return { changes: { admins: data.admins, audit: data.audit }, message: `Admin sign-in ${a.id}`, result: { admin: publicAdmin(a) } }
}

export function adminSetup(data: Data, body: any, now: string, setupCode: string | undefined): TxResult<any> {
  if ((data.admins || []).length) throw new HttpError(409, "ScholarLink already has an administrator. Sign in instead.")
  if (!setupCode || String(body.code || "") !== setupCode) throw new HttpError(403, "That setup code isn't right.")
  const a = newAdmin(data, { ...body, role: "admin" }, now)
  audit(data, now, a, "Created the first administrator account")
  return { changes: { admins: data.admins, audit: data.audit }, message: `First admin ${a.id}`, result: { admin: publicAdmin(a) } }
}

export function newAdmin(data: Data, body: any, now: string): any {
  data.admins = Array.isArray(data.admins) ? data.admins : []
  const email = clean(body.email, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Please enter a valid email address.")
  if (data.admins.some((x: any) => x.email === email)) throw new HttpError(409, "That email already has an admin account.")
  const name = clean(body.name, 80)
  if (!name) throw new HttpError(400, "Please fill in: Name.")
  const role = body.role === "lead" ? "lead" : "admin"
  const depts = role === "lead" ? (Array.isArray(body.departments) ? body.departments : [body.departments]).filter((d: any) => data.config.departments.some((x: any) => x.name === d)) : []
  if (role === "lead" && !depts.length) throw new HttpError(400, "Choose at least one department for a Mentor Lead.")
  const a = { id: nextId("A", data.admins), name, email, role, departments: depts, passwordHash: hashPassword(validPassword(body.password)), createdAt: now, lastLogin: null, active: true }
  data.admins.push(a)
  return a
}

export function currentAdmin(data: Data, session: any): any {
  const a = (data.admins || []).find((x: any) => x.id === session.id && x.active !== false)
  if (!a) throw new HttpError(401, "Please sign in again.")
  return a
}

// ---------- monitoring ----------
export function overview(data: Data, admin: any, now: string) {
  const scope = admin.role === "admin" ? null : new Set<string>(admin.departments)
  const inScope = (dept: string) => !scope || scope.has(dept)
  const mentors = data.mentors.filter((m: any) => inScope(m.department))
  const mentees = data.mentees.filter((m: any) => inScope(m.department))
  const matches = data.matches.filter((m: any) => inScope(m.department))
  const help = data.help.filter((h: any) => !scope || scope.has(h.department) || mentors.some((m: any) => m.id === h.helperId))
  const live = (x: any) => x.status !== "Withdrawn"
  const liveMatches = matches.filter(ACTIVE)
  const byId = new Map<string, any>([...data.mentors, ...data.mentees].map((x: any) => [x.id, x]))
  const isMatched = (s: any) => data.matches.some((m: any) => m.menteeId === s.id && ACTIVE(m))

  const matchRows = matches.map((m: any) => {
    const age = days(m.createdAt, now)!
    const flag = !ACTIVE(m) ? "" : m.meeting2 ? "" : !m.meeting1 && age >= STALL_DAYS ? "stalled" : age >= OVERDUE_DAYS ? "overdue" : ""
    return {
      id: m.id, department: m.department, score: m.score, status: m.status, createdAt: m.createdAt, ageDays: age,
      mentee: { id: m.menteeId, name: byId.get(m.menteeId)?.name, email: byId.get(m.menteeId)?.email },
      mentor: { id: m.mentorId, name: byId.get(m.mentorId)?.name, email: byId.get(m.mentorId)?.email },
      meeting1: m.meeting1, meeting2: m.meeting2, menteeRating: m.menteeRating, mentorRating: m.mentorRating, flag,
    }
  })
  const ratings = liveMatches.flatMap((m: any) => [m.menteeRating, m.mentorRating]).filter((r: any) => Number.isInteger(r))

  const alerts: any[] = []
  for (const s of mentees.filter(live)) {
    const w = days(s.createdAt, now)!
    if (!isMatched(s) && w >= WAIT_DAYS) alerts.push({ level: "high", kind: "Waiting for a mentor", dept: s.department, who: s.name, id: s.id, detail: `${w} days, no mentor with room in ${s.department}` })
  }
  for (const m of matchRows) {
    if (m.flag === "stalled") alerts.push({ level: "medium", kind: "No first meeting", dept: m.department, who: `${m.mentor.name} → ${m.mentee.name}`, id: m.id, detail: `${m.ageDays} days since matching` })
    if (m.flag === "overdue") alerts.push({ level: "medium", kind: "Second meeting overdue", dept: m.department, who: `${m.mentor.name} → ${m.mentee.name}`, id: m.id, detail: `${m.ageDays} days since matching` })
    for (const [who, r] of [["mentee", m.menteeRating], ["mentor", m.mentorRating]] as const)
      if (Number.isInteger(r) && r <= 2) alerts.push({ level: "high", kind: "Low rating", dept: m.department, who: `${m.mentor.name} → ${m.mentee.name}`, id: m.id, detail: `${who} rated ${r}/5` })
  }
  for (const h of help) {
    const d = days(h.createdAt, now)!
    if (h.status === "Waiting" && d >= 1) alerts.push({ level: "medium", kind: "Help request unassigned", dept: h.department, who: h.name, id: h.id, detail: `${d} days, no volunteer with room` })
    if (h.status === "Assigned" && days(h.assignedAt, now)! >= HELP_DAYS) alerts.push({ level: "low", kind: "Help request open", dept: h.department, who: h.name, id: h.id, detail: `assigned ${days(h.assignedAt, now)} days ago` })
  }
  for (const m of mentors.filter(live)) if (!m.trainedAt && days(m.createdAt, now)! >= 7) alerts.push({ level: "low", kind: "Training not recorded", dept: m.department, who: m.name, id: m.id, detail: `signed up ${days(m.createdAt, now)} days ago` })
  const order = { high: 0, medium: 1, low: 2 } as any
  alerts.sort((a, b) => order[a.level] - order[b.level])

  // sign-ups per week, last 12 weeks
  const weekStart = (d: number) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.getTime() }
  const w0 = weekStart(Date.parse(now)) - 11 * 7 * DAY
  const weeks = Array.from({ length: 12 }, (_, i) => ({ week: new Date(w0 + i * 7 * DAY).toISOString().slice(0, 10), mentors: 0, mentees: 0, help: 0, meetings: 0 }))
  const bump = (iso: string | null, key: string) => { if (!iso) return; const i = Math.floor((weekStart(Date.parse(iso)) - w0) / (7 * DAY)); if (i >= 0 && i < 12) (weeks[i] as any)[key]++ }
  mentors.forEach((x: any) => bump(x.createdAt, "mentors")); mentees.forEach((x: any) => bump(x.createdAt, "mentees")); help.forEach((x: any) => bump(x.createdAt, "help"))
  liveMatches.forEach((m: any) => { bump(m.meeting1, "meetings"); bump(m.meeting2, "meetings") })

  const depts = data.config.departments.filter((d: any) => inScope(d.name)).map((d: any) => {
    const dm = mentors.filter((m: any) => m.department === d.name && live(m))
    const ds = mentees.filter((s: any) => s.department === d.name && live(s))
    const dx = liveMatches.filter((m: any) => m.department === d.name)
    const dr = dx.flatMap((m: any) => [m.menteeRating, m.mentorRating]).filter((r: any) => Number.isInteger(r))
    return {
      name: d.name, lead: d.lead || "", leadEmail: d.leadEmail || "",
      mentors: dm.length, trained: dm.filter((m: any) => m.trainedAt).length,
      capacity: dm.reduce((n: number, m: any) => n + m.maxMentees, 0), openSlots: dm.reduce((n: number, m: any) => n + openSlots(m, data.matches), 0),
      students: ds.length, waiting: ds.filter((s: any) => !isMatched(s)).length, matches: dx.length,
      meeting1: dx.filter((m: any) => m.meeting1).length, completed: dx.filter((m: any) => m.meeting2).length, rating: avg(dr),
    }
  })

  const person = (x: any, role: string) => ({
    id: x.id, role, name: x.name, email: x.email, department: x.department, status: x.status, createdAt: x.createdAt,
    detail: role === "mentor" ? `${x.program} · ${openSlots(x, data.matches)}/${x.maxMentees} open${x.helpsWithApplications ? " · helps with applications" : ""}` : role === "mentee" ? `${x.year} · ${x.major}${isMatched(x) ? "" : " · waiting"}` : `${x.applicationType} · ${x.status}`,
    trainedAt: x.trainedAt || null, hasPassword: !!x.passwordHash,
  })

  return {
    me: publicAdmin(admin), now,
    thresholds: { stallDays: STALL_DAYS, overdueDays: OVERDUE_DAYS, waitDays: WAIT_DAYS, helpDays: HELP_DAYS },
    totals: {
      mentors: mentors.filter(live).length, trained: mentors.filter((m: any) => live(m) && m.trainedAt).length,
      mentees: mentees.filter(live).length, waiting: mentees.filter((s: any) => live(s) && !isMatched(s)).length,
      matches: liveMatches.length, meeting1: liveMatches.filter((m: any) => m.meeting1).length, completed: liveMatches.filter((m: any) => m.meeting2).length,
      rated: liveMatches.filter((m: any) => m.menteeRating || m.mentorRating).length, rating: avg(ratings),
      helpOpen: help.filter((h: any) => h.status === "Waiting" || h.status === "Assigned").length, helpResolved: help.filter((h: any) => h.status === "Resolved").length,
      openSlots: mentors.filter(live).reduce((n: number, m: any) => n + openSlots(m, data.matches), 0),
      withPassword: [...mentors, ...mentees].filter((x: any) => x.passwordHash).length,
    },
    funnel: [
      ["Students signed up", mentees.filter(live).length], ["Matched", liveMatches.length], ["Meeting 1", liveMatches.filter((m: any) => m.meeting1).length],
      ["Meeting 2", liveMatches.filter((m: any) => m.meeting2).length], ["Rated", liveMatches.filter((m: any) => m.menteeRating || m.mentorRating).length],
    ],
    weeks, departments: depts, alerts, matches: matchRows.sort((a: any, b: any) => String(b.createdAt).localeCompare(a.createdAt)),
    people: [...mentors.map((x: any) => person(x, "mentor")), ...mentees.map((x: any) => person(x, "mentee")), ...help.map((x: any) => person(x, "help"))].sort((a, b) => String(b.createdAt).localeCompare(a.createdAt)),
    help: help.map((h: any) => ({ id: h.id, name: h.name, email: h.email, department: h.department, applicationType: h.applicationType, topics: h.topics, deadline: h.deadline, status: h.status, createdAt: h.createdAt, helper: h.helperId ? byId.get(h.helperId)?.name || h.helperId : null })),
    audit: (data.audit || []).filter((e: any) => admin.role === "admin" || !/admin account/i.test(e.action)).slice(0, 200),
    admins: admin.role === "admin" ? (data.admins || []).map(publicAdmin) : [],
    departmentNames: data.config.departments.map((d: any) => d.name),
  }
}

// ---------- actions ----------
const KIND: Record<string, "mentors" | "mentees" | "help"> = { G: "mentors", U: "mentees", H: "help" }
function findRecord(data: Data, admin: any, id: string) {
  const kind = KIND[String(id).charAt(0)]
  const rec = kind && data[kind].find((x: any) => x.id === id)
  if (!rec) throw new HttpError(404, "Record not found.")
  if (admin.role !== "admin" && !admin.departments.includes(rec.department)) throw new HttpError(403, "That record is outside your departments.")
  return { kind, rec }
}

export function adminAction(data: Data, admin: any, body: any, now: string, origin: string): TxResult<any> {
  const act = String(body.action || "")
  const done = (changes: any, what: string, result: any = {}) => {
    audit(data, now, admin, what, clean(body.reason, 200))
    return { changes: { ...changes, audit: data.audit }, message: `Admin ${admin.id}: ${what}`, result: { ok: true, message: what, ...result, overview: overview(data, admin, now) } }
  }

  if (act === "runMatching") {
    const m = autoMatch(data, now), h = autoAssignHelp(data, now)
    return done({ matches: data.matches, help: data.help }, `Ran matching: ${m.length} new match(es), ${h.length} help request(s) assigned`)
  }
  if (act === "endMatch" || act === "rematch") {
    const m = data.matches.find((x: any) => x.id === body.matchId)
    if (!m || !ACTIVE(m)) throw new HttpError(404, "Match not found.")
    if (admin.role !== "admin" && !admin.departments.includes(m.department)) throw new HttpError(403, "That match is outside your departments.")
    m.status = "Withdrawn"; m.endedAt = now; m.endedBy = admin.id
    let extra = ""
    if (act === "rematch") {
      // try a different mentor: hide the old one from this round
      const old = data.mentors.find((x: any) => x.id === m.mentorId), keep = old?.status
      if (old) old.status = "Withdrawn"
      const made = autoMatch(data, now).filter((x: any) => x.menteeId === m.menteeId)
      if (old) old.status = keep
      extra = made.length ? ` → new match ${made[0].id}` : " (no other mentor with room yet; the student is waiting)"
    }
    return done({ matches: data.matches }, `${act === "rematch" ? "Rematched" : "Ended"} ${m.id}${extra}`)
  }
  if (act === "withdraw" || act === "reinstate") {
    const { kind, rec } = findRecord(data, admin, String(body.id))
    rec.status = act === "withdraw" ? "Withdrawn" : kind === "help" ? (rec.helperId ? "Assigned" : "Waiting") : "Active"
    if (act === "withdraw" && kind !== "help") for (const m of data.matches) if (ACTIVE(m) && (m.menteeId === rec.id || m.mentorId === rec.id)) { m.status = "Withdrawn"; m.endedAt = now; m.endedBy = admin.id }
    autoMatch(data, now); autoAssignHelp(data, now)
    return done({ [kind]: data[kind], matches: data.matches, help: data.help }, `${act === "withdraw" ? "Withdrew" : "Reinstated"} ${rec.id} (${rec.name})`)
  }
  if (act === "resetLink") {
    const { kind, rec } = findRecord(data, admin, String(body.id))
    const token = newToken()
    rec.tokenHash = hash(token); delete rec.passwordHash
    const url = `${origin}/status.html?id=${encodeURIComponent(rec.id)}&t=${encodeURIComponent(token)}`
    return done({ [kind]: data[kind] }, `Issued a new private link for ${rec.id} (${rec.name}); old link and password no longer work`, { url, email: rec.email, name: rec.name })
  }
  if (act === "setLead") {
    if (admin.role !== "admin") throw new HttpError(403, "Only administrators can change Mentor Leads.")
    const d = data.config.departments.find((x: any) => x.name === body.department)
    if (!d) throw new HttpError(404, "Department not found.")
    d.lead = clean(body.lead, 80); d.leadEmail = clean(body.leadEmail, 120).toLowerCase()
    return done({ config: data.config }, `Set Mentor Lead for ${d.name}: ${d.lead || "(none)"}`)
  }
  if (act === "addAdmin") {
    if (admin.role !== "admin") throw new HttpError(403, "Only administrators can add accounts.")
    const a = newAdmin(data, body, now)
    return done({ admins: data.admins }, `Created ${a.role} account for ${a.name} <${a.email}>`)
  }
  if (act === "disableAdmin" || act === "enableAdmin") {
    if (admin.role !== "admin") throw new HttpError(403, "Only administrators can change accounts.")
    const a = (data.admins || []).find((x: any) => x.id === body.adminId)
    if (!a) throw new HttpError(404, "Account not found.")
    if (a.id === admin.id) throw new HttpError(400, "You can't disable your own account.")
    a.active = act === "enableAdmin"
    return done({ admins: data.admins }, `${a.active ? "Enabled" : "Disabled"} admin account ${a.email}`)
  }
  if (act === "changePassword") {
    if (!checkPassword(String(body.current || ""), admin.passwordHash)) throw new HttpError(400, "Your current password isn't right.")
    admin.passwordHash = hashPassword(validPassword(body.password))
    return done({ admins: data.admins }, "Changed own admin account password")
  }
  throw new HttpError(400, "Unknown action.")
}

// ---------- user sign-in ----------
export function userLogin(data: Data, body: any): any {
  const email = clean(body.email, 120).toLowerCase()
  const pw = String(body.password || "")
  const recs = [...data.mentors, ...data.mentees, ...data.help].filter((x: any) => x.email === email && x.status !== "Withdrawn" && x.passwordHash)
  const hit = recs.find((x: any) => checkPassword(pw, x.passwordHash))
  if (!recs.length) checkPassword(pw, undefined) // same timing as a wrong password
  if (!hit) throw new HttpError(401, "That email and password don't match. Use your private link, or ask your Mentor Lead for a new one.")
  return hit
}
