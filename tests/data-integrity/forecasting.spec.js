// tests/data-integrity/forecasting.spec.js
// Phase 21: regression protection for Forecasting
// (window.createForecast / getForecastVsActual). Rule-based only
// (AVERAGE_PRIOR_PERIODS), never touches journal_entries.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupForecastMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._store = JSON.parse(JSON.stringify(ov));
    window._writeLog = [];
    window.fbGet = async (c) => (window._store[c] !== undefined ? window._store[c] : []);
    window.fbPost = async (c, d) => {
      const id = 'id_' + (window._writeLog.length + 1);
      window._writeLog.push({ op: 'post', c, id, d });
      window._store[c] = window._store[c] || [];
      window._store[c].push({ _id: id, ...d });
      return id;
    };
    window.getUser = () => ({ name: 'T', role: 'admin' });
  }, overrides);
}

test.describe('Forecasting (Phase 21)', () => {
  test('createForecast: averages real actuals from the given source periods, exposes method and per-period detail, writes nothing to journal_entries', async ({ page }) => {
    const entries = [
      { _id: 'j1', date: '2026-01-10', lines: [{ accountId: '6100', debit: 900 }] },
      { _id: 'j2', date: '2026-02-10', lines: [{ accountId: '6100', debit: 1100 }] },
      { _id: 'j3', date: '2026-03-10', lines: [{ accountId: '6100', debit: 1000 }] },
    ];
    await setupForecastMocks(page, { journal_entries: entries, forecasts: [] });
    const r = await page.evaluate(() => window.createForecast({
      targetPeriodKey: '2026-04', accountId: '6100',
      sourcePeriods: [
        { periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' },
        { periodKey: '2026-02', startDate: '2026-02-01', endDate: '2026-02-28' },
        { periodKey: '2026-03', startDate: '2026-03-01', endDate: '2026-03-31' },
      ],
    }));
    expect(r.ok).toBe(true);
    expect(r.method).toBe('AVERAGE_PRIOR_PERIODS');
    expect(r.forecastValue).toBe(1000); // (900+1100+1000)/3
    expect(r.sourcePeriods.length).toBe(3);
    expect(r.sourcePeriods.find((p) => p.periodKey === '2026-02').actual).toBe(1100);
    const jeWrites = await page.evaluate(() => window._writeLog.filter((w) => w.c === 'journal_entries'));
    expect(jeWrites).toEqual([]);
  });

  test('createForecast: rejects with no source periods', async ({ page }) => {
    await setupForecastMocks(page, { journal_entries: [], forecasts: [] });
    const r = await page.evaluate(() => window.createForecast({ targetPeriodKey: '2026-04', accountId: '6100', sourcePeriods: [] }));
    expect(r.ok).toBe(false);
  });

  test('getForecastVsActual: once the target period has real data, compares forecast against the real actual and computes variance', async ({ page }) => {
    const forecast = { _id: 'fc1', targetPeriodKey: '2026-04', accountId: '6100', forecastValue: 1000, method: 'AVERAGE_PRIOR_PERIODS', sourcePeriods: [] };
    const entries = [{ _id: 'j4', date: '2026-04-10', lines: [{ accountId: '6100', debit: 1250 }] }];
    await setupForecastMocks(page, { forecasts: [forecast], journal_entries: entries });
    const r = await page.evaluate(() => window.getForecastVsActual('fc1', '2026-04-01', '2026-04-30'));
    expect(r.ok).toBe(true);
    expect(r.forecast).toBe(1000);
    expect(r.actual).toBe(1250);
    expect(r.variance).toBe(250);
  });

  test('getForecastVsActual: with NO real data yet for the target period, actual is null -- never a fabricated zero', async ({ page }) => {
    const forecast = { _id: 'fc1', targetPeriodKey: '2026-05', accountId: '6100', forecastValue: 1000, method: 'AVERAGE_PRIOR_PERIODS', sourcePeriods: [] };
    await setupForecastMocks(page, { forecasts: [forecast], journal_entries: [] });
    const r = await page.evaluate(() => window.getForecastVsActual('fc1', '2026-05-01', '2026-05-31'));
    expect(r.ok).toBe(true);
    expect(r.actual).toBeNull();
    expect(r.variance).toBeNull();
  });

  test('permission: a role without can("finance") cannot create a forecast', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'S', role: 'supervisor' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(600);
    await page.evaluate((ov) => {
      window._writeLog = [];
      window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
      window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c, d }); return 'id'; };
    }, { journal_entries: [] });
    const r = await page.evaluate(() => window.createForecast({
      targetPeriodKey: '2026-04', accountId: '6100', sourcePeriods: [{ periodKey: '2026-01', startDate: '2026-01-01', endDate: '2026-01-31' }],
    }));
    expect(r.ok).toBe(false);
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });
});
