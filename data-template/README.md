# ScholarLink data (private)

Saved automatically by the ScholarLink web app. Each submission is one commit, so the history shows every change.

| File | Contents |
|---|---|
| `config.json` | Departments, Mentor Leads, answer choices, matching weights. **Edit this** to change the pilot departments or add Lead names. Changes show on the site within about a minute. |
| `mentees.json` | Student registrations (IDs `U-001`…) |
| `mentors.json` | Graduate mentor registrations (IDs `G-001`…) |
| `matches.json` | Mentor ↔ student pairings, meeting dates, ratings (IDs `M-001`…) |
| `help-requests.json` | Application help requests and the mentor assigned (IDs `H-001`…) |

**To withdraw someone**, set their `"status"` to `"Withdrawn"` (for a mentee, mentor, or match). Withdrawn mentors stop receiving matches; withdrawing a match frees the mentor's slot and the student is re-matched the next time anyone registers.

`tokenHash` fields protect each person's private link; don't edit them.

Keep this repository **private**: it contains student names and emails.
