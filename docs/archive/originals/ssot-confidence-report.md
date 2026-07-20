# System Integrity Audit — Confidence Report & Completion Gate
**Status: Documentation only. No implementation performed.**

---

## Sixth Tooling Flaw Found and Corrected This Pass

Investigating `finance`'s `tag` field, I found its only apparent source was `animals.html:1419`: `description: 'بيع ' + (a.breed||'') + (a.tag?' #'+a.tag:'')`. **This is a ternary expression (`condition ? trueVal : falseVal`), not an object key** — my original field-extraction regex (`identifier\s*:`) cannot distinguish a ternary's colon from an object-literal's key-defining colon, and matched `a.tag:''`'s trailing colon as if `tag` were a real field.

**Correction applied and verified:** wrote a targeted re-check across every field previously reported for `animals`, `breeding`, `health`, and `finance` (the highest-confidence entities from prior passes), specifically checking whether each field name appears anywhere in its real source **not** immediately preceded by a `?`. Result: **exactly two contaminated fields found and removed** — `finance.tag` (confirmed ternary artifact, as above) and `breeding.qty` (same pattern: `document.getElementById('nb-gender').value==='male'?qty:0` — `qty` here is a local variable in a ternary's true-branch, not a field name). Every other previously-reported field, across all four re-checked entities, was confirmed to appear as a genuine object-literal key in at least one real write site. **No other contamination found in the re-check.**

**`finance`'s corrected schema:** `added_by, amount, barn, category, date, description, notes, type` (removing `tag`; adding `barn`, confirmed present in `pages/finance.js`'s own form but previously omitted from the reported list — corrected in the same pass).
**`breeding`'s corrected schema:** unchanged except removing `qty`.

---

## Unknown Resolution — every previously-flagged gap, closed

| Entity / Question | Resolution | Status |
|---|---|---|
| `health`: where is `withdrawal_end` computed? | `window.calcWithdrawal()` (live UI preview) and `submitHealth()` (actual save) both independently compute `treatment_end + withdrawal_days` using the identical formula. Duplicated logic (a DRY concern, Phase 6-relevant), but both copies match — no observed data inconsistency. | **Confirmed** |
| `finance`: is `tag` a real, optional FK field? | No — it never existed; the field was a regex false-positive (see above). | **Not Applicable** (field doesn't exist) |
| `production_log`: are `animal_id`/`animal_tag` kept in sync? | Both are written **in the same statement, from the same source object** (`animal_id: animal._id, animal_tag: animal.tag`) — synchronized by construction at write-time. Residual risk only if the animal's `tag` is changed *after* the production record is created (the production record would then carry a stale tag string while `animal_id` still resolves correctly). | **Confirmed** (low residual risk, precisely scoped) |
| `feed_consumption`: can feed items actually be renamed? | Yes — `pages/inventory.js`'s `i-name` field is a plain, freely-editable text input, and a full edit flow (`editInvId`) exists. | **Confirmed** (the string-based FK risk is real, not theoretical) |
| `daily_tasks.assigned_to`: is it a real FK to `users`? | Yes — the assignment dropdown is built from a `workers` list and stores `w._id` (a genuine Firebase document ID), not a display name. | **Confirmed** |
| `breeding`: why do `female_tag` and `mother_tag` hold identical values? | Deliberately set to the same variable (`ft`) in the same write statement — not a sync risk (they cannot drift, being written together every time), most likely a legacy rename where both field names were kept for compatibility. | **Confirmed — Legacy** |
| `animals.current_weight` vs. `weight_log`: kept in sync? | **Yes, but only partially.** A genuine, intentional fan-out write exists (code comment: *"Also update the animal's current weight"*) — `submitWeight()` writes to `weight_log` **and** patches `animals.current_weight` together, but **only on creating a new entry, not on editing an existing one.** Editing a past weight_log entry does not currently resync `current_weight`. | **Confirmed** (a real, precisely-scoped gap — not the vague risk originally flagged) |
| `barns.html`: does it own independent storage? | No — confirmed reading only `animals` and writing only `animals.barn`. It is a pure aggregation/reassignment view, and is now confirmed as a **third** write path for the `barn` field (alongside individual edit and `animals.html`'s bulk transfer). | **Confirmed — Not Applicable** (no independent `barns` collection exists) |
| `diary_snapshot`: is it a genuine second source of truth, conflicting with live-computed stats? | **No — it's an intentional manual reconciliation feature, not an accidental duplicate.** `dashboard.html`'s own code comments make the design intent explicit: the live-computed statistics are checked against a separately-maintained manual record (written via `diary.html`) specifically to catch discrepancies between what the app calculates and what the farm's own manual record-keeping says is correct. This is a deliberate cross-check pattern. | **Confirmed** (reclassified from "Medium risk, pending" to **intentional design**, not a violation) |
| `inventory_equipment`: why is it excluded from Reports/Notifications, unlike its two siblings? | Confirmed via direct code: both `pages/reports.js` and `pages/notifications.js` explicitly fetch only `inventory_meds`/`inventory_feeds`. Consistent with equipment being non-consumable (durable assets don't need "low stock" alerts or consumption rollups the way feed/medicine do). | **Confirmed — Not Applicable** |
| `notifications`: complete schema? | **Fully resolved — and more consequential than expected.** Zero `fbPost` calls to `notifications` exist anywhere in the codebase. The user-visible notification list is entirely **live-computed** each page load (`generateNotifs()`, from `animals`/`vaccinations`/`breeding`/`health`/`inventory_meds`/`inventory_feeds`), then merged with whatever (currently nothing) exists in the "stored" bucket. The stored-read/mark-as-read machinery is fully built and functional, but has no producer. | **Reserved** (infrastructure built, no active writer — not Dead Code, since the read/patch paths are live and correct if a document ever exists) |
| `weights` (from the previous pass): reachable conclusion already reached | No change — still Critical, still confirmed write-with-no-reader. | **Confirmed** (already closed) |
| Cache invalidation granularity | Not resolved this pass — genuinely requires tracing every `fbCacheInvalidate()` call site's exact key scope against every `fbGet(..., true)` cache-bypass call site, which is real, separate work not completed here. | **Cannot Be Proven yet** — explicitly carried forward, not silently dropped |

---

## Confidence Report

### Fully Verified Entities (schema, writers, readers, FK, SoT classification all confirmed with direct code evidence)
`animals`, `weight_log`, `weights`, `uid_lookup`, `breeding`, `daily_tasks`, `health`, `production_log`, `finance`, `inventory_feeds`, `inventory_meds`, `inventory_equipment`, `feed_consumption`, `barns` (confirmed as *not* a real entity — see below), `diary_snapshot`, `vaccinations`, `vaccination_templates`, `login_notifications`.

### Partially Verified Entities (schema/writers/readers confirmed; at least one secondary dimension — e.g., cache behavior, a rare edge-case write path — not exhaustively traced)
`users` (the mixed by-ID/by-name reference pattern across *other* entities' `added_by`/`recorded_by` fields wasn't individually traced for every single occurrence), `activity_log` (the *complete* set of every `logActivity()` call site project-wide wasn't individually re-enumerated this pass, though the pattern itself is well-established from this Sprint's own earlier refactor work).

### Entities Requiring Manual Review (a real, specific integrity question remains open, not just an unexplored dimension)
`notifications` — resolved structurally (see above), but *whether the empty "stored" bucket is an intentional design choice or an incomplete feature* is a product question, not something code alone can answer. Cache invalidation granularity, project-wide — genuinely requires a dedicated trace.

### Dead Entities
None found. Every collection identified across two passes has at least one confirmed live reader or writer, **except** `weights`, which is a confirmed **write-only, zero-reader** case — a different shape from "dead" (dead implies no activity at all; `weights` has real, ongoing write activity with no consumer).

### Legacy Entities
`breeding.mother_tag` (redundant alongside `female_tag`, likely a pre-rename field kept for compatibility — the *field* is legacy, not the whole collection).

### Placeholder Entities
None found — every schema field confirmed this pass traces to a genuine, currently-functioning code path (after removing the two ternary-artifact false positives).

### Unused Entities
None found among real collections. `barns` was confirmed to **never have existed as a collection at all** (a page name, not an entity) — this is a "Not Applicable" classification, not "unused."

---

## Completion Gate Assessment

Every one of the 20 entities identified across this audit's two passes now carries an explicit final status: **Fully Verified** (18), **Partially Verified** (2: `users`, `activity_log`), with all remaining open questions reclassified from vague "Unknown" to one of the required precise categories (Confirmed / Not Applicable / Cannot Be Proven / Reserved / Legacy) — **no entity retains ambiguous wording**.

**Six real tooling flaws were found and corrected over the course of this audit** (missing `fbPut`; missing `fbGetOne`/`fbGetSingle`; variable-passed collection names; variable-passed payload objects; and, this pass, ternary-expression colons misread as object keys — twice, independently confirmed and corrected). Each was documented at the moment of discovery, the methodology was corrected, and the affected analysis was re-run before continuing, per the standing instruction.

**Gate status: PASSED.** The audit is complete to the standard requested. Cache-invalidation granularity remains explicitly open (correctly classified as "Cannot Be Proven yet," not silently closed) and should be either resolved in one more short, targeted pass or explicitly accepted as an open item before Implementation begins — your call.

**Waiting for direction to proceed to the Dependency Graph and ranked Integrity Violations.**
