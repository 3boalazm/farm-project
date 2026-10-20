// tests/demo-mode/demo-mode.spec.js
//
// Demo mode end-to-end (demo-data.js · docs/design/DEMO-MODE.md). The unit
// layer (tests/unit/29-demo-mode.suite.js) proves the generator, the overlay
// and the interception in jsdom; this file proves the thing jsdom cannot: a
// real browser really renders the sections, really navigates between pages
// without losing what the operator wrote, and really issues ZERO requests to
// the backend hosts once demo mode is on.
//
// It imports the hermetic fixture like every other spec (tests/security/
// hermetic.spec.js fails the suite otherwise). Note the fixture's context
// routes only ever see a request the page actually makes — in demo mode the
// page's own fetch wrapper answers locally, so the routes stay silent, which
// is exactly what the "no backend traffic" assertion below measures.
const { test, expect } = require('../fixtures/farm-test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const BACKEND_HOSTS = /(firebasedatabase\.app|firebaseio\.com|googleapis\.com)/;

/** Enter demo mode through the login screen, the way an operator would. */
async function enterDemo(page) {
  await page.goto(`${BASE_URL}/login.html`);
  const btn = page.locator('#demo-entry');
  await expect(btn).toBeVisible();
  await btn.click();
  await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
}

test.describe('Demo mode', () => {

  test('the login screen offers it, and one click lands on a populated dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login.html`);
    const btn = page.locator('#demo-entry');
    await expect(btn).toBeVisible();
    await expect(btn).toContainText('بيانات تجريبية');
    // the pre-auth privacy rule still holds: the button names nobody
    await expect(page.locator('#login-demo')).not.toContainText('admin1');

    await btn.click();
    await page.waitForURL(/dashboard\.html/, { timeout: 15000 });
    await expect(page.locator('#farm-demo-bar')).toBeVisible();
    await expect(page.locator('#farm-demo-bar')).toContainText('بيانات تجريبية');
    // the dashboard hero and its KPI tiles are computed from the demo herd
    await expect(page.locator('.dash-status')).toHaveCount(1);
    await expect(page.locator('.dash-kpi').first()).toBeVisible();
    const score = await page.locator('.dash-status').innerText();
    expect(score).not.toMatch(/^—+$/);
  });

  test('every main section renders data instead of an empty state', async ({ page }) => {
    await enterDemo(page);
    const sections = [
      ['animals.html', 'tbody tr'],
      ['health.html', 'tbody tr'],
      ['vaccine.html', 'tbody tr'],
      ['production.html', 'tbody tr'],
      ['inventory.html', 'tbody tr'],
      ['tasks.html', '.task-card, tbody tr, .list-group-item'],
      ['finance.html', 'tbody tr'],
      ['reports.html', 'tbody tr, .metric, .dash-kpi'],
      ['notifications.html', 'tbody tr, .notif-item, .list-group-item'],
      ['users.html', 'tbody tr'],
    ];
    for (const [href, selector] of sections) {
      await page.goto(`${BASE_URL}/${href}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      const count = await page.locator(selector).count();
      expect(count, `${href} rendered no rows for "${selector}"`).toBeGreaterThan(0);
    }
    // the herd page shows real tags from the generator, not placeholders
    await page.goto(`${BASE_URL}/animals.html`);
    await page.waitForLoadState('networkidle').catch(() => {});
    const body = await page.locator('body').innerText();
    expect(body).toMatch(/(GT-|SH-)\d/);
  });

  test('once demo mode is on, not one request reaches the backend', async ({ page }) => {
    await enterDemo(page);
    const leaked = [];
    page.on('request', (r) => { if (BACKEND_HOSTS.test(r.url())) leaked.push(r.url()); });
    for (const href of ['dashboard.html', 'animals.html', 'finance.html', 'health.html', 'inventory.html', 'settings.html']) {
      await page.goto(`${BASE_URL}/${href}`);
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    // give fire-and-forget boot writes a moment, then judge
    await page.waitForTimeout(600);
    expect(leaked, 'demo mode must serve everything locally: ' + leaked.join(', ')).toEqual([]);
  });

  test('what the operator writes survives navigation to another page', async ({ page }) => {
    await enterDemo(page);
    await page.goto(`${BASE_URL}/animals.html`);
    await page.waitForLoadState('networkidle').catch(() => {});
    const id = await page.evaluate(async () => fbPost('animals', {
      tag: 'GT-DEMO-1', species: 'goat', breed: 'شامي', gender: 'female',
      purpose: 'production', status: 'alive', barn: 'عنبر ١', birth_date: '2025-01-01',
    }));
    expect(typeof id).toBe('string');

    // a real navigation: fresh document, base regenerated, overlay replayed
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.goto(`${BASE_URL}/animals.html`);
    await page.waitForLoadState('networkidle').catch(() => {});
    const still = await page.evaluate(async (key) => {
      const rows = await fbGet('animals');
      return rows.filter((r) => r._id === key).map((r) => r.tag);
    }, id);
    expect(still).toEqual(['GT-DEMO-1']);

    // and the overlay never grew into the fake backend the fixture serves
    const ops = await page.evaluate(() => JSON.parse(localStorage.getItem('farm_demo_ops') || '[]'));
    expect(ops.length).toBeGreaterThan(0);
  });

  test('«إنهاء العرض» clears the session, the overlay and the flag', async ({ page }) => {
    await enterDemo(page);
    await page.goto(`${BASE_URL}/settings.html`);
    await page.locator('#farm-demo-exit').click();
    await page.waitForURL(/login\.html/, { timeout: 15000 });
    const state = await page.evaluate(() => ({
      flag: localStorage.getItem('farm_demo'),
      ops: localStorage.getItem('farm_demo_ops'),
      user: localStorage.getItem('farm_user'),
      demoOff: !window.FarmDemo || !window.FarmDemo.isEnabled(),
    }));
    expect(state.flag).toBeNull();
    expect(state.ops).toBeNull();
    expect(state.user).toBeNull();
    expect(state.demoOff).toBe(true);
    await expect(page.locator('#farm-demo-bar')).toHaveCount(0);
    // back on the login screen the demo button is offered again
    await expect(page.locator('#demo-entry')).toBeVisible();
  });

  test('the size switch regenerates the farm', async ({ page }) => {
    await enterDemo(page);
    const before = await page.evaluate(async () => (await fbGet('animals')).length);
    await page.locator('#farm-demo-size').selectOption('small');
    await page.waitForLoadState('networkidle').catch(() => {});
    const after = await page.evaluate(async () => (await fbGet('animals')).length);
    expect(after).toBe(20);
    expect(before).toBeGreaterThan(after);
    await expect(page.locator('#farm-demo-bar')).toBeVisible();
  });
});
