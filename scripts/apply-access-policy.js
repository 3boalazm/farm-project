#!/usr/bin/env node
// scripts/apply-access-policy.js
//
// The database's access policy, as code.
//
// database.rules.json is a 600-line hand-edited file of JSON-with-comments:
// every collection carries its own `.validate` blocks and a paragraph of
// history explaining why it looks the way it does. Rewriting it by hand is
// how 26 collections ended up with a bare "auth != null" — which, because
// firebase.js mints an Anonymous Auth session for every visitor, meant
// "anyone on the internet". This script owns the policy and applies it
// mechanically, in place, leaving every `.validate` rule and comment intact.
//
//   node scripts/apply-access-policy.js            # apply + validate
//   node scripts/apply-access-policy.js --check    # verify only (CI), exit 1 on drift
//
// The policy (2026-10 audit, O-01 / O-18):
//
//   READ   · any ACTIVE app user may read the operational collections. A vet
//            legitimately needs animal tags to file a health record and a
//            worker needs the breeding list to mark a weaning, so narrowing
//            reads per role breaks real flows while adding nothing: the
//            sensitive data (finance, audit trail, identities) is admin-only,
//            and users/ is not readable as a collection at all.
//   WRITE  · role-scoped, and never granted to a visitor. This is the O-01
//            fix: localStorage['farm_user'] may claim anything it likes —
//            the server decides.
//   IDENTITY · every expression resolves the caller through
//            uid_lookup/{auth.uid} -> users/{appUserId} -> role/active, which
//            only a verified Firebase Auth bridge session can populate.
//
// Idempotent: running it twice changes nothing the second time.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'database.rules.json');

// ── the reusable rule expressions ────────────────────────────────────────
const APP_UID = "root.child('uid_lookup').child(auth.uid).child('appUserId').val()";
const USER = "root.child('users').child(" + APP_UID + ")";
const ROLE = USER + ".child('role').val()";
const ACTIVE = USER + ".child('active').val()";

/** A real, ACTIVE app user whose resolved role is one of `roles` (admin implied). */
function staff(roles) {
  const parts = [ROLE + " === 'admin'"].concat(
    (roles || []).filter((r) => r !== 'admin').map((r) => ROLE + " === '" + r + "'")
  );
  const test = parts.length === 1 ? parts[0] : '(' + parts.join(' || ') + ')';
  return 'auth != null && ' + ACTIVE + ' === true && ' + test;
}

const STAFF_READ = ['supervisor', 'vet', 'worker', 'visitor'];
const STAFF_WRITE = ['supervisor', 'vet', 'worker'];
const ADMIN_ONLY = [];

// collection -> { read: roles, write: roles }
const POLICY = {};
const set = (names, read, write) => names.forEach((n) => { POLICY[n] = { read, write }; });

set(['animals', 'weight_log', 'weight_alerts', 'workflow_history',
     'health', 'vaccinations', 'vaccination_templates', 'breeding',
     'production_log', 'production_alerts', 'feed_consumption', 'daily_tasks',
     'inventory_meds', 'inventory_feeds', 'inventory_equipment', 'inventory_transactions',
     'notifications', 'login_notifications', 'diary_snapshot', 'diary_snapshots'],
    STAFF_READ, STAFF_WRITE);

// Everyone reads farm settings (dashboards need the farm name and thresholds);
// only an admin changes them.
set(['settings'], STAFF_READ, ADMIN_ONLY);

// Client diagnostics (O-17). Any active staff member's browser may append its
// own error/retry reports — that is the whole point, since the person who hit
// the bug is rarely an admin — but only an admin may read them back, and the
// `.read` below is deliberately NOT staff-wide: one worker's console output is
// nobody else's business.
POLICY['app_logs'] = { read: [], write: STAFF_WRITE, readExpr: 'auth != null && ' + ACTIVE + ' === true' };

// The audit trail is readable by staff so supervisors can review what
// happened, and writable only by an admin (the app appends to it with an
// admin/bridge identity; a worker's client never needs to).
set(['activity', 'activity_log'], STAFF_READ, ADMIN_ONLY);

// Money and the accounting ledger: admin only, both directions. ROLE_PERMS in
// firebase.js excludes 'finance' for every role but admin, and the rules now
// agree with it instead of trusting the client to.
set(['finance', 'accounts', 'journal_entries', 'source_documents', 'cash_bank_accounts',
     'customers', 'suppliers', 'animal_cost_ledger', 'cost_centers', 'cost_allocations',
     'employees', 'fixed_assets', 'loans', 'fiscal_periods', 'financial_audit_log',
     'budgets', 'forecasts', 'bank_reconciliations'],
    ADMIN_ONLY, ADMIN_ONLY);

// Deprecated: the Weight SSOT moved to weight_log (see O-15). Frozen — an
// admin can still read it to migrate old rows, nothing may write to it.
set(['weights'], ADMIN_ONLY, ADMIN_ONLY);

// ── the three identity collections, written out in full ──────────────────
const USERS_BLOCK = (trailingComma) => `    // ── users ────────────────────────────────────────────────────────
    // SECURITY (2026-10 audit, O-18): this collection used to be readable by
    // ANY authenticated session — and firebase.js mints an Anonymous Auth
    // session for every visitor — so the whole user table, pin_hash included,
    // was one GET away from anyone on the internet. This repo is public, so
    // the hash salt is public too, and a 4-digit PIN space cracks offline in
    // milliseconds. Now the collection is not listable at all and each record
    // is readable only by its own owner or an admin.
    //
    // Login no longer needs to read this collection: it verifies through the
    // Firebase Auth bridge (signInBestSlot) and reads the secret-free
    // projection in user_directory for the picker and for name lookups.
    "users": {
      ".read":  false,
      ".write": "auth != null && ${ROLE} === 'admin'",
      "$uid": {
        ".read":  "auth != null && (${APP_UID} === $uid || ${ROLE} === 'admin')",
        ".write": "auth != null && (${APP_UID} === $uid || ${ROLE} === 'admin')",
        ".validate": "newData.hasChild('role') && newData.hasChild('name')"
      }
    }${trailingComma}

    // ── user_directory ───────────────────────────────────────────────
    // The PUBLIC (authenticated-readable), secret-free projection of users:
    // name, role, active, initials, custom_perms. This is what the login
    // picker, the task-assignee dropdown and every "who did this" label read,
    // so no page needs the real users collection. Mirrored by Users.add /
    // update / del in firebase.js; writable only by an admin.
    "user_directory": {
      ".read":  "auth != null",
      ".write": "auth != null && ${ROLE} === 'admin'",
      "$uid": {
        ".validate": "newData.hasChild('name') && newData.hasChild('role')"
      }
    },

    // ── pin_vault ────────────────────────────────────────────────────
    // Write-only from a client's point of view: nobody can ever read a stored
    // hash back, which is the whole point (O-18). A user may write their OWN
    // entry — that is the lazy PBKDF2 upgrade login.html performs after a
    // verified legacy login — and an admin may write anyone's. Verifying these
    // hashes belongs on a server holding an admin credential; see
    // docs/audit/FULL-AUDIT-2026-10.md.
    "pin_vault": {
      ".read":  false,
      ".write": false,
      "$uid": {
        ".write": "auth != null && (${APP_UID} === $uid || ${ROLE} === 'admin')",
        "pin_hash_v2": { ".validate": "newData.isString() && newData.val().length === 64" }
      }
    },
`;

// ── JSON-with-comments handling ──────────────────────────────────────────
function stripComments(src) {
  let out = '', i = 0, inStr = false, esc = false;
  while (i < src.length) {
    const c = src[i];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      i += 1; continue;
    }
    if (c === '"') { inStr = true; out += c; i += 1; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i += 1; continue; }
    out += c; i += 1;
  }
  return out;
}

/** Index just past the line that closes a 4-space-indented block. */
function blockEnd(text, fromIdx) {
  const nl = text.indexOf('\n', fromIdx);
  const re = /^    \}(,?)$/gm;
  re.lastIndex = nl;
  const m = re.exec(text);
  if (!m) throw new Error('unterminated block near offset ' + fromIdx);
  return { end: m.index + m[0].length, comma: m[1] };
}

function replaceIdentityBlocks(text) {
  const usersIdx = text.search(/^    "users": \{/m);
  if (usersIdx < 0) throw new Error('could not find the "users" block');

  // absorb the contiguous comment lines directly above it
  let start = usersIdx;
  const before = text.slice(0, usersIdx).split('\n');
  while (before.length > 1) {
    const prev = before[before.length - 2];
    if (/^\s*(\/\/|$)/.test(prev)) { start -= prev.length + 1; before.pop(); } else break;
  }

  // the region ends after pin_vault when it is already there (a re-run)
  let end, comma;
  const vaultIdx = text.indexOf('    "pin_vault": {', usersIdx);
  const dirIdx = text.indexOf('    "user_directory": {', usersIdx);
  if (vaultIdx > 0 && vaultIdx - usersIdx < 6000) {
    const b = blockEnd(text, vaultIdx); end = b.end; comma = b.comma;
  } else {
    const b = blockEnd(text, usersIdx); end = b.end; comma = b.comma;
    // also swallow an existing user_directory block that follows it
    if (dirIdx > 0 && dirIdx === end + 1 + text.slice(end + 1).search(/^    "user_directory": \{/m)) {
      const b2 = blockEnd(text, dirIdx); end = b2.end; comma = b2.comma;
    }
  }
  return text.slice(0, start) + USERS_BLOCK(comma).replace(/\n$/, '') + text.slice(end);
}

function apply(src) {
  const keyRe = /^    "([A-Za-z0-9_]+)"\s*:\s*\{/;
  // Trailing commas must be preserved exactly: the last member of a block has
  // none, and inventing one produces invalid JSON.
  const readRe = /^      "\.read":\s*".*?"(,?)\s*$/;
  const writeRe = /^      "\.write":\s*".*?"(,?)\s*$/;

  const lines = src.split('\n');
  const out = [];
  let current = null;
  const done = {};

  for (const line of lines) {
    const m = keyRe.exec(line);
    if (m) current = m[1];
    const policy = POLICY[current];
    if (policy) {
      const mr = readRe.exec(line), mw = writeRe.exec(line);
      done[current] = done[current] || [];
      if (mr && !done[current].includes('read')) {
        done[current].push('read');
        out.push(`      ".read":  "${policy.readExpr || staff(policy.read)}"${mr[1]}`);
        continue;
      }
      if (mw && !done[current].includes('write')) {
        done[current].push('write');
        out.push(`      ".write": "${staff(policy.write)}"${mw[1]}`);
        continue;
      }
    }
    out.push(line);
  }
  let text = out.join('\n');

  // Verify rather than assume: some collections carry their .write at the
  // $id level (POSTED-status guards, delete guards). Those are stricter than
  // anything this script would write, so they are left alone — but only after
  // checking that they really are admin-gated.
  const inherited = [];
  for (const name of Object.keys(POLICY)) {
    const kinds = done[name] || [];
    if (!kinds.includes('read')) throw new Error('could not rewrite .read for ' + name);
    if (kinds.includes('write')) continue;
    const block = new RegExp('^    "' + name + '": \\{([\\s\\S]*?)^    \\},?$', 'm').exec(text);
    if (!block) throw new Error('could not isolate the ' + name + ' block');
    const deep = [...block[1].matchAll(/^\s{8,}"\.write":\s*"([^"]+)"/gm)].map((x) => x[1]);
    if (!deep.length) throw new Error(name + ' has no .write at any level');
    for (const expr of deep) {
      if (!expr.includes("=== 'admin'")) throw new Error(name + ' has a non-admin .write: ' + expr.slice(0, 90));
    }
    inherited.push(name);
  }

  // Replace the identity blocks with users + user_directory + pin_vault.
  // On a second run those three already exist back to back, so the region to
  // replace runs from the comment above "users" to the end of "pin_vault" —
  // matching only "users" would duplicate the other two every run.
  text = replaceIdentityBlocks(text);

  return { text, rewritten: Object.keys(done).length, inherited };
}

function main() {
  const check = process.argv.includes('--check');
  const before = fs.readFileSync(FILE, 'utf8');
  const { text, rewritten, inherited } = apply(before);

  // Validate before writing anything: comment-stripped JSON must parse, and
  // the resulting policy must hold the invariants suite 25 asserts.
  const rules = JSON.parse(stripComments(text)).rules;
  const names = Object.keys(rules).filter((k) => !k.startsWith('.'));
  const problems = [];
  if (rules.users['.read'] !== false) problems.push('users/.read is not false');
  if (!rules.user_directory) problems.push('user_directory is missing');
  if (!rules.pin_vault || rules.pin_vault['.read'] !== false) problems.push('pin_vault is missing or readable');
  for (const n of names) {
    const w = rules[n]['.write'];
    if (w === 'auth != null' || w === true) problems.push(n + ' is still writable by any anonymous session');
    if (/'visitor'/.test(String(w))) problems.push(n + ' grants a visitor write access');
  }
  const bareReads = names.filter((n) => rules[n]['.read'] === 'auth != null' || rules[n]['.read'] === true);
  if (bareReads.join(',') !== 'user_directory') {
    problems.push('unexpected bare reads: ' + bareReads.join(', '));
  }
  const braces = [(text.match(/\{/g) || []).length, (text.match(/\}/g) || []).length];
  if (braces[0] !== braces[1]) problems.push('braces do not balance: ' + braces.join(' vs '));
  if (problems.length) {
    console.error('✗ access policy validation failed:\n  ' + problems.join('\n  '));
    process.exit(1);
  }

  if (check) {
    if (text !== before) {
      console.error('✗ database.rules.json has drifted from scripts/apply-access-policy.js — run it and commit.');
      process.exit(1);
    }
    console.log('✓ access policy is applied (' + names.length + ' collections).');
    return;
  }

  fs.writeFileSync(FILE, text);
  console.log('✓ applied the access policy to ' + rewritten + ' collections (' + names.length + ' total).');
  console.log('  ' + inherited.length + ' keep their stricter $id-level admin .write: ' + inherited.sort().join(', '));
  console.log('  users/.read=false · user_directory=authenticated read · pin_vault=write-only');
  console.log('\nDeploy order matters — see docs/audit/FULL-AUDIT-2026-10.md (O-18):');
  console.log('  1. Firebase Console → Authentication → Sign-in method → enable Email/Password');
  console.log('  2. firebase deploy --only database');
}

main();
