# RULES-AND-DEPLOY.md — database rules: policy, verification, deployment

> Companion to `docs/security/AUTH-MODEL.md`. Audit items O-11 (rules never
> deployed), O-12 (rules tests never executed), O-18 (world-readable `users`).

## 1. The rules are generated, not hand-edited

`database.rules.json` is ~600 lines of JSON-with-comments: every collection
carries `.validate` blocks plus a paragraph of history. Hand-editing the
*access* expressions in that file is how 26 collections ended up with a bare
`"auth != null"` — which, because `firebase.js` mints an Anonymous Auth token
for every visitor, meant "anyone on the internet".

So the access policy lives in code:

```bash
node scripts/apply-access-policy.js          # rewrite the access expressions in place
node scripts/apply-access-policy.js --check   # verify only; exit 1 on drift (CI)
```

The script owns `POLICY` (one entry per collection: `read`, `write`, optional
`readExpr`/`writeExpr` override), rewrites **only** `.read`/`.write`, and
leaves every `.validate`, `.indexOn` and comment untouched. `--check` is wired
into `tests/unit/25-security-auth.suite.js`, so a hand edit that drifts from
the policy fails `npm run test:unit`.

Current coverage: **43 of 48 collections** are policy-generated. The other 5
keep stricter, hand-written `$id`-level rules (they express per-record
ownership that the flat policy does not model); the script skips them rather
than flattening them.

## 2. What the policy says

| Group | Read | Write |
|---|---|---|
| Operational (animals, breeding, health, production, inventory, tasks, diary, …) | any **active** app user (`staff(['supervisor','vet','worker','visitor'])`; admin implied) | `staff(['supervisor','vet','worker'])` — never a visitor |
| Money (finance + 17 accounting collections) | admin only | admin only |
| Identity (`users`) | `.read: false` at the collection; `$uid` self-or-admin | admin, plus self-service on own record |
| Login projection (`user_directory`) | any authenticated caller | admin only |
| PIN vault (`pin_vault`) | nobody | self-or-admin, value must be a 64-char string |
| Frozen (`weights`) | admin only | **false** — deprecated collection, no writes at all |
| Diagnostics (`app_logs`) | admin only | staff (the roles that can produce errors) |
| Settings / activity | admin only | admin only |

Every expression resolves the caller through
`uid_lookup/{auth.uid}` → `users/{appUserId}` → `role`/`active`, so a forged
`localStorage.farm_user` is worth nothing: the server never reads it.

There is **no** `auth != null` write anywhere, and no visitor write anywhere.

## 3. Deploying (O-11 — owner action, Console-gated)

Order matters. Deploying the hardened rules before the auth provider exists
locks every client out (correctly, but confusingly).

`firebase.json` (added 2026-10 — the CLI cannot deploy or emulate rules
without it) points at `database.rules.json` and pins the emulator to port 9000.
It is strict JSON with no comments, unlike the rules file. There is
deliberately **no** `.firebaserc` in this public repository: the project is
selected per command, so a clone cannot silently deploy somewhere.

```bash
# 1. Firebase Console → Authentication → Sign-in method → enable
#    "Email/Password".  Without this the bridge cannot provision slots and
#    every session stays anonymous, so the rules deny nearly all reads.
#    (Anonymous may stay enabled; it is used for the bootstrap only.)

# 2. Log the CLI in and confirm the project
firebase login
firebase use farm-mz99

# 3. Dry-run the rules locally against the emulator (recommended)
firebase emulators:exec --only database "npm run test:unit"

# 4. Deploy rules only — never `firebase deploy` bare, this project has no
#    hosting/functions config that should ship with it
firebase deploy --only database

# 5. Verify from a browser session, not from curl: a logged-in worker must be
#    able to read /animals.json and must be REFUSED /finance.json (403 with
#    "Permission denied"). An anonymous curl of /users.json must be refused.
```

Rollback: the previous rules are in git history (`git show <sha>:database.rules.json
> database.rules.json && firebase deploy --only database`). Rules deploys are
atomic and take effect within seconds.

**Why this is still an owner action:** it needs Firebase Console access and a
`firebase login` credential that cannot live in a public repository or in CI.
Nothing in the repo can perform step 1 or 4; that is the whole of O-11's
remaining scope, and it is recorded as such rather than silently closed.

## 4. Rules tests (O-12)

`tests/rules/accounting-rules.test.js` is a real emulator suite: it loads
`database.rules.json` into the RTDB emulator and exercises it through
`@firebase/rules-unit-testing`. Its own header records that it had **never been
executed** — it needs Java and the Firebase CLI, neither of which existed in
the development environment that wrote it. Playwright must not collect it
(`testIgnore: ['**/rules/**']` in `playwright.config.js`); that ignore is also
what un-broke the CI gate, because the file's missing dependency used to kill
collection and make `playwright test` exit non-zero having run zero tests.

What changed in 2026-10:

* The workflow now has an **advisory** job (`rules-emulator`,
  `.github/workflows/quality.yml`) that installs Java + `firebase-tools` +
  `@firebase/rules-unit-testing` and runs the suite under
  `firebase emulators:exec --only database`. It is
  `continue-on-error: true`, so it publishes signal without gating merges.
* It is advisory **on purpose**: those expectations were written against the
  *pre-hardening* rules (e.g. "any authenticated caller can read accounting
  collections"), which the 2026-10 policy deliberately reverses. Promoting the
  job to blocking is the next step, and it means updating the expectations to
  the table in §2 — not weakening the rules to match the old test.

Local execution, if you have Java:

```bash
npm i --no-save @firebase/rules-unit-testing firebase-tools
firebase emulators:exec --only database --project demo-bayan-farm-rules-test \
  "node tests/rules/accounting-rules.test.js"
```

Before that could work, two things had to be true and one of them was not: the
script self-executes (`main()` + `process.exitCode`, no test runner needed) ✓,
and `firebase.json` existed ✗ — the file's own header told readers to run a
command the CLI could not have honoured. Both are recorded in the header now.

## 5. Server-side API keys (O-21)

`api/groq.js` and `api/claude.js` are protected by `server/api-guard.js`:

| Variable | Where | Meaning |
|---|---|---|
| `FARM_API_TOKEN` | Vercel project env | Shared bearer token the app sends. If unset, the endpoints only accept a user's own key (`x-user-key`) and answer `403 open relay` otherwise. |
| `GROQ_API_KEY`, `ANTHROPIC_API_KEY` | Vercel project env | Upstream provider keys. Never exposed to the browser. |
| `FARM_ALLOWED_ORIGINS` | optional | Comma-separated extra origins for CORS. |

These are Console/dashboard secrets and cannot be committed; the guard is
written so that a *missing* secret fails closed rather than open.

## 6. Verification checklist before calling a deploy done

- [ ] `npm run test:unit` green (includes `apply-access-policy.js --check`).
- [ ] `npm run scan` green (secrets/danger-pattern scan).
- [ ] `npx playwright test` green in CI (hermetic since O-19 — see
      `tests/fixtures/farm-test.js`).
- [ ] Email/Password enabled in the Console.
- [ ] `firebase deploy --only database` succeeded.
- [ ] Manual probe: worker session reads `/animals.json` ✓, `/finance.json` ✗;
      anonymous `curl .../users.json` ✗.
- [ ] `farm-apk/www` re-synced (`node scripts/sync-apk-www.js`) if any page,
      script or style changed — the APK ships a copy, and suite 22 fails on
      drift.
