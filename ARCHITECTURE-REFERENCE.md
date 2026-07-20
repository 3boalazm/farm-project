# ARCHITECTURE-REFERENCE.md

## SSOT Locations (Single Sources of Truth)
| Domain | Location | Writer(s) |
|---|---|---|
| Weight | `animals/{id}/weights` (nested), synced to `animals.current_weight`/`weight_updated` | `animal-detail.html`, `pages/production.js`, `assistant.html` -- 3 independent writers, no shared function |
| Birth | `breeding` record + `animals` document | `createOffspringAnimal()` in `shared.js` -- the ONE canonical path, 4 confirmed call sites |
| Health | `health` collection, per-animal via `animal_tag` | `pages/health.js`'s `submitHealth()` -- single writer |
| Vaccination | `vaccinations` collection, per-section via `target_section` | `pages/vaccine.js`'s `submitVacc()` + `submitTpl()` -- two writers, same collection |
| Production | `production_log`, `type: 'milk'|'wool'|'weight'` | `pages/production.js` -- single writer (the `weight` type feeds the Weight SSOT above; `milk`/`wool` are this domain's own) |
| Tasks | `daily_tasks` | Manual (`pages/tasks.js`) or automated (`autoGenerateTask()`) -- same collection, same shape |
| Weight Alerts | `weight_alerts` | `evaluateWeightAlert()`/`evaluateMissingWeightAlerts()` only |
| Production Alerts | `production_alerts` | `evaluateProductionAlert()` only |
| Health Risk Score | **Not persisted** -- always recomputed live from `health`/`vaccinations`/`weight_alerts` | N/A -- deliberate, see below |
| Operational Priority | **Not persisted** -- always recomputed live | N/A -- deliberate, see below |

## Why Two of the Five Engines Never Write a Score
Health Risk and Operational Priority are **derived, composite values** -- storing them would create a second source of truth that could silently drift from the records it was computed from. Both are cheap enough to recompute on every page load (a handful of array filters over already-small collections) that persistence would trade correctness for a performance gain that isn't actually needed at this project's scale.

## The Five Engines, and How They Communicate

```
                    Automation Engine (Sprint 1)
                    autoGenerateTask(eventType, payload)
                    writes: daily_tasks
                            ^
                            | called by (task generation)
                            |
   Weight Intelligence      Health Intelligence       Production Intelligence
   (Sprint 2)                (Sprint 3)                  (Sprint 4)
   evaluateWeightAlert()     evaluateHealthRisk()        evaluateProductionKPIs()
   writes: weight_alerts     READS weight_alerts <----   evaluateProductionAlert()
                             (own domain data +           writes: production_alerts
                              Weight's already-written
                              alerts, NOT recalculated)
                                    ^           ^
                                    |           |
                                    +-----+-----+
                                          |
                          Unified Decision Engine (Sprint 5)
                          evaluateOperationalPriority()
                          READS Health + Production outputs + daily_tasks
                          (all read-only -- writes NOTHING itself except
                           an optional task via the Automation Engine above)
                          NEVER reads weight_alerts directly -- Weight's
                          contribution already reached it through Health
```

**The one non-obvious rule this diagram exists to make obvious:** Weight Intelligence's signal reaches the Unified Decision Engine *through* Health Intelligence, not as an independent path. This was a deliberate finding, not an oversight -- confirmed directly in source before Sprint 5 was built, documented in `docs/features/INTELLIGENCE-CONTRACTS.md` and `docs/features/UNIFIED-PRIORITY-MODEL.md`, and proven by a dedicated test that an animal with only an active weight alert contributes exactly once to the final score.

## Engineering Rules (Governing All Five Engines and Any Future Addition)
1. **Never recalculate what another engine already computed.** Read its output; don't reimplement its logic.
2. **Persist only what needs a lifecycle** (active/resolved, with a history). A pure derived number does not.
3. **Every write is deduplicated deterministically** -- one active record per (entity, event-type), proven by tests, not assumed.
4. **Every alert/score cites its evidence.** No recommendation exists without a traceable reason.
5. **A failure in an engine must never block the domain write that triggered it** -- every integration point is fire-and-forget with its own try/catch.

## Permission Model
Client-side only (`can()` in `firebase.js`, reading `localStorage`). Every gated page needs both a `perm:` declaration in `nav.js` and a runtime `can()` check -- the gap between these two was the real, historical vulnerability this project's certification work found and closed. No server-side authorization exists; `database.rules.json` enforces data validation, not access control. This is a named, accepted, structural limitation -- see `docs/architecture/PRODUCTION-ARCHITECTURE-REVIEW.md`.

## Offline Handling
Two independent mechanisms: `offline-sync.js` (a real, working IndexedDB write-queue) and `sw.js`/`sw-register.js` (a complete but deliberately unregistered Service Worker). See `docs/reliability/OFFLINE-RELIABILITY-REVIEW.md`.
