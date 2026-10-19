// Module 22 — Repository-level static invariants.
// These checks are about the SHAPE of the codebase rather than one module's
// behaviour: every navigation target exists and is permission-gated, every
// collection the app writes to is declared in database.rules.json (the bug
// class that produced live 401s), no page derives a local calendar key from
// UTC, every page loads the script chain in order, HTML is balanced, no
// object literal silently shadows one of its own keys, and the Capacitor
// APK's copy of the web app has not drifted from the root again.
const fs = require('fs');
const path = require('path');
const { suite, assert, ROOT } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

// Every .html/.js the deployed app consists of (excludes the APK copy, docs,
// tests, tooling and node_modules).
function appFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (['node_modules', '.git', '.github', 'tests', 'scripts', 'docs', 'farm-apk', 'media', 'release', '.claude'].includes(e.name)) continue;
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.(html|js)$/.test(e.name)) out.push(rel);
    }
  };
  walk('.');
  return out;
}

// Replaces every comment and string literal with spaces (preserving offsets
// and line breaks) so brace counting and key scanning see code only. Without
// this, an Arabic comment or an emoji inside a string literal throws a naive
// brace counter off by enough to report duplicate keys that do not exist.
function codeOnly(src) {
  let out = '', i = 0;
  const n = src.length;
  let state = null; // 'line' | 'block' | "'" | '"' | '`'
  let tplDepth = 0;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (state === null) {
      if (c === '/' && d === '/') { state = 'line'; out += '  '; i += 2; continue; }
      if (c === '/' && d === '*') { state = 'block'; out += '  '; i += 2; continue; }
      if (c === "'" || c === '"' || c === '`') { state = c; out += ' '; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 'line') { if (c === '\n') { state = null; out += '\n'; } else out += ' '; i++; continue; }
    if (state === 'block') {
      if (c === '*' && d === '/') { state = null; out += '  '; i += 2; continue; }
      out += c === '\n' ? '\n' : ' '; i++; continue;
    }
    // inside a string/template literal
    if (c === '\\') { out += '  '; i += 2; continue; }
    if (c === state) {
      if (state === '`' && tplDepth > 0) { tplDepth--; out += ' '; i++; continue; }
      state = null; out += ' '; i++; continue;
    }
    if (state === '`' && c === '$' && d === '{') { state = null; tplDepth++; out += '${'; i += 2; continue; }
    out += c === '\n' ? '\n' : ' ';
    i++;
  }
  return out;
}

module.exports = suite('22 · Repository invariants', ({ test }) => {
  const files = appFiles();
  const htmlPages = files.filter((f) => f.endsWith('.html'));
  const navSrc = read('nav.js');
  const navHrefs = [...navSrc.matchAll(/href:'([^']+)'/g)].map((m) => m[1]);

  test('every page linked from nav.js exists on disk', () => {
    const missing = navHrefs.filter((h) => !exists(h));
    assert.deepStrictEqual(missing, [], 'nav.js links to files that do not exist (activity.html was once a 0-byte stub)');
    assert.ok(navHrefs.length >= 20, `expected the full nav, found ${navHrefs.length}`);
  });

  test('no page links to a .html file that does not exist (dead navigation)', () => {
    const dead = [];
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/(?:href=|location\.href\s*=\s*|window\.location\s*=\s*)['"]([a-z0-9._/-]+\.html)['"]/gi)) {
        const target = m[1].replace(/^\.\//, '');
        if (/^https?:/.test(target)) continue;
        if (!exists(target) && !exists(path.join(path.dirname(f), target))) dead.push(`${f} → ${target}`);
      }
    }
    assert.deepStrictEqual(dead, [], 'dead .html links found');
  });

  test('every page declares its own permission enforcement (inline or delegated)', () => {
    const exceptions = new Set(['bayan.html', 'activity.html', 'login.html', 'index.html', 'bayan-offline.html']);
    const gaps = [];
    for (const [, href, perm] of navSrc.matchAll(/href:'([^']+)'[^}]*perm:'([^']+)'/g)) {
      if (exceptions.has(href)) continue;
      const src = read(href);
      const inline = /if\s*\(\s*!(can|canWrite)\(/.test(src);
      let delegated = false;
      const jsName = href.replace(/\.html$/, '.js');
      if (!inline && src.includes(`pages/${jsName}`) && exists(path.join('pages', jsName))) {
        delegated = /if\s*\(\s*!(can|canWrite)\(/.test(read(path.join('pages', jsName)));
      }
      if (!inline && !delegated) gaps.push(`${href} (perm:${perm})`);
    }
    assert.deepStrictEqual(gaps, [], 'pages reachable from the nav with no permission gate');
  });

  test('every collection the app reads or writes is declared in database.rules.json', () => {
    // The rules file's own comments record three collections that were
    // missing entirely (inventory_equipment, weight_alerts,
    // production_alerts, workflow_history) and therefore 401'd in
    // production. This check makes that class of bug impossible to
    // reintroduce silently.
    const rules = read('database.rules.json');
    const declared = new Set([...rules.matchAll(/^    "([a-z_0-9]+)":\s*\{/gm)].map((m) => m[1]));
    const used = new Set();
    for (const f of files) {
      const src = read(f);
      for (const m of src.matchAll(/\bfb(?:Get|GetOne|GetSingle|GetSafe|Post|Put|Patch|Delete)\(\s*['"`]([a-z_0-9]+)/g)) used.add(m[1]);
      for (const m of src.matchAll(/\bfbTable\s*=\s*['"]([a-z_0-9]+)/g)) used.add(m[1]);
    }
    // Nested paths resolve to their root collection, which is what rules key on.
    const undeclared = [...used].filter((c) => !declared.has(c)).sort();
    assert.deepStrictEqual(undeclared, [], 'collections used by the app but absent from database.rules.json → every request 401s');
  });

  test('no local calendar key is derived from toISOString() anywhere in the app', () => {
    // The 2026-10 audit found ~35 of these: correct at TZ=UTC, silently
    // shifted one day/month back for this farm (UTC+3). The only allowed
    // occurrences are the helper documentation in firebase.js and
    // shared.js's _dayAfter(), which is deliberately and correctly UTC.
    const offenders = [];
    for (const f of files) {
      codeOnly(read(f)).split('\n').forEach((line, i) => {
        if (/toISOString\(\)\s*\.\s*slice\(0,\s*(7|10)\)/.test(line)) {
          // shared.js's _dayAfter() is deliberately and correctly UTC: it
          // parses with an explicit 'T00:00:00Z' and steps with setUTCDate.
          const isDayAfter = /setUTCDate|T00:00:00Z/.test(read(f).split('\n').slice(Math.max(0, i - 4), i + 1).join('\n'));
          if (!isDayAfter) offenders.push(`${f}:${i + 1}`);
        }
      });
    }
    assert.deepStrictEqual(offenders, [], 'use toLocalDateStr()/toLocalMonthKey()/shiftDateLocal() instead');
  });

  test('the local-date helpers exist and are exported by the first script every page loads', () => {
    const src = read('firebase.js');
    ['function toLocalDateStr(', 'function toLocalMonthKey(', 'function shiftDateLocal(', 'function monthStartLocal(', 'function monthEndLocal(', 'function fbGetSafe(', 'function canWrite(']
      .forEach((sig) => assert.ok(src.includes(sig), `firebase.js must define ${sig}`));
  });

  test('any page that renders the navigation actually loads nav.js', () => {
    // fix-births.html (an admin repair tool, not in nav.js) loads
    // config/firebase/shared but not nav.js — harmless, because it never
    // renders the rail. The invariant that actually prevents a crash is the
    // implication, not the presence: calling renderNavbarV2()/FARM_NAV
    // without nav.js loaded is a guaranteed ReferenceError on load.
    const bad = [];
    for (const page of htmlPages) {
      const src = read(page);
      const usesNav = /renderNavbarV2\s*\(|buildSidebarNav\s*\(|FARM_NAV/.test(codeOnly(src));
      const loadsNav = src.includes('src="nav.js"');
      if (usesNav && !loadsNav) bad.push(page);
    }
    assert.deepStrictEqual(bad, [], 'pages that render the nav without loading nav.js');
  });

  test('every app page loads the script chain in the documented order', () => {
    // config.js → firebase.js → nav.js → shared.js, with the documented
    // exceptions (login.html has no nav/shared; index.html is a redirect;
    // bayan*.html are standalone static reports).
    const standalone = new Set(['index.html', 'login.html', 'bayan.html', 'bayan-offline.html', 'fix-births.html']);
    const bad = [];
    for (const page of htmlPages) {
      if (standalone.has(page)) continue;
      const src = read(page);
      const order = ['config.js', 'firebase.js', 'nav.js', 'shared.js']
        .map((s) => src.indexOf(`src="${s}"`))
        .filter((i) => i >= 0);
      if (order.length < 4) { bad.push(`${page}: missing ${4 - order.length} of the core scripts`); continue; }
      const sorted = [...order].sort((a, b) => a - b);
      if (JSON.stringify(order) !== JSON.stringify(sorted)) bad.push(`${page}: core scripts load out of order`);
    }
    assert.deepStrictEqual(bad, [], 'script-chain violations');
  });

  test('login.html deliberately skips nav.js/shared.js but still has the data layer', () => {
    const src = read('login.html');
    assert.ok(src.includes('src="config.js"') && src.includes('src="firebase.js"'));
    assert.ok(!src.includes('src="nav.js"'), 'the login screen has no navigation');
    assert.ok(!src.includes('src="shared.js"'), 'and needs none of the shared UI helpers');
    assert.ok(src.includes('fbGetSafe('), 'the login bootstrap must distinguish a failed read from an empty users collection');
  });

  test('every HTML page has balanced tags (settings.html once left .page-wrap open)', () => {
    const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const problems = [];
    for (const page of htmlPages) {
      let src = read(page)
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<script\b[\s\S]*?<\/script>/g, '')
        .replace(/<style\b[\s\S]*?<\/style>/g, '');
      const stack = [];
      for (const m of src.matchAll(/<(\/?)([a-zA-Z0-9]+)([^>]*)>/g)) {
        const [, close, rawTag, attrs] = m;
        const tag = rawTag.toLowerCase();
        if (VOID.has(tag) || attrs.trim().endsWith('/')) continue;
        if (!close) stack.push(tag);
        else if (stack[stack.length - 1] === tag) stack.pop();
        else if (stack.includes(tag)) { while (stack.length && stack[stack.length - 1] !== tag) problems.push(`${page}: unclosed <${stack.pop()}>`); stack.pop(); }
        else problems.push(`${page}: stray </${tag}>`);
      }
      stack.filter((t) => t !== 'html' && t !== 'body').forEach((t) => problems.push(`${page}: <${t}> never closed`));
    }
    assert.deepStrictEqual(problems, [], 'HTML structure problems');
  });

  test('no object literal defines the same method twice (the notifications-service dead-code bug)', () => {
    // A duplicate key in an object literal is legal JavaScript: the earlier
    // definition is discarded at parse time, silently. notifications-service.js
    // shipped two different checkWeather() implementations that way and the
    // richer one never ran. This is a targeted tripwire over the top-level
    // service objects in the app's own scripts.
    const offenders = [];
    const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'try', 'else', 'do', 'function', 'const', 'let', 'var', 'await', 'async', 'typeof', 'new']);
    for (const f of files) {
      const src = codeOnly(read(f));
      for (const m of src.matchAll(/^(?:const|var|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\{\s*$/gm)) {
        // Walk the object literal line by line, tracking brace depth, and
        // collect only the keys that sit at depth 1 (its own properties).
        const declLine = src.slice(0, m.index).split('\n').length;
        const body = src.slice(m.index + m[0].length).split('\n');
        let depth = 1;
        const seen = new Map();
        for (let li = 0; li < body.length; li++) {
          const line = body[li];
          if (depth <= 0) break; // the literal ended — nothing after it belongs to this object
          if (depth === 1) {
            const km = /^\s{2}(?:async\s+)?([A-Za-z_$][\w$]*)\s*[:(]/.exec(line);
            if (km && !JS_KEYWORDS.has(km[1])) {
              if (seen.has(km[1])) offenders.push(`${f}:${seen.get(km[1])} ${m[1]}.${km[1]} defined again at line ${declLine + li}`);
              else seen.set(km[1], declLine + li);
            }
          }
          for (const ch of line) { if (ch === '{') depth++; else if (ch === '}') depth--; }
        }
      }
    }
    assert.deepStrictEqual(offenders, [], 'duplicate object keys silently discard the first implementation');
  });

  test('the Capacitor APK copy has not drifted from the root app', () => {
    // farm-apk/www is a real, deployed copy of this same web app and is
    // synced by scripts/sync-apk-www.js (not by any build step). It has
    // drifted before — silently shipping an older app inside the APK.
    const core = ['firebase.js', 'shared.js', 'config.js', 'nav.js', 'styles.css', 'offline-sync.js', 'notifications-service.js'];
    const drifted = core.filter((f) => exists(path.join('farm-apk/www', f)) && read(f) !== read(path.join('farm-apk/www', f)));
    assert.deepStrictEqual(drifted, [], 'run `node scripts/sync-apk-www.js` — farm-apk/www is out of date');
  });

  test('no application code calls eval() or new Function()', () => {
    const offenders = [];
    for (const f of files) {
      const src = read(f).replace(/\/\/.*$/gm, '');
      if (/\beval\s*\(|new\s+Function\s*\(/.test(src)) offenders.push(f);
    }
    assert.deepStrictEqual(offenders, [], 'dynamic code execution is never acceptable in this app');
  });

  test('no secret other than the public Firebase client config is committed', () => {
    const offenders = [];
    for (const f of files) {
      const src = read(f);
      if (/ANTHROPIC_API_KEY\s*[:=]\s*['"]sk-/.test(src)) offenders.push(`${f}: hardcoded Anthropic key`);
      if (/GROQ_API_KEY\s*[:=]\s*['"]gsk_/.test(src)) offenders.push(`${f}: hardcoded Groq key`);
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(src)) offenders.push(`${f}: private key material`);
    }
    assert.deepStrictEqual(offenders, [], 'server-side keys must live in Vercel env vars only');
    // The two serverless functions must read their keys from the environment.
    for (const fn of ['api/claude.js', 'api/groq.js']) {
      if (exists(fn)) assert.ok(/process\.env\./.test(read(fn)), `${fn} must read its key from process.env`);
    }
  });

  // AUDIT O-18 (2026-10) — `config.js` holds a LIVE third-party secret
  // (weatherApiKey, a paid weatherapi.com key) in a PUBLIC repository. That
  // state is already documented as a known quick-win in
  // docs/security/CONFIGURATION-SECURITY-REVIEW.md, and rotating the key or
  // moving it behind a server-side proxy is an owner decision (see O-18's
  // mitigation list), not something this suite can enforce.
  // What this test CAN enforce is that the secret does not SPREAD: it must
  // stay in exactly one injection point, with `firebase.js` reading it
  // through FARM_CONFIG. Every extra copy makes a future rotation miss a
  // file — which is precisely how the inline literal in firebase.js came to
  // exist before the Phase-2 quick win.
  test('the weather API key has exactly one injection point (config.js)', () => {
    const cfg = read('config.js');
    const m = cfg.match(/weatherApiKey:\s*'([^']+)'/);
    assert.ok(m, 'config.js must remain the single declared home of weatherApiKey');
    const key = m[1];
    const carriers = files.filter((f) => f !== 'config.js' && read(f).includes(key));
    assert.deepStrictEqual(
      carriers, [],
      `weatherApiKey must not be copied into other app files (found in: ${carriers.join(', ')}) — ` +
      'a rotation would then silently miss them. Read it via FARM_CONFIG.weatherApiKey.'
    );
    assert.ok(
      /WEATHER_API_KEY\s*=\s*FARM_CONFIG\.weatherApiKey/.test(read('firebase.js')),
      'firebase.js must consume the key through FARM_CONFIG, not through its own literal'
    );
  });

  test('the unit-test layer is wired into npm scripts and CI', () => {
    const pkg = JSON.parse(read('package.json'));
    assert.ok(pkg.scripts['test:unit'], 'package.json must expose `npm run test:unit`');
    const ci = read('.github/workflows/quality.yml');
    assert.ok(/test:unit|tests\/unit/.test(ci), 'the CI quality gate must run the unit layer (it needs no browser download)');
  });

  test('the safety scanner still passes with zero critical findings', () => {
    const { execFileSync } = require('child_process');
    const out = execFileSync('node', ['scripts/safety-scan.js'], { cwd: ROOT, encoding: 'utf8' });
    assert.ok(/PASS: no critical findings/.test(out), out.slice(-600));
  });

  test('every JS file in the app parses', () => {
    const { execFileSync } = require('child_process');
    const bad = [];
    for (const f of files.filter((x) => x.endsWith('.js'))) {
      try { execFileSync('node', ['--check', f], { cwd: ROOT, stdio: 'pipe' }); }
      catch (e) { bad.push(`${f}: ${String(e.stderr).split('\n')[0]}`); }
    }
    assert.deepStrictEqual(bad, [], 'syntax errors');
  });
});
