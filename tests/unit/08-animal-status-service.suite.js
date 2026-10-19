// Module 08 — Animal Lifecycle / Status Service (shared.js)
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('08 · Animal status service', ({ test }) => {
  let app, db;
  const reset = (over = {}) => {
    db.reset({
      users: db.data.users,
      animals: { a1: { tag: 'GT-000001', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive', barn: 'ج١ع١' },
                 a2: { tag: 'GT-000002', species: 'goat', breed: 'بور', gender: 'male', status: 'alive' } },
      ...over,
    });
    app.eval(`fbCacheInvalidate()`);
  };

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('markAnimalDead() records a real death with all evidence fields', async () => {
    reset();
    const r = J(await app.eval(`(async()=>await markAnimalDead({animalId:'a1',date:'2026-05-01',reason:'مرض',loss:5000}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const a = db.data.animals.a1;
    assert.strictEqual(a.status, 'dead');
    assert.strictEqual(a.died_at, '2026-05-01');
    assert.strictEqual(a.death_reason, 'مرض');
    assert.strictEqual(a.death_loss, 5000);
    assert.match(a.death_id, /^DTH-\d{8}-[A-Z0-9]+$/);
    assert.strictEqual(a.is_correction, undefined, 'a real death is never flagged as a correction');
  });

  test('markAnimalDead() requires a date', async () => {
    reset();
    const r = J(await app.eval(`(async()=>await markAnimalDead({animalId:'a1'}))()`));
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /تاريخ النفوق/);
    assert.strictEqual(db.data.animals.a1.status, 'alive');
  });

  test('dead is TERMINAL: no transition out of it except the explicit admin restore', async () => {
    reset();
    await app.eval(`(async()=>await markAnimalDead({animalId:'a1',date:'2026-05-01'}))()`);
    const sale = J(await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:1000}))()`));
    assert.strictEqual(sale.ok, false);
    assert.match(sale.error, /انتقال غير مسموح/);
    assert.strictEqual(db.data.animals.a1.status, 'dead', 'the illegal transition wrote nothing');
  });

  test('sold and removed are terminal too', async () => {
    reset();
    await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:1000}))()`);
    assert.strictEqual((await app.eval(`(async()=>await markAnimalDead({animalId:'a1',date:'2026-05-01'}))()`)).ok, false);
    assert.strictEqual((await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:2000}))()`)).ok, false);
  });

  test('restoreAnimal() is the deliberate override out of dead, and clears the death evidence', async () => {
    reset();
    await app.eval(`(async()=>await markAnimalDead({animalId:'a1',date:'2026-05-01',reason:'خطأ'}))()`);
    const r = J(await app.eval(`(async()=>await restoreAnimal({animalId:'a1'}))()`));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(db.data.animals.a1.status, 'alive');
    assert.strictEqual(db.data.animals.a1.died_at, null);
    assert.strictEqual(db.data.animals.a1.death_reason, null);
  });

  test('sellAnimal() writes the sale AND the matching finance income record', async () => {
    reset({ finance: {} });
    const r = J(await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:7500,buyer:'محمد',date:'2026-06-01'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(db.data.animals.a1.status, 'sold');
    assert.strictEqual(db.data.animals.a1.sold_price, 7500);
    assert.strictEqual(db.data.animals.a1.sold_to, 'محمد');
    const fin = Object.values(db.data.finance);
    assert.strictEqual(fin.length, 1, 'exactly one income record');
    assert.strictEqual(fin[0].type, 'income');
    assert.strictEqual(fin[0].amount, 7500);
    assert.strictEqual(fin[0].related_animal, 'a1');
  });

  test('sellAnimal(price:0) changes status without inventing a finance record', async () => {
    reset({ finance: {} });
    const r = J(await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:0}))()`));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(db.data.animals.a1.status, 'sold');
    assert.deepStrictEqual(J(Object.values(db.data.finance)), []);
  });

  test('sellAnimal() rejects a negative or missing price before touching anything', async () => {
    reset({ finance: {} });
    for (const p of [-1, null, undefined, 'abc']) {
      const r = J(await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:${p === undefined ? 'undefined' : JSON.stringify(p)}}))()`));
      assert.strictEqual(r.ok, false, `price ${p}`);
      assert.match(r.error, /سعر صحيح/);
    }
    assert.strictEqual(db.data.animals.a1.status, 'alive');
    assert.deepStrictEqual(J(Object.values(db.data.finance)), []);
  });

  test('sellAnimalsBulk(skipFinance:true) posts NO per-animal finance rows (the total-multiplication trap)', async () => {
    reset({ finance: {} });
    const r = J(await app.eval(`(async()=>await sellAnimalsBulk({animalIds:['a1','a2'],price:3000,skipFinance:true}))()`));
    assert.strictEqual(r.succeeded, 2);
    assert.strictEqual(r.failed, 0);
    assert.deepStrictEqual(J(Object.values(db.data.finance)), [], 'a bulk caller records ONE combined entry itself');
  });

  test('quarantine requires a reason, and release returns the animal to alive', async () => {
    reset();
    assert.strictEqual((J(await app.eval(`(async()=>await quarantineAnimal({animalId:'a1'}))()`))).ok, false);
    const q = J(await app.eval(`(async()=>await quarantineAnimal({animalId:'a1',reason:'اشتباه إصابة',date:'2026-04-01'}))()`));
    assert.strictEqual(q.ok, true);
    assert.strictEqual(db.data.animals.a1.status, 'quarantine');
    assert.strictEqual(db.data.animals.a1.quarantine_reason, 'اشتباه إصابة');
    const rel = J(await app.eval(`(async()=>await releaseAnimalFromQuarantine({animalId:'a1'}))()`));
    assert.strictEqual(rel.ok, true);
    assert.strictEqual(db.data.animals.a1.status, 'alive');
    assert.strictEqual(db.data.animals.a1.quarantine_end, app.eval(`todayStr()`));
  });

  test('a quarantined animal may die but may not be sold', async () => {
    reset();
    await app.eval(`(async()=>await quarantineAnimal({animalId:'a1',reason:'حجر'}))()`);
    assert.strictEqual((J(await app.eval(`(async()=>await sellAnimal({animalId:'a1',price:10}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await markAnimalDead({animalId:'a1',date:'2026-05-01'}))()`))).ok, true);
  });

  test('correctAnimalCount() writes status "removed", never "dead" (keeps mortality statistics honest)', async () => {
    reset();
    const r = J(await app.eval(`(async()=>await correctAnimalCount({animalId:'a1',source:'يومية المزرعة'}))()`));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(db.data.animals.a1.status, 'removed');
    assert.strictEqual(db.data.animals.a1.removed_reason, 'inventory_correction');
    assert.strictEqual(app.eval(`isRealDeath(${JSON.stringify(db.data.animals.a1)})`), false);
  });

  test('setAnimalPurpose() allows تربية↔تسمين freely but refuses an invalid target', async () => {
    reset();
    assert.strictEqual((J(await app.eval(`(async()=>await setAnimalPurpose({animalId:'a1',purpose:'tasmeen'}))()`))).ok, true);
    assert.strictEqual(db.data.animals.a1.purpose, 'tasmeen');
    assert.strictEqual((J(await app.eval(`(async()=>await setAnimalPurpose({animalId:'a1',purpose:'tarbiya'}))()`))).ok, true);
    assert.strictEqual((J(await app.eval(`(async()=>await setAnimalPurpose({animalId:'a1',purpose:'nonsense'}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await setAnimalPurpose({animalId:'a1',purpose:'birth'}))()`))).ok, false,
      'birth means "undecided", it is not a destination');
    assert.strictEqual(db.data.animals.a1.purpose, 'tarbiya');
  });

  test('markAnimalsDeadBulk() shares one batch id and splits the loss per head', async () => {
    reset({ animals: { a1: { tag: 'A', status: 'alive' }, a2: { tag: 'B', status: 'alive' }, a3: { tag: 'C', status: 'alive' }, a4: { tag: 'D', status: 'alive' } } });
    const r = J(await app.eval(`(async()=>await markAnimalsDeadBulk({animalIds:['a1','a2','a3','a4'],date:'2026-05-01',totalLoss:10000,reason:'وباء'}))()`));
    assert.strictEqual(r.succeeded, 4);
    const batchIds = new Set(['a1', 'a2', 'a3', 'a4'].map((id) => db.data.animals[id].death_batch_id));
    assert.strictEqual(batchIds.size, 1, 'one shared batch id');
    ['a1', 'a2', 'a3', 'a4'].forEach((id) => assert.strictEqual(db.data.animals[id].death_loss, 2500, 'loss split evenly'));
  });

  test('every status operation refuses the read-only visitor role', async () => {
    reset();
    app.eval(`setUser({id:'v1',role:'visitor',name:'زائر'})`);
    for (const call of [
      `markAnimalDead({animalId:'a1',date:'2026-05-01'})`,
      `sellAnimal({animalId:'a1',price:100})`,
      `quarantineAnimal({animalId:'a1',reason:'x'})`,
      `correctAnimalCount({animalId:'a1'})`,
      `restoreAnimal({animalId:'a1'})`,
      `setAnimalPurpose({animalId:'a1',purpose:'tasmeen'})`,
    ]) {
      const r = J(await app.eval(`(async()=>await ${call})()`));
      assert.strictEqual(r.ok, false, call);
      assert.match(r.error, /صلاحية/);
    }
    assert.strictEqual(db.data.animals.a1.status, 'alive', 'nothing was written');
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('a worker (a real data-entry role) CAN record a death', async () => {
    reset();
    app.eval(`setUser({id:'w1',role:'worker',name:'عامل'})`);
    const r = J(await app.eval(`(async()=>await markAnimalDead({animalId:'a1',date:'2026-05-01'}))()`));
    assert.strictEqual(r.ok, true, 'canWrite() must not block legitimate operational roles');
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('an unknown animal id is a structured error, never a throw', async () => {
    reset();
    const r = J(await app.eval(`(async()=>await markAnimalDead({animalId:'ghost',date:'2026-05-01'}))()`));
    assert.strictEqual(r.ok, false);
    assert.match(r.error, /غير موجود/);
  });

  test('statusBadge()/getAnimalStatus() derive under_treatment from an ACTIVE health record only', () => {
    const today = app.eval(`todayStr()`);
    const animal = { tag: 'GT-1', status: 'alive' };
    assert.strictEqual(app.eval(`getAnimalStatus(${JSON.stringify(animal)}, [])`), 'healthy');
    const active = [{ animal_tag: 'GT-1', status: 'active', withdrawal_end: app.eval(`shiftDateLocal(new Date(),5)`) }];
    assert.strictEqual(app.eval(`getAnimalStatus(${JSON.stringify(animal)}, ${JSON.stringify(active)})`), 'under_treatment');
    const cured = [{ animal_tag: 'GT-1', status: 'cured' }];
    assert.strictEqual(app.eval(`getAnimalStatus(${JSON.stringify(animal)}, ${JSON.stringify(cured)})`), 'healthy');
    const other = [{ animal_tag: 'GT-999', status: 'active' }];
    assert.strictEqual(app.eval(`getAnimalStatus(${JSON.stringify(animal)}, ${JSON.stringify(other)})`), 'healthy');
    assert.strictEqual(app.eval(`getAnimalStatus({status:'dead'}, [])`), 'dead', 'terminal statuses are never overridden');
    assert.strictEqual(app.eval(`statusBadge('dead')`).includes('نافق'), true);
    assert.ok(today);
  });
});
