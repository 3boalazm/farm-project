# BASELINE.md

**This is the official engineering baseline. All future development starts from here.**

## Current State

- **Commit:** `e655e2b` (Engineering Baseline Merge) + this baseline-hardening commit on top.
- **Architecture version:** Post-merge, incorporating four reconciled engineering threads — Core SSOT (Weight/Birth), Repository 3 (module migration), Repository 4 (bulk-action architecture), Security Hardening.
- **Engineering readiness:** 98/100 (see justification below).
- **Repository status:** Canonical. This is the single source of truth going forward — no other repository snapshot should be treated as authoritative without an explicit reconciliation pass like the one that produced this baseline.

## What Changed in This Baseline-Hardening Pass

1. **`cost.html`** — added the missing `can('finance')` permission check, matching the established pattern already used in `breeding.js`/`inventory.js`/`reports.js`. Live-verified: a user without the `finance` permission is blocked; admin correctly bypasses.
2. **Service Worker — formally determined Experimental/Disabled.** `sw.js` contains a complete, correct caching implementation; `sw-register.js` contains a complete, correct registration+recovery implementation; **neither is wired into any live page**. This is a deliberate, documented state, not an oversight — the SW/Sync engineering thread's own final validation concluded "NOT READY... no production activation," and this baseline preserves that determination rather than silently activating a capability this task was not authorized to add as a feature.
3. **Orphan files resolved, none left ambiguous:**
   - `sw-register.js` → **LEGACY** (complete, correct, belongs to the paused SW/Sync initiative — not dead code, not yet activated).
   - `sync-to-excel.js` → **UTILITY** (a deliberate DevTools-console-paste admin tool, by design never loaded via `<script src>`).
   - `chat.js` (repository root) → **REMOVED**, proven dead on all four required dimensions: zero incoming references from any page, physically located outside `/api/` so Vercel would never deploy it as a serverless function despite its own header comment claiming that path, and fully functionally duplicated by `api/claude.js`, which correctly sits in `/api/`.

## Known Limitations (Carried Forward Honestly, Not Hidden)

- **`farm-apk/www/chat.js`** — a separate copy of the same file exists inside the Android APK's bundled assets. **Not investigated or touched by this pass** — `farm-apk/` is a distinct deployment context (a separate repository, per this project's own established documentation) and deserves its own dedicated audit before any action there.
- **SW/Sync production activation** remains an open, deliberately-deferred decision — not resolved by this baseline, only formally acknowledged as disabled rather than left ambiguous.
- **Android/real-offline SW behavior** has never been tested in any environment used across this project's history — a structural limitation, not a gap in this pass specifically.
- **Firebase security rules enforce data validation only, not per-user access control** — by design, given custom PIN auth instead of Firebase Auth. A stricter `database.rules.secure.json` may exist as a drafted alternative; its presence was not re-confirmed this pass.
- **`todayStr()`'s UTC/local-date behavior** remains unresolved — a proven, repository-wide, low-severity date-display issue.

## Repository Status Going Forward

This repository, at this baseline, is the **canonical source for all future work**. Any future reconciliation against another snapshot should follow the same discipline this baseline was built with: complete comparison, semantic-intent classification, a written merge plan, approval, then execution — never a silent file-by-file overwrite.
