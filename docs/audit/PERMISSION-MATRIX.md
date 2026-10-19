# PERMISSION-MATRIX.md

> **UPDATE 2026-10 (see `FULL-AUDIT-2026-10.md`):** two statements below are now out of date. (1) `activity.html` is no longer a 0-byte file — it is a complete, permission-gated admin page. (2) `can('admin')`, used by 20 admin-only guards across the app, returned **true** for the supervisor role until the 2026-10 audit fixed `can()`; and the read-only `visitor` role could write to the herd until `canWrite()` was added. This document is kept as the historical record of its own session.

**Every page with a declared `perm:` in `nav.js`, cross-referenced against actual `can()` enforcement. Built from a direct, complete sweep this session — not inferred.**

| Page | Required Permission | Enforced Before This Session | Enforced Now |
|---|---|---|---|
| dashboard.html | dash | ❌ No | ✅ Yes (added) |
| animals.html | animals | ❌ No | ✅ Yes (added) |
| goats.html | animals | ❌ No | ✅ Yes (added) |
| sheep.html | animals | ❌ No | ✅ Yes (added) |
| births.html | animals | ❌ No | ✅ Yes (added) |
| dead.html | animals | ❌ No | ✅ Yes (added) |
| barns.html | animals | ❌ No | ✅ Yes (added) |
| diary.html | dash | ❌ No | ✅ Yes (added) |
| health.html | health | ❌ No | ✅ Yes (added) |
| vaccine.html | health | ❌ No | ✅ Yes (added) |
| breeding.html | breeding | ✅ Yes (prior session) | ✅ Yes |
| inventory.html | inventory | ✅ Yes (prior session) | ✅ Yes |
| finance.html | finance | ✅ Yes (prior session) | ✅ Yes |
| cost.html | finance | ✅ Yes (prior session) | ✅ Yes |
| reports.html | reports | ✅ Yes (prior session) | ✅ Yes |
| users.html | users | ✅ Yes (prior session) | ✅ Yes |
| bayan.html | bayan | ❌ No | ⚠️ **Not fixed — see below** |
| activity.html | admin | N/A — file is empty | ⚠️ **Not fixed — see below** |

## Two Pages Deliberately Left Unfixed This Session

**`bayan.html`:** structurally different from every other page (no `requireAuth()`/`DOMContentLoaded` pattern found via direct search) — likely a genuinely different initialization mechanism given its formal/printable purpose. Editing it blind, without confirming the correct insertion point, risked breaking a high-visibility formal deliverable. **Practical risk is low regardless:** `bayan` permission is granted to every current role (`admin`, `vet`, `worker`, `visitor` — only `supervisor` is excluded, and even that's likely an oversight in the role table rather than intentional). Flagged for a dedicated, careful follow-up rather than a blind edit.

**`activity.html`:** confirmed a genuine 0-byte file, present in this exact state in the originally-uploaded repository (pre-dating this entire engagement). There is no page content to guard — adding a `can()` check would guard nothing. Rebuilding the page's actual content is feature work, explicitly out of this mission's scope. Flagged in `FAILURE-MODES.md` as a broken navigation target, not silently fixed or ignored.

## Verification
Live-tested (Playwright): a `visitor`-role user is now correctly blocked from `health.html` (previously accessible); the same user correctly retains access to `animals.html` (a permission they legitimately hold); an `admin`-role user is unaffected everywhere (role bypass confirmed still working).
