// Validation, matching, and views. Pure functions over the loaded data, so they're easy to test.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import type { Data, TxResult } from "./store.mts"

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const OTHER_DEPT = "Other / not listed"
const ACTIVE = (m: any) => m.status !== "Withdrawn"

// ---------- input helpers ----------
const clean = (v: unknown, max: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : ""
const cleanLong = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

function required(body: any, key: string, label: string, max = 120): string {
  const v = clean(body[key], max)
  if (!v) throw new HttpError(400, `Please fill in: ${label}.`)
  return v
}

function oneOf(v: unknown, list: readonly (string | number)[], label: string): any {
  const found = list.find((x) => String(x) === String(v))
  if (found === undefined) throw new HttpError(400, `Please choose a valid option for: ${label}.`)
  return found
}

function manyOf(v: unknown, list: readonly string[], label: string, need = true): string[] {
  const picked = Array.isArray(v) ? [...new Set(v.filter((x) => list.includes(x)))] : []
  if (need && picked.length === 0) throw new HttpError(400, `Please choose at least one option for: ${label}.`)
  return picked
}

function email(v: unknown, domains: string[]): string {
  const e = clean(v, 120).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) throw new HttpError(400, "Please enter a valid email address.")
  if (domains.length) {
    const host = e.split("@")[1]
    if (!domains.some((d) => host === d || host.endsWith("." + d)))
      throw new HttpError(400, `Please use your university email (${domains.map((d) => "@" + d).join(", ")}).`)
  }
  return e
}

function agreed(body: any, key: string, label: string) {
  if (body[key] !== true && body[key] !== "Yes") throw new HttpError(400, `Please confirm: ${label}.`)
}

export function checkHoneypot(body: any) {
  if (clean(body.website, 100)) throw new HttpError(400, "Submission rejected.")
}

// ---------- ids and tokens ----------
export function nextId(prefix: string, list: any[]): string {
  const max = list.reduce((n, x) => Math.max(n, Number(String(x.id).split("-")[1]) || 0), 0)
  return `${prefix}-${String(max + 1).padStart(3, "0")}`
}
const hash = (t: string) => createHash("sha256").update(t).digest("hex")
const newToken = () => randomBytes(18).toString("base64url")

// ---------- matching ----------
export function score(mentee: any, mentor: any, w: any) {
  const research = String(mentor.research || "").toLowerCase()
  const parts = {
    department: mentee.department === mentor.department ? w.department : 0,
    interests: mentee.interests.filter((k: string) => k && research.includes(k.toLowerCase())).length * w.keyword,
    careers: mentee.careers.filter((c: string) => mentor.careers.includes(c)).length * w.career,
    availability: mentee.availability.filter((a: string) => mentor.availability.includes(a)).length * w.availability,
    format: mentee.format === "Either" || mentor.format === "Either" || mentee.format === mentor.format ? w.format : 0,
  }
  return { total: Object.values(parts).reduce((a: number, b: any) => a + b, 0), parts }
}

export const openSlots = (mentor: any, matches: any[]) =>
  Math.max(0, mentor.maxMentees - matches.filter((m) => m.mentorId === mentor.id && ACTIVE(m)).length)

const openHelp = (mentor: any, help: any[]) =>
  help.filter((h) => h.helperId === mentor.id && h.status === "Assigned").length

const byCreated = (a: any, b: any) => String(a.createdAt).localeCompare(String(b.createdAt))

// Pair every waiting student with the best same-department mentor who has room.
export function autoMatch(data: Data, now: string): any[] {
  const w = data.config.weights
  const created: any[] = []
  for (const mentee of [...data.mentees].sort(byCreated)) {
    if (mentee.status === "Withdrawn") continue
    if (data.matches.some((m: any) => m.menteeId === mentee.id && ACTIVE(m))) continue
    const candidates = data.mentors.filter(
      (mr: any) => mr.status !== "Withdrawn" && mr.department === mentee.department && openSlots(mr, data.matches) > 0,
    )
    if (!candidates.length) continue
    const ranked = candidates
      .map((mr: any) => ({ mr, s: score(mentee, mr, w).total }))
      .sort((a: any, b: any) => b.s - a.s || byCreated(a.mr, b.mr))
    const best = ranked[0]
    const match = {
      id: nextId("M", data.matches),
      menteeId: mentee.id,
      mentorId: best.mr.id,
      department: mentee.department,
      score: best.s,
      createdAt: now,
      status: "Matched",
      meeting1: null,
      meeting2: null,
      menteeRating: null,
      mentorRating: null,
    }
    data.matches.push(match)
    created.push(match)
  }
  return created
}

// Give each waiting help request to the least-busy volunteer, preferring the same department.
export function autoAssignHelp(data: Data, now: string): any[] {
  const cap = data.config.maxOpenHelpPerMentor ?? 3
  const assigned: any[] = []
  for (const h of [...data.help].sort(byCreated)) {
    if (h.status !== "Waiting") continue
    const volunteers = data.mentors.filter(
      (mr: any) => mr.status !== "Withdrawn" && mr.helpsWithApplications && openHelp(mr, data.help) < cap,
    )
    if (!volunteers.length) continue
    const sameDept = volunteers.filter((mr: any) => mr.department === h.department)
    const pool = (sameDept.length ? sameDept : volunteers).sort(
      (a: any, b: any) => openHelp(a, data.help) - openHelp(b, data.help) || byCreated(a, b),
    )
    h.helperId = pool[0].id
    h.status = "Assigned"
    h.assignedAt = now
    assigned.push(h)
  }
  return assigned
}

// ---------- public config & stats ----------
export function publicConfig(c: any) {
  return {
    programName: c.programName,
    allowedEmailDomains: c.allowedEmailDomains,
    departments: c.departments.map((d: any) => d.name),
    otherDepartment: OTHER_DEPT,
    years: c.years,
    programs: c.programs,
    careers: c.careers,
    availability: c.availability,
    formats: c.formats,
    maxMenteesOptions: c.maxMenteesOptions,
    helpTopics: c.helpTopics,
    applicationTypes: c.applicationTypes,
  }
}

export function stats(data: Data) {
  const mentors = data.mentors.filter((m: any) => m.status !== "Withdrawn")
  const matches = data.matches.filter(ACTIVE)
  return {
    mentors: mentors.length,
    students: data.mentees.filter((m: any) => m.status !== "Withdrawn").length,
    matches: matches.length,
    meetings: matches.reduce((n: number, m: any) => n + (m.meeting1 ? 1 : 0) + (m.meeting2 ? 1 : 0), 0),
    helpResolved: data.help.filter((h: any) => h.status === "Resolved").length,
    departments: data.config.departments.map((d: any) => ({
      name: d.name,
      mentors: mentors.filter((m: any) => m.department === d.name).length,
      openSlots: mentors.filter((m: any) => m.department === d.name).reduce((n: number, m: any) => n + openSlots(m, data.matches), 0),
      waiting: data.mentees.filter(
        (s: any) => s.department === d.name && s.status !== "Withdrawn" && !data.matches.some((m: any) => m.menteeId === s.id && ACTIVE(m)),
      ).length,
    })),
  }
}

// ---------- registration ----------
function ensureNewEmail(list: any[], e: string) {
  if (list.some((x) => x.email === e && x.status !== "Withdrawn"))
    throw new HttpError(409, "This email is already registered. Use the personal link you saved, or contact your department's Mentor Lead.")
}

export function registerMentee(data: Data, body: any, now: string): TxResult<any> {
  const c = data.config
  checkHoneypot(body)
  const e = email(body.email, c.allowedEmailDomains)
  ensureNewEmail(data.mentees, e)
  const interests = [body.interest1, body.interest2, body.interest3].map((k) => clean(k, 40)).filter(Boolean)
  if (!interests.length) throw new HttpError(400, "Please add at least one interest keyword.")
  agreed(body, "commitment", "two meetings over eight weeks")
  const token = newToken()
  const mentee = {
    id: nextId("U", data.mentees),
    createdAt: now,
    status: "Active",
    name: required(body, "name", "Full name", 80),
    email: e,
    year: oneOf(body.year, c.years, "Year"),
    major: required(body, "major", "Major", 80),
    department: oneOf(body.department, c.departments.map((d: any) => d.name), "Department"),
    interests,
    careers: manyOf(body.careers, c.careers, "Career goals"),
    availability: manyOf(body.availability, c.availability, "Availability"),
    format: oneOf(body.format, c.formats, "Meeting format"),
    hopes: cleanLong(body.hopes, 1500),
    tokenHash: hash(token),
  }
  data.mentees.push(mentee)
  const created = autoMatch(data, now)
  return {
    changes: { mentees: data.mentees, ...(created.length ? { matches: data.matches } : {}) },
    message: `Register mentee ${mentee.id}${created.length ? ` and match with ${created[0].mentorId}` : ""}`,
    result: { id: mentee.id, token, view: viewFor(data, mentee.id) },
  }
}

export function registerMentor(data: Data, body: any, now: string): TxResult<any> {
  const c = data.config
  checkHoneypot(body)
  const e = email(body.email, c.allowedEmailDomains)
  ensureNewEmail(data.mentors, e)
  agreed(body, "commitment", "two meetings with each mentee over eight weeks")
  const token = newToken()
  const mentor = {
    id: nextId("G", data.mentors),
    createdAt: now,
    status: "Active",
    name: required(body, "name", "Full name", 80),
    email: e,
    program: oneOf(body.program, c.programs, "Program"),
    department: oneOf(body.department, c.departments.map((d: any) => d.name), "Department"),
    research: (() => {
      const r = cleanLong(body.research, 1500)
      if (!r) throw new HttpError(400, "Please fill in: Research areas & expertise.")
      return r
    })(),
    careers: manyOf(body.careers, c.careers, "Career paths"),
    availability: manyOf(body.availability, c.availability, "Availability"),
    format: oneOf(body.format, c.formats, "Meeting format"),
    maxMentees: Number(oneOf(body.maxMentees, c.maxMenteesOptions, "Max mentees")),
    helpsWithApplications: body.helpsWithApplications === "Yes" || body.helpsWithApplications === true,
    notes: cleanLong(body.notes, 1000),
    tokenHash: hash(token),
  }
  data.mentors.push(mentor)
  const matched = autoMatch(data, now)
  const helped = autoAssignHelp(data, now)
  return {
    changes: {
      mentors: data.mentors,
      ...(matched.length ? { matches: data.matches } : {}),
      ...(helped.length ? { help: data.help } : {}),
    },
    message: `Register mentor ${mentor.id}` + (matched.length ? `, ${matched.length} match(es)` : "") + (helped.length ? `, ${helped.length} help request(s)` : ""),
    result: { id: mentor.id, token, view: viewFor(data, mentor.id) },
  }
}

export function requestHelp(data: Data, body: any, now: string): TxResult<any> {
  const c = data.config
  checkHoneypot(body)
  const e = email(body.email, c.allowedEmailDomains)
  if (data.help.some((h: any) => h.email === e && (h.status === "Waiting" || h.status === "Assigned")))
    throw new HttpError(409, "You already have an open help request. Use its personal link to check on it, or mark it resolved first.")
  const deadline = clean(body.deadline, 10)
  if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) throw new HttpError(400, "Please enter the deadline as a date.")
  const details = cleanLong(body.details, 2000)
  if (!details) throw new HttpError(400, "Please describe what you'd like help with.")
  const token = newToken()
  const req = {
    id: nextId("H", data.help),
    createdAt: now,
    status: "Waiting",
    name: required(body, "name", "Full name", 80),
    email: e,
    year: oneOf(body.year, [...c.years, "Graduate / alum"], "Year"),
    major: required(body, "major", "Major", 80),
    department: oneOf(body.department, [...c.departments.map((d: any) => d.name), OTHER_DEPT], "Field"),
    applicationType: oneOf(body.applicationType, c.applicationTypes, "Application type"),
    targetPrograms: clean(body.targetPrograms, 300),
    deadline: deadline || null,
    topics: manyOf(body.topics, c.helpTopics, "Help topics"),
    details,
    format: oneOf(body.format, c.formats, "Meeting format"),
    helperId: null,
    tokenHash: hash(token),
  }
  data.help.push(req)
  autoAssignHelp(data, now)
  return {
    changes: { help: data.help },
    message: `Help request ${req.id}${req.helperId ? ` assigned to ${req.helperId}` : ""}`,
    result: { id: req.id, token, view: viewFor(data, req.id) },
  }
}

// ---------- personal views ----------
function collectionFor(id: string): "mentees" | "mentors" | "help" {
  if (/^U-\d+$/.test(id)) return "mentees"
  if (/^G-\d+$/.test(id)) return "mentors"
  if (/^H-\d+$/.test(id)) return "help"
  throw new HttpError(404, "That link isn't valid.")
}

export function authenticate(data: Data, id: string, token: string): any {
  const rec = data[collectionFor(id)].find((x: any) => x.id === id)
  const a = Buffer.from(rec ? rec.tokenHash : "x".repeat(64))
  const b = Buffer.from(hash(String(token || "")))
  if (!rec || a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(404, "That link isn't valid.")
  return rec
}

const leadFor = (data: Data, dept: string) => {
  const d = data.config.departments.find((x: any) => x.name === dept)
  return d && d.lead ? { name: d.lead, email: d.leadEmail || "" } : null
}

export function viewFor(data: Data, id: string): any {
  const kind = collectionFor(id)
  if (kind === "mentees") {
    const me = data.mentees.find((x: any) => x.id === id)
    const match = data.matches.find((m: any) => m.menteeId === id && ACTIVE(m))
    const mentor = match && data.mentors.find((x: any) => x.id === match.mentorId)
    return {
      role: "mentee", id, name: me.name, department: me.department,
      lead: leadFor(data, me.department),
      match: match && mentor ? {
        id: match.id, status: match.status, createdAt: match.createdAt,
        meeting1: match.meeting1, meeting2: match.meeting2, myRating: match.menteeRating,
        other: { name: mentor.name, email: mentor.email, program: mentor.program, department: mentor.department,
          research: mentor.research, format: mentor.format, availability: mentor.availability },
      } : null,
    }
  }
  if (kind === "mentors") {
    const me = data.mentors.find((x: any) => x.id === id)
    return {
      role: "mentor", id, name: me.name, department: me.department,
      maxMentees: me.maxMentees, openSlots: openSlots(me, data.matches),
      helpsWithApplications: me.helpsWithApplications,
      lead: leadFor(data, me.department),
      matches: data.matches.filter((m: any) => m.mentorId === id && ACTIVE(m)).map((m: any) => {
        const s = data.mentees.find((x: any) => x.id === m.menteeId) || {}
        return {
          id: m.id, status: m.status, createdAt: m.createdAt, meeting1: m.meeting1, meeting2: m.meeting2, myRating: m.mentorRating,
          other: { name: s.name, email: s.email, year: s.year, major: s.major, interests: s.interests,
            careers: s.careers, availability: s.availability, format: s.format, hopes: s.hopes },
        }
      }),
      help: data.help.filter((h: any) => h.helperId === id).map((h: any) => ({
        id: h.id, status: h.status, createdAt: h.createdAt,
        requester: { name: h.name, email: h.email, year: h.year, major: h.major, department: h.department,
          applicationType: h.applicationType, targetPrograms: h.targetPrograms, deadline: h.deadline,
          topics: h.topics, details: h.details, format: h.format },
      })),
    }
  }
  const h = data.help.find((x: any) => x.id === id)
  const helper = h.helperId && data.mentors.find((x: any) => x.id === h.helperId)
  return {
    role: "help", id, name: h.name, status: h.status, createdAt: h.createdAt,
    topics: h.topics, deadline: h.deadline, applicationType: h.applicationType,
    lead: leadFor(data, h.department),
    helper: helper ? { name: helper.name, email: helper.email, program: helper.program, department: helper.department, research: helper.research } : null,
  }
}

// ---------- updates from the personal page ----------
export function applyUpdate(data: Data, body: any, now: string): TxResult<any> {
  const id = clean(body.id, 12)
  const me = authenticate(data, id, body.token)
  const role = collectionFor(id)
  const today = now.slice(0, 10)

  if (body.action === "meeting" || body.action === "rate") {
    if (role === "help") throw new HttpError(400, "Not available for help requests.")
    const match = data.matches.find((m: any) => m.id === body.matchId && ACTIVE(m))
    if (!match || (match.menteeId !== me.id && match.mentorId !== me.id)) throw new HttpError(404, "Match not found.")
    if (body.action === "meeting") {
      const which = Number(body.which)
      const date = clean(body.date, 10) || today
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) throw new HttpError(400, "Please pick a meeting date that isn't in the future.")
      if (which === 1) match.meeting1 = date
      else if (which === 2) {
        if (!match.meeting1) throw new HttpError(400, "Log the first meeting before the second.")
        if (date < match.meeting1) throw new HttpError(400, "The second meeting can't be before the first.")
        match.meeting2 = date
      } else throw new HttpError(400, "Unknown meeting.")
      match.status = match.meeting2 ? "Completed" : "Active"
    } else {
      const rating = Number(body.rating)
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, "Rating must be 1–5.")
      if (!match.meeting1) throw new HttpError(400, "You can rate after your first meeting.")
      match[role === "mentees" ? "menteeRating" : "mentorRating"] = rating
    }
    return { changes: { matches: data.matches }, message: `Update ${match.id} (${body.action}) by ${id}`, result: { view: viewFor(data, id) } }
  }

  if (body.action === "resolveHelp") {
    const h = data.help.find((x: any) => x.id === (role === "help" ? id : body.helpId))
    if (!h || (role === "help" ? h.id !== id : h.helperId !== id)) throw new HttpError(404, "Help request not found.")
    h.status = "Resolved"
    h.resolvedAt = now
    autoAssignHelp(data, now) // the helper has room again
    return { changes: { help: data.help }, message: `Resolve ${h.id} by ${id}`, result: { view: viewFor(data, id) } }
  }

  throw new HttpError(400, "Unknown action.")
}
