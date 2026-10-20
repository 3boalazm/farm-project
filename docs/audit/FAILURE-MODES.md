# FAILURE-MODES.md

> **UPDATE 2026-10 (see `FULL-AUDIT-2026-10.md`):** the `activity.html` failure mode below is fixed — the file is a real page now. Two new failure modes were found and fixed by the 2026-10 audit: a failed `fbGet` during `Users.init()` used to reset `users/admin1` to the factory PIN, and `login.html` accepted `admin/1234` during a network outage. Both are now covered by `tests/unit/02`.

## Network Failures
Firebase unavailable: `fbGet` catches and returns `[]` (confirmed, `firebase.js`) — pages degrade to empty-state rendering, not crashes. Writes (`fbPost`/`fbPatch`) have no retry logic anywhere in this codebase (confirmed across every prior certification this engagement produced) — a failed write simply fails, surfaced via a generic toast in most cases.

## Storage Failures
Corrupted `localStorage['farm_user']`: `getUser()`'s `JSON.parse` is wrapped in try/catch at the redirect layer (`index.html`) — fails safe to `login.html`. Missing keys: `getSettings()` returns sensible defaults where confirmed (established in prior certification work).

## User Mistakes
Duplicate weight/birth records: proven safe by construction — Firebase POST semantics mean concurrent/duplicate submissions create independent records, never silent data loss (certified, `docs/certification/WEIGHT.md`). Invalid dates: native `<input type="date">` blocks malformed entry at the browser level (proven via Playwright in prior sessions) — not re-verified this pass.

## Browser Failures
**Refresh/tab-close during save:** genuinely unverifiable from this static sandbox — requires live browser observation. Consistently flagged as an open, structural unknown across this entire engagement, not newly discovered or newly resolved.

## Newly Documented This Session
**`activity.html` is a broken navigation target** — `nav.js` links to it (`perm:'admin'`) but the file is a confirmed, genuine 0-byte empty file, present in this state since before this engagement's visible history. An admin clicking "سجل الأنشطة" currently sees a blank page. Not fixed this session (rebuilding content is feature work, out of scope) — documented here as the concrete failure mode this produces.

---

## Correction (2026-10 audit, item O-03)

This document is a historical record and is kept as written, but one factual
claim in it is wrong and must not be acted on:

> `activity.html` is a genuine 0-byte empty file / the audit trail has no working viewer.

`activity.html` is a complete admin page that reads `activity_log`, filters by
action and role, and escapes its output. The repudiation gap described here does
not exist. See `docs/audit/FULL-AUDIT-2026-10.md` §4 (O-03) and the closure log
at the end of that report. Since 2026-10 the audit trail is also reachable from
`diagnostics()` / `app_logs` (audit O-17) and `activity` is admin-only in the
generated rules (`scripts/apply-access-policy.js`).
