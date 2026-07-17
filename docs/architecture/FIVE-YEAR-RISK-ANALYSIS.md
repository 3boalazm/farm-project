# FIVE-YEAR-RISK-ANALYSIS.md

## 6 Months
**Code growth:** Low risk. The `pages/*.js` delegated pattern and `shared.js` additive-function convention (proven this engagement, e.g. `createOffspringAnimal()`) scale fine for incremental feature work.
**Data growth:** Negligible at single-farm scale.
**Likely first real issue:** A new page added to `nav.js` without a matching `can()` check — the exact bug class just fixed. `scripts/safety-scan.js` now catches this automatically in CI, which is the single highest-value protection this engagement added against near-term regression.

## 1 Year
**Data growth:** A single active farm's `animals`/`health`/`finance` collections will have accumulated a year of records. `fbGet()`'s full-collection-fetch pattern (`firebase.js:339`) will start showing measurable load-time impact on pages like `reports.html`, `animals.html` — not severe yet, but the first point where it becomes *noticeable* rather than theoretical.
**Dependency risk:** Low — the one `devDependency` (`@playwright/test`) is test-only; a stale version doesn't threaten production, only slows test maintenance if ignored for a full year.
**Browser risk:** Low — the APIs relied on (`<input type="date">`, `fetch`, IndexedDB, Service Worker) are all mature, stable web standards, not bleeding-edge.

## 3 Years
**Data growth:** This is where the missing `.indexOn` rules (confirmed absent, `database.rules.json`) start to matter concretely — any `orderByChild` query against a 3-years-deep collection without an index will be measurably slow, and Firebase's own console will likely be actively warning about it by this point.
**Firebase changes:** Firebase RTDB itself is a mature, stable Google product with no signs of deprecation — low platform risk. The bigger risk is this project's own REST-only integration pattern (no SDK) potentially missing newer Firebase capabilities (real-time listeners are unused here, confirmed no `.on(` usage found this session) that could have made 3-year-old features simpler.
**Maintenance cost:** Rises if the SW/PWA layer (`sw.js`, `sw-register.js`) remains built-but-dormant rather than either activated or removed — a 3-year-old codebase carrying real, untested, unused code is a genuine, compounding maintainability tax, distinct from carrying no code at all.

## 5 Years
**Code growth:** The delegated-pages pattern will have produced 20-40+ `pages/*.js` files if feature growth continues at a normal pace. Without the discipline already proven this engagement (SSOT checks, the permission scanner), this is exactly the point at which undisciplined projects accumulate silent duplicate-truth bugs — the automated regression suite built this phase is the direct mitigation, but only if it's kept passing, not disabled when inconvenient.
**Multi-farm ambitions:** If the "Farm as a first-class entity" decision (still open per project memory) is never made, any eventual multi-tenant push becomes a full data-migration project rather than an additive feature — the cost of deferring this decision compounds every year, even though deferring it today is correctly the right call (no evidenced need yet).
**User growth:** The client-trusted permission model (`can()` reading `localStorage`) does not get riskier with *more* users in a linear sense, but it does get riskier with more *distinct roles/trust levels* — if a 5-year-grown user base includes external parties (buyers, auditors, government inspectors) rather than just farm staff, the current trust model stops being adequate regardless of feature count.

## Cross-Cutting: What Actually Determines 5-Year Survival
Not the technology choices (vanilla JS ages well) — the determining factor is whether the **evidence-based, one-atomic-task-at-a-time discipline** already proven across this project's own history (documented extensively in `docs/repository/`) continues to be followed, or erodes under future time pressure. The tooling built this phase (tests, scanner, CI) makes erosion *visible* when it happens; it does not make erosion *impossible*.
