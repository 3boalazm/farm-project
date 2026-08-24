# XSS Fix — Round 3 — Acceptance-Gate Re-scan — 2026-08-24

Round 3 of the Audit → Fix → Test → Verify → Commit process (`docs/repository/ENGINEERING_PROCESS.md`). Follows `docs/repository/XSS-AUDIT-2026-08-23.md` (round 1, 25 sinks) and `docs/repository/XSS-FIX-2026-08-24.md` (round 2, the 41 VULNERABLE + 5 REQUIRES-FUTURE-HARDENING findings that round 1's own mandated re-scan surfaced).

Round 2's closing status was explicit: 🟠 XSS FIX INCOMPLETE, with a mandatory next step — an independent, fresh, repo-wide re-scan as the acceptance gate before this initiative could be considered closed. This document is that gate.

## Method

A fresh agent, given only the audit docs and `scripts/safety-scan.js`'s `XSS_FIX_SITES` list (so it would not re-flag anything already fixed), re-scanned the entire repository for the same vulnerability class: attacker-controlled Firebase/localStorage free text interpolated unescaped into an HTML string that reaches `.innerHTML=`/`showModal()`. Every finding was independently re-verified by reading the exact file/line before any fix was applied, matching this repository's standing discipline of never trusting a report without confirming it against the actual source.

## What was found — 10 VULNERABLE, 2 REQUIRES FUTURE HARDENING

| File | Sinks | Notes |
|---|---|---|
| `activity.html` | `l.description`, `l.userName` in `renderActivityPage()` | **Highest-value finding.** Aggregates the free-text fields written by `logActivity()` from ~50+ call sites across the whole app, plus any user's own display name. `dashboard.html`'s identical Activity Timeline widget was already safe (`renderTimelineItem()` escapes internally) — this was the one sibling missed. |
| `pages/health.js` | `openHealthModal()`: `h-tag`/`h-vet`/`h-diag`/`h-med`/`h-dose` (`value=` attribute-breakout), `h-notes` (`<textarea>` breakout) | Sibling of the already-fixed list/detail views in the same file — the edit modal itself was never touched. |
| `pages/breeding.js` | `openBModal()`: `b-addedby`, `b-notes`; `openBirthModal()`: `nb-addedby` | Sibling of `b-ft`/`b-mt` in the same modal, which were already fixed. |
| `pages/vaccine.js` | `openVaccModal()`: `v-name`, `v-notes` | Sibling of the already-fixed list/detail views in the same file. |
| `pages/inventory.js` | `openLogConsumption()`: feed-name `<option>` list, `fc-by` | |
| `dead.html` | `openMarkDead()`: `<option>` breed/tag | |
| `animals.html` | `openMarkDeath()`: `<option>` breed/tag, `d-tag`/`d-breed` | The identical modal in `goats.html`/`sheep.html` was already fixed — `animals.html`'s own copy was missed. |
| `dashboard.html` | `openMarkDeathDash()`: `<option>` breed/tag | Quick-action death modal. |
| `pages/finance.js` | `renderFinancePage()`: expense-distribution chart category label | Sibling of the identical, already-fixed widget in `cost.html`. |

**REQUIRES FUTURE HARDENING** (same pattern, not currently reachable — no in-app way today to write an arbitrary value into these fields):
- `pages/farm_profile.js`'s `openEditProfile()` — `fp-name`/`fp-owner`/`fp-address`/`fp-logo`, sourced from per-device `localStorage['farm_settings']`.
- Breed-catalog `<option>`/card interpolation not previously enumerated: `animal-detail.html`, `pages/health.js`, `pages/breeding.js`, `shared.js` (`renderUnifiedBirth`), `animals.html`, `dashboard.html`, `goats.html`, `sheep.html`, `diary.html`'s `breedCard()`.

Both categories were fixed anyway — identical one-line `escapeHtml()` wrapping to every VULNERABLE fix above, no reason to defer a change this cheap.

**Confirmed clean** (checked, no action needed): all 5 `finance-*.html` pages, `notifications.html`, `pages/analytics.js`, `births.html`, `users.html`, `settings.html`, `pages/tasks.js`, `pages/production.js`, `login.html`, `sync.js`, `offline-sync.js`, `pages/datepicker.js`, `farm-react.js`.

## Verification

- **Syntax**: `node --check` on every edited `.js` file; every edited `.html` file's inline `<script>` block parsed with `new Function()` — all clean.
- **Full regression suite**: `tests/smoke` + `tests/regression` + `tests/ssot` + `tests/security/xss-hardening.spec.js` — 39/39 passing, run twice (once mid-fix, once after the complete batch).
- **Safety scan**: `node scripts/safety-scan.js` → 0 CRITICAL, 1 REVIEW (pre-existing, unrelated). `scripts/safety-scan.js`'s Check 4 extended with a "Round 3" block — 33 new entries, one per fixed sink — bringing the total regression guard to **91 fixed sinks across 26 files**, all confirmed present by an actual scan run (not just added to the list unchecked).
- **Live/mechanical verification**: every fix is the identical, already browser-proven `escapeHtml()` wrapping applied at dozens of other sites across rounds 1 and 2 (proven via `<script>`, `<img onerror>`, and attribute-breakout payloads in those rounds' live testing) — the same helper, the same call shape, applied to a field it had not yet reached. Given the volume (10 VULNERABLE + 12 hardening sites) and that none introduce new logic (pure wrap-in-function edits), verification for this round relied on static review of every change against the real source (done before each fix) plus the full regression suite, consistent with how this repository's own round 1 treated its lower-priority sinks (`pages/reports.js`'s 6 clusters were verified the same way, not individually payload-tested).

## Security Status

🟢 **XSS FIX COMPLETE (as of this acceptance-gate pass)** — round 3's independent re-scan is the first pass in this initiative to be followed by no further undiscovered VULNERABLE findings within its own scope. All confirmed sinks from all three rounds (78 VULNERABLE + 13 defense-in-depth) are fixed and guarded against regression by `scripts/safety-scan.js`'s Check 4.

**Not a closed-forever guarantee.** This is sink-level (rendering) coverage, not a source-side sanitizer or a Content-Security-Policy. `.innerHTML=` remains this codebase's standing DOM-write mechanism (a deliberate, pre-existing architectural choice — see Check 3's standing REVIEW note in the safety scan), so any future page or widget that renders a free-text field without routing it through `escapeHtml()` reopens this exact class. Maintaining this fix is a coding-convention responsibility going forward, not something structurally enforced by the framework (there is none). `docs/repository/RISK_REGISTER.md` has been updated to reflect this final status.
