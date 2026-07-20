# Shared Helper Contracts

| Helper | File | Contract | Callers |
|---|---|---|---|
| `createOffspringAnimal(p)` | `shared.js` | Creates one `animals` document from `{species, breed, gender, purpose, birthDate, tag, motherTag, motherBreed, fatherTag, weight, barn, notes}`; writes `animals/{id}/weights` conditionally if `weight` is truthy. Returns the new animal ID. | `_ubSubmit()`, `submitBreeding()` (markBorn), AI `add_birth` |
| `commitBulkPatch(ids, fields)` | `shared.js` | Applies one static payload to N animal IDs sequentially; swallows individual failures, does not roll back prior successes in the same batch | `performBulkTransfer`, `performBulkSell` |
| `refreshAnimalsAfterBulk()` | `shared.js` | Clears bulk-selection state, refetches `animals`, re-renders | `execBulk`, `execBulkDo` |
| `renderFarmModal(...)` | `shared.js` | Shared modal-rendering primitive | 9+ confirmed call sites |
| `logActivity(action, resource, description)` | `shared.js`/`firebase.js` | Writes one `activity_log` entry per call | Universal — does not guarantee the entry is ever read |
| `fbPost(path, data)` | `firebase.js` | HTTP POST — Firebase auto-key semantics, proven concurrency-safe by construction (each call gets an independent key). Auto-stamps `created_at`. | Universal |
| `fbPatch(path, id, data)` | `firebase.js` | Partial update | Universal |
| `migrateWeightLogToWeights()` | `shared.js` | One-time (safely re-runnable — existence-check duplicate prevention, proven idempotent via live re-run) migration from legacy `weight_log` to canonical `animals/{id}/weights`. Never deletes or modifies `weight_log`. Not wired to any UI — callable explicitly. | None (utility, not part of any live flow) |

## Contract Rule

**Once a canonical helper exists for an operation, no new caller may reimplement that operation independently.** This is why `submitBirthDirect()` is flagged as deferred technical debt rather than left undocumented — it predates `createOffspringAnimal()` and was never migrated onto it.
