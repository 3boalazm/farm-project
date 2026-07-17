// tests/data-integrity/reports-intelligence-tab.spec.js
// Sprint 8 (v1.1): regression protection for the new "الذكاء التشغيلي"
// report tab. This tab computes NOTHING new -- it composes
// window.evaluateOperationalPriority() (Sprint 5) exactly as the
// dashboard does. These tests verify the REPORT TAB's own rendering
// and data-wiring; the underlying engine's correctness is already
// covered by tests/data-integrity/unified-decision-engine.spec.js and
// is not re-tested here.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function loadReportsWithData(page, mocks) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/reports.html`);
  await page.waitForTimeout(700);
  await page.evaluate((m) => {
    window.fbGet = async (c) => (m[c] !== undefined ? m[c] : []);
    window.fbPost = async () => 'id';
    window.fbPatch = async () => {};
    window.logActivity = async () => {};
  }, mocks);
  // Populate the page's own module-level _data directly and re-render --
  // the same proven pattern established in Sprint 6 after discovering
  // that a late fbGet mock cannot retroactively affect a fetch the page
  // already made during its own DOMContentLoaded flow.
  await page.evaluate(async () => {
    window._data = {
      animals: await fbGet('animals'), health: await fbGet('health'),
      weightAlerts: await fbGet('weight_alerts'), production: await fbGet('production_log'),
      productionAlerts: await fbGet('production_alerts'), dailyTasks: await fbGet('daily_tasks'),
      breeding: await fbGet('breeding'), finance: await fbGet('finance'),
      vaccines: await fbGet('vaccinations'), meds: [], feeds: [], s: { farmName: 'Test', currency: 'ج.م' },
    };
  });
}

test.describe('Reports: Operational Intelligence Tab (Sprint 8)', () => {
  test('tab button exists and switching to it renders without errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadReportsWithData(page, {});
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('الذكاء التشغيلي');
    await page.evaluate(() => window.switchTab('intelligence'));
    await page.waitForTimeout(600);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('ranking reuses evaluateOperationalPriority and shows a real candidate', async ({ page }) => {
    await loadReportsWithData(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive', species: 'goat' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: '2026-07-15' }],
    });
    await page.evaluate(() => window.switchTab('intelligence'));
    await page.waitForTimeout(700);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('G-1');
    expect(bodyText).toMatch(/عالية|متوسطة/);
  });

  test('a fully clean herd (no signals) shows the empty state, not an error', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadReportsWithData(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive', species: 'goat' }],
    });
    await page.evaluate(() => window.switchTab('intelligence'));
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('لا توجد سجلات');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('KPI counts on the intelligence tab match the raw mocked data exactly', async ({ page }) => {
    await loadReportsWithData(page, {
      weight_alerts: [{ animal_id: 'x1', status: 'active' }, { animal_id: 'x2', status: 'resolved' }],
      daily_tasks: [{ status: 'pending' }, { status: 'pending' }, { status: 'done' }],
    });
    await page.evaluate(() => window.switchTab('intelligence'));
    await page.waitForTimeout(400);
    const activeWeightLabel = await page.evaluate(() => {
      const label = Array.from(document.querySelectorAll('.kpi-label')).find((s) => s.textContent.trim() === 'تنبيهات وزن نشطة');
      const card = label ? label.closest('.kpi-card') : null;
      const valueEl = card ? card.querySelector('.kpi-value') : null;
      return valueEl ? valueEl.childNodes[0].textContent.trim() : null;
    });
    expect(activeWeightLabel, 'exactly 1 active alert must count, not the resolved one too').toBe('١');
  });

  test('existing tabs (herd, finance, health, breeding) are unaffected -- regression check', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadReportsWithData(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive', species: 'goat' }],
    });
    for (const tab of ['herd', 'finance', 'health', 'breeding']) {
      await page.evaluate((t) => window.switchTab(t), tab);
      await page.waitForTimeout(300);
    }
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('exportAllExcel runs without throwing when the intelligence engine is present', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await loadReportsWithData(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive', species: 'goat' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: '2026-07-15' }],
    });
    await page.evaluate(async () => {
      if (typeof XLSX === 'undefined') { window.XLSX = { utils: { book_new: () => ({}), aoa_to_sheet: () => ({}), book_append_sheet: () => {} }, writeFile: () => {} }; }
      else { window.XLSX.writeFile = () => {}; }
      await window.exportAllExcel();
    });
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('permission: page-level can("reports") gate still governs the new tab (no separate check needed)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'worker' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('غير مصرح بالوصول');
    expect(bodyText).not.toContain('الذكاء التشغيلي');
  });
});
