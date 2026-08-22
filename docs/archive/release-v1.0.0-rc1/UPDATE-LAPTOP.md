# UPDATE-LAPTOP.md

## Updating an Existing Local Copy to This Release
1. **Backup first.** Copy your existing project folder somewhere safe, or if it's already a git clone, commit/stash any local changes and note your current commit.
2. **Replace source.** Copy this package's contents over your existing folder -- **except** `node_modules/` (regenerate, don't overwrite) and any local `.env` or config you've customized that isn't part of this export.
3. **Update dependencies.** `npm install` again, in case `package.json` changed.
4. **Verify.** `npm run scan` (static safety check) then `npm test` (full regression) -- both should pass cleanly on the updated copy.
5. **Confirm the version.** Check `docs/release/VERSION-MARKER.md` -- it should show `v1.0.0-rc1` (or later, if you're updating past this release).

## If You're on an Older Commit
This release (`v1.0.0-rc1`) is purely additive on top of `baseline-v2-production-candidate` -- six product sprints plus release-hardening, zero breaking changes to existing collections or SSOT boundaries. Updating from any prior checkpoint in this project's history should not require any data migration.

## If Something Breaks After Updating
See `docs/deployment/TROUBLESHOOTING.md`. If the issue is specific to something this update changed, check `docs/release/RELEASE-NOTES-v1.0.0-rc1.md` first for what's new.
