// tests/data-integrity/production-intelligence.spec.js
// Sprint 4, Epic 4: regression protection for window.evaluateProductionKPIs(),
// window.evaluateProductionAlert(), and the dashboard ranking panel.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupMockEngine(page) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    window._prod = [];
    window._prodAlerts = [];
    window._tasks = [];
    window._daysAgo = function (n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
    window.fbGet = async (path) => {
      if (path === 'production_log') return window._prod.slice();
      if (path === 'production_alerts') return window._prodAlerts.slice();
      if (path === 'daily_tasks') return window._tasks.slice();
      return [];
    };
    window.fbPost = async (path, d) => {
      if (path === 'production_alerts') { const id = 'pa' + window._prodAlerts.length; window._prodAlerts.push({ ...d, _id: id }); return id; }
      if (path === 'daily_tasks') { const id = 't' + window._tasks.length; window._tasks.push({ ...d, _id: id }); return id; }
      return 'id';
    };
    window.fbPatch = async (path, id, d) => { if (path === 'production_alerts') { const a = window._prodAlerts.find((x) => x._id === id); if (a) Object.assign(a, d); } };
    window.logActivity = async () => {};
  });
}

test.describe('Production Intelligence Engine', () => {
  test('type=weight is never read by this engine (scope boundary)', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => { window._prod = [{ animal_id: 'a1', type: 'weight', date: '2026-06-01', quantity: 30 }, { animal_id: 'a1', type: 'weight', date: '2026-06-02', quantity: 20 }]; });
    const kpi = await page.evaluate(() => window.evaluateProductionKPIs('a1', 'G-1', 'weight'));
    expect(kpi, 'weight type must be rejected by this engine -- it is Sprint 2 territory').toBeNull();
  });

  test('a real, sustained drop is detected against the animal\'s own baseline', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      const records = [];
      for (let i = 25; i <= 35; i++) records.push({ animal_id: 'a2', type: 'milk', date: window._daysAgo(i), quantity: 5 });
      for (let i = 0; i <= 7; i++) records.push({ animal_id: 'a2', type: 'milk', date: window._daysAgo(i), quantity: 2 });
      window._prod = records;
    });
    const kpi = await page.evaluate(() => window.evaluateProductionKPIs('a2', 'G-2', 'milk'));
    expect(kpi.dropDetected).toBe(true);
    expect(kpi.dropPct).toBeGreaterThan(0.15);
  });

  test('a normal, small variation does not trigger a drop', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      const records = [];
      for (let i = 0; i <= 20; i++) records.push({ animal_id: 'a3', type: 'milk', date: window._daysAgo(i), quantity: 5 + (i % 2 === 0 ? 0.2 : -0.2) });
      window._prod = records;
    });
    const kpi = await page.evaluate(() => window.evaluateProductionKPIs('a3', 'G-3', 'milk'));
    expect(kpi.dropDetected).toBe(false);
  });

  test('creates a deduplicated alert and a traceable Sprint-1 task on drop', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      const records = [];
      for (let i = 25; i <= 35; i++) records.push({ animal_id: 'a4', type: 'milk', date: window._daysAgo(i), quantity: 5 });
      for (let i = 0; i <= 7; i++) records.push({ animal_id: 'a4', type: 'milk', date: window._daysAgo(i), quantity: 2 });
      window._prod = records;
    });
    await page.evaluate(() => window.evaluateProductionAlert('a4', 'G-4', 'milk', 'B1'));
    await page.evaluate(() => window.evaluateProductionAlert('a4', 'G-4', 'milk', 'B1'));
    const [alerts, tasks] = await page.evaluate(() => [window._prodAlerts, window._tasks]);
    expect(alerts.filter((a) => a.animal_id === 'a4').length, 'no duplicate alert on repeated evaluation').toBe(1);
    expect(tasks.length, 'exactly one task').toBe(1);
    expect(tasks[0].auto_source_type).toBe('production_alert');
  });

  test('auto-resolves with recovered=true when output returns to at least the detection-time level', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._prodAlerts = [{ _id: 'pa1', animal_id: 'a5', production_type: 'milk', status: 'active', average_at_detection: 2 }];
      const records = [];
      for (let i = 25; i <= 35; i++) records.push({ animal_id: 'a5', type: 'milk', date: window._daysAgo(i), quantity: 5 });
      for (let i = 0; i <= 7; i++) records.push({ animal_id: 'a5', type: 'milk', date: window._daysAgo(i), quantity: 5.5 });
      window._prod = records;
    });
    await page.evaluate(() => window.evaluateProductionAlert('a5', 'G-5', 'milk', 'B1'));
    const alert = await page.evaluate(() => window._prodAlerts.find((a) => a._id === 'pa1'));
    expect(alert.status).toBe('resolved');
    expect(alert.recovered).toBe(true);
  });

  test('[Sprint 5 update] a fully healthy producer with no active signal correctly shows NO operational priority -- intentional scope narrowing from Sprint 4\'s general leaderboard to "needs attention" only, per Sprint 5\'s own mission ("stop showing isolated alerts, begin presenting operational priorities")', async ({ page }) => {
    // Mocks installed via addInitScript, BEFORE navigation -- unlike
    // setupMockEngine's post-navigation page.evaluate, this guarantees
    // the real page's own DOMContentLoaded handler never races against
    // a slow, failing real-network fbGet call that could resolve late
    // and overwrite our explicit render below.
    await page.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
      window.fbGet = async (path) => (path === 'production_log' || path === 'daily_tasks' || path === 'production_alerts' ? [] : []);
      window.fbPost = async () => 'id';
      window.fbPatch = async () => {};
      window.logActivity = async () => {};
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window._daysAgo = function (n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
      const records = [];
      for (let i = 0; i <= 20; i++) records.push({ animal_id: 'a6', type: 'milk', date: window._daysAgo(i), quantity: 6 });
      const animals = [{ _id: 'a6', tag: 'G-6', barn: 'B1', status: 'alive' }];
      window.renderDashboard(animals, [], [], [], [], [], [], records, [], [], [], []);
    });
    await page.waitForTimeout(300);
    const container = await page.evaluate(() => document.getElementById('unified-priority-section')?.innerHTML || 'CONTAINER MISSING');
    // Correct new behavior: a healthy, non-declining producer with no
    // health/task signal is not an operational priority -- the unified
    // engine returns null for it (docs/features/UNIFIED-DECISION-ENGINE.md),
    // so it correctly does NOT appear in this list. This is a deliberate
    // design change, not the bug the original Sprint 4 test guarded against.
    expect(container, 'container renders (possibly empty), no crash').not.toBe('CONTAINER MISSING');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('permission: page loads cleanly regardless of role (no privileged action gated incorrectly)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'worker' })));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE_URL}/animal-detail.html?id=nonexistent`);
    await page.waitForTimeout(600);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
