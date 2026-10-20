// Shared front-end code for ScholarLink pages.
const $ = (sel, root = document) => root.querySelector(sel)
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))

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

document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-copy]")
  if (!b) return
  try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied ✓" } catch { b.textContent = "Select and copy" }
})

// Wire a registration form: populate, submit, show result.
async function setupForm({ formId, endpoint, label, renderResult }) {
  const form = $("#" + formId)
  const msg = $("#form-msg")
  try { await populate(form) } catch (err) {
    msg.innerHTML = `<div class="alert alert-err">Couldn't load the form options. Please refresh. (${esc(err.message)})</div>`
    return
  }
  form.addEventListener("submit", async (e) => {
    e.preventDefault()
    msg.innerHTML = ""
    const btn = form.querySelector("button[type=submit]")
    btn.disabled = true
    const old = btn.textContent
    btn.textContent = "Submitting…"
    try {
      const res = await api(endpoint, collect(form))
      const url = statusLink(res.id, res.token)
      store.add({ id: res.id, url, label, name: res.view.name })
      form.hidden = true
      const out = $("#result")
      out.hidden = false
      out.innerHTML = renderResult(res.view, url)
      out.scrollIntoView({ behavior: "smooth", block: "start" })
    } catch (err) {
      msg.innerHTML = `<div class="alert alert-err">${esc(err.message)}</div>`
      msg.scrollIntoView({ behavior: "smooth", block: "center" })
    } finally {
      btn.disabled = false
      btn.textContent = old
    }
  })
}

const saveNote = `<p class="alert alert-warn"><b>Save this link.</b> It's your private page for seeing your match and logging meetings. Anyone with the link can see your page, so don't share it. We've also remembered it in this browser.</p>`

// Show "My ScholarLink" in the nav if this browser has saved links.
function markNav() {
  const links = store.get()
  const nav = $(".nav")
  if (!nav || !links.length) return
  const a = document.createElement("a")
  a.href = links[0].url
  a.className = "mine"
  a.textContent = "My page"
  nav.appendChild(a)
}
document.addEventListener("DOMContentLoaded", markNav)
