# POST-DEPLOYMENT-VALIDATION.md — v1.0.0-rc1

**A real-Firebase validation checklist -- everything the automated test suite could not verify against mocked data, because it requires an actual, live production database.**

## Weight Intelligence
- [ ] Add a weight record for a real animal via `animal-detail.html` that represents a >5% drop from its previous weight -- confirm an alert appears in `weight_alerts` and the dashboard's "Weight Trend" indicator turns red.
- [ ] Add a follow-up weight showing recovery -- confirm the alert auto-resolves.

## Health Intelligence
- [ ] Add a health record with `status: active` for a real animal -- confirm its risk score becomes non-zero on `animal-detail.html` and it appears in the dashboard's operational priority ranking.
- [ ] Mark the health record complete -- confirm the score drops accordingly on next page load.

## Production Intelligence
- [ ] Log several days of milk production for one animal, then a noticeably lower value -- confirm a production alert appears once the drop exceeds the 15% threshold against baseline.

## Unified Decision Engine
- [ ] With at least 2 of {health issue, production drop, pending task} true for the same real animal, confirm it appears in the dashboard's "الأولويات التشغيلية" ranking with `confidence: high` reflected in its hover tooltip.

## Executive Dashboard
- [ ] Confirm the Daily Briefing shows real, current sentences (not cached/stale) -- refresh and confirm numbers match what's actually in Firebase at that moment.
- [ ] Confirm Upcoming Tasks correctly shows overdue items highlighted, sourced from real `daily_tasks` records.

## Automation Engine
- [ ] Confirm at least one auto-generated task (from any of the above) appears correctly on `tasks.html`, tagged "مولّدة تلقائيًا" with the correct source event label.

## General
- [ ] Confirm no browser console errors on any of the pages touched above, on a real device (not just the sandboxed test environment).
- [ ] Confirm page load times are reasonable on the actual production Firebase project's real data volume -- the automated performance test only verified against 50 synthetic animals, not real production scale.

## If Any Item Fails
Do not consider the release fully validated until either the specific issue is understood and a decision is made (fix now, or document as a known limitation and proceed), following this project's own established discipline: evidence before conclusion, no speculative fixes.
