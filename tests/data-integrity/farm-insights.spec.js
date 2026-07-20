// tests/data-integrity/farm-insights.spec.js
// v1.5: regression protection for the predict*()/generateFarmInsights()
// layer. Per docs/features/PREDICTIVE-DISCOVERY.md, 3 of the 6
// predict*() functions are thin aliases to the certified forecast*()
// layer -- these tests verify the alias returns the EXACT SAME result
// as calling the original directly (proving no duplicate calculation
// exists), plus the genuinely new functions' own correctness,
// determinism, and the 100%-read-only guarantee.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

function daysAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function weeksAgoStr(n) { const d = new Date(); d.setDate(d.getDate() - n * 7); return d.toISOString().slice(0, 10); }

async function setupInsightMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/dashboard.html`);
  await page.waitForTimeout(500);
  await page.evaluate((ov) => {
    window._writeLog = [];
    window.fbGet = async (c) => (ov[c] !== undefined ? ov[c] : []);
    window.fbPost = async (c, d) => { window._writeLog.push({ op: 'post', c }); return 'id'; };
    window.fbPatch = async (c) => { window._writeLog.push({ op: 'patch', c }); };
    window.fbDelete = async (c) => { window._writeLog.push({ op: 'delete', c }); };
  }, overrides);
}

test.describe('Predictive Intelligence / Farm Insights (v1.5)', () => {
  test('predictWeightRisk is a true alias: identical result to calling forecastWeight directly', async ({ page }) => {
    await setupInsightMocks(page, { 'animals/x1/weights': [{ weight: 40, date: daysAgoStr(30) }, { weight: 35, date: daysAgoStr(0) }] });
    const [alias, direct] = await page.evaluate(async () => [
      await window.predictWeightRisk('x1', 'G-1'),
      await window.forecastWeight('x1', 'G-1'),
    ]);
    expect(alias).toEqual(direct);
  });

  test('predictMilkTrend is a true alias: identical result to calling forecastProduction directly', async ({ page }) => {
    const records = Array.from({ length: 20 }, (_, i) => ({ animal_id: 'x2', type: 'milk', date: daysAgoStr(i), quantity: 5 }));
    await setupInsightMocks(page, { production_log: records });
    const [alias, direct] = await page.evaluate(async () => [
      await window.predictMilkTrend('x2', 'G-2'),
      await window.forecastProduction('x2', 'G-2', 'milk'),
    ]);
    expect(alias).toEqual(direct);
  });

  test('predictTaskLoad is a true alias: identical result to calling forecastTaskWorkload directly', async ({ page }) => {
    await setupInsightMocks(page, { daily_tasks: [{ status: 'pending', date: daysAgoStr(-3) }] });
    const [alias, direct] = await page.evaluate(async () => [
      await window.predictTaskLoad(7),
      await window.forecastTaskWorkload(7),
    ]);
    expect(alias).toEqual(direct);
  });

  test('predictVaccinationPressure: correctly flags a real spike against a real historical baseline', async ({ page }) => {
    const vaccinations = [];
    for (let w = 1; w <= 8; w++) vaccinations.push({ target_section: 'B1', status: 'done', done_date: weeksAgoStr(w) });
    for (let i = 0; i < 6; i++) vaccinations.push({ target_section: 'B1', status: 'pending', scheduled_date: daysAgoStr(-i - 1), name: 'v' + i });
    await setupInsightMocks(page, { vaccinations });
    const p = await page.evaluate(() => window.predictVaccinationPressure(7));
    expect(p.upcomingCount).toBe(6);
    expect(p.pressure).toBe('high');
  });

  test('predictVaccinationPressure: a normal week (upcoming matches baseline) reports normal, not fabricated pressure', async ({ page }) => {
    const vaccinations = [];
    for (let w = 1; w <= 8; w++) vaccinations.push({ target_section: 'B1', status: 'done', done_date: weeksAgoStr(w) });
    vaccinations.push({ target_section: 'B1', status: 'pending', scheduled_date: daysAgoStr(-2), name: 'v' });
    await setupInsightMocks(page, { vaccinations });
    const p = await page.evaluate(() => window.predictVaccinationPressure(7));
    expect(p.pressure).toBe('normal');
  });

  test('predictBreedingWindow: correct interval math from real birth history, insufficient history returns nothing', async ({ page }) => {
    await setupInsightMocks(page, {
      animals: [{ _id: 'x1', tag: 'G-1', status: 'alive' }, { _id: 'x2', tag: 'G-2', status: 'alive' }],
      breeding: [
        { status: 'born', mother_tag: 'G-1', actual_birth: daysAgoStr(300) },
        { status: 'born', mother_tag: 'G-1', actual_birth: daysAgoStr(150) },
        { status: 'born', mother_tag: 'G-2', actual_birth: daysAgoStr(100) },
      ],
    });
    const preds = await page.evaluate(() => window.predictBreedingWindow(null, null));
    expect(preds.length).toBe(1);
    expect(preds[0].animalTag).toBe('G-1');
    expect(preds[0].avgIntervalDays).toBe(150);
    expect(preds[0].confidence).toBe('low');
  });

  test('predictBreedingWindow: a currently-pregnant dam is excluded (already covered by expected_birth_approaching)', async ({ page }) => {
    await setupInsightMocks(page, {
      animals: [{ _id: 'x1', tag: 'G-1', status: 'alive' }],
      breeding: [
        { status: 'born', mother_tag: 'G-1', actual_birth: daysAgoStr(300) },
        { status: 'born', mother_tag: 'G-1', actual_birth: daysAgoStr(150) },
        { status: 'pregnant', female_tag: 'G-1' },
      ],
    });
    const preds = await page.evaluate(() => window.predictBreedingWindow(null, null));
    expect(preds.length).toBe(0);
  });

  test('generateFarmInsights: every insight carries evidence, confidence, impactedAnimals, and suggestedAction', async ({ page }) => {
    await setupInsightMocks(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: daysAgoStr(1), medication: 'm', bcs: '2' }],
      weight_alerts: [{ animal_id: 'x1', status: 'active', rule_type: 'weight_loss' }],
      vaccinations: [{ target_section: 'B1', status: 'overdue', name: 'v', _id: 'v1' }],
    });
    const insights = await page.evaluate(() => window.generateFarmInsights([{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }], [{ animal_tag: 'G-1', status: 'active' }], [{ animal_id: 'x1', status: 'active', rule_type: 'weight_loss' }], []));
    expect(insights.length).toBeGreaterThan(0);
    insights.forEach((i) => {
      expect(i).toHaveProperty('text');
      expect(i).toHaveProperty('evidence');
      expect(i).toHaveProperty('confidence');
      expect(i).toHaveProperty('impactedAnimals');
      expect(i).toHaveProperty('suggestedAction');
    });
  });

  test('100% read-only: a full generateFarmInsights() run performs zero writes', async ({ page }) => {
    await setupInsightMocks(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: daysAgoStr(1) }],
    });
    await page.evaluate(() => window.generateFarmInsights([{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }], [{ animal_tag: 'G-1', status: 'active' }], [], []));
    const writes = await page.evaluate(() => window._writeLog);
    expect(writes).toEqual([]);
  });

  test('determinism: repeated calls with identical data produce identical insights', async ({ page }) => {
    await setupInsightMocks(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: daysAgoStr(1) }],
    });
    const [r1, r2] = await page.evaluate(async () => [
      await window.generateFarmInsights([{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }], [{ animal_tag: 'G-1', status: 'active' }], [], []),
      await window.generateFarmInsights([{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }], [{ animal_tag: 'G-1', status: 'active' }], [], []),
    ]);
    expect(r1).toEqual(r2);
  });

  test('notification integration: only high-confidence insights generate a notification', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/notifications.html`);
    await page.waitForTimeout(600);
    const vaccinations = [];
    for (let w = 1; w <= 8; w++) vaccinations.push({ target_section: 'B1', status: 'done', done_date: weeksAgoStr(w) });
    for (let i = 0; i < 6; i++) vaccinations.push({ target_section: 'B1', status: 'pending', scheduled_date: daysAgoStr(-i - 1), name: 'v' + i });
    const notifs = await page.evaluate(async (vacc) => {
      window._notifs = [];
      window.fbGet = async (c) => { if (c === 'vaccinations') return vacc; if (c === 'notifications') return window._notifs.slice(); return []; };
      window.fbPost = async (c, d) => { if (c === 'notifications') { const id = 'n' + window._notifs.length; window._notifs.push({ ...d, _id: id }); return id; } return 'id'; };
      window.fbPatch = async () => {};
      window.getUser = () => ({ name: 'T', role: 'admin' });
      window.initFirebase = () => true;
      window.getWeather = async () => null;
      localStorage.removeItem('_sentNotifIds');
      await NS.checkAll();
      return window._notifs.filter((n) => n.cat === 'التوقعات');
    }, vaccinations);
    expect(notifs.length).toBeGreaterThan(0);
    expect(notifs[0].title).toContain('مرتفعًا');
  });

  test('performance: generateFarmInsights completes in a reasonable time with 15 candidate animals', async ({ page }) => {
    const animals = Array.from({ length: 15 }, (_, i) => ({ _id: 'a' + i, tag: 'G-' + i, barn: 'B1', status: 'alive' }));
    const health = animals.map((a) => ({ animal_tag: a.tag, status: 'active', diagnosis: 'x', date: daysAgoStr(1) }));
    await setupInsightMocks(page, { animals, health });
    const start = Date.now();
    await page.evaluate((args) => window.generateFarmInsights(args.animals, args.health, [], []), { animals, health });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(8000);
  });

  test('regression: Analytics page still renders 5 charts after the forecast-chart extension', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/analytics.html`);
    await page.waitForTimeout(2200);
    const canvasCount = await page.evaluate(() => document.querySelectorAll('canvas').length);
    // Sprint 13 (v1.6) added a 6th chart (Financial Trends) -- updated
    // to track current correct behavior, not left stale.
    // Sprint 14 (v1.7) added a 7th chart (Inventory Consumption Trend) --
    // updated to track current correct behavior, not left stale.
    expect(canvasCount).toBe(7);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
