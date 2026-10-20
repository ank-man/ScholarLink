// ScholarLink CV Maker: an academic CV builder that runs entirely in the browser.

const ENTRY = (a, b) => [
  { k: "title", label: a, ph: a === "Degree" ? "B.S. in Genetics" : "Undergraduate Researcher", wide: true },
  { k: "org", label: b, ph: b === "School" ? "University of Georgia" : "Smith Lab, Dept. of Genetics (PI: Dr. Jane Smith)" },
  { k: "location", label: "Location", ph: "Athens, GA" },
  { k: "dates", label: "Dates", ph: "Aug 2024 – Present" },
  { k: "details", label: "Details (one per line)", ph: "What you did, with numbers where you can\nWhat came of it: a poster, a dataset, a skill", area: true, wide: true },
]
const SECTIONS = {
  summary: { title: "Research Interests", single: true, fields: [{ k: "text", label: "Your research interests in one or two sentences", ph: "Plant genomics, gene regulation under drought stress, and computational biology.", area: true, wide: true }] },
  education: { title: "Education", fields: ENTRY("Degree", "School"), add: "Add education" },
  research: { title: "Research Experience", fields: ENTRY("Role", "Lab / organization"), add: "Add research position" },
  publications: { title: "Publications & Presentations", cite: true, fields: [{ k: "text", label: "Citation (use **bold** for your name)", ph: "**Lastname, F.**, & Smith, J. (2026). Title of your poster. CURO Symposium, Athens, GA.", area: true, wide: true }], add: "Add publication or presentation" },
  experience: { title: "Teaching & Leadership", fields: ENTRY("Role", "Organization"), add: "Add position" },
  work: { title: "Work Experience", fields: ENTRY("Role", "Employer"), add: "Add job" },
  awards: { title: "Honors & Awards", fields: [{ k: "title", label: "Award", ph: "CURO Research Assistantship", wide: true }, { k: "org", label: "From", ph: "University of Georgia" }, { k: "dates", label: "Date", ph: "2025" }], add: "Add award" },
  skills: { title: "Skills", fields: [{ k: "label", label: "Category", ph: "Lab" }, { k: "items", label: "Skills", ph: "PCR, gel electrophoresis, cell culture", wide: true }], add: "Add skill group" },
  references: { title: "References", fields: [{ k: "name", label: "Name", ph: "Dr. Jane Smith" }, { k: "title", label: "Title", ph: "Associate Professor of Genetics" }, { k: "org", label: "Institution", ph: "University of Georgia" }, { k: "email", label: "Email", ph: "jsmith@uga.edu" }], add: "Add reference" },
}
const SIDEBAR_KEYS = ["skills", "awards", "references"]
const ACCENTS = ["#ba0c2f", "#1d4ed8", "#0f766e", "#6d28d9", "#334155"]
const KEY = "scholarlink-cv"

const blankCV = () => ({
  template: "classic", accent: ACCENTS[0],
  header: { name: "", headline: "", email: "", phone: "", location: "", links: "" },
  order: ["summary", "education", "research", "publications", "experience", "work", "awards", "skills", "references"],
  hidden: { work: true },
  sections: { summary: [{ text: "" }], education: [{}], research: [{}], publications: [], experience: [], work: [], awards: [], skills: [{}], references: [] },
})

const EXAMPLE = {
  template: "classic", accent: ACCENTS[0],
  header: { name: "Jordan Mitchell", headline: "Undergraduate Researcher · Genetics", email: "jordan.mitchell@uga.edu", phone: "(706) 555-0142", location: "Athens, GA", links: "linkedin.com/in/jordanmitchell" },
  order: ["summary", "education", "research", "publications", "experience", "awards", "skills", "references", "work"],
  hidden: { work: true },
  sections: {
    summary: [{ text: "Plant genomics and gene regulation under drought stress, with a focus on computational approaches to linking genotype and phenotype." }],
    education: [{ title: "B.S. in Genetics, Minor in Statistics", org: "University of Georgia", location: "Athens, GA", dates: "Expected May 2027", details: "GPA: 3.8/4.0 · Honors Program\nThesis: Root architecture variation in drought-tolerant sorghum lines (advisor: Dr. Jane Smith)" }],
    research: [{ title: "Undergraduate Researcher", org: "Smith Lab, Department of Genetics (PI: Dr. Jane Smith)", location: "Athens, GA", dates: "Jan 2025 – Present", details: "Genotyped 200 sorghum lines with PCR and gel electrophoresis\nBuilt an R pipeline that cut image-analysis time for root scans by 60%\nPresented results at the 2026 CURO Symposium" },
      { title: "Summer Research Fellow", org: "Plant Biology REU, Example State University", location: "Remote", dates: "May – Aug 2025", details: "Analyzed RNA-seq data from 24 samples using DESeq2\nWrote a 10-page report and gave a final talk to 40 attendees" }],
    publications: [{ text: "**Mitchell, J.**, & Smith, J. (2026). Root traits associated with drought tolerance in sorghum. Poster presented at the CURO Symposium, Athens, GA." }],
    experience: [{ title: "Peer Learning Assistant, Introductory Biology", org: "Division of Academic Enhancement", location: "Athens, GA", dates: "Aug 2024 – Present", details: "Lead weekly review sessions for 30+ students" }],
    work: [],
    awards: [{ title: "CURO Research Assistantship", org: "University of Georgia", dates: "2025" }, { title: "Dean's List", org: "Franklin College of Arts and Sciences", dates: "2023–2025" }],
    skills: [{ label: "Lab", items: "PCR, gel electrophoresis, DNA extraction, plant phenotyping" }, { label: "Computational", items: "R (tidyverse, DESeq2), Python, Git, Linux command line" }, { label: "Languages", items: "English (native), Spanish (conversational)" }],
    references: [{ name: "Dr. Jane Smith", title: "Associate Professor of Genetics", org: "University of Georgia", email: "jsmith@uga.edu" }],
  },
}

let cv = load() || blankCV()
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || "null")
    if (!d) return null
    const b = blankCV()
    // Keep any sections added in later versions of the maker.
    for (const k of Object.keys(SECTIONS)) { if (!d.order.includes(k)) d.order.push(k); d.sections[k] ||= b.sections[k] }
    return d
  } catch { return null }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(cv)) } catch {} }

// **bold** and *italic* in citations and bullets; everything else is escaped.
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>")
const lines = (s) => String(s || "").split("\n").map((l) => l.replace(/^\s*[-•*]\s+/, "").trim()).filter(Boolean)
const filled = (e) => Object.values(e || {}).some((v) => String(v).trim())

// ---------- preview ----------
function renderSection(key) {
  const def = SECTIONS[key], items = (cv.sections[key] || []).filter(filled)
  if (cv.hidden[key] || !items.length) return ""
  let body = ""
  if (key === "summary") body = `<p>${md(items[0].text)}</p>`
  else if (def.cite) body = `<ol class="cites">${items.map((e) => `<li>${md(e.text)}</li>`).join("")}</ol>`
  else if (key === "skills") body = `<div class="skills">${items.map((e) => `<div>${e.label ? `<b>${esc(e.label)}:</b> ` : ""}${esc(e.items || "")}</div>`).join("")}</div>`
  else if (key === "references") body = `<div class="refs">${items.map((e) => `<div><b>${esc(e.name || "")}</b><br>${[e.title, e.org].filter(Boolean).map(esc).join("<br>")}${e.email ? `<br>${esc(e.email)}` : ""}</div>`).join("")}</div>`
  else if (key === "awards") body = items.map((e) => `<div class="entry line"><span><b>${esc(e.title || "")}</b>${e.org ? `, ${esc(e.org)}` : ""}</span><span class="r">${esc(e.dates || "")}</span></div>`).join("")
  else body = items.map((e) => {
    const b = lines(e.details)
    return `<div class="entry"><div class="line"><span class="t">${esc(e.title || "")}</span><span class="r">${esc(e.dates || "")}</span></div>
      ${e.org || e.location ? `<div class="line"><span class="o">${esc(e.org || "")}</span><span class="r">${esc(e.location || "")}</span></div>` : ""}
      ${b.length ? `<ul>${b.map((l) => `<li>${md(l)}</li>`).join("")}</ul>` : ""}</div>`
  }).join("")
  return `<section><h2>${esc(def.title)}</h2>${body}</section>`
}

function paperHTML() {
  const h = cv.header
  const contact = [h.email, h.phone, h.location, ...String(h.links || "").split(/[,\n]/)].map((s) => (s || "").trim()).filter(Boolean)
  const head = `<header><h1>${esc(h.name) || `<span class="empty">Your Name</span>`}</h1>
    ${h.headline ? `<p class="headline">${esc(h.headline)}</p>` : ""}
    <p class="contact">${contact.map((c) => `<span>${esc(c)}</span>`).join("")}</p></header>`
  if (cv.template === "sidebar") {
    const side = cv.order.filter((k) => SIDEBAR_KEYS.includes(k)).map(renderSection).join("")
    const main = cv.order.filter((k) => !SIDEBAR_KEYS.includes(k)).map(renderSection).join("")
    return `<aside><h1>${esc(h.name) || `<span class="empty">Your Name</span>`}</h1>${h.headline ? `<p class="headline">${esc(h.headline)}</p>` : ""}
      <h2>Contact</h2><p class="contact">${contact.map((c) => `<span>${esc(c)}</span>`).join("")}</p>${side}</aside><main>${main}</main>`
  }
  return head + cv.order.map(renderSection).join("")
}

let raf = 0
function renderPreview() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    const p = $("#paper")
    p.className = "paper " + cv.template
    p.style.setProperty("--accent", cv.accent)
    p.innerHTML = paperHTML()
    fitPaper()
    meter()
  })
}

// Scale the 8.5in page to fit the preview column.
function fitPaper() {
  const box = $("#paper-box"), p = $("#paper")
  const scale = Math.min(1, box.clientWidth / p.offsetWidth)
  p.style.transform = `scale(${scale})`
  box.style.height = p.offsetHeight * scale + "px"
  const pages = Math.max(1, Math.ceil(p.scrollHeight / (11 * 96) - .02))
  $("#page-count").textContent = `${pages} page${pages > 1 ? "s" : ""}`
  // Dashed lines where each printed page ends.
  $$(".page-break", box).forEach((e) => e.remove())
  for (let n = 1; n < pages; n++)
    box.insertAdjacentHTML("beforeend", `<div class="page-break" style="top:${n * 11 * 96 * scale}px"><span>Page ${n + 1}</span></div>`)
}

// A simple completeness score with the next thing to add.
function meter() {
  const s = cv.sections, h = cv.header
  const checks = [
    [!!h.name.trim(), "Add your name"], [!!h.email.trim(), "Add your email"],
    [s.education.some(filled), "Add your education"], [s.research.some(filled) || s.experience.some(filled), "Add research or other experience"],
    [[...s.research, ...s.experience, ...s.work].some((e) => lines(e.details).length >= 2), "Add 2+ bullet points to an experience"],
    [s.skills.some(filled), "Add skills"], [!!(s.summary[0] || {}).text?.trim(), "Add research interests"],
    [s.references.some(filled) || s.awards.some(filled) || s.publications.some(filled), "Add awards, presentations, or references"],
  ]
  const done = checks.filter((c) => c[0]).length
  $("#cv-meter span").style.width = (done / checks.length) * 100 + "%"
  const next = checks.find((c) => !c[0])
  $("#cv-meter-text").textContent = next ? `${done}/${checks.length} · Next: ${next[1]}` : "Looking complete ✓"
}

// ---------- editor ----------
const fieldHTML = (f, val, attrs) => `<label class="cv-field${f.wide ? " wide" : ""}"><span>${esc(f.label)}</span>${f.area
  ? `<textarea ${attrs} rows="${f.k === "details" ? 3 : 2}" placeholder="${esc(f.ph || "")}">${esc(val || "")}</textarea>`
  : `<input type="text" ${attrs} value="${esc(val || "")}" placeholder="${esc(f.ph || "")}">`}</label>`

function renderEditor() {
  $("#cv-sections").innerHTML = cv.order.map((key, si) => {
    const def = SECTIONS[key], items = cv.sections[key] || []
    const entries = items.map((e, i) => `<div class="cv-entry">
      ${def.single ? "" : `<div class="cv-entry-bar"><span>${esc(e.title || e.name || e.label || (e.text || "").replace(/\*/g, "").slice(0, 40) || "New entry")}</span>
        <span><button type="button" class="mini" data-act="up" data-s="${key}" data-i="${i}" aria-label="Move up" ${i ? "" : "disabled"}>↑</button><button type="button" class="mini" data-act="down" data-s="${key}" data-i="${i}" aria-label="Move down" ${i < items.length - 1 ? "" : "disabled"}>↓</button><button type="button" class="mini danger" data-act="del" data-s="${key}" data-i="${i}" aria-label="Remove">✕</button></span></div>`}
      <div class="cv-grid">${def.fields.map((f) => fieldHTML(f, e[f.k], `data-s="${key}" data-i="${i}" data-k="${f.k}"`)).join("")}</div></div>`).join("")
    return `<details class="cv-sec${cv.hidden[key] ? " off" : ""}" ${si < 3 ? "open" : ""}>
      <summary><span class="cv-sec-title">${esc(def.title)}${items.filter(filled).length && !def.single ? ` <em>${items.filter(filled).length}</em>` : ""}</span>
        <span class="cv-sec-tools"><button type="button" class="mini" data-act="secup" data-s="${key}" aria-label="Move section up" ${si ? "" : "disabled"}>↑</button><button type="button" class="mini" data-act="secdown" data-s="${key}" aria-label="Move section down" ${si < cv.order.length - 1 ? "" : "disabled"}>↓</button>
        <label class="mini-toggle"><input type="checkbox" data-act="toggle" data-s="${key}" ${cv.hidden[key] ? "" : "checked"}> Show</label></span></summary>
      <div class="cv-sec-body">${entries}${def.single ? "" : `<button type="button" class="btn btn-ghost btn-small" data-act="add" data-s="${key}">＋ ${esc(def.add)}</button>`}</div></details>`
  }).join("")
  for (const el of $$("[data-h]")) el.value = cv.header[el.dataset.h] || ""
  for (const r of $$("input[name=cv-template]")) r.checked = r.value === cv.template
  for (const r of $$("input[name=cv-accent]")) r.checked = r.value === cv.accent
}

function change(structural) { save(); if (structural) { const open = $$(".cv-sec").map((d) => d.open); renderEditor(); $$(".cv-sec").forEach((d, i) => (d.open = open[i] ?? d.open)) } renderPreview() }

function swap(arr, i, j) { [arr[i], arr[j]] = [arr[j], arr[i]] }

function onClick(e) {
  const b = e.target.closest("button[data-act]")
  if (!b) return
  e.preventDefault()
  const key = b.dataset.s, i = Number(b.dataset.i), list = cv.sections[key], oi = cv.order.indexOf(key)
  const act = b.dataset.act
  if (act === "add") { list.push({}); cv.hidden[key] = false }
  else if (act === "del") list.splice(i, 1)
  else if (act === "up" && i > 0) swap(list, i, i - 1)
  else if (act === "down" && i < list.length - 1) swap(list, i, i + 1)
  else if (act === "secup" && oi > 0) swap(cv.order, oi, oi - 1)
  else if (act === "secdown" && oi < cv.order.length - 1) swap(cv.order, oi, oi + 1)
  change(true)
  if (act === "add") { const secs = $$(".cv-sec"); const d = secs[cv.order.indexOf(key)]; d.open = true; $$(".cv-entry", d).at(-1)?.querySelector("input,textarea")?.focus() }
}

function onInput(e) {
  const t = e.target
  if (t.dataset.act === "toggle") { cv.hidden[t.dataset.s] = !t.checked; t.closest(".cv-sec").classList.toggle("off", !t.checked); return change(false) }
  if (t.name === "cv-template") { cv.template = t.value; return change(false) }
  if (t.name === "cv-accent") { cv.accent = t.value; return change(false) }
  if (t.dataset.h) { cv.header[t.dataset.h] = t.value; return change(false) }
  if (t.dataset.s && t.dataset.k) {
    const list = cv.sections[t.dataset.s]
    list[Number(t.dataset.i)] ||= {}
    list[Number(t.dataset.i)][t.dataset.k] = t.value
    change(false)
  }
}

// ---------- export ----------
const fileBase = () => (cv.header.name.trim() || "CV").replace(/[^\w]+/g, "_") + "_CV"

function printPDF() {
  let out = $("#cv-print")
  if (!out) { out = document.createElement("div"); out.id = "cv-print"; document.body.appendChild(out) }
  out.innerHTML = `<div class="paper ${cv.template}" style="--accent:${cv.accent}">${paperHTML()}</div>`
  document.body.classList.add("print-cv")
  const done = () => { document.body.classList.remove("print-cv"); removeEventListener("afterprint", done) }
  addEventListener("afterprint", done)
  setTimeout(() => { print(); setTimeout(done, 1000) }, 50)
}

async function downloadWord() {
  let css = ""
  try { css = await (await fetch("/cv.css")).text() } catch {}
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(fileBase())}</title>
    <style>@page { size: 8.5in 11in; margin: .6in .7in; } ${css} .paper { width: auto; min-height: 0; padding: 0; } .line .r { float: right; }</style></head>
    <body><div class="paper ${cv.template === "sidebar" ? "modern" : cv.template}" style="--accent:${cv.accent}">${cv.template === "sidebar" ? (() => { const t = cv.template; cv.template = "modern"; const h = paperHTML(); cv.template = t; return h })() : paperHTML()}</div></body></html>`
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob(["﻿", html], { type: "application/msword" }))
  a.download = fileBase() + ".doc"
  a.click()
  toast("Word file downloaded ✓")
}

function plainText() {
  const h = cv.header, out = [h.name, h.headline, [h.email, h.phone, h.location, h.links].filter(Boolean).join(" | "), ""]
  for (const key of cv.order) {
    const items = (cv.sections[key] || []).filter(filled)
    if (cv.hidden[key] || !items.length) continue
    out.push(SECTIONS[key].title.toUpperCase())
    for (const e of items) {
      if (key === "summary") out.push(e.text)
      else if (SECTIONS[key].cite) out.push("- " + e.text.replace(/\*/g, ""))
      else if (key === "skills") out.push(`${e.label ? e.label + ": " : ""}${e.items || ""}`)
      else if (key === "references") out.push([e.name, e.title, e.org, e.email].filter(Boolean).join(", "))
      else {
        out.push([e.title, e.org, e.location, e.dates].filter(Boolean).join(" | "))
        for (const l of lines(e.details)) out.push("  - " + l.replace(/\*/g, ""))
      }
    }
    out.push("")
  }
  return out.filter((l, i, a) => l !== undefined && !(l === "" && a[i - 1] === "")).join("\n").trim()
}

function backup() {
  const a = document.createElement("a")
  a.href = URL.createObjectURL(new Blob([JSON.stringify(cv, null, 2)], { type: "application/json" }))
  a.download = fileBase() + ".scholarlink.json"
  a.click()
}
function restore(file) {
  file.text().then((t) => {
    const d = JSON.parse(t)
    if (!d.sections || !d.header) throw new Error()
    cv = d; localStorage.setItem(KEY, JSON.stringify(cv)); cv = load() || d
    change(true); toast("CV restored ✓")
  }).catch(() => toast("That file isn't a ScholarLink CV backup"))
}

function initCV() {
  $("#cv-accents").innerHTML = ACCENTS.map((c) => `<label class="dot-swatch"><input type="radio" name="cv-accent" value="${c}"><span style="background:${c}"></span></label>`).join("")
  renderEditor()
  renderPreview()
  const form = $("#cv-form")
  form.addEventListener("input", onInput)
  form.addEventListener("change", onInput)
  form.addEventListener("click", onClick)
  form.addEventListener("submit", (e) => e.preventDefault())
  addEventListener("resize", fitPaper)
  $("#cv-pdf").onclick = printPDF
  $("#cv-word").onclick = downloadWord
  $("#cv-text").onclick = async () => { try { await navigator.clipboard.writeText(plainText()); toast("Plain-text CV copied ✓") } catch { toast("Couldn't copy here") } }
  $("#cv-backup").onclick = backup
  $("#cv-restore").onchange = (e) => e.target.files[0] && restore(e.target.files[0])
  $("#cv-example").onclick = () => {
    if (cv.header.name && !confirm("Replace what you've entered with the example CV?")) return
    cv = JSON.parse(JSON.stringify(EXAMPLE)); change(true); toast("Example loaded. Edit anything.")
  }
  $("#cv-clear").onclick = () => {
    if (!confirm("Clear your whole CV? Download a backup first if you might want it.")) return
    cv = blankCV(); change(true)
  }
  document.fonts?.ready.then(fitPaper)
}
