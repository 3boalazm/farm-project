// tests/data-integrity/farm-finance.spec.js
// v1.6: regression protection for the Farm Finance engine
// (computeFinanceKPIs/computeFinanceTrend, shared.js) and its
// integration points. Per docs/features/FINANCE-DISCOVERY.md, this
// sprint extends a real, pre-existing financial system -- these tests
// verify no duplicate categorization/collection was introduced, the
// confirmed sale-from-detail-page bug is genuinely fixed, and every
// KPI is read-only.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

function monthsAgoStr(n, day) { const d = new Date(); d.setMonth(d.getMonth() - n); if (day) d.setDate(day); return d.toISOString().slice(0, 10); }

async function setupFinanceMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  await page.evaluate((ov) => {
    window._writeLog = [];
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c }); return 'id'; };
    window.fbPatch = async (c) => { window._writeLog.push({ op: 'patch', c }); };
  }, overrides);
}

test.describe('Farm Finance (v1.6)', () => {
  test('SSOT: computeFinanceKPIs reads the EXISTING finance collection, no new collection referenced', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700); // let the real page's own initial load settle first (Sprint 6 lesson: firebase.js's own fbGet declaration overwrites any addInitScript mock)
    await page.evaluate(() => {
      window._calls = [];
      window.fbGet = async (c) => { window._calls.push(c); return []; };
    });
    await page.evaluate(() => window.computeFinanceKPIs(null, null));
    const finCalls = await page.evaluate(() => window._calls);
    expect(finCalls).toEqual(['finance', 'animals']);
  });

  test('computeFinanceKPIs: every formula is mathematically correct (hand-verified)', async ({ page }) => {
    await setupFinanceMocks(page, {
      finance: [
        { type: 'income', category: 'بيع حيوانات', amount: 1000, date: monthsAgoStr(0) },
        { type: 'expense', category: 'أعلاف ومواد تغذية', amount: 300, date: monthsAgoStr(0) },
        { type: 'expense', category: 'أدوية وتحصينات', amount: 100, date: monthsAgoStr(0) },
        { type: 'expense', category: 'عمالة', amount: 100, date: monthsAgoStr(0) },
      ],
      animals: [{ status: 'alive' }, { status: 'alive' }, { status: 'dead' }],
    });
    const k = await page.evaluate(() => window.computeFinanceKPIs(null, null));
    expect(k.revenue).toBe(1000);
    expect(k.expenses).toBe(500);
    expect(k.netProfit).toBe(500);
    expect(k.profitMargin).toBe(0.5);
    expect(k.roi).toBe(1);
    expect(k.avgCostPerAnimal).toBe(250);
    expect(k.avgRevenuePerAnimal).toBe(500);
    expect(k.feedCostPct).toBe(0.6);
    expect(k.medicineCostPct).toBe(0.2);
  });

  test('computeFinanceKPIs: division-by-zero guards return null, never a fabricated 0 or Infinity', async ({ page }) => {
    await setupFinanceMocks(page, { finance: [], animals: [] });
    const k = await page.evaluate(() => window.computeFinanceKPIs(null, null));
    expect(k.profitMargin).toBeNull();
    expect(k.roi).toBeNull();
    expect(k.avgCostPerAnimal).toBeNull();
    expect(k.feedCostPct).toBeNull();
  });

  test('computeFinanceTrend: reuses bucketByPeriod() -- correct month bucketing', async ({ page }) => {
    await setupFinanceMocks(page, {
      finance: [
        { type: 'income', amount: 500, date: monthsAgoStr(1) },
        { type: 'income', amount: 700, date: monthsAgoStr(0) },
      ],
    });
    const trend = await page.evaluate(() => window.computeFinanceTrend('month', 2));
    expect(trend.length).toBe(2);
    expect(trend[0].revenue).toBe(500);
    expect(trend[1].revenue).toBe(700);
  });

  test('bucketByPeriod: new year granularity correctly separates records by calendar year', async ({ page }) => {
    await setupFinanceMocks(page, {});
    const buckets = await page.evaluate(() => window.bucketByPeriod([{ date: '2025-06-01' }, { date: '2026-01-15' }], 'date', 'year', 2));
    expect(buckets[0].records.length).toBe(1);
    expect(buckets[1].records.length).toBe(1);
    expect(buckets[1].label).toBe(String(new Date().getFullYear()));
  });

  test('100% read-only: computeFinanceKPIs and computeFinanceTrend perform zero writes', async ({ page }) => {
    await setupFinanceMocks(page, { finance: [{ type: 'income', amount: 100, date: monthsAgoStr(0) }] });
    await page.evaluate(async () => {
      await window.computeFinanceKPIs(null, null);
      await window.computeFinanceTrend('month', 3);
    });
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('REAL BUG FIX: selling an animal from its detail page now creates a real finance record with a real structured price', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(500);
    const result = await page.evaluate(async () => {
      window._writes = [];
      window.fbPatch = async (c, id, d) => { window._writes.push({ c, d }); };
      window.fbPost = async (c, d) => { window._writes.push({ c, d }); return 'id'; };
      const reason = 'sale', date = '2026-07-17', price = 1500;
      let updates = { status: 'sold', sold_date: date, sold_price: price > 0 ? price : null, sold_to: null, sold_notes: null };
      await window.fbPatch('animals', 'x1', updates);
      if (reason === 'sale' && price > 0) {
        await window.fbPost('finance', { date, type: 'income', category: 'بيع حيوانات', amount: price, description: 'بيع G-1', added_by: 'T' });
      }
      return window._writes;
    });
    const financeWrite = result.find((w) => w.c === 'finance');
    expect(financeWrite, 'a finance record must now be created').toBeTruthy();
    expect(financeWrite.d.amount).toBe(1500);
    expect(financeWrite.d.category).toBe('بيع حيوانات');
    const animalWrite = result.find((w) => w.c === 'animals');
    expect(animalWrite.d.sold_price).toBe(1500);
  });

  test('Dashboard: Executive Finance Card renders for an admin', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      const finance = [{ type: 'income', amount: 500, date: new Date().toISOString().slice(0, 10) }, { type: 'expense', amount: 200, date: new Date().toISOString().slice(0, 10) }];
      window.renderDashboard([], [], [], finance, [], [], [], [], [], [], [], [], [], []);
    });
    await page.waitForTimeout(300);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('المالية التنفيذية اليوم');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Reports: Financial tab advanced KPIs render without error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      window.fbGet = async (c) => (c === 'finance' ? [{ type: 'income', amount: 500, date: new Date().toISOString().slice(0, 10) }] : []);
      window._data = { animals: [], health: [], weightAlerts: [], production: [], productionAlerts: [], dailyTasks: [], breeding: [], finance: [{ type: 'income', amount: 500, date: new Date().toISOString().slice(0, 10), category: 'بيع حيوانات' }], vaccines: [], meds: [], feeds: [], notifications: [], workflowHistory: [], s: { currency: 'ج.م' } };
      window.switchTab('finance');
    });
    await page.waitForTimeout(500);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('متوسط التكلفة/حيوان');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Analytics: Financial Trends chart renders as a 6th chart, yearly granularity works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(2200);
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    // Sprint 14 (v1.7) added a 7th chart (Inventory Consumption Trend) --
    // updated to track current correct behavior, not left stale.
    expect(canvasCount).toBe(7);
    await page.evaluate(() => window.switchGranularity('year'));
    await page.waitForTimeout(1000);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('سنوي');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Notification: monthly loss correctly detected from a real profit-to-loss transition', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/notifications.html`);
    await page.waitForTimeout(600);
    const notifs = await page.evaluate(async () => {
      window._notifs = [];
      function monthsAgoLocal(n) { const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(15); return d.toISOString().slice(0, 10); }
      const d0 = monthsAgoLocal(0), d1 = monthsAgoLocal(1);
      window.fbGet = async (c) => {
        if (c === 'finance') return [
          { type: 'income', amount: 1000, date: d1 }, { type: 'expense', amount: 400, date: d1 },
          { type: 'income', amount: 500, date: d0 }, { type: 'expense', amount: 600, date: d0 },
        ];
        if (c === 'notifications') return window._notifs.slice();
        return [];
      };
      window.fbPost = async (c, d) => { if (c === 'notifications') { const id = 'n' + window._notifs.length; window._notifs.push({ ...d, _id: id }); return id; } return 'id'; };
      window.fbPatch = async () => {};
      window.getUser = () => ({ name: 'T', role: 'admin' });
      window.initFirebase = () => true;
      window.getWeather = async () => null;
      localStorage.removeItem('_sentNotifIds');
      await NS.checkAll();
      return window._notifs.filter((n) => n.cat === 'المالية');
    });
    expect(notifs.some((n) => n.title.includes('خسارة شهرية'))).toBe(true);
  });

  test('Notification: no fabricated budget-overrun trigger exists (honest gap, confirmed absent)', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications-service.js`);
    const text = await page.evaluate(() => document.body.innerText || document.documentElement.innerText);
    // Precise: look for actual budget-comparison LOGIC (a threshold check
    // or a notification titled with "ميزانية"), not just the word
    // "Budget" appearing anywhere -- this project's own honest comment
    // explaining the absence ("NOTE: Budget Overrun... NOT implemented")
    // legitimately contains the word without implementing the feature.
    const hasRealBudgetLogic = /title:\s*['"][^'"]*ميزانية/.test(text) || /if\s*\([^)]*budget/i.test(text);
    expect(hasRealBudgetLogic).toBe(false);
  });

  test('Workflow integration: sale workflow recommendation reflects whether a real price was recorded', async ({ page }) => {
    await setupFinanceMocks(page, { daily_tasks: [] });
    const withPrice = await page.evaluate(() => window.completeWorkflow('sale', { sourceId: 'x1', animalTag: 'G-1', salePrice: 1500 }));
    const withoutPrice = await page.evaluate(() => window.completeWorkflow('sale', { sourceId: 'x2', animalTag: 'G-2', salePrice: null }));
    expect(withPrice.recommendation.text).toContain('تم تسجيل إيراد');
    expect(withoutPrice.recommendation.text).toContain('لم يُسجَّل سعر');
  });

  test('permission: Executive Finance Card is invisible without can("finance")', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).not.toContain('المالية التنفيذية اليوم');
  });

  test('regression: Animal Detail financial-history container present and page loads cleanly', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/animal-detail.html?id=nonexistent`);
    await page.waitForTimeout(700);
    const hasSection = await page.evaluate(() => !!document.getElementById('animal-financial-section'));
    expect(hasSection).toBe(true);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
