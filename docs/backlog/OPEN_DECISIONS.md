# Open Decisions & Unresolved Conflicts

## Product Decisions Awaiting Approval

- **D-04:** Should Farm Settings move to Firebase-backed sync? Confirmed real multi-device inconsistency exists; the project already has offline-write-queue infrastructure (`offline-sync.js`) that could support this.
- **`submitBirthDirect()` convergence:** should it be migrated onto `createOffspringAnimal()`? No decision record exists yet.
- **AI Birth `father_tag`/`tag` support:** worth adding to the AI's own field-capture, or intentionally kept lighter for conversational speed?

## Genuine Unresolved Conflict — Record, Don't Guess

**SW registration on `login.html`/`settings.html`:** This project's own separate-session memory states this bug ("script tag present, invocation call missing") was found and fixed. The SW/Sync artifact thread's own latest validation pass (`real-environment-validation-2.4.7.md`) states the same class of bug is confirmed **still present** ("not actually closed"). **This consolidation does not resolve this conflict.** Before relying on either claim, check the live repository directly: does `login.html` actually call `registerServiceWorker()`, not just load the script?

## Threads Requiring a Status-Resolution Step Before Backlog Prioritization

**Design System thread:** an extensive redesign specification exists (Future UI Architecture, UX Constitution, Design Execution Blueprint, Component Catalog, three-phase Architecture/Refactoring/Execution playbooks). Confirmed via direct repository inspection: the proposed file restructuring does not exist in the live repo; only CSS design tokens are present. Before treating any item from this thread as "backlog," first confirm with the repository owner whether this redesign is still an active direction or was superseded by the "restyle, not redesign" approach referenced elsewhere in this project's own working history.

**SW/Sync thread:** explicitly concluded "NOT READY... no production activation" by its own final validation. Two concrete, real bugs were found there (the registration conflict above, and `sw-register.js` missing from the sync manifest) — but the entire thread's activation status needs a human decision before any of its findings become active backlog items, not just its individual bugs.

## Files/Tools Referenced in the Archive but Not Found in the Live Repository

- `sw-register.js` (standalone file)
- `tools/sync-apk/sync-apk.js` and `sync-manifest.json`
- `/js/shared/modal.js`, `gateway-writes.js`, `theme.js`, `ui-helpers.js`, `utils.js` (proposed Design System decomposition)

**Their absence is stated as a fact from direct inspection, not treated as evidence they were rejected — they may simply live in a different branch, a different repository snapshot, or genuinely never got merged. Confirm with the repository owner before assuming either way.**
