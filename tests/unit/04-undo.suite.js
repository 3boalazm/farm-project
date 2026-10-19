// Module 04 — Undo history (firebase.js) — regression cover for the
// dead-feature bug found by the 2026-10 audit: _pushUndo() was never
// called from anywhere, so the sidebar "تراجع" button could never undo.
const { bootApp, suite, assert, J } = require('./harness');

// The undo stack lives in sessionStorage, which survives across tests in
// one booted app — every stack assertion starts from a known-empty stack.
const resetStack = (app) => app.eval(`sessionStorage.removeItem('_farm_undo_stack')`);

module.exports = suite('04 · Undo history', ({ test }) => {
  let app, db;

  test('boots with the rail panel markup the undo button lives in', async () => {
    app = await bootApp();
    db = app.db;
    app.eval(`document.body.innerHTML='<button id="undo-btn"></button><div id="content"></div>'`);
    app.eval(`window.__toasts=[];window.toast=function(m,t){window.__toasts.push([m,t]);};`);
  });

  test('undoLast() with an empty stack reports "nothing to undo" and writes nothing', async () => {
    app.eval(`sessionStorage.removeItem('_farm_undo_stack')`);
    db.reset({ animals: { a1: { tag: 'GT-1' } } });
    db.log.length = 0;
    await app.eval(`(async()=>await undoLast())()`);
    assert.ok(app.eval(`window.__toasts`).some((t) => /لا توجد عمليات/.test(t[0])));
    assert.deepStrictEqual(db.log.filter((c) => c.method !== 'GET'), []);
  });

  test('fbPost() pushes an undo entry, and undoLast() deletes the created record', async () => {
    resetStack(app);
    db.reset({ animals: {} });
    const id = await app.eval(`(async()=>await fbPost('animals',{tag:'GT-9',species:'goat',breed:'شامي',gender:'female'}))()`);
    const stack = app.eval(`_getUndoStack()`);
    assert.strictEqual(stack.length, 1, 'a create must be undoable');
    assert.strictEqual(stack[0].type, 'post');
    assert.strictEqual(stack[0].id, id);
    await app.eval(`(async()=>await undoLast())()`);
    assert.strictEqual(db.data.animals[id], undefined, 'undo of a create must delete it');
    assert.deepStrictEqual(J(app.eval(`_getUndoStack()`)), []);
  });

  test('fbPatch() captures ONLY the overwritten keys, and undo restores them exactly', async () => {
    resetStack(app);
    db.reset({ animals: { a1: { tag: 'GT-1', breed: 'شامي', status: 'alive', barn: 'ج١ع١' } } });
    await app.eval(`(async()=>await fbPatch('animals','a1',{status:'sold',sold_price:5000}))()`);
    assert.strictEqual(db.data.animals.a1.status, 'sold');
    const stack = app.eval(`_getUndoStack()`);
    assert.deepStrictEqual(J(Object.keys(stack[stack.length - 1].prev)).sort(), ['sold_price', 'status'],
      'the pre-image must cover exactly the patched keys, nothing more');
    await app.eval(`(async()=>await undoLast())()`);
    assert.strictEqual(db.data.animals.a1.status, 'alive', 'the old value is restored');
    assert.strictEqual(db.data.animals.a1.barn, 'ج١ع١', 'untouched fields are never rewritten');
    assert.strictEqual(db.data.animals.a1.sold_price, null, 'a key that did not exist is removed again (null)');
  });

  test('fbDelete() captures the deleted record and undo restores it under the SAME id', async () => {
    resetStack(app);
    db.reset({ animals: { a1: { tag: 'GT-1', breed: 'شامي', status: 'alive' } } });
    await app.eval(`(async()=>await fbDelete('animals','a1'))()`);
    assert.strictEqual(db.data.animals.a1, undefined);
    await app.eval(`(async()=>await undoLast())()`);
    assert.ok(db.data.animals.a1, 'the record must come back');
    assert.strictEqual(db.data.animals.a1.tag, 'GT-1');
    assert.strictEqual(db.data.animals.a1.breed, 'شامي');
  });

  test('the stack is capped at 5, oldest first out', async () => {
    resetStack(app);
    db.reset({ animals: {} });
    for (let i = 0; i < 8; i++) {
      await app.eval(`(async()=>await fbPost('animals',{tag:'GT-${i}'}))()`);
    }
    const stack = app.eval(`_getUndoStack()`);
    assert.strictEqual(stack.length, 5);
    assert.strictEqual(stack[4].type, 'post');
  });

  test('machine-written collections are NEVER undoable (they would displace a real user action)', async () => {
    resetStack(app);
    db.reset({});
    for (const t of ['activity_log', 'notifications', 'weight_alerts', 'production_alerts',
      'workflow_history', 'inventory_transactions', 'financial_audit_log', 'login_notifications']) {
      await app.eval(`(async()=>await fbPost(${JSON.stringify(t)},{title:'x'}))()`);
    }
    assert.deepStrictEqual(J(app.eval(`_getUndoStack()`)), [], 'no background write may enter the undo stack');
  });

  test('accounting records are excluded: journal_entries/source_documents are immutable by design', async () => {
    resetStack(app);
    db.reset({});
    await app.eval(`(async()=>await fbPost('journal_entries',{status:'POSTED'}))()`);
    await app.eval(`(async()=>await fbPost('source_documents',{status:'POSTED'}))()`);
    assert.deepStrictEqual(J(app.eval(`_getUndoStack()`)), [],
      'undo must never attempt to reverse a posted entry — corrections go through reverseJournalEntry()');
  });

  test('auto-generated tasks are excluded, human tasks are not', async () => {
    resetStack(app);
    db.reset({});
    await app.eval(`(async()=>await fbPost('daily_tasks',{title:'auto',auto_generated:true}))()`);
    assert.strictEqual(app.eval(`_getUndoStack().length`), 0);
    await app.eval(`(async()=>await fbPost('daily_tasks',{title:'manual'}))()`);
    assert.strictEqual(app.eval(`_getUndoStack().length`), 1);
  });

  test('offline-sync replays are excluded (they are re-applying, not new intent)', async () => {
    resetStack(app);
    db.reset({});
    await app.eval(`(async()=>await fbPost('animals',{tag:'GT-1',synced_at:'2026-01-01T00:00:00Z'}))()`);
    assert.strictEqual(app.eval(`_getUndoStack().length`), 0);
  });

  test('the undo button reflects the stack depth and stops polling when absent', async () => {
    db.reset({ animals: {} });
    app.eval(`document.body.innerHTML='<button id="undo-btn"></button>'`);
    await app.eval(`(async()=>await fbPost('animals',{tag:'GT-1'}))()`);
    const label = app.window.document.getElementById('undo-btn');
    assert.ok(label, 'button exists');
    assert.strictEqual(label.style.opacity, '1', 'enabled once an operation is undoable');
    assert.match(label.title, /تراجع عن آخر إضافة في animals/);
    // No button on the page → the refresher must give up, not poll forever.
    app.eval(`document.body.innerHTML=''`);
    app.eval(`_undoBtnRetries=0`);
    app.eval(`_updateUndoBtn()`);
    await new Promise((r) => setTimeout(r, 120));
    assert.ok(app.eval(`_undoBtnRetries`) <= 7, 'bounded retries, not an infinite 500ms timer');
  });
});
