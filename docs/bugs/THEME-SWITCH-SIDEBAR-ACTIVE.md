# THEME-SWITCH-SIDEBAR-ACTIVE.md

## Root Cause
`.sidebar-item.active` (`styles.css`) styled its background with `var(--green)`, a CSS custom property that is intentionally redefined between themes: `#34d399` (a bright, saturated green) in dark mode, `#065f46` (a much darker forest green) in light mode. The rule's text color, however, was a fixed, hardcoded `#022c22` (a near-black green), unaffected by theme.

The sidebar's own background (`--sb-bg`) is a dark gradient in both themes -- a deliberate branding choice, not a bug. `--green` was designed as an accent value that should get darker in light mode so it reads correctly as text or a small accent against a light page background -- but `.sidebar-item.active` was using it as a background, against the sidebar's own permanently-dark backdrop. In light mode this produced a `#065f46` background with `#022c22` text: two very similar dark greens, measured contrast ratio ~1.98:1, far below the WCAG AA minimum of 4.5:1 for text.

## Why It Happened
Not a re-render bug, not a caching bug, not a duplicated-logic bug. `toggleTheme()` (`shared.js`) correctly toggles the `light-mode` class and CSS correctly cascades the new `--green` value -- the mechanism works exactly as designed. The defect was a single CSS rule reusing a theme-variable in a context (a permanently-dark sidebar) where the variable's light-mode value was never intended to apply. Confirmed directly: no other part of theme switching, sidebar rendering, or active-item logic was touched or needed to be.

## Exact Fix
One CSS rule, `styles.css`:
```diff
- .sidebar-item.active{background:var(--green)!important;color:#022c22;border-right-color:var(--green);font-weight:700}
+ .sidebar-item.active{background:#34d399!important;color:#022c22;border-right-color:#34d399;font-weight:700}
```
`background`/`border-right-color` now use the fixed bright-green value (identical to what `--green` already resolved to in dark mode) instead of the theme-swapping variable. `color` is unchanged. Resulting contrast ratio against the fixed background: ~7.88:1, well above WCAG AA.

## Why No Refactor Was Needed
The bug was fully explained by one rule's use of the wrong value source -- not by any structural issue in `toggleTheme()`, `renderNavbar()`, or the sidebar's DOM structure. Confirmed live: dark mode's computed styles are byte-identical before and after the fix; the sidebar DOM node's identity is preserved across a theme toggle (no re-render occurs, none was ever needed); the fix holds correctly even under a separate, pre-existing, unrelated inconsistency (see below) where the page's early anti-flash script applies `.light-mode` to `<html>` but not `<body>` on first load -- because this rule's color source was never selector-dependent on either element, only on the cascaded `--green` variable.

## A Separate Observation, Not Fixed Here
During verification, `document.documentElement` (`<html>`) and `document.body` were found to diverge on a fresh page load with a persisted light theme: the early inline script (`if(t==='light')document.documentElement.classList.add('light-mode')`, present at the top of every page) sets the class on `<html>` only, while `toggleTheme()` at runtime sets it on both `<html>` and `<body>`. Verified this does not affect the sidebar active-item fix (CSS variables cascade correctly from `<html>` alone) and no other visual defect was found to trace to it during this investigation. Named here for the record, deliberately not touched -- doing so would mean editing the theme-application script, outside this hotfix's "smallest possible change" mandate for a defect that, as far as this investigation could establish, causes no actual visual bug today.

## Regression Prevention
`tests/regression/theme-sidebar-active.spec.js` -- 9 tests: WCAG AA contrast in light mode (computed via the actual relative-luminance formula, not a visual snapshot), dark mode byte-identical to pre-fix, both toggle directions, a different page after switching, persistence across a real page refresh, mobile drawer, desktop sidebar, confirmation that unrelated systems (bell badge, notification dropdown, theme icon) are untouched, and confirmation that the sidebar DOM node is never recreated by a theme toggle.
