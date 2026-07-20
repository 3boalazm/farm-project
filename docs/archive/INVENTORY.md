# Archive Inventory

**134 original artifacts consolidated into this documentation set. See `ARTIFACT_MAPPING.md` for the complete per-file traceability table.**

## Summary Counts
- **85 markdown/text knowledge documents** — read and classified; durable knowledge extracted into `docs/repository/`, `docs/architecture/`, `docs/certification/`, `docs/decisions/`, `docs/backlog/`, `docs/design/`.
- **6 JSON/CSV data files** — 5 are progress/status logs with no durable knowledge (task-*.json, last-sync-report.json); 1 (`full_mutation_matrix.csv`) underlies the SSOT audit and is referenced, not re-derived.
- **6 binary archives/patches** (`BranchA-clean-final.zip`, `repo4-frozen-source.zip`, `Patch-A-Sprint-3.8-Backup.zip`, `farm-project-merge-ready.zip`, `BranchA-real-changes.patch`) — not opened/read; their relationship to current live repository state is unconfirmed.
- **~29 live code/asset files** (HTML/JS/CSS/images/icons) — not documentation, not consolidated; flagged where their presence in the archive but absence from the live repo matters (`docs/backlog/OPEN_DECISIONS.md`).
- **22 nested historical code snapshots** (`mnt/user-data/outputs/...`) — classified Obsolete, superseded by current live repository state, preserved for historical reference only.

## Safe to Archive (Move Out of Active Working Directories)
Every markdown document listed as "Archived: Yes" in `ARTIFACT_MAPPING.md` — their durable knowledge is now in the consolidated `/docs` tree. The originals remain valuable as detailed evidence trails but are no longer required reading for routine work.

## Recommended for Deletion (Not Just Archiving)
- The 5 minimal-content JSON progress logs (`task-2.2.7-report.json` through `task-2.4.9-report.json`, `last-sync-report.json`) — pure status logs, zero durable knowledge, explicitly superseded by their own thread's later documents.
- The 22 nested historical code snapshots, **once confirmed each is genuinely superseded by current live repo state** (not verified file-by-file in this pass — a diff check is recommended before deletion, not assumed).

**Nothing was actually deleted by this consolidation pass — this section is a recommendation for a follow-up, explicitly-approved cleanup task, per this project's own "no speculative cleanup" rule.**
