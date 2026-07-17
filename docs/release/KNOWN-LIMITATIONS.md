# KNOWN-LIMITATIONS.md -- v1.7.0 (Updated)

**Consolidates every genuine, evidence-backed limitation carried forward since v1.0.0-rc1, plus everything newly found or deferred through Sprints 9-14 and this release's own certification pass. Nothing below is invented; every item traces to a real discovery made and documented at the time.**

## Structural (Pre-Existing, Accepted, Unchanged by This Release)
- Client-trusted permission model. can() reads localStorage directly; no server-side authorization layer exists. Every permission check added across Sprints 9-14 (can('finance'), can('reports') on new pages/sections) uses this same, unchanged model -- not newly introduced by this release, not fixed by it either.
- No automated Firebase backup mechanism. Still the most consequential structural gap, unchanged since the original certification.
- Service Worker is built but deliberately inactive. Unchanged.
- bayan.html and activity.html remain outside the page-level permission-enforcement pass. Unchanged.
- fbGet() has no pagination. Still true; every new engine this release added (Analytics, Finance, Inventory) reads full collections, consistent with this pre-existing pattern, not a new instance of the limitation.

## Newly Confirmed and Fixed by This Release
- production.html/tasks.html unreachable navigation -- found and fixed (docs/release/REPOSITORY-DISCOVERY-v1.7.0.md).
- import.html page-breaking syntax error -- a limitation named in VERIFIED_BACKLOG.md from an earlier session, re-confirmed still present, and fixed in this release (docs/release/UI-UX-CERTIFICATION-v1.7.0.md).

## Newly Found, Documented, Deliberately Not Fixed (Real, Not Hidden)
- A proven-dead backup file remains tracked in git: farm-apk/www/animal-detail.html.bak. Confirmed unreferenced anywhere in live code, for a second time across two separate sessions. Not removed in this release -- removing a tracked file is treated as a real repository change, and this release's own mandate was "no changes unless a real production blocker is proven." A stray, unreferenced file does not block production use. Flagged as the clearest candidate for a small, dedicated cleanup commit in a future cycle.
- clearAllNotifs() bypasses the firebase.js abstraction, using a raw fetch() call with an always-undefined FB_SECRET. Functions correctly today only because Firebase rules are permissive regardless. Found in Sprint 9, unchanged since.
- Notification deduplication is client-side and localStorage-based, not server-side -- a cleared browser or a different device could theoretically see a re-sent notification. Found and named in Sprint 9, unchanged since.
- feed_consumption links to inventory_feeds by name, not ID. A pre-existing, deliberately deferred decision (confirmed via the code's own engineering comment) that Sprint 14 built its new stock-deduction logic to work with, not reverse.
- No genuine per-animal feed cost or feed-efficiency ratio exists. feed_consumption is barn-level only; Sprint 13/14's Animal Detail sections say so explicitly in their own UI text rather than presenting an attribution the data cannot support.
- No PDF export exists anywhere in this application. Confirmed absent as far back as Sprint 9, reconfirmed never added through Sprint 14. Excel and WhatsApp (and, for inventory specifically, CSV) remain the only real export mechanisms.
- No budget-setting mechanism exists, so Sprint 13's finance notifications and Sprint 14's inventory notifications do not include a "budget overrun" trigger -- there is no budget anywhere to overrun. Confirmed absent, not silently worked around.
- media/logo.png is 1.5MB. Unchanged since the original certification; still judged out of scope for a dedicated fix.

## Testing
No automated tests exist for genuinely offline browser scenarios or real, network-connected Firebase behavior -- every test in this repository, across all 14+ sprints, runs against mocked fbGet/fbPost/fbPatch. This has been true since the original certification and remains true through this release.

## Recommendation
None of the above are release blockers for this application's single-farm, staff-operated deployment context. Each is either a deliberate, reasoned tradeoff, a genuinely low-current-impact item, or (for the two items fixed in this release) already resolved.
