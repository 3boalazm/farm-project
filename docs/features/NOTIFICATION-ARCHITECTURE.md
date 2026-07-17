# NOTIFICATION-ARCHITECTURE.md

**Sprint 9 (v1.1). Extends the existing, single, real notification system -- does not create a second one. Full discovery in `docs/features/NOTIFICATION-DISCOVERY-FINDINGS.md`.**

## The System, As It Actually Exists (One Producer, One Store, One Consumer Page)

```
notifications-service.js (NS object)
  -- loaded ONLY by notifications.html, self-inits 6s after window.load
  -- polls every 5 min (page must stay open) + weather every 15 min
        |
        v
  6 pre-existing triggers (vaccination, breeding, health-withdrawal,
  low-stock x2, expiring-meds, login) + 1 NEW trigger (Sprint 9,
  Operational Priority -- see below)
        |
        v
  NS.save() -- client-side dedup (localStorage _sentIds) THEN
  fbPost('notifications', {...}) -- real Firebase write
        |
        v
  notifications.html reads fbGet('notifications'), filters by role/category,
  offers markRead (per-item), deleteNotif (per-item), clearAllNotifs (bulk)
```

## What Sprint 9 Added (Extension, Not a New System)

**1. The Operational Priority trigger** (`notifications-service.js`, inside `NS.checkAll()`): calls `window.evaluateOperationalPriority()` and `window.rankOperationalPriorities()` -- Sprint 5's engines, verbatim, zero scoring logic duplicated. Uses the same candidate-selection pattern already established in Sprint 8's report tab. Fires a notification only for `high`/`critical` results, deterministically deduplicated per animal per day (see `NOTIFICATION-LIFECYCLE.md`).

**2. `window.getUnreadNotificationCount()`** (`shared.js`) -- one shared counting function. Both the global bell badge (below) and `NS.updateBadge()` itself (refactored to call this instead of re-filtering) use the exact same logic. A duplicate implementation was found and consolidated during this sprint, not introduced by it.

**3. The global bell badge** -- `#bell-badge` was discovered, during this sprint's own discovery phase, to already exist on every page (rendered by `renderNavbar()` in `shared.js`), but only ever populated on `notifications.html` (the only page loading the full service). `window.updateGlobalBellBadge()` is a new, lightweight function (one `fbGet` + one filter, not the full generation/polling machinery) called from `renderNavbar()` on every page load, so the badge now shows a real count everywhere, not just on the notifications page itself.

**4. `NS.expireOld()`** -- read notifications older than 30 days are deleted on `notifications.html`'s own load. Unread notifications are never auto-expired regardless of age.

**5. `read_at` timestamp** -- added to `markRead()`'s write, additive and backward-compatible (older records simply lack it). Enables a real, non-fabricated average-response-time statistic in Reports.

## Data Flow Into the Rest of the App
- **Dashboard**: a small, honest unread-count link (`window.renderNotifSummaryLink()`), reusing `getUnreadNotificationCount()`. Deliberately does NOT replace the existing computed `priorityAlerts`/Unified-Priorities panels -- those are fresh, computed-on-load status; notifications are a separate, persisted history a user may not have seen yet. Different questions, both worth answering.
- **Animal Detail**: `window.renderAnimalNotifications()` filters by the new structured `animal_id`/`animal_tag` fields. Honestly scoped: only notification types that carry these fields (currently just Operational Priority) appear here -- older trigger types embed the animal reference in free text, not a queryable field, and correctly do not appear.
- **Reports**: notification statistics (unread, resolved, critical, average response time) added to Sprint 8's existing "الذكاء التشغيلي" tab -- not a new, 6th tab, per this sprint's own "avoid parallel systems" mandate.
- **Excel/WhatsApp export**: one new sheet, one new proportionate summary line -- following Sprint 8's own established pattern exactly.

## What Was Deliberately Not Built
**PDF export.** Confirmed via exhaustive search: zero PDF-generation infrastructure exists anywhere in this codebase. Building one from scratch (a new library, new code paths) would itself be a new, parallel system -- directly contrary to this sprint's explicit mandate. Documented as a real, honest gap in `docs/release/KNOWN-LIMITATIONS.md`, not silently worked around.
