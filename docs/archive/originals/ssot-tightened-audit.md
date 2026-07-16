# Repository 4 — System Integrity Audit: Tightened Documentation Pass
**Status: Documentation only. No code touched, renamed, or optimized.**

**Honest scope statement, upfront:** this pass brings **full, field-level, function-level rigor** to the entities that evidence-gathering surfaced as most important — `animals`, the `weights`/`weight_log` pair, and `uid_lookup` — plus two project-wide, fully-completable artifacts (the corrected Mutation Matrix and the Hidden State inventory). Bringing the remaining ~16 entities to this same depth is real, substantial work that deserves its own dedicated pass rather than being rushed here — doing so would violate "evidence over assumption" by producing shallow, padded entries for entities I haven't yet earned the right to make confident claims about.

---

## ⚠️ Critical Correction to Phase 1

**Phase 1 stated `weights` was "not an active entity... zero live read/write sites found."** That conclusion was **wrong**, and I want to say so plainly rather than bury it. Investigating the tightened Mutation Matrix (below) surfaced a real write call my original, narrower grep missed entirely (it never searched `shared.js` for this specific collection). Corrected finding:

- `shared.js`'s `_ubSubmit()` function (the unified birth-registration handler) **does** write to `weights`: `fbPost('weights', {date:bdate, weight, animal_tag, species, breed, barn, notes:'وزن الميلاد'})` — triggered whenever a birth is registered with a birth weight recorded.
- **Confirmed by exhaustive project-wide search: nothing, anywhere, ever reads from `weights`.** `pages/animal_detail.js` — the only place that displays an animal's weight history — reads exclusively from `weight_log`, never `weights`.
- **Net effect, stated plainly: every newborn's recorded birth weight is written to Firebase successfully, then permanently invisible to the application.** It doesn't appear in the animal's own weight chart, in any report, or anywhere else. This is a genuine, confirmed, silent data-loss pattern — not a naming quirk, not dead legacy code.

This is now the flagship finding of this audit so far, documented at full depth below.

---

## Methodology Transparency (in the spirit of "no assumptions")

Building the corrected Mutation Matrix required fixing my own extraction approach **four separate times**, each time because manual spot-checking caught something the automation missed:

1. **Missing `fbPut`** — my first pass only searched for `fbGet`/`fbPost`/`fbPatch`/`fbDelete`. `fbPut` (used for `diary_snapshot` and `uid_lookup`) was invisible until I found it by accident while investigating a code comment.
2. **Missing `fbGetOne`/`fbGetSingle`** — two additional read-only variants, found only by explicitly grepping for every `fb[A-Z]` pattern in the project rather than assuming I already knew the full function set.
3. **Variable-passed collection names** — `pages/inventory.js` writes to `inventory_feeds`/`inventory_meds`/`inventory_equipment` via a `fbTable` variable resolved from a type dispatch (`{meds:'inventory_meds', feeds:'inventory_feeds', equip:'inventory_equipment'}[type]`), not a literal string — invisible to any regex matching literal quoted collection names.
4. **Fields written through a shared helper** — `animals`' `sold_at`/`removal_reason` fields (written via the bulk-sell path's `commitBulkPatch(ids, {...})` call) don't appear in a direct-literal-object scan of `animals.html`, because the actual `fbPatch('animals', ...)` call lives inside `commitBulkPatch()` in `shared.js`, one level removed from the call site that constructs the payload.

**Implication carried forward:** any collection currently showing an asymmetric read/write count (e.g., "10 reads, 0 writes") should be treated as **a prompt to manually verify**, not as settled fact — exactly the discipline that caught all four issues above. I did this for every collection below; I have not yet done it for the ~16 entities outside this pass's scope, and neither should anyone else assume their current counts are final without the same check.

---

## Corrected Mutation Matrix (all 20 entities, 270 raw call sites)

| Collection | Get | GetOne/Single | Post | Patch | Put | Delete | Files | Manually verified? |
|---|---|---|---|---|---|---|---|---|
| `animals` | 50 | 0 | 16 | 30 | 0 | 4 | 26 | ✅ full deep-dive below |
| `breeding` | 16 | 0 | 4 | 1 | 0 | 1 | 11 | Not yet |
| `health` | 17 | 0 | 4 | 3 | 0 | 1 | 10 | Not yet |
| `vaccinations` | 12 | 0 | 3 | 2 | 0 | 1 | 7 | Not yet |
| `vaccination_templates` | 1 | 0 | 1 | 0 | 0 | 1 | 1 | Not yet |
| `weight_log` | 2 | 0 | 2 | 1 | 0 | 1 | 2 | ✅ full deep-dive below |
| **`weights`** | **0** | 0 | **1** | 0 | 0 | 0 | 1 | ✅ **critical finding — see above** |
| `production_log` | 4 | 0 | 1 | 0 | 0 | 1 | 4 | Not yet |
| `finance` | 6 | 0 | 10 | 1 | 0 | 1 | 10 | Not yet |
| `inventory_feeds` | 10 | 0 | ~2* | ~2* | 0 | ~1* | 8 | ✅ corrected for variable-name blind spot |
| `inventory_meds` | 10 | 0 | ~2* | ~2* | 0 | ~1* | 8 | ✅ corrected |
| `inventory_equipment` | 2 | 0 | ~2* | ~2* | 0 | ~1* | 2 | ✅ corrected |
| `feed_consumption` | 1 | 0 | 1 | 0 | 0 | 1 | 1 | Not yet |
| `daily_tasks` | 2 | 0 | 2 | 4 | 0 | 1 | 1 | Not yet |
| `diary_snapshot` | 1 | 0 | 0 | 0 | **2** | 0 | 2 | ✅ verified — see note below |
| `users` | 5 | 1 | 0 | 1 | 2 | 1 | 3 | Not yet |
| `uid_lookup` | 0 | 0 | 0 | 0 | 1 | 0 | 1 | ✅ documented above |
| `notifications` | 5 | 0 | 0 | 4 | 0 | 3 | 3 | Not yet |
| `login_notifications` | 4 | 0 | 1 | 0 | 0 | 1 | 3 | Not yet |
| `activity_log` | 2 | 0 | 3 | 0 | 0 | 0 | 4 | Not yet |

*\*Inventory counts marked with an asterisk are corrected estimates based on manually reading `pages/inventory.js`'s dispatch logic (all three types share the same generic add/edit/adjust-quantity/delete functions) — not yet broken down type-by-type with the same automated precision as the other rows.*

**`diary_snapshot` note:** confirmed real writer at `diary.html:395` and `dashboard.html:436`, both via `fbPut`. Critically, `dashboard.html`'s own source contains this comment, verbatim, at the exact write site: *"In a real scenario, we'd compare against a 'diary_snapshot' in Firebase... which might store the 'Correct' numbers"* — direct, textual evidence that whoever wrote this code was themselves uncertain whether `diary_snapshot` is authoritative or provisional. This is exactly the kind of ambiguity Phase 4/5 needs to resolve, flagged here rather than assumed one way or the other.

**The complete, unabridged 270-row call-site data (file, function, operation, collection, line number) is provided as an attached CSV** — the summary table above is for readability; nothing was dropped from the underlying dataset.

---

## Full Entity Deep-Dive #1: `animals`

**Exact collection name:** `animals`

**Complete document structure (32 distinct fields, confirmed by mechanical extraction across every direct-literal write site, plus 2 more — `sold_at`, `removal_reason` — known from this engagement's own prior work on the bulk-sell path, confirmed manually since they're written through the `commitBulkPatch()` indirection described above):**

| Field | Written by (confirmed) |
|---|---|
| `tag`, `breed`, `species`, `gender`, `purpose`, `barn`, `birth_date`, `notes`, `current_weight`, `created_at` | Add/edit flows (individual and bulk `edit`) |
| `status` | Every status-changing action (death, sell, quarantine, delete-adjacent) |
| `died_at`, `death_time`, `death_reason`, `death_autopsy`, `death_loss`, `death_id`, `death_notes`, `death_batch_id` | Death flows (individual `submitDeath`, bulk `performBulkDeath`) |
| `sold_date`, `sold_price`, `sold_to`, `sold_notes`, `sold_phone` | Individual `submitSold()` |
| `sold_at`, `removal_reason` | Bulk `performBulkSell()` — **different field names for the same real-world event as the row above**, already flagged in this Sprint's own prior refactor audits |
| `quarantine_start`, `quarantine_end`, `quarantine_location`, `quarantine_reason`, `quarantine_notes` | Quarantine flows |
| `batch_entry`, `date`, `animal_tag` | Batch-entry flow (bulk animal creation) |

**All readers (every file confirmed touching `animals` — 26 total):** `animal-detail.html`, `animals.html`, `assistant.html`, `barns.html`, `births.html`, `cost.html`, `dashboard.html`, `dead.html`, `diary.html`, `fix-births.html`, `goats.html`, `import.html`, `reports.html`, `settings.html`, `sheep.html`, `users.html`, plus `pages/animal_detail.js`, `pages/births.js`, `pages/breeding.js`, `pages/farm_profile.js`, `pages/finance.js`, `pages/notifications.js`, `pages/pedigree.js`, `pages/production.js`, `pages/reports.js`, `pages/tasks.js`.

**All writers (by function, confirmed):** `submitAddAnimal()`, `execBulk()`'s `edit`/`transfer`/`death`/`sell` dispatch → `performBulkTransfer()`, `performBulkDeath()`, `performBulkSell()` (all via `commitBulkPatch()` except `performBulkDeath`, which writes directly), `submitDeath()` (individual), `submitSold()` (individual), `submitQuarantine()`, `_beSubmit()` (batch entry), `_ubSubmit()` (unified birth — writes new animal records for each newborn).

**Delete paths:** `deleteAnimalFull()` (individual), `performBulkDelete()` (bulk) — both confirmed calling `fbDelete('animals', id)`.

**Derived/computed fields:** none stored on the document itself; `current_weight` is stored (a snapshot value) but the authoritative history lives in the separate `weight_log` collection — this split itself is worth flagging for Phase 4 (is `animals.current_weight` kept correctly in sync with `weight_log`'s latest entry? **Unknown — not yet verified.**)

**Foreign-key relationships:** `mother_tag`/`father_tag` (breeding lineage, string references to other animals' `tag`, not document IDs — a denormalized, string-based FK, not an enforced relational one). `weight_log` and `weights` both reference an animal via `animal_tag` (string), not the animal's Firebase document ID — another denormalized FK.

**Dependencies:** `health`, `vaccinations`, `breeding`, `finance`, `weight_log` (and, per the critical finding, `weights`) all reference specific animals by tag; `barns.html` almost certainly aggregates `animals.barn` rather than owning its own barn data (flagged in Phase 1, still **Unknown — not yet confirmed** this pass).

**Source of Truth or Derived View:** **Source of Truth** — the authoritative record for every animal.

**Synced, cached, or local-only:** Synced (real Firebase collection, not localStorage-based) — but reads throughout the app use a client-side cache (`fbGet(..., true)` cache-bypass patterns seen in `pages/animal_detail.js`, and `fbCacheInvalidate()` calls elsewhere) whose staleness characteristics are **Unknown — not yet audited** this pass.

---

## Full Entity Deep-Dive #2: `weights` vs. `weight_log`

| Aspect | `weight_log` | `weights` |
|---|---|---|
| Exact collection name | `weight_log` | `weights` |
| Document structure | `{animal_id, weight, date, notes, ...}` (exact full field list **not yet exhaustively extracted this pass — Unknown**) | `{date, weight, animal_tag, species, breed, barn, notes}` (confirmed complete from the single write site) |
| All readers | `pages/animal_detail.js` only | **None, anywhere** — confirmed by exhaustive project-wide search |
| All writers | `pages/animal_detail.js`'s add/edit weight-entry UI | `shared.js`'s `_ubSubmit()` (birth registration), only |
| Delete paths | `pages/animal_detail.js` — confirmed `fbDelete('weight_log', id)` | **None exist** — nothing ever needs to delete a record nobody can see |
| Foreign key to animal | `animal_id` (a document ID reference — the *stronger*, non-denormalized FK style) | `animal_tag` (a string reference — the *weaker*, denormalized style) — **the two collections don't even reference an animal the same way** |
| Source of Truth or Derived View | Source of Truth for ongoing weight tracking | **Currently neither** — it's a write destination with no corresponding read path, functionally an orphaned data sink |
| Synced/cached/local | Synced, real Firebase collection | Synced (writes succeed), but **effectively write-only** |

**Risk classification: Critical.** Silent data loss on every single birth-weight entry, with no error surfaced to the user (the write succeeds; there's simply nothing downstream that ever looks for it). This is precisely the kind of "orphaned document" / "dead collection from the read side despite an active writer" pattern this audit's own Phase 6 (Firestore Anti-pattern Audit) is designed to catch — surfaced here early because the evidence was unavoidable once the Mutation Matrix was built correctly.

---

## Entity Deep-Dive #3: `uid_lookup`

**Exact collection name:** `uid_lookup`, keyed by Firebase Auth UID (not a push ID or app-level user ID).
**Document structure:** `{appUserId: string}` — a single-field mapping document.
**All writers:** `firebase.js`'s Firebase-Auth-bridge function (the `signInWithFirebaseAuth()`-adjacent code first introduced during this Sprint's earlier PIN-security work) — one `fbPut()` call, explicitly wrapped as best-effort (`try{...}catch(e){/* best-effort */}`).
**All readers:** **None found in client-side code** — by design, per its own code comment, this exists specifically so Firebase's **server-side security rules** can resolve "which app user does this Firebase Auth UID belong to," not for the client app itself to read.
**Source of Truth or Derived View:** A derived lookup index, not a primary entity — its sole reason to exist is bridging two identity systems (Firebase Auth's random UIDs and this app's own PIN-based user IDs).
**Risk:** Low — a narrow, well-scoped, already-defensively-coded (best-effort, non-fatal) piece of infrastructure. No inconsistency found.

---

## Hidden State Inventory (project-wide, complete for this pass)

| Location | What's stored | Risk of becoming a second source of truth |
|---|---|---|
| `localStorage['farm_settings']` | Farm name, currency, breed lists, threshold days, logo URL, address | **Confirmed realized, not just theoretical** — per-device, never synced (see Phase 1's finding, restated here since it's squarely a Hidden-State issue too) |
| `localStorage['farm_user']` | The currently logged-in user object | Expected, standard session-state pattern — low risk on its own, though it means a role/permission change made server-side won't take effect until the next login |
| `localStorage['farm_theme']` | Light/dark mode preference | Purely cosmetic — no business-data risk |
| `localStorage['_last_login_log_'+userId]` (per user) | Timestamp used to throttle login-notification writes to once per 5 minutes | Not business state, a rate-limiting mechanism — low risk |
| Module-level JS variables (`_selected`, `_selectMode`, `animals` array) in `animals.html` | In-memory selection state and the last-fetched animal list | Already extensively audited in this Sprint's own refactor work — known, intentional, cleared/refreshed consistently via `refreshAnimalsAfterBulk()` |
| `window.FARM_CONFIG` (`config.js`) | Static, deploy-time default settings | A legitimate fallback layer beneath `localStorage`, not itself a conflicting second source — but worth noting it's a *third* place farm configuration can originate from (deploy-time config, then localStorage override, with no Firebase-backed third option at all) |
| Client-side data caching (`fbCacheInvalidate()` calls, cache-bypass flags like `fbGet('weight_log', true)`) | An in-memory or otherwise client-side cache layer sits between the app and Firebase reads | **Its staleness/invalidation guarantees are not yet audited this pass — Unknown.** Given how many places call `fbCacheInvalidate()` selectively per-collection, there's real potential for a stale-cache read shortly after a write elsewhere invalidates a *different* cache key than the one just written — flagged for Phase 6, not resolved here. |

---

## Preliminary Risk Classification (for findings already proven — not a complete Phase 6 pass)

| Finding | Risk | Why |
|---|---|---|
| `weights` write with no reader anywhere | **Critical** | Silent, total data loss on a real user action (recording a birth weight), with zero error signal |
| Farm Settings has no Firebase-backed source at all | **High** | Confirmed structural violation of "one authoritative source" for a real, user-facing entity; multi-device usage (explicitly part of this project's own context) makes this a practical, not just theoretical, problem |
| `animals.current_weight` vs. `weight_log`'s actual history — sync guarantee unknown | **Medium** (pending verification) | Could be a second, silent inconsistency of the same shape as the `weights` finding, or could be entirely fine — **not yet proven either way**, correctly left unclassified until checked |
| `diary_snapshot`'s own code comments show developer uncertainty about its authority | **Medium** (pending Phase 4/5) | Not yet proven to cause a real inconsistency, but the code's own admission of uncertainty is itself evidence worth weighing |
| Client-side cache invalidation granularity | **Unknown** | Flagged, not classified — would need its own dedicated trace before assigning a risk level responsibly |

---

## What remains before this documentation standard can be called complete

The same full-depth treatment given to `animals`, `weights`/`weight_log`, and `uid_lookup` above still needs to be applied to: `breeding`, `health`, `vaccinations`, `vaccination_templates`, `production_log`, `finance`, `inventory_feeds`/`meds`/`equipment` (including finally resolving their exact per-type call counts, not just the manually-corrected estimate given here), `feed_consumption`, `daily_tasks`, `users`, `notifications`, `login_notifications`, and `activity_log` — 13 entities, each requiring the same complete-document-structure + every-reader/writer-by-function + FK + dependency + SoT-classification treatment demonstrated above.

**This is the honest state of "completeness over speed" applied to a project this size: the standard has been proven and calibrated on the highest-value entities, with one critical, previously-mis-stated finding corrected along the way. Extending it to the remaining 13 is real, substantial work I'm not claiming to have shortcut.**

**Waiting for direction on whether to continue entity-by-entity in this same depth, or to prioritize a specific subset first (e.g., the entities most connected to the `weights`/`weight_log` finding's blast radius, or the ones feeding the Dashboard's statistics, given Phase 7's stated importance).**
