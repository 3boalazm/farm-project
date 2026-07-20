# Decision Register — Index

| ID | Decision | Status | Implementation |
|---|---|---|---|
| Sale/Death convention (pre-D-01 numbering) | `status:'sold'` is canonical, never a Death subtype | Approved, Implemented | Priority 1 |
| Transfer convention | `barns.html`'s field-read-before-close pattern is canonical | Approved, Implemented | BL-01 |
| D-01 | `animals/{animalId}/weights` is sole canonical weight storage | Approved, Implemented | Wave A (6/6 commits) |
| D-02 | `markBorn` creates real animal records on genuine status transition | Approved, Implemented | Wave B Commit 1 |
| D-03 | AI `add_birth` converges onto canonical Birth workflow | Approved, Implemented | Wave B Commit 2 |
| D-04 | Should Farm Settings move to Firebase-backed sync? | **Open** | Not started |
| D-05 | Should the Undo system be connected? | Approved (deferred) — no evidenced need | Deliberately not implemented |
| D-06 | Should Notifications gain a persisted producer? | Approved (deferred) — live-computed path already sufficient | Deliberately not implemented |
| — | `submitBirthDirect()` convergence onto `createOffspringAnimal()` | **No decision record exists** | Not authorized |
| — | AI `add_birth`'s `father_tag`/`tag` support | **Open, deferred by D-03** | Not started |

See individual files for full rationale, consequences, and historical-data strategy per decision.
