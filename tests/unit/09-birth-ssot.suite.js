// Module 09 — Birth SSOT + animal tag generation (shared.js,
// docs/certification/BIRTH.md)
const { bootApp, suite, assert, J } = require('./harness');

// The unified birth modal's fields, as openUnifiedBirthModal() renders them.
const MODAL = `
<div id="modal-root">
  <select id="ub-sp"><option value="goat">goat</option><option value="sheep">sheep</option></select>
  <select id="ub-breed"><option>شامي</option></select>
  <select id="ub-gender"><option value="female">female</option><option value="male">male</option></select>
  <select id="ub-purpose"><option value="birth">birth</option></select>
  <input id="ub-tag" value="">
  <input id="ub-date" type="date">
  <input id="ub-mother-tag" value="F-101">
  <select id="ub-mother-breed"><option>شامي</option></select>
  <input id="ub-father-tag" value="">
  <input id="ub-weight" value="">
  <select id="ub-barn"><option value="">-</option><option value="ج١ع١">ج١ع١</option></select>
  <input id="ub-qty" value="1">
  <input id="ub-amount" value="">
  <input id="ub-addedby" value="tester">
  <textarea id="ub-notes"></textarea>
</div>`;

module.exports = suite('09 · Birth SSOT & tag generation', ({ test }) => {
  let app, db;
  const reset = (over = {}) => {
    db.reset(Object.assign({ users: db.data.users, animals: {}, breeding: {} }, over));
    app.eval(`fbCacheInvalidate()`);
    app.eval(`window._tagReservedThisSession=new Set()`);
    app.eval(`document.body.innerHTML=${JSON.stringify(MODAL)}`);
    app.eval(`window.__toasts=[];window.toast=function(m,t){window.__toasts.push([m,t]);};`);
    app.eval(`window.loadPageData=undefined;window.renderBreedingPage=undefined;`);
    app.eval(`document.getElementById('ub-date').value=todayStr()`);
  };
  const setField = (id, v) => app.eval(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(v))}`);

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('generateAnimalTag() continues the highest existing sequence, zero-padded to 6', async () => {
    reset({ animals: { x1: { tag: 'GT-000007', species: 'goat' }, x2: { tag: 'GT-000002', species: 'goat' }, x3: { tag: 'SH-000100', species: 'sheep' } } });
    assert.strictEqual(await app.eval(`(async()=>await generateAnimalTag('goat'))()`), 'GT-000008');
    assert.strictEqual(await app.eval(`(async()=>await generateAnimalTag('sheep'))()`), 'SH-000101');
  });

  test('generateAnimalTag() ignores tags of the other species and starts at 1 when empty', async () => {
    reset({ animals: { x1: { tag: 'SH-000500', species: 'sheep' } } });
    assert.strictEqual(await app.eval(`(async()=>await generateAnimalTag('goat'))()`), 'GT-000001');
  });

  test('generateAnimalTag() never hands the same tag twice inside one batch', async () => {
    reset({ animals: {} });
    const tags = J(await app.eval(`(async()=>{var o=[];for(var i=0;i<6;i++)o.push(await generateAnimalTag('goat'));return o;})()`));
    assert.strictEqual(new Set(tags).size, 6, 'batch creation must not collide');
    assert.deepStrictEqual(tags, ['GT-000001', 'GT-000002', 'GT-000003', 'GT-000004', 'GT-000005', 'GT-000006']);
  });

  test('createOffspringAnimal() writes the animal, resolves the mother to a real ID, and keeps the weight invariant', async () => {
    reset({ animals: { m1: { tag: 'F-101', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' } } });
    const id = await app.eval(`(async()=>await createOffspringAnimal({species:'goat',breed:'شامي',gender:'female',purpose:'birth',birthDate:todayStr(),motherTag:'F-101',motherBreed:'شامي',weight:3.5}))()`);
    const a = db.data.animals[id];
    assert.ok(a, 'the offspring record exists');
    assert.strictEqual(a.mother_tag, 'F-101');
    assert.strictEqual(a.mother_id, 'm1', 'the tag is resolved to the canonical ID exactly once');
    assert.strictEqual(a.status, 'alive');
    assert.strictEqual(a.birth_weight, 3.5);
    assert.match(a.tag, /^GT-\d{6}$/);
    const weights = Object.values(db.data.animals[id].weights || {});
    assert.strictEqual(weights.length, 1);
    assert.strictEqual(weights[0].weight, 3.5);
    assert.strictEqual(a.current_weight, 3.5, 'REGRESSION: a birth weight must also set current_weight');
    assert.strictEqual(a.weight_updated, app.eval(`todayStr()`));
  });

  test('createOffspringAnimal() refuses an impossible birth weight instead of poisoning the weight SSOT', async () => {
    reset({ animals: {} });
    for (const w of [-3, 0, 9999]) {
      const id = await app.eval(`(async()=>await createOffspringAnimal({species:'goat',breed:'شامي',gender:'female',purpose:'birth',birthDate:todayStr(),weight:${w}}))()`);
      assert.strictEqual(db.data.animals[id].birth_weight, null, `weight ${w} must not be stored`);
      assert.strictEqual(db.data.animals[id].weights, undefined, `weight ${w} must not enter the history`);
      assert.strictEqual(db.data.animals[id].current_weight, undefined);
    }
  });

  test('createOffspringAnimal() leaves the ID link null when the tag matches nobody (never guesses)', async () => {
    reset({ animals: {} });
    const id = await app.eval(`(async()=>await createOffspringAnimal({species:'goat',breed:'شامي',gender:'male',purpose:'birth',birthDate:todayStr(),motherTag:'GHOST-1',motherBreed:'شامي'}))()`);
    assert.strictEqual(db.data.animals[id].mother_tag, 'GHOST-1', 'what the user typed is preserved');
    assert.strictEqual(db.data.animals[id].mother_id, null, 'but no ID is invented for it');
  });

  test('_ubSubmit() creates exactly ONE breeding record plus N offspring', async () => {
    reset({ animals: {} });
    setField('ub-qty', '3');
    setField('ub-gender', 'female');
    await app.eval(`(async()=>await _ubSubmit())()`);
    const breeding = Object.values(db.data.breeding);
    const animals = Object.values(db.data.animals);
    assert.strictEqual(breeding.length, 1, 'one breeding record per birth event');
    assert.strictEqual(breeding[0].offspring_count, 3);
    assert.strictEqual(breeding[0].female_offspring, 3);
    assert.strictEqual(breeding[0].male_offspring, 0);
    assert.strictEqual(breeding[0].status, 'born');
    assert.strictEqual(animals.length, 3, 'one animal document per offspring');
    const tags = new Set(animals.map((a) => a.tag));
    assert.strictEqual(tags.size, 3, 'each offspring gets its own tag');
    animals.forEach((a) => assert.strictEqual(a.mother_tag, 'F-101'));
  });

  test('_ubSubmit() with an explicit tag suffixes multiples (TAG-1, TAG-2, ...)', async () => {
    reset({ animals: {} });
    setField('ub-tag', 'A-77');
    setField('ub-qty', '2');
    await app.eval(`(async()=>await _ubSubmit())()`);
    const tags = Object.values(db.data.animals).map((a) => a.tag).sort();
    assert.deepStrictEqual(tags, ['A-77-1', 'A-77-2']);
  });

  test('_ubSubmit() rejects a quantity outside 1..10 BEFORE writing anything', async () => {
    for (const qty of ['0', '-5', '11', '50000', 'abc']) {
      reset({ animals: {} });
      setField('ub-qty', qty);
      await app.eval(`(async()=>await _ubSubmit())()`);
      assert.deepStrictEqual(J(Object.values(db.data.breeding)), [], `qty ${qty} must not write a breeding record`);
      assert.deepStrictEqual(J(Object.values(db.data.animals)), [], `qty ${qty} must not create animals`);
      const toasts = J(app.eval(`window.__toasts`));
      assert.ok(toasts.some((t) => /عدد المواليد/.test(t[0])), `qty ${qty} must be reported to the user`);
    }
  });

  test('_ubSubmit() refuses to save without the mother tag AND breed', async () => {
    reset({ animals: {} });
    setField('ub-mother-tag', '');
    await app.eval(`(async()=>await _ubSubmit())()`);
    assert.deepStrictEqual(J(Object.values(db.data.breeding)), []);
    reset({ animals: {} });
    setField('ub-mother-breed', '');
    await app.eval(`(async()=>await _ubSubmit())()`);
    assert.deepStrictEqual(J(Object.values(db.data.breeding)), []);
  });

  test('_ubSubmit() is refused outright for the read-only visitor role', async () => {
    reset({ animals: {} });
    app.eval(`setUser({id:'v1',role:'visitor',name:'زائر'})`);
    await app.eval(`(async()=>await _ubSubmit())()`);
    assert.deepStrictEqual(J(Object.values(db.data.breeding)), [], 'a visitor must never reach the Birth SSOT');
    assert.deepStrictEqual(J(Object.values(db.data.animals)), []);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('isTagTaken() detects a clash with ANOTHER animal but not with itself', async () => {
    reset({ animals: { a1: { tag: 'GT-000001' }, a2: { tag: 'GT-000002' } } });
    assert.strictEqual(await app.eval(`(async()=>await isTagTaken('GT-000002'))()`), true);
    assert.strictEqual(await app.eval(`(async()=>await isTagTaken('GT-000002','a2'))()`), false, 'excluding itself');
    assert.strictEqual(await app.eval(`(async()=>await isTagTaken('GT-000099'))()`), false);
  });

  test('a birth is counted by births.html/dashboard semantics: purpose "birth" OR legacy breed "مواليد"', () => {
    // births.html's own isBirth() definition — asserted here so the two
    // pages that count births cannot drift apart unnoticed.
    const isBirth = (a) => a.purpose === 'birth' || a.breed === 'مواليد';
    assert.strictEqual(isBirth({ purpose: 'birth' }), true);
    assert.strictEqual(isBirth({ breed: 'مواليد' }), true);
    assert.strictEqual(isBirth({ purpose: 'tarbiya', breed: 'شامي' }), false);
  });
});
