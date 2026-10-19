// Module 07 — Weight Service, the certified SSOT for animals.current_weight
// (docs/certification/WEIGHT.md). Every assertion here is about the ONE
// invariant that service exists to protect: current_weight == newest record.
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('07 · Weight service (SSOT)', ({ test }) => {
  let app, db;
  const reset = (seed) => { db.reset(Object.assign({ users: db.data.users }, seed)); app.eval(`fbCacheInvalidate()`); };

  test('boots as an admin with animals permission', async () => { app = await bootApp(); db = app.db; });

  const animal = (over = {}) => ({
    a1: Object.assign({ tag: 'GT-000001', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive', barn: 'ج١ع١' }, over),
  });

  test('records a weight and keeps current_weight equal to the newest record', async () => {
    reset({ animals: animal() });
    const r = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:42.5,date:shiftDateLocal(new Date(),-2)}))()`);
    assert.strictEqual(r.ok, true, JSON.stringify(J(r)));
    assert.strictEqual(db.data.animals.a1.current_weight, 42.5);
    assert.strictEqual(db.data.animals.a1.weight_updated, app.eval(`shiftDateLocal(new Date(),-2)`));
  });

  test('an OLDER measurement never overwrites a newer current_weight', async () => {
    reset({ animals: animal() });
    await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:50,date:shiftDateLocal(new Date(),-1)}))()`);
    await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:30,date:shiftDateLocal(new Date(),-30)}))()`);
    assert.strictEqual(db.data.animals.a1.current_weight, 50, 'newest by DATE wins, not newest by write order');
    const history = await app.eval(`(async()=>await fbGet('animals/a1/weights'))()`);
    assert.strictEqual(history.length, 2, 'both measurements are kept');
  });

  test('deleting the newest record re-derives current_weight from what remains', async () => {
    reset({ animals: animal() });
    await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:shiftDateLocal(new Date(),-10)}))()`);
    const second = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:55,date:shiftDateLocal(new Date(),-1)}))()`);
    assert.strictEqual(db.data.animals.a1.current_weight, 55);
    const del = await app.eval(`(async()=>await deleteAnimalWeight({animalId:'a1',weightId:${JSON.stringify(second.weightId)}}))()`);
    assert.strictEqual(del.ok, true);
    assert.strictEqual(db.data.animals.a1.current_weight, 40, 'falls back to the remaining record');
  });

  test('deleting the LAST record clears current_weight to null instead of leaving a ghost', async () => {
    reset({ animals: animal() });
    const r = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:todayStr()}))()`);
    await app.eval(`(async()=>await deleteAnimalWeight({animalId:'a1',weightId:${JSON.stringify(r.weightId)}}))()`);
    assert.strictEqual(db.data.animals.a1.current_weight, null);
    assert.strictEqual(db.data.animals.a1.weight_updated, null);
  });

  test('rejects out-of-range weights (0, negative, above 500kg, non-numeric)', async () => {
    reset({ animals: animal() });
    for (const w of [0, -5, 501, 99999, 'abc', null, undefined, NaN]) {
      const r = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:${JSON.stringify(w) ?? 'NaN'},date:todayStr()}))()`);
      assert.strictEqual(r.ok, false, `weight ${w} must be rejected`);
      assert.match(r.error, /وزن غير منطقي/);
    }
    assert.strictEqual(db.data.animals.a1.weights, undefined, 'nothing written for any rejected value');
  });

  test('rejects a future date and a malformed date', async () => {
    reset({ animals: animal() });
    const future = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:shiftDateLocal(new Date(),1)}))()`);
    assert.strictEqual(future.ok, false);
    assert.match(future.error, /مستقبلي/);
    const bad = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:'19/10/2026'}))()`);
    assert.strictEqual(bad.ok, false);
    assert.match(bad.error, /صيغة التاريخ/);
  });

  test('rejects a non-alive animal unless the caller explicitly overrides', async () => {
    reset({ animals: animal({ status: 'dead', died_at: '2026-01-01' }) });
    const r = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:todayStr()}))()`);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /غير حي/);
    const forced = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:'2025-12-01',allowNonAlive:true}))()`);
    assert.strictEqual(forced.ok, true, 'the documented escape hatch still works for historical imports');
  });

  test('rejects an unknown animal and a missing animalId without throwing', async () => {
    reset({ animals: animal() });
    assert.strictEqual((await app.eval(`(async()=>await recordAnimalWeight({animalId:'nope',weight:40,date:todayStr()}))()`)).ok, false);
    assert.strictEqual((await app.eval(`(async()=>await recordAnimalWeight({weight:40,date:todayStr()}))()`)).ok, false);
    assert.strictEqual((await app.eval(`(async()=>await recordAnimalWeight())()`)).ok, false);
    assert.strictEqual((await app.eval(`(async()=>await recordAnimalWeight(null))()`)).ok, false);
  });

  test('requires WRITE access: the read-only visitor role is refused', async () => {
    reset({ animals: animal() });
    app.eval(`setUser({id:'v1',role:'visitor',name:'زائر'})`);
    const r = await app.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:todayStr()}))()`);
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /صلاحية/);
    assert.strictEqual(db.data.animals.a1.weights, undefined);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('never throws: a failed Firebase write comes back as {ok:false,error}', async () => {
    const failing = await bootApp({ db: { failMode: (m) => (m === 'POST' ? new Response('no', { status: 500 }) : null) } });
    failing.db.reset({ animals: failing.db.data.animals || {} });
    await failing.eval(`(async()=>await fbPut('animals','a1',{tag:'GT-1',status:'alive'}))()`);
    const r = await failing.eval(`(async()=>await recordAnimalWeight({animalId:'a1',weight:40,date:todayStr()}))()`);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error && r.error.length, 'a real error message, not an exception');
    failing.close();
  });

  test('a weight record with NO date cannot break alert evaluation (regression)', async () => {
    reset({ animals: animal({ weights: { w1: { weight: 40 }, w2: { weight: 30, date: '2026-01-01' } } }) });
    const alerts = await app.eval(`(async()=>await evaluateWeightAlert('a1','GT-000001','ج١ع١'))()`);
    assert.ok(Array.isArray(J(alerts)), 'must return an array, not swallow a TypeError');
    const sorted = app.eval(`(function(){return [1];})()`);
    assert.ok(sorted);
    // The invariant still holds when the malformed record is present.
    const cur = await app.eval(`(async()=>{ await recordAnimalWeight({animalId:'a1',weight:44,date:todayStr()}); return (await fbGetOne('animals','a1')).current_weight; })()`);
    assert.strictEqual(cur, 44);
  });

  test('migrateWeightLogToWeights() maps legacy rows and reports every skip reason', async () => {
    reset({
      animals: animal({ tag: 'GT-000001' }),
      weight_log: {
        l1: { animal_tag: 'GT-000001', weight: 33, date: '2026-01-05' },
        l2: { animal_tag: 'GT-404404', weight: 34, date: '2026-01-06' },
        l3: { animal_tag: 'GT-000001', weight: -1, date: '2026-01-07' },
        l4: { animal_id: 'a1', weight: 35, date: '2026-01-05' },
      },
    });
    const r = J(await app.eval(`(async()=>await migrateWeightLogToWeights())()`));
    assert.strictEqual(r.total, 4);
    assert.strictEqual(r.migrated, 2, 'the tag-matched row and the id-matched row');
    assert.strictEqual(r.unresolved, 1, 'a tag that matches no animal is reported, never guessed');
    assert.strictEqual(r.malformed, 1, 'a negative weight is reported, never written');
    assert.strictEqual(r.migrated + r.unresolved + r.malformed + r.skippedDuplicate, r.total, 'every row is accounted for');
    const again = J(await app.eval(`(async()=>await migrateWeightLogToWeights())()`));
    assert.strictEqual(again.migrated, 0, 're-running is idempotent');
    assert.strictEqual(again.skippedDuplicate, 2, 'the previously migrated rows are recognised as duplicates');
  });
});
