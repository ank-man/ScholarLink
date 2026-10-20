// Shared front-end code for ScholarLink pages.
const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)]
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

// ---------- theme ----------
const theme = {
  get() { try { return localStorage.getItem("scholarlink-theme") } catch { return null } },
  current() { return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") },
  toggle() {
    const next = theme.current() === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = next
    try { localStorage.setItem("scholarlink-theme", next) } catch {}
  },
}
if (theme.get()) document.documentElement.dataset.theme = theme.get()

// ---------- saved personal links ----------
const store = {
  get() { try { return JSON.parse(localStorage.getItem("scholarlink-links") || "[]") } catch { return [] } },
  add(entry) {
    try {
      const list = store.get().filter((x) => x.id !== entry.id)
      list.unshift(entry)
      localStorage.setItem("scholarlink-links", JSON.stringify(list.slice(0, 5)))
    } catch {}
  },
}

// Details handed to the name card studio. Kept in this browser only.
const cardPrefill = {
  set(data) { try { localStorage.setItem("scholarlink-card", JSON.stringify(data)) } catch {} },
  take() {
    try {
      const d = JSON.parse(localStorage.getItem("scholarlink-card") || "null")
      localStorage.removeItem("scholarlink-card")
      return d
    } catch { return null }
  },
}

// ---------- header & footer ----------
// Program branding. Change it here and it updates the header, footer, and home page.
const PROGRAM = { initiative: "Bulldog Bridge", org: "UGA GSA", orgLong: "UGA Graduate Student Association" }
const TAGLINE = `A ${PROGRAM.initiative} initiative from ${PROGRAM.org}`
const NAV = [
  ["mentee", "/mentee.html", "Find a mentor"],
  ["mentor", "/mentor.html", "Become a mentor"],
  ["help", "/help.html", "Application help"],
]
const TOOLS = [
  ["guide", "/guide.html", "Grad school guide", "🧭", "Timeline, cold emails, checklist"],
  ["funding", "/funding.html", "Funding finder", "💰", "Fellowships and grants by field", "new"],
  ["cv", "/cv.html", "CV maker", "📄", "Academic CV in minutes", "new"],
  ["cards", "/cards.html", "Name cards", "🪪", "Cards and ScholarTap"],
]
const ICONS = {
  menu: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
  sun: `<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`,
  moon: `<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>`,
}

function renderHeader(page) {
  const head = $(".site-head")
  if (!head) return
  const links = NAV.map(([key, href, label]) => `<a href="${href}"${key === page ? ` aria-current="page"` : ""}>${label}</a>`).join("")
  const inTools = TOOLS.some(([key]) => key === page)
  const tools = `<div class="nav-drop"><button type="button" class="nav-drop-btn${inTools ? " current" : ""}" aria-expanded="false">Tools <span aria-hidden="true">▾</span></button>
    <div class="nav-menu">${TOOLS.map(([key, href, label, icon, desc, cls]) =>
      `<a href="${href}"${key === page ? ` aria-current="page"` : ""}><span class="ni">${icon}</span><span><b>${label}${cls && key !== page ? ` <i class="pill-new">New</i>` : ""}</b><small>${desc}</small></span></a>`).join("")}</div></div>`
  const mine = store.get()[0]
  head.innerHTML = `<div class="wrap">
    <a class="brand" href="/"><span class="brand-mark">S</span><span>ScholarLink<small>${PROGRAM.initiative} · ${PROGRAM.org}</small></span></a>
    <nav class="nav" id="nav">${links}${tools}${mine ? `<a class="mine" href="${esc(mine.url)}">My page</a>` : ""}</nav>
    <button class="icon-btn theme-toggle" type="button" aria-label="Switch light or dark mode">${ICONS.sun}${ICONS.moon}</button>
    <button class="icon-btn nav-toggle" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav">${ICONS.menu}</button>
  </div>`
  if (!$(".ambient")) document.body.insertAdjacentHTML("afterbegin", `<div class="ambient" aria-hidden="true"><i></i><i></i><i></i></div>`)
  $(".theme-toggle", head).onclick = theme.toggle
  const toggle = $(".nav-toggle", head)
  const drop = $(".nav-drop-btn", head)
  drop.onclick = (e) => {
    e.stopPropagation()
    const open = drop.parentElement.classList.toggle("open")
    drop.setAttribute("aria-expanded", open)
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".nav-drop")) { drop.parentElement.classList.remove("open"); drop.setAttribute("aria-expanded", "false") }
  })
  toggle.onclick = () => {
    const open = $("#nav").classList.toggle("open")
    toggle.setAttribute("aria-expanded", open)
  }
}

function renderFooter() {
  const f = $("footer.site-foot")
  if (!f || f.childElementCount) return
  f.innerHTML = `<div class="wrap"><span>ScholarLink is a <b>${PROGRAM.initiative}</b> initiative from the ${PROGRAM.orgLong} (GSA). Student-run; not an official University of Georgia website.</span>
    <span class="foot-links"><a href="/guide.html">Grad school guide</a><a href="/funding.html">Funding finder</a><a href="/cv.html">CV maker</a><a href="/cards.html">Name cards</a><a href="https://github.com/ank-man/ScholarLink">Source on GitHub</a></span></div>`
}

// ---------- api ----------
async function api(path, body) {
  const res = await fetch(`/api/${path}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {})
  let data = {}
  try { data = await res.json() } catch {}
  if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.")
  return data
}

let configPromise
const getConfig = () => (configPromise ||= api("config"))

// Fill <select data-options="key"> and <div data-choices="key" data-name data-type> from config.
async function populate(form) {
  const c = await getConfig()
  for (const sel of form.querySelectorAll("select[data-options]")) {
    const list = [...c[sel.dataset.options], ...(sel.dataset.extra ? sel.dataset.extra.split("|") : [])]
    sel.innerHTML = `<option value="">Choose…</option>` + list.map((v) => `<option>${esc(v)}</option>`).join("")
  }
  for (const box of form.querySelectorAll("[data-choices]")) {
    const type = box.dataset.type || "checkbox"
    const list = c[box.dataset.choices].filter((v) => !(box.dataset.exclude || "").split("|").includes(String(v)))
    box.innerHTML = list.map((v) =>
      `<label class="choice"><input type="${type}" name="${box.dataset.name}" value="${esc(v)}"><span>${esc(v)}</span></label>`).join("")
  }
  for (const el of form.querySelectorAll("[data-domain]")) {
    el.textContent = c.allowedEmailDomains.map((d) => "@" + d).join(" or ")
  }
}

function collect(form) {
  const out = {}
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue
    if (el.type === "checkbox") {
      if (el.dataset.single !== undefined) out[el.name] = el.checked
      else { out[el.name] ||= []; if (el.checked) out[el.name].push(el.value) }
    } else if (el.type === "radio") {
      if (el.checked) out[el.name] = el.value
    } else out[el.name] = el.value
  }
  return out
}

function statusLink(id, token) {
  return `${location.origin}/status.html?id=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}`
}

function linkBox(url) {
  return `<div class="linkbox"><input type="text" readonly value="${esc(url)}" aria-label="Your personal link">
    <button type="button" class="btn btn-ghost btn-small" data-copy="${esc(url)}">Copy link</button>
    <a class="btn btn-primary btn-small" href="${esc(url)}">Open my page</a></div>`
}

// A call-to-action that opens the name card studio with these details filled in.
function cardCta(data, text = "Make your name card") {
  return `<div class="card-cta"><div><b>${esc(text)} ✨</b><span>A shareable card for orientation, socials, or your door.</span></div>
    <button type="button" class="btn btn-primary btn-small" data-card='${esc(JSON.stringify(data))}'>Open card studio <span class="arrow">→</span></button></div>`
}

document.addEventListener("click", async (e) => {
  const copy = e.target.closest("[data-copy]")
  if (copy) {
    try { await navigator.clipboard.writeText(copy.dataset.copy); copy.textContent = "Copied ✓"; toast("Link copied") }
    catch { copy.textContent = "Select and copy" }
  }
  const card = e.target.closest("[data-card]")
  if (card) {
    try { cardPrefill.set(JSON.parse(card.dataset.card)) } catch {}
    location.href = "/cards.html"
  }
})

// ---------- feedback & motion ----------
function toast(text) {
  let box = $(".toasts")
  if (!box) { box = document.createElement("div"); box.className = "toasts"; box.setAttribute("role", "status"); document.body.appendChild(box) }
  const t = document.createElement("div")
  t.className = "toast"
  t.textContent = text
  box.appendChild(t)
  setTimeout(() => t.remove(), 2600)
}

function confetti() {
  if (reducedMotion()) return
  const c = document.createElement("canvas")
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:90"
  document.body.appendChild(c)
  const ctx = c.getContext("2d")
  const dpr = devicePixelRatio || 1
  c.width = innerWidth * dpr; c.height = innerHeight * dpr
  ctx.scale(dpr, dpr)
  const colors = ["#ba0c2f", "#f2b01e", "#ff5a73", "#6d5bff", "#22c1c3", "#ffffff"]
  const bits = Array.from({ length: 180 }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 200, y: innerHeight * .35,
    vx: (Math.random() - .5) * 16, vy: -Math.random() * 14 - 4,
    r: Math.random() * Math.PI, vr: (Math.random() - .5) * .4,
    w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, c: colors[(Math.random() * colors.length) | 0],
  }))
  const start = performance.now()
  ;(function frame(t) {
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const b of bits) {
      b.vy += .35; b.vx *= .99; b.x += b.vx; b.y += b.vy; b.r += b.vr
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h * Math.cos(b.r * 2)); ctx.restore()
    }
    if (t - start < 3500) requestAnimationFrame(frame); else c.remove()
  })(start)
}

function countUp(el, to) {
  const n = Number(to) || 0
  if (reducedMotion() || n === 0) { el.textContent = n; return }
  const start = performance.now(), dur = 1200
  ;(function tick(t) {
    const p = Math.min(1, (t - start) / dur)
    el.textContent = Math.round(n * (1 - Math.pow(1 - p, 3)))
    if (p < 1) requestAnimationFrame(tick)
  })(start)
}

function reveal(root = document) {
  const els = $$(".reveal:not(.in)", root)
  if (!("IntersectionObserver" in window)) { els.forEach((e) => e.classList.add("in")); return }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target) }
  }), { threshold: .12, rootMargin: "0px 0px -40px 0px" })
  els.forEach((e) => io.observe(e))
}

// Show how much of the form is done: one step per fieldset with a required label.
function formProgress(form) {
  const groups = $$("fieldset", form).filter((f) => $(".req", f) || $("[required]", f))
  if (!groups.length) return
  form.insertAdjacentHTML("afterbegin", `<div class="form-progress" aria-hidden="true"><span>Progress</span><div class="meter"><span style="width:0"></span></div><b>0%</b></div>`)
  const bar = $(".form-progress .meter span", form), label = $(".form-progress b", form)
  const done = (f) => $$("input, select, textarea", f).some((el) =>
    el.type === "checkbox" || el.type === "radio" ? el.checked : el.value.trim() !== "")
  const update = () => {
    const pct = Math.round((groups.filter(done).length / groups.length) * 100)
    bar.style.width = pct + "%"
    label.textContent = pct + "%"
  }
  form.addEventListener("input", update)
  form.addEventListener("change", update)
  update()
}

// Wire a registration form: populate, submit, show result.
async function setupForm({ formId, endpoint, label, renderResult, celebrate }) {
  const form = $("#" + formId)
  const msg = $("#form-msg")
  try { await populate(form) } catch (err) {
    msg.innerHTML = `<div class="alert alert-err">Couldn't load the form options. Please refresh. (${esc(err.message)})</div>`
    return
  }
  formProgress(form)
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    msg.innerHTML = ""
    const btn = form.querySelector("button[type=submit]")
    btn.disabled = true
    const old = btn.innerHTML
    btn.textContent = "Submitting…"
    try {
      const values = collect(form)
      const res = await api(endpoint, values)
      const url = statusLink(res.id, res.token)
      store.add({ id: res.id, url, label, name: res.view.name })
      form.hidden = true
      const out = $("#result")
      out.hidden = false
      out.innerHTML = renderResult(res.view, url, values)
      out.scrollIntoView({ behavior: "smooth", block: "start" })
      if (!celebrate || celebrate(res.view)) confetti()
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-err">${esc(err.message)}</div>`
      msg.scrollIntoView({ behavior: "smooth", block: "center" })
    } finally {
      btn.disabled = false
      btn.innerHTML = old
    }
  })
}

const initials = (name) => String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"
const avatar = (name, alt) => `<span class="avatar${alt ? " v2" : ""}" aria-hidden="true">${esc(initials(name))}</span>`

const saveNote = `<p class="alert alert-warn"><b>Save this link.</b> It's your private page for seeing your match and logging meetings. Anyone with the link can see your page, so don't share it. We've also remembered it in this browser.</p>`

document.addEventListener("DOMContentLoaded", () => { renderFooter(); reveal() })
