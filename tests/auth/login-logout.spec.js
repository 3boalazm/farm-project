// tests/auth/login-logout.spec.js
const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Authentication', () => {
  test('logout clears session storage keys', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard.html`);
    // Set storage via evaluate AFTER load, not addInitScript -- addInitScript
    // re-runs on every navigation within the same context, which would
    // re-inject a fake user on login.html right after logout() redirects
    // there, masking whether the actual clear succeeded.
    await page.evaluate(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
      localStorage.setItem('_farm_auth_refresh', '12345');
    });
    await page.reload();
    await page.waitForTimeout(500);
    // logout() clears storage then navigates as its last line -- the
    // evaluate() call's own return-value marshaling can race against
    // that navigation destroying the context. The call still executes
    // fully (storage is cleared) even if evaluate() itself throws on
    // its way back; that specific error is expected and safe to ignore.
    await page.evaluate(() => window.logout()).catch((e) => {
      if (!e.message.includes('Execution context was destroyed')) throw e;
    });
    await page.waitForURL(/login\.html/);
    await page.waitForLoadState('load');
    await page.waitForTimeout(200);
    const user = await page.evaluate(() => localStorage.getItem('farm_user'));
    const refresh = await page.evaluate(() => localStorage.getItem('_farm_auth_refresh'));
    expect(user, 'farm_user must be cleared on logout').toBeNull();
    // logout() does removeItem('_farm_auth_refresh') — but it then navigates to
    // login.html, whose own boot mints an ANONYMOUS Firebase session so it can
    // read the public user_directory (the hardened rules require auth != null
    // for that one projection). So the invariant is not "the key is gone", it
    // is "no *user* session survives": whatever token exists after landing on
    // login.html must be a pre-login anonymous bootstrap, never the logged-out
    // user's. Asserting toBeNull() here passed only while the suite talked to
    // the live project and the bootstrap failed; against the hermetic fake it
    // does exactly what it is designed to do.
    if (refresh !== null) {
      let parsed = null;
      try { parsed = JSON.parse(refresh); } catch (e) { /* a bare token string */ }
      const uid = parsed ? String(parsed.uid || parsed.user_id || '') : String(refresh);
      // '12345' (the value this test stored) failing the check is the point:
      // if logout() had not cleared it, this assertion must not pass.
      const isAnonymous = /^anon-/.test(uid);
      expect(isAnonymous,
        'a token surviving logout must be an anonymous bootstrap, got ' + refresh.slice(0, 120)).toBe(true);
    }
  });

  test('corrupted farm_user fails safe to login, does not crash', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', '{not valid json'));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE_URL}/index.html`);
    await page.waitForTimeout(500);
    const realErrors = errors.filter((e) => !e.includes('Failed to fetch') && !e.includes('NetworkError'));
    expect(realErrors, 'corrupted storage must not throw an uncaught application error').toEqual([]);
    expect(page.url()).toContain('login.html');
  });
});
