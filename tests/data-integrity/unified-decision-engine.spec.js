// tests/data-integrity/unified-decision-engine.spec.js
// Sprint 5, Epic 5: regression protection for window.evaluateOperationalPriority()
// and window.rankOperationalPriorities(). Pure composition -- these tests
// specifically verify NOTHING is recalculated and NO new persistent
// state is created.

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
    window._prod = [];
    window._tasks = [];
    window._writeLog = []; // tracks every write call, to prove the unified engine performs none
    window.fbGet = async (path) => {
      if (path === 'health') return window._health.slice();
      if (path === 'weight_alerts') return window._weightAlerts.slice();
      if (path === 'vaccinations') return window._vacc.slice();
      if (path === 'production_log') return window._prod.slice();
      if (path === 'production_alerts') return [];
      if (path === 'daily_tasks') return window._tasks.slice();
      return [];
    };
    window.fbPost = async (path, d) => { window._writeLog.push({ op: 'post', path }); return 'id'; };
    window.fbPatch = async (path, id, d) => { window._writeLog.push({ op: 'patch', path }); };
    window.logActivity = async () => {};
  });
}

test.describe('Unified Decision Engine', () => {
  test('composes health + production + tasks correctly (matches the documented formula)', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: '2026-07-15' }]; // healthScore = 30
      window._tasks = [{ status: 'pending', priority: 'high', related_tag: 'G-1' }]; // taskUrgencyBonus = min(100, 3*20) = 60
    });
    const p = await page.evaluate(() => window.evaluateOperationalPriority('a1', 'G-1', 'B1'));
    // score = round(0.6*30 + 0.3*0 + 0.1*60) = round(18+0+6) = 24
    expect(p.score).toBe(24);
    expect(p.healthScore).toBe(30);
    expect(p.productionSeverity).toBe(0);
    expect(p.taskUrgencyBonus).toBe(60);
  });

  test('performs ZERO writes -- pure orchestration, no new persistent state', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-2', status: 'active', diagnosis: 'x', date: '2026-07-15' }];
      window._tasks = [{ status: 'pending', priority: 'medium', related_tag: 'G-2' }];
    });
    await page.evaluate(() => window.evaluateOperationalPriority('a2', 'G-2', 'B1'));
    const writes = await page.evaluate(() => window._writeLog);
    // Note: evaluateHealthRisk itself may write a task for high/critical results (Sprint 3's
    // own, already-tested behavior) -- but at this LOW/MEDIUM score, no such write should fire.
    expect(writes.length, 'the unified engine itself writes nothing; and this scenario is below the threshold where Health Intelligence would write its own task').toBe(0);
  });

  test('returns null (not an operational priority) when zero engines show any signal', async ({ page }) => {
    await setupMockEngine(page);
    const p = await page.evaluate(() => window.evaluateOperationalPriority('a3', 'G-3', 'B1'));
    expect(p).toBeNull();
  });

  test('weight is never double-counted: an animal with ONLY an active weight alert (no illness, no tasks) scores through Health, not twice', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._weightAlerts = [{ animal_id: 'a4', status: 'active', rule_type: 'weight_loss', detail: 'x' }];
    });
    const p = await page.evaluate(() => window.evaluateOperationalPriority('a4', 'G-4', 'B1'));
    // healthScore should be exactly 25 (weight_loss's own weight inside Health Intelligence),
    // not 25 twice or 50 -- proving weight flows through Health exactly once.
    expect(p.healthScore).toBe(25);
    expect(p.score).toBe(Math.round(0.6 * 25));
  });

  test('confidence is high with 2+ contributing engines, medium with exactly 1', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-5', status: 'active', diagnosis: 'x', date: '2026-07-15' }];
      window._tasks = [{ status: 'pending', priority: 'low', related_tag: 'G-5' }];
    });
    const twoEngines = await page.evaluate(() => window.evaluateOperationalPriority('a5', 'G-5', 'B1'));
    expect(twoEngines.confidence).toBe('high');

    await page.evaluate(() => { window._health = [{ animal_tag: 'G-6', status: 'active', diagnosis: 'x', date: '2026-07-15' }]; window._tasks = []; });
    const oneEngine = await page.evaluate(() => window.evaluateOperationalPriority('a6', 'G-6', 'B1'));
    expect(oneEngine.confidence).toBe('medium');
  });

  test('every evidence line is traceable -- no synthesized evidence', async ({ page }) => {
    await setupMockEngine(page);
    await page.evaluate(() => {
      window._health = [{ animal_tag: 'G-7', status: 'active', diagnosis: 'تشخيص', date: '2026-07-15' }];
      window._tasks = [{ status: 'pending', priority: 'high', related_tag: 'G-7' }];
    });
    const p = await page.evaluate(() => window.evaluateOperationalPriority('a7', 'G-7', 'B1'));
    expect(p.evidence.length).toBeGreaterThan(0);
    p.evidence.forEach((e) => {
      expect(e.source).toBeTruthy();
      expect(e.detail).toBeTruthy();
    });
  });

  test('ranking applies documented tie-breaking rules: active illness first on equal score', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(400);
    const withIllness = { animalTag: 'G-A', score: 50, hasActiveIllness: true, contributingEngines: ['health'] };
    const withoutIllness = { animalTag: 'G-B', score: 50, hasActiveIllness: false, contributingEngines: ['health', 'tasks'] };
    const ranked = await page.evaluate((arr) => window.rankOperationalPriorities(arr), [withoutIllness, withIllness]);
    expect(ranked[0].animalTag, 'active illness outranks more contributing engines at equal score').toBe('G-A');
  });

  test('ranking falls back to alphabetical tag when fully tied', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(400);
    const a = { animalTag: 'Z-1', score: 30, hasActiveIllness: false, contributingEngines: ['health'] };
    const b = { animalTag: 'A-1', score: 30, hasActiveIllness: false, contributingEngines: ['health'] };
    const ranked = await page.evaluate((arr) => window.rankOperationalPriorities(arr), [a, b]);
    expect(ranked[0].animalTag).toBe('A-1');
  });

  test('dashboard renders the unified panel and old Sprint 2/3/4 panel labels no longer appear', async ({ page }) => {
    await setupMockEngine(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(async () => {
      const animals = [{ _id: 'a8', tag: 'G-8', barn: 'B1', status: 'alive' }];
      const health = [{ animal_tag: 'G-8', status: 'active', diagnosis: 'x', date: '2026-07-15' }];
      window.renderDashboard(animals, [], health, [], [], [], [], [], [], [], [], []);
      if (window.renderUnifiedPriorities) await window.renderUnifiedPriorities(animals, health, [], []);
    });
    await page.waitForTimeout(300);
    const bodyText = await page.evaluate(() => document.body.innerText);
    expect(bodyText).toContain('الأولويات التشغيلية');
    expect(bodyText).not.toContain('ذكاء الوزن — Sprint 2');
    expect(bodyText).not.toContain('ذكاء الصحة — Sprint 3');
    expect(bodyText).not.toContain('ذكاء الإنتاج — Sprint 4');
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('animal-detail page loads cleanly with the consolidated summary section present', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE_URL}/animal-detail.html?id=nonexistent`);
    await page.waitForTimeout(600);
    const hasSection = await page.evaluate(() => !!document.getElementById('unified-priority-detail-section'));
    expect(hasSection, 'the consolidated summary container must exist on the page').toBe(true);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
