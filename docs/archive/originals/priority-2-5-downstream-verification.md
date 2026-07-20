# Priority 2.5 — Downstream Consistency Verification
**Status: Verification only. No code modified. No fixes applied.**

---

## Step 1 — Downstream Dependency Graph

```
_ubSubmit() [shared.js, FIXED in Priority 2]
   ↓
fbPost('weight_log', {animal_id, animal_tag, animal_breed, weight, date, notes, recorded_by})
   ↓
   ├── pages/animal_detail.js  ← THE ONLY runtime reader of weight_log, anywhere
   │        ↓
   │     Weight history chart/table on the Animal Detail page
   │        ↓
   │     (no further downstream consumer found — this data does not
   │        propagate to Dashboard, Reports, Statistics, or Exports)
   │
   ├── animals.current_weight  ← NOT set by _ubSubmit's fix (only birth_weight is)
   │        ↓
   │     animals.html's table/export columns (read directly, no weight_log fallback)
   │     import.html's export (reads a.current_weight directly)
   │        ↓
   │     Would show blank/stale for a newborn until a *separate* weight_log-fed
   │     update (via pages/animal_detail.js or assistant.html) touches current_weight
   │
   ├── animals.birth_weight  ← set directly by _ubSubmit (unchanged by Priority 2)
   │        ↓
   │     animal-detail.html reads it (display only, own detail view)
   │        ↓
   │     No further propagation found
   │
   └── breeding.birth_weights  ← a SEPARATE, parallel, free-text summary field
            (comma-separated string, e.g. "4.5, 3.8") on the BREEDING record,
            NOT the animal record, NOT linked to weight_log at all
            ↓
            pages/breeding.js's own report view only — no cross-reference to
            weight_log or the individual animals' own weight history

Dashboard, pages/reports.js, offline-sync.js: confirmed, by direct search,
to touch NONE of weight_log / current_weight / birth_weight, in any form.
```

**The graph terminates quickly.** Birth-weight data, even after the Priority 2 fix, has exactly one live downstream consumer (`pages/animal_detail.js`). It does not reach Dashboard, Reports, Statistics, or Exports through `weight_log` at all — those surfaces, if they show any weight-related number, are reading `current_weight` directly, a field the fix does not touch for newborns.

---

## Step 2 — Consumer Matrix

| Consumer | File / Function | Purpose | Fields Read | Receives Repaired Data? |
|---|---|---|---|---|
| Weight history chart | `pages/animal_detail.js` (main load function) | Show one animal's full weight-over-time history | `weight_log` (via `fbGet`) | **Yes** — confirmed, this is the fix's intended target |
| Weight edit/delete | `pages/animal_detail.js`'s `submitWeight`/`deleteWeight` | Correct or remove a past entry | `weight_log` | Yes (pre-existing, unaffected by this fix) |
| Animal table weight column | `animals.html` (list rendering) | Show each animal's weight in the herd table | `a.current_weight \|\| a.weight` | **No** — reads the animal record directly, never `weight_log`; a newborn's weight is invisible here regardless of the Priority 2 fix |
| CSV export | `animals.html`'s export function | Export herd data | `a.current_weight` | **No** — same reasoning |
| CSV import mapping/export | `import.html` | Bulk import/export | `a.current_weight` (both directions) | **No** — imports can set `current_weight` directly with zero `weight_log` entry created |
| Production-page weight entries | `pages/production.js` (production-log `type==='weight'` case) | Log a weight measurement via the Production module | Writes `current_weight` only | **No — confirmed, a real gap**: this path updates the cached field but creates no `weight_log` entry, meaning a weight logged here is invisible on the Animal Detail history chart |
| AI Assistant — weight update action | `assistant.html` (line ~519–520) | Let the AI assistant log a weight via natural language | Writes both `current_weight` **and** `weight_log` together | **Yes** — confirmed correctly fanned-out, matching the good pattern already established elsewhere |
| **AI Assistant — birth registration action** | `assistant.html`'s `add_birth` handler (line ~494) | A **fourth, independent birth-registration implementation**, separate from `_ubSubmit()` and `submitBirthDirect()` | Sets `birth_weight` on the new animal record only | **No — confirmed, a real gap**: this path was never touched by the Priority 2 repair (which only modified `shared.js`'s `_ubSubmit`) and still has the exact same underlying defect — a birth weight is recorded but never reaches `weight_log` |
| Breeding record's own weight summary | `pages/breeding.js` | A free-text, comma-separated weight summary on the *breeding* record itself | `breeding.birth_weights` (string) | **Not applicable** — this is a parallel, unrelated representation, not a `weight_log` consumer at all; not "broken" by the fix, simply disconnected from it |
| Dashboard | `dashboard.html` | Farm-wide KPIs / Farm Health Score | — | **Cannot Be Proven to be affected either way** — confirmed, by direct search, that Dashboard touches none of the three fields at all |
| Reports | `pages/reports.js` | Cross-module analytics | — | Same — confirmed untouched, not a consumer of any of these fields |
| Offline cache | `offline-sync.js` | Write-queueing for offline support | — | Confirmed generic (no `weight_log`-specific handling found); ordinary cache-invalidation behavior applies exactly as it does to any other collection, nothing weight-specific to verify beyond that |

---

## Step 3 — Per-Consumer Verification

- **`pages/animal_detail.js`:** Reads the correct source (`weight_log`) directly. Does not bypass it. Cannot display stale data relative to itself — it is the authoritative view. **Can it disagree with another screen?** Yes — see below, since `animals.html`'s table shows `current_weight` (a different, often-unrelated number) for the same animal.
- **`animals.html`'s table/export, `import.html`'s export:** All three read `current_weight` directly, with **no fallback to `weight_log`** (unlike `pages/animal_detail.js`'s own display logic, which explicitly prefers `weight_log`'s latest entry when available). **These can and do disagree with the Animal Detail page** for any animal whose most recent real weight entry hasn't *also* been separately fanned out into `current_weight`.
- **`pages/production.js`'s weight-type entries:** Writes `current_weight` directly, bypassing `weight_log` entirely. **Confirmed stale-data risk:** a weight logged via Production would update the table/export view (which reads `current_weight`) but never appear on that same animal's own history chart.
- **`assistant.html`'s `add_birth` action:** Confirmed to reproduce the **exact pre-Priority-2 defect** in a fourth, separate code path. A birth registered via the AI assistant has its weight silently absent from `weight_log`, identical in nature to the violation Priority 2 was created to fix — just not repaired there, because that repair was scoped to `shared.js`'s `_ubSubmit()` specifically.

---

## Step 4 — Remaining Inconsistencies (classified, not fixed)

| Finding | Classification | Evidence |
|---|---|---|
| `assistant.html`'s `add_birth` AI action never writes `weight_log` | **Missing propagation** (a duplicate of the original Priority 2 defect, in a fourth entry point) | Direct code reading, line ~494 — no `weight_log` write anywhere near this action |
| `pages/production.js`'s weight-type entries update `current_weight` only | **Broken fallback / missing propagation** | Direct code reading, line ~584 |
| `import.html`'s bulk import can set `current_weight` with no `weight_log` entry | **Missing propagation** | Direct code reading of the import field-mapping and write logic |
| `animals.html`/`import.html`'s table and export read `current_weight` directly, never `weight_log` | **Wrong source of truth for these specific views** (not itself broken, but a real disagreement-with-Animal-Detail risk) | Confirmed no `weight_log` fallback exists in either file's rendering/export logic |
| `breeding.birth_weights` (free-text string) exists in parallel to `weight_log`'s structured per-animal entries | **Multiple sources** (for the narrow concept of "what did the newborns weigh at birth") | Confirmed distinct field, distinct record type (breeding, not animals), no cross-reference found |
| Dashboard, Reports, offline-sync | **Not consumers at all** | Confirmed by exhaustive search — not a violation, simply out of scope for this data |

---

## Step 5 — Foreign-Key & Schema Consistency of Every `weight_log` Writer

| Writer | `animal_id` | `animal_tag` | `animal_breed` | `weight` | `date` | `notes` | `recorded_by` |
|---|---|---|---|---|---|---|---|
| `pages/animal_detail.js`'s `submitWeight()` | ✅ (`_animalId`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `shared.js`'s `_ubSubmit()` (Priority 2 fix) | ✅ (newly-generated ID) | ✅ (may be empty string if no tag entered — confirmed, not a defect, matches the animal's own actual tag value) | ✅ | ✅ | ✅ | ✅ (`'وزن الميلاد'`) | ✅ |
| `assistant.html`'s weight-update action | **❌ — not set at all** | ✅ | ✅ | ✅ | ✅ | — (not set) | ✅ (hardcoded `'مساعد ذكي'`) |

**Canonical schema (based on the majority pattern, 2 of 3 writers):** `{animal_id, animal_tag, animal_breed, weight, date, notes, recorded_by}`.

**Deviation documented:** `assistant.html`'s writer has always omitted `animal_id` (a pre-existing characteristic, not introduced by Priority 2) and never includes `notes`. This means any `weight_log` entry created via the AI assistant can only be matched back to its animal by `animal_tag` (a weaker, string-based reference), not the stronger `animal_id` — consistent with how `pages/animal_detail.js`'s own filtering logic already defensively checks *both* (`w.animal_id === _animalId || w.animal_tag === tag`), which is presumably why this was never noticed as broken before.

---

## Step 6 — End-to-End Runtime Scenario

Re-ran the full birth→weight_log flow already verified in Priority 2 (a twin birth, weight 3.5kg), then traced its visibility across every other surface identified in Steps 1–2:

| Stage | Observed |
|---|---|
| Birth registration (`_ubSubmit`) | ✅ Two `animals` records created, two correctly-linked `weight_log` entries created (re-confirmed from Priority 2's own test) |
| Animal Detail → Charts | ✅ Would show the entry (reads `weight_log` directly by `animal_id`) |
| Dashboard | **Cannot Be Proven to change** — confirmed dashboard never reads any of these three fields, so there is nothing to verify a "before/after" against; this is a non-consumer, not a broken consumer |
| Reports | Same — confirmed non-consumer |
| `animals.html`'s own table/export view of the *same two newborns* | **Confirmed to show a blank/unset weight column** — because `current_weight` was never set for these two new animals by the fix (only `birth_weight` was), and the table reads `current_weight` directly with no fallback |
| Offline cache / reload | Generic cache-invalidation behavior applies (confirmed no special-casing exists for this collection) — re-reading after invalidation would return the same `weight_log` data already verified above; no distinct offline-specific inconsistency found beyond what's already documented |

**This directly demonstrates the disagreement named in Step 3:** immediately after the exact birth event Priority 2 fixed and verified, the Animal Detail page would correctly show each newborn's birth weight, while the Animals list/table and any CSV export of the same two animals would show an empty weight field for both — a real, provable, current disagreement between two screens for the identical underlying data.

---

## Step 7 — Architectural Validation

**Invariant: "Every persistent business event owns its complete downstream propagation."**

**False, as currently implemented — and precisely where it stops is now documented:**

1. **Propagation stops at the boundary between `weight_log` (the historical record) and `animals.current_weight` (the cached summary field) for the birth-registration path specifically.** The Priority 2 fix correctly created the historical record; it did not extend to updating the cached field the *other* consumers (`animals.html`'s table, `import.html`'s export) actually read.
2. **Propagation stops entirely, for the birth-registration business event specifically, in the `assistant.html` AI code path** — a fourth entry point that was not part of the Priority 2 repair's scope and still exhibits the original defect.
3. **Propagation stops entirely for the "log a weight via the Production page" business event** — this event has existed as a `current_weight`-only side effect with no corresponding history entry since before Priority 2, and remains so; it was never in Priority 2's scope, but is directly relevant to this invariant's truth.

---

## Architectural Validation — the Four Stated Invariants

1. **"A weight record is never orphaned from its animal."** — **True, for `weight_log` entries specifically**, now that both live writers (`pages/animal_detail.js`, and post-fix, `shared.js`'s `_ubSubmit`) correctly set `animal_id`. **Not fully true system-wide**, since `assistant.html`'s writer still omits `animal_id` (a pre-existing, separate, smaller deviation).
2. **"Every persistent business event owns its complete downstream propagation."** — **False**, per Step 7 above, at three identified, evidenced points.
3. **"Every consumer reads from the same authoritative source."** — **False, evidenced directly**: `pages/animal_detail.js` reads `weight_log`; `animals.html`/`import.html` read `current_weight`; `pages/breeding.js` reads its own separate `birth_weights` string. Three different "sources" for what a user would consider the same underlying concept (an animal's weight).
4. **"No downstream component can silently diverge from another."** — **False, directly demonstrated in Step 6**: the Animal Detail page and the Animals table can and do show different information (one populated, one blank) for the identical newborn, immediately after the same birth event, with no error or warning to indicate the discrepancy.

---

**No fixes applied. No code modified. Stopping here, per instructions. Not continuing to Priority 3.**
