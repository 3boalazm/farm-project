# NOTIFICATION-DISCOVERY-FINDINGS.md

**This document exists specifically to resolve a real, multi-session, previously-unresolved contradiction in this project's own history (`KNOWN_LIMITATIONS.md`: "Notifications producer status... Not reconciled"). Resolved definitively below, by direct source inspection, before any Sprint 9 code was written.**

## The Contradiction, Resolved
**`notifications-service.js` IS the real, active, sole notification producer.** Confirmed: it calls `fbPost('notifications', {...})` (real Firebase write), is loaded by `notifications.html` (`<script src="notifications-service.js">`), and `notifications.html` reads from the exact same collection (`fbGet('notifications')`). The competing "no persisted producer, live-computed via `generateNotifs()`" claim describes something that **no longer exists in source** -- `generateNotifs()` was searched for exhaustively across the entire codebase and found nowhere. It was either removed or replaced at some point in this project's history without the documentation being updated to match. This finding closes a genuinely long-standing open item.

## Existing Notification Flow (Complete, As Confirmed by Source)
1. `notifications-service.js`'s `NS` object self-initializes 6 seconds after `window.load`, **but only on `notifications.html`** -- confirmed via direct search: zero other pages load this script. This means notification generation (`NS.checkAll()`) only runs while a user has this specific page open, not continuously across the app.
2. `NS.checkAll()` polls every 5 minutes (while the page remains open) and checks 6 real sources: vaccinations (overdue/upcoming), breeding (births upcoming/overdue), health (active withdrawal periods), inventory (low stock, expiring meds), and login events (admin-only).
3. `NS.checkWeather()` separately checks weather extremes every 15 minutes.
4. Every finding is deduplicated via `NS._sentIds`, a `localStorage`-persisted `Set` capped at 100 entries, checked *before* any Firebase write.
5. `notifications.html` reads all notifications, filters by role (`for_role`) and category, and offers per-item mark-read (`markRead`), per-item delete (`deleteNotif`), and bulk-clear (`clearAllNotifs`).

## Duplicate Notification Paths
**None found.** `dashboard.html`, `nav.js`, and every other page have zero independent notification logic -- confirmed via exhaustive search for `generateNotifs`/`notif` across the codebase. This is genuinely a single, unduplicated system already -- Sprint 9's job is to *extend* its trigger coverage, not consolidate competing systems.

## Missing Notification Triggers (The Real Gap This Sprint Exists to Close)
**Zero of the five Sprint 1-5 intelligence engines feed this system at all.** No Weight Intelligence alert, no Health Risk Score crossing, no Production drop, no Unified Operational Priority, and no automated task ever becomes a notification. Five sprints of intelligence work are currently invisible to the one system whose entire purpose is telling a user "something needs your attention."

## Notification Lifecycle
Create (`NS.save`, `read:false`) -> read individually (`markRead`) or in bulk (`clearAllNotifs` reads then deletes, no bulk mark-read function currently exists, only bulk *delete*) -> delete individually (`deleteNotif`) or in bulk. **No automatic expiration exists anywhere in the current system** -- a notification persists indefinitely until a user manually acts on it.

## A Real, Pre-Existing Gap Found During This Discovery (Corrected Mid-Discovery)
**First pass, WRONG:** searching `grep -l "bell-badge" *.html` found zero matches, leading to an initial (incorrect) conclusion that the badge element didn't exist anywhere.
**Corrected, verified:** `#bell-badge` genuinely exists -- but as JavaScript-generated markup inside `renderNavbar()` in `shared.js` (`<span class="bell-badge" id="bell-badge" style="display:none">0</span>`), which every page calls. A static grep across `.html` files structurally cannot find JS-injected HTML -- this was a search-methodology gap, corrected before being written down as final, not after.
**The real, accurate finding:** the badge *element* is universally present (every page gets it via `renderNavbar()`), but the *code that populates its count* (`NS.updateBadge()`, inside `notifications-service.js`) is still only loaded on `notifications.html`. The badge is structurally everywhere, functionally dormant (always 0/hidden) everywhere except the one page that happens to load the script that fills it in.

## A Second Pre-Existing Gap Found (Noted, Not Silently Carried Forward)
`clearAllNotifs()` bypasses the `firebase.js` abstraction entirely, making a raw `fetch()` DELETE call using `FB_URL`/`FB_SECRET` directly -- and `FB_SECRET` is a confirmed, pre-existing undefined global (found during this project's original security certification). The call still functions today only because `database.rules.json` is permissive (`.write: true`) regardless of the auth parameter -- but this is an inconsistent code path compared to every other write in the app, which goes through `fbDelete()`.

## Priority Model, As It Actually Exists
Three tiers (`type: 'danger'|'warning'|'info'`), not the four (Critical/High/Medium/Low) this sprint's mission requests. Sprint 9's design must map cleanly onto the existing three-tier field without a breaking schema change -- see `NOTIFICATION-ARCHITECTURE.md`.

## Categories, As They Actually Exist
Free-text Arabic strings assigned per-trigger ('التحصين', 'التكاثر', 'الصحة', 'المخزن', 'تسجيلات الدخول', 'الطقس') -- not a fixed enum. Three of Sprint 9's seven requested categories (Health, Vaccination, Birth) already have a direct existing equivalent; four (Weight, Production, Tasks, System) do not yet exist as generated categories.
