# Sprint 2 — Task 2.4.2: Service Worker Bootstrap Coverage Design (Planning Only)
**Status: No files created, no scripts added, no registration, no HTML modified.**

---

## PHASE 1 — Registration Entry Architecture

### Option A — Independent `sw-register.js`, included directly on every page that needs it
- **Coverage:** Complete and explicit — whichever pages include the `<script src="sw-register.js">` tag get registration, with no dependency on any other file's load status.
- **Complexity:** Low per-file (one line added to each page), but the largest total edit count of the three options (up to 31 individual HTML edits, or 28 if `bayan*`/`index.html` are excluded as already decided).
- **Maintainability:** High clarity — "does this page register the SW" is answered by a single, greppable script tag per page, with no indirection through another file's internal logic.
- **Migration risk:** Low — mechanical, repeatable, and this exact pattern (`*.html` pages, one new line each) is already what this Sprint's sync tool handles routinely for other changes (e.g., the manifest-linking work in Task 2.3.4/2.3.5).

### Option B — A global bootstrap file, broader in scope than SW registration alone
- **Coverage:** Complete and uniform if included identically on every page.
- **A genuine additional opportunity found during this investigation:** every sampled page's `<head>` already contains an **identical, copy-pasted inline script** for early dark/light-mode detection (`(function(){var t=localStorage.getItem('farm_theme');if(t==='light')document.documentElement.classList.add('light-mode');}());`) — confirmed present verbatim across every page checked in this Sprint's audits. A "global bootstrap file" could, in principle, consolidate *both* this existing duplicated theme-init logic *and* SW registration into one universal include, removing 31 copies of the same snippet down to one file.
- **Complexity:** Meaningfully higher than Option A or C — this option's real appeal (deduplicating the theme-init snippet) is a **larger, separate refactor** than what this task was asked to scope, since that snippet currently runs synchronously, inline, before first paint, specifically to prevent a flash of the wrong theme. Moving it into an externally-loaded file changes its loading/execution timing in a way that needs its own careful verification — a mistake here risks a visible theme-flicker regression on every single page, not just a missed SW registration.
- **Maintainability:** Best long-term outcome *if* pursued deliberately — one file for all early-boot page concerns going forward.
- **Migration risk:** Medium — touches a currently-working, delicate, render-blocking snippet. **Recommendation: valuable, but treat as a separate future task, not folded into this specific SW-registration effort.** Scope creep here would mean this task's actual goal (safe SW bootstrap coverage) inherits risk from an unrelated, larger change.

### Option C — Keep the approved `shared.js` delegation, plus direct entry points only for the specific gap pages
- **Coverage:** Complete for every page that plausibly should have it — 26 pages via the existing `shared.js` delegation (per Task 2.4.1's approved design) plus 2 more (`login.html`, `settings.html`) via a direct include, explained page-by-page in Phase 2 below. `bayan.html`/`bayan-offline.html`/`index.html`/`offline.html` remain deliberately excluded, consistent with every prior decision this Sprint has made about those specific pages.
- **Complexity:** Lowest total edit count of the three options — 1 hook in `shared.js` (already scoped in Task 2.4.1) plus exactly 2 additional page-level script tags, rather than 28–31.
- **Maintainability:** Slightly less uniform than Option A on its face (two different inclusion mechanisms — delegation for most pages, direct tags for two) — but this is a small, well-documented exception rather than a source of real confusion, and it matches how this project already handles other page-specific variances (e.g., `settings.html` already being architecturally different from most other pages in what it loads, independent of anything to do with this task).
- **Migration risk:** Lowest — the smallest possible diff that still closes the actual coverage gap found in Task 2.4.1, and builds directly on the already-approved `shared.js` delegation rather than replacing it.

**Recommendation: Option C.** It closes the exact, specific gap this task exists to address, with the smallest and most surgical change set, and without inheriting Option B's unrelated (if valuable) theme-init refactor risk. Option B's consolidation idea is worth recording as a genuine future opportunity, separate from this task.

---

## PHASE 2 — Page Coverage Matrix

**A) Loads `shared.js` — registration reaches these 26 pages via the approved delegation, no further edit needed:**
`activity.html`, `animal-detail.html`, `animals.html`, `assistant.html`, `barns.html`, `births.html`, `breeding.html`, `cost.html`, `dashboard.html`, `dead.html`, `diary.html`, `farm-profile.html`, `finance.html`, `fix-births.html`, `goats.html`, `health.html`, `import.html`, `inventory.html`, `notifications.html`, `pedigree.html`, `production.html`, `reports.html`, `sheep.html`, `tasks.html`, `users.html`, `vaccine.html`

**B) Needs a direct registration include (real, actively-used pages that don't load `shared.js`):**

| Page | What it does load instead | Why it needs direct coverage |
|---|---|---|
| `login.html` | `config.js`, `firebase.js` (confirmed directly — no `shared.js`, no `nav.js`, which makes sense: no navbar needed on a login screen) | The first page in most real sessions (per `index.html`'s redirect logic for any unauthenticated visit); the single highest-value page to register from if the goal is registering as early as possible in a user's session |
| `settings.html` | Only its own 3 inline `<script>` blocks plus `farm-react.js` — confirmed to load **no** shared project script at all, not even `firebase.js`/`config.js` | A primary sidebar destination (admin-focused), and — per Phase 3 below — also the intended home for the cache-recovery UI, making it doubly important to cover |

**C) Intentionally excluded — explained per page:**

| Page | Reason |
|---|---|
| `bayan.html` | Self-contained, independent `<style>`/`:root` system by design (established across multiple prior tasks this Sprint); doesn't load `styles.css`, `shared.js`, `firebase.js`, or `nav.js` at all — registering a caching-related feature on a page with none of the shared caching-relevant assets provides no meaningful benefit |
| `bayan-offline.html` | Same architectural reasoning as `bayan.html`; its name already signals an offline-oriented design independent of this Sprint's service worker specifically |
| `index.html` | Pure client-side redirect (confirmed 16 lines, no real UI) — navigates away to `login.html` or `dashboard.html` essentially immediately; registering here would race against that redirect for no clear benefit, since either destination page (`login.html` per the new Category B, or every Category A page) already covers registration moments later in the same session |
| `offline.html` | The fallback page itself, shown *after* something else has already failed — it has no role to play in *initiating* registration; nothing about its purpose benefits from also being a registration entry point |

**Total: 26 (A) + 2 (B) + 4 (C) = 32.** (31 real pages + `offline.html`, the one page added since the original 31-page count was established in earlier Sprint tasks.)

---

## PHASE 3 — Recovery Feature Design

**Location:** `settings.html` — unchanged from Task 2.4.1's recommendation, and now more clearly justified given Category B above already requires this page to gain its own direct SW-registration coverage regardless.

**Access control — a clarifying correction from Task 2.4.1's assumption:** Task 2.4.1 assumed `settings.html` would need `shared.js`'s `can('admin')` helper for gating, and flagged that as a blocking dependency. **Investigated further in this task: `settings.html` already has its own, independent admin-check pattern**, confirmed directly in its existing code — `if (u && u.role === 'admin') { ...reveal an admin-only section... }` (already used today to conditionally show an existing "admin reset" section on this exact page). **This removes the blocking dependency identified in Task 2.4.1** — the new cache-recovery button can reuse this exact, already-proven-working pattern rather than requiring `shared.js`/`can()` to be pulled in specially for this one feature.

**Trigger method:** A button, gated behind the same `u.role === 'admin'` check as the page's existing admin section, calling a small page-local function that performs:
```
navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_DATA_CACHE' })
```
paired with a `navigator.serviceWorker.addEventListener('message', ...)` listener specifically for the `{ type: 'DATA_CACHE_CLEARED' }` confirmation, surfaced to the admin via a simple inline success indicator (this page doesn't load `shared.js`'s `toast()` helper either, per Category B — the confirmation UI should be a small, local equivalent, not assume `toast()` is available).

**Admin/security considerations:** Unchanged from Task 2.4.1's finding — this is an operational-control gate, not a security boundary in the strict sense (`postMessage` to a service worker is inherently same-origin; there's no injection risk). Restricting it to admins prevents ordinary users from casually degrading their own offline data freshness, which is the actual (low-severity, self-inflicted) risk being managed here.

**Rollback flow:** Unchanged from Task 2.4.1 — this clears only `CACHE_DATA` (cached Firebase GET responses), not `CACHE_STATIC`/`CACHE_PAGES`. It is a narrow "force-fresh-data" tool, not a substitute for the broader version-bump rollback approach this Sprint has established for reverting `sw.js` logic itself.

---

## PHASE 4 — Final Implementation Scope (for a future task — not built here)

| Item | Detail |
|---|---|
| **Files to create** | `sw-register.js` (~20–25 lines: feature-detection guard, the registration call, silent-failure handling via `console.warn`, consistent with the one existing precedent in this codebase) |
| **Files to modify** | `shared.js` (~5 lines: `window.load` listener invoking `registerServiceWorker()` if defined); `login.html` (+1 `<script src="sw-register.js">` tag); `settings.html` (+1 `<script src="sw-register.js">` tag, **plus** the Phase 3 recovery-feature UI: a button + local trigger function + local confirmation handling, reusing the page's existing `u.role==='admin'` pattern rather than pulling in `shared.js` — roughly ~20–25 lines) |
| **Estimated LOC** | ~50–55 lines total across 4 files |
| **Testing requirements** | The five scenarios already defined in Task 2.4.1 (first registration, update flow, failed install, cache-corruption recovery, unregister flow), **plus two new, specific checks this task's findings require:** (1) confirm registration actually fires from `login.html` on a fresh, unauthenticated session — the earliest point in the funnel; (2) confirm the `settings.html` recovery button is correctly hidden for non-admin users and correctly functional for admins, exercising the page's existing (not `shared.js`-based) permission check |
| **Risks** | **Low** for `sw-register.js` and the `shared.js` hook (unchanged from Task 2.4.1). **Low** for `login.html`'s addition (a simple, well-isolated one-line inclusion on a page with few other scripts to interact with). **Low-Medium** for `settings.html`'s two combined changes (registration include + recovery UI) — this page's already-unusual architecture (no shared project scripts at all) means it deserves its own focused review pass rather than being treated as routine, even though the specific blocking assumption from Task 2.4.1 (needing `can()`) turned out to be unnecessary once its existing local admin-check was found. |

---

## Output Summary

**1. Recommended architecture:** Option C — keep the approved `shared.js` delegation for the 26 pages it already covers, and add exactly 2 direct `sw-register.js` includes for `login.html` and `settings.html`, the only real, actively-used pages the delegation-only approach would have missed.

**2. Coverage matrix:** 26 pages (A, via `shared.js`), 2 pages (B, direct include: `login.html`, `settings.html`), 4 pages (C, intentionally excluded: `bayan.html`, `bayan-offline.html`, `index.html`, `offline.html`) — every one of the 32 current pages accounted for with a specific, stated reason.

**3. Recovery design:** Unchanged location (`settings.html`) and mechanism (`CLEAR_DATA_CACHE` message) from Task 2.4.1, but with one blocking assumption **corrected**: `settings.html` does not need `shared.js`'s `can('admin')` at all — it already has its own working, equivalent admin-check pattern to reuse directly.

**4. Implementation scope:** 1 new file, 3 modified files, ~50–55 LOC, building directly on Task 2.4.1's design with the coverage gap now fully resolved rather than left open.

**5. Risks:** Low across the board, with `settings.html` specifically flagged for its own focused review given its pre-existing architectural distinctness — not because of any new risk this task introduced, but because that page was already different from the rest of the project before this task began looking at it.

**6. Waiting for approval before any implementation.**
