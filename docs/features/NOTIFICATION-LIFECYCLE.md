# NOTIFICATION-LIFECYCLE.md

## States
`created (unread)` -> `read` (individually via `markRead`, or in bulk only as part of `clearAllNotifs`'s delete -- there is still no bulk *mark-read*, a pre-existing gap this sprint did not add scope to close) -> `deleted` (individually via `deleteNotif`, in bulk via `clearAllNotifs`, or automatically via `NS.expireOld()` if read and past the expiration window).

## Priority Model
The existing field, `type: 'danger'|'warning'|'info'`, is unchanged and still used by all 6 pre-existing triggers -- no breaking change. Sprint 9's new trigger additionally sets `priorityLevel: 'critical'|'high'|'medium'|'low'` (Sprint 5's own 4-tier scale, reused directly) as a **new, optional** field. UI code should prefer `priorityLevel` when present and fall back to a `type` mapping (danger->High, warning->Medium, info->Low) for older records that only have `type`. This keeps both old and new notifications displaying with a sensible priority, without a schema migration.

## Deduplication (Two Layers, Both Pre-Existing, Both Reused)
1. **Client-side, session-scoped**: `NS._sentIds`, a `localStorage`-persisted `Set` (capped at 100), checked before any write. This means a genuinely new browser session or cleared `localStorage` could theoretically allow a re-send -- a real, pre-existing characteristic of this system, not something Sprint 9 introduced or fixed (out of this sprint's scope; noted in `docs/features/NOTIFICATION-DISCOVERY-FINDINGS.md`).
2. **Deterministic `id` field**: every trigger builds a stable id from the source record and (for date-scoped triggers) today's date, e.g., `'opri-'+animalId+'-'+level+'-'+today` for Sprint 9's own trigger. This means the operational-priority notification for a given animal re-fires at most once per calendar day per level, even though the underlying check runs every 5 minutes while the page is open -- verified directly: three consecutive `NS.checkAll()` calls in the same session produce exactly one notification, not three.

## Expiration Strategy
`NS.expireOld()`: read AND `date` older than `NS.EXPIRE_DAYS` (30, a named constant, easy to adjust) is deleted. Unread notifications are never auto-expired, regardless of age -- the reasoning is direct: an unread notification represents something a user has not yet acknowledged, and auto-deleting it would silently hide something that may still need attention. Called once, synchronously, at the top of `notifications.html`'s own `loadNotifications()` -- not a background timer (this is a buildless static app with no server-side scheduling capability to run one).

## Read/Unread Model
`read: false` on creation. `markRead(id, href)` sets `read:true` and (new in Sprint 9) stamps `read_at` with the current ISO timestamp, then either navigates to `href` (if provided and not `'#'`) or re-renders the list in place. The `read_at` field is what makes a genuine average-response-time statistic possible in Reports -- notifications created before this sprint simply lack the field and are correctly excluded from that average, rather than contributing a fabricated zero.

## Silent vs. Critical
Not a separate field -- inferred from `type`/`priorityLevel`. `type==='danger'` or `priorityLevel==='critical'` notifications also trigger `NS.push()`, a real browser Notification API call (subject to the user having granted permission) plus an audible tone via `NS.playAlert()`. `warning`/`info`-level notifications are saved to Firebase (visible on the notifications page) but do not push a browser notification or sound -- this exact distinction already existed before Sprint 9 and is preserved, applied consistently to the new trigger (`NS.push()` is only called for `p.level==='critical'`, not `'high'`).
