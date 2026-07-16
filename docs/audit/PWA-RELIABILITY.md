# PWA-RELIABILITY.md

**Is offline safe?** Partially. `offline-sync.js`'s IndexedDB write queue is real, independent of the service worker, and not affected by the SW's dormant state. Read-path offline behavior depends on `sw.js`'s cache, which is never activated — so offline *reads* likely fail (no cache to fall back to), while offline *writes* (if the app was already loaded) may still queue correctly via `offline-sync.js`. This asymmetry was not previously stated this precisely.

**Can stale cache break users?** Not currently — since the SW is never registered, no cache is ever populated, so staleness is structurally impossible right now. This would become a real question only if/when activation happens.

**Is update strategy correct?** Unknown/moot — no active SW means no update-strategy question currently applies.

**Is data loss possible?** For offline writes specifically: no, per `offline-sync.js`'s queue design (confirmed in prior sessions). For offline reads without a warm cache: yes, effectively — the user would see empty states, not stale-but-usable data, since there's no cache to serve.

## Status: **NEEDS WORK** (not BROKEN — every component that exists is correct; the system is simply not assembled/activated)
