# sync-apk — Controlled Web → farm-apk/www Sync Tool

Whitelist-based, dry-run-by-default sync tool for keeping `farm-apk/www`
(the Android app's bundled web assets) aligned with the web root
(the source of truth). See Sprint 2 Tasks 2.2.1–2.2.4 for the full
investigation and design history behind this tool.

## Usage

```
# Dry run (default — analyzes only, never writes anything)
node tools/sync-apk/sync-apk.js --manifest=tools/sync-apk/sync-manifest.json

# Execute (copies/updates/removes only the resolved "always_sync" tier)
node tools/sync-apk/sync-apk.js --manifest=tools/sync-apk/sync-manifest.json --mode=execute

# Execute and also include the "conditional" tier for this run
node tools/sync-apk/sync-apk.js --manifest=tools/sync-apk/sync-manifest.json --mode=execute --allow-conditional

# Execute and also include the "manual_review" tier for this run
# (use only after a human has actually reviewed those specific files)
node tools/sync-apk/sync-apk.js --manifest=tools/sync-apk/sync-manifest.json --mode=execute --force-overwrite-review-files

# Save the safety report as JSON in addition to the console output
node tools/sync-apk/sync-apk.js --manifest=tools/sync-apk/sync-manifest.json --report=sync-report.json
```

## Safety guarantees

- **Whitelist only.** A file not explicitly named/patterned in
  `always_sync` / `conditional` / `manual_review` in `sync-manifest.json`
  is never synced, full stop — there is no "sync everything except X"
  mode anywhere in this tool.
- **`hard_exclude` always wins.** If a file somehow matches both an
  allow-tier pattern and a `hard_exclude` pattern, the tool refuses to
  run at all rather than silently choosing a side.
- **Dependency closure is enforced.** `sync-manifest.json`'s
  `dependencies` map (currently: `sw.js` requires `offline-sync.js`)
  is checked before every run that would sync a file with declared
  dependencies. If a dependency isn't in the current run's sync set
  and isn't already at the destination, the tool aborts with no
  changes made, rather than syncing a file that would reference a
  missing dependency at runtime.
- **Never a full-folder overwrite.** Every file is copied or removed
  individually; the destination directory itself is never deleted or
  bulk-replaced.
- **Dry-run is the default.** `--mode=execute` must be passed explicitly.
  The riskier tiers (`conditional`, `manual_review`) additionally each
  require their own separate, explicitly-named flag even in execute mode.
- **Unexpected destination files are reported, never auto-removed.**
  Anything present at the destination that isn't classified in any
  manifest tier is flagged in the report for a human decision — the
  tool will never delete a file it doesn't recognize.

## Editing the manifest

`sync-manifest.json` is the single source of truth for what syncs.
It is intentionally kept separate from the script logic so the sync
boundary can be reviewed and changed without touching code. See the
`_comment` and `_structural_note` fields inside it for the reasoning
behind each tier.
