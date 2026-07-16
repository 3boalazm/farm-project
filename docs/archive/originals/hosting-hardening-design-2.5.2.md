# Sprint 2 — Task 2.5.2: Service Worker Hosting Hardening (Design Only)
**Status: No changes applied. `vercel.json` on disk is exactly as it was before this task.**

---

## PHASE 1 — Current Configuration Audit

**Files inspected:** `vercel.json` (the only deployment-configuration file in this project — confirmed no `.vercel/` folder, no `now.json`, no other routing/build config exists anywhere in the repo).

**Full current content:**
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    }
  ]
}
```

| Aspect | Finding |
|---|---|
| Existing headers | Exactly one rule, scoped to `/api/(.*)` — CORS headers for the serverless functions only |
| Existing rewrites | None |
| Existing redirects | None |
| Existing routes (legacy Vercel config style) | None |
| Cache-behavior controls for any static file | **None whatsoever** — `/sw.js`, `/manifest.json`, `/offline.html`, and every other static asset in the project are all served under Vercel's undifferentiated platform default, with zero project-level override of any kind |

This confirms, with certainty (not inference), the exact gap Task 2.5.1 flagged: there is nothing in this project's own configuration that treats `/sw.js` any differently from an ordinary, rarely-changing static file.

---

## PHASE 2 — Header Design

**Smallest possible change: add two new entries to the existing `headers` array — nothing else in the file is touched.**

```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,POST,OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    },
    {
      "source": "/sw.js",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache, no-store, must-revalidate" }
      ]
    },
    {
      "source": "/manifest.json",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, must-revalidate" }
      ]
    },
    {
      "source": "/offline.html",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=3600, must-revalidate" }
      ]
    }
  ]
}
```

**Design reasoning, per file:**

- **`/sw.js` → `no-cache, no-store, must-revalidate`:** The strictest, most explicit combination available. `no-store` ensures neither the browser's HTTP cache nor any intermediate CDN layer retains a copy at all — every request for `/sw.js` reaches the origin (or is revalidated) fresh. This directly satisfies "browser always checks for updates" and "CDN does not keep stale Service Worker versions" as literally as an HTTP header can guarantee. `sw.js` is a small file (161 lines); the cost of never caching it is negligible, and this exact header combination is the widely-documented standard recommendation specifically for service worker files, precisely because ambiguity here is the single most common cause of "why isn't my service worker updating" problems in real deployments.
- **`/manifest.json` and `/offline.html` → `public, max-age=3600, must-revalidate`:** A deliberately less strict policy than `/sw.js` — these two files change far less often (the manifest is essentially static; the offline-fallback page has no reason to change frequently) and don't carry the same "must detect updates immediately" requirement a live-controlling service worker does. A 1-hour cache with `must-revalidate` gives "reasonable freshness" (the task's own wording) without the overhead of disabling caching entirely for files that don't need it.

**Why this doesn't affect JS/CSS/image assets or application caching, by construction, not by assumption:** every `source` pattern above is an **exact, literal path** (`/sw.js`, `/manifest.json`, `/offline.html`) — none of them are wildcards or regex patterns that could ever match `/shared.js`, `/styles.css`, `/pages/*.js`, or anything else. The existing `/api/(.*)` rule is left completely untouched. There is no mechanism by which this change could bleed into any other file's caching behavior.

---

## PHASE 3 — Risk Analysis

| Proposed change | Affected file | Exact lines (in the proposed patch above) | Side effects | Rollback method |
|---|---|---|---|---|
| Add `/sw.js` header rule | `vercel.json` | New object, 2nd entry in the `headers` array (6 lines) | `sw.js` will be re-fetched from origin on every request rather than served from cache — negligible cost given the file's small size (161 lines); the *intended* effect is faster update detection, which is the entire point of this change, not a side effect | Remove the added JSON object; `vercel.json` reverts to its exact current state |
| Add `/manifest.json` header rule | `vercel.json` | New object, 3rd entry (6 lines) | Manifest re-validated hourly instead of relying on undefined default behavior — no functional impact on installability prompts or PWA metadata, which don't change based on cache freshness alone | Remove the added JSON object |
| Add `/offline.html` header rule | `vercel.json` | New object, 4th entry (6 lines) | Same reasoning as manifest.json — the page's content is static and rarely edited; hourly revalidation is simply a freshness ceiling, not a functional change | Remove the added JSON object |

**Cumulative risk of all three changes together:** **Low.** Every change is:
- Purely additive to an existing, already-working configuration file (no existing rule is modified or removed).
- Scoped by exact literal path matching, with zero possibility of affecting any other file.
- A configuration change only — no application code, no `sw.js` logic, no registration logic is touched, consistent with this task's constraints.
- Trivially reversible by deleting the added JSON entries; nothing about this change is stateful or requires a version bump/cache-clear cycle to undo, unlike changes to `sw.js` itself.

**One thing this change does *not* do, worth stating precisely:** it does not, by itself, activate the service worker or change anything about whether real users are affected today — `vercel.json` header rules only take effect for requests that are actually being served, and application logic (registration) remains exactly as disabled/enabled as it already is. This is purely a hosting-layer readiness improvement, independent of the separate activation decision.

---

## Output Summary

**1. Current configuration findings:** `vercel.json` contains exactly one header rule (API CORS only); no cache-control policy exists anywhere for `/sw.js`, `/manifest.json`, or `/offline.html` — confirmed directly, not inferred.

**2. Proposed patch:** Two new header-rule objects added to the existing `headers` array — `/sw.js` gets `no-cache, no-store, must-revalidate`; `/manifest.json` and `/offline.html` each get `public, max-age=3600, must-revalidate`. Full JSON shown above.

**3. Expected impact:** `/sw.js` becomes guaranteed-fresh on every request (closing the exact gap Task 2.5.1 found); `/manifest.json`/`/offline.html` get a defined, reasonable freshness ceiling instead of an undefined default. Zero impact on any JS/CSS/image asset or on the application's own caching strategy (`sw.js`'s internal `CACHE_STATIC`/`CACHE_PAGES`/`CACHE_DATA` logic is entirely separate from HTTP-level headers and is untouched).

**4. Risk level: Low**, for all three changes individually and cumulatively — additive, exact-path-scoped, trivially reversible, and does not touch application code or activation state.

**5. Waiting for approval. No changes have been applied to `vercel.json` or any other file.**
