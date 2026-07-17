# DEPENDENCY-MAP.md

## npm Dependencies (Dev-Only, Verified)
**Exactly one**: `@playwright/test ^1.56.0` -- used exclusively by `tests/`, never loaded by any page a user visits. The shipped application has **zero runtime npm dependencies**. This is a deliberate architectural strength (see `ARCHITECTURE-REFERENCE.md`), not an oversight -- nothing to upgrade, nothing to go stale, for the application itself.

## External Libraries (CDN-Loaded, Verified by Direct Search)
| Library | Version | Loaded By | Purpose |
|---|---|---|---|
| Bootstrap | 5.3.3 (pinned) | Every page | CSS framework |
| Bootstrap Icons | 1.11.3 (pinned) | Every page | Icon font |
| Google Fonts (Cairo, Lexend) | latest (unpinned, Google's own CDN) | Every page | Arabic + Latin typefaces |
| Chart.js | Two references found: 4.4.1 (pinned, cdnjs) and an unpinned jsdelivr URL | Different pages -- worth reconciling to one version in a future pass, not a defect for this release | Charts on reports.html/bayan-offline.html |
| SheetJS (xlsx) | 0.18.5 (pinned) | Export-to-Excel functionality | Client-side spreadsheet generation |
| React (pre-bundled) | Bundled into farm-react.js, not separately versioned in source | reports.html/settings.html, lazy-loaded | Advanced chart components |

**A genuine, minor finding from this audit**: Chart.js is referenced at two different CDN paths (one version-pinned, one not) across different pages. Not a functional defect -- both resolve to working Chart.js instances -- but worth consolidating to one pinned version in a future maintenance pass for consistency. Not fixed in this handoff (would be a code change, outside this task's "no behavior modification" mandate).

## Firebase Usage
**No Firebase SDK.** All Firebase Realtime Database access is direct REST calls (`fbGet`/`fbPost`/`fbPatch`/`fbDelete` in `firebase.js`), authenticated via the database's own REST auth token parameter, not the SDK's client library. This means: no `npm install firebase`, no Firebase-specific bundler config, and no SDK-version upgrade risk ever, for this project specifically.

## Internal Module Dependency Graph
```
config.js  (no dependencies -- pure data)
    |
firebase.js  (depends on config.js's values; no other internal dependency)
    |
nav.js  (depends on firebase.js's can()/getUser())
    |
shared.js  (depends on firebase.js's fbGet/fbPost/fbPatch/fbDelete, ar()/getUser() etc.;
             the 5 intelligence engines depend on EACH OTHER as documented in
             ARCHITECTURE-REFERENCE.md, and on nothing outside shared.js/firebase.js)
    |
offline-sync.js  (depends on firebase.js's fetch wrapper pattern)
    |
pages/<feature>.js  (depends on shared.js + firebase.js + nav.js; independent of each other --
                      no pages/*.js file imports another pages/*.js file)
```
Every page loads this exact chain in this exact order (`config.js -> firebase.js -> nav.js -> shared.js -> offline-sync.js -> pages/<feature>.js`) -- confirmed as the established, consistent pattern across all 31 HTML pages.

## Potential Upgrade Risks
- **@playwright/test**: low risk (dev-only, fast-moving but isolated from production).
- **Bootstrap/Bootstrap Icons**: pinned, low risk -- a major-version bump would need a deliberate, tested upgrade pass (Bootstrap 6 is not yet released as of this writing).
- **Chart.js version inconsistency** (above): low risk today, worth resolving before it causes a real behavioral difference between pages.
- **SheetJS**: pinned at a specific version; the library has had past security advisories in older versions -- worth checking current CVEs before any long-term deployment, though 0.18.5 is a relatively recent release as of this project's own timeline.
- **Google Fonts**: unpinned by nature (Google's own CDN serves the latest matching font files) -- effectively zero practical risk for a font resource.
