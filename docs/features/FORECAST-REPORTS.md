# FORECAST-REPORTS.md

## The New Tab
`reports.html`'s 6th tab, "التوقعات" -- added following the exact same tab-registration pattern Sprint 8/9 already established (button array, `labels` object, `renderTab` dispatch). Gated by the same page-level `can('reports')` check every other tab already relies on -- no new permission logic.

## What It Shows
1. **Farm summary** -- expected workload (7/30 days), expected risks, expected declining-weight animals, expected treatments. Pure composition via window.forecastFarmSummary().
2. **Declining weight table** -- every candidate animal whose forecastWeight() trend is declining, with current weight, 7-day and 30-day projections, and confidence.
3. **Rising health risk table** -- every candidate animal whose forecastHealthRisk() projected score exceeds its current score, with both scores, confidence, and the specific cited reason.

A disclaimer banner states plainly, at the top of the tab: forecasts are statistical and rule-based, not machine learning, and do not replace veterinary judgment -- stated once, not repeated per-row, matching this project's own established tone for decision-support disclaimers (Health Intelligence, Sprint 3, set this precedent).

## Excel Export
A 9th sheet, "التوقعات" -- animal, forecast type (weight/health), trend, current value, 30-day-projected value, confidence. Built from the same forecastWeight()/forecastHealthRisk() calls the tab itself uses, not a separate calculation.

## WhatsApp Summary
One line, added to the existing brief summary: expected workload over the next 7 days (forecastTaskWorkload(7)), shown only if non-zero -- proportionate to the message format, matching Sprint 8/9's own established restraint (a full forecast breakdown does not belong in a WhatsApp message). Required converting shareWhatsApp() to async -- confirmed safe, since its onclick="shareWhatsApp()" call site does not depend on a synchronous return.

## Animal Detail Integration
A forecast section (Weight + Health Risk, where either has a meaningful trend) sits above the existing Sprint 2/3/4 per-engine detail sections -- trend, confidence, and the forecast function's own evidence array, verbatim. Nothing is shown when a forecast has nothing meaningful to say (e.g., a stable-weight animal does not get a "forecast: nothing will change" card) -- consistent with this project's "don't clutter the page for the common case" precedent from Sprint 2 onward.

## Testing
tests/data-integrity/predictive-intelligence.spec.js -- 10 tests covering mathematical correctness, deterministic reproducibility, direct-reuse verification (Production), rule-based projection correctness with cited evidence (Health), window-boundary correctness (Tasks), performance, permission, and full regression across all 6 report tabs together.
