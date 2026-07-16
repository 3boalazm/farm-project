# CRITICAL-PATHS.md

**Every item below has a corresponding automated test in `tests/`, built this session.**

## Identity & Data
| Protected | Owner | Test |
|---|---|---|
| Animal IDs | Firebase auto-key (`fbPost`) | `tests/ssot/animal-ids.spec.js` |
| Tags | User-entered, no generation collision risk (string field) | Covered indirectly by birth tests |
| Birth dates | `createOffspringAnimal()`'s `birthDate` param, single write | `tests/ssot/birth.spec.js` |
| Parents | `mother_tag`/`father_tag`, set once at creation, never reassigned elsewhere | `tests/ssot/birth.spec.js` |
| Offspring | `createOffspringAnimal()`, exactly 3 legitimate callers | `tests/data-integrity/no-bypass.spec.js` |
| Weights | `animals/{id}/weights`, `current_weight` sync | `tests/ssot/weight.spec.js` |

## Business Logic
| Protected | Test |
|---|---|
| `createOffspringAnimal()` remains the sole creation path for birth-context animals | `tests/data-integrity/no-bypass.spec.js` |
| Weight calculations (`current_weight` = newest record) | `tests/ssot/weight.spec.js` |
| Production records | Not independently tested this session — flagged as a gap, not silently assumed covered |
| Status transitions (sold/dead mutual exclusion) | Not independently tested this session — flagged as a gap |

## Authorization
| Protected | Test |
|---|---|
| Page permissions (all 17 fixable pages from `PERMISSION-MATRIX.md`) | `tests/permissions/matrix.spec.js` — generated live from `ROLE_PERMS`, not hand-duplicated |
| Role boundaries | Same test, all 5 roles |
| Admin actions | Same test (`admin` bypass case) |
| Finance actions | Same test (`finance` permission case) |

## Storage
| Protected | Test |
|---|---|
| Firebase writes (no silent loss) | `tests/ssot/weight.spec.js`'s concurrent-write case |
| localStorage session | `tests/auth/login-logout.spec.js` |
| Offline cache / sync | **Not tested this session** — genuinely requires real offline browser simulation beyond this pass's scope; documented as an open gap, not claimed covered |

## Explicitly Out of Scope This Phase
Production records, status transitions, and offline sync are flagged, not silently treated as protected — building tests for genuinely untested areas without evidence they behave as expected would risk asserting false confidence.
