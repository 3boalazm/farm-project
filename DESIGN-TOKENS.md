# Design Tokens Reference — بيان المزرعة

**Phase 1 (Visual Foundation) deliverable.** Audited from `styles.css` as it exists today. This document is the reference; the CSS variables are the implementation. Nothing here changes business logic, Firebase calls, or data models — CSS only.

---

## 1. Typography Scale

The file had **30 near-duplicate font-sizes** between `.58rem` and `2.6rem` (e.g. `.71rem`, `.72rem`, `.73rem`, `.75rem`, `.76rem` — five values doing one job). Consolidated to 8 named steps; every `font-size` in the file now references one of these.

| Token | Value | ~px | Typical use |
|---|---|---|---|
| `--text-2xs` | `.65rem` | 10.4px | Smallest labels, footnotes |
| `--text-xs` | `.72rem` | 11.5px | Badges, table headers, captions |
| `--text-sm` | `.82rem` | 13.1px | Body small, buttons, table cells |
| `--text-base` | `.92rem` | 14.7px | Default body text |
| `--text-lg` | `1.1rem` | 17.6px | Card titles, emphasis |
| `--text-xl` | `1.45rem` | 23.2px | `stat-mini` numbers |
| `--text-2xl` | `1.8rem` | 28.8px | `summary-number` (KPI values) |
| `--text-3xl` | `2.6rem` | 41.6px | Farm Health Score only — deliberately its own tier |

---

## 2. Spacing Scale

4px base unit. Not yet force-applied to every existing `padding`/`margin` (many are legitimate component-specific combinations like `12px 16px`) — available for Phase 2+ component work and any new code.

| Token | Value |
|---|---|
| `--space-1` | 4px |
| `--space-2` | 8px |
| `--space-3` | 12px |
| `--space-4` | 16px |
| `--space-5` | 20px |
| `--space-6` | 24px |
| `--space-7` | 32px |
| `--space-8` | 48px |

---

## 3. Radius Scale

The file had **13 near-duplicate radius values** between `4px` and `24px`. Consolidated to 6 steps + pill. Applied to every card selector (`wonder-card`, `summary-card`, `breed-card`, `record-card`, `animal-row`, `settings-section`, `stat-mini`, `diary-section`).

| Token | Value | Applied to |
|---|---|---|
| `--radius-xs` | 6px | Small icon buttons, chips |
| `--radius-sm` | 8px | Inputs, small buttons |
| `--radius-md` | 10px | (reserved — currently unused, was a lone value) |
| `--radius-lg` | 12px | `animal-row`, `stat-mini` |
| `--radius-xl` | 16px | `breed-card`, `record-card`, `diary-section`, `summary-card` |
| `--radius-2xl` | 20px | `--card-radius` (see below) |
| `--radius-full` | 999px | Buttons, badges (already pill-shaped) |

**Fixed a dead token:** `--card-radius` was defined (`14px`) but never actually referenced by any selector — `.wonder-card` hardcoded `18px` directly instead. It's now `var(--radius-2xl)` (20px) and is genuinely used by `.wonder-card` and `.settings-section`.

---

## 4. Elevation (Shadow) Scale

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 4px rgba(0,0,0,.12)` | Subtle lift (chips, small controls) |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.25)` | Standard hover states |
| *(existing)* `--card-shadow` | theme-aware | The reference "lg" tier — every card already uses this |
| `--shadow-xl` | `0 20px 60px rgba(0,0,0,.4)` | Modals — this exact value was already used ad hoc in 2+ places, now named |

---

## 5. Color Tokens (already existed — documented here for completeness)

Three-tier system already in place in `styles.css`, unchanged in structure:

- **Tier 1 (raw):** `--bg`, `--bg-2/3/4`, `--border`, `--border-2/3`, `--text`, `--text-sub`, `--text-gray`, `--text-muted`, `--orange`, `--green`, `--blue`, `--red`, `--yellow`, `--purple`, `--gray`
- **Tier 2 (semantic):** `--color-success/warning/danger/info/neutral`, `--color-interactive`, `--color-text-primary/secondary/tertiary`, `--surface-base/raised/overlay/sunken`, `--border-subtle/default/strong`
- **Tier 3 (component):** `--btn-primary-bg`, `--card-surface`, `--input-surface`, `--badge-*-bg`, `--progress-track/fill`

### Status color rules (as currently used — worth keeping explicit going forward)

| Status | Token | Hex (dark) |
|---|---|---|
| Success / Healthy / Tarbiya | `var(--green)` | `#34d399` |
| Interactive / Primary / Tasmeen / Admin | `var(--orange)` | `#10b981` |
| Info / Supervisor | `var(--blue)` | `#3b82f6` |
| Warning / Low stock | `var(--yellow)` | `#f59e0b` |
| Danger / Critical / Dead | `var(--red)` | `#ef4444` |

**Known trade-off (carried over from the earlier color pass, repeating here since it's a Phase 1 concern):** `--orange` and `--green` are both green-family now, so role/type pairs that used to be visually distinct by hue alone (e.g. `role-badge-admin` vs `role-badge-vet`) are closer together than before. Not fixed in this pass — would need dedicated new tokens per role rather than reusing `--orange`/`--green`.

---

## 6. Button & Badge Normalization

- All buttons (`.action-btn`, `.action-btn.sm`) and all badges (`.type-badge`, `.badge-*`) use `border-radius: var(--radius-full)` — fully pill-shaped, no exceptions.
- Badge backgrounds follow one rule everywhere: `rgba(<status-color>, .12)` background + `1px solid rgba(<status-color>, .25)` border + solid status-color text. No one-off badge colors exist outside this pattern.

---

## What Phase 1 still doesn't cover

- Spacing scale is defined but not retrofitted onto every existing `padding`/`margin` (would touch ~460 lines for cosmetic-only gain — deferred as low value for the risk).
- No component-level work (Page Header, Alert Card, KPI Card as reusable pieces) — that's Phase 2.
