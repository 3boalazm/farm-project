// Module 16 — Intelligence engines: weight/health/production/operational
// alerts, task automation, forecasting, insights, workflow orchestration.
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('16 · Alerts, tasks & forecasting', ({ test }) => {
  let app, db;
  const reset = (over = {}) => { db.reset(Object.assign({ users: db.data.users }, over)); app.eval(`fbCacheInvalidate()`); };
  const d = (n) => app.eval(`shiftDateLocal(new Date(),${n})`);

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('evaluateWeightAlert() raises weight_loss at -5% and dedupes per (animal,rule)', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', barn: 'ج١ع١', weights: { w1: { weight: 100, date: d(-30) }, w2: { weight: 90, date: d(-1) } } } } });
    const first = J(await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-1','ج١ع١'))()`));
    assert.strictEqual(first.length, 1, 'exactly one alert raised');
    const alerts = J(db.collection('weight_alerts'));
    assert.strictEqual(alerts.length, 1);
    assert.strictEqual(alerts[0].rule_type, 'weight_loss');
    assert.strictEqual(alerts[0].severity, 'high');
    assert.strictEqual(alerts[0].current_weight, 90);
    assert.strictEqual(alerts[0].previous_weight, 100);
    assert.strictEqual(alerts[0].status, 'active');
    assert.match(alerts[0].detail, /10٪/, 'the real percentage is stated in the detail');
    // NOTE (audit finding, cosmetic): this detail string interpolates raw
    // ASCII digits while almost every other user-visible number in the app
    // goes through ar() — see docs/audit/FULL-AUDIT-2026-10.md.
    assert.strictEqual(/[٠-٩]/.test(alerts[0].detail), false);

    const again = J(await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-1','ج١ع١'))()`));
    assert.strictEqual(J(db.collection('weight_alerts')).length, 1, 're-evaluation must not duplicate');
    assert.strictEqual(again.length, 1);
    const tasks = J(db.collection('daily_tasks'));
    assert.strictEqual(tasks.length, 1, 'one auto task, not one per evaluation');
    assert.strictEqual(tasks[0].auto_generated, true);
  });

  test('evaluateWeightAlert() ignores a <5% move and auto-RESOLVES when the condition clears', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', weights: { w1: { weight: 100, date: d(-30) }, w2: { weight: 98, date: d(-1) } } } } });
    assert.deepStrictEqual(J(await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-1',null))()`)), []);
    // Now make it a real loss, then heal it by adding a newer good weight.
    await app.eval(`(async()=>await fbPost('animals/a1/weights',{weight:80,date:${JSON.stringify(d(0))}}))()`);
    app.eval(`fbCacheInvalidate()`);
    await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-1',null))()`);
    assert.strictEqual(J(db.collection('weight_alerts')).length, 1);
    // A NEWER, distinct date: two records sharing one date have no defined
    // order, so the "condition cleared" case needs a real later measurement.
    db.data.animals.a1.weights.w3 = { weight: 99, date: app.eval(`shiftDateLocal(new Date(),1)`) };
    db.data.animals.a1.weights.w2 = { weight: 80, date: d(0) };
    app.eval(`fbCacheInvalidate('animals/a1/weights')`);
    await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-1',null))()`);
    const alerts = J(db.collection('weight_alerts'));
    assert.strictEqual(alerts.length, 1, 'resolved, never deleted — the history is preserved');
    assert.strictEqual(alerts[0].status, 'resolved');
    assert.ok(alerts[0].resolved_at);
  });

  test('evaluateWeightAlert() with fewer than two records raises nothing', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', weights: { w1: { weight: 50, date: d(-1) } } } } });
    assert.deepStrictEqual(J(await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-1',null))()`)), []);
    assert.deepStrictEqual(J(await app.eval(`(async()=>await evaluateWeightAlert(null))()`)), []);
    assert.deepStrictEqual(J(await app.eval(`(async()=>await evaluateWeightAlert('ghost','x',null))()`)), []);
  });

  test('evaluateMissingWeightAlerts() flags a stale animal once and clears it after a new weight', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', weight_updated: d(-60), current_weight: 40 }, a2: { tag: 'GT-2', status: 'alive' }, a3: { tag: 'GT-3', status: 'dead', weight_updated: d(-90) } } });
    const list = J(await app.eval(`(async()=>await fbGet('animals'))()`));
    const first = J(await app.eval(`(async()=>await evaluateMissingWeightAlerts(${JSON.stringify(list)},30))()`));
    assert.strictEqual(first.length, 1, 'only the weighed-but-stale, living animal is in scope');
    const alerts = J(db.collection('weight_alerts'));
    assert.strictEqual(alerts[0].rule_type, 'missing_weight');
    // Computed the same way the engine does, so the test cannot flake across
    // midnight (this suite runs in the farm's real timezone, UTC+3).
    const expectedDays = app.eval(`Math.floor((Date.now()-new Date(${JSON.stringify(d(-60))}).getTime())/86400000)`);
    assert.ok(new RegExp('\\b' + expectedDays + '\\b').test(alerts[0].detail),
      'the real number of days is stated, got: ' + alerts[0].detail);
    const again = J(await app.eval(`(async()=>await evaluateMissingWeightAlerts(${JSON.stringify(list)},30))()`));
    assert.strictEqual(again.length, 0, 'never a second alert for the same condition');
    assert.strictEqual(J(db.collection('weight_alerts')).length, 1);

    db.data.animals.a1.weight_updated = d(-1);
    app.eval(`fbCacheInvalidate('animals')`);
    const fresh = J(await app.eval(`(async()=>await evaluateMissingWeightAlerts(await fbGet('animals'),30))()`));
    assert.deepStrictEqual(fresh, []);
    assert.strictEqual(J(db.collection('weight_alerts'))[0].status, 'resolved');
  });

  test('resolveWeightAlert() closes an alert manually and reports failure honestly', async () => {
    reset({ weight_alerts: { w1: { animal_id: 'a1', status: 'active' } } });
    assert.strictEqual(await app.eval(`(async()=>await resolveWeightAlert('w1'))()`), true);
    assert.strictEqual(db.data.weight_alerts.w1.status, 'resolved');
    const failing = await bootApp({ db: { failMode: (m) => (m === 'PATCH' ? new Response('no', { status: 500 }) : null) } });
    assert.strictEqual(await failing.eval(`(async()=>await resolveWeightAlert('x'))()`), false, 'a failed write returns false, never throws');
    failing.close();
  });

  test('evaluateHealthRisk() scores a real, evidenced risk and returns a level', async () => {
    reset({
      animals: { a1: { tag: 'GT-1', status: 'alive', barn: 'ج١ع١' } },
      health: { h1: { animal_tag: 'GT-1', status: 'active', date: d(-2), diagnosis: 'التهاب ضرع' } },
      vaccinations: { v1: { name: 'حمى', status: 'pending', target_section: 'ج١ع١', scheduled_date: d(-5) } },
    });
    const r = J(await app.eval(`(async()=>await evaluateHealthRisk('a1','GT-1','ج١ع١'))()`));
    assert.ok(r, 'a score object is returned');
    assert.ok(Number.isFinite(r.score) && r.score >= 0 && r.score <= 100, 'score is a real 0-100 number: ' + JSON.stringify(r).slice(0, 200));
    assert.ok(['low', 'medium', 'high', 'critical'].includes(r.level), 'level is one of the documented bands');
    assert.ok(Array.isArray(r.contributors) && r.contributors.length, 'every score is decomposed into contributors');
    r.contributors.forEach((c) => {
      assert.ok(c.factor && Number.isFinite(c.points) && c.evidence, 'each contributor states its factor, weight and evidence: ' + JSON.stringify(c));
    });
    assert.ok(r.contributors.some((c) => c.factor === 'active_illness'), 'the active illness is what drove the score');
    assert.ok(r.contributors.some((c) => c.factor === 'missed_vaccination'), 'the overdue vaccination counts too');
    assert.strictEqual(r.score, 50, '30 (activeIllness) + 20 (missedVaccination), per HEALTH_RISK_WEIGHTS');
    assert.strictEqual(r.level, 'high');
    assert.strictEqual(r.recommendations.length, r.contributors.length, 'every contributor yields one recommendation');
    assert.ok(Array.isArray(r.recentTimeline));
    // A high/critical evaluation schedules exactly ONE follow-up task. The
    // scheduling call is fire-and-forget by design (it must never block or
    // fail the evaluation), so give it a tick to land.
    await new Promise((r) => setTimeout(r, 80));
    const tasks = J(db.collection('daily_tasks'));
    assert.strictEqual(tasks.filter((t) => t.auto_source_type === 'health_risk_alert').length, 1, 'no task spam from one evaluation');
    assert.ok(!/NaN/.test(JSON.stringify(r)));
  });

  test('evaluateHealthRisk() on a clean animal scores low with no invented findings', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } }, health: {}, vaccinations: {} });
    const r = J(await app.eval(`(async()=>await evaluateHealthRisk('a1','GT-1',null))()`));
    assert.ok(r);
    assert.ok(r.score <= 25, 'a healthy animal with no records is low risk, got ' + r.score);
    assert.strictEqual(r.level, 'low');
  });

  test('autoGenerateTask() creates one task per (event,source) and updates the date on re-fire', async () => {
    reset({ daily_tasks: {} });
    const id1 = await app.eval(`(async()=>await autoGenerateTask('vaccination_scheduled',{sourceId:'v1',name:'حمى',target_section:'ج١ع١',scheduled_date:${JSON.stringify(d(5))}}))()`);
    assert.ok(id1);
    let tasks = J(db.collection('daily_tasks'));
    assert.strictEqual(tasks.length, 1);
    assert.strictEqual(tasks[0].category, 'medical');
    assert.strictEqual(tasks[0].priority, 'high');
    assert.strictEqual(tasks[0].date, d(5));
    assert.strictEqual(tasks[0].auto_dedup_key, 'vaccination_scheduled:v1');
    assert.strictEqual(tasks[0].status, 'pending');
    assert.strictEqual(tasks[0].created_by, 'النظام (تلقائي)');

    const id2 = await app.eval(`(async()=>await autoGenerateTask('vaccination_scheduled',{sourceId:'v1',name:'حمى',scheduled_date:${JSON.stringify(d(9))}}))()`);
    assert.strictEqual(id2, id1, 'the SAME task is returned');
    tasks = J(db.collection('daily_tasks'));
    assert.strictEqual(tasks.length, 1, 'no duplicate task');
    assert.strictEqual(tasks[0].date, d(9), 'but its due date follows the rescheduled event');
  });

  test('autoGenerateTask() refuses an unknown event, a missing sourceId or a dateless rule', async () => {
    reset({ daily_tasks: {} });
    assert.strictEqual(await app.eval(`(async()=>await autoGenerateTask('not_an_event',{sourceId:'x'}))()`), null);
    assert.strictEqual(await app.eval(`(async()=>await autoGenerateTask('vaccination_scheduled',{}))()`), null);
    assert.strictEqual(await app.eval(`(async()=>await autoGenerateTask('vaccination_scheduled',{sourceId:'v1'}))()`), null, 'no scheduled_date → nothing to schedule');
    assert.strictEqual(await app.eval(`(async()=>await autoGenerateTask(null,null))()`), null);
    assert.deepStrictEqual(J(db.collection('daily_tasks')), []);
  });

  test('autoGenerateTask() covers every documented event type', async () => {
    reset({ daily_tasks: {} });
    const cases = [
      ['expected_birth_approaching', { sourceId: 'b1', female_tag: 'F-1', expected_birth: d(3) }],
      ['medication_followup', { sourceId: 'h1', animal_tag: 'GT-1', withdrawal_end: d(2) }],
      ['weight_alert', { sourceId: 'w1', animal_tag: 'GT-1', alertTitle: 'فحص بيطري' }],
      ['health_risk_alert', { sourceId: 'r1', animal_tag: 'GT-2', recommendation: 'مراجعة' }],
      ['production_alert', { sourceId: 'p1', animal_tag: 'GT-3', alertTitle: 'متابعة إنتاج' }],
    ];
    for (const [type, payload] of cases) {
      const id = await app.eval(`(async()=>await autoGenerateTask(${JSON.stringify(type)},${JSON.stringify(payload)}))()`);
      assert.ok(id, `${type} must create a task`);
    }
    const tasks = J(db.collection('daily_tasks'));
    assert.strictEqual(tasks.length, cases.length);
    const today = app.eval(`todayStr()`);
    tasks.filter((t) => ['weight_alert', 'health_risk_alert', 'production_alert'].includes(t.auto_source_type))
      .forEach((t) => assert.strictEqual(t.date, today, 'an alert task is due today, not on some future date'));
  });

  test('autoGenerateTask() never throws and never blocks its caller', async () => {
    const failing = await bootApp({ db: { failMode: (m) => (m === 'POST' ? new Response('no', { status: 500 }) : null) } });
    const r = await failing.eval(`(async()=>await autoGenerateTask('weight_alert',{sourceId:'w1',animal_tag:'GT-1'}))()`);
    assert.strictEqual(r, null, 'a failed task write is silent and safe');
    failing.close();
  });

  test('forecastWeight() extrapolates from real history and refuses to guess with <2 points', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', weights: { w1: { weight: 40, date: d(-60) }, w2: { weight: 55, date: d(-1) } } } } });
    const f = J(await app.eval(`(async()=>await forecastWeight('a1','GT-1'))()`));
    assert.ok(f, 'a forecast object is returned');
    assert.ok(['rising', 'declining', 'stable', null].includes(f.trend), 'trend is one of the documented values: ' + f.trend);
    assert.strictEqual(f.trend, 'rising', '40kg → 55kg over 59 days is a rise');
    assert.ok(Number.isFinite(f.projected30), 'a 30-day projection is produced');
    assert.ok(Array.isArray(f.evidence) && f.evidence.length, 'the forecast states its evidence');
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(f)));

    reset({ animals: { a2: { tag: 'GT-2', weights: { w1: { weight: 40, date: d(-1) } } } } });
    const thin = J(await app.eval(`(async()=>await forecastWeight('a2','GT-2'))()`));
    assert.strictEqual(thin.confidence, 'low');
    assert.strictEqual(thin.trend, null, 'no trend is invented from one data point');
    assert.strictEqual(await app.eval(`(async()=>await forecastWeight(null))()`), null);
  });

  test('forecastTaskWorkload() counts only what is already scheduled inside the window', async () => {
    reset({
      daily_tasks: { t1: { title: 'inside', status: 'pending', date: d(3) }, t2: { title: 'outside', status: 'pending', date: d(30) }, t3: { title: 'done', status: 'done', date: d(1) } },
      vaccinations: { v1: { status: 'pending', scheduled_date: d(2) }, v2: { status: 'done', scheduled_date: d(2) } },
      breeding: { b1: { status: 'pregnant', expected_birth: d(5) }, b2: { status: 'born', expected_birth: d(5) } },
    });
    const f = J(await app.eval(`(async()=>await forecastTaskWorkload(7))()`));
    assert.strictEqual(f.windowDays, 7);
    assert.strictEqual(f.existingTasks, 1, 'the done task and the far-future task are excluded');
    assert.strictEqual(f.expectedVaccinations, 1, 'a completed vaccination is not future work');
    assert.strictEqual(f.expectedBirths, 1, 'only a still-pregnant record counts');
    assert.strictEqual(f.totalExpectedWorkload, 3);
  });

  test('forecastTaskWorkload() degrades to zeros instead of throwing when reads fail', async () => {
    const failing = await bootApp({ db: { failMode: 'network' } });
    const f = J(await failing.eval(`(async()=>await forecastTaskWorkload(7))()`));
    assert.strictEqual(f.totalExpectedWorkload, 0);
    assert.strictEqual(f.windowDays, 7);
    failing.close();
  });

  test('forecastHealthRisk() starts from the real current score and adds only knowable events', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', barn: 'ج١ع١' } }, health: {}, vaccinations: { v1: { name: 'حمى', status: 'pending', target_section: 'ج١ع١', scheduled_date: d(10) } } });
    const f = J(await app.eval(`(async()=>await forecastHealthRisk('a1','GT-1','ج١ع١',30))()`));
    assert.ok(f, JSON.stringify(f));
    assert.strictEqual(f.windowDays, 30);
    assert.ok(Number.isFinite(f.currentScore) && Number.isFinite(f.projectedScore));
    assert.ok(f.projectedScore >= f.currentScore, 'a pending vaccination can only raise the projected risk');
    assert.strictEqual(f.confidence, 'medium', 'a real scheduled event raises confidence above "low"');
    assert.ok(f.evidence.some((e) => /حمى/.test(e)), 'the evidence names the actual vaccination');
  });

  test('generateFarmInsights()/forecastFarmSummary() never invent numbers and never throw', async () => {
    reset({
      animals: { a1: { tag: 'GT-1', status: 'alive', weights: { w1: { weight: 50, date: d(-40) }, w2: { weight: 44, date: d(-1) } } } },
      health: { h1: { animal_tag: 'GT-1', status: 'active', date: d(-1) } },
      weight_alerts: { wa: { animal_id: 'a1', status: 'active', detected_at: new Date().toISOString() } },
      production_log: { p1: { type: 'milk', animal_id: 'a1', quantity: 5, date: d(-1) } },
    });
    const animals = J(await app.eval(`(async()=>await fbGet('animals'))()`));
    const health = J(await app.eval(`(async()=>await fbGet('health'))()`));
    const wa = J(await app.eval(`(async()=>await fbGet('weight_alerts'))()`));
    const pl = J(await app.eval(`(async()=>await fbGet('production_log'))()`));
    const ins = J(await app.eval(`(async()=>await generateFarmInsights(${JSON.stringify(animals)},${JSON.stringify(health)},${JSON.stringify(wa)},${JSON.stringify(pl)}))()`));
    assert.ok(ins !== undefined, 'insights computed');
    assert.ok(!/NaN|Infinity/.test(JSON.stringify(ins)), 'no NaN in any insight: ' + JSON.stringify(ins).slice(0, 300));
    const sum = J(await app.eval(`(async()=>await forecastFarmSummary(${JSON.stringify(animals)},${JSON.stringify(health)},${JSON.stringify(wa)},${JSON.stringify(pl)}))()`));
    assert.ok(sum === null || typeof sum === 'object');
    if (sum) {
      assert.ok(Number.isFinite(sum.expectedWorkload7) && Number.isFinite(sum.expectedWorkload30));
      assert.ok(!/NaN/.test(JSON.stringify(sum)));
    }
  });

  test('the predict* aliases delegate to the forecast* engines (one implementation, not two)', async () => {
    reset({ animals: { a1: { tag: 'GT-1', weights: { w1: { weight: 40, date: d(-30) }, w2: { weight: 45, date: d(-1) } } } } });
    const a = J(await app.eval(`(async()=>await predictWeightRisk('a1','GT-1'))()`));
    const b = J(await app.eval(`(async()=>await forecastWeight('a1','GT-1'))()`));
    assert.deepStrictEqual(Object.keys(a).sort(), Object.keys(b).sort());
    assert.strictEqual(a.trend, b.trend);
    const c = J(await app.eval(`(async()=>await predictTaskLoad(7))()`));
    assert.strictEqual(c.windowDays, 7);
  });

  test('completeWorkflow() orchestrates without becoming a second engine', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive', weights: { w1: { weight: 40, date: d(-1) } } } } });
    const r = J(await app.eval(`(async()=>await completeWorkflow('weight',{sourceId:'a1',animalId:'a1',animalTag:'GT-1',barn:null}))()`));
    assert.ok(r === null || typeof r === 'object', 'a structured result, never a throw');
    assert.ok(!/NaN/.test(JSON.stringify(r ?? null)));
    const unknown = J(await app.eval(`(async()=>await completeWorkflow('not_a_workflow',{}))()`));
    assert.ok(unknown === null || typeof unknown === 'object');
  });
});
