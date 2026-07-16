# Design System — Proposal Summary

**Status: PROPOSED, LARGELY NOT MERGED. Do not treat anything below as current repository state without direct verification.**

## What Exists (Confirmed Merged)
CSS design tokens in `styles.css` — spacing scale (`--space-1` through `--space-8`, 4px base unit) and typography scale (`--text-2xs` through `--text-3xl`), consolidating ~30 near-duplicate font-sizes and ~13 near-duplicate radius values into named steps. Comment attributes this to "Phase 1 (Visual Foundation) audit."

## What Is Proposed (Not Confirmed Merged)
A complete visual/component redesign, documented across a coherent, well-reasoned document chain:
1. **Farm OS Future UI Architecture** — product experience and information-architecture redesign, explicitly preserving the existing vanilla JS/Bootstrap/Firebase/PWA stack.
2. **Farm OS UX Constitution v1** — governing principles every future screen must be evaluated against.
3. **Farm OS Design Execution Blueprint** — converts the Constitution into buildable instructions.
4. **Farm OS Component Catalog** — implementation-ready component specifications, explicit about which components already exist (formalized) vs. are new requirements.
5. **Architecture Audit (Phase 11) → Refactoring Blueprint (Phase 12) → Execution Playbook (Phase 13)** — a proposed 6-sprint execution plan, written in explicitly conditional language throughout ("per Sprint 1/2 decision, if that was the chosen outcome") — confirming this is a plan, not a record of completed work.

**Proposed file structure includes a `/js/shared/` decomposition (`modal.js`, `theme.js`, `ui-helpers.js`, `gateway-writes.js`, `utils.js`) with `shared.js` becoming a compatibility shim. None of these files exist in the live repository as inspected during this consolidation.**

## Relationship to This Project's Own "Restyle, Not Redesign" Direction
This project's own separate working history references a UI restyle effort with an explicit constraint: same components, same labels, same structure — a *restyle*, not a redesign, with a specific rejection of one visual direction (dark glassmorphism) as misaligned with the formal stakeholder context. **Whether the Design System thread summarized here represents the same effort, a superseded earlier direction, or a genuinely separate initiative is not resolved by this consolidation.** Confirm with the repository owner before treating either as authoritative.

## Before Acting on Anything in This Thread
1. Confirm current status with the repository owner.
2. Confirm which files, if any, from the proposed structure actually exist in the target branch.
3. Do not assume component names/classes from the Catalog match current CSS classes without checking — the Catalog itself explicitly warns it only formalizes what's "verified directly, not assumed."
