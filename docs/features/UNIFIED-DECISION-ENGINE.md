# UNIFIED-DECISION-ENGINE.md

**Pure composition. This engine recalculates nothing -- it calls Sprint 1-4's existing, trusted, read-only functions and combines their outputs into one explainable operational priority.**

## Architecture

```
Weight Engine (Sprint 2) ---\
                              \
Health Engine (Sprint 3) -----+--> reads Weight's output internally already
                              /     (confirmed in source -- see below)
Production Engine (Sprint 4)/
                              
Automation Engine (Sprint 1) -- read-only, for pending-task load
        |
        v
window.evaluateOperationalPriority(animalId, animalTag, barn)   <- shared.js
        |
        v
Operational Priority { score, level, confidence, evidence, contributingEngines }
        |
        v
window.rankOperationalPriorities(results)  <- pure sort, documented tie-breaks
```

## The Weight Double-Counting Question, Resolved
`docs/features/INTELLIGENCE-CONTRACTS.md` confirms, directly from source (`shared.js`'s `evaluateHealthRisk`), that Health Intelligence already reads `weight_alerts` as three of its own nine scoring factors. The mission's own example formula names "Weight Alert" as a separate additive term -- but adding it again here would double-count the same fact. **Resolution:** Weight's contribution reaches the unified score through Health's existing incorporation, not as a fifth parallel term. Full reasoning in `docs/features/UNIFIED-PRIORITY-MODEL.md`. A dedicated test proves this directly: an animal with only an active weight-loss alert scores `healthScore: 25` exactly once, not 25 twice or 50.

## Data Flow
1. Caller provides `animalId`, `animalTag`, `barn`.
2. The engine calls `evaluateHealthRisk()`, `evaluateProductionKPIs()` (milk and wool), and reads `daily_tasks` -- all read-only.
3. It computes a weighted-average score (0.6 health + 0.3 production + 0.1 tasks), a level (reusing Health's exact Low/Medium/High/Critical boundaries), a confidence (grounded in how many independent engines actually show a signal), and an evidence array (assembled from each engine's own already-cited strings, never synthesized).
4. If zero engines show any signal, the function returns `null` -- the animal is simply not an operational priority, not a hedge-worded "everything's fine."
5. **No write ever happens in this engine.** Verified by a dedicated test that logs every `fbPost`/`fbPatch` call during evaluation and asserts zero occur (below the threshold where Health Intelligence's own, already-existing task-generation would separately fire).

## Priority Model
Full detail in `docs/features/UNIFIED-PRIORITY-MODEL.md`: the weighted formula, priority levels, tie-breaking rules (active illness first, then more corroborating engines, then alphabetical), the evidence model, and how confidence is grounded in genuine cross-engine agreement rather than an arbitrary number.

## Dashboard: Consolidation, Not Addition
The three separate Sprint 2/3/4 dashboard panels ("ذكاء الوزن", "ذكاء الصحة", "ذكاء الإنتاج") are replaced by one "الأولويات التشغيلية" panel -- their underlying aggregate-count computations are unchanged (copied verbatim, not recalculated), only the presentation and the per-animal ranking are unified. A dedicated test confirms the old panel labels no longer appear anywhere on the page.

## Animal Detail: One Consolidated Summary
A new top-of-page summary shows the overall operational priority score/level/confidence, four explicit status lines (Weight / Health / Production / Tasks, each sourced from an existing engine's output or a direct read-only fetch), and an expandable evidence list -- positioned above, not replacing, the existing per-engine detail sections from Sprints 2-4, which remain available for anyone who wants the full drill-down.

## Explainability
Every priority result names which engines contributed (`contributingEngines`), cites verbatim evidence per contributing factor, and states its confidence level with the reasoning (engine-agreement count) visible in the UI, not just in the data. This satisfies the mission's explainability requirement directly, not as an afterthought -- the evidence model was designed before the scoring formula, specifically to guarantee no recommendation could ever exist without a traceable reason.

## Examples

**Multi-engine agreement:** an animal with an active illness (Health: 30), a declining milk trend (Production: drop detected), and one pending high-priority task scores 0.6(30) + 0.3(56) + 0.1(60) ~= 41 (Medium), confidence High (3 engines agree), with three evidence lines -- one per contributing domain.

**Single, isolated signal:** an animal with only a pending low-priority task and nothing else scores low, confidence Medium (only Tasks shows a signal) -- correctly a much lower priority than the multi-engine case above, even if that one task happens to exist.

**Nothing wrong:** an animal with no active health issue, no production drop, and no pending tasks returns `null` -- absent from the priority list entirely, not present with a reassuring but noisy "all clear" entry.

## Testing
`tests/data-integrity/unified-decision-engine.spec.js` -- 10 tests: formula composition correctness, zero-write verification, null-when-no-signal, the weight double-counting proof, confidence grounding, evidence traceability, both documented tie-breaking rules, dashboard consolidation (old panels confirmed absent), and animal-detail integration.

## Extension Strategy
A future Sprint 6 engine (e.g., Breeding Intelligence) plugs in exactly the same way: add one more read-only call inside `evaluateOperationalPriority`, one more weighted term (rebalancing the existing coefficients to still sum to 1.0), and one more evidence-source case. No change to `rankOperationalPriorities`, the dashboard panel, or the animal-detail summary is needed -- they already consume the engine's output generically.
