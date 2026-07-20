// tests/data-integrity/farm-analytics.spec.js
// v1.3: regression protection for computeFarmAnalytics()/
// bucketByPeriod()/generateAnalyticsInsights() (shared.js) and the new
// analytics.html page. Analytics is a READ-ONLY consumer -- these
// tests specifically verify no risk/health/production score is
// recalculated (only real, timestamped events are counted).

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

function monthsAgoStr(n, day) { const d = new Date(); d.setMonth(d.getMonth() - n); if (day) d.setDate(day); return d.toISOString().slice(0, 10); }

async function setupAnalyticsMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  await page.evaluate((ov) => {
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
  }, overrides);
}

test.describe('Farm Analytics Engine (v1.3)', () => {
  test('bucketByPeriod: correct month-boundary assignment', async ({ page }) => {
    await setupAnalyticsMocks(page, {});
    const buckets = await page.evaluate(({ thisMonth, lastMonth }) => {
      const records = [{ date: thisMonth }, { date: lastMonth }];
      return window.bucketByPeriod(records, 'date', 'month', 2);
    }, { thisMonth: monthsAgoStr(0, 15), lastMonth: monthsAgoStr(1, 15) });
    expect(buckets.length).toBe(2);
    expect(buckets[0].records.length).toBe(1);
    expect(buckets[1].records.length).toBe(1);
  });

  test('computeFarmAnalytics: productivity index formula is mathematically correct', async ({ page }) => {
    await setupAnalyticsMocks(page, {
      production_log: Array.from({ length: 10 }, () => ({ type: 'milk', date: monthsAgoStr(0, 15), quantity: 5 })),
      daily_tasks: [
        { status: 'done', created_at: monthsAgoStr(0, 10) + 'T00:00:00Z' },
        { status: 'pending', created_at: monthsAgoStr(0, 10) + 'T00:00:00Z' },
      ],
    });
    const analytics = await page.evaluate(() => window.computeFarmAnalytics('month', 1));
    const p = analytics.productivityIndex[0];
    expect(p.index).toBe(50);
    expect(p.totalMilk).toBe(50);
    expect(p.taskCompletionRate).toBe(50);
  });

  test('risk trend counts real alert-detection events only -- no risk-scoring engine re-run', async ({ page }) => {
    await setupAnalyticsMocks(page, {
      weight_alerts: [{ detected_at: monthsAgoStr(0, 10) + 'T00:00:00Z' }, { detected_at: monthsAgoStr(0, 12) + 'T00:00:00Z' }],
      production_alerts: [{ detected_at: monthsAgoStr(0, 5) + 'T00:00:00Z' }],
    });
    const analytics = await page.evaluate(() => window.computeFarmAnalytics('month', 1));
    expect(analytics.riskTrend[0].weightAlerts).toBe(2);
    expect(analytics.riskTrend[0].productionAlerts).toBe(1);
    expect(analytics.riskTrend[0].totalAlerts).toBe(3);
  });

  test('herd health trend: recovery rate is a real ratio of actual health record statuses', async ({ page }) => {
    await setupAnalyticsMocks(page, {
      health: [
        { status: 'active', date: monthsAgoStr(0, 10) },
        { status: 'done', date: monthsAgoStr(0, 12) },
        { status: 'done', date: monthsAgoStr(0, 14) },
      ],
    });
    const analytics = await page.evaluate(() => window.computeFarmAnalytics('month', 1));
    expect(analytics.herdHealthTrend[0].healthRecordCount).toBe(3);
    expect(analytics.herdHealthTrend[0].recoveryRate).toBe(67);
  });

  test('operational efficiency: average response time computed from real created_at/completed_at difference', async ({ page }) => {
    await setupAnalyticsMocks(page, {
      daily_tasks: [{ status: 'done', created_at: monthsAgoStr(0, 10) + 'T08:00:00Z', completed_at: monthsAgoStr(0, 10) + 'T12:00:00Z' }],
    });
    const analytics = await page.evaluate(() => window.computeFarmAnalytics('month', 1));
    expect(analytics.operationalEfficiency[0].avgResponseHours).toBe(4);
  });

  test('generateAnalyticsInsights: zero data produces zero fabricated insights', async ({ page }) => {
    await setupAnalyticsMocks(page, {});
    const analytics = await page.evaluate(() => window.computeFarmAnalytics('month', 3));
    const insights = await page.evaluate((a) => window.generateAnalyticsInsights(a), analytics);
    expect(insights).toEqual([]);
  });

  test('deterministic: repeated calls with identical data produce identical analytics', async ({ page }) => {
    await setupAnalyticsMocks(page, { health: [{ status: 'active', date: monthsAgoStr(0, 10) }] });
    const [r1, r2] = await page.evaluate(async () => [await window.computeFarmAnalytics('month', 2), await window.computeFarmAnalytics('month', 2)]);
    delete r1.computedAt; delete r2.computedAt;
    expect(r1).toEqual(r2);
  });

  test('Analytics page: charts render, granularity filter works', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(2200); // real Chart.js CDN load can vary under sequential test load
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    // Sprint 13 (v1.6) added a 6th chart (Financial Trends) -- this
    // count intentionally tracks the CURRENT real chart set, updated
    // here rather than left stale against the new, correct behavior.
    // Sprint 14 (v1.7) added a 7th chart (Inventory Consumption Trend) --
    // updated to track current correct behavior, not left stale.
    expect(canvasCount).toBe(7);
    await page.evaluate(() => window.switchGranularity('week'));
    await page.waitForTimeout(700);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('أسبوع');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('permission: analytics.html denies a role without "reports"', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'worker' })));
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('غير مصرح بالوصول');
  });

  test('Dark and Light mode: page renders without error in both', async ({ page }) => {
    for (const theme of ['dark', 'light']) {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((t) => {
        localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
        if (t === 'light') localStorage.setItem('farm_theme', 'light');
      }, theme);
      await page.goto(`${BASE_URL}/analytics.html`);
      await page.waitForTimeout(1200);
      expect(errors.filter((e) => !e.includes('Failed to fetch')), `${theme} mode must load cleanly`).toEqual([]);
    }
  });

  test('Mobile viewport: page renders without error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(1200);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Large dataset: 500 production records complete within a reasonable time', async ({ page }) => {
    const records = Array.from({ length: 500 }, (_, i) => ({ type: 'milk', date: monthsAgoStr(i % 6, (i % 27) + 1), quantity: 5 }));
    await setupAnalyticsMocks(page, { production_log: records });
    const start = Date.now();
    await page.evaluate(() => window.computeFarmAnalytics('month', 6));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });

  test('Export: exportAnalyticsExcel and shareAnalyticsWhatsApp run without throwing', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(2200);
    await page.evaluate(() => { window.XLSX = window.XLSX || { utils: { book_new: () => ({}), aoa_to_sheet: () => ({}), book_append_sheet: () => {} }, writeFile: () => {} }; window.XLSX.writeFile = () => {}; });
    await page.evaluate(() => window.exportAnalyticsExcel());
    await page.evaluate(() => { window.open = () => {}; });
    await page.evaluate(() => window.shareAnalyticsWhatsApp());
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Chart.js wrapper reuse: mkChart/loadChartJS relocation did not break reports.js', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(1200);
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    expect(canvasCount).toBeGreaterThan(0);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
