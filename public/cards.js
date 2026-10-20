// ScholarLink Name Card Studio: draws mentor, mentee, and match cards on a canvas.
// Everything happens in the browser; photos are never uploaded.

const FORMATS = {
  badge: { size: [1050, 675], print: ["3.5in", "2.25in"], label: "Badge" },
  square: { size: [1080, 1080], print: ["3.5in", "3.5in"], label: "Square" },
  story: { size: [1080, 1920], print: ["2.8in", "4.98in"], label: "Story" },
}
// Program branding, used on every card.
const BRAND = { initiative: "Bulldog Bridge", org: "UGA GSA" }
const SERIF = `"Fraunces", Georgia, serif`
const SANS = `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif`
const ROLE_TEXT = { mentor: "MENTOR", mentee: "MENTEE", pair: "MATCHED" }
const DEFAULT_QUOTE = {
  mentor: "Ask me about research, grad school, and finding your path.",
  mentee: "Curious about research and what comes after graduation.",
  pair: "Two conversations, eight weeks, one great connection.",
}

// ---------- drawing helpers ----------
function setFont(ctx, weight, size, family, italic) {
  ctx.font = `${italic ? "italic " : ""}${weight} ${Math.round(size)}px ${family}`
}
function spacing(ctx, px) { if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px" }
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath()
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return }
  r = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}
function truncate(ctx, t, maxW) {
  if (ctx.measureText(t).width <= maxW) return t
  while (t && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1)
  return t.trimEnd() + "…"
}
function fitSize(ctx, text, maxW, start, min, weight, family, italic) {
  let s = start
  setFont(ctx, weight, s, family, italic)
  while (s > min && ctx.measureText(text).width > maxW) { s -= 2; setFont(ctx, weight, s, family, italic) }
  return s
}
function wrapLines(ctx, text, maxW, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean)
  const lines = []
  let line = ""
  for (const w of words) {
    const t = line ? line + " " + w : w
    if (ctx.measureText(t).width <= maxW || !line) line = t
    else { lines.push(line); line = w }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    lines[maxLines - 1] = truncate(ctx, lines[maxLines - 1] + "…", maxW)
  }
  return lines.map((l) => truncate(ctx, l, maxW))
}
function radial(ctx, x, y, r, color) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
}
// Small deterministic random so decorations don't jump on every redraw.
function seeded(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647) }

// ---------- themes ----------
const THEMES = {
  bulldog: {
    label: "Bulldog", swatch: "linear-gradient(135deg,#d0103a,#4a0412)",
    ink: "#ffffff", sub: "rgba(255,255,255,.74)", accent: "#ffd27a",
    pillBg: "#ffffff", pillInk: "#ba0c2f", tagBg: "rgba(255,255,255,.15)", tagInk: "#ffffff",
    av: ["#ffd27a", "#ff7a59"], avInk: "#5a0716", ring: "rgba(255,255,255,.95)", markBg: "#ffffff", markInk: "#ba0c2f", line: "rgba(255,255,255,.22)",
    bg(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, "#d0103a"); g.addColorStop(.55, "#9b0a27"); g.addColorStop(1, "#4a0412")
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      radial(ctx, W * .92, H * .05, Math.max(W, H) * .55, "rgba(255,210,122,.28)")
      const m = Math.min(W, H)
      ctx.save()
      ctx.beginPath(); ctx.arc(W, 0, m * .62, 0, Math.PI * 2); ctx.clip()
      ctx.strokeStyle = "rgba(255,255,255,.07)"; ctx.lineWidth = m * .012
      for (let i = -H; i < W + H; i += m * .045) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - H, H); ctx.stroke() }
      ctx.restore()
      ctx.save(); ctx.globalAlpha = .07; ctx.fillStyle = "#fff"; setFont(ctx, 600, H * .95, SERIF)
      ctx.textAlign = "right"; ctx.textBaseline = "alphabetic"; ctx.fillText("S", W * 1.02, H * 1.13); ctx.restore()
    },
  },
  aurora: {
    label: "Aurora", swatch: "radial-gradient(circle at 20% 20%,#7b2ff7,transparent 60%),radial-gradient(circle at 90% 40%,#f107a3,transparent 55%),radial-gradient(circle at 40% 110%,#ff9f1c,transparent 60%),#0c0a1d",
    ink: "#ffffff", sub: "rgba(255,255,255,.7)", accent: "#ffb3e6",
    pillBg: "#ffffff", pillInk: "#5b21b6", tagBg: "rgba(255,255,255,.13)", tagInk: "#ffffff", tagStroke: "rgba(255,255,255,.22)",
    av: ["#7b2ff7", "#f107a3"], avInk: "#ffffff", ring: "rgba(255,255,255,.9)", markBg: "#ffffff", markInk: "#7b2ff7", line: "rgba(255,255,255,.18)",
    bg(ctx, W, H) {
      ctx.fillStyle = "#0c0a1d"; ctx.fillRect(0, 0, W, H)
      const M = Math.max(W, H)
      radial(ctx, W * .1, H * .08, M * .7, "rgba(123,47,247,.75)")
      radial(ctx, W * .98, H * .35, M * .55, "rgba(241,7,163,.55)")
      radial(ctx, W * .4, H * 1.08, M * .65, "rgba(255,159,28,.55)")
      const rnd = seeded(7)
      ctx.fillStyle = "rgba(255,255,255,.7)"
      for (let i = 0; i < 70; i++) { ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, rnd() * Math.min(W, H) * .0035 + .6, 0, Math.PI * 2); ctx.fill() }
    },
  },
  paper: {
    label: "Paper", swatch: "linear-gradient(90deg,#ba0c2f 0 10%,#f6f1e7 10%)",
    ink: "#1d1a16", sub: "#6b6357", accent: "#ba0c2f",
    pillBg: "#1d1a16", pillInk: "#f6f1e7", tagBg: "#ece3d0", tagInk: "#5b4a2e",
    av: ["#ba0c2f", "#f2b01e"], avInk: "#ffffff", ring: "#ffffff", markBg: "#ba0c2f", markInk: "#ffffff", line: "rgba(0,0,0,.12)",
    bg(ctx, W, H) {
      ctx.fillStyle = "#f6f1e7"; ctx.fillRect(0, 0, W, H)
      const s = Math.min(W, H) * .035
      ctx.fillStyle = "rgba(60,40,20,.08)"
      for (let x = s; x < W; x += s) for (let y = s; y < H; y += s) { ctx.beginPath(); ctx.arc(x, y, s * .06, 0, Math.PI * 2); ctx.fill() }
      ctx.fillStyle = "#ba0c2f"; ctx.fillRect(0, 0, Math.min(W, H) * .022, H)
      ctx.fillStyle = "#f2b01e"; ctx.fillRect(Math.min(W, H) * .022, 0, Math.min(W, H) * .008, H)
    },
  },
  midnight: {
    label: "Midnight", swatch: "radial-gradient(circle at 85% 15%,rgba(94,234,212,.6),transparent 50%),#0a0e18",
    ink: "#e8f1ff", sub: "rgba(232,241,255,.62)", accent: "#5eead4",
    pillBg: "#5eead4", pillInk: "#04201c", tagBg: "rgba(94,234,212,.1)", tagInk: "#99f6e4", tagStroke: "rgba(94,234,212,.4)",
    av: ["#0f766e", "#5eead4"], avInk: "#04201c", ring: "#5eead4", markBg: "#5eead4", markInk: "#0a0e18", line: "rgba(255,255,255,.1)",
    bg(ctx, W, H) {
      ctx.fillStyle = "#0a0e18"; ctx.fillRect(0, 0, W, H)
      const s = Math.min(W, H) * .06
      ctx.strokeStyle = "rgba(255,255,255,.045)"; ctx.lineWidth = 1.5
      for (let x = 0; x < W; x += s) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += s) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
      const M = Math.max(W, H)
      radial(ctx, W * .88, H * .12, M * .5, "rgba(94,234,212,.32)")
      radial(ctx, W * .05, H * .98, M * .5, "rgba(186,12,47,.35)")
    },
  },
  citrus: {
    label: "Citrus", swatch: "linear-gradient(135deg,#fff4d1,#ffc58f)",
    ink: "#2b1a0b", sub: "#7a5a3a", accent: "#d9480f",
    pillBg: "#d9480f", pillInk: "#ffffff", tagBg: "rgba(217,72,15,.12)", tagInk: "#9a3412",
    av: ["#f59f00", "#d9480f"], avInk: "#ffffff", ring: "#ffffff", markBg: "#2b1a0b", markInk: "#ffd8a8", line: "rgba(43,26,11,.15)",
    bg(ctx, W, H) {
      const g = ctx.createLinearGradient(0, 0, W, H)
      g.addColorStop(0, "#fff4d1"); g.addColorStop(1, "#ffc58f")
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const m = Math.min(W, H)
      ctx.fillStyle = "rgba(255,140,0,.16)"; ctx.beginPath(); ctx.arc(W * .95, H * .04, m * .42, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = "rgba(217,72,15,.1)"; ctx.beginPath(); ctx.arc(W * .02, H * .98, m * .36, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = "rgba(217,72,15,.18)"; ctx.lineWidth = m * .008
      ctx.beginPath(); ctx.arc(W * .95, H * .04, m * .52, 0, Math.PI * 2); ctx.stroke()
    },
  },
  ivy: {
    label: "Ivy", swatch: "linear-gradient(135deg,#0f3d2e,#1f6f50)",
    ink: "#f3efe2", sub: "rgba(243,239,226,.7)", accent: "#e9c46a",
    pillBg: "#e9c46a", pillInk: "#0f3d2e", tagBg: "rgba(243,239,226,.12)", tagInk: "#f3efe2",
    av: ["#e9c46a", "#b5838d"], avInk: "#0f3d2e", ring: "#e9c46a", markBg: "#e9c46a", markInk: "#0f3d2e", line: "rgba(243,239,226,.18)",
    bg(ctx, W, H) {
      const g = ctx.createLinearGradient(0, H, W, 0)
      g.addColorStop(0, "#0b2e22"); g.addColorStop(1, "#1f6f50")
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
      const m = Math.min(W, H)
      ctx.strokeStyle = "rgba(233,196,106,.16)"; ctx.lineWidth = m * .006
      for (let i = 1; i <= 5; i++) { ctx.beginPath(); ctx.arc(W, H, m * .16 * i, Math.PI, Math.PI * 1.5); ctx.stroke() }
      radial(ctx, W * .1, H * .1, Math.max(W, H) * .45, "rgba(233,196,106,.16)")
    },
  },
}

// ---------- card parts ----------
const initialsOf = (name) => String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"

function drawAvatar(ctx, cx, cy, r, name, photo, th) {
  ctx.save()
  ctx.shadowColor = "rgba(0,0,0,.28)"; ctx.shadowBlur = r * .35; ctx.shadowOffsetY = r * .08
  ctx.beginPath(); ctx.arc(cx, cy, r * 1.06, 0, Math.PI * 2); ctx.fillStyle = th.ring; ctx.fill()
  ctx.restore()
  ctx.save()
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip()
  if (photo) {
    const s = Math.max((2 * r) / photo.width, (2 * r) / photo.height)
    ctx.drawImage(photo, cx - (photo.width * s) / 2, cy - (photo.height * s) / 2, photo.width * s, photo.height * s)
  } else {
    const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r)
    g.addColorStop(0, th.av[0]); g.addColorStop(1, th.av[1])
    ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r)
    ctx.fillStyle = th.avInk; setFont(ctx, 600, r * .78, SERIF)
    ctx.textAlign = "center"; ctx.textBaseline = "middle"
    ctx.fillText(initialsOf(name), cx, cy + r * .05)
  }
  ctx.restore()
}

function drawBrand(ctx, x, y, s, th) {
  ctx.fillStyle = th.markBg; rr(ctx, x, y, s, s, s * .28); ctx.fill()
  ctx.fillStyle = th.markInk; setFont(ctx, 600, s * .62, SERIF)
  ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("S", x + s / 2, y + s * .53)
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
  ctx.fillStyle = th.ink; setFont(ctx, 700, s * .44, SANS); ctx.fillText("ScholarLink", x + s * 1.28, y + s * .5)
  ctx.fillStyle = th.sub; setFont(ctx, 600, s * .22, SANS); spacing(ctx, s * .04)
  ctx.fillText(`${BRAND.initiative} · ${BRAND.org}`.toUpperCase(), x + s * 1.28, y + s * .88); spacing(ctx, 0)
}

function drawPill(ctx, text, rightX, midY, size, th) {
  setFont(ctx, 800, size, SANS); spacing(ctx, size * .16)
  const w = ctx.measureText(text).width + size * 2.2, h = size * 2.3
  ctx.fillStyle = th.pillBg; rr(ctx, rightX - w, midY - h / 2, w, h, h / 2); ctx.fill()
  ctx.fillStyle = th.pillInk; ctx.textAlign = "center"; ctx.textBaseline = "middle"
  ctx.fillText(text, rightX - w / 2 + size * .08, midY + size * .06)
  spacing(ctx, 0); ctx.textAlign = "left"
}

function tagLayout(ctx, tags, maxW, size, maxRows) {
  setFont(ctx, 600, size, SANS)
  const padX = size * .95, h = size * 2.15, gap = size * .6
  const rows = [[]]
  let rowW = 0
  for (const raw of tags) {
    const t = truncate(ctx, raw, maxW - padX * 2)
    const w = ctx.measureText(t).width + padX * 2
    if (rowW && rowW + gap + w > maxW) { if (rows.length === maxRows) break; rows.push([]); rowW = 0 }
    rows[rows.length - 1].push({ t, w })
    rowW += (rowW ? gap : 0) + w
  }
  const n = rows[0].length ? rows.length : 0
  return { rows: n ? rows : [], h, gap, padX, size, height: n ? n * h + (n - 1) * gap : 0 }
}
function drawTags(ctx, L, x, y, maxW, center, th) {
  L.rows.forEach((row, i) => {
    const rowW = row.reduce((a, b) => a + b.w, 0) + L.gap * (row.length - 1)
    let cx = center ? x + (maxW - rowW) / 2 : x
    const cy = y + i * (L.h + L.gap)
    for (const tag of row) {
      ctx.fillStyle = th.tagBg; rr(ctx, cx, cy, tag.w, L.h, L.h / 2); ctx.fill()
      if (th.tagStroke) { ctx.strokeStyle = th.tagStroke; ctx.lineWidth = Math.max(1.5, L.size * .08); ctx.stroke() }
      ctx.fillStyle = th.tagInk; setFont(ctx, 600, L.size, SANS); ctx.textBaseline = "middle"; ctx.textAlign = "left"
      ctx.fillText(tag.t, cx + L.padX, cy + L.h / 2 + L.size * .04)
      cx += tag.w + L.gap
    }
  })
}

// Lay out blocks top to bottom, vertically centered between top and bottom.
function stack(blocks, top, bottom) {
  const total = blocks.reduce((a, b) => a + b.h + (b.gap || 0), 0)
  let y = top + Math.max(0, (bottom - top - total) / 2)
  for (const b of blocks) { y += b.gap || 0; b.draw(y); y += b.h }
}

// ---------- main renderer ----------
function drawCard(canvas, st, photos) {
  const fmt = FORMATS[st.format]
  const [W, H] = fmt.size
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext("2d")
  const th = THEMES[st.theme] || THEMES.bulldog
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"
  th.bg(ctx, W, H)

  const portrait = st.format !== "badge"
  const u = Math.min(W, H) / 100
  const pad = portrait ? 8 * u : 8.5 * u
  const mark = portrait ? 7 * u : 8.5 * u
  drawBrand(ctx, pad, pad, mark, th)
  drawPill(ctx, ROLE_TEXT[st.role], W - pad, pad + mark / 2, portrait ? 2.2 * u : 2.8 * u, th)

  // Optional ScholarTap QR code in the bottom-right corner.
  const footSize = portrait ? 2.2 * u : 2.6 * u
  const footY = H - pad + footSize * .3
  const lineY = footY - footSize * 2.1
  let qr = null
  if (st.qr && st.role !== "pair" && window.qrcode) {
    const q = portrait ? 15 * u : 19 * u
    qr = { q, x: W - pad - q, y: portrait ? footY + footSize * .3 - q : lineY - 2 * u - q }
    drawQR(ctx, tapUrl(st), qr.x, qr.y, q)
  }

  // footer
  const coverRight = qr && portrait
  ctx.strokeStyle = th.line; ctx.lineWidth = Math.max(2, u * .25)
  ctx.beginPath(); ctx.moveTo(pad, lineY); ctx.lineTo(coverRight ? qr.x - 3 * u : W - pad, lineY); ctx.stroke()
  setFont(ctx, 600, footSize, SANS); ctx.fillStyle = th.sub; ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"; ctx.fillText(truncate(ctx, st.cohort || "", W * .4 - pad), pad, footY)
  if (!coverRight) {
    ctx.textAlign = "right"
    ctx.fillText(truncate(ctx, `A ${BRAND.initiative} initiative from ${BRAND.org}`, W * .6 - pad), W - pad, footY)
  }
  ctx.textAlign = "left"

  const top = pad + mark + (portrait ? 4 : 2.5) * u
  let bottom = lineY - (portrait ? 4 : 2.5) * u
  if (coverRight) bottom = Math.min(bottom, qr.y - 2.5 * u)
  const qrSpace = qr && !portrait ? qr.q + 4 * u : 0
  const tags = String(st.interests || "").split(/[,;]/).map((s) => s.trim()).filter(Boolean).slice(0, 5)
  const sub = [st.pronouns, st.line1].map((s) => (s || "").trim()).filter(Boolean).join("  ·  ")
  const quote = (st.quote || "").trim()
  const total = (blocks) => blocks.reduce((a, b) => a + b.h + (b.gap || 0), 0)

  if (!portrait) {
    // ----- landscape badge -----
    const midY = (top + bottom) / 2
    let textX, avatars
    if (st.role === "pair") {
      const r = Math.min((bottom - top) * .3, 12.5 * u)
      avatars = () => {
        drawAvatar(ctx, pad + r * 1.06, midY - r * .1, r, st.mentorName, photos.a, th)
        drawAvatar(ctx, pad + r * 2.75, midY + r * .1, r, st.menteeName, photos.b, th)
      }
      textX = pad + r * 3.81 + 5 * u
    } else {
      const r = Math.min((bottom - top) * .42, 15.5 * u)
      avatars = () => drawAvatar(ctx, pad + r * 1.06, midY, r, st.name, photos.a, th)
      textX = pad + r * 2.12 + 5.5 * u
    }
    const maxW = W - pad - textX - qrSpace
    // Shrink text a little at a time until everything fits.
    let blocks
    for (let k = 1; k >= .6; k -= .05) {
      const v = u * k
      blocks = []
      if (st.role === "pair") {
        for (const [label, name] of [["MENTOR", st.mentorName], ["MENTEE", st.menteeName]]) {
          blocks.push(labelBlock(ctx, label, 2.1 * v, th, textX, blocks.length ? 2.6 * v : 0))
          blocks.push(nameBlock(ctx, name || "Name", maxW, 7.6 * v, 4.6 * v, th, textX, false, .5 * v))
        }
      } else {
        blocks.push(nameBlock(ctx, st.name || "Your Name", maxW, 11.5 * v, 5.5 * v, th, textX, false, 0))
        if (sub) blocks.push(lineBlock(ctx, sub, maxW, 3.3 * v, 500, th.sub, textX, false, 1.4 * v))
      }
      if (st.department) blocks.push(lineBlock(ctx, st.department, maxW, 3.3 * v, 700, th.accent, textX, false, 1 * v))
      if (st.role !== "pair" && tags.length) blocks.push(tagsBlock(ctx, tags, maxW, 2.45 * v, 2, th, textX, false, 3 * v))
      if (quote) blocks.push(quoteBlock(ctx, quote, maxW, 3 * v, 2, th, textX, false, 3 * v))
      if (total(blocks) <= bottom - top) break
    }
    avatars()
    stack(blocks, top, bottom)
  } else {
    // ----- square & story -----
    const story = st.format === "story"
    const maxW = W - pad * 2
    let blocks
    for (let k = 1; k >= .55; k -= .05) {
      const v = u * k
      blocks = []
      if (st.role === "pair") {
        const r = story ? 17 * v : 12 * v
        blocks.push({ h: r * 2.12, draw: (y) => {
          drawAvatar(ctx, W / 2 - r * .82, y + r * 1.06, r, st.mentorName, photos.a, th)
          drawAvatar(ctx, W / 2 + r * .82, y + r * 1.06, r, st.menteeName, photos.b, th)
        } })
        blocks.push(labelBlock(ctx, "MENTOR", 2 * v, th, W / 2, story ? 6 * v : 4 * v, true))
        blocks.push(nameBlock(ctx, st.mentorName || "Mentor Name", maxW, 8.5 * v, 4.5 * v, th, W / 2, true, .6 * v))
        blocks.push(lineBlock(ctx, "&", maxW, 5 * v, 600, th.accent, W / 2, true, 1 * v, SERIF))
        blocks.push(labelBlock(ctx, "MENTEE", 2 * v, th, W / 2, 1 * v, true))
        blocks.push(nameBlock(ctx, st.menteeName || "Mentee Name", maxW, 8.5 * v, 4.5 * v, th, W / 2, true, .6 * v))
      } else {
        const r = story ? 20 * v : 14.5 * v
        blocks.push({ h: r * 2.12, draw: (y) => drawAvatar(ctx, W / 2, y + r * 1.06, r, st.name, photos.a, th) })
        blocks.push(nameBlock(ctx, st.name || "Your Name", maxW, story ? 11 * v : 9.5 * v, 5 * v, th, W / 2, true, story ? 6 * v : 4 * v))
        if (sub) blocks.push(lineBlock(ctx, sub, maxW, 3.1 * v, 500, th.sub, W / 2, true, 1.6 * v))
      }
      if (st.department) blocks.push(lineBlock(ctx, st.department, maxW, 3.1 * v, 700, th.accent, W / 2, true, 1.2 * v))
      if (st.role !== "pair" && tags.length) blocks.push(tagsBlock(ctx, tags, maxW, 2.6 * v, story ? 3 : 2, th, pad, true, story ? 6 * v : 4 * v))
      if (quote) blocks.push(quoteBlock(ctx, quote, maxW * .9, story ? 3.8 * v : 3.2 * v, story ? 4 : 3, th, W / 2, true, story ? 6 * v : 4 * v))
      if (total(blocks) <= bottom - top) break
    }
    stack(blocks, top, bottom)
  }
}

// Block builders: each returns { h, gap, draw(y) }.
function nameBlock(ctx, text, maxW, start, min, th, x, center, gap) {
  const size = fitSize(ctx, text, maxW, start, min, 600, SERIF)
  const t = truncate(ctx, text, maxW)
  return { h: size * 1.08, gap, draw: (y) => {
    setFont(ctx, 600, size, SERIF); ctx.fillStyle = th.ink; ctx.textBaseline = "alphabetic"
    ctx.textAlign = center ? "center" : "left"; spacing(ctx, -size * .015)
    ctx.fillText(t, x, y + size * .86); spacing(ctx, 0); ctx.textAlign = "left"
  } }
}
function lineBlock(ctx, text, maxW, size, weight, color, x, center, gap, family = SANS, italic = false) {
  setFont(ctx, weight, size, family, italic)
  const t = truncate(ctx, text, maxW)
  return { h: size * 1.3, gap, draw: (y) => {
    setFont(ctx, weight, size, family, italic); ctx.fillStyle = color; ctx.textBaseline = "alphabetic"
    ctx.textAlign = center ? "center" : "left"; ctx.fillText(t, x, y + size * 1.02); ctx.textAlign = "left"
  } }
}
function labelBlock(ctx, text, size, th, x, gap, center) {
  return { h: size * 1.3, gap, draw: (y) => {
    setFont(ctx, 700, size, SANS); spacing(ctx, size * .2); ctx.fillStyle = th.accent
    ctx.textAlign = center ? "center" : "left"; ctx.textBaseline = "alphabetic"
    ctx.fillText(text, x, y + size); spacing(ctx, 0); ctx.textAlign = "left"
  } }
}
function tagsBlock(ctx, tags, maxW, size, maxRows, th, x, center, gap) {
  const L = tagLayout(ctx, tags, maxW, size, maxRows)
  return { h: L.height, gap, draw: (y) => drawTags(ctx, L, x, y, maxW, center, th) }
}
function quoteBlock(ctx, text, maxW, size, maxLines, th, x, center, gap) {
  setFont(ctx, 500, size, SERIF, true)
  const lines = wrapLines(ctx, `“${text.replace(/^["“]|["”]$/g, "")}”`, maxW, maxLines)
  const lh = size * 1.32
  return { h: lines.length * lh, gap, draw: (y) => {
    setFont(ctx, 500, size, SERIF, true); ctx.fillStyle = th.ink; ctx.globalAlpha = .9
    ctx.textAlign = center ? "center" : "left"; ctx.textBaseline = "alphabetic"
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh + size))
    ctx.globalAlpha = 1; ctx.textAlign = "left"
  } }
}

// ---------- ScholarTap digital card ----------
// The card's details travel inside the link (after #), so they are never sent to or stored on the server.
const TAP_KEYS = ["role", "name", "pronouns", "line1", "department", "interests", "quote", "theme", "email", "linkedin", "website"]
function tapEncode(st) {
  const d = {}
  for (const k of TAP_KEYS) if (st[k]) d[k] = String(st[k]).slice(0, 200)
  const bytes = new TextEncoder().encode(JSON.stringify(d))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}
function tapDecode(str) {
  try {
    const b = atob(str.replace(/-/g, "+").replace(/_/g, "/"))
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(b, (c) => c.charCodeAt(0))))
  } catch { return null }
}
const tapUrl = (st) => `${location.origin}/tap.html#${tapEncode(st)}`

let qrLoading
function loadQR() {
  return (qrLoading ||= new Promise((res, rej) => {
    if (window.qrcode) return res()
    const sc = document.createElement("script")
    sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"
    sc.onload = res; sc.onerror = () => { qrLoading = null; rej(new Error("QR library failed to load")) }
    document.head.appendChild(sc)
  }))
}
function qrMatrix(text) {
  const q = qrcode(0, "M"); q.addData(text); q.make()
  return q
}
function drawQR(ctx, text, x, y, size, light = "#ffffff", dark = "#111111") {
  const q = qrMatrix(text), n = q.getModuleCount()
  const pad = size * .07, cell = (size - pad * 2) / n
  ctx.fillStyle = light; rr(ctx, x, y, size, size, size * .08); ctx.fill()
  ctx.fillStyle = dark
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (q.isDark(r, c)) ctx.fillRect(x + pad + c * cell, y + pad + r * cell, Math.ceil(cell), Math.ceil(cell))
}

// ---------- studio UI ----------
function cohortDefault() {
  const d = new Date()
  return `${d.getMonth() >= 6 ? "Fall" : "Spring"} ${d.getFullYear()} cohort`
}

const studio = {
  state: {
    role: "mentor", name: "", pronouns: "", line1: "", department: "", interests: "", quote: DEFAULT_QUOTE.mentor,
    mentorName: "", menteeName: "", cohort: cohortDefault(), theme: "bulldog", format: "badge",
    email: "", linkedin: "", website: "", qr: false,
  },
  photos: { a: null, b: null },
  canvas: null,
}
const DRAFT_KEY = "scholarlink-card-draft"
const FIELDS = ["name", "pronouns", "line1", "department", "interests", "quote", "mentorName", "menteeName", "cohort", "email", "linkedin", "website"]

function saveDraft() { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(studio.state)) } catch {} }
function loadDraft() { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null") } catch { return null } }

let raf = 0
function redraw() {
  cancelAnimationFrame(raf)
  raf = requestAnimationFrame(() => {
    drawCard(studio.canvas, studio.state, studio.photos)
    const s = studio.state
    studio.canvas.setAttribute("aria-label", `${ROLE_TEXT[s.role]} name card preview for ${s.role === "pair" ? `${s.mentorName} and ${s.menteeName}` : s.name || "you"}`)
  })
}

function syncForm() {
  const s = studio.state
  for (const k of FIELDS) { const el = document.getElementById("f-" + k); if (el) el.value = s[k] ?? "" }
  for (const r of document.querySelectorAll("input[name=role], input[name=theme], input[name=format]")) r.checked = s[r.name] === r.value
  updateRoleUI()
}

function updateRoleUI() {
  const pair = studio.state.role === "pair"
  document.querySelectorAll(".pair-only").forEach((e) => (e.hidden = !pair))
  document.querySelectorAll(".solo-only").forEach((e) => (e.hidden = pair))
  const line = document.getElementById("l-line1"), inp = document.getElementById("f-line1")
  if (studio.state.role === "mentor") { line.textContent = "Program"; inp.placeholder = "e.g., PhD student" }
  else { line.textContent = "Year & major"; inp.placeholder = "e.g., Junior · Biology" }
  document.getElementById("l-dz-a").textContent = pair ? "Mentor photo" : "Photo"
  document.getElementById("f-qr").checked = !!studio.state.qr
}

async function updateTap() {
  const box = document.getElementById("tap-out")
  if (studio.state.role === "pair") { box.innerHTML = `<p class="hint" style="margin:0">ScholarTap cards are for one person. Switch to Mentor or Mentee.</p>`; return }
  const url = tapUrl(studio.state)
  try {
    await loadQR()
    const q = qrMatrix(url)
    box.innerHTML = `<div class="tap-qr">${q.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
      <div class="tap-links"><input type="text" readonly value="${esc(url)}" aria-label="Your ScholarTap link">
      <div class="tools" style="margin:0"><button type="button" class="btn btn-ghost btn-small" data-copy="${esc(url)}">Copy link</button>
      <a class="btn btn-primary btn-small" href="${esc(url)}" target="_blank" rel="noopener">Preview ↗</a>
      <button type="button" class="btn btn-ghost btn-small" id="btn-qr-png">QR as PNG</button></div></div>`
    document.getElementById("btn-qr-png").onclick = () => {
      const c = document.createElement("canvas"); c.width = c.height = 1000
      drawQR(c.getContext("2d"), url, 0, 0, 1000)
      c.toBlob((b) => { const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "scholartap-qr.png"; a.click() })
    }
  } catch {
    box.innerHTML = `<input type="text" readonly value="${esc(url)}"><p class="hint">Couldn't load the QR code maker. The link still works.</p>`
  }
}

function loadPhoto(file, slot) {
  if (!file || !file.type.startsWith("image/")) { toast("Please choose an image file"); return }
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    studio.photos[slot] = img
    const dz = document.querySelector(`[data-slot=${slot}] .thumb`)
    dz.style.backgroundImage = `url(${url})`; dz.textContent = ""
    document.querySelector(`[data-clear=${slot}]`).hidden = false
    redraw()
  }
  img.onerror = () => toast("Couldn't read that image")
  img.src = url
}

function canvasBlob() { return new Promise((res) => studio.canvas.toBlob(res, "image/png")) }
function fileName() {
  const s = studio.state
  const who = s.role === "pair" ? `${s.mentorName}-${s.menteeName}` : s.name
  return `scholarlink-${(who || "card").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${s.format}.png`
}

async function download() {
  const blob = await canvasBlob()
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob); a.download = fileName()
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  toast("Card downloaded ✓")
}
async function copyImage() {
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": canvasBlob() })])
    toast("Image copied ✓")
  } catch { toast("Copying images isn't supported here. Use Download instead.") }
}
async function share() {
  const file = new File([await canvasBlob()], fileName(), { type: "image/png" })
  try { await navigator.share({ files: [file], title: "My ScholarLink card" }) } catch (e) { if (e.name !== "AbortError") toast("Sharing didn't work. Use Download instead.") }
}
function printSheet() {
  const n = Number(document.getElementById("copies").value) || 1
  const [w, h] = FORMATS[studio.state.format].print
  const url = studio.canvas.toDataURL("image/png")
  let sheet = document.getElementById("print-sheet")
  if (!sheet) { sheet = document.createElement("div"); sheet.id = "print-sheet"; document.body.appendChild(sheet) }
  sheet.innerHTML = Array.from({ length: n }, () => `<img src="${url}" alt="" style="width:${w};height:${h}">`).join("")
  document.body.classList.add("print-cards")
  const done = () => { document.body.classList.remove("print-cards"); removeEventListener("afterprint", done) }
  addEventListener("afterprint", done)
  setTimeout(() => { print(); setTimeout(done, 1000) }, 50)
}

// 3D tilt and glare on the preview.
function setupTilt() {
  const box = document.querySelector(".stage-box"), tilt = document.querySelector(".tilt"), glare = document.querySelector(".glare")
  if (matchMedia("(prefers-reduced-motion: reduce)").matches || matchMedia("(hover: none)").matches) return
  box.addEventListener("pointermove", (e) => {
    const r = tilt.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
    tilt.style.transform = `rotateY(${(px - .5) * 14}deg) rotateX(${(.5 - py) * 14}deg) scale(1.02)`
    glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,.55), transparent 55%)`
  })
  box.addEventListener("pointerleave", () => (tilt.style.transform = ""))
}

async function initStudio() {
  studio.canvas = document.getElementById("card-canvas")

  // Swatches from the theme list.
  document.getElementById("swatches").innerHTML = Object.entries(THEMES).map(([k, t]) =>
    `<label class="swatch"><input type="radio" name="theme" value="${k}"><span style="background:${t.swatch}"></span><small>${t.label}</small></label>`).join("")

  // Start from a hand-off (sign-up or private page), else the saved draft.
  const pre = cardPrefill.take()
  if (pre) {
    const s = studio.state
    s.role = ["mentor", "mentee", "pair"].includes(pre.role) ? pre.role : "mentor"
    s.name = pre.name || ""; s.line1 = pre.line1 || ""; s.department = pre.department || ""
    s.interests = (pre.interests || []).join(", ")
    s.mentorName = pre.mentorName || ""; s.menteeName = pre.menteeName || ""
    s.quote = DEFAULT_QUOTE[s.role]
    const d = loadDraft()
    if (d && THEMES[d.theme]) s.theme = d.theme
    toast("Filled in from your ScholarLink profile")
  } else {
    const d = loadDraft()
    if (d) Object.assign(studio.state, Object.fromEntries(Object.entries(d).filter(([k]) => k in studio.state)))
    const role = new URLSearchParams(location.search).get("role")
    if (["mentor", "mentee", "pair"].includes(role)) studio.state.role = role
  }
  if (!THEMES[studio.state.theme]) studio.state.theme = "bulldog"
  if (!FORMATS[studio.state.format]) studio.state.format = "badge"
  syncForm()

  const form = document.getElementById("studio-form")
  form.addEventListener("input", (e) => {
    const t = e.target
    if (t.id === "f-qr") {
      studio.state.qr = t.checked
      if (t.checked) loadQR().then(redraw).catch(() => toast("Couldn't load the QR code maker"))
    }
    else if (t.id?.startsWith("f-")) studio.state[t.id.slice(2)] = t.value
    else if (["role", "theme", "format"].includes(t.name)) {
      if (t.name === "role") {
        const s = studio.state
        if (!s.quote || Object.values(DEFAULT_QUOTE).includes(s.quote)) { s.quote = DEFAULT_QUOTE[t.value]; document.getElementById("f-quote").value = s.quote }
      }
      studio.state[t.name] = t.value
      if (t.name === "role") updateRoleUI()
    } else return
    saveDraft(); redraw(); tapSoon()
  })
  form.addEventListener("submit", (e) => e.preventDefault())

  for (const dz of document.querySelectorAll(".dropzone")) {
    const slot = dz.dataset.slot, input = dz.querySelector("input")
    input.addEventListener("change", () => loadPhoto(input.files[0], slot))
    dz.addEventListener("dragover", (e) => { e.preventDefault(); dz.classList.add("over") })
    dz.addEventListener("dragleave", () => dz.classList.remove("over"))
    dz.addEventListener("drop", (e) => { e.preventDefault(); dz.classList.remove("over"); loadPhoto(e.dataTransfer.files[0], slot) })
  }
  for (const b of document.querySelectorAll("[data-clear]")) {
    b.addEventListener("click", () => {
      const slot = b.dataset.clear
      studio.photos[slot] = null
      const th = document.querySelector(`[data-slot=${slot}] .thumb`)
      th.style.backgroundImage = ""; th.textContent = "📷"; b.hidden = true
      document.querySelector(`[data-slot=${slot}] input`).value = ""
      redraw()
    })
  }

  document.getElementById("btn-download").onclick = download
  document.getElementById("btn-copy").onclick = copyImage
  document.getElementById("btn-print").onclick = printSheet
  const shareBtn = document.getElementById("btn-share")
  try {
    if (navigator.canShare && navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] })) { shareBtn.hidden = false; shareBtn.onclick = share }
  } catch {}
  document.getElementById("btn-shuffle").onclick = () => {
    const keys = Object.keys(THEMES).filter((k) => k !== studio.state.theme)
    studio.state.theme = keys[(Math.random() * keys.length) | 0]
    syncForm(); saveDraft(); redraw(); tapSoon()
  }

  getConfig().then((c) => {
    document.getElementById("dept-list").innerHTML = c.departments.map((d) => `<option value="${esc(d)}">`).join("")
  }).catch(() => {})

  let tapTimer
  window.tapSoon = () => { clearTimeout(tapTimer); tapTimer = setTimeout(updateTap, 400) }
  updateTap()
  if (studio.state.qr) loadQR().then(redraw).catch(() => {})

  setupTilt()
  redraw()
  // Redraw once web fonts arrive so the card uses Fraunces and Inter.
  try {
    await Promise.all([`600 80px ${SERIF}`, `italic 500 40px ${SERIF}`, `700 40px ${SANS}`, `600 30px ${SANS}`, `800 30px ${SANS}`, `500 30px ${SANS}`].map((f) => document.fonts.load(f)))
  } catch {}
  redraw()
}
