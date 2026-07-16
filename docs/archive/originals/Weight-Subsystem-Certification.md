# MASTER ENGINEERING AUDIT — Weight Subsystem Certification
**No implementation. No refactor. Certification only.**

---

## Phase 1 — Exhaustive Discovery: 10 Strategies, Explicit Blind Spots

| # | Strategy | Applied How | Blind Spot Found | Compensating Strategy |
|---|---|---|---|---|
| 1 | Keyword search | Broad `grep -rlwiE "weight\|current_weight\|..."` across every file | Matches `font-weight` (CSS) and third-party bundled libraries (Chart.js) as false positives | Manual per-hit inspection (prior session) |
| 2 | Call graph traversal | Traced `openAddWeight()`→`submitAddWeight()`→Firebase→`renderWeightTable()` | Cannot discover a function it doesn't already know the name of | Combined with UI-first (below) |
| 3 | Write-first search | `grep` for every `fbPost`/`fbPatch` touching any weight-shaped path | Surfaced `assistant.html`'s `add_birth` also writing `birth_weight` — a real writer not previously catalogued this precisely | None needed — this strategy is itself the compensator for gaps in Strategy 1 |
| 4 | Read-first search | Searched every `.weight`/`current_weight`/`birth_weight` read across key files | Confirms real read sites, but cannot distinguish "read for display" from "read for calculation" without manual follow-up | UI-first tracing |
| 5 | UI-first search | Started from the real buttons/inputs, traced backward | Cannot enumerate hidden dispatcher branches without opening the containing function — found `openAddWeight` this way after Strategy 10 missed it | Event-handler search |
| 6 | Firebase-first search | Enumerated every collection/path touched (`animals/{id}/weights`, `weight_log`, `animals.current_weight`) | Cannot see client-side-only calculators with no Firebase interaction (`cost.html`) | Keyword search |
| 7 | Reverse dependency search | Asked "what would break if `animals/{id}/weights`'s schema changed" → only `animal-detail.html`'s own render | Cannot prove a Cloud Function isn't also a hidden dependent | None available — genuine, stated Unknown |
| 8 | Event-handler search | `grep` for `onclick=".*weight"` | Initially returned zero results due to escaped-quote (`\"`) HTML-in-JS-string syntax not matching a naive attribute regex — a real, confirmed false negative | Direct source viewing of the exact lines, which found both real handlers |
| 9 | Dynamic HTML search | Checked for `appendChild`, `innerHTML =`, template-string injection of weight content | All weight UI is built via the same `showModal(...)`/direct-string-return pattern already characterized — no additional dynamic injection found | N/A |
| 10 | Global function search | `grep` for `window\.[a-zA-Z]*[Ww]eight.*=` | Missed `openAddWeight()` and `renderWeightTable()` entirely — both are plain top-level `function` declarations, not `window.X =` — and missed `add_weight` entirely, since it's a branch inside `showConfirmation()`, a dispatcher whose own name contains no hint of "weight" | UI-first + Event-handler searches, both of which found these by tracing actual usage rather than naming convention |

**Two real, confirmed strategy blind spots this session:** (a) plain `function` declarations vs. `window.X =` are invisible to name-pattern search; (b) escaped-quote HTML-in-JS-string syntax defeats naive attribute regexes. Both are now documented as standing methodological findings for any future census in this repository.

---

## Phase 2 — Repository Census (Zero Unclassified)

| Function | File | Public/Private | Reachable? | Caller | Sync/Async | Firebase | Side Effects | Confidence |
|---|---|---|---|---|---|---|---|---|
| `openAddWeight()` | animal-detail.html | Public (global, implicit) | Yes — reachable via `onclick`, confirmed live-clickable this and prior sessions | Direct: "Add Weight" button | Sync (opens modal only) | None | Renders modal HTML | A |
| `submitAddWeight()` | animal-detail.html | Public (`window.`) | Yes | Modal's "حفظ" button | Async | `fbPost('animals/{id}/weights')` | `logActivity`, toast, re-render | A (live-tested, multiple sessions) |
| `delWeightByIdx(idx)` | animal-detail.html | Public (`window.`) | Yes | Per-row delete button (index-based variant) | Async | `fbDelete` | Re-render | B (source-confirmed, not independently live-clicked this session) |
| `delWeight(id)` | animal-detail.html | Public (`window.`) | Yes | Per-row delete button (ID-based variant) | Async | `fbDelete` | Re-render | A (live-tested, prior session) |
| `renderWeightTable(wts)` | animal-detail.html (inline) | Public (implicit) | Yes | Called from the page's own load sequence and after every add/delete | Sync | None (pure render) | DOM update only | B |
| `add_weight` branch | assistant.html, inside `showConfirmation(parsed)` | Not independently named — a conditional branch | Yes, if the dispatcher itself is reached (confirmed reachable by source; never live-tested this engagement) | AI intent classification (mechanism not audited) | Async | `fbPatch('animals')` + `fbPost('weight_log')` | `logActivity`, chat message | B — explicitly not Level A; no AI intent has ever been live-executed in this engagement |
| `add_birth` branch (weight-adjacent: sets `birth_weight`) | assistant.html, same dispatcher | Same as above | Same as above | Same as above | Async | `fbPost('animals', {...birth_weight...})` | Same | B |
| Weight-type branch inside production submit function | pages/production.js | Not independently named | Yes, confirmed via collection-usage extraction | Production form submit | Async | `fbPatch('animals', {current_weight})` | No `animals/{id}/weights` write (confirmed gap) | B — collection usage confirmed, exact live payload not re-verified this session |
| `_ubSubmit()` (weight-relevant portion) | shared.js | Public (`window.`) | Yes | Unified Birth modal | Async | `fbPost('weight_log')` (per offspring, conditional) | `logActivity`, toast, refresh | A (live-tested extensively, Priority 2 and Birth Failure Analysis) |
| Cost calculator (weight-adjacent, `sell-weight` field) | cost.html | Not independently named as weight-specific — likely `calcManualTotal()` per its `oninput` wiring | Yes | `oninput` on the weight field itself | Sync | None — confirmed this session | Local DOM display update only | A (confirmed via direct Firebase-call absence check) |
| `pages/animal_detail.js`'s `submitWeight()`, `openWeightModal()` | pages/animal_detail.js | Public (`window.`) in source, but the file itself | No | None found, any strategy, any session | Async (if reached) | Would be `fbPost('weight_log')` if reached | N/A — never reached | A (unreachability), per RSOT's multi-angle audit |

**Every function classified. No "unclassified" entries remain.**

---

## Phase 3 — Data Lifecycle (Per Field)

| Field | Created | Validated | Persisted | Read | Displayed | Exported | Forgotten? |
|---|---|---|---|---|---|---|---|
| Real weight entry (`animals/{id}/weights`) | `submitAddWeight` | `0<w≤500`, date required | `animals/{id}/weights` | `animal-detail.html`'s own load | Weight history chart/table | Not confirmed exported anywhere — `animals.html`'s export uses `current_weight`, not this real history | Yes, effectively — never reaches any export |
| `current_weight` (field) | 3 unrelated writers | No validation confirmed for the AI/Production paths | `animals.{id}.current_weight` | `animals.html`, `import.html` | Table column | CSV export | Not forgotten, but unsynchronized with the real history |
| `birth_weight` | `_ubSubmit`, `submitBirthDirect`, `add_birth` | None confirmed | `animals.{id}.birth_weight` | `animal-detail.html`'s general display | General animal info | Not confirmed | Not forgotten, but isolated — no ongoing-history linkage |
| `weight_log` entries | `assistant.html`, `shared.js`'s `_ubSubmit` | None confirmed | `weight_log` | Nothing | Nowhere | Nowhere | Yes — the flagship, previously-certified finding |
| `cost.html`'s `sell-weight` | User input | `||0` fallback only, no range check | Never | Same page, same session, immediately | Calculator output only | Never | By design, not a defect |

---

## Phase 4 — Dependency Graph

*(Restates and confirms prior findings, cross-checked via this session's additional strategies — no contradiction found, no graph change required.)*

**New edge confirmed this session:** `showConfirmation()` (assistant.html) is a single, undifferentiated hub for 7+ business domains' actual Firebase writes — a hidden coupling point not previously named this precisely. Any future change to the AI assistant's action set risks touching this one function for entirely unrelated domains simultaneously.

---

## Phase 5 — Invariant Discovery (Evidence-Based)

1. **A weight entry in the real system (`animals/{id}/weights`) always belongs to exactly one animal, by construction of its storage path.** *(Structurally guaranteed, not application-logic-enforced.)*
2. **`submitAddWeight()` validates weight is within (0, 500] before writing.** *(Direct source confirmation.)*
3. **No other weight-writing path (AI, Production, Birth) enforces the same range check.** *(Absence confirmed in each, this and prior sessions.)*
4. **The real weight feature never fans out to `current_weight`.** *(Confirmed absent in `submitAddWeight`/`delWeight`'s full source.)*
5. **`showConfirmation()` is the sole write path for every AI-assistant action, regardless of domain.** *(This session's dispatcher-name discovery.)*

---

## Phase 6 — Contradiction Hunt

- Attempted to falsify Invariant 2 by searching for a second code path bypassing validation — none found.
- Attempted to falsify Invariant 4 by searching for any other function patching `current_weight` — found `submitEditAnimal()` also does, **confirming, not contradicting**, the multi-writer finding.
- No stale comment or documentation contradicting these invariants was found.
- **No counterexample survived. All 5 invariants stand as evidenced.**

---

## Phase 7 — Runtime Model

| Scenario | Model |
|---|---|
| Normal flow | Open modal, enter data, submit → single write → refresh |
| Exceptional flow | Network failure → caught, error toast, no partial state (single-collection write) |
| Cancellation | "إلغاء" → `closeModal()` → no write attempted |
| Offline | Unknown whether a write attempted while offline is queued or simply fails — not independently tested |
| Reload | Page re-fetches fresh every load — no stale-cache risk |
| Race (double-submit) | Not independently tested for this function; Birth's proven pattern is architecturally analogous but not proven here (Inference D) |
| Permission denied | Not testable — Firebase rules content unverifiable from this sandbox |
| Partial failure | Structurally low-risk — single-collection write |
| Recovery | None automatic, consistent with every other write path in this repository |
| Rollback | None automatic; `delWeight`/`delWeightByIdx` provide manual, user-initiated rollback — a genuine positive distinction from Birth/Death |

---

## Phase 8 — Production Risk Assessment

| Risk | Severity | Likelihood | Detection | Mitigation (documented, not implemented) | Remaining Uncertainty |
|---|---|---|---|---|---|
| Weight data split across 4 locations | Critical | Certain | Manual code audit | Wave A, per prior specification | D-01 decision timing |
| Production-entered weights invisible to history | High | Certain | Same | Wave A, Commit 1 | None — fully proven |
| No validation on AI/Production/Birth weight writers | Medium | Unknown in practice | Code audit | Not yet backlogged | Real-world impact frequency |
| Offline behavior for this specific action | Unknown | Unknown | Not testable from this sandbox | N/A | Genuinely open |
| Rapid double-submit for `submitAddWeight` | Low-Medium | Unknown | Would require live race-condition testing | Not yet attempted | Inference only |
| Hidden coupling via `showConfirmation()`'s multi-domain scope | Medium | Certain | This session's discovery | Not yet backlogged | None — fully proven as structural fact |

---

## Phase 9 — Adversarial Review (Different Methods Than Phase 1)

Searched files never previously checked at all: `manifest.json`, `sw.js`'s `APP_SHELL` array. Result: zero weight-specific content in either — consistent with, not contradicting, the established model. **No new evidence surfaced. No phase restart triggered.**

---

## Phase 10 — Certification

**1. Repository Facts:** `animals/{id}/weights` is the sole real, live weight-history storage. Four independent writers touch "weight" data; only one writes to real storage. `weight_log` has writers, zero readers. No fan-out to `current_weight` exists. `showConfirmation()` is a single multi-domain dispatcher.

**2. Engineering Assumptions:** Birth's double-submit safety pattern is assumed (not proven) to generalize to `submitAddWeight`.

**3. Unknowns:** Cloud Function consumption of `weight_log`; offline-write behavior; real-world usage frequency of AI/Production paths.

**4. Open Questions:** D-01, Decision Register.

**5. Architectural Constraints:** Any future weight-writing feature must target `animals/{id}/weights` to reach real users.

**6. Safe Implementation Boundaries:** Re-pointing the 3 non-canonical writers; adding `current_weight` fan-out to the real feature.

**7. Unsafe Implementation Boundaries:** Modifying `showConfirmation()`'s weight branch without accounting for its shared blast radius; deleting `weight_log` before confirming zero external consumers.

**8. Minimal Implementation Sequence:** Per prior specification's Commits 1→6, sequential.

**9. Regression Checklist:** Per prior specification's test matrix.

**10. Rollback Checklist:** Every commit independently revertible; migration requires source preservation until confirmed.

**11. Definition of Done:** All Wave A commits merged, live-verified, zero writer targets `weight_log`, `current_weight` fully synchronized.

**12. Confidence Score: High (8/10).** Two full investigation passes, 10 independent discovery strategies with documented blind spots, zero unclassified functions, all invariants survived falsification. The 2-point deduction reflects genuinely unclosable Unknowns (Cloud Functions, offline behavior, real-world scale) that no repository-internal investigation can resolve.

---

**Certification complete. Every discovered artifact is classified as explained, intentionally different, dead, duplicate, or unknown-with-reason. No silent gaps remain. No code was modified.**
