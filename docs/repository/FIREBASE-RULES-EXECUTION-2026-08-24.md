# Firebase RTDB Rules — Execution-Verified Findings (2026-08-24)

**This document exists specifically to distinguish EXECUTION-VERIFIED findings (actually run against the real RTDB emulator, not just read from source) from SOURCE-VERIFIED ones (read directly from `database.rules.json` but never exercised).** A prior pass reviewed `database.rules.json` by reading it and concluded several things about its behavior; some of those conclusions were **wrong**, and were only caught by actually running the rules. That is the point of this document.

**Environment**: Eclipse Temurin 21 (OpenJDK LTS) installed via `winget` specifically to make this execution possible — previously blocked, confirmed absent from PATH. Emulator run via `firebase emulators:exec --only database "node tests/rules/accounting-rules.test.js"`, against the `demo-bayan-farm-rules-test` / `demo-diagnose-journal` project IDs (never `farm-mz99`) on the local RTDB emulator only. Verified structurally impossible to reach production: `@firebase/rules-unit-testing`'s bundled source (`node_modules/@firebase/rules-unit-testing/dist/index.cjs.js`) contains zero references to `*.firebasedatabase.app`/`*.firebaseio.com` and resolves the emulator host exclusively via `FIREBASE_DATABASE_EMULATOR_HOST` (default `127.0.0.1`). A hard runtime assertion (`assertNeverProduction()`) was also added to `tests/rules/accounting-rules.test.js` as belt-and-suspenders defense-in-depth on top of that structural guarantee.

## Result summary

`tests/rules/accounting-rules.test.js` (expanded this phase to cover all 17 accounting collections' read/write/delete gates, not just the 5 collections the original version deep-dived on): **160 passed, 14 failed**, executed against the real emulator.

## CONFIRMED, EXECUTION-VERIFIED: `journal_entries` POSTED-immutability does not work

**Severity: High — the rule's entire documented purpose is defeated.**

The rule (`database.rules.json`, `journal_entries`):
```json
"journal_entries": {
  ".write": "auth != null && ...admin... && (!data.exists() || data.child('status').val() !== 'POSTED')",
  "$id": { ".validate": "...", "status": {...} }
}
```
is declared at the **collection level** (`journal_entries`), not inside `$id`. In Firebase RTDB rules, `data`/`newData` inside a `.write` rule are scoped to the **path where the rule is declared** — here, that is `/journal_entries` (the whole collection of every entry), not `/journal_entries/{the specific id being written}`. `data.child('status')` therefore looks for a field literally named `status` directly under `/journal_entries` (which never exists — real entries are one level deeper, at `/journal_entries/{id}/status`), so `data.child('status').val()` is always `null`, and `null !== 'POSTED'` is always `true`. **The POSTED check is a permanent no-op.**

Verified by direct execution (`tests/rules/_diagnose_temp.js`, run against the emulator, then discarded — not part of the committed test suite):
- A **whole-node overwrite** of a POSTED entry (re-`.set()`-ing the full record, status still `'POSTED'` in the new data) — **succeeded**. This is the strongest possible proof the bug isn't a sub-path quirk: even a `.set()` targeting exactly the path the rule is declared "one level above" still bypasses the check.
- A **sub-path write** (`journal_entries/j1/description`) — **succeeded**.
- A **direct status-field rewrite** (`journal_entries/j1/status` → `'DRAFT'`) — **succeeded**.

This directly contradicts the rule's own header comment ("once a given entry's status is 'POSTED', this rule blocks every further write to that same id, full stop") and the original test file's own pre-existing test (`"a POSTED journal entry cannot be modified, even by admin"`), which **failed** once actually executed (it had never been run before this phase — `@firebase/rules-unit-testing` was installed but Java was never available until now).

**`source_documents` has the structurally identical pattern** (`.write` declared at the collection level, referencing `data.child('status')`/`data.child('type')`/etc. for its "financial fields frozen once non-DRAFT" rule) — confirmed by direct execution as well: a `total` field rewrite on a POSTED `source_document` **succeeded** when it should have been blocked.

### Recommended fix (drafted, NOT applied — belongs to the concurrent session's in-progress `database.rules.json`)

Move the conditional `.write` clause from the collection level into `$id`, so `data`/`newData` correctly scope to the specific entry:

```json
"journal_entries": {
  ".read": "...admin...",
  "$id": {
    ".write": "auth != null && ...admin... && (!data.exists() || data.child('status').val() !== 'POSTED')",
    ".validate": "...",
    "status": {...}
  }
}
```
Same restructuring applies to `source_documents`'s `.write` clause. This is the smallest change that fixes the scoping — it does not alter the validation logic, the admin-gate, or any other collection. **Not deployed, not applied to the working tree** — this is a recommendation for whoever owns `database.rules.json` next, consistent with not touching that file mid-edit by another session.

## CONFIRMED, EXECUTION-VERIFIED: delete semantics — the opposite of what source-reading suggested

A prior pass (source-reading only) hypothesized that `customers`/`suppliers`/`employees`/`loans`/`accounts`/`cash_bank_accounts`/`fixed_assets`/`cost_centers` — collections whose `.validate` rule is a plain `newData.hasChild(...)` with no `!newData.exists()` escape — would be **impossible to delete**, since a delete writes `null` and `hasChild()` on `null` is `false`. **This was executed and found to be wrong**: all 8 deletes **succeeded**. Firebase RTDB's actual behavior does not block a delete via a `.validate` rule requiring child fields to exist the way that source-level reasoning assumed.

More significantly, the same execution proved that **the five "write-once" audit-style collections can also be deleted**, despite `.validate` requiring `!data.exists()` for the create step:
- `animal_cost_ledger`, `cost_allocations`, `financial_audit_log`, `forecasts`, `bank_reconciliations` — admin delete of an existing record **succeeded** in every case.

This directly contradicts `database.rules.json`'s own stated design intent for `financial_audit_log` in particular: *"an audit record that could itself be edited or deleted after the fact would defeat the entire point of it existing."* **The current rules do not deliver that guarantee.** Editing an existing write-once record correctly fails (verified: "second write to the SAME id fails" passed for all 5); **deleting it does not fail.**

### Application-level intent (Phase 5E — searched, not assumed)

Grepped the entire repository (excluding `farm-apk/`) for `fbDelete(` against all 17 accounting collections: **zero results**. No page, script, or test calls `fbDelete()` against any of the 17 accounting collections — no delete button, no soft-delete flag pattern found. **The application never intends to delete any accounting record.** This means the gap is currently **not reachable through the app's own UI** — only through direct REST/console/SDK access by someone already holding admin-level Firebase Auth credentials. Real-world risk is therefore **low-probability, high-impact-if-it-happens** (an admin account compromise, or an admin's own mistake via direct API access, could silently erase audit-trail evidence with no rule stopping it) rather than a reachable-by-any-user vulnerability.

### Recommended fix (drafted, NOT applied)

For the 5 write-once collections, add an explicit delete-block to the `.validate` rule (it already implicitly relies on `!data.exists()` for create — add a rule that also fires on delete):
```json
".write": "...admin... && (data.exists() ? newData.exists() : true)"
```
placed inside `$id`, ahead of/alongside the existing `.validate`, so that `newData.exists()` (false on delete) is explicitly checked when `data.exists()` (the record is currently present) — turning "can't overwrite" into "can't overwrite or delete." For the 8 hasChild-only master-data collections, whether to add the same protection is a **product decision** (does an admin ever legitimately need to delete a customer/supplier/employee/loan/account?), not purely a security fix — documented here for whoever makes that call, not decided unilaterally in this pass.

## EXECUTION-VERIFIED: the rest of the 17-collection matrix is correct

Across all 17 collections, actually executed against the emulator:
- **Anonymous (no Firebase Auth) read/write: denied** — verified for all 17.
- **Anonymous Firebase Auth session (auth != null, no `uid_lookup` entry) read/write: denied** — verified for all 17. This is the specific production scenario (an auto-created Anonymous Auth session satisfying `auth != null` with zero login) the whole Phase B hardening effort exists to close, and it holds.
- **Non-admin real user (worker) read/write: denied** — verified for all 17.
- **Admin read/write of a valid record: allowed** — verified for all 17, using a real, `.validate`-satisfying record shape per collection (not a placeholder that would pass regardless of the rule).
- **Malformed writes rejected even for admin**: verified for `journal_entries` (missing fields, unbalanced debit/credit).
- **Role-resolution chain** (`auth.uid → uid_lookup/{uid}.appUserId → users/{appUserId}.role`): verified for a valid admin mapping, a valid non-admin (worker) mapping, and an anonymous session with no mapping at all. Missing-`users`-record and malformed-mapping cases were not separately executed this pass (the anonymous-session case already exercises "the chain resolves to `null`," which is the operative failure mode) — noted as a small remaining gap, not exercised.
- **Pre-existing (non-accounting) collections unaffected**: verified — an anonymous Firebase Auth session can still read `animals` (unchanged, pre-existing `auth != null`-only behavior), a worker can still write `animals` and read `finance` but not write it.

## `custom_perms` (Phase 5F) — reconfirmed, unchanged

Reconfirmed by direct source read (not re-executed, since this is a frontend/rules-shape question, not a rules-behavior question an emulator test would add evidence to): `users/{appUserId}/custom_perms` is a plain array, checked via `Array.isArray(u.custom_perms) && u.custom_perms.includes(page)` in `firebase.js`'s `can()`. No accounting collection's rule references `custom_perms` anywhere. The 17 accounting collections remain admin-only in practice regardless of any `custom_perms` grant — fail-closed, not fail-open. Formally recorded as decision **D-08** (`docs/decisions/D-08.md`), committed prior to this document.

## What was NOT executed this pass

- Missing-`users`-record and malformed-`uid_lookup`-mapping role-resolution edge cases (only "no mapping at all" was executed).
- `budgets`/`fiscal_periods` delete semantics (same `hasChild`-only pattern as the 8 named collections, very likely the same "delete succeeds" result by the same mechanism, but not directly executed — flagged, not assumed).
- Every non-accounting, pre-existing collection's own delete semantics (same `hasChild`-only pattern appears on `animals`, `health`, `breeding`, `production_log`, `daily_tasks`, `activity` — out of this phase's declared 17-collection scope).
