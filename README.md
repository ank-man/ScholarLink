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

Local development: `netlify dev` (with those variables set).

### Safety

- Only `@uga.edu` emails can register (set in `config.json`).
- Each person gets a private link to their page. Only a hash of its secret is stored.
- Matched pairs see each other's contact info. Nobody else's data is ever shown publicly; the home page shows only counts.
- A hidden honeypot field filters basic bots.

## Spreadsheet version

The original offline pilot tools are still here:
[`ScholarLink_Pilot.xlsx`](ScholarLink_Pilot.xlsx) (matching and tracking workbook) and
[`ScholarLink_Form_Questions.md`](ScholarLink_Form_Questions.md) (Google/Microsoft Forms questions).
