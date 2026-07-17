# ROLLBACK-GUIDE.md

## If This Release Needs to Be Reverted

### Single-Commit Rollback
This release ships as exactly one commit (per this sprint's own mandate). Reverting it is:
```
git revert <v1.7.0-commit-hash>
```
This is safe and complete -- per this project's own long-standing rollback discipline ("every commit must be independently revertible via a single git revert"), no later commit was structured to depend on this one for its own reversibility, since this is the newest commit in the history.

### What Rolling Back Restores
The exact state at Sprint 14's own commit (7ce5a54) -- Inventory & Feed Management fully present, minus this release's two fixes (production.html/tasks.html navigation, import.html syntax error) and its documentation.

### What Rolling Back Does NOT Require
- No database migration to reverse -- this release added no breaking schema change.
- No Firebase rules change to reverse -- none was made.
- No environment variable to remove -- none was added.

### If Only the Two Fixes Need to Be Kept, But Something Else in This Release Is Suspect
Given this release is one commit, a full revert removes the fixes too. If that's undesirable, the two fixes are small and independently re-appliable by hand:
1. nav.js: re-add the production.html entry to the "الصحة والإنتاج" section and tasks.html to "النظام" (see docs/release/REPOSITORY-DISCOVERY-v1.7.0.md for the exact lines).
2. import.html: re-apply the corrected string-concatenation line (see docs/release/UI-UX-CERTIFICATION-v1.7.0.md for the exact before/after).

### Tag Handling
v1.7.0 is never moved, per this release's own explicit rule. If a rollback is performed, it is a new commit (the revert itself) -- the v1.7.0 tag continues to point at the original, certified release commit, preserving an accurate historical record of what was actually shipped and when.
