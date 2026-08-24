# Engineering Process & Active Priority Order

**Set 2026-08-23, by explicit user directive, after the `renderNavbar()` cleanup.** This is a standing process, not a one-off task list — read it before starting any new work in this repository.

## The discipline

Every change goes through: **Audit → Fix → Test → Verify → Commit → Deploy → Production Verify.** Audit is its own phase — findings get reported before anything is fixed, not silently patched mid-scan. No new feature work starts while a higher-priority item below is open.

## Active priority order

| # | Item | Status |
|---|---|---|
| 1a | 🟢 XSS fix — the 25 sinks from `XSS-AUDIT-2026-08-23.md` | **Done** — see `docs/repository/XSS-FIX-2026-08-24.md`. Fixed, tested (39/39), live-verified, regression-guarded (`scripts/safety-scan.js` Check 4), committed |
| 1b | 🟢 XSS fix round 2 — 41 VULNERABLE + 5 REQUIRES-HARDENING sinks found by the mandated re-scan after 1a (`animals.html`, `animal-detail.html`, `import.html` — the root-cause entry point — `pages/{health,breeding,vaccine,production,tasks}.js` sibling widgets, `shared.js`'s `renderInventoryStockIndicator()`, `cost.html`) | **Done** — see `docs/repository/XSS-FIX-2026-08-24.md`'s "Round 4" and "Rounds 6-9" sections. Round 4's own 5-pass loop (1→8→1→5→0) claimed the acceptance gate first; a second, independent confirmation loop (Rounds 5-9) re-tested that "0" and found it wrong twice more (2, then 1, then 1, then 1) before a ninth, collection-by-collection sweep genuinely found zero. Every fix tested (39/39 throughout), live-verified where feasible, regression-guarded (157 sinks / 27 files in Check 4), committed. Known, tracked, NOT remediated: `farm-apk/www/` (the Android/Capacitor copy) carries none of these fixes — see `docs/repository/RISK_REGISTER.md` |
| 2 | 🟠 Production verification — confirm the accounting engine (Phases 1-43) actually reached production, not just this repo | Not started |
| 3 | 🟠 Design System compliance scan — audit against the token/component work already done | Not started |
| 4 | 🟡 Dead-code / legacy audit — systematic, not opportunistic (renderNavbar() was one instance, found by accident) | Not started |
| 5 | 🟡 Remaining accounting-engine features | Blocked on 1-4 |

Update this table's Status column as each item moves; don't let it go stale the way `docs/repository/RISK_REGISTER.md`'s `submitBirthDirect()` line briefly did.
