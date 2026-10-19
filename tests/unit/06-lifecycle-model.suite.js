// Module 06 — Livestock lifecycle model (shared.js)
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('06 · Livestock lifecycle model', ({ test }) => {
  let app;
  test('boots', async () => { app = await bootApp(); });

  const monthsAgo = (n) => {
    const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  };

  test('getAgeInMonths() counts whole calendar months, not 30-day blocks', () => {
    assert.strictEqual(app.eval(`getAgeInMonths('2026-01-15', new Date('2026-03-14'))`), 1, 'one day short of 2 months');
    assert.strictEqual(app.eval(`getAgeInMonths('2026-01-15', new Date('2026-03-15'))`), 2);
    assert.strictEqual(app.eval(`getAgeInMonths('2025-12-31', new Date('2026-01-01'))`), 0);
  });

  test('getAgeInMonths() returns null for a missing birth date and clamps future dates to 0', () => {
    assert.strictEqual(app.eval(`getAgeInMonths(null)`), null);
    assert.strictEqual(app.eval(`getAgeInMonths('')`), null);
    assert.strictEqual(app.eval(`getAgeInMonths('2999-01-01')`), 0, 'never a negative age');
  });

  test('getLifeStage() walks newborn → weaned → growing → adult on the config thresholds', () => {
    assert.strictEqual(app.eval(`getLifeStage(${JSON.stringify(monthsAgo(0))})`), 'newborn');
    assert.strictEqual(app.eval(`getLifeStage(${JSON.stringify(monthsAgo(2))})`), 'weaned');
    assert.strictEqual(app.eval(`getLifeStage(${JSON.stringify(monthsAgo(5))})`), 'growing');
    assert.strictEqual(app.eval(`getLifeStage(${JSON.stringify(monthsAgo(24))})`), 'adult');
  });

  test('getLifeStage() returns null (never guesses) without a birth date', () => {
    assert.strictEqual(app.eval(`getLifeStage(null)`), null);
    assert.strictEqual(app.eval(`getLifeStage(undefined)`), null);
  });

  test('getLifeStage() honours per-farm threshold overrides from Settings', () => {
    const s = app.eval(`getSettings()`);
    const custom = Object.assign({}, J(s), { lifecycle: { newborn_months: 1, weaning_months: 6, adult_months: 18 } });
    const stage = app.eval(`getLifeStage(${JSON.stringify(monthsAgo(3))}, ${JSON.stringify(custom)})`);
    assert.strictEqual(stage, 'weaned', 'a 3-month animal is "weaned" under weaning_months:6');
    assert.strictEqual(app.eval(`getLifeStage(${JSON.stringify(monthsAgo(3))})`), 'growing', 'and "growing" under the defaults');
  });

  test('life stage is computed, never stored: changing thresholds changes every animal instantly', () => {
    const bd = JSON.stringify(monthsAgo(13));
    const a = app.eval(`getLifeStage(${bd})`);
    const b = app.eval(`getLifeStage(${bd}, {lifecycle:{newborn_months:2,weaning_months:3,adult_months:24}})`);
    assert.strictEqual(a, 'adult');
    assert.strictEqual(b, 'growing');
  });

  test('getProductionPurpose() treats "birth"/missing as undecided → تربية, and never rewrites', () => {
    assert.strictEqual(app.eval(`getProductionPurpose({purpose:'birth'})`), 'tarbiya');
    assert.strictEqual(app.eval(`getProductionPurpose({})`), 'tarbiya');
    assert.strictEqual(app.eval(`getProductionPurpose({purpose:'tasmeen'})`), 'tasmeen');
    assert.strictEqual(app.eval(`getProductionPurpose({purpose:'nonsense'})`), 'tarbiya');
    assert.strictEqual(app.eval(`getProductionPurpose(null)`), null);
  });

  test('LIFE_STAGES / PRODUCTION_PURPOSES are the documented closed sets', () => {
    assert.deepStrictEqual(J(app.eval(`LIFE_STAGES`)), ['newborn', 'weaned', 'growing', 'adult']);
    assert.deepStrictEqual(J(app.eval(`PRODUCTION_PURPOSES`)), ['tarbiya', 'tasmeen']);
    assert.strictEqual(app.eval(`LIFE_STAGE_LABELS.newborn`), 'مولود');
    assert.strictEqual(app.eval(`PRODUCTION_PURPOSE_LABELS.tasmeen`), 'تسمين');
  });

  test('isRealDeath() counts only genuine deaths, never bookkeeping corrections', () => {
    assert.strictEqual(app.eval(`isRealDeath({status:'dead'})`), true);
    assert.strictEqual(app.eval(`isRealDeath({status:'dead',is_correction:true})`), false);
    assert.strictEqual(app.eval(`isRealDeath({status:'dead',death_reason:'تعديل من يومية المزرعة'})`), false,
      'legacy correction rows written before the is_correction flag must still be excluded');
    assert.strictEqual(app.eval(`isRealDeath({status:'dead',death_reason:'مرض'})`), true);
    assert.strictEqual(app.eval(`isRealDeath({status:'removed'})`), false);
    assert.strictEqual(app.eval(`isRealDeath({status:'alive'})`), false);
    assert.strictEqual(app.eval(`isRealDeath(null)`), false);
  });

  test('resolveBreedAlias() maps the historical spelling and passes everything else through', () => {
    assert.strictEqual(app.eval(`resolveBreedAlias('دودبر')`), 'دوربر');
    assert.strictEqual(app.eval(`resolveBreedAlias('برقي')`), 'برقي');
    assert.strictEqual(app.eval(`resolveBreedAlias(null)`), null);
  });

  test('breedStats() splits a breed by species/gender/status from real records', () => {
    const animals = [
      { species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' },
      { species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' },
      { species: 'goat', breed: 'شامي', gender: 'male', status: 'alive' },
      { species: 'goat', breed: 'شامي', gender: 'female', status: 'dead' },
      { species: 'goat', breed: 'بور', gender: 'female', status: 'alive' },
      { species: 'sheep', breed: 'شامي', gender: 'female', status: 'alive' },
    ];
    app.eval(`window.__herd=${JSON.stringify(animals)}`);
    const s = J(app.eval(`breedStats(window.__herd,'goat','شامي')`));
    assert.strictEqual(typeof s, 'object');
    const total = Object.values(s).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
    assert.ok(total > 0, 'the breed bucket must report real counts');
    // A different species must not leak into the same breed's numbers.
    const sheep = J(app.eval(`breedStats(window.__herd,'sheep','شامي')`));
    assert.notDeepStrictEqual(sheep, s);
  });
});
