# TWO-YEAR-TECHNICAL-VISION.md

**Internal architecture strategy, not a product pitch.**

## Maintainability
The buildless, zero-dependency architecture is a deliberate, proven asset — the two-year strategy is to *defend* it, not evolve away from it. Every phase of the current engagement (SSOT certification, permission scanning, regression testing) exists to let this pattern scale in discipline without scaling in framework complexity. The single largest maintainability risk over two years is not the technology — it's discipline erosion under feature-delivery pressure. `docs/development/ENGINEERING-RULES.md` exists specifically to make that erosion visible before it compounds.

## Offline Capability
Currently split, honestly, between "real" (the IndexedDB write-queue) and "built but dormant" (the Service Worker). The two-year target is a single, deliberate decision — full activation with proper cache-versioning, or formal retirement of the dormant half — not indefinite ambiguity. Given this is a working farm with genuinely poor-connectivity conditions plausible in the field, activation is the more likely correct direction, but that decision belongs to the repository owner, not to this document.

## AI Integration
Today: a single assistant with 7 structured actions, correctly converging onto canonical write paths rather than a parallel code path. The two-year direction is *deepening* this pattern, not replacing it — more structured actions (e.g., `add_task`, `flag_weight_concern` tied to Epic 1/2 from the roadmap), always routed through the same certified writers. The architectural discipline that made this safe once (AI writes go through the same gate as UI writes) is the thing to preserve as the assistant's scope grows, not something to relax for convenience.

## Reporting
Currently retrospective and page-bound (`reports.html`, lazy-loaded charts). The two-year direction is toward the analytics layer named in the gap analysis (weight trends, feed conversion, financial forecasting) — all of which can be built as *read-only computed views* over existing certified data, without touching a single write path. This is the safest category of feature growth this codebase has: pure analysis over already-trustworthy data.

## Scalability
The honest two-year position: this architecture is correctly right-sized for one farm, and correctly not yet built for one hundred. The strategic recommendation is **not** to preemptively build multi-tenancy — it's to keep the door open (avoid decisions that would make farm-scoping harder later, like further entrenching flat, non-farm-scoped collection paths) while waiting for real evidence of multi-farm need before paying that cost. Building it speculatively would be the single most expensive mistake available in this roadmap.

## Cloud Readiness
Already cloud-native in the sense that matters (Firebase RTDB, Vercel serverless) — the two-year gap isn't infrastructure, it's operational maturity around that infrastructure: backups, environment separation, and observability, all already named as concrete, scoped gaps rather than abstract future concerns. None of these require a platform change, only disciplined follow-through on work already identified.

## What This Vision Deliberately Does Not Include
A framework migration. A backend rewrite. A move away from Firebase. A speculative multi-tenant redesign. Each would trade a proven, working architecture for a hypothetical future need not yet evidenced by this product's actual usage — exactly the mistake `docs/architecture/PRODUCTION-ARCHITECTURE-REVIEW.md` and every certification pass this engagement produced were built to prevent.
