# NOTIFICATION-CENTER.md

## What Exists Now (After Sprint 9)

| Capability | Status |
|---|---|
| Unified notification center | `notifications.html`, pre-existing, unchanged UI structure |
| Unread counter | New: now visible on every page via the global bell badge, not just `notifications.html` |
| Read/unread state | Pre-existing (`markRead`), enhanced with a `read_at` timestamp |
| Dismiss | Pre-existing (`deleteNotif`, `clearAllNotifs`) |
| Notification history | Pre-existing -- `notifications.html`'s own list, now with automatic 30-day expiration for read items |
| Categories | Pre-existing 6 (التحصين/التكاثر/الصحة/المخزن/تسجيلات الدخول/الطقس) + 1 new (الذكاء التشغيلي) |
| Priority colors | Pre-existing 3-tier (danger/warning/info), extended with an optional 4-tier priorityLevel for new-trigger notifications |
| Automatic expiration | New: read + 30 days old -> deleted. Unread never expires |
| Deep-link navigation | Pre-existing (href + markRead navigation), extended to the new trigger (links to the specific animal's detail page) |

## Where Notifications Now Appear
1. **`notifications.html`** -- the full center, unchanged structure, same filters/categories/actions.
2. **Every page's bell badge** -- new in Sprint 9, a real unread count, not a static 0.
3. **Dashboard** -- a small "N unread -- view all" link.
4. **Animal Detail** -- recent notifications for that specific animal (currently: Operational Priority notifications only, honestly scoped to what carries a structured animal reference).
5. **Reports** ("الذكاء التشغيلي" tab) -- unread/resolved/critical counts and average response time.
6. **Excel export** -- a dedicated "الإشعارات" sheet.
7. **WhatsApp summary** -- one line, unread count.

## The One New Trigger: Operational Priority
Any animal whose composed operational priority (Weight + Health + Production + Tasks, via Sprint 5's engine) reaches High or Critical generates a notification, at most once per day per animal per level, linking directly to that animal's detail page. This is the single biggest capability this sprint adds: five sprints of intelligence work, previously invisible outside the dashboard and reports, now proactively surface as notifications.

## What a User Actually Experiences
Opening the app on any page, the bell badge now shows a real number. Clicking it goes to the full notification center, same as before. A new "أولوية تشغيلية" notification, when present, explains its score and which signals contributed (health/production/tasks), and clicking it goes straight to the animal in question -- not a generic dashboard link.

## Known, Honest Limits (Not Silently Carried Forward)
- Notification generation still only runs while notifications.html is open (the 5-minute poll) -- the badge count elsewhere reflects whatever was last generated during someone's last visit to that page, not a truly continuous background check. Expanding generation itself to run globally was judged a larger behavioral change than this sprint's scope (see docs/features/NOTIFICATION-ARCHITECTURE.md).
- Client-side, localStorage-based deduplication (pre-existing) means a cleared browser or a different device could theoretically see a re-sent notification -- not introduced or fixed by this sprint, named honestly.
- No PDF export exists for notifications (or anything else in this app) -- not built here, since doing so would mean introducing a new export system, contrary to this sprint's "no parallel systems" mandate.
