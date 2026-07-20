// tests/data-integrity/weight-intelligence.spec.js
// Sprint 2, Epic 2: regression protection for window.evaluateWeightAlert(),
// window.evaluateMissingWeightAlerts(), and window.resolveWeightAlert().

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupMockEngine(page) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    window._weightsByAnimal = {};
    window._alerts = [];
    window._tasks = [];
    window.fbGet = async (path) => {
      if (path === 'weight_alerts') return window._alerts.slice();
      const m = path.match(/^animals\/(.+)\/weights$/);
      if (m) return (window._weightsByAnimal[m[1]] || []).slice();
      if (path === 'daily_tasks') return window._tasks.slice();
      return [];
    };
    window.fbPost = async (path, d) => {
      if (path === 'weight_alerts') { const id = 'a' + window._alerts.length; window._alerts.push({ ...d, _id: id }); return id; }
      if (path === 'daily_tasks') { const id = 't' + window._tasks.length; window._tasks.push({ ...d, _id: id }); return id; }
      return 'id';
    };
    window.fbPatch = async (path, id, d) => {
      if (path === 'weight_alerts') { const a = window._alerts.find((x) => x._id === id); if (a) Object.assign(a, d); }
    };
    window.logActivity = async () => {};
    window.toast = () => {};
  });
}

test.describe('Weight Intelligence Engine', () => {
  test('detects weight loss (>5% drop) and creates a high-severity alert', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._weightsByAnimal['a1'] = [
        { weight: 35, date: '2026-06-01' },
        { weight: 30, date: '2026-06-15' }, // -14.3%
      ];
    });
    await page.evaluate(() => window.evaluateWeightAlert('a1', 'G-1', 'حظيرة 1'));
    const alerts = await page.evaluate(() => window._alerts);
    const lossAlert = alerts.find((a) => a.rule_type === 'weight_loss');
    expect(lossAlert, 'a weight_loss alert must exist').toBeTruthy();
    expect(lossAlert.severity).toBe('high');
    expect(lossAlert.status).toBe('active');
    expect(lossAlert.current_weight).toBe(30);
    expect(lossAlert.previous_weight).toBe(35);
  });

  test('does NOT flag a normal, small weight change', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._weightsByAnimal['a2'] = [
        { weight: 30, date: '2026-06-01' },
        { weight: 30.5, date: '2026-06-08' }, // +1.6%, well within normal range
      ];
    });
    await page.evaluate(() => window.evaluateWeightAlert('a2', 'G-2', null));
    const alerts = await page.evaluate(() => window._alerts.filter((a) => a.animal_id === 'a2'));
    expect(alerts.find((a) => a.rule_type === 'weight_loss'), 'no false-positive weight_loss alert').toBeFalsy();
  });

  test('never creates a duplicate active alert for the same animal+rule', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._weightsByAnimal['a3'] = [{ weight: 40, date: '2026-06-01' }, { weight: 34, date: '2026-06-10' }];
    });
    await page.evaluate(() => window.evaluateWeightAlert('a3', 'G-3', null));
    await page.evaluate(() => window.evaluateWeightAlert('a3', 'G-3', null));
    await page.evaluate(() => window.evaluateWeightAlert('a3', 'G-3', null));
    const alerts = await page.evaluate(() => window._alerts.filter((a) => a.animal_id === 'a3' && a.rule_type === 'weight_loss'));
    expect(alerts.length, 'exactly one alert despite three evaluations').toBe(1);
  });

  test('auto-resolves an active alert once the underlying issue no longer holds', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._weightsByAnimal['a4'] = [{ weight: 40, date: '2026-06-01' }, { weight: 34, date: '2026-06-10' }];
    });
    await page.evaluate(() => window.evaluateWeightAlert('a4', 'G-4', null));
    // Animal recovers -- new weight record shows a healthy gain
    await page.evaluate(() => {
      window._weightsByAnimal['a4'].unshift({ weight: 39, date: '2026-06-20' });
    });
    await page.evaluate(() => window.evaluateWeightAlert('a4', 'G-4', null));
    const alerts = await page.evaluate(() => window._alerts.filter((a) => a.animal_id === 'a4' && a.rule_type === 'weight_loss'));
    expect(alerts.length, 'still exactly one alert record (not deleted, not duplicated)').toBe(1);
    expect(alerts[0].status, 'auto-resolved once the condition cleared').toBe('resolved');
  });

  test('generates a traceable task via the Sprint 1 automation engine, not a parallel path', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._weightsByAnimal['a5'] = [{ weight: 40, date: '2026-06-01' }, { weight: 34, date: '2026-06-10' }];
    });
    await page.evaluate(() => window.evaluateWeightAlert('a5', 'G-5', 'حظيرة 2'));
    const tasks = await page.evaluate(() => window._tasks);
    expect(tasks.length, 'exactly one task created').toBe(1);
    expect(tasks[0].auto_source_type).toBe('weight_alert');
    expect(tasks[0].priority, 'weight_loss maps to high task priority via priorityOverride').toBe('high');
  });

  test('manual resolution via resolveWeightAlert() works and is traceable', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._alerts.push({ _id: 'x1', animal_id: 'a6', status: 'active', rule_type: 'weight_loss' });
    });
    const ok = await page.evaluate(() => window.resolveWeightAlert('x1'));
    expect(ok).toBe(true);
    const alert = await page.evaluate(() => window._alerts.find((a) => a._id === 'x1'));
    expect(alert.status).toBe('resolved');
    expect(alert.resolved_at).toBeTruthy();
  });

  test('permission: resolve button only renders for can(animals), not for a role without it', async ({ page }) => {
    async function renderedAlertHtmlFor(role) {
      await page.addInitScript((r) => localStorage.setItem('farm_user', JSON.stringify({ name: 'U', role: r })), role);
      await page.goto(`${BASE_URL}/animal-detail.html?id=xtest`);
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        window.fbGet = async (path) => (path === 'weight_alerts'
          ? [{ _id: 'x1', animal_id: 'xtest', status: 'active', severity: 'high', rule_type: 'weight_loss', action: 'فحص بيطري', detail: 'فقدان 10%', detected_at: new Date().toISOString(), current_weight: 30, previous_weight: 33 }]
          : []);
      });
      await page.evaluate(() => window.renderWeightAlertsSection('xtest'));
      await page.waitForTimeout(300);
      return page.evaluate(() => document.getElementById('weight-alerts-section')?.innerHTML || '');
    }

    // 'vet' is explicitly excluded from 'animals' in the real ROLE_PERMS
    // (firebase.js) -- ['health','vaccine','breeding','dash','notifications','bayan']
    // does not include 'animals'. This is the correct role to prove the
    // gate actually blocks someone, unlike 'visitor', which legitimately
    // does hold 'animals' and would show the button correctly.
    const vetHtml = await renderedAlertHtmlFor('vet');
    expect(vetHtml, 'vet sees the alert but not a resolve control (lacks animals perm)').toContain('فقدان 10%');
    expect(vetHtml).not.toContain('resolveWeightAlert(');

    const adminHtml = await renderedAlertHtmlFor('admin');
    expect(adminHtml, 'admin (can animals) sees a resolve control').toContain('resolveWeightAlert(');
  });

  test('dashboard renders the weight-intelligence panel without errors when alerts exist', async ({ page }) => {
    await setupMockEngine(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(async () => {
      const animals=[], breeding=[], health=[], finance=[], meds=[], feeds=[], equipment=[], production=[], activity=[];
      const weightAlerts = [{ _id: 'a1', animal_tag: 'G-1', severity: 'high', action: 'فحص بيطري', status: 'active', detected_at: new Date().toISOString() }];
      window.renderDashboard(animals, breeding, health, finance, meds, feeds, equipment, production, activity, weightAlerts);
    });
    await page.waitForTimeout(300);
    const realErrors = errors.filter((e) => !e.includes('Failed to fetch'));
    expect(realErrors).toEqual([]);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('G-1');
  });
});
