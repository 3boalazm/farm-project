# Sprint 2 — Task 2.2.4: Sync Script Design (Design Only — No Files Created)
**Status: This is an architecture proposal expressed in prose and pseudocode for review purposes only. No script file, config file, or executable was created. Nothing in the repository was touched.**

---

## 1. Script Architecture

### Script Inputs

| Input | Type | Required? | Purpose |
|---|---|---|---|
| `--source` | path | Yes (defaults to repo root if omitted) | The web root — always root, per the confirmed source-of-truth decision; exposed as a flag anyway so the script is never *hardcoded* to assume its own location, making it independently testable |
| `--dest` | path | Yes (defaults to `farm-apk/www`) | The sync destination |
| `--mode` | enum: `dry-run` \| `execute` | Yes, **defaults to `dry-run`** | The script must never write by accident — execution requires an explicit, deliberate flag |
| `--manifest` | path to a config file (see Allow/Exclude-list structure below) | Yes | Defines what's eligible to sync at all — the script itself contains no hardcoded file list; the list lives in one reviewable config file, not buried in code |
| `--allow-conditional` | flag, off by default | No | Without this flag, files classified `conditional` (Task 2.2.3, Phase 1/C) are always skipped, even in `execute` mode — conditional files require a deliberate, separate opt-in each time, not a one-time setting buried in the manifest |
| `--force-overwrite-review-files` | flag, off by default | No | Files in the "manual review" category (Task 2.2.3, Phase 1/D) are never touched without this explicit, loudly-named flag — the name itself is a deterrent, intended to make a careless invocation visually obvious in any script or CI log |
| `--report` | output path for the diff report (see §6) | No, defaults to stdout | Where the human-readable report goes |

### Allow-list Structure

Not a flat list — a structured manifest with **four explicit tiers**, mirroring the classification already produced in Task 2.2.3:

```
sync-manifest.yml (illustrative structure, not an actual file created)
---
always_sync:
  - "*.html"                # all root HTML pages
  - "!bayan.html"           # explicit negation for root-only pages
  - "!bayan-offline.html"
  - "styles.css"
  - "shared.js"
  - "firebase.js"
  - "nav.js"
  - "config.js"
  - "notifications-service.js"
  - "offline-sync.js"
  - "manifest.json"
  - "pages/*.js"
  - "!pages/animal_detail.js"   # excluded here because it's under manual_review below
  - "!pages/notifications.js"
  - "!pages/births.js"
  - "!chat.js"

conditional:                # only touched with --allow-conditional
  - "sw.js"
  - "import-data.js"
  - "sync-to-excel.js"
  - "media/logo.png"

manual_review:               # only touched with --force-overwrite-review-files
  - "pages/animal_detail.js"
  - "pages/notifications.js"
  - "pages/births.js"
  - "chat.js"

# everything not listed above in any tier is implicitly excluded —
# this is a WHITELIST model, not a blacklist. Silence means "don't sync,"
# not "sync by default." This is the single most important safety property
# of the design, addressing "prevent accidental backend file copying"
# directly: api/, database.rules.json, vercel.json, package.json,
# FIREBASE_RULES_SETUP.md, farm-apk.zip, FETCH_HEAD, git — none of these
# need to appear in an exclude-list at all, because nothing is synced
# unless it's explicitly named above.
```

### Exclude-list Structure

Given the whitelist model above, a separate exclude-list is **not strictly required for correctness** — but the design still includes one, as a second, independent safety layer:

```
hard-exclude.yml (illustrative, not created)
---
never_sync:
  - "api/**"
  - "database.rules.json"
  - "FIREBASE_RULES_SETUP.md"
  - "package.json"
  - "vercel.json"
  - "farm-apk.zip"
  - "FETCH_HEAD"
  - "git"
```
**Why both a whitelist and a hard-exclude list, when the whitelist alone would already prevent these files from syncing:** the hard-exclude list is a **defense-in-depth** measure. If a future maintainer edits `sync-manifest.yml` carelessly (e.g. adds a broad pattern like `*.json` to `always_sync` without thinking it through), the hard-exclude list still blocks `database.rules.json`/`vercel.json` specifically, regardless of what the allow-list says. The script should treat `hard-exclude` as **always winning** over `always_sync`/`conditional` if a file ever somehow matches both — exclusion is absolute, never overridable by the allow-list, even accidentally.

---

## 2. Validation Model

Four validation passes, run in this order, **every single time**, including in `dry-run` mode (validation is not something `execute` mode adds — it's identical work performed either way; only the final write step differs):

### Pass 1 — Manifest resolution
Expand the manifest's patterns against the actual source directory, producing a concrete file list. Any pattern in `always_sync`/`conditional` that matches zero real files is flagged as a **manifest warning** (not a failure) — likely means the manifest is stale relative to the actual repo (e.g., a file was renamed).

### Pass 2 — Hard-exclude enforcement
Cross-check the resolved file list from Pass 1 against `hard-exclude`. Any overlap is a **hard failure** — the script refuses to proceed at all, not just skip that one file, because a whitelist file matching a hard-exclude entry indicates the manifest itself is misconfigured and needs human attention before anything runs.

### Pass 3 — Dependency closure validation
This is the pass that directly encodes the one concrete gap found in Task 2.2.3 (Phase 2): **if `sw.js` is in the resolved sync set (i.e., `--allow-conditional` was passed and it matched), parse its `APP_SHELL` array and verify every path listed there is *also* in the resolved sync set or already present at the destination.** If not, this is a **hard failure specifically for `sw.js`** — the script refuses to sync `sw.js` alone while leaving its own declared dependency (`offline-sync.js`) behind. This generalizes beyond just this one known case: the same parse-and-cross-check logic should apply to any file with a discoverable static dependency list (an easy, mechanical thing to check that would have caught the `offline-sync.js` gap automatically the first time, rather than requiring a manual audit to find it).

### Pass 4 — Destination-safety validation
Before any write, confirm:
- The destination path is exactly `farm-apk/www` (or whatever `--dest` explicitly names) — never a bare/empty check that could resolve to something unintended like the repo root itself.
- The operation is **additive/targeted, file-by-file** — the script must never perform a recursive delete-then-copy of the whole destination directory. Each file in the resolved sync set is copied individually, overwriting only that specific destination path. This directly satisfies "prevent full folder overwrite": there is no code path in this design that ever clears the destination wholesale.
- Any file present at the destination that is **not** in the resolved sync set, and **not** in the manual-review/excluded categories, is flagged in the diff report as "unexpected — present in destination but not classified anywhere" (this is exactly how today's stray `vercel.json` would have been caught, had this check existed before).

---

## 3. Proposed Workflow

```
1. Run in dry-run mode (default) with no flags beyond --manifest.
   → Produces the diff report (§ below) and nothing else. Zero writes.

2. Human reviews the diff report:
   - Confirms the "will sync" list matches expectation.
   - Confirms zero entries under "blocked / hard failure."
   - Reviews "unexpected files in destination" (drift/clutter check).
   - Decides whether any "conditional" files should be included this run.

3. If, and only if, the dry-run report looks correct, re-run with
   --mode=execute (and --allow-conditional / --force-overwrite-review-files
   only if that specific run genuinely intends to touch those tiers).

4. Script performs the sync: file-by-file, additive, logging each copy.

5. Script re-runs its own Pass 1–4 validation *after* the copy, as a
   self-check — confirming the destination now matches the resolved
   source set exactly, with no leftover drift. This post-check is cheap
   (it's the same diff logic as the dry-run) and directly guards against
   "silent drift": if the post-check finds any mismatch, the script
   reports it loudly rather than exiting silently on success.

6. Human commits the resulting farm-apk/www changes in git, same as
   any other reviewed code change — the script never auto-commits or
   auto-pushes; git remains the human-controlled checkpoint and the
   rollback mechanism (§ Rollback below).
```

**Why dry-run is the default and not an opt-in flag:** the task's own stated goal is to *prevent* silent drift and accidental backend copying — defaulting to the safe, read-only mode means a script invoked without fully understanding its flags (e.g., someone running it from muscle memory, or a copy-pasted CI snippet missing a flag) can never accidentally write anything. Every destructive path requires an explicit, named opt-in.

---

## 4. Diff Report Format

A single table, human-readable, produced identically whether run in `dry-run` or as the pre-flight step of `execute`:

| Column | Meaning |
|---|---|
| File | Relative path |
| Tier | `always_sync` / `conditional` / `manual_review` / `hard_excluded` / `unclassified` |
| Source status | exists / missing |
| Dest status | identical / stale (N lines differ) / missing entirely / unexpected (present but not in any tier) |
| Action | `will copy` / `skipped (conditional, flag not set)` / `skipped (manual review, flag not set)` / `BLOCKED (hard exclude match)` / `BLOCKED (dependency closure failure)` / `no action (already identical)` |
| Note | free text — e.g. "requires offline-sync.js in same run" for the `sw.js` row specifically |

**Summary footer**, always printed:
```
Files to sync:            N
Files skipped (flagged):  N
Files blocked (failures): N   ← must be 0 for --mode=execute to be allowed to proceed
Unexpected files in dest: N   ← informational, never blocks, always shown
```

---

## 5. Failure Conditions (script refuses to proceed to any write)

| Condition | Why it's a hard stop |
|---|---|
| Any resolved sync-set file also matches `hard_exclude` | Manifest misconfiguration — could otherwise leak a backend/deployment file into the app bundle |
| `sw.js` selected (via `--allow-conditional`) without `offline-sync.js` also resolving into the sync set | The exact, already-proven dependency-closure gap from Task 2.2.3 |
| `--dest` resolves to a path outside `farm-apk/www` (e.g. accidentally pointed at repo root, or a path traversal via a malformed manifest entry) | Prevents catastrophic accidental overwrite of the wrong directory entirely |
| Manifest file itself is missing or fails to parse | Script has nothing safe to act on; refuses rather than falling back to any implicit default file list |
| `--mode=execute` passed with zero prior dry-run report generated in the same invocation sequence (i.e., execute always runs the full validation passes first, in the same run, never skips straight to writing) | Guarantees the validation in §2 always happens immediately before any write, not just "at some point in the past" |

**Explicitly not a failure condition, but always reported:** files present in the destination that aren't classified in any tier (the "unexpected" case, like today's `vercel.json`). This is informational so a human can decide whether to clean it up, rather than the script silently deleting anything on its own initiative — deletion is never an automatic behavior in this design.

---

## 6. Rollback Approach

- Because every write is a targeted, individual file copy into a git-tracked directory (`farm-apk/www/` is part of the repository), rollback is always a standard `git diff` / `git checkout -- <path>` / full commit revert — no custom rollback machinery needs to be built into the script itself.
- The script performing an **additive, one-file-at-a-time** copy (rather than a wholesale directory replace) means a partial failure mid-run leaves a partially-updated but still git-diffable state — nothing is left in an ambiguous "half-deleted" condition, since files are never deleted as part of a sync in this design (deletion of stale/unexpected destination files, if ever wanted, would be a deliberate, separately-flagged operation, not a side effect of a normal sync).
- For the specific future case of `sw.js` eventually being synced *and registered* for the first time (a decision explicitly out of scope for this design, per Task 2.2's findings): rollback of a live, registered service worker is not a plain file revert — it requires shipping a new worker version that clears/unregisters, as already noted in Task 2.2.3's Phase 4. This script's rollback story covers the *file-sync* operation only; it is not a substitute for that separate, larger consideration if/when registration is ever approved.

---

## Output Summary

**1. Script architecture:** A manifest-driven, whitelist-first tool with four inputs (`source`, `dest`, `mode`, `manifest`) plus two named, off-by-default opt-in flags for riskier file tiers. Nothing is hardcoded inside the script itself — the sync boundary lives entirely in an external, reviewable manifest file, directly reusing Task 2.2.3's four-tier classification.

**2. Validation model:** Four ordered passes — manifest resolution, hard-exclude enforcement (which always wins over the allow-list, even in case of conflict), dependency-closure checking (generalized from the specific `sw.js`/`offline-sync.js` gap into a reusable mechanical check), and destination-safety validation (additive-only, never a wholesale directory replace, plus detection of unexpected/unclassified destination files).

**3. Proposed workflow:** Dry-run by default → human review of the diff report → explicit `execute` re-run with only the specifically-intended opt-in flags → file-by-file copy with logging → automatic post-copy re-validation to catch any residual drift immediately rather than letting it resurface later.

**4. Risk analysis:** The design itself introduces no risk (nothing was built). Of the four things the task asked the script to prevent: **accidental backend file copying** — prevented structurally by the whitelist model (nothing syncs unless named, and even if named, the hard-exclude list wins). **Missing service worker dependencies** — prevented by Pass 3's mechanical closure check, generalized beyond just today's known case. **Full folder overwrite** — prevented structurally, since no code path in this design ever performs a directory-level replace. **Silent drift** — prevented by making dry-run the default, requiring a human-reviewed report before any write, and re-validating immediately after every write rather than trusting the copy succeeded silently.

**5. Waiting for approval before any script, config file, or manifest is actually created.**
