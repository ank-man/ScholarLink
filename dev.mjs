#!/usr/bin/env node
// Runs ScholarLink with no Netlify and no GitHub: static pages from public/ and the API from
// netlify/functions/api.mts, storing data as JSON files in LOCAL_DATA_DIR (default ./local-data,
// created from data-template/ on first run).
//   node dev.mjs            → http://localhost:8888
// Needs Node 23.6+ (runs the .mts files directly). Also works as a tiny production server on any VM.
import { createServer } from "node:http"
import { readFile, mkdir, cp, stat } from "node:fs/promises"
import { extname, join, normalize, resolve } from "node:path"

const root = resolve(import.meta.dirname)
process.env.LOCAL_DATA_DIR ||= join(root, "local-data")
try { await stat(join(process.env.LOCAL_DATA_DIR, "config.json")) } catch {
  await mkdir(process.env.LOCAL_DATA_DIR, { recursive: true })
  await cp(join(root, "data-template"), process.env.LOCAL_DATA_DIR, { recursive: true, filter: (f) => !f.endsWith("README.md") })
  console.log("Created", process.env.LOCAL_DATA_DIR, "from data-template/")
}
const { default: api } = await import("./netlify/functions/api.mts")
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webmanifest": "application/manifest+json", ".mp4": "video/mp4", ".pdf": "application/pdf", ".ico": "image/x-icon" }
const port = Number(process.env.PORT || 8888)

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`)
  if (url.pathname.startsWith("/api/")) {
    const body = req.method === "GET" ? undefined : await new Promise((r) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => r(Buffer.concat(c))) })
    const out = await api(new Request(url, { method: req.method, headers: req.headers, body }))
    res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); return
  }
  let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "")
  if (p.endsWith("/")) p += "index.html"
  try {
    const file = join(root, "public", p)
    const buf = await readFile(file)
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" }); res.end(buf)
  } catch { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found") }
}).listen(port, () => console.log(`ScholarLink on http://localhost:${port}  (data: ${process.env.LOCAL_DATA_DIR})`))
