// tests/data-integrity/predictive-intelligence.spec.js
// v1.2: regression protection for the 5 forecast functions
// (shared.js). Statistical/rule-based only -- these tests specifically
// verify no machine learning was smuggled in (deterministic, reproducible
// results) and that Production's forecast is a direct reuse of
// evaluateProductionKPIs(), never a recalculation.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function daysFromNowStr(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

async function setupForecastMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbPost = async () => 'id';
    window.fbPatch = async () => {};
  }, overrides);
}

test.describe('Predictive Intelligence (v1.2)', () => {
  test('weight forecast: correct linear extrapolation from real decline data', async ({ page }) => {
    await setupForecastMocks(page, {
      'animals/x1/weights': [{ weight: 40, date: daysAgoStr(30) }, { weight: 35, date: daysAgoStr(0) }],
    });
    const wf = await page.evaluate(() => window.forecastWeight('x1', 'G-1'));
    expect(wf.trend).toBe('declining');
    expect(wf.dailyRate).toBeCloseTo(-0.17, 1);
    expect(wf.projected30).toBe(30);
    expect(wf.confidence).toBe('medium');
  });

  test('weight forecast: insufficient data returns low confidence, no numeric projection', async ({ page }) => {
    await setupForecastMocks(page, { 'animals/x1/weights': [{ weight: 40, date: daysAgoStr(5) }] });
    const wf = await page.evaluate(() => window.forecastWeight('x1', 'G-1'));
    expect(wf.confidence).toBe('low');
    expect(wf.trend).toBeNull();
  });

  test('weight forecast is deterministic: repeated calls with the same data produce identical results (no ML, no randomness)', async ({ page }) => {
    await setupForecastMocks(page, {
      'animals/x1/weights': [{ weight: 40, date: daysAgoStr(30) }, { weight: 35, date: daysAgoStr(0) }],
    });
    const [r1, r2, r3] = await page.evaluate(async () => [
      await window.forecastWeight('x1', 'G-1'),
      await window.forecastWeight('x1', 'G-1'),
      await window.forecastWeight('x1', 'G-1'),
    ]);
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  test('production forecast reuses evaluateProductionKPIs() directly -- no duplicated trend calculation', async ({ page }) => {
    const records = [];
    for (let i = 0; i <= 20; i++) records.push({ animal_id: 'x2', type: 'milk', date: daysAgoStr(i), quantity: 5 });
    await setupForecastMocks(page, { production_log: records });
    const [kpi, forecast] = await page.evaluate(async () => [
      await window.evaluateProductionKPIs('x2', 'G-2', 'milk'),
      await window.forecastProduction('x2', 'G-2', 'milk'),
    ]);
    expect(forecast.trendPct).toBe(kpi.trendPct);
    expect(forecast.recentAverage).toBe(kpi.recentAverage);
    expect(forecast.classification).toBe('stable');
  });

  test('health risk forecast: current score is baseline, real evidence cited, never fabricated', async ({ page }) => {
    await setupForecastMocks(page, {
      health: [{ animal_tag: 'G-3', status: 'active', diagnosis: 'x', date: daysAgoStr(1) }],
      vaccinations: [{ target_section: 'B1', status: 'pending', scheduled_date: daysFromNowStr(5), name: 'لقاح' }],
    });
    const hf = await page.evaluate(() => window.forecastHealthRisk('x3', 'G-3', 'B1', 30));
    expect(hf.currentScore).toBe(30);
    expect(hf.projectedScore).toBe(50);
    expect(hf.evidence[0]).toContain('لقاح');
  });

  test('health risk forecast: no known future event -> no fabricated trend, low confidence', async ({ page }) => {
    await setupForecastMocks(page, { health: [] });
    const hf = await page.evaluate(() => window.forecastHealthRisk('x4', 'G-4', 'B1', 30));
    expect(hf.projectedScore).toBe(hf.currentScore);
    expect(hf.confidence).toBe('low');
  });

  test('task workload forecast: correct window boundaries (7 vs 30 days)', async ({ page }) => {
    await setupForecastMocks(page, {
      daily_tasks: [{ status: 'pending', date: daysFromNowStr(3) }],
      vaccinations: [{ status: 'pending', scheduled_date: daysFromNowStr(5) }],
      breeding: [{ status: 'pregnant', expected_birth: daysFromNowStr(10) }],
    });
    const [r7, r30] = await page.evaluate(async () => Promise.all([window.forecastTaskWorkload(7), window.forecastTaskWorkload(30)]));
    expect(r7.totalExpectedWorkload, '7-day window excludes the 10-day-out birth').toBe(2);
    expect(r30.totalExpectedWorkload, '30-day window includes all three').toBe(3);
  });

  test('performance: farm forecast summary completes in a reasonable time with a moderate candidate set', async ({ page }) => {
    const animals = Array.from({ length: 20 }, (_, i) => ({ _id: 'a' + i, tag: 'G-' + i, barn: 'B1', status: 'alive' }));
    const health = animals.slice(0, 10).map((a) => ({ animal_tag: a.tag, status: 'active', diagnosis: 'x', date: daysAgoStr(1) }));
    await setupForecastMocks(page, { health, 'animals/a0/weights': [{ weight: 40, date: daysAgoStr(10) }] });
    const start = Date.now();
    await page.evaluate(async (a) => window.forecastFarmSummary(a.animals, a.health, [], []), { animals, health });
    const elapsed = Date.now() - start;
    expect(elapsed, 'forecasting 10 candidates should complete well within a test-environment bound').toBeLessThan(8000);
  });

  test('permission: reports.html forecast tab only reachable with can("reports")', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'worker' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('غير مصرح بالوصول');
    expect(bodyText).not.toContain('التوقعات');
  });

  test('regression: existing reports tabs still work after adding the forecast tab', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupForecastMocks(page, {});
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(600);
    await page.evaluate((d) => { window._data = d; }, {
      animals: [], health: [], weightAlerts: [], production: [], productionAlerts: [],
      dailyTasks: [], breeding: [], finance: [], vaccines: [], meds: [], feeds: [], notifications: [], s: {},
    });
    for (const tab of ['herd', 'finance', 'health', 'breeding', 'intelligence', 'forecast']) {
      await page.evaluate((t) => window.switchTab(t), tab);
      await page.waitForTimeout(300);
    }
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
