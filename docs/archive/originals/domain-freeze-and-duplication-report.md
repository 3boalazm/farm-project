# Repository 4 — Domain Freeze: Product Decisions & Business Rule Duplication Report
**Status: Planning and documentation only. No code modified.**

---

## Decision 1 — Canonical Sale Status

### Option A: `status = "sold"`
**Advantages:**
- Semantically precise — a sold animal left the farm alive, to a new owner; conflating this with "dead" (which died on the farm) is a real domain-modeling distinction, not just cosmetic.
- **Already the convention the rest of the application is built around** — confirmed directly: `animals.html`'s own status-filter dropdown has two entirely separate options, `<option value="sold">المباع</option>` and `<option value="dead">نافق</option>`. This is the application's own primary filtering UI, and it already expects `'sold'` to be a real, distinct, filterable value.
- Matches the individual `submitSold()` implementation, which is the richer, more field-complete implementation of the two (carries `sold_date`, `sold_price`, `sold_to`, `sold_notes`, `sold_phone` — a fuller sale record).

**Disadvantages:**
- Requires touching every piece of logic that currently only checks `status !== 'alive'` (a "no longer in the herd" shorthand) to make sure it also correctly includes `'sold'`, not just `'dead'` — a broader propagation surface than a narrower fix.

### Option B: `status = "dead"` + `removal_reason = "sale"`
**Advantages:**
- A simpler top-level status enum (three terminal states collapse to two: `alive` and `dead`, with a reason sub-classifier) — fewer values for any future code to special-case.

**Disadvantages:**
- **Confirmed to actively break the application's own existing UI today** — any animal sold via the bulk path is invisible under the "المباع" (Sold) filter and incorrectly appears under "نافق" (Dead) instead, a real, live, user-facing bug, not a theoretical risk.
- Contradicts the richer, pre-existing individual-sale data model (no `sold_price`/`sold_to`/`sold_phone` equivalent fields are used in this convention).

### Recommendation
**Option A (`status = "sold"`) aligns with the existing domain model; Option B does not.** This isn't a close call — the application's own filter UI is direct, confirmed evidence of which convention the system was actually designed around. The bulk-sell path's `status:'dead'` convention is the outlier that diverged from an already-established pattern, not a competing valid design. **This is stated as a recommendation, grounded in direct evidence, not an implementation — no code has been changed.**

---

## Decision 2 — Farm Settings: Local-Only vs. Firebase-Synchronized

**Confirmed infrastructure context first:** this project has real, working PWA/offline infrastructure — `sw.js`, `manifest.json`, `offline-sync.js` all exist and are active (confirmed present and non-trivial in size). `getSettings()`/`saveSettings()` currently have **zero interaction** with this layer — they are pure `localStorage`, entirely outside the offline-sync write-queue system that other Firebase writes presumably pass through.

| Dimension | Stay Local-Only | Become Firebase-Synchronized |
|---|---|---|
| **Offline behavior** | Perfect, trivially — no network dependency at all, ever, by construction | Requires integrating with the existing `offline-sync.js` write-queue (already built for other entities) to preserve the same offline guarantee — real but bounded work, since the pattern already exists elsewhere in this codebase and wouldn't need to be invented from scratch |
| **Multi-device consistency** | **Confirmed broken today** — each device/browser has its own independent copy; a farm name or logo change on one device is invisible on another | Would be genuinely fixed — this is the entire point of the change |
| **Migration complexity** | None (status quo) | Real, but bounded: existing `localStorage['farm_settings']` values would need a one-time upload-if-Firebase-is-empty reconciliation per device, to avoid silently discarding whatever a farm has already configured locally |
| **Backward compatibility** | Trivial (nothing changes) | `getSettings()`'s existing `cfg||saved||default` fallback chain (confirmed in `firebase.js`) already has the right *shape* for adding a Firebase-sourced layer as a new priority level without breaking either `window.FARM_CONFIG` or the `localStorage` fallback — the existing code's structure is already hospitable to this change, not hostile to it |

### Recommendation
Given the project already has the offline-write-queue infrastructure this change would need, and given the multi-device inconsistency is a confirmed, real gap (not theoretical) — **moving to Firebase-backed settings is the direction that better serves this audit's own core principle**, but it is explicitly **your call**, not a technical inevitability: if this farm is genuinely single-device in practice, the local-only status quo has zero real downside today. **No implementation has been performed either way.**

---

## Decision 3 — Business Rule Duplication Report

**Methodology note:** beyond the two duplications already confirmed in prior passes (Sale, Transfer), this pass specifically searched for every other named business rule from your list, rather than assuming the inventory was already complete. **Two additional, previously-undocumented duplications were found this pass: Death (four independent implementations, not the two previously known) and Birth (two independent implementations, not the one previously assumed).**

| Business Rule | Files Involved | Functions Involved | Identical or Diverged? | Risk | Recommendation |
|---|---|---|---|---|---|
| **Sale** | `animals.html` (×2) | `submitSold()` (individual), `performBulkSell()` (bulk) | **Diverged** — different `status` value, different field names (`sold_date` vs `sold_at`), confirmed in prior passes | **Critical** | Reconcile to one convention (Decision 1, above) before any further sale-related work |
| **Transfer (barn reassignment)** | `animals.html`, `barns.html` | `performBulkTransfer()`, `submitTransfer()` | **Diverged** — confirmed this pass: `barns.html`'s version correctly reads its fields before closing its modal; `animals.html`'s version reads them after, producing an empty, no-op patch | **High** — a confirmed, reproducible functional bug in one of the two implementations | Consolidate to one shared implementation, or at minimum apply the same field-read-ordering fix independently to both |
| **Death (individual)** | `animals.html`, `dead.html` | `submitDeath()`, `submitDeathSingle()` (both in `animals.html`), `submitDead()` (`dead.html`) | **Not fully compared field-by-field this pass** — `dead.html`'s version is structurally very close to `animals.html`'s (same field set, minus the batch-specific field, which correctly doesn't apply to an individual entry) and, notably, **correctly reads its fields before `closeModal()`**, avoiding the bug pattern found in the bulk-transfer/bulk-sell paths | **Medium** — three independent implementations of "record one animal's death" is real duplication risk even where no divergence was found yet; a future fix to one (e.g., adding a new field) has no mechanism to propagate to the other two | Worth consolidating regardless of the fact that no functional divergence was found this pass — three copies of the same logic is inherently fragile, evidenced by Transfer's identical structural pattern already having diverged |
| **Death (bulk)** | `animals.html` | `performBulkDeath()` | N/A — the one confirmed bulk implementation | **Confirmed affected** by the same `closeModal()`-before-read bug already documented for bulk transfer/sell (same root cause, same file, same `execBulk()` dispatch structure) | Already scoped as a known, ranked finding from the prior Integrity Violations pass |
| **Birth** | `shared.js`, `pages/breeding.js` | `_ubSubmit()` ("unified birth"), `submitBirthDirect()` ("quick/direct birth") | **Not fully compared field-by-field this pass** — both confirmed to perform the same two-part operation (create/update a `breeding` record, then create `animals` records for each offspring in a loop), independently implemented | **High** — this is the same *shape* of risk as the Sale duplication (two independently-built paths for the same core lifecycle event: adding new animals to the herd via birth), and Sale's duplication already proved that shape of risk becomes real divergence in practice | Compare field-by-field before deciding whether to consolidate or explicitly document why two entry points are intentional (e.g., one for tracked pregnancies, one for direct/retroactive entry) |
| **Vaccination** | `pages/vaccine.js`, `assistant.html` | (primary vaccine-page function), (AI-assistant's structured-write capability) | **Not compared this pass** — `assistant.html`'s write is very likely a generic "the AI assistant can create a structured record based on a natural-language request" capability rather than a second, independently-hand-built implementation of vaccination-specific business logic | **Low** (provisional) — this looks categorically different from the other duplications (a generic tool vs. a hand-duplicated feature), but wasn't independently confirmed this pass, so the Low rating is provisional, not certain |
| **Weight logging** | `shared.js`, `pages/animal_detail.js` | `_ubSubmit()` (birth-weight capture, writes to `weights`), `submitWeight()` (ongoing entries, writes to `weight_log`) | **Confirmed diverged in the most consequential way possible** — different target collections entirely, one of which (`weights`) has zero readers | **Critical** — already the top-ranked finding from the prior Integrity Violations pass; restated here specifically as a *duplicated business rule* ("record an animal's weight"), since that framing is exactly why it happened: two people/moments built "record a weight" without reusing each other's implementation | Same recommendation as before: decide whether birth weight should simply write to `weight_log` instead |
| **Finance** | 6 files, 11 call sites | (see prior Dependency Graph phase for the full list) | **Not a case of duplicated business *logic*** — investigated specifically for this report: the 11 sites represent genuinely different finance-entry *types* (sale income, death-related loss, manual entry, AI-assistant entry) that all legitimately write to the same collection, rather than the same conceptual operation being rebuilt repeatedly | **Low** — wide fan-out is a real fact worth knowing, but it is not, on inspection, the same failure pattern as Sale/Transfer/Birth/Weight above | No consolidation recommended; this is legitimately many different real-world events sharing one ledger, which is correct design, not duplication |
| **Archive / Restore** | `dead.html` | A single "restore" radio-button option inside `dead.html`'s reset tool (reverting an animal from `dead` back to `alive`) | **Not duplicated — only one implementation found** | **Informational** | Searched specifically for this pass; no broader archive/restore business concept exists elsewhere in the application to compare against |

### Summary
**Four genuine business-rule duplications confirmed as real risk, ranked by how consequential the shape of the risk is:** Weight logging and Sale (Critical — both already proven to produce silently wrong/lost data), Transfer and Birth (High — Transfer already proven to fail in practice; Birth carries the identical structural shape of risk, not yet independently proven divergent but sharing the exact pattern that made the other three real). Death is a confirmed **triplication** (not previously known to be more than a duplication) that hasn't yet been proven to have diverged, but whose sheer structural repetition — the same pattern already responsible for every other confirmed divergence in this report — makes it worth including at Medium risk rather than dismissing as fine simply because no difference was found this pass. Finance and Vaccination were investigated and **found not to be genuine duplications** on closer inspection. Archive/Restore does not exist as a broader duplicated concept.

---

## Implementation Order (per your stated sequence — not begun)

1. **Freeze domain decisions** — Decision 1 and Decision 2 above are now documented with evidence-based recommendations; final call remains yours.
2. **Eliminate duplicated business rules** — per the table above, in roughly this priority: Weight logging → Sale → Transfer → Birth → Death (triplication) → (Vaccination, if the provisional Low rating doesn't hold up under closer inspection).
3. **Refactor to a single source of truth** — follows from #2, entity by entity.
4. **Regression verification after every change** — the same live-browser, payload-spy methodology already proven across every prior phase of this engagement.

**No implementation has begun. Waiting for your decisions on Decision 1 and Decision 2, and your direction on which duplication to address first once those are settled.**
