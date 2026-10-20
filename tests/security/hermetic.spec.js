// tests/security/hermetic.spec.js
//
// O-19 (docs/audit/FULL-AUDIT-2026-10.md) — the browser suite used to open
// real sockets to the production Firebase project on every page load, because
// the specs' `window.fbGet` monkey-patches only land *after* boot. These tests
// pin the fix itself: the fake backend really is in the path, every spec is
// wired to it, and nothing in the app's configuration can reach a host the
// fixture does not intercept. If a future spec imports @playwright/test
// directly, or the project moves to a database domain the fixture's pattern
// does not match, this file goes red instead of the suite silently testing
// against live data again.

const fs = require('fs');
const path = require('path');
const { test, expect, BACKEND } = require('../fixtures/farm-test');

const REPO = path.join(__dirname, '..', '..');
const specFiles = () => {
  const out = [];
  for (const dir of fs.readdirSync(path.join(REPO, 'tests'))) {
    const full = path.join(REPO, 'tests', dir);
    if (!fs.statSync(full).isDirectory() || dir === 'fixtures' || dir === 'rules' || dir === 'unit') continue;
    for (const f of fs.readdirSync(full)) if (f.endsWith('.spec.js')) out.push(path.join(full, f));
  }
  return out;
};

test.describe('O-19: the browser suite is hermetic', () => {

  test('every spec imports the fake-backend fixture, not @playwright/test', () => {
    const files = specFiles();
    expect(files.length).toBeGreaterThanOrEqual(55);
    const direct = files.filter((f) => /require\(['"]@playwright\/test['"]\)/.test(fs.readFileSync(f, 'utf8')));
    expect(direct.map((f) => path.relative(REPO, f)),
      'these specs would hit the live database — import ../fixtures/farm-test instead').toEqual([]);
    // this file included: it must not be the one exception
    expect(/fixtures\/farm-test/.test(fs.readFileSync(__filename, 'utf8'))).toBe(true);
  });

  test("the app's configured backend hosts are all covered by the intercept pattern", () => {
    const cfg = ['config.js', 'firebase.js', 'sw-register.js', 'notifications-service.js']
      .map((f) => fs.readFileSync(path.join(REPO, f), 'utf8')).join('\n');
    const urls = [...cfg.matchAll(/https:\/\/[A-Za-z0-9.\-]+/g)].map((m) => m[0]);
    const backend = urls.filter((u) => /firebase|googleapis|firebasedatabase/.test(u));
    expect(backend.length).toBeGreaterThan(0);
    const uncovered = backend.filter((u) => !BACKEND.test(u));
    expect(uncovered, 'tests/fixtures/farm-test.js BACKEND must match every host the app talks to').toEqual([]);
  });

  test('a real page load is served entirely by the fake backend', async ({ page, farm }) => {
    // Record what the browser asked for, so we can prove the backend traffic
    // went through the fixture rather than around it.
    const seen = [];
    page.on('request', (r) => seen.push(r.url()));

    await page.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ id: 'admin1', name: 'QA', role: 'admin', active: true }));
    });
    await page.goto('/dashboard.html');
    await page.waitForTimeout(600);

    const backendRequests = seen.filter((u) => BACKEND.test(u));
    expect(backendRequests.length, 'dashboard.html must talk to the backend at boot — otherwise this test proves nothing').toBeGreaterThan(0);
    expect(farm.requests().length, 'and every one of those requests must have been answered by the in-memory fake').toBeGreaterThan(0);

    // The fake is a real database, not a stub that always says yes: the boot
    // reads land somewhere inspectable.
    expect(farm.db.data.settings.farmName).toBeTruthy();
    expect(farm.collection('animals').length).toBeGreaterThan(0);

    // A read-only page load may still write housekeeping rows (activity log,
    // last-seen, a flushed diagnostics batch) — but it must never mutate the
    // farm's own data behind the test's back.
    const writes = farm.requests().filter((r) => /^(POST|PUT|PATCH|DELETE) /.test(r));
    const HOUSEKEEPING = /^(activity_log|app_logs|users|user_directory|sessions|presence|settings)\b/;
    const unexpected = writes.filter((r) => !HOUSEKEEPING.test(r.replace(/^\w+ /, '')));
    expect(unexpected, 'dashboard.html mutated operational data on load: ' + JSON.stringify(unexpected)).toEqual([]);
  });
});
