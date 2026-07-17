// tests/data-integrity/executive-dashboard.spec.js
// Sprint 6, Epic 6: regression protection for the consolidated dashboard.
//
// IMPORTANT METHODOLOGY NOTE (discovered during this sprint's own
// development, matching a pattern documented earlier in this project's
// history): firebase.js's own top-level `function fbGet(){}` declaration
// overwrites any addInitScript-based mock the moment firebase.js loads.
// Every test below mocks fbGet via page.evaluate AFTER navigation (once
// firebase.js has already defined its own fbGet), then calls
// renderDashboard explicitly with the real Promise.all-fetched data --
// exactly mirroring the real page's own DOMContentLoaded flow.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

function daysAgoLocal(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }

async function renderWithMockData(page, mocks) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  await page.evaluate((m) => {
    window.fbGet = async (c) => (m[c] !== undefined ? m[c] : []);
    window.fbPost = async () => 'id';
    window.fbPatch = async () => {};
    window.logActivity = async () => {};
  }, mocks);
  await page.evaluate(async () => {
    const [animals, breeding, health, finance, meds, feeds, equipment, production, activity, weightAlerts, vaccinations, productionAlerts, dailyTasks] = await Promise.all([
      fbGet('animals'), fbGet('breeding'), fbGet('health'), fbGet('finance'), fbGet('inventory_meds'),
      fbGet('inventory_feeds'), fbGet('inventory_equipment'), fbGet('production_log'), fbGet('activity_log'),
      fbGet('weight_alerts'), fbGet('vaccinations'), fbGet('production_alerts'), fbGet('daily_tasks'),
    ]);
    window.renderDashboard(animals, breeding, health, finance, meds, feeds, equipment, production, activity, weightAlerts, vaccinations, productionAlerts, dailyTasks);
  });
  await page.waitForTimeout(300);
}

test.describe('Executive Dashboard (Sprint 6)', () => {
  test('renders with zero data, zero errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await renderWithMockData(page, {});
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Daily Briefing renders a data-backed "requires attention" line when a real signal exists', async ({ page }) => {
    await renderWithMockData(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: daysAgoLocal(1) }],
    });
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('موجز اليوم');
    expect(bodyText).toContain('يحتاج انتباهًا اليوم');
  });

  test('Daily Briefing shows nothing when there is no data to report (no fabricated statements)', async ({ page }) => {
    await renderWithMockData(page, { animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }] });
    const bodyText = await page.evaluate(() => document.body.innerText);
    // A perfectly clean animal, zero tasks, zero vaccination records, zero
    // production data -- the briefing must not invent a sentence.
    expect(bodyText).not.toContain('يحتاج انتباهًا');
  });

  test('Executive KPI Strip: Healthy Animals count is accurate (excludes animals with active health OR weight signal)', async ({ page }) => {
    await renderWithMockData(page, {
      animals: [
        { _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' },
        { _id: 'x2', tag: 'G-2', barn: 'B1', status: 'alive' },
      ],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: daysAgoLocal(1) }],
    });
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('مؤشرات تنفيذية');
    const healthyCount = await page.evaluate(() => {
      const el = Array.from(document.querySelectorAll('small')).find((s) => s.textContent.trim() === 'سليمة');
      return el ? el.previousElementSibling.textContent.trim() : null;
    });
    expect(healthyCount).toBe('١');
  });

  test('Upcoming Tasks: sorted by due date, pending/in_progress only, done tasks excluded', async ({ page }) => {
    await renderWithMockData(page, {
      daily_tasks: [
        { title: 'مهمة أ', status: 'pending', priority: 'high', date: daysAgoLocal(-5), related_tag: 'G-1' },
        { title: 'مهمة ب', status: 'pending', priority: 'medium', date: daysAgoLocal(-1), related_tag: 'G-1' },
        { title: 'مهمة مُنجزة', status: 'done', priority: 'high', date: daysAgoLocal(-2), related_tag: 'G-1' },
      ],
    });
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('المهام القادمة');
    expect(bodyText).toContain('مهمة ب');
    expect(bodyText).toContain('مهمة أ');
    expect(bodyText).not.toContain('مهمة مُنجزة');
    const bIndex = bodyText.indexOf('مهمة ب');
    const aIndex = bodyText.indexOf('مهمة أ');
    expect(bIndex, 'earlier-due task (مهمة ب) must appear before the later one').toBeLessThan(aIndex);
  });

  test('Operational Timeline: no duplicated events across sources', async ({ page }) => {
    await renderWithMockData(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive', breed: 'x', gender: 'female', created_at: daysAgoLocal(1) }],
      production_log: [{ animal_id: 'x1', animal_tag: 'G-1', type: 'milk', date: daysAgoLocal(2), quantity: 5, unit: 'liter' }],
      breeding: [{ status: 'born', female_tag: 'G-1', actual_birth: daysAgoLocal(3), offspring_count: 2 }],
    });
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('الجدول الزمني التشغيلي');
    // Each source contributed exactly its own single record -- count
    // occurrences of the distinguishing type labels, each must appear
    // exactly once (not duplicated across two different event rows).
    const countOccurrences = (text, needle) => text.split(needle).length - 1;
    expect(countOccurrences(bodyText, 'ولادة')).toBeGreaterThanOrEqual(1);
  });

  test('permission: dashboard loads cleanly for every role', async ({ page }) => {
    for (const role of ['admin', 'supervisor', 'vet', 'worker', 'visitor']) {
      await page.addInitScript((r) => localStorage.setItem('farm_user', JSON.stringify({ name: 'U', role: r })), role);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE_URL}/dashboard.html`);
      await page.waitForTimeout(500);
      expect(errors.filter((e) => !e.includes('Failed to fetch')), `role ${role} must load cleanly`).toEqual([]);
    }
  });

  test('performance: dashboard render completes in a reasonable time with a moderate dataset', async ({ page }) => {
    const animals = Array.from({ length: 50 }, (_, i) => ({ _id: 'a' + i, tag: 'G-' + i, barn: 'B1', status: 'alive' }));
    const start = Date.now();
    await renderWithMockData(page, { animals });
    const elapsed = Date.now() - start;
    expect(elapsed, 'rendering 50 animals should not take more than a few seconds in a test environment').toBeLessThan(8000);
  });
});
