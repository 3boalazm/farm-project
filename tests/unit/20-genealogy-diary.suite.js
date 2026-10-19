// Module 20 — Genealogy & herd data-integrity tools (renameTag, linkParents,
// repairGenealogy, checkGenealogyIntegrity) + the farm diary snapshots.
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('20 · Genealogy, integrity tools & diary', ({ test }) => {
  let app, db;
  const reset = (over = {}) => { db.reset(Object.assign({ users: db.data.users }, over)); app.eval(`fbCacheInvalidate()`); };

  test('boots', async () => { app = await bootApp(); db = app.db; });

  test('renameTag() keeps history, refuses a clash, and is a no-op for the same tag', async () => {
    reset({ animals: { a1: { tag: 'GT-000001', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' }, a2: { tag: 'GT-000002', species: 'goat', breed: 'بور', gender: 'male', status: 'alive' } } });
    const same = J(await app.eval(`(async()=>await renameTag({animalId:'a1',newTag:'GT-000001'}))()`));
    assert.strictEqual(same.unchanged, true);
    const clash = J(await app.eval(`(async()=>await renameTag({animalId:'a1',newTag:'GT-000002'}))()`));
    assert.strictEqual(clash.ok, false);
    assert.match(clash.error, /مستخدم بالفعل/);
    const ok = J(await app.eval(`(async()=>await renameTag({animalId:'a1',newTag:'GT-000009'}))()`));
    assert.strictEqual(ok.ok, true, JSON.stringify(ok));
    assert.strictEqual(db.data.animals.a1.tag, 'GT-000009');
    assert.deepStrictEqual(J(db.data.animals.a1.previous_tags), [{ tag: 'GT-000001', until: app.eval(`todayStr()`) }], 'the old tag stays searchable');
    assert.strictEqual(ok.oldTag, 'GT-000001');
  });

  test('REGRESSION: renaming a parent propagates to every child that referenced the old tag', async () => {
    // mother_tag/father_tag are documented as a cached projection of
    // mother_id/father_id. Before this fix a rename left every offspring
    // pointing at a tag that no longer existed — the pedigree showed a
    // phantom mother and repairGenealogy() could no longer resolve them.
    reset({
      animals: {
        m1: { tag: 'F-100', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' },
        f1: { tag: 'M-200', species: 'goat', breed: 'شامي', gender: 'male', status: 'alive' },
        c1: { tag: 'GT-1', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive', mother_id: 'm1', mother_tag: 'F-100', mother_breed: 'شامي', father_id: 'f1', father_tag: 'M-200' },
        c2: { tag: 'GT-2', species: 'goat', breed: 'شامي', gender: 'male', status: 'alive', mother_tag: 'F-100' },
        c3: { tag: 'GT-3', species: 'goat', breed: 'شامي', gender: 'male', status: 'alive', mother_tag: 'OTHER' },
      },
    });
    const r = J(await app.eval(`(async()=>await renameTag({animalId:'m1',newTag:'F-999'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    assert.strictEqual(r.propagated, 2, 'both children referencing the old tag were updated');
    assert.strictEqual(db.data.animals.c1.mother_tag, 'F-999');
    assert.strictEqual(db.data.animals.c2.mother_tag, 'F-999');
    assert.strictEqual(db.data.animals.c3.mother_tag, 'OTHER', 'an unrelated child is untouched');
    assert.strictEqual(db.data.animals.c1.mother_id, 'm1', 'the canonical ID link never changes');

    const fr = J(await app.eval(`(async()=>await renameTag({animalId:'f1',newTag:'M-888'}))()`));
    assert.strictEqual(fr.ok, true);
    assert.strictEqual(db.data.animals.c1.father_tag, 'M-888', 'father_tag is propagated too');
  });

  test('renameTag() validates its inputs and refuses the read-only role', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive' } } });
    assert.strictEqual((J(await app.eval(`(async()=>await renameTag({animalId:'a1'}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await renameTag({newTag:'X'}))()`))).ok, false);
    assert.strictEqual((J(await app.eval(`(async()=>await renameTag({animalId:'ghost',newTag:'X'}))()`))).ok, false);
    app.eval(`setUser({id:'v1',role:'visitor',name:'زائر'})`);
    const denied = J(await app.eval(`(async()=>await renameTag({animalId:'a1',newTag:'X'}))()`));
    assert.strictEqual(denied.ok, false);
    assert.match(denied.error, /صلاحية/);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('linkParents() writes the ID and keeps the tag/breed projection in sync', async () => {
    reset({
      animals: {
        m1: { tag: 'F-1', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' },
        f1: { tag: 'M-1', species: 'goat', breed: 'بور', gender: 'male', status: 'alive' },
        c1: { tag: 'GT-1', species: 'goat', breed: 'شامي', gender: 'female', status: 'alive' },
      },
    });
    const r = J(await app.eval(`(async()=>await linkParents({animalId:'c1',motherId:'m1',fatherId:'f1'}))()`));
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    const c = db.data.animals.c1;
    assert.strictEqual(c.mother_id, 'm1');
    assert.strictEqual(c.mother_tag, 'F-1', 'the projection follows the ID');
    assert.strictEqual(c.mother_breed, 'شامي');
    assert.strictEqual(c.father_id, 'f1');
    assert.strictEqual(c.father_tag, 'M-1');

    const ghost = J(await app.eval(`(async()=>await linkParents({animalId:'c1',motherId:'nope'}))()`));
    assert.strictEqual(ghost.ok, false, 'an unresolvable parent is refused, never half-written');
    assert.strictEqual(db.data.animals.c1.mother_id, 'm1');
    const nothing = J(await app.eval(`(async()=>await linkParents({animalId:'c1'}))()`));
    assert.strictEqual(nothing.ok, false, 'no fields → nothing to do');
    const unlink = J(await app.eval(`(async()=>await unlinkParents({animalId:'c1'}))()`));
    assert.strictEqual(unlink.ok, true);
    assert.strictEqual(db.data.animals.c1.mother_id, null);
    assert.strictEqual(db.data.animals.c1.mother_tag, null);
    assert.strictEqual(db.data.animals.c1.father_id, null);
  });

  test('repairGenealogy() backfills resolvable tags, and reports ambiguous/unresolved instead of guessing', async () => {
    reset({
      animals: {
        m1: { tag: 'F-1', species: 'goat', gender: 'female', status: 'alive' },
        dup1: { tag: 'DUP', species: 'goat', gender: 'female', status: 'alive' },
        dup2: { tag: 'DUP', species: 'goat', gender: 'female', status: 'alive' },
        c1: { tag: 'GT-1', species: 'goat', gender: 'female', status: 'alive', mother_tag: 'F-1' },
        c2: { tag: 'GT-2', species: 'goat', gender: 'female', status: 'alive', mother_tag: 'DUP' },
        c3: { tag: 'GT-3', species: 'goat', gender: 'female', status: 'alive', mother_tag: 'GONE' },
        c4: { tag: 'GT-4', species: 'goat', gender: 'female', status: 'alive', mother_id: 'm1', mother_tag: 'F-1' },
      },
    });
    const r = J(await app.eval(`(async()=>await repairGenealogy())()`));
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.repaired, 1, 'only the confidently resolvable child');
    assert.strictEqual(db.data.animals.c1.mother_id, 'm1');
    assert.strictEqual(r.ambiguous.length, 1, 'two animals share the tag DUP');
    assert.strictEqual(r.ambiguous[0].animalId, 'c2');
    assert.strictEqual(r.unresolved.length, 1);
    assert.strictEqual(r.unresolved[0].tag, 'GONE');
    assert.strictEqual(db.data.animals.c4.mother_id, 'm1', 'an already-linked child is left alone');
    const again = J(await app.eval(`(async()=>await repairGenealogy())()`));
    assert.strictEqual(again.repaired, 0, 'idempotent: re-running repairs nothing twice');
  });

  test('repairGenealogy() is admin-only', async () => {
    reset({ animals: {} });
    app.eval(`setUser({id:'s1',role:'supervisor',name:'مشرف'})`);
    assert.strictEqual((J(await app.eval(`(async()=>await repairGenealogy())()`))).ok, false);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('checkGenealogyIntegrity() is read-only and detects each defect class', async () => {
    reset({
      animals: {
        ok1: { tag: 'GT-1', species: 'goat', gender: 'female', status: 'alive', mother_id: 'm1', birth_date: '2026-01-01' },
        m1: { tag: 'F-1', species: 'goat', gender: 'female', status: 'alive' },
        selfp: { tag: 'GT-2', species: 'goat', gender: 'male', status: 'alive', mother_id: 'selfp' },
        dupp: { tag: 'GT-3', species: 'goat', gender: 'male', status: 'alive', mother_id: 'm1', father_id: 'm1' },
        ghost: { tag: 'GT-4', species: 'goat', gender: 'male', status: 'alive', mother_id: 'deleted-one' },
        cross: { tag: 'GT-5', species: 'sheep', gender: 'male', status: 'alive', mother_id: 'm1' },
        wrongGender: { tag: 'GT-6', species: 'goat', gender: 'male', status: 'alive', father_id: 'm1' },
        future: { tag: 'GT-7', species: 'goat', gender: 'male', status: 'alive', mother_id: 'm1', birth_date: '2999-01-01' },
        noparent: { tag: 'GT-8', species: 'goat', gender: 'male', status: 'alive' },
      },
    });
    const before = JSON.stringify(db.data);
    const r = J(await app.eval(`(async()=>await checkGenealogyIntegrity())()`));
    assert.strictEqual(JSON.stringify(db.data), before, 'the diagnostic must never modify data');
    assert.strictEqual(r.total, 9);
    assert.ok(r.self_parent.includes('selfp'));
    assert.ok(r.duplicate_parent.includes('dupp'));
    assert.ok(r.deleted_parent_reference.some((x) => x.animalId === 'ghost' && x.missingId === 'deleted-one'));
    assert.ok(r.cross_species_parent.some((x) => x.animalId === 'cross'));
    assert.ok(r.gender_mismatch.some((x) => x.animalId === 'wrongGender' && x.role === 'father'));
    assert.ok(r.future_birth_date.includes('future'));
    assert.ok(r.unknown_parent.includes('noparent'));
    assert.strictEqual(r.clean, false, 'a defective herd is not reported clean');
  });

  test('checkGenealogyIntegrity() detects a cycle and reports clean for a sound herd', async () => {
    reset({ animals: { a: { tag: 'A', gender: 'female', species: 'goat', status: 'alive', mother_id: 'b' }, b: { tag: 'B', gender: 'female', species: 'goat', status: 'alive', mother_id: 'a' } } });
    const cyc = J(await app.eval(`(async()=>await checkGenealogyIntegrity())()`));
    assert.ok(cyc.cycles.length >= 1, 'a two-generation cycle is caught: ' + JSON.stringify(cyc.cycles));

    reset({ animals: { m: { tag: 'M', gender: 'female', species: 'goat', status: 'alive' }, c: { tag: 'C', gender: 'male', species: 'goat', status: 'alive', mother_id: 'm', birth_date: '2026-01-01' } } });
    const clean = J(await app.eval(`(async()=>await checkGenealogyIntegrity())()`));
    assert.strictEqual(clean.clean, true, 'a sound herd reports clean: ' + JSON.stringify(clean));
  });

  test('findByTag()/findAnimal() resolve exactly one record and never throw on a miss', async () => {
    reset({ animals: { a1: { tag: 'GT-1', status: 'alive' }, a2: { tag: 'GT-2', status: 'alive' } } });
    assert.strictEqual((J(await app.eval(`(async()=>await findByTag('GT-2'))()`)))._id, 'a2');
    assert.strictEqual(await app.eval(`(async()=>await findByTag('NOPE'))()`), null);
    assert.strictEqual(await app.eval(`(async()=>await findByTag(null))()`), null);
    assert.strictEqual((J(await app.eval(`(async()=>await findAnimal('a1'))()`))).tag, 'GT-1');
    assert.strictEqual(await app.eval(`(async()=>await findAnimal('ghost'))()`), null);
  });

  test('saveDiarySnapshot() creates today’s entry and preserves the ORIGINAL created_at on re-save', async () => {
    reset({ diary_snapshots: {} });
    const first = J(await app.eval(`(async()=>await saveDiarySnapshot({goat_alive:100,sheep_alive:50}))()`));
    const key = app.eval(`todayStr()`);
    assert.strictEqual(db.data.diary_snapshots[key].goat_alive, 100);
    assert.strictEqual(first.date, key);
    assert.strictEqual(first.id, key);
    const createdAt = db.data.diary_snapshots[key].created_at;
    await new Promise((r) => setTimeout(r, 5));
    const second = J(await app.eval(`(async()=>await saveDiarySnapshot({goat_alive:101,sheep_alive:50,notes:'تصحيح'}))()`));
    assert.strictEqual(db.data.diary_snapshots[key].goat_alive, 101, 'the counts update');
    assert.strictEqual(db.data.diary_snapshots[key].created_at, createdAt, 'the original creation time survives a same-day correction');
    assert.notStrictEqual(db.data.diary_snapshots[key].updated_at, undefined);
    assert.strictEqual(second.notes, 'تصحيح');
    assert.strictEqual(Object.keys(db.data.diary_snapshots).length, 1, 'still one entry per day, not two');
  });

  test('getLatestDiarySnapshot()/getDiarySnapshotByDate()/between-dates read through Firebase queries', async () => {
    reset({
      diary_snapshots: {
        '2026-05-01': { id: '2026-05-01', date: '2026-05-01', goat_alive: 10 },
        '2026-05-02': { id: '2026-05-02', date: '2026-05-02', goat_alive: 11 },
        '2026-05-03': { id: '2026-05-03', date: '2026-05-03', goat_alive: 12 },
      },
    });
    const latest = J(await app.eval(`(async()=>await getLatestDiarySnapshot())()`));
    assert.strictEqual(latest._id, '2026-05-03', 'limitToLast(1) on $key returns the newest day');
    const one = J(await app.eval(`(async()=>await getDiarySnapshotByDate('2026-05-02'))()`));
    assert.strictEqual(one && one.goat_alive, 11);
    const range = J(await app.eval(`(async()=>await getDiarySnapshotsBetweenDates('2026-05-01','2026-05-02'))()`));
    assert.strictEqual(range.length, 2, 'the range is inclusive of both ends');
    assert.deepStrictEqual(range.map((r) => r._id), ['2026-05-01', '2026-05-02'], 'sorted by key');
    const none = J(await app.eval(`(async()=>await getDiarySnapshotsBetweenDates('2020-01-01','2020-01-02'))()`));
    assert.deepStrictEqual(none, []);
  });
});
