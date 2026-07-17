# PRODUCT-GAP-ANALYSIS.md

**Compared against the feature set typical of modern commercial livestock-management platforms (e.g., the EDC/herd-management category broadly), not against this codebase's own history.**

## Critical
- **Automated task generation from domain events.** Tasks exist (`tasks.html`) but nothing creates them automatically — a vaccination due date, a breeding window, a follow-up health check should generate a task on its own. Today every reminder is manually entered. This is the single highest-leverage gap: it connects three existing modules (Health, Breeding, Tasks) without requiring any of them to be rebuilt.
- **Weight-trend alerting.** Weight history is certified SSOT and fully tracked, but nothing surfaces "this animal hasn't gained weight in N days" or flags a concerning trend. The data already exists; only the analysis layer is missing.

## High
- **Genetic/pedigree analytics beyond raw linkage.** `mother_tag`/`father_tag` exist, but there's no inbreeding-coefficient calculation, no breeding-value estimation, no pedigree-chart visualization — a farm actively managing breeding quality (which this one is, per the fertility-research workstream referenced in project memory) will want this within the app, not in a side spreadsheet.
- **Financial forecasting.** Finance is a real, historical ledger (10+ writer types), but there's no budgeting, no projected-cost-vs-actual, no cash-flow forecasting — purely retrospective today.
- **Feed conversion / production efficiency analytics.** Feed inventory and production logs both exist as separate, real modules; nothing correlates them into feed-conversion-ratio or cost-per-kg-produced metrics.
- **Multi-farm support.** Already the subject of an open architectural decision (see `docs/architecture/SCALABILITY-REVIEW.md`) — flagged here as a product gap, not re-analyzed as an engineering one.

## Medium
- **Third-party data import beyond CSV.** `import.html` exists (CSV-oriented); no support for common veterinary-lab result formats or RFID/electronic-tag scan imports.
- **Customer/buyer relationship tracking.** Sales are recorded (`sold_*` fields on animals) but there's no buyer history, no repeat-customer view, no sales-pipeline concept.
- **Regulatory/compliance export formats.** Reports exist, but nothing is pre-formatted for common livestock-registry or government submission formats — relevant given this project's own military/official-presentation use case (`bayan.html`).
- **Push notifications for time-sensitive events.** `notifications-service.js` exists and is confirmed active (scoped to `notifications.html`) but is in-app only — no email/SMS/push channel for a user who isn't currently looking at the app.

## Low
- **Barcode/QR physical tagging integration.** Would streamline data entry but isn't blocking any current workflow — tag numbers are already string fields, just manually typed.
- **Photo attachment on animal records.** No image field found on the Animal entity — useful for identification/condition tracking, genuinely low-urgency for a working farm operation.
- **Weather-integrated planning.** Weather is already displayed (via the third-party API key reviewed in the certification pass); using it to inform grazing/feed planning is a real but low-urgency enhancement.

## What's Deliberately Not Listed
Anything requiring a framework migration, a backend rewrite, or abandoning the buildless architecture — those are constraints this product has chosen deliberately and successfully (see `docs/architecture/PRODUCTION-ARCHITECTURE-REVIEW.md`), not gaps to close.
