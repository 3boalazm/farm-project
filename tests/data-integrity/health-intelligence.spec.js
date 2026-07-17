// tests/data-integrity/health-intelligence.spec.js
// Sprint 3, Epic 3: regression protection for window.evaluateHealthRisk().

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupMockEngine(page) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    window._health = [];
    window._weightAlerts = [];
    window._vacc = [];
    window._tasks = [];
    window.fbGet = async (path) => {
      if (path === 'health') return window._health.slice();
      if (path === 'weight_alerts') return window._weightAlerts.slice();
      if (path === 'vaccinations') return window._vacc.slice();
      if (path === 'daily_tasks') return window._tasks.slice();
      return [];
    };
    window.fbPost = async (path, d) => { if (path === 'daily_tasks') { const id = 't' + window._tasks.length; window._tasks.push({ ...d, _id: id }); return id; } return 'id'; };
    window.fbPatch = async () => {};
    window.logActivity = async () => {};
  });
}

test.describe('Health Intelligence Engine', () => {
  test('a clean animal (no signals) scores 0 and is level low', async ({ page }) => {
    await setupMockEngine(page);
    const risk = await page.evaluate(() => window.evaluateHealthRisk('a1', 'G-1', 'B1'));
    expect(risk.score).toBe(0);
    expect(risk.level).toBe('low');
    expect(risk.contributors).toEqual([]);
    expect(risk.recommendations).toEqual([]);
  });

  test('active illness alone scores exactly 30 (medium)', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => { window._health = [{ animal_tag: 'G-2', status: 'active', diagnosis: 'x', date: '2026-07-10' }]; });
    const risk = await page.evaluate(() => window.evaluateHealthRisk('a2', 'G-2', 'B1'));
    expect(risk.score).toBe(30);
    expect(risk.level).toBe('medium');
    expect(risk.contributors.find((c) => c.factor === 'active_illness')).toBeTruthy();
  });

  test('combined factors correctly sum and cap at 100 (critical)', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [
        { animal_tag: 'G-3', status: 'active', diagnosis: 'x', date: '2026-07-10', medication: 'm1', bcs: '2' },
        { animal_tag: 'G-3', status: 'done', date: '2026-07-05', medication: 'm2' },
      ];
      window._weightAlerts = [{ animal_id: 'a3', status: 'active', rule_type: 'weight_loss', detail: 'x' }];
      window._vacc = [{ target_section: 'B1', status: 'overdue', name: 'v1' }];
    });
    const risk = await page.evaluate(() => window.evaluateHealthRisk('a3', 'G-3', 'B1'));
    // 30 (illness) + 25 (weight loss) + 20 (vaccination) + 15 (repeated med) + 15 (low bcs) = 105 -> capped 100
    expect(risk.score).toBe(100);
    expect(risk.level).toBe('critical');
  });

  test('recommendations are ordered by factor priority, not raw point value', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-4', status: 'active', diagnosis: 'x', date: '2026-07-10' }];
      window._weightAlerts = [{ animal_id: 'a4', status: 'active', rule_type: 'weight_loss', detail: 'y' }];
    });
    const risk = await page.evaluate(() => window.evaluateHealthRisk('a4', 'G-4', null));
    // active_illness (30pts) must come before weight_weight_loss (25pts) --
    // priority order, which happens to match point order here, but the
    // ordering mechanism itself (HEALTH_FACTOR_PRIORITY_ORDER) is what's tested.
    expect(risk.recommendations[0].factor).toBe('active_illness');
    expect(risk.recommendations[1].factor).toBe('weight_weight_loss');
  });

  test('every recommendation cites evidence -- never generated without a reason', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-5', status: 'active', diagnosis: 'تشخيص تجريبي', date: '2026-07-10' }];
    });
    const risk = await page.evaluate(() => window.evaluateHealthRisk('a5', 'G-5', null));
    expect(risk.recommendations.length).toBeGreaterThan(0);
    risk.recommendations.forEach((r) => {
      expect(r.evidence, 'every recommendation must carry non-empty evidence').toBeTruthy();
    });
  });

  test('generates a task via Sprint 1 engine only for high/critical, never for low/medium', async ({ page }) => {
    await setupMockEngine(page);
    // Medium case (30 pts, active illness only) -- no task expected
    await page.evaluate(() => { window._health = [{ animal_tag: 'G-6', status: 'active', diagnosis: 'x', date: '2026-07-10' }]; });
    await page.evaluate(() => window.evaluateHealthRisk('a6', 'G-6', null));
    let tasks = await page.evaluate(() => window._tasks);
    expect(tasks.length, 'medium-level risk does not spawn a task').toBe(0);

    // Critical case
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-7', status: 'active', diagnosis: 'x', date: '2026-07-10', medication: 'm', bcs: '2' }];
      window._weightAlerts = [{ animal_id: 'a7', status: 'active', rule_type: 'weight_loss', detail: 'y' }];
      window._vacc = [{ target_section: 'B1', status: 'overdue', name: 'v' }];
    });
    await page.evaluate(() => window.evaluateHealthRisk('a7', 'G-7', 'B1'));
    tasks = await page.evaluate(() => window._tasks);
    expect(tasks.length, 'critical-level risk creates exactly one task').toBe(1);
    expect(tasks[0].auto_source_type).toBe('health_risk_alert');
  });

  test('never generates a duplicate task for the same animal on repeated evaluation', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-8', status: 'active', diagnosis: 'x', date: '2026-07-10', medication: 'm', bcs: '2' }];
      window._weightAlerts = [{ animal_id: 'a8', status: 'active', rule_type: 'weight_loss', detail: 'y' }];
      window._vacc = [{ target_section: 'B1', status: 'overdue', name: 'v' }];
    });
    await page.evaluate(() => window.evaluateHealthRisk('a8', 'G-8', 'B1'));
    await page.evaluate(() => window.evaluateHealthRisk('a8', 'G-8', 'B1'));
    const tasks = await page.evaluate(() => window._tasks);
    expect(tasks.length, 'dedup inherited correctly from Sprint 1 engine').toBe(1);
  });

  test('permission: page loads cleanly for a role without health-adjacent access', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'vet' })));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE_URL}/animal-detail.html?id=nonexistent`);
    await page.waitForTimeout(600);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('dashboard renders health-intelligence panel without errors', async ({ page }) => {
    await setupMockEngine(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(async () => {
      const animals = [{ _id: 'a9', tag: 'G-9', barn: 'B1', status: 'alive' }];
      const health = [{ animal_tag: 'G-9', status: 'active', diagnosis: 'x', date: '2026-07-10' }];
      window.renderDashboard(animals, [], health, [], [], [], [], [], [], [], []);
      if (window.renderTopHealthRiskAnimals) await window.renderTopHealthRiskAnimals(animals, health, []);
    });
    await page.waitForTimeout(300);
    const realErrors = errors.filter((e) => !e.includes('Failed to fetch'));
    expect(realErrors).toEqual([]);
  });
});
