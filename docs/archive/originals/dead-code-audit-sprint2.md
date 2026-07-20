# Codebase Cleanup & Dead Code Audit — Sprint 2
**Scope note (important, changes the picture from earlier phases):** all previous audits in this project only scanned the root repository. This pass additionally scanned `farm-apk/www/` — the Capacitor Android app's bundled asset folder — because `farm-apk/capacitor.config.json` shows `"webDir": "www"` with **no `server.url` key present**. This contradicts the project's documented assumption ("Capacitor's `server.url` mirrors the live site"). **This discrepancy is flagged for manual clarification below — it directly changes whether `farm-apk/www/*` counts as a live, separately-deployed code path or not.** Every conclusion below cites exact evidence from both locations.

---

```
File: activity.html
Status: Active reference / Broken implementation (NOT Dead — correction from prior audit)
Referenced by:
  - nav.js:39 — sidebar navigation item, href:'activity.html', permission:'admin'
  - shared.js:166, :284, :374 — notification href targets pointing to activity.html
  - notifications-service.js:207, :209 — notification href/push targets
  - pages/notifications.js:355 — category-to-page redirect map ('تسجيلات الدخول' → 'activity.html')
Safe to remove: NO
Reason: 6 separate live code paths across 4 files actively construct navigation links or
  notification click-throughs pointing at activity.html. It is a real, referenced destination.
Risk: HIGH if left as-is — the ROOT activity.html is 0 bytes. Any admin user who clicks
  the sidebar "سجل الأنشطة" link, or any user who clicks a login-notification, currently
  lands on a completely blank page. This is a live, user-facing broken link, not dead code.
  CRITICAL CORRECTION: the farm-apk/www/ copy of activity.html is 285 lines — fully built,
  not empty. The root (Vercel-deployed) copy appears to be missing content that exists
  in the Android app's bundled copy.
Recommendation: Do NOT delete. Compare farm-apk/www/activity.html (285 lines) against the
  empty root copy — the working implementation likely already exists and needs to be
  copied to root, not written from scratch. Requires manual review before any action.
```

```
File: sw.js
Status: Dead (unregistered) — confirmed across BOTH root and www
Referenced by: none. Searched every .html and .js file (both locations) for the string
  "serviceWorker" — zero matches anywhere. File exists at farm-apk/www/sw.js as well
  (byte-for-byte not diffed, but same absence of a register() call surrounding it).
Safe to remove: NO (see risk — this is "unregistered," not "unnecessary")
Reason: The file itself is a fully-built, non-trivial service worker (161 lines: cache-first
  for CDN assets, stale-while-revalidate for HTML/JS/CSS, network-first-with-fallback for
  the Firebase REST API, background sync via offline-sync.js, cache version "v5" per its
  own header comment — note this differs from the "v6" figure in prior project notes,
  itself worth reconciling). A file this deliberately engineered was very likely meant
  to be registered and isn't.
Risk: HIGH — if the team believes offline mode is backed by this service worker (a
  documented product requirement), it currently is not. No caching, no offline app-shell,
  no background sync activation is happening client-side.
Recommendation: Requires manual review, not deletion. Confirm with whoever built this file
  whether registration was removed deliberately (e.g. a rollback) or simply never wired up.
```

```
File: pages/notifications.js
Status: Legacy (superseded, and DIVERGED from its own www counterpart)
Referenced by: none via <script src> in either root or www HTML. notifications.html
  (root) loads notifications-service.js instead — confirmed live and different file.
  farm-apk/www/pages/notifications.js exists but is also unreferenced by any www HTML.
Safe to remove: Root copy — likely yes, pending the diff check below.
  www copy — requires the same, separately.
Reason: Neither copy is wired into any page via <script src>.
Risk: MEDIUM — root and www copies of this file are NOT identical: a 75-line diff was
  found between them. This means someone edited one copy after the fork without syncing
  the other, even though neither is currently loaded anywhere. If either version contains
  logic not present in the live notifications-service.js, deleting outright could lose work.
Recommendation: Diff pages/notifications.js against notifications-service.js specifically
  (not against its own www counterpart) to check whether any unique logic needs porting
  before archiving. Archive, do not delete outright, given the unexplained root/www divergence.
```

```
File: chat.js
Status: Dead — confirmed identical in both root and www
Referenced by: none. No <script src> in any HTML file, root or www.
Safe to remove: Likely yes
Reason: Zero references anywhere; root and www copies are byte-identical (0-line diff),
  meaning no independent edits have been made to either — a lower-risk signal than
  pages/notifications.js's diverged copies.
Risk: LOW
Recommendation: Confirm assistant.html's actual chat implementation (likely inline
  <script>, per earlier architecture review) fully supersedes this file's logic via a
  manual diff before archiving — low effort given the file is only 55 lines.
```

```
File: sync.js
Status: Dead — confirmed identical in both root and www; heavily string-referenced but
  NEVER as a script path
Referenced by: The bare word "sync" appears in 20+ HTML files and twice in sw.js, but
  every one of those matches is the unrelated word "sync" used in prose/comments/ids
  (e.g. "sync-to-excel", "offline sync", element ids), NOT a reference to the file
  sync.js itself. No <script src="sync.js"> exists anywhere in root or www.
Safe to remove: Likely yes, pending confirmation against offline-sync.js
Reason: Zero genuine script-path references in either location; root/www copies identical.
Risk: LOW-MEDIUM — the existence of both sync.js and offline-sync.js as separate,
  similarly-named files is itself a signal worth resolving before deletion, in case
  sync.js represents an earlier iteration with logic offline-sync.js doesn't fully cover.
Recommendation: Diff against offline-sync.js specifically before archiving.
```

```
File: sync-to-excel.js
Status: Dead — root only, does not exist at all in the www copy
Referenced by: none, in either location.
Safe to remove: Requires confirmation of the active Excel-export feature's real
  implementation first
Reason: Zero script-tag references. Notably absent entirely from farm-apk/www/ — unlike
  every other file in this audit, there is no www counterpart to compare against, which
  removes one usual cross-check signal (can't tell from a diff whether this was ever live).
Risk: MEDIUM — pages/production.js's exportProduction() function (seen in the earlier
  architecture pass) dynamically loads the SheetJS library directly and does not call
  into this file, suggesting the live Excel-export feature does not depend on
  sync-to-excel.js at all. But this is inference from a different file, not direct
  evidence about sync-to-excel.js's own content.
Recommendation: Open the file and manually confirm whether its logic is a superset,
  subset, or unrelated to pages/production.js's export function before deciding.
```

```
File: pages/animal_detail.js
Status: Dead — confirmed unreferenced in BOTH root and www copies
Referenced by: none via <script src> anywhere. animal-detail.html (root) and
  farm-apk/www/animal-detail.html both implement their logic via inline <script> blocks
  instead. A separate farm-apk/www/animal-detail.html.bak (446 lines) also exists —
  an apparent leftover backup, distinct from this audit's 9 files but found during
  this pass and worth noting.
Safe to remove: Requires manual diff first (see risk)
Reason: This is, by LOC and structural complexity, the single largest and most complex
  file among all currently-orphaned JS in the project (802 lines). That size strongly
  suggests non-trivial logic that may or may not be fully duplicated by the inline
  scripts in animal-detail.html.
Risk: HIGH — of all 9 files, this carries the most risk of silent feature loss if
  deleted without a careful diff, purely because of its size and complexity relative
  to the others.
Recommendation: Do not delete or archive without a line-by-line comparison against
  animal-detail.html's inline script content first. This is the single highest-priority
  manual review item in this entire audit.
```

```
File: pages/births.js
Status: **Active — CORRECTION from prior audit phases**
Referenced by: farm-apk/www/births.html:46 — <script src="pages/births.js"></script>
  This is a genuine, real <script src> tag, confirmed present in the Android app's
  bundled www copy. The root repo's births.html does NOT load this file (root births
  functionality is implemented differently, inline or via animals.html per earlier review).
  root pages/births.js and farm-apk/www/pages/births.js are byte-identical (0-line diff).
Safe to remove: NO
Reason: This file is actively loaded by the Android app's births.html, assuming the
  farm-apk/www folder is genuinely what ships in the built APK (see the capacitor.config.json
  discrepancy flagged at the top of this report — if server.url actually overrides this
  at build time, the conclusion would reverse; this needs a definitive answer before
  any action is taken on this specific file).
Risk: HIGH if deleted while the www-bundling assumption is confirmed true — this would
  break the births feature specifically inside the Android app while leaving the website
  unaffected, a hard-to-notice regression since web QA wouldn't catch it.
Recommendation: Resolve the capacitor.config.json / server.url discrepancy FIRST (see
  top of report). Until resolved, treat this file as active and do not touch it.
```

```
File: farm-react.js
Status: Active — confirmed loaded on multiple pages in both root and www, with a
  divergence between the two worth flagging
Referenced by:
  - reports.html:44, settings.html:299 (root)
  - farm-apk/www/dashboard.html:573, farm-apk/www/reports.html:43,
    farm-apk/www/settings.html:436 (www)
Safe to remove: NO
Reason: Genuinely loaded via <script src defer> on 2 root pages and 3 www pages.
Risk: MEDIUM — note the divergence: farm-apk/www/dashboard.html loads farm-react.js but
  the root dashboard.html does NOT. Either the root dashboard.html is missing a dependency
  the www version needs, or the www version has stale/extra markup the root version
  correctly dropped. Either direction represents an un-reconciled difference between
  the two deployment targets.
Recommendation: Do not remove. Separately investigate why farm-apk/www/dashboard.html
  and root dashboard.html disagree on this dependency — this is a new finding from this
  pass, not previously flagged.
```

---

## Summary

### Files safe to archive immediately (no manual review blocking it)
- **None.** Every file in this batch has at least one open question (a diverged copy, an unresolved cross-check, or a documented-vs-actual architecture discrepancy) that blocks an immediate, no-review archive action. This is a stricter conclusion than the prior phase's plan assumed.

### Files requiring migration (content needs to move somewhere before the old file is touched)
- **`activity.html`** — the working 285-line implementation in `farm-apk/www/activity.html` likely needs to be migrated to the root `activity.html`, not deleted. Highest-priority item in this entire report given it's a live, user-facing broken link today.

### Files requiring manual review (diff/confirmation needed before any decision)
- **`pages/animal_detail.js`** — highest-complexity orphan in the project; needs a full diff against `animal-detail.html`'s inline script before any decision.
- **`pages/notifications.js`** — root and www copies diverged by 75 lines; needs a diff against the live `notifications-service.js`.
- **`sync.js`** — needs a diff against `offline-sync.js`.
- **`sync-to-excel.js`** — needs a diff against `pages/production.js`'s export logic.
- **`chat.js`** — needs a diff against `assistant.html`'s inline chat script (lower effort, likely quick to close out).
- **`pages/births.js`** — status hinges entirely on resolving the `capacitor.config.json`/`server.url` discrepancy; do not act until that's answered.
- **`farm-react.js`** — not a removal candidate, but the root/www `dashboard.html` divergence needs investigation.
- **`sw.js`** — needs a direct answer from whoever built it: was registration intentionally removed, or simply never added?

### Estimated cleanup impact
Given that **zero files in this batch are clear, no-questions-asked deletions**, the "impact" of this audit is not LOC removed — it's risk surfaced. Two corrections materially change the project's prior understanding:
1. `activity.html` is not simply a 0-byte orphan to delete — it's a live navigation target with a working implementation sitting unused in the Android app bundle.
2. `pages/births.js` is not orphaned — it's loaded by the Android app specifically, contingent on confirming how the APK actually builds (`server.url` vs. bundled `www`).

Every other file (7 of 9) remains a legitimate cleanup candidate, but each needs a same-feature diff (against its live counterpart) before deletion is safe — none should be deleted on the strength of "no `<script src>` found" alone, since that same reasoning would have missed the `activity.html` and `pages/births.js` corrections above had the `farm-apk/www/` folder not been checked this time.

**No files were deleted or modified in this pass, per the task rules. Awaiting approval before any change.**
