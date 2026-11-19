# ScholarLink governance

These are ScholarLink's working rules: who owns what, who decides, who runs the UGA service and what happens
if the project becomes a company. They are written so that a future commercial version stays possible without
taking anything away from UGA students.

> This document sets out intent. It is not legal advice. Before signing an agreement, accepting money or forming
> a company, check it with UGA's technology commercialization office (Innovation Gateway) and, if needed, a lawyer.

## 1. Roles

| Role | Who | Owns or controls |
|---|---|---|
| **Owner and lead maintainer** | Ankush Sharma | Copyright in the code, the ScholarLink name and logo, the GitHub repository, final say on releases |
| **Operator (UGA deployment)** | Graduate Student Association (GSA), with EITS approval | The UGA hosting accounts, the UGA relay database, UGA branding, support for UGA students |
| **Advisors** | EITS (security, hosting) and ELS (funding, outreach) | Review and approval rights described in the proposal |
| **Contributors** | Anyone who sends a pull request | Their own contributions, licensed under `CONTRIBUTING.md` |
| **GSA Mentor Leads** | One graduate student per department | Matches and support in their department, through the admin dashboard |
| **Users** | Mentors, students and help requesters | Their sign-up details, meeting records and ratings |

## 2. Ownership

1. **Code.** Ankush Sharma holds the copyright, and the code is MIT-licensed (`LICENSE`). Contributors grant the
   owner the right to relicense (`CONTRIBUTING.md`), so a future company can offer a commercial edition.
2. **Brand.** The ScholarLink name, logo and icon stay with the owner (`TRADEMARKS.md`). UGA marks stay with UGA.
3. **Student data.** Sign-ups, matches, meeting dates, ratings and help requests are kept in a private data
   repository (or data folder) controlled by GSA. They belong to the people they describe; GSA operates that data
   for UGA and does not own it. The developer has no access unless GSA grants it for maintenance.
4. **No University funds for development.** The software was built on the developer's own time. Any funds UGA
   provides (for example printing, or a custom domain) cover the UGA deployment, not ownership of the software.
   This should be confirmed in writing with Innovation Gateway, under UGA's Intellectual Property Policy.

## 3. Decisions

- Day-to-day changes: the lead maintainer merges pull requests that pass tests.
- Changes that affect UGA students' data, privacy or the UGA deployment (new data fields, a new host, new
  third-party services): GSA is told 14 days ahead, and EITS reviews any change to data classification or hosting.
- Disagreements: the maintainer and the GSA technology officer try first. If they can't agree, the GSA Executive
  Board decides on matters of the UGA deployment, and the owner decides on the software itself.

## 4. Releases and security

- Releases are tagged on `main` (semantic versions). `npm test` must pass.
- Security issues: report privately to the maintainer. The fix ships within 14 days, and EITS is told about any
  issue that touched UGA data.
- Secrets (`GITHUB_TOKEN`, `SESSION_SECRET`, `ADMIN_SETUP_CODE`) live only in the host's settings, never in the repository.

## 5. Data stewardship (UGA deployment)

- Minimum data: name, uga.edu email, year or program, department, interests, career goals, availability, meeting
  format, meeting dates, 1–5 ratings, and help-request details. No grades, student IDs or academic records.
- Private links are stored only as SHA-256 hashes; passwords only as salted scrypt hashes.
- Admin accounts are limited by role: Mentor Leads see only their departments. Every admin sign-in and action is
  written to an audit log.
- People can ask their Mentor Lead to withdraw them at any time. Records are deleted 24 months after a person's last
  activity, and coordinators export only what they need for reports.
- No ads, no tracking scripts, no sale of data.

## 6. Succession

- GSA keeps admin access to the UGA hosting accounts and a copy of this document. At least two officers hold access.
- If the maintainer graduates or steps back, GSA may keep running the UGA deployment from the code
  indefinitely, at no charge (see section 7). A new maintainer can be appointed by GSA for UGA's fork.

## 7. If ScholarLink becomes a company

If the owner forms a company to offer ScholarLink to other universities or the public:

1. **UGA keeps it free.** GSA and UGA students keep a perpetual, royalty-free license to run the UGA deployment,
   with the features available at the time of the change, plus security fixes.
2. **Founding-partner terms.** UGA is offered any hosted or paid edition at no cost or at a discount for at least
   five years.
3. **No data moves without consent.** UGA user data is never moved to a commercial service unless each user opts in.
   GSA can export all UGA data at any time.
4. **Branding split.** The commercial edition ships without UGA marks. The UGA edition keeps them under UGA's rules.
5. **Clean title.** Before forming the company, the owner gets written confirmation from Innovation Gateway that
   UGA claims no ownership of the software, or agrees a license with UGA.
6. **Public code stays public.** Code already released under MIT stays MIT. New commercial features may be
   offered under a different license (open-core).

## 8. Changing this document

The owner may change sections 1–4 and 6. Changes to section 5 (data) or section 7 (UGA's rights) also need the
GSA Executive Board's agreement, recorded in its minutes.
