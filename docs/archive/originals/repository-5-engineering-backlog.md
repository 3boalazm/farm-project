# Repository 5 — Official Engineering Backlog
**This document is synthesized exclusively from evidence already collected across this engagement. No new code investigation was performed to produce it. No code was modified.**

---

# PART A — BACKLOG ITEMS

## BL-01 — Bulk Transfer Silently Fails Due to Field-Read Timing
- **Business Problem:** Users attempting to bulk-reassign animals to a new barn from the Animals page get a silent no-op — nothing moves, no barn changes, with a misleadingly generic success flow.
- **Technical Cause:** `execBulk()` calls `closeModal()` before `performBulkTransfer(ids)` reads its own modal's `#b-barn`/`#b-reason` fields, which are already removed from the DOM by that point.
- **Evidence:** Live payload-spy testing (Repository 5, Phase 2B and reconfirmed in the Entry Point Census) shows an empty `{}` patch sent to Firebase.
- **Current Runtime Behaviour:** Toast shows a generic result message; the barn field is never actually updated.
- **Expected Behaviour:** Reads must happen before `closeModal()`, exactly as `barns.html`'s own `submitTransfer()` already does correctly.
- **Canonical Implementation:** `barns.html`'s `submitTransfer()` (confirmed correct field-read ordering, live-tested).
- **Entry Points:** `animals.html`'s `performBulkTransfer(ids)`.
- **Affected Files:** `animals.html`.
- **Collections:** `animals` (barn field only).
- **Readers:** `barns.html`, `animals.html`'s own filters.
- **Writers:** `performBulkTransfer`, `barns.html`'s `submitTransfer`.
- **Dependencies:** None.
- **Architectural Invariants Affected:** "Reading a modal's own form fields must happen before that modal is closed."
- **Risk Level:** High
- **Implementation Complexity:** Low — reorder existing reads, proven fix shape (same pattern already applied to Sale in Priority 1).
- **Regression Risk:** Low.
- **Required Product Decision?** NO
- **Required Data Migration?** NO
- **Rollback Needed?** NO
- **Definition of Done:** Live payload spy shows the real selected barn value reaching the write for every selected animal.
- **Required Regression Tests:** Payload capture test (identical methodology to Priority 1's Sale fix); confirm `barns.html`'s own transfer path unaffected.
- **Blocking Items:** None.
- **Related Backlog Items:** BL-02 (same root cause).

## BL-02 — Bulk Death Silently Loses Field Data Due to the Same Timing Bug
- **Business Problem:** Bulk-registered deaths may record incomplete/blank reason, autopsy, and loss data.
- **Technical Cause:** Identical to BL-01 — `execBulk()`'s shared `closeModal()` precedes `performBulkDeath(ids)`'s own field reads.
- **Evidence:** Confirmed in the Entry Point Census; the per-animal death IDs still generate correctly (they don't depend on form fields), but reason/autopsy/loss fields are subject to the same risk as Transfer's barn field.
- **Current Runtime Behaviour:** Not independently re-verified this pass with a payload spy (unlike BL-01) — status: **NOT YET PROVEN** for the exact field values lost, though the root-cause mechanism is identical and proven for BL-01.
- **Expected Behaviour:** Same fix shape as BL-01.
- **Canonical Implementation:** `dead.html`'s `submitDead()` (confirmed correct field-read ordering, live-tested this Repository).
- **Entry Points:** `animals.html`'s `performBulkDeath(ids)`.
- **Affected Files:** `animals.html`.
- **Collections:** `animals`, conditionally `finance`.
- **Readers/Writers:** Same family as BL-01.
- **Architectural Invariants Affected:** Same as BL-01.
- **Risk Level:** High
- **Implementation Complexity:** Low
- **Regression Risk:** Low
- **Required Product Decision?** NO
- **Required Data Migration?** NO
- **Rollback Needed?** NO
- **Definition of Done:** Same methodology as BL-01, applied to death-specific fields.
- **Required Regression Tests:** Payload spy confirming real reason/autopsy/loss values reach the write.
- **Blocking Items:** None.
- **Related Backlog Items:** BL-01.

## BL-03 — `submitBirthDirect()` Crashes Before Creating Any Animal
- **Business Problem:** A "Quick Birth" entry produces a breeding record claiming offspring exist, while zero actual animals are added to the herd — a silent, severe data-integrity gap.
- **Technical Cause:** Same `closeModal()`-before-read defect as BL-01/BL-02, but here it causes an **uncaught exception** (not just an empty payload), because the affected reads are plain `document.getElementById(...).value` calls with no `?.` guard.
- **Evidence:** Live-tested this Repository (Phase 0, re-confirmed live in the Canonical Event Architecture pass): `breeding` record created successfully; the subsequent animal-creation loop throws `TypeError: Cannot read properties of null`, silently caught, zero animals created.
- **Current Runtime Behaviour:** User sees an error toast; a `breeding` record was, in fact, already permanently saved.
- **Expected Behaviour:** Read all fields before `closeModal()`, matching `_ubSubmit()`'s ordering.
- **Canonical Implementation:** `shared.js`'s `_ubSubmit()`.
- **Entry Points:** `pages/breeding.js`'s `submitBirthDirect()`.
- **Affected Files:** `pages/breeding.js`.
- **Collections:** `breeding`, `animals`.
- **Architectural Invariants Affected:** "Reading a modal's own form fields must happen before that modal is closed"; "Every birth that creates offspring must create corresponding animal records."
- **Risk Level:** Critical
- **Implementation Complexity:** Low (same fix shape as BL-01/02, but higher severity outcome)
- **Regression Risk:** Low
- **Required Product Decision?** NO — this is a confirmed bug, not an ambiguous design question
- **Required Data Migration?** **YES** — existing orphaned `breeding` records created via this broken path need identification (Cannot Be Proven how many exist without real database access)
- **Rollback Needed?** NO
- **Definition of Done:** Live test confirms a multi-offspring quick-birth creates the correct number of animal records.
- **Required Regression Tests:** Same payload/field methodology as BL-01, extended to confirm the full animal-creation loop completes.
- **Blocking Items:** None for the code fix; the data migration sub-task is blocked on **NOT YET PROVEN** (no access to real production data to quantify).
- **Related Backlog Items:** BL-01, BL-02 (same defect family), BL-04.

## BL-04 — `markBorn()` Never Creates Animal Records
- **Business Problem:** Marking a tracked pregnancy as "born" updates only a count on the breeding record — the offspring are never added to the herd registry at all.
- **Technical Cause:** `submitBreeding()`'s `born`-status branch contains no `animals`-collection write of any kind — confirmed absent by design, not by error (completes without exception).
- **Evidence:** Live-tested this Repository (Canonical Event Architecture pass): exactly one `breeding` write, zero `animals` writes, activity log fires normally.
- **Current Runtime Behaviour:** Success toast, activity log entry — both misleadingly implying full completion.
- **Expected Behaviour:** **Requires a Product Decision** (Architecture Freeze, §4) before any target behavior can be specified.
- **Canonical Implementation:** N/A — pending the decision.
- **Entry Points:** `pages/breeding.js`'s `markBorn(id)` → `submitBreeding()`.
- **Affected Files:** `pages/breeding.js`.
- **Collections:** `breeding` (currently), `animals`+`weight_log` (if the decision is "yes, create them").
- **Architectural Invariants Affected:** "Every birth that creates offspring must create corresponding animal records" (currently violated); "Successful completion implies correctness" (currently violated).
- **Risk Level:** Critical
- **Implementation Complexity:** Medium-High — a genuine behavior *addition*, with real risk of double-creating animals if not carefully scoped to the status-transition moment only.
- **Regression Risk:** Medium — touches the Breeding page's core status workflow and any existing pregnant-record data.
- **Required Product Decision?** **YES** — should this create animal records at all, or is "just update the count" its intentional purpose?
- **Required Data Migration?** **YES**, if the decision is "yes" — every historical breeding record already marked "born" via this path has no corresponding animals, an unquantified backfill problem.
- **Rollback Needed?** N/A until implemented.
- **Definition of Done:** Pending the Product Decision.
- **Required Regression Tests:** Verify a pregnancy marked "born" produces exactly the stated offspring count of new animals, exactly once (not on subsequent edits of the same record).
- **Blocking Items:** The Product Decision itself.
- **Related Backlog Items:** BL-03, BL-05 (same Birth-event family).

## BL-05 — AI Assistant's `add_birth` Action Creates an Incomplete Birth
- **Business Problem:** Births registered via natural-language AI command produce an animal record with no lineage (`breeding`) record and no weight history, and support only one offspring per invocation.
- **Technical Cause:** The action's write logic was built independently of `_ubSubmit()`, structurally immune to the closeModal-timing defect (it parses a pre-structured data object, not DOM fields) but simply narrower in scope.
- **Evidence:** Confirmed via direct code reading (`assistant.html`'s `add_birth` handler); not independently live-tested this pass (no reachable UI trigger for a live Playwright test of an AI natural-language action) — **NOT YET PROVEN** for any dimension beyond the direct write itself.
- **Current Runtime Behaviour:** Creates one `animals` record with `birth_weight` set; nothing else.
- **Expected Behaviour:** **Requires a Product Decision** — should this path match `_ubSubmit`'s full shape, or remain an intentionally lighter AI shortcut?
- **Canonical Implementation:** `_ubSubmit()`, pending the decision on whether to extend this path to match it.
- **Entry Points:** `assistant.html`'s `add_birth` handler.
- **Affected Files:** `assistant.html`.
- **Collections:** `animals` (currently); `breeding`+`weight_log` (if extended).
- **Architectural Invariants Affected:** "Every birth that creates offspring must create corresponding animal records" (partially satisfied — animal exists, but without lineage).
- **Risk Level:** Medium
- **Implementation Complexity:** Medium
- **Regression Risk:** Low — an isolated, narrow AI action.
- **Required Product Decision?** YES
- **Required Data Migration?** Unclear pending the decision — **NOT YET PROVEN**.
- **Rollback Needed?** NO
- **Definition of Done:** Pending the Product Decision.
- **Required Regression Tests:** N/A until scoped.
- **Blocking Items:** The Product Decision.
- **Related Backlog Items:** BL-03, BL-04.

## BL-06 — Birth Event Has Zero Rollback (Best Effort Only)
- **Business Problem:** Any network interruption partway through a multi-offspring birth registration — even via the fully-correct canonical path — leaves a breeding record permanently overstating its real offspring count, with no automatic detection.
- **Technical Cause:** No transactional wrapping, no compensating writes, no batch operation exists anywhere in the write sequence.
- **Evidence:** **Live-proven via deliberate failure injection** (Repository 5, Failure Analysis + Reliability Audit passes) — simulating a failure on offspring #2 of 3 left the breeding record, animal #1, and weight_log #1 permanently in place with no cleanup attempt.
- **Current Runtime Behaviour:** Error toast shown; no indication to the user that partial data was already permanently committed.
- **Expected Behaviour:** At minimum, detect and surface the inconsistency; ideally, some compensating cleanup or a documented manual-reconciliation path.
- **Canonical Implementation:** N/A — no implementation currently addresses this at all.
- **Entry Points:** `_ubSubmit()` (canonical) and, by extension, every other Birth entry point.
- **Affected Files:** `shared.js`.
- **Collections:** `breeding`, `animals`, `weight_log`.
- **Architectural Invariants Affected:** "No orphan records are allowed"; "Successful completion implies correctness."
- **Risk Level:** Critical
- **Implementation Complexity:** High — Firebase RTDB has no native multi-path transaction primitive matching this project's existing call patterns; would likely require either a verification-and-repair step after the fact, or restructuring the write sequence itself.
- **Regression Risk:** Medium-High — touches the core Birth write path directly.
- **Required Product Decision?** NO — the *existence* of this gap is a confirmed bug; the *specific repair strategy* is an engineering decision, not a product one.
- **Required Data Migration?** **YES** — any already-orphaned real records from past partial failures would need identification (Cannot Be Proven how many exist).
- **Rollback Needed?** This item **is** the rollback/repair work itself.
- **Definition of Done:** A repeat of this Repository's own failure-injection test shows either (a) no orphan is created, or (b) an orphan is created but is automatically flagged/detectable.
- **Required Regression Tests:** Re-run the exact failure-injection methodology (mock `fbPost` to fail on a specific offspring) and confirm the new behavior.
- **Blocking Items:** None technically, though sequencing after BL-03/04/05 (fixing the *other* Birth paths first) is recommended so this hardening work isn't immediately duplicated across five entry points instead of one.
- **Related Backlog Items:** BL-07 (Undo Infrastructure), BL-03/04/05.

## BL-07 — Undo Infrastructure Exists But Is Completely Disconnected
- **Business Problem:** A visible "undo last operation" button is present in the UI, but can never actually do anything.
- **Technical Cause:** `_pushUndo()` — the only function that populates the undo stack — is never called from anywhere in the codebase, including `fbPost`/`fbPatch`/`fbDelete` themselves.
- **Evidence:** **Repository-wide grep search this pass**, confirmed exactly one match for `_pushUndo(` (its own definition).
- **Current Runtime Behaviour:** The undo button is always in its "nothing to undo" state.
- **Expected Behaviour:** **Requires a Product Decision** — was this feature abandoned mid-build, or should it be connected?
- **Canonical Implementation:** `firebase.js`'s `undoLast()`/`_pushUndo()` machinery — already correctly built, just unused.
- **Entry Points:** Every `fbPost`/`fbPatch`/`fbDelete` call project-wide would need to call `_pushUndo()` if this is connected.
- **Affected Files:** `firebase.js` (if connecting at the wrapper level, the most centralized option) or every individual write site (if connecting per-feature).
- **Collections:** Potentially all of them.
- **Architectural Invariants Affected:** None currently named that this directly violates — but connecting it would directly help BL-06.
- **Risk Level:** Medium
- **Implementation Complexity:** Medium if connected centrally (one change point in `firebase.js`); High if connected per-feature.
- **Regression Risk:** High if connected centrally — touches every write in the application.
- **Required Product Decision?** YES — is this feature wanted at all, and if so, should it cover every write or a curated subset?
- **Required Data Migration?** NO
- **Rollback Needed?** N/A — this IS rollback infrastructure.
- **Definition of Done:** Pending the Product Decision.
- **Required Regression Tests:** Full-application smoke test if connected centrally, given the blast radius.
- **Blocking Items:** The Product Decision.
- **Related Backlog Items:** BL-06.

## BL-08 — Production-Page Weight Entries Never Reach Weight History
- **Business Problem:** A weight logged via the Production module updates the animal's cached "current weight" but never appears on that animal's own weight-history chart.
- **Technical Cause:** `pages/production.js`'s `type==='weight'` branch patches `animals.current_weight` directly and has no `weight_log` write at all.
- **Evidence:** Confirmed via direct code reading (Priority 2.5); not independently live-tested this pass for this specific file — the finding itself (absence of a `weight_log` call) is a static-search result, cross-checked against the confirmed list of all `weight_log` writers project-wide (exactly 3, none of which is `pages/production.js`).
- **Current Runtime Behaviour:** `current_weight` updates; `weight_log` does not.
- **Expected Behaviour:** **Requires a Product Decision** — is this an intentionally lightweight tool, or should it match the full canonical weight-recording shape?
- **Canonical Implementation:** `pages/animal_detail.js`'s `submitWeight()`.
- **Entry Points:** `pages/production.js`'s `submitProd()`, weight-type branch.
- **Affected Files:** `pages/production.js`.
- **Collections:** `animals`, `weight_log` (if extended).
- **Architectural Invariants Affected:** "A weight record is never orphaned from its animal" (not violated in the orphan sense, but the inverse gap — a weight change with no history record at all).
- **Risk Level:** Medium
- **Implementation Complexity:** Medium
- **Regression Risk:** Low-Medium — must avoid double-counting if a production-logged weight and a later Animal-Detail entry both exist for the same day.
- **Required Product Decision?** YES
- **Required Data Migration?** NO (going-forward fix; historical gaps in weight_log from this path are not retroactively repairable without knowing which `current_weight` changes originated here)
- **Rollback Needed?** NO
- **Definition of Done:** Pending the Product Decision.
- **Required Regression Tests:** Confirm a production-logged weight appears exactly once on that animal's history chart, no duplication against other entry points.
- **Blocking Items:** The Product Decision.
- **Related Backlog Items:** BL-09.

## BL-09 — `animals.current_weight` Fan-Out Is Incomplete (Create-Only, Not Edit)
- **Business Problem:** Correcting a historical weight entry doesn't refresh the animal's cached "current weight" if that correction happens to be the most recent entry.
- **Technical Cause:** `pages/animal_detail.js`'s `submitWeight()` only patches `animals.current_weight` in its create branch (`if(editId){...}else{...patch here...}`), not its edit branch.
- **Evidence:** Confirmed via direct code reading (Priority 2.5).
- **Current Runtime Behaviour:** Editing a past weight entry updates `weight_log` correctly but leaves `current_weight` stale.
- **Expected Behaviour:** Extend the same fan-out write to the edit branch, at least when the edited entry is the most recent one for that animal.
- **Canonical Implementation:** N/A — this is the canonical function itself, needing a small addition.
- **Entry Points:** `pages/animal_detail.js`'s `submitWeight()`.
- **Affected Files:** `pages/animal_detail.js`.
- **Collections:** `animals`.
- **Architectural Invariants Affected:** None newly named; a refinement of existing weight-consistency expectations.
- **Risk Level:** Low
- **Implementation Complexity:** Low
- **Regression Risk:** Low
- **Required Product Decision?** NO — clear, uncontroversial bug.
- **Required Data Migration?** NO
- **Rollback Needed?** NO
- **Definition of Done:** Editing the most recent weight_log entry for an animal updates `current_weight` to match.
- **Required Regression Tests:** Edit a non-most-recent entry (should NOT update current_weight) and the most-recent entry (should).
- **Blocking Items:** None.
- **Related Backlog Items:** BL-08.

## BL-10 — Farm Settings Has No Authoritative, Synced Source
- **Business Problem:** Farm name, currency, breed lists, and logo differ by device/browser with zero synchronization.
- **Technical Cause:** `getSettings()`/`saveSettings()` are `localStorage`-only.
- **Evidence:** Confirmed by direct reading of `firebase.js` (Repository 4).
- **Current Runtime Behaviour:** Per-device configuration.
- **Expected Behaviour:** **Requires a Product Decision** — should this move to Firebase?
- **Canonical Implementation:** N/A — current mechanism is the frozen status quo, not an endorsed target.
- **Entry Points:** `pages/farm_profile.js`'s `saveSettings()` call; read via `getSettings()` everywhere.
- **Affected Files:** Every page (widest blast radius of any item in this backlog).
- **Collections:** None currently — would become a new Firebase path if migrated.
- **Risk Level:** High
- **Implementation Complexity:** High — broadest surface of any item here.
- **Regression Risk:** High
- **Required Product Decision?** YES
- **Required Data Migration?** YES, if approved — a one-time upload-if-Firebase-is-empty reconciliation per device.
- **Rollback Needed?** Consider a feature flag for safe rollback given the blast radius.
- **Definition of Done:** Pending the Product Decision.
- **Required Regression Tests:** Full-application smoke test; explicit multi-device consistency test.
- **Blocking Items:** The Product Decision.
- **Related Backlog Items:** None directly.

## BL-11 — Notifications Have No Live Producer
- **Business Problem:** A "stored, dismissible notification" capability is fully built (read/merge/mark-as-read) but nothing ever creates one.
- **Technical Cause:** Zero `fbPost('notifications', ...)` calls exist anywhere; the live-computed `generateNotifs()` path fully covers today's UI instead.
- **Evidence:** Confirmed via exhaustive repository-wide search (Repository 4/5).
- **Current Runtime Behaviour:** Fully functional live-notification experience; the persisted bucket is permanently empty.
- **Expected Behaviour:** **Requires a Product Decision** — build a producer, or accept the live-only design permanently.
- **Risk Level:** Low
- **Implementation Complexity:** Medium-High if building a producer (a new feature, not a fix).
- **Regression Risk:** Low (additive).
- **Required Product Decision?** YES
- **Required Data Migration?** NO
- **Rollback Needed?** NO
- **Definition of Done:** Pending the Product Decision.
- **Blocking Items:** The Product Decision.
- **Related Backlog Items:** None.

## BL-12 — `activity.html` Is Empty; the Universal Audit Trail Has No Working Viewer
- **Business Problem:** Every action in the application writes to `activity_log`, but the intended viewing page is a 0-byte file.
- **Technical Cause:** Pre-existing file loss, unrelated to any Repository 5 work.
- **Evidence:** Confirmed, multiple times, across this engagement.
- **Risk Level:** Medium-High (an observability gap, not a data-conflict one).
- **Implementation Complexity:** Unknown — depends entirely on whether the original page content is recoverable from any other source (e.g., the `farm-apk/www` mirror referenced in earlier engagements) or must be rebuilt.
- **Required Product Decision?** NO
- **Required Data Migration?** NO
- **Rollback Needed?** NO
- **Related Backlog Items:** None.

## BL-13 — Individual vs. Bulk Sale Convention Conflict — **CLOSED**
- Fully resolved in Priority 1 + its follow-up. Retained here for backlog completeness and cross-reference only. **Status: Done.**

## BL-14 — Birth Weight Orphaned Write (`weights` collection) — **CLOSED**
- Fully resolved in Priority 2. **Status: Done.**

## BL-15 — `feed_consumption`'s Fragile Name-Based Reference to `inventory_feeds`
- **Business Problem:** Renaming a feed item in Inventory orphans every historical consumption record's link to it.
- **Technical Cause:** `feed_consumption.feed_name` matches by string, not by document ID; `inventory_feeds.name` is confirmed freely editable.
- **Evidence:** Confirmed via direct code reading (Repository 4 Tightened Documentation pass).
- **Risk Level:** Medium
- **Implementation Complexity:** Medium — requires migrating existing records to an ID-based reference.
- **Required Product Decision?** NO
- **Required Data Migration?** YES
- **Rollback Needed?** NO
- **Related Backlog Items:** None.

## BL-16 — Mixed ID-Based vs. Name-Based Attribution Across Entities
- **Business Problem:** If a user's display name is later changed, historical records that stored their *name* (not ID) become disconnected from their current identity, while `daily_tasks.assigned_to` (ID-based) remains correctly linked.
- **Evidence:** Confirmed, `finance.added_by`/`breeding.added_by`/`production_log.recorded_by`/`weight_log.recorded_by` are name-based; `daily_tasks.assigned_to` is ID-based.
- **Risk Level:** Low
- **Implementation Complexity:** Medium-High — a broad, low-urgency standardization touching many files.
- **Required Product Decision?** NO — but low urgency, likely batched with other cleanup.
- **Required Data Migration?** YES, if standardized.
- **Related Backlog Items:** None.

## BL-17 — Vaccination `progress`/`status` Calculation Site Untraced
- **Status: NOT YET PROVEN.** Flagged during the Tightened Documentation pass; the exact computation was never located. Requires a dedicated investigation pass before it can be classified further.

## BL-18 — Two Independent Animal Export Implementations, Not Compared
- **Business Problem:** `animals.html` and `import.html` each have their own export function; whether they produce identical output for the same data was never verified.
- **Evidence:** Confirmed two implementations exist (Entry Point Census); confirmed `animals.html` links to `import.html` as "the full data engine," suggesting intentional, complementary design rather than accidental duplication — but field-for-field comparison was never performed.
- **Risk Level:** Low
- **Required Product Decision?** NO
- **Status:** **NOT YET PROVEN** whether any actual divergence exists — requires one dedicated comparison pass before further classification.

---

# PART B — EPICS

## Epic 1 — Canonical Birth Event
- **Purpose:** Make Birth behave as one coherent business event regardless of entry point.
- **Business Value:** Highest of any epic — Birth is how the herd registry grows; every downstream capability assumes that registry is accurate.
- **Contained Items:** BL-03, BL-04, BL-05, BL-06.
- **Dependencies:** BL-04 and BL-05 are blocked on Product Decisions.
- **Estimated Difficulty:** High overall (BL-06 specifically is High; BL-03 is Low).
- **Regression Surface:** Breeding page, Animals page, AI assistant, Dashboard's birth-registration entry point.
- **Recommended Order:** BL-03 first (clear bug, no decision needed) → BL-04/BL-05 (pending decisions) → BL-06 (hardening, benefits from the others being settled first).
- **Blocking Product Decisions:** "Should `markBorn` create animals?" "Should `add_birth` match the full canonical shape?"

## Epic 2 — Canonical Death Event
- **Purpose:** Ensure all four Death entry points behave identically.
- **Business Value:** High — Death is a core, frequent operation with direct Finance implications.
- **Contained Items:** BL-02.
- **Dependencies:** None.
- **Estimated Difficulty:** Low.
- **Regression Surface:** Animals page's bulk-death flow only.
- **Recommended Order:** Early — no blocking decisions, proven fix shape.
- **Blocking Product Decisions:** None.

## Epic 3 — Canonical Transfer Event
- **Purpose:** Same as Epic 2, for Transfer.
- **Contained Items:** BL-01.
- **Dependencies:** None.
- **Estimated Difficulty:** Low.
- **Recommended Order:** Early, alongside Epic 2 — identical fix shape, can be done together or in immediate sequence.
- **Blocking Product Decisions:** None.

## Epic 4 — Weight Pipeline
- **Purpose:** Ensure every weight-recording path produces consistent, correctly-linked history.
- **Contained Items:** BL-08, BL-09.
- **Dependencies:** BL-08 blocked on a Product Decision.
- **Estimated Difficulty:** Medium.
- **Regression Surface:** Production page, Animal Detail page.
- **Recommended Order:** BL-09 first (no decision needed, low risk); BL-08 once decided.
- **Blocking Product Decisions:** "Should Production-page weight entries create history?"

## Epic 5 — Undo Infrastructure
- **Purpose:** Decide the fate of the already-built-but-disconnected undo system.
- **Contained Items:** BL-07.
- **Dependencies:** A Product Decision; if approved, has natural synergy with Epic 12 (Data Integrity) via BL-06.
- **Estimated Difficulty:** Medium-High depending on connection scope.
- **Regression Surface:** Potentially the entire application if connected centrally.
- **Recommended Order:** After the Product Decision; if approved, sequence carefully given blast radius.
- **Blocking Product Decisions:** "Is this feature wanted, and at what scope?"

## Epic 6 — Notification Pipeline
- **Purpose:** Decide the fate of the Reserved, producer-less Notifications capability.
- **Contained Items:** BL-11.
- **Dependencies:** A Product Decision.
- **Estimated Difficulty:** Medium-High if building, trivial if accepting status quo.
- **Recommended Order:** Low urgency — no current user-facing gap.
- **Blocking Product Decisions:** "Build a producer, or accept the live-only design?"

## Epic 7 — Farm Settings
- **Purpose:** Resolve the confirmed multi-device inconsistency.
- **Contained Items:** BL-10.
- **Dependencies:** A Product Decision; broadest blast radius of any epic.
- **Estimated Difficulty:** High.
- **Recommended Order:** Late — highest regression surface, should follow proof that the smaller-blast-radius items' methodology (payload spying, live regression) scales cleanly.
- **Blocking Product Decisions:** "Migrate to Firebase?"

## Epic 8 — Activity Log
- **Purpose:** Restore observability into the universal audit trail.
- **Contained Items:** BL-12.
- **Dependencies:** None architecturally, though recoverability of the original page content is unknown.
- **Estimated Difficulty:** Unknown — **NOT YET PROVEN**.
- **Recommended Order:** Independent of the rest of this backlog; can proceed in parallel at any time.
- **Blocking Product Decisions:** None.

## Epic 9 — Animal State Consistency
- **Purpose:** Cover cross-cutting `animals` field-consistency issues not owned by a more specific epic.
- **Contained Items:** BL-15, BL-16.
- **Dependencies:** None blocking, both are standalone.
- **Estimated Difficulty:** Medium (BL-15), Medium-High (BL-16, broad but low urgency).
- **Recommended Order:** Low priority, batch with general maintenance.

## Epic 10 — Shared Business Operations
- **Purpose:** Umbrella for the pattern proven across BL-01/02/03 — modal field-reads must precede `closeModal()` universally, not just where already found.
- **Contained Items:** BL-01, BL-02, BL-03 (cross-referenced; not duplicated as separate epic items).
- **Dependencies:** None.
- **Estimated Difficulty:** Low per-instance; consider a one-time repository-wide audit for any *other*, not-yet-found instance of this same pattern before declaring this epic complete.
- **Recommended Order:** Early — high-confidence, low-risk fixes.

## Epic 11 — Bulk Operations
- **Purpose:** Umbrella for `animals.html`'s `execBulk`/`execBulkDo` architecture generally.
- **Contained Items:** BL-01, BL-02 (cross-referenced).
- **Dependencies:** Builds on the already-completed Repository 4 refactor (performBulkX extraction).
- **Estimated Difficulty:** Low, given the extraction work already done makes these fixes single-function, isolated changes.

## Epic 12 — Data Integrity
- **Purpose:** The overarching theme — rollback, idempotency, orphan detection.
- **Contained Items:** BL-06, BL-07 (as enabling infrastructure), BL-17, BL-18 (both still needing evidence).
- **Dependencies:** BL-07's Product Decision has direct synergy with BL-06's implementation approach.
- **Estimated Difficulty:** High.
- **Recommended Order:** Last major epic — benefits from every other canonicalization effort being settled first, so hardening isn't built against a moving target.

---

# PART C — IMPLEMENTATION WAVES

## Wave 1 — Safe, Proven-Shape Fixes
**Contains:** BL-01, BL-02, BL-03.
**Why it exists:** All three share an identical, already-proven fix shape (reorder field reads before `closeModal()`), with zero open product questions.
**Why it comes first:** Lowest risk, highest confidence, immediately actionable — no reason to wait.
**Expected Regression Surface:** Narrow, isolated to each specific bulk/direct-birth modal.
**Required Verification:** Live payload-spy testing per item, identical methodology to Priority 1's Sale fix.

## Wave 2 — Weight Pipeline Cleanup
**Contains:** BL-09 (no decision needed) now; BL-08 once decided.
**Why it exists:** Closes the remaining gaps in the weight-recording story after Priority 2's orphaned-write fix.
**Why it comes after Wave 1:** No hard dependency, but keeps momentum on already-familiar territory (weight_log) before shifting focus.
**Expected Regression Surface:** Animal Detail, Production pages.
**Required Verification:** Same live-test methodology already established for weight_log in Priority 2.

## Wave 3 — Product Decisions
**Contains:** No code — this wave is the explicit checkpoint for resolving BL-04, BL-05, BL-08 (if not already decided in Wave 2), BL-07, BL-10, BL-11.
**Why it exists:** This backlog cannot responsibly proceed further into Birth's remaining gaps, Undo, Settings, or Notifications without these decisions — implementing any of them on an assumption would violate this entire engagement's own evidence-first methodology.
**Why it comes before Wave 4:** Everything in Wave 4 depends on at least one of these decisions.
**Expected Regression Surface:** None — this is a decision-making wave, not an implementation wave.
**Required Verification:** N/A.

## Wave 4 — Birth Canonicalization (post-decision)
**Contains:** BL-04, BL-05, and BL-06's design (informed by whatever BL-04/05 decide).
**Why it comes after Wave 3:** Directly blocked on those decisions.
**Expected Regression Surface:** Breeding page, AI assistant, `shared.js`'s canonical path itself.
**Required Verification:** Full Birth-event regression suite, re-running this Repository's own live-test methodology across all entry points.

## Wave 5 — Data Integrity Hardening
**Contains:** BL-06 (implementation), BL-07 (if approved in Wave 3).
**Why it comes after Wave 4:** Hardening the Birth write sequence against partial failure is most valuable once the sequence itself (which entry points do what) is settled — otherwise this work risks being redone.
**Expected Regression Surface:** High if BL-07 is connected centrally; contained to `shared.js` if BL-06 alone.
**Required Verification:** Repeat this Repository's own failure-injection methodology; if BL-07 is connected, an additional full-application smoke test.

## Wave 6 — Farm Settings Migration (if approved)
**Contains:** BL-10.
**Why it comes late:** Broadest blast radius of anything in this backlog; benefits from every other wave's verification methodology being well-proven first.
**Expected Regression Surface:** Every page in the application.
**Required Verification:** Full-app smoke test, explicit multi-device test.

## Wave 7 — Remaining Technical Debt
**Contains:** BL-11 (if approved), BL-12, BL-15, BL-16, BL-17, BL-18 (once evidenced).
**Why it comes last:** Lowest urgency items, or items still needing evidence before they can even be scheduled with confidence.
**Expected Regression Surface:** Varies per item, generally low.
**Required Verification:** Per-item, standard regression methodology already established.

---

# PART D — FINAL ROADMAP

**Implementation Order:** Wave 1 → Wave 2 → Wave 3 (decisions) → Wave 4 → Wave 5 → Wave 6 (if approved) → Wave 7.

**Critical Path:** BL-06 (Birth rollback hardening) is the single most consequential unresolved technical item — it depends on Waves 1 and 4 being settled first, making it the longest dependency chain in this backlog.

**Parallelizable Work:** BL-12 (Activity Log restoration) has zero dependency on anything else and can proceed at any point, in parallel with any wave. BL-15/BL-16 are similarly independent.

**Product Decisions Still Required:** "Should `markBorn` create animals?" · "Should `add_birth` match canonical shape?" · "Should Production-page weight entries create history?" · "Should Undo be connected, and at what scope?" · "Should Farm Settings move to Firebase?" · "Should Notifications get a real producer?"

**Engineering Decisions Still Required:** The specific repair strategy for BL-06 (verification-and-repair after the fact vs. restructuring the write sequence itself) is an engineering choice not yet made, separate from any product question.

**Migration Tasks:** BL-03 (orphaned quick-birth records), BL-04 (if approved), BL-10 (if approved), BL-15.

**Regression Strategy:** Every item in this backlog should be verified using the same methodology already proven across this entire engagement — live browser execution with payload/call spying, not static reasoning alone, per this Repository's own Rule #2.

**Merge Strategy:** One backlog item, one commit, one live verification, one stop — consistent with every phase of this engagement to date. No two items should be merged into a single change, even when related (e.g., BL-01 and BL-02 share a root cause but remain separate items with separate verification).

---

# Repository 5 — Official Engineering Backlog
**This document becomes the reference for every future implementation task. Future implementation prompts must reference this backlog instead of rediscovering architecture.**

**No code was modified. No implementation was performed to produce this document.**
