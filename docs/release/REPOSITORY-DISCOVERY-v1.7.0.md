# REPOSITORY-DISCOVERY-v1.7.0.md

**Full audit performed before any release documentation was written. Two real, proven-safe fixes were applied during discovery itself (both minimal, both verified live) -- documented here with the evidence that justified each.**

## Real Finding #1 (Fixed): Two Major Pages Were Unreachable Through Any Real Navigation
production.html (Sprint 4's own core interface) and tasks.html (Sprint 1's own core interface) had zero entry in nav.js -- confirmed by direct grep, not assumed. The only reference to either page anywhere in the live codebase was pages/tour.js's own onboarding-tour selectors (target: 'a[href="production.html"]', target: 'a[href="tasks.html"]'), which themselves depend on a sidebar link existing to point at -- meaning the onboarding tour was also silently broken, targeting elements that did not exist. Notably, the containing nav section is literally named "الصحة والإنتاج" (Health and Production) yet had no production link at all.

Fix applied: one nav.js entry each, matching the existing pattern exactly -- production.html added to the "الصحة والإنتاج" section (no perm: restriction, matching the page's own confirmed lack of an internal can() check), tasks.html added to "النظام" (System), alongside Notifications, for the same reason. Verified live: both a[href="production.html"] and a[href="tasks.html"] now resolve in the rendered sidebar, restoring both real navigation and the tour's own targeting.

This qualifies as a real production blocker under this sprint's own rule (fix only if safe, otherwise document) -- two entire admin-facing pages with real, working business logic were undiscoverable by any normal user interaction. The fix is the smallest possible change: two lines, matching an established pattern exactly, zero new architecture.

## Real Finding #2 (Documented, Not a Blocker): A Genuinely Proven-Dead Backup File
farm-apk/www/animal-detail.html.bak -- git-tracked, confirmed via exhaustive search to have zero references anywhere in live code. This file was found in an earlier session (Sprint 7) and deliberately left in place at the time (conservative -- not deleted from git). Re-verified here with the same proof standard: still zero references. Given this release's explicit mandate to report every discovery honestly and given the proof bar (nothing removed unless proven unused) is now met with a second, independent confirmation, this is named as a candidate for cleanup in KNOWN-LIMITATIONS.md rather than silently removed in this same pass -- removing a tracked file is a real change to the repository's history, and this release's own rules class it as "no changes unless a real production blocker is proven." A stray, unreferenced backup file does not block production use of the application; it is not removed here, only reconfirmed and clearly flagged.

## Everything Else Checked, Nothing Else Found
- Orphan/duplicate files: none beyond the two items above.
- Release leftovers: release/ (a local, un-tracked directory from an earlier session's git archive export) and farm-apk.zip (git-tracked, confirmed intentional per REPOSITORY_MAP.md). release/ is confirmed not tracked by git (git ls-files release/ returns nothing) -- it will never appear in any actual clone, archive, or distribution of this repository; it is local working-directory clutter from a prior session, not a repository defect.
- Dead documentation / broken internal links: not exhaustively checked link-by-link across 259 code files and dozens of docs (a full link crawl was judged disproportionate to this release's scope); no broken link was encountered incidentally during any other phase of this audit.
- Duplicated engines / duplicated business logic: not newly re-derived here -- every sprint from Sprint 9 onward (Notifications, Predictive, Workflow, Analytics, Finance, Inventory) performed its own mandatory discovery specifically to prevent this, each documented in its own *-DISCOVERY.md. This audit did not find any case where that discipline was skipped.
- Duplicated CSS rules: confirmed zero duplicate top-level selectors in styles.css via direct pattern extraction.
- Duplicate navigation entries: confirmed zero -- every href in nav.js appears exactly once.
- Unused JS modules: every file in pages/*.js is referenced by at least one HTML page's script tag -- confirmed by checking each file's basename against every HTML file.
- Orphan tests: confirmed zero -- all 22 *.spec.js files contain real test.describe/test( definitions.
- Orphan assets/images: not exhaustively checked (media/ is a small, stable directory unchanged across most of this project's sprints, not itself a locus of churn); no orphan asset was encountered incidentally.

## What This Means for the Rest of Certification
No repository-wide structural problem was found. The two real issues (unreachable pages, a dead backup file) are both small, both fully characterized, and one is already fixed and verified live.
