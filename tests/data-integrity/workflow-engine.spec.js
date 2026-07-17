// tests/data-integrity/workflow-engine.spec.js
// v1.4: regression protection for window.completeWorkflow() and its
// integration points. This engine is PURE ORCHESTRATION -- these tests
// specifically verify no task/notification/intelligence logic is
// duplicated, and that repeated/failed calls are safe (idempotency,
// retry safety).

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupWorkflowMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  await page.evaluate((ov) => {
    window._tasks = ov.daily_tasks || [];
    window._history = [];
    window.fbGet = async (c) => {
      if (c === 'daily_tasks') return window._tasks.slice();
      if (ov[c] !== undefined) return ov[c];
      return [];
    };
    window.fbPatch = async (c, id, d) => { if (c === 'daily_tasks') { const t = window._tasks.find((x) => x._id === id); if (t) Object.assign(t, d); } };
    window.fbPost = async (c, d) => { if (c === 'workflow_history') { window._history.push(d); return 'wh' + window._history.length; } return 'id'; };
    window.getUser = () => ({ name: 'Test User', role: 'admin' });
  }, overrides);
}

test.describe('Workflow Engine (v1.4)', () => {
  test('Birth workflow: resolves the original expected_birth_approaching reminder and recommends a next step', async ({ page }) => {
    await setupWorkflowMocks(page, {
      daily_tasks: [{ _id: 't1', status: 'pending', auto_dedup_key: 'expected_birth_approaching:b1' }],
    });
    const r = await page.evaluate(() => window.completeWorkflow('birth', { sourceId: 'b1', animalTag: 'G-1' }));
    expect(r.resolvedTaskCount).toBe(1);
    expect(r.recommendation.text).toContain('الوزن الأولي');
    const task = await page.evaluate(() => window._tasks[0]);
    expect(task.status).toBe('done');
  });

  test('Vaccination workflow: resolves reminder and surfaces another pending vaccination in the same section', async ({ page }) => {
    await setupWorkflowMocks(page, {
      daily_tasks: [{ _id: 't1', status: 'pending', auto_dedup_key: 'vaccination_scheduled:v1' }],
      vaccinations: [{ _id: 'v2', target_section: 'B1', status: 'pending', name: 'لقاح ب' }],
    });
    const r = await page.evaluate(() => window.completeWorkflow('vaccination', { sourceId: 'v1', targetSection: 'B1' }));
    expect(r.resolvedTaskCount).toBe(1);
    expect(r.recommendation.actionable).toBe(true);
    expect(r.recommendation.evidence).toContain('لقاح ب');
  });

  test('Medication workflow: recommendation reuses evaluateHealthRisk() output, never re-scores', async ({ page }) => {
    await setupWorkflowMocks(page, {
      daily_tasks: [{ _id: 't1', status: 'pending', auto_dedup_key: 'medication_followup:h1' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: new Date().toISOString().slice(0, 10) }],
    });
    const [riskDirect, r] = await page.evaluate(async () => [
      await window.evaluateHealthRisk('x1', 'G-1', 'B1'),
      await window.completeWorkflow('medication', { sourceId: 'h1', animalId: 'x1', animalTag: 'G-1', barn: 'B1' }),
    ]);
    expect(r.recommendation.evidence).toContain(String(riskDirect.score));
  });

  test('Weight/Production workflows: complete safely even with a null animalId (graceful degradation)', async ({ page }) => {
    await setupWorkflowMocks(page, {});
    const [wf, pf] = await page.evaluate(async () => [
      await window.completeWorkflow('weight', { sourceId: 'x1', animalId: null, animalTag: 'G-1', barn: 'B1' }),
      await window.completeWorkflow('production', { sourceId: 'x1', animalId: null, animalTag: 'G-1', barn: 'B1' }),
    ]);
    expect(wf.outcome).toBe('success');
    expect(pf.outcome).toBe('success');
  });

  test('Sale/Death workflows: resolve ALL open tasks tied to the animal, regardless of event type', async ({ page }) => {
    await setupWorkflowMocks(page, {
      daily_tasks: [
        { _id: 't1', status: 'pending', related_tag: 'G-1', auto_dedup_key: 'vaccination_scheduled:v1' },
        { _id: 't2', status: 'pending', related_tag: 'G-1', auto_dedup_key: 'medication_followup:h1' },
        { _id: 't3', status: 'pending', related_tag: 'G-OTHER', auto_dedup_key: 'vaccination_scheduled:v9' },
      ],
    });
    const r = await page.evaluate(() => window.completeWorkflow('sale', { sourceId: 'x1', animalTag: 'G-1' }));
    expect(r.resolvedTaskCount, 'only the 2 tasks tied to G-1, not the unrelated one').toBe(2);
    const tasks = await page.evaluate(() => window._tasks);
    expect(tasks.find((t) => t._id === 't3').status).not.toBe('done');
  });

  test('Idempotency: calling the same workflow twice never double-resolves or errors', async ({ page }) => {
    await setupWorkflowMocks(page, {
      daily_tasks: [{ _id: 't1', status: 'pending', auto_dedup_key: 'expected_birth_approaching:b1' }],
    });
    const [r1, r2] = await page.evaluate(async () => [
      await window.completeWorkflow('birth', { sourceId: 'b1', animalTag: 'G-1' }),
      await window.completeWorkflow('birth', { sourceId: 'b1', animalTag: 'G-1' }),
    ]);
    expect(r1.resolvedTaskCount).toBe(1);
    expect(r2.resolvedTaskCount, 'second call finds nothing left to resolve').toBe(0);
    expect(r2.outcome).toBe('success');
  });

  test('Retry safety: an invalid workflow type fails safely, does not throw', async ({ page }) => {
    await setupWorkflowMocks(page, {});
    const r = await page.evaluate(() => window.completeWorkflow('not_a_real_type', { sourceId: 'x' }));
    expect(r.outcome).toBe('invalid');
  });

  test('Missing sourceId fails safely without throwing', async ({ page }) => {
    await setupWorkflowMocks(page, {});
    const r = await page.evaluate(() => window.completeWorkflow('birth', {}));
    expect(r.outcome).toBe('invalid');
  });

  test('No duplicated task-creation: completeWorkflow never calls fbPost against daily_tasks directly', async ({ page }) => {
    await setupWorkflowMocks(page, { daily_tasks: [] });
    const posts = await page.evaluate(async () => {
      const log = [];
      const origPost = window.fbPost;
      window.fbPost = async (c, d) => { log.push(c); return origPost(c, d); };
      await window.completeWorkflow('birth', { sourceId: 'b1', animalTag: 'G-1' });
      return log;
    });
    expect(posts).not.toContain('daily_tasks');
    expect(posts).toContain('workflow_history');
  });

  test('Timeline: workflow completions appear in the dashboard Operational Timeline via the EXISTING merge mechanism', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await setupWorkflowMocks(page, {});
    await page.evaluate(() => {
      const animals = [{ _id: 'a1', tag: 'G-1', barn: 'B1', status: 'alive' }];
      const workflowHistory = [{ workflow_type: 'birth', animal_tag: 'G-1', completed_at: new Date().toISOString(), duration_ms: 100, actor: 'T', resolved_task_count: 1, outcome: 'success' }];
      window.renderDashboard(animals, [], [], [], [], [], [], [], [], [], [], [], [], workflowHistory);
    });
    await page.waitForTimeout(300);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('مسار عمل');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('Reports: Operational History tab renders workflow_history read-only, with correct outcome/error display', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => {
      window._data = {
        animals: [], health: [], weightAlerts: [], production: [], productionAlerts: [],
        dailyTasks: [], breeding: [], finance: [], vaccines: [], meds: [], feeds: [], notifications: [],
        workflowHistory: [{ workflow_type: 'sale', animal_tag: 'G-9', completed_at: '2026-07-14T08:00:00Z', duration_ms: 200, actor: 'A', resolved_task_count: 3, outcome: 'error', error_message: 'net' }],
        s: {},
      };
    });
    await page.evaluate(() => window.switchTab('workflows'));
    await page.waitForTimeout(400);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('سجل العمليات');
    expect(bodyText).toContain('خطأ');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('permission: Operational History tab only reachable with can("reports")', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'worker' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(600);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('غير مصرح بالوصول');
  });

  test('Dark and Light mode: reports workflows tab renders without error in both', async ({ page }) => {
    for (const theme of ['dark', 'light']) {
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.addInitScript((t) => {
        localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
        if (t === 'light') localStorage.setItem('farm_theme', 'light');
      }, theme);
      await page.goto(`${BASE_URL}/reports.html`);
      await page.waitForTimeout(700);
      await page.evaluate(() => window.switchTab && window.switchTab('workflows'));
      await page.waitForTimeout(300);
      expect(errors.filter((e) => !e.includes('Failed to fetch')), `${theme} mode`).toEqual([]);
    }
  });

  test('Large dataset: 300 workflow_history records render within a reasonable time', async ({ page }) => {
    const records = Array.from({ length: 300 }, (_, i) => ({ workflow_type: 'vaccination', animal_tag: 'G-' + i, completed_at: new Date().toISOString(), duration_ms: 50, actor: 'T', resolved_task_count: 1, outcome: 'success' }));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/reports.html`);
    await page.waitForTimeout(700);
    const start = Date.now();
    await page.evaluate((wh) => {
      window._data = { animals: [], health: [], weightAlerts: [], production: [], productionAlerts: [], dailyTasks: [], breeding: [], finance: [], vaccines: [], meds: [], feeds: [], notifications: [], workflowHistory: wh, s: {} };
      window.switchTab('workflows');
    }, records);
    await page.waitForTimeout(500);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });
});
