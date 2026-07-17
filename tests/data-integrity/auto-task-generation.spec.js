// tests/data-integrity/auto-task-generation.spec.js
// Sprint 1, Epic 1: regression protection for window.autoGenerateTask().
// Every assertion here was first proven live before being encoded as a
// permanent test -- see docs/features/AUTO-TASK-GENERATION.md.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupMockEngine(page) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  return page.evaluate(() => {
    window._createdTasks = [];
    window._patches = [];
    window.fbGet = async (c) => (c === 'daily_tasks' ? window._createdTasks.slice() : []);
    window.fbPost = async (c, d) => { const id = 'id' + window._createdTasks.length; window._createdTasks.push({ ...d, _id: id }); return id; };
    window.fbPatch = async (c, id, d) => { window._patches.push({ id, d }); const t = window._createdTasks.find((x) => x._id === id); if (t) Object.assign(t, d); };
    window.logActivity = async () => {};
  });
}

test.describe('Task automation engine (autoGenerateTask)', () => {
  test('creates a task with correct traceability fields', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => window.autoGenerateTask('vaccination_scheduled', { sourceId: 'v1', name: 'اللقاح', target_section: 'ح1', scheduled_date: '2026-09-01' }));
    const tasks = await page.evaluate(() => window._createdTasks);
    expect(tasks.length).toBe(1);
    expect(tasks[0].auto_generated).toBe(true);
    expect(tasks[0].auto_source_type).toBe('vaccination_scheduled');
    expect(tasks[0].auto_source_id).toBe('v1');
    expect(tasks[0].date).toBe('2026-09-01');
    expect(tasks[0].status).toBe('pending');
  });

  test('never creates a duplicate for the same source event', async ({ page }) => {
    await setupMockEngine(page);
    const payload = { sourceId: 'v2', name: 'x', target_section: 'y', scheduled_date: '2026-09-01' };
    await page.evaluate((p) => window.autoGenerateTask('vaccination_scheduled', p), payload);
    await page.evaluate((p) => window.autoGenerateTask('vaccination_scheduled', p), payload);
    await page.evaluate((p) => window.autoGenerateTask('vaccination_scheduled', p), payload);
    const tasks = await page.evaluate(() => window._createdTasks);
    expect(tasks.length, 'exactly one task for three identical calls').toBe(1);
  });

  test('updates the existing task date on reschedule, without duplicating', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => window.autoGenerateTask('vaccination_scheduled', { sourceId: 'v3', name: 'x', target_section: 'y', scheduled_date: '2026-09-01' }));
    await page.evaluate(() => window.autoGenerateTask('vaccination_scheduled', { sourceId: 'v3', name: 'x', target_section: 'y', scheduled_date: '2026-09-20' }));
    const result = await page.evaluate(() => ({ count: window._createdTasks.length, patches: window._patches.length, date: window._createdTasks[0].date }));
    expect(result.count, 'still exactly one task').toBe(1);
    expect(result.patches, 'exactly one patch applied').toBe(1);
    expect(result.date, 'date reflects the reschedule').toBe('2026-09-20');
  });

  test('different source events never collide', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => window.autoGenerateTask('vaccination_scheduled', { sourceId: 'A', name: 'x', scheduled_date: '2026-09-01' }));
    await page.evaluate(() => window.autoGenerateTask('vaccination_scheduled', { sourceId: 'B', name: 'y', scheduled_date: '2026-09-01' }));
    const tasks = await page.evaluate(() => window._createdTasks);
    expect(tasks.length, 'two distinct sources produce two distinct tasks').toBe(2);
  });

  test('does nothing when the event has no due date', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => window.autoGenerateTask('vaccination_scheduled', { sourceId: 'v4', name: 'x' }));
    const tasks = await page.evaluate(() => window._createdTasks);
    expect(tasks.length, 'no task without a resolvable due date').toBe(0);
  });

  test('all three implemented event types produce correctly-shaped tasks', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => window.autoGenerateTask('expected_birth_approaching', { sourceId: 'b1', female_tag: 'F-1', expected_birth: '2026-10-01' }));
    await page.evaluate(() => window.autoGenerateTask('medication_followup', { sourceId: 'h1', animal_tag: 'A-1', withdrawal_end: '2026-08-05' }));
    const tasks = await page.evaluate(() => window._createdTasks);
    expect(tasks.length).toBe(2);
    expect(tasks.find((t) => t.auto_source_type === 'expected_birth_approaching').category).toBe('breeding');
    expect(tasks.find((t) => t.auto_source_type === 'medication_followup').category).toBe('medical');
  });

  test('permission behavior unchanged: task card gates edit/delete exactly as before', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'visitor' })));
    await page.goto(`${BASE_URL}/tasks.html`);
    await page.waitForTimeout(600);
    const html = await page.evaluate(() => document.body.innerHTML);
    // A visitor has neither 'animals' nor 'admin' -- edit/delete controls must not render for them,
    // exactly as they did not before this sprint's changes (Sprint 1 adds no new permission logic).
    expect(html).not.toContain('onclick="delTask(');
  });
});
