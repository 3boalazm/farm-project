# SSOT Map

**One row per entity investigated across both the Repository 4 SSOT audit and this project's own later Weight/Birth work. Status reflects the most recent, most-verified finding — earlier, superseded claims are not repeated.**

| Entity | Canonical Storage | Canonical Writer | Status | Evidence |
|---|---|---|---|---|
| Animal | `animals` | Many (by design, shared entity) | Consistent | RSOT, repeated confirmation |
| Weight | `animals/{id}/weights` | `submitAddWeight()`, converged | **Certified SSOT** | Wave A, 6/6 commits, 3 formal verification rounds |
| Birth | `breeding` + `animals` jointly | `createOffspringAnimal()`, 3 of 4 entry points converged | **Certified with deferred item** | Wave B; `submitBirthDirect()` not yet converged |
| Sale | `animals.status='sold'` + `sold_*` fields | 3 writers, converged | **Certified** | Priority 1 (Repository 5 continuation) |
| Transfer | `animals.barn` | `barns.html`'s implementation, converged | **Certified** | BL-01 |
| Death | `animals.status='dead'` + `death_*` fields | Multiple, bulk path converged | Certified for bulk path | BL-02 |
| Finance | `finance` | Many, confirmed legitimate variety (not duplication) | Stable, not further converged | `ssot-dependency-graph-final.md` |
| Farm Settings | `localStorage` only | Per-device | **Confirmed gap, no Firebase source at all** | Open Product Decision D-04 |
| `weights` (top-level, legacy) | N/A | None (retired) | Dead, confirmed inert | Wave A Commit 6 |
| `weight_log` (legacy) | N/A | None (retired for new writes) | Read-only by migration utility | Wave A Commit 5/6 |
| `activity_log` | `activity_log` | `logActivity()`, universal | Writer consistent; viewer status disputed across artifacts | See Risk Register |
| Vaccination | `vaccinations`/`vaccination_templates` | `pages/vaccine.js` | Single writer confirmed, not deeply converged/tested | Repository 4 SSOT audit |
| Notifications | N/A — live-computed | None (no persisted producer) | Deliberately deferred (D-06) | RDR |
| `uid_lookup` | `uid_lookup` | Firebase-Auth-bridge, single writer | Low risk, well-scoped | `ssot-tightened-audit.md` |
| `diary_snapshot` | `diary_snapshot` | Manual reconciliation feature | Confirmed intentional design (not a bug), not deeply audited beyond that | RSOT-era investigation, this project's continuation |

## Reading This Table

"Certified" means live-tested, repeatedly, adversarially, against the actual repository — safe to build on without re-verification for routine work. Everything else should be treated as "documented, not certified" — real findings, but not subjected to the same depth, and not a license to assume no further gaps exist.
