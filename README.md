# ScholarLink

**A Bulldog Bridge initiative from UGA GSA: graduate student mentors for undergraduates at the University of Georgia.**

ScholarLink pairs undergraduates with graduate student mentors in their field of interest, and connects
students applying to grad school with volunteers who can help. Mentors commit to just **two meetings over eight weeks**,
and a departmental **GSA Mentor Lead** oversees matches in each pilot department.

## The web app

| Page | What it does |
|---|---|
| `/` | Overview, live program numbers, departments in the pilot |
| `/mentee.html` | Students sign up and are **matched instantly** to the best-fit mentor with room in their chosen department |
| `/mentor.html` | Grad students sign up; any waiting students are matched to them right away |
| `/help.html` | Students request grad application help; a volunteer mentor is assigned automatically |
| `/guide.html` | Grad school application guide: timeline, documents, statement of purpose, letters, funding, checklist |
| `/status.html` | Each person's private page (secret link): see their match and contact info, track progress, log meetings, rate, close help requests |
| `/cards.html` | Name Card Studio: mentor, mentee, and match cards in 6 themes and 3 sizes (badge, square, story). Download PNG, copy, share, or print a badge sheet. Runs entirely in the browser |
| `/cv.html` | CV Maker: academic CV builder with 3 templates, live preview, page count, PDF (print) and Word export, plain-text copy, backup/restore. Drafts stay in the browser |
| `/funding.html` | Funding Finder: searchable archive of fellowships, grants, and scholarships by major, stage, and citizenship, plus Funding 101 and a guide for international students. Data lives in `public/funding-data.js` (review it each fall) |
| `/training.html` | Mentor training: 7 short modules (video, key points, 3-question check, 80% to pass), progress saved on the device, mentor commitments and a downloadable certificate. Content lives in `public/training-data.js`; paste YouTube IDs into each module's `video` |
| `/resources.html` | Mentor resources: campus and crisis support, copyable email templates, practice scenarios with suggested responses, meeting agendas, mentor commitments |
| `/login.html` | Sign-in with email and password for mentors, students and help requesters (they set a password from their private page; the private link keeps working) |
| `/admin.html` | Admin sign-in and program monitor: totals, funnel, 12-week activity, per-department capacity, alerts (students waiting, no first meeting after 21 days, second meeting overdue after 56, low ratings, unassigned help, mentors without training), matches, people, help requests, activity log, CSV export; actions to run matching, rematch, end matches, withdraw/reinstate, issue new private links, set Mentor Leads, manage accounts. Administrators see everything; Mentor Leads see only their departments |
| `/tap.html` | ScholarTap digital card: a phone-friendly profile opened from a link or QR code, with "Save contact". The details live in the link itself (after `#`), never on the server |

### How matching works

Each mentor in the student's chosen department who has an open spot is scored, and the highest score wins
(ties go to whoever registered first):

- same department: +40
- each interest keyword found in the mentor's research description: +10
- each shared career path: +8
- each shared availability window: +5
- compatible meeting format: +5

Students with no available mentor wait and are matched automatically when a mentor joins or a spot frees up.
Help requests go to the least-busy volunteer, from the same field when possible, with up to 3 open requests per volunteer.

### Where the data lives

Submissions are saved as JSON text files in a **separate private GitHub repo** (`ScholarLink-data`), one commit
per submission, so there's a full history. Student names and emails never touch this public repo.
Departments, Mentor Leads, answer choices, and weights are set in that repo's `config.json`; edit it there and the site
picks up changes within about a minute. See `data-template/` for the starting files.

### Architecture

```
public/              static site (HTML/CSS/JS, no build step); cards.js draws name cards on a canvas
netlify/functions/   api.mts – one serverless function serving /api/*
src/logic.mts        validation, matching, help assignment, personal views
src/store.mts        reads/writes JSON files in the data repo through the GitHub API (atomic commits, retry on conflict)
data-template/       starting files for the private data repo
```

Hosted on Netlify. Environment variables:

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token with **Contents: read & write** on the data repo only |
| `DATA_REPO` | `owner/ScholarLink-data` |
| `DATA_BRANCH` | optional, defaults to `main` |

Local development: `netlify dev` (with those variables set), or with nothing to install:
`node dev.mjs` serves the site and API on http://localhost:8888 and keeps data as JSON files in `local-data/`
(set `LOCAL_DATA_DIR` to change it). The same command runs ScholarLink on any small server if Netlify isn't an option.

### Safety

- Only `@uga.edu` emails can register (set in `config.json`).
- Each person gets a private link to their page. Only a hash of its secret is stored.
- Matched pairs see each other's contact info. Nobody else's data is ever shown publicly; the home page shows only counts.
- A hidden honeypot field filters basic bots.

## Spreadsheet version

The original offline pilot tools are still here:
[`ScholarLink_Pilot.xlsx`](ScholarLink_Pilot.xlsx) (matching and tracking workbook) and
[`ScholarLink_Form_Questions.md`](ScholarLink_Form_Questions.md) (Google/Microsoft Forms questions).

## Sign-in and admin accounts

- Set `SESSION_SECRET` (any random string of 16+ characters) in the site settings. Sessions are signed with it; users stay signed in for 30 days, admins for 1 day.
- Passwords are stored as salted scrypt hashes. Sign-in attempts are rate-limited, and every admin sign-in and action is written to `audit.json`.
- First administrator: set `ADMIN_SETUP_CODE` and open `/admin.html` (the setup form appears only while no admin exists), or run
  `node admin-user.mjs --email you@uga.edu --name "Your Name"` and add the printed entry to `admins.json` in the data repository.
  Mentor Leads: `--role lead --dept "Genetics"`, or add them from the dashboard's Admin accounts tab.

## License, governance and training

- Code: MIT (`LICENSE`). The ScholarLink name and logo: `TRADEMARKS.md`. Contributions: `CONTRIBUTING.md`.
- Ownership, decisions, data stewardship and what happens if ScholarLink becomes a company: `docs/GOVERNANCE.md`;
  a draft memorandum of understanding with GSA: `docs/AGREEMENT-TEMPLATE.md`.
- Mentor training content is in `public/training-data.js` (page, handbook, slides and videos all come from it).

## Credits

Developed by Ankush Sharma at the University of Georgia, for Bulldog Bridge (UGA GSA).
