# EXECUTIVE-DASHBOARD-ARCHITECTURE.md

**Every widget below maps to exactly one question, and to an already-existing computation -- nothing here is a new engine.**

| Layer | Widget | Question It Answers | Source (Existing, Reused) |
|---|---|---|---|
| Farm Status | Farm Health Score + Hero KPI | "How is the farm doing overall, right now?" | Existing composite score + herd total (unchanged) |
| Operational Priorities | Sprint 5's unified panel | "Which specific animals need my attention?" | `evaluateOperationalPriority()` (unchanged) |
| Critical Alerts | Trimmed `priorityAlerts` | "What needs immediate action outside animal-specific intelligence?" | Deaths, low stock, overdue maintenance, expiring meds (unchanged) -- the duplicated weight-alert entry is removed here specifically, since Operational Priorities already covers it with more context |
| Executive KPI Strip | 8 compact numbers | "What are today's headline numbers?" | New this sprint, but every value reuses an existing computation -- see `docs/features/EXECUTIVE-DASHBOARD.md` for the exact source of each |
| Trend Analysis | Existing Analytics Grid | "Is anything getting better or worse?" | Herd Population, Health Distribution, Production Trend, Revenue vs. Expense (unchanged) |
| Upcoming Tasks | New section | "What's overdue or due soon?" | `daily_tasks`, read directly (a genuinely new dashboard read of already-existing data -- `daily_tasks` was never fetched by this page before) |
| Operational Timeline | Extended "Recent Records" | "What changed recently, across every domain?" | The existing chronological-merge mechanism (`recentRecords`), extended with Production/Weight/Birth/Medication/Task/Automation event types it did not previously include -- same sort, same render, same dedup logic, just more event sources feeding it |
| Recent Activity | Existing Activity Timeline | "What actions did people take?" (distinct from "what changed," per this project's own prior documented rule keeping these separate) | `activity_log` (unchanged) |

## Explicit Non-Goals
No new intelligence engine. No new scoring formula. No new alert type. Every number on this page, after this sprint, traces to a function that existed before this sprint began, or to a raw collection this page (or a sibling engine) already reads.

## Ordering Rationale
Farm Status first (the single glance an executive wants). Operational Priorities second, immediately below -- the single most actionable section, per Sprint 5's own mission to "stop showing isolated alerts, begin presenting operational priorities." Critical Alerts third, for the narrow set of things genuinely outside animal-level intelligence. KPIs and Trends for the numbers-oriented view. Tasks and Timeline last, for "what's next" and "what happened" -- useful, but not the first thing an executive needs to see.
