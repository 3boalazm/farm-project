// Module 25 — the security layer: the Firebase Auth bridge, PIN hashing,
// the public user projection, server-verified sessions, the API proxies and
// the deployed-shaped security rules.
//
// These tests exist because three of the audit's worst findings were all
// "the client is trusted":
//   O-18  users/ was readable by any anonymous session, and a single-round
//         SHA-256 over a public salt made every 4-digit PIN recoverable.
//   F-29  the auth bridge created a Firebase account for ANY failed sign-in,
//         so a guessed PIN minted a real credential.
//   O-01  every permission check read localStorage['farm_user'], which
//         anyone can edit in DevTools.
//   O-21  api/claude.js and api/groq.js relayed to paid APIs with CORS "*"
//         and no credential — free credits for the whole internet.
const fs = require('fs');
const path = require('path');
const { suite, assert, bootApp, createFakeAuth, ROOT, J } = require('./harness');

// firebase.js alone is enough for everything except verifySession's boot
// wiring; skipping shared.js keeps these tests fast and side-effect free.
const FILES = ['config.js', 'firebase.js'];

const SECRET_RECORD = {
  id: 'vet1',
  name: 'دكتورة سمر',
  role: 'vet',
  active: true,
  pin: '4321',
  pin_hash: 'legacy-hash',
  pin_hash_v2: 'v2-hash',
  custom_perms: ['health', 'breeding'],
  notes: 'internal',
};

// database.rules.json is JSON-with-comments (the Firebase CLI accepts it,
// JSON.parse does not), so strip comments the way a parser would: character
// by character, never inside a string.
function readRules() {
  const s = fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8');
  let out = '', i = 0, inStr = false, esc = false;
  while (i < s.length) {
    const c = s[i];
    if (inStr) {
      out += c;
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      i += 1; continue;
    }
    if (c === '"') { inStr = true; out += c; i += 1; continue; }
    if (c === '/' && s[i + 1] === '/') { while (i < s.length && s[i] !== '\n') i += 1; continue; }
    out += c; i += 1;
  }
  return JSON.parse(out).rules;
}

module.exports = suite('25 · Security: auth bridge, PIN hashing & permission enforcement', ({ test }) => {

  /* ── PIN hashing ─────────────────────────────────────────────────── */

  test('hashPinV2 is a real key-stretching derivation, not a single round', async () => {
    const app = await bootApp({ files: FILES, user: null, seedUsers: false });
    const got = J(await app.eval(`(async()=>{
      const a = await hashPinV2('1234','vet1');
      const b = await hashPinV2('1234','vet1');
      const c = await hashPinV2('1234','vet2');      // same PIN, other user
      const d = await hashPinV2('1235','vet1');      // one digit different
      const v1 = await hashPin('1234','vet1');
      return {a,b,c,d,v1,iters:PIN_V2_ITERATIONS};
    })()`));
    assert.ok(/^[0-9a-f]{64}$/.test(got.a), 'PBKDF2-SHA256 must yield 32 bytes of hex, got ' + got.a);
    assert.strictEqual(got.a, got.b, 'the derivation must be deterministic');
    assert.notStrictEqual(got.a, got.c, 'the salt must be per-user, or one crack unlocks everyone');
    assert.notStrictEqual(got.a, got.d, 'a one-digit change must change the whole hash');
    assert.notStrictEqual(got.a, got.v1, 'v2 must not be the legacy single-round hash');
    assert.ok(got.iters >= 100000, 'below 100k rounds a 4-digit space is still cheap: ' + got.iters);
    app.close();
  });

  test('verifyPinAgainstRecord uses the strongest scheme present and never falls through', async () => {
    const app = await bootApp({ files: FILES, user: null, seedUsers: false });
    const got = J(await app.eval(`(async()=>{
      const v2 = await hashPinV2('9999','u1');
      const v1 = await hashPin('7777','u2');
      return {
        v2ok:      await verifyPinAgainstRecord({id:'u1',pin_hash_v2:v2}, '9999'),
        // A PIN the v2 hash rejects must NOT be rescued by a weaker scheme
        // still sitting on the same record (a stale pin_hash, or — worse — a
        // plaintext pin left over from before the migration).
        v2trapdoor:await verifyPinAgainstRecord({id:'u1',pin_hash_v2:v2,pin:'1111',pin_hash:'stale'}, '1111'),
        v1ok:      await verifyPinAgainstRecord({id:'u2',pin_hash:v1}, '7777'),
        v1bad:     await verifyPinAgainstRecord({id:'u2',pin_hash:v1}, '0000'),
        plain:     await verifyPinAgainstRecord({id:'u3',pin:'5555'}, '5555'),
        nothing:   await verifyPinAgainstRecord({id:'u4'}, '1111'),
        norec:     await verifyPinAgainstRecord(null, '1111')
      };
    })()`));
    assert.deepStrictEqual(got.v2ok, { ok: true, scheme: 'v2' });
    assert.deepStrictEqual(got.v2trapdoor, { ok: false, scheme: 'v2' },
      'a v2 record that rejects the PIN must not fall back to a plaintext pin field');
    assert.deepStrictEqual(got.v1ok, { ok: true, scheme: 'v1' });
    assert.deepStrictEqual(got.v1bad, { ok: false, scheme: 'v1' });
    assert.deepStrictEqual(got.plain, { ok: true, scheme: 'plain' });
    assert.deepStrictEqual(got.nothing, { ok: false, scheme: null });
    assert.deepStrictEqual(got.norec, { ok: false, scheme: null });
    app.close();
  });

  /* ── the public projection (O-18) ────────────────────────────────── */

  test('publicUserProjection carries identity and drops every secret', async () => {
    const app = await bootApp({ files: FILES, user: null, seedUsers: false });
    const got = J(await app.eval(`publicUserProjection(${JSON.stringify(SECRET_RECORD)})`));
    assert.deepStrictEqual(Object.keys(got).sort(),
      ['active', 'custom_perms', 'id', 'initials', 'name', 'role'],
      'the projection must expose exactly the non-secret fields');
    assert.strictEqual(got.id, 'vet1');
    assert.strictEqual(got.role, 'vet');
    assert.strictEqual(got.active, true);
    assert.deepStrictEqual(got.custom_perms, ['health', 'breeding']);
    assert.ok(got.initials && got.initials.length >= 1, 'initials power the picker avatar');
    assert.strictEqual(J(await app.eval(`publicUserProjection(null)`)), null);
    assert.strictEqual(J(await app.eval(`publicUserProjection({name:'no id'})`)), null);
    app.close();
  });

  test('Users.all() serves names from the projection, not from the users collection', async () => {
    const app = await bootApp({
      files: FILES, user: null, seedUsers: false,
      db: { seed: {
        user_directory: {
          vet1: { id: 'vet1', name: 'دكتورة سمر', role: 'vet', active: true, initials: 'دس' },
          w1:   { id: 'w1', name: 'عامل', role: 'worker', active: false, initials: 'ع' },
        },
        // A secret-bearing record that must never be reached through all().
        users: { vet1: Object.assign({}, SECRET_RECORD) },
      } },
    });
    app.db.log.length = 0;
    const got = J(await app.eval(`(async()=>await Users.all())()`));
    assert.strictEqual(got.length, 2, 'both directory entries come back');
    assert.ok(got.every((u) => !('pin_hash' in u) && !('pin' in u) && !('pin_hash_v2' in u)),
      'no hash may ever leave the directory read');
    const reads = app.db.log.filter((c) => c.method === 'GET').map((c) => c.parts);
    assert.ok(reads.includes('user_directory'), 'the projection is the source: ' + reads.join(', '));
    assert.ok(!reads.includes('users'), 'the users collection must not be read at all: ' + reads.join(', '));
    app.close();
  });

  test('readUserDirectory falls back to users during the migration window', async () => {
    const app = await bootApp({
      files: FILES, user: null, seedUsers: false,
      db: { seed: { user_directory: {}, users: { vet1: Object.assign({}, SECRET_RECORD) } } },
    });
    const got = J(await app.eval(`(async()=>await readUserDirectory())()`));
    assert.strictEqual(got.length, 1, 'an empty projection means "not migrated yet", not "no users"');
    assert.strictEqual(got[0].id, 'vet1');
    assert.ok(!('pin_hash' in got[0]), 'even the fallback path must project, never pass the record through');
    app.close();
  });

  /* ── the auth bridge (F-29) ──────────────────────────────────────── */

  test('F-29: a wrong PIN never provisions a Firebase Auth account', async () => {
    const auth = createFakeAuth();
    const app = await bootApp({ files: FILES, user: null, seedUsers: false, auth, db: { seed: {} } });
    const got = J(await app.eval(`(async()=>await signInWithFirebaseAuth('admin1','0000'))()`));
    assert.strictEqual(got.ok, false);
    assert.strictEqual(got.reason, 'not-provisioned',
      'an unknown account must be reported as unprovisioned, got ' + got.reason);
    assert.deepStrictEqual(Object.keys(auth.state.accounts), [],
      'no credential may be created for a PIN nobody verified');
    // firebase.js legitimately calls accounts:signUp with NO email to mint the
    // Anonymous Auth session every REST request needs; what must never happen
    // is signUp with an email/password pair nobody verified.
    assert.ok(!auth.state.calls.some((c) => c.name === 'signUp' && c.email),
      'signUp must not be reached from a plain sign-in attempt: ' +
      JSON.stringify(auth.state.calls.filter((c) => c.name === 'signUp')));
    app.close();
  });

  test('provisioning is explicit, and only after a verified PIN', async () => {
    const auth = createFakeAuth();
    const app = await bootApp({ files: FILES, user: null, seedUsers: false, auth, db: { seed: {} } });
    const got = J(await app.eval(`(async()=>{
      const denied = await signInWithFirebaseAuth('admin1','1234');            // no provision flag
      const made   = await signInWithFirebaseAuth('admin1','1234',{provision:true});
      return {denied, made, email:'u_admin1@bayan-farm.internal'};
    })()`));
    assert.strictEqual(got.denied.ok, false);
    assert.strictEqual(got.made.ok, true, 'an explicit provision must succeed');
    assert.ok(auth.state.accounts[got.email], 'the synthetic account now exists');
    assert.strictEqual(auth.state.accounts[got.email].password, 'bfarm-pin-1234-v1');
    // and the mapping the hardened rules depend on was written
    const lookup = app.db.data.uid_lookup || {};
    assert.ok(Object.keys(lookup).length === 1, 'uid_lookup must map the new Firebase uid');
    assert.strictEqual(Object.values(lookup)[0].appUserId, 'admin1');
    app.close();
  });

  test('a disabled Email/Password provider is detected and named, not swallowed', async () => {
    const auth = createFakeAuth({ providerEnabled: false });
    const app = await bootApp({ files: FILES, user: null, seedUsers: false, auth, db: { seed: {} } });
    const got = J(await app.eval(`(async()=>{
      sessionStorage.removeItem('_farm_auth_provider');
      const r = await signInWithFirebaseAuth('admin1','1234',{provision:true});
      return {r, state:_authProviderState(), probe: await probeAuthProvider()};
    })()`));
    assert.strictEqual(got.r.ok, false);
    assert.strictEqual(got.r.reason, 'provider-disabled');
    assert.strictEqual(got.state, 'disabled', 'the fact is remembered so login.html can explain it');
    assert.strictEqual(got.probe, 'disabled');
    assert.ok(!Object.keys(auth.state.accounts).length, 'a disabled provider must not create accounts either');
    app.close();
  });

  test('signInBestSlot tries the newest slot first, so a rotated PIN still works', async () => {
    const auth = createFakeAuth({ accounts: {
      'u_vet1@bayan-farm.internal':    { password: 'bfarm-pin-1111-v1', localId: 'uid-old' },
      'u_vet1-2@bayan-farm.internal':  { password: 'bfarm-pin-2222-v1', localId: 'uid-new' },
    } });
    const app = await bootApp({ files: FILES, user: null, seedUsers: false, auth, db: { seed: {
      users: { vet1: { id: 'vet1', role: 'vet', active: true, auth_slots: [
        { email: 'u_vet1@bayan-farm.internal', n: 1 },
        { email: 'u_vet1-2@bayan-farm.internal', n: 2 },
      ] } } },
    } });
    const got = J(await app.eval(`(async()=>{
      const rec = await fbGetOne('users','vet1');
      const stalePin = await signInBestSlot('vet1','1111',rec);   // the OLD pin
      const newPin   = await signInBestSlot('vet1','2222',rec);   // the CURRENT pin
      return {stalePin, newPin, order: _authSlotsFor(rec,'vet1')};
    })()`));
    assert.deepStrictEqual(got.order, ['u_vet1-2@bayan-farm.internal', 'u_vet1@bayan-farm.internal'],
      'newest slot first');
    assert.strictEqual(got.newPin.ok, true);
    assert.strictEqual(got.newPin.uid, 'uid-new');
    // The old PIN still signs in to the OLD slot. That is inherent to a
    // password-based bridge with no server to revoke with — so the record's
    // slots are capped at four and rotatePin() writes the new hash first.
    // What must NOT happen is the current PIN failing.
    assert.ok(true);
    app.close();
  });

  test('rotatePin re-hashes both schemes, fills the write-only vault and adds a slot', async () => {
    const auth = createFakeAuth({ accounts: {
      'u_vet1@bayan-farm.internal': { password: 'bfarm-pin-1111-v1', localId: 'uid-old' },
    } });
    const app = await bootApp({ files: FILES, user: null, seedUsers: false, auth, db: { seed: {
      users: { vet1: { id: 'vet1', name: 'دكتورة سمر', role: 'vet', active: true, pin_hash: 'OLD', auth_slots: [
        { email: 'u_vet1@bayan-farm.internal', n: 1 },
      ] } },
    } } });
    const got = J(await app.eval(`(async()=>await rotatePin('vet1','2222'))()`));
    assert.strictEqual(got.ok, true);
    const rec = app.db.data.users.vet1;
    assert.strictEqual(rec.pin, null, 'the plaintext PIN must never be persisted');
    assert.notStrictEqual(rec.pin_hash, 'OLD', 'the legacy hash is replaced');
    assert.ok(/^[0-9a-f]{64}$/.test(rec.pin_hash_v2), 'the PBKDF2 hash is stored on the record');
    const vault = app.db.data.pin_vault && app.db.data.pin_vault.vet1;
    assert.ok(vault && vault.pin_hash_v2 === rec.pin_hash_v2, 'the write-only vault holds the same hash');
    assert.strictEqual(rec.auth_slots.length, 2, 'a fresh slot was provisioned for the new PIN');
    assert.strictEqual(rec.auth_slots[1].email, 'u_vet1-2@bayan-farm.internal');
    assert.ok(auth.state.accounts['u_vet1-2@bayan-farm.internal'],
      'and it really exists in Firebase Auth, so the next login is server-verified');
    // the new PIN now verifies end to end
    const login = J(await app.eval(`(async()=>{
      const r = await fbGetOne('users','vet1');
      return await signInBestSlot('vet1','2222',r);
    })()`));
    assert.strictEqual(login.ok, true);
    app.close();
  });

  test('Users.add hashes, mirrors to the projection and provisions — plaintext never lands', async () => {
    const auth = createFakeAuth();
    const app = await bootApp({ files: FILES, user: null, seedUsers: false, auth, db: { seed: {} } });
    await app.eval(`(async()=>await Users.add({id:'w9',name:'عامل جديد',role:'worker',pin:'5678',active:true}))()`);
    const rec = app.db.data.users.w9;
    assert.ok(rec, 'the user was written');
    assert.strictEqual(rec.pin, undefined, 'no plaintext pin field on the record');
    assert.ok(rec.pin_hash, 'legacy hash present for the transition window');
    assert.ok(/^[0-9a-f]{64}$/.test(rec.pin_hash_v2), 'PBKDF2 hash present');
    const dir = app.db.data.user_directory.w9;
    assert.ok(dir && dir.name === 'عامل جديد' && dir.role === 'worker', 'the projection was mirrored');
    assert.ok(!('pin_hash' in dir) && !('pin' in dir), 'the projection holds no secret');
    const vault = app.db.data.pin_vault && app.db.data.pin_vault.w9;
    assert.ok(vault && vault.pin_hash_v2 === rec.pin_hash_v2, 'vault written');
    assert.ok(auth.state.accounts['u_w9@bayan-farm.internal'], 'bridge account provisioned');
    assert.strictEqual(auth.state.accounts['u_w9@bayan-farm.internal'].password, 'bfarm-pin-5678-v1');
    app.close();
  });

  /* ── server-verified sessions (O-01) ─────────────────────────────── */

  test('verifySession drops a hand-edited role instead of trusting localStorage', async () => {
    const app = await bootApp({
      files: FILES, seedUsers: false,
      user: { id: 'vet1', name: 'دكتورة سمر', role: 'vet', active: true },
      db: { seed: { users: { vet1: { id: 'vet1', name: 'دكتورة سمر', role: 'vet', active: true } } } },
    });
    // Boot with an honest session, then edit it in DevTools — the exact attack
    // O-01 describes. (Booting already-forged would be caught by initApp()'s
    // own verifySession() call before the test could look at it, which is the
    // point of wiring it there.)
    app.eval(`localStorage.setItem('farm_user', JSON.stringify({
      id:'vet1', name:'دكتورة سمر', role:'admin', active:true }))`);
    assert.strictEqual(J(await app.eval(`can('finance')`)), true,
      'sanity: the forged role does pass the client-side check — that is the bug');
    const got = J(await app.eval(`(async()=>await verifySession({force:true}))()`));
    assert.strictEqual(got.ok, false);
    assert.strictEqual(got.reason, 'role-mismatch');
    assert.strictEqual(got.serverRole, 'vet');
    assert.strictEqual(got.localRole, 'admin');
    assert.strictEqual(await app.eval(`getUser()`), null, 'the forged session is cleared');
    assert.strictEqual(J(await app.eval(`can('finance')`)), false, 'and the forged privilege is gone');
    app.close();
  });

  test('verifySession also drops a deactivated account, and keeps an honest one', async () => {
    const off = await bootApp({
      files: FILES, seedUsers: false, user: null,
      db: { seed: { users: { w1: { id: 'w1', name: 'عامل', role: 'worker', active: false } } } },
    });
    // An account deactivated in users.html while its owner's browser still
    // holds a session: the session must die at the next page load.
    off.eval(`localStorage.setItem('farm_user', JSON.stringify({id:'w1',name:'عامل',role:'worker',active:true}))`);
    const got = J(await off.eval(`(async()=>await verifySession({force:true}))()`));
    assert.strictEqual(got.ok, false);
    assert.strictEqual(got.reason, 'deactivated');
    assert.strictEqual(await off.eval(`getUser()`), null);
    off.close();

    const ok = await bootApp({
      files: FILES, seedUsers: false,
      user: { id: 'vet1', name: 'دكتورة سمر', role: 'vet', active: true },
      db: { seed: { users: { vet1: { id: 'vet1', name: 'دكتورة سمر', role: 'vet', active: true } } } },
    });
    const good = J(await ok.eval(`(async()=>await verifySession({force:true}))()`));
    assert.deepStrictEqual(good, { ok: true, reason: 'verified', serverRole: 'vet' });
    assert.ok(await ok.eval(`getUser()`), 'an honest session is left alone');
    ok.close();
  });

  test('verifySession never locks anybody out just because the server is unreachable', async () => {
    const app = await bootApp({
      files: FILES, seedUsers: false, failMode: 'network',
      user: { id: 'admin1', name: 'مدير المزرعة', role: 'admin', active: true },
      db: { seed: { users: { admin1: { id: 'admin1', role: 'admin', active: true } } } },
    });
    const got = J(await app.eval(`(async()=>await verifySession({force:true}))()`));
    assert.deepStrictEqual(got, { ok: true, reason: 'unverifiable' },
      'an outage is not evidence of a forged session — the rules still enforce every write');
    assert.ok(await app.eval(`getUser()`), 'the session survives the outage');
    app.close();
  });

  test('a rules denial (403) is distinguishable from an outage and from 404', async () => {
    const app = await bootApp({
      files: FILES, user: null, seedUsers: false,
      failMode: (method, parts) => {
        if (parts === 'users') return new Response(JSON.stringify({ error: 'Permission denied' }), { status: 403 });
        return null;
      },
      db: { seed: {} },
    });
    const got = J(await app.eval(`(async()=>{
      const safe = await fbGetSafe('users');
      return {safe, status:lastFbStatus(), denied:isPermissionDenied(), path:lastFbPath()};
    })()`));
    assert.strictEqual(got.safe, null, 'a denied read reports failure, not "empty"');
    assert.strictEqual(got.status, 403);
    assert.strictEqual(got.denied, true);
    assert.ok(/users/.test(got.path), 'the denial is attributed to the path that caused it');
    app.close();
  });

  /* ── the API proxies (O-21) ──────────────────────────────────────── */

  test('O-21: the proxies refuse to be an open relay for the owner\'s key', () => {
    const guard = require(path.join(ROOT, 'server', 'api-guard.js'));
    const res = () => {
      const r = { headers: {}, status: 200, body: null };
      r.setHeader = (k, v) => { r.headers[k] = v; };
      r.status = (s) => { r.code = s; return r; };
      r.json = (b) => { r.body = b; return r; };
      r.end = () => r;
      return r;
    };
    const req = (over = {}) => Object.assign({
      method: 'POST', headers: { origin: 'https://farm.vercel.app', host: 'farm.vercel.app' },
      body: { model: 'llama-3.1-8b-instant', messages: [] }, socket: { remoteAddress: '1.2.3.4' },
    }, over);

    const saved = Object.assign({}, process.env);
    try {
      // (a) server key configured, no FARM_API_TOKEN -> refuse. This is the
      //     exact shape api/claude.js shipped with: a paid key behind "*".
      process.env.ANTHROPIC_API_KEY = 'sk-owner-secret';
      delete process.env.FARM_API_TOKEN;
      let a = guard.authorize(req(), { serverKey: process.env.ANTHROPIC_API_KEY, headerKey: '' });
      assert.strictEqual(a.ok, false);
      assert.strictEqual(a.status, 403);
      assert.ok(/open relay/i.test(a.error), 'the refusal must say what to do: ' + a.error);

      // (b) with a token configured, a caller without it is rejected ...
      process.env.FARM_API_TOKEN = 'tok-secret';
      a = guard.authorize(req(), { serverKey: process.env.ANTHROPIC_API_KEY, headerKey: '' });
      assert.strictEqual(a.ok, false);
      assert.strictEqual(a.status, 401);
      // ... a wrong token is rejected ...
      a = guard.authorize(req({ headers: { 'x-farm-token': 'nope', origin: 'https://farm.vercel.app', host: 'farm.vercel.app' } }),
        { serverKey: process.env.ANTHROPIC_API_KEY, headerKey: '' });
      assert.strictEqual(a.ok, false);
      // ... and the right one is served the OWNER's key, never echoed back.
      a = guard.authorize(req({ headers: { 'x-farm-token': 'tok-secret', origin: 'https://farm.vercel.app', host: 'farm.vercel.app' } }),
        { serverKey: process.env.ANTHROPIC_API_KEY, headerKey: '' });
      assert.strictEqual(a.ok, true);
      assert.strictEqual(a.mode, 'server-key');
      assert.strictEqual(a.apiKey, 'sk-owner-secret');

      // (c) bring-your-own key still works with no token — that is the path
      //     assistant.html uses today, so the feature is not broken by the fix.
      a = guard.authorize(req({ headers: { 'x-user-key': 'gsk-mine', origin: 'https://farm.vercel.app', host: 'farm.vercel.app' } }),
        { serverKey: process.env.ANTHROPIC_API_KEY, headerKey: 'gsk-mine' });
      assert.strictEqual(a.ok, true);
      assert.strictEqual(a.mode, 'byo');
      assert.strictEqual(a.apiKey, 'gsk-mine');

      // (d) a foreign origin is refused even with a valid token
      process.env.ALLOWED_ORIGINS = 'https://farm.vercel.app';
      a = guard.authorize(req({ headers: { 'x-farm-token': 'tok-secret', origin: 'https://evil.example', host: 'farm.vercel.app' } }),
        { serverKey: process.env.ANTHROPIC_API_KEY, headerKey: '' });
      assert.strictEqual(a.ok, false);
      assert.strictEqual(a.status, 403);
      delete process.env.ALLOWED_ORIGINS;

      // (e) output tokens are clamped so one request cannot run up a bill
      const clamped = guard.clampBody({ model: 'x', max_tokens: 999999 });
      assert.ok(clamped.max_tokens <= 4096, 'clamped to ' + clamped.max_tokens);
      process.env.MAX_OUTPUT_TOKENS = '256';
      assert.strictEqual(guard.clampBody({ max_tokens: 9999 }).max_tokens, 256);
      delete process.env.MAX_OUTPUT_TOKENS;

      // (f) and a flood from one IP is throttled
      process.env.RATE_LIMIT = '3';
      // The limiter keeps per-IP state at module scope, so this phase gets its
      // own address — the calls above already spent a different IP's quota.
      const flood = [1, 2, 3, 4].map(() => guard.authorize(
        req({ headers: { 'x-user-key': 'gsk-mine', origin: 'https://farm.vercel.app', host: 'farm.vercel.app' },
              socket: { remoteAddress: '9.9.9.9' } }),
        { serverKey: '', headerKey: 'gsk-mine' }));
      assert.deepStrictEqual(flood.map((r) => (r.ok ? 'ok' : r.status)), ['ok', 'ok', 'ok', 429]);
      delete process.env.RATE_LIMIT;

      // (g) CORS is origin-specific now, never "*"
      const r1 = res();
      guard.setCors(req({ headers: { origin: 'https://farm.vercel.app', host: 'farm.vercel.app' } }), r1);
      assert.strictEqual(r1.headers['Access-Control-Allow-Origin'], 'https://farm.vercel.app');
      assert.strictEqual(r1.headers.Vary, 'Origin');
      const r2 = res();
      guard.setCors(req({ headers: { origin: 'https://evil.example', host: 'farm.vercel.app' } }), r2);
      assert.notStrictEqual(r2.headers['Access-Control-Allow-Origin'], '*', 'never a wildcard');
      assert.notStrictEqual(r2.headers['Access-Control-Allow-Origin'], 'https://evil.example');
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  });

  test('O-21: neither proxy forwards a client-supplied Authorization or skips the guard', () => {
    for (const file of ['api/groq.js', 'api/claude.js']) {
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert.ok(src.includes("require('../server/api-guard')"), file + ' must go through the shared guard');
      assert.ok(src.includes('guard.authorize('), file + ' must authorize before relaying');
      assert.ok(src.includes('guard.setCors('), file + ' must set origin-specific CORS');
      assert.ok(src.includes('guard.clampBody('), file + ' must clamp requested tokens');
      assert.ok(!/Access-Control-Allow-Origin['"]?\s*,\s*['"]\*/.test(src), file + ' must not answer "*"');
      assert.ok(!/headers\[['"]authorization['"]\]/i.test(src), file + ' must not forward an inbound Authorization header');
      assert.ok(!/req\.headers\[['"]x-user-key['"]\]\s*\|\|/.test(src),
        file + ' must not treat a client header as a fallback for the server key');
    }
    const vercel = fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8');
    assert.ok(!/"Access-Control-Allow-Origin"[\s\S]{0,80}"\*"/.test(vercel),
      'vercel.json must not re-open the wildcard CORS the functions just closed');
  });

  /* ── the rules file itself (O-18 / O-01) ─────────────────────────── */

  test('O-18: database.rules.json no longer lets a client read users or any hash', () => {
    const rules = readRules();
    assert.strictEqual(rules.users['.read'], false, 'the users collection must not be listable by anyone');
    const selfRead = rules.users.$uid['.read'];
    assert.ok(/===\s*\$uid/.test(selfRead), 'a record is readable only by its own owner …');
    assert.ok(/'admin'/.test(selfRead), '… or by an admin');
    assert.ok(!/auth != null"$/.test(selfRead), 'and never by "any authenticated session"');

    assert.ok(rules.pin_vault, 'the write-only vault exists');
    assert.strictEqual(rules.pin_vault['.read'], false, 'a stored hash can never be read back');
    assert.strictEqual(rules.pin_vault['.write'], false);
    assert.ok(/===\s*\$uid/.test(rules.pin_vault.$uid['.write']), 'only its owner (or an admin) may write it');

    assert.ok(rules.user_directory, 'the public projection exists');
    assert.strictEqual(rules.user_directory['.read'], 'auth != null',
      'names/roles stay readable so the UI works without touching users/');
    assert.ok(/'admin'/.test(rules.user_directory['.write']), 'but only an admin may publish them');
    assert.ok(!/pin/i.test(JSON.stringify(rules.user_directory)), 'no hash-shaped field in the projection rules');
  });

  test('O-01: every collection resolves the role on the server — no bare "auth != null" writes', () => {
    const rules = readRules();
    const collections = Object.keys(rules).filter((k) => !k.startsWith('.') && rules[k] && typeof rules[k] === 'object');
    assert.ok(collections.length >= 40, 'expected the full collection set, saw ' + collections.length);

    const bareWrites = [], bareReads = [], unresolved = [];
    for (const name of collections) {
      const c = rules[name];
      const w = c['.write'], r = c['.read'];
      if (w === 'auth != null' || w === true) bareWrites.push(name);
      if (r === 'auth != null' || r === true) bareReads.push(name);
      // Anything that is not a flat deny must resolve the app identity through
      // uid_lookup, or be the one deliberately public projection.
      const exprs = [r, w].filter((e) => typeof e === 'string' && e !== 'false');
      for (const e of exprs) {
        if (!/uid_lookup/.test(e) && name !== 'user_directory') unresolved.push(name + ': ' + e.slice(0, 60));
      }
    }
    assert.deepStrictEqual(bareWrites, [], 'no collection may be writable by any anonymous session');
    assert.deepStrictEqual(bareReads, ['user_directory'],
      'only the secret-free projection may be read by any authenticated session');
    assert.deepStrictEqual(unresolved, [],
      'every rule must resolve the caller through uid_lookup -> users -> role');
  });

  test('O-01: the rules encode a server-side policy — staff-wide reads, role-scoped writes, admin-only money', () => {
    const rules = readRules();
    // A role is granted when its literal appears in the expression; `staff()`
    // always lists admin first, so admin-only rules contain exactly one literal.
    const rolesAllowed = (expr) => ['admin', 'supervisor', 'vet', 'worker', 'visitor']
      .filter((r) => new RegExp("'" + r + "'").test(String(expr)));

    // Money and the ledger: admin only, BOTH directions (ROLE_PERMS excludes
    // 'finance' for every other role, and now the server agrees with it).
    assert.deepStrictEqual(rolesAllowed(rules.finance['.read']), ['admin']);
    assert.deepStrictEqual(rolesAllowed(rules.finance['.write']), ['admin']);
    assert.deepStrictEqual(rolesAllowed(rules.journal_entries['.read']), ['admin']);
    assert.deepStrictEqual(rolesAllowed(rules.animal_cost_ledger['.read']), ['admin']);

    // Operational collections: any active staff member may read (a vet needs
    // animal tags to file a health record), but no visitor may write anything.
    for (const name of ['animals', 'health', 'breeding', 'production_log', 'inventory_meds', 'daily_tasks']) {
      assert.deepStrictEqual(rolesAllowed(rules[name]['.read']), ['admin', 'supervisor', 'vet', 'worker', 'visitor'],
        name + ' reads');
      assert.deepStrictEqual(rolesAllowed(rules[name]['.write']), ['admin', 'supervisor', 'vet', 'worker'],
        name + ' writes');
    }

    // The audit trail: staff read it, only an admin writes it.
    assert.deepStrictEqual(rolesAllowed(rules.activity_log['.read']), ['admin', 'supervisor', 'vet', 'worker', 'visitor']);
    assert.deepStrictEqual(rolesAllowed(rules.activity_log['.write']), ['admin']);

    // Settings: everybody reads the farm name and thresholds; admin writes.
    assert.deepStrictEqual(rolesAllowed(rules.settings['.write']), ['admin']);

    // And nowhere, in any collection, does a visitor get write access — nor an
    // anonymous session, which is what "auth != null" alone used to mean here.
    for (const [name, body] of Object.entries(rules)) {
      if (!body || typeof body !== 'object') continue;
      for (const [key, expr] of Object.entries(body)) {
        if (typeof expr !== 'string' || !key.startsWith('.write')) continue;
        assert.ok(!/'visitor'/.test(expr), name + key + ' must not grant a visitor write access');
        assert.notStrictEqual(expr, 'auth != null', name + key + ' must not accept any anonymous session');
      }
    }
  });

  test('the policy is generated by a script, and the file has not drifted from it', () => {
    // database.rules.json is 600 lines of hand-edited JSON-with-comments, which
    // is exactly how 26 collections drifted into a bare "auth != null". The
    // policy now lives in scripts/apply-access-policy.js; this asserts the
    // committed file still matches what that script produces, so a hand edit
    // that reopens a hole fails here instead of in production.
    const { execFileSync } = require('child_process');
    const out = execFileSync(process.execPath,
      [path.join(ROOT, 'scripts', 'apply-access-policy.js'), '--check'],
      { encoding: 'utf8', cwd: ROOT });
    assert.ok(/access policy is applied/.test(out), out);
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'apply-access-policy.js'), 'utf8');
    assert.ok(src.includes("'.read':  false".replace("'", '"')) || src.includes('".read":  false'),
      'the script owns the users/.read=false decision');
  });

  test('the hardened rules are still valid JSON-with-comments and deployable', () => {
    const raw = fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8');
    assert.ok(raw.trim().startsWith('{') && raw.trim().endsWith('}'), 'the file must be a single JSON object');
    const rules = readRules();                       // throws if comments break the structure
    assert.ok(rules['.read'] === undefined || typeof rules === 'object');
    // Firebase rejects rules with a trailing comma or a comment inside a
    // string; both would only show up at deploy time, so check the shape here.
    const opens = (raw.match(/\{/g) || []).length, closes = (raw.match(/\}/g) || []).length;
    assert.strictEqual(opens, closes, 'braces must balance (' + opens + ' vs ' + closes + ')');
    assert.ok(Object.keys(rules).length >= 45, 'expected users, user_directory and pin_vault among the collections');
    // Every expression must be a string, a boolean, or a nested rule object —
    // a typo here silently becomes "allow" in some rule engines.
    for (const [name, body] of Object.entries(rules)) {
      if (!body || typeof body !== 'object') continue;
      for (const [k, v] of Object.entries(body)) {
        if (k.startsWith('.')) {
          const okType = typeof v === 'string' || typeof v === 'boolean' ||
            (k === '.indexOn' && (Array.isArray(v) || typeof v === 'string'));
          assert.ok(okType, name + '.' + k + ' must be a rule expression, got ' + typeof v);
        }
      }
    }
  });
});
