// Create an admin or Mentor Lead account from the command line.
//   node admin-user.mjs --email you@uga.edu --name "Your Name" [--role admin|lead] [--dept "Genetics"]
// Prompts for the password. With LOCAL_DATA_DIR (default ./local-data when it exists) the account is
// written there; otherwise the JSON line is printed to paste into admins.json in the data repository.
// For a hosted site you can instead set ADMIN_SETUP_CODE and create the first admin at /admin.html.
import { createInterface } from "node:readline/promises"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { hashPassword, validPassword } from "./src/auth.mts"

const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d }
const email = String(arg("email", "")).toLowerCase(), name = arg("name", ""), role = arg("role", "admin") === "lead" ? "lead" : "admin"
const depts = process.argv.flatMap((x, i) => (x === "--dept" ? [process.argv[i + 1]] : []))
if (!email || !name) { console.error('Usage: node admin-user.mjs --email you@uga.edu --name "Your Name" [--role admin|lead] [--dept "Genetics"]'); process.exit(1) }
let pw = process.env.ADMIN_PASSWORD
if (!pw) { const rl = createInterface({ input: process.stdin, output: process.stdout }); pw = await rl.question("Password (10+ characters): "); rl.close() }
validPassword(pw)
const dir = process.env.LOCAL_DATA_DIR || (existsSync("local-data") ? "local-data" : "")
const file = dir && join(dir, "admins.json")
const admins = file && existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : []
if (admins.some((a) => a.email === email)) { console.error("That email already has an account."); process.exit(1) }
const n = admins.reduce((m, a) => Math.max(m, Number(a.id.split("-")[1]) || 0), 0) + 1
const entry = { id: `A-${String(n).padStart(3, "0")}`, name, email, role, departments: role === "lead" ? depts : [], passwordHash: hashPassword(pw), createdAt: new Date().toISOString(), lastLogin: null, active: true }
if (file) { admins.push(entry); writeFileSync(file, JSON.stringify(admins, null, 2) + "\n"); console.log(`Added ${role} ${email} to ${file}`) }
else console.log("Add this object to admins.json in the data repository:\n" + JSON.stringify(entry, null, 2))
