// Module 17 — Notifications: the shared bell badge/dropdown/popup
// (shared.js) and the standalone notification service (notifications-service.js).
const { bootApp, suite, assert, J } = require('./harness');

module.exports = suite('17 · Notifications', ({ test }) => {
  let app, db;
  const reset = (over = {}) => { db.reset(Object.assign({ users: db.data.users, notifications: {} }, over)); app.eval(`fbCacheInvalidate()`); };

  test('boots WITH the notification service loaded', async () => {
    app = await bootApp({ files: ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'notifications-service.js'] });
    db = app.db;
    assert.strictEqual(app.eval(`typeof NS`), 'object', 'notifications-service.js defines NS');
    app.eval(`window.__toasts=[];window.toast=function(m,t){window.__toasts.push([m,t]);};`);
  });

  test('getUnreadNotificationCount() counts only unread notifications for THIS role', async () => {
    reset({
      notifications: {
        n1: { title: 'a', read: false },
        n2: { title: 'b', read: true },
        n3: { title: 'c', read: false, for_role: 'vet' },
        n4: { title: 'd', read: false, for_role: 'admin' },
      },
    });
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
    assert.strictEqual(await app.eval(`(async()=>await getUnreadNotificationCount())()`), 3, 'admin sees everything unread');
    app.eval(`setUser({id:'v1',role:'vet',name:'طبيب'})`);
    assert.strictEqual(await app.eval(`(async()=>await getUnreadNotificationCount())()`), 2, 'a vet sees untargeted + own-role, not the admin one');
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('updateGlobalBellBadge() renders 1..9, then "9+", and hides at zero', async () => {
    app.eval(`document.body.innerHTML='<span id="bell-badge" style="display:none"></span><span id="railTreeBellBadge" style="display:none"></span>'`);
    const setUnread = (n) => {
      const notifications = {};
      for (let i = 0; i < n; i++) notifications['n' + i] = { title: 'x' + i, read: false };
      reset({ notifications });
    };
    setUnread(0);
    await app.eval(`(async()=>await updateGlobalBellBadge())()`);
    assert.strictEqual(app.window.document.getElementById('bell-badge').style.display, 'none');
    setUnread(4);
    await app.eval(`(async()=>await updateGlobalBellBadge())()`);
    const badge = app.window.document.getElementById('bell-badge');
    assert.strictEqual(badge.textContent, '4');
    assert.strictEqual(badge.style.display, 'flex');
    setUnread(12);
    await app.eval(`(async()=>await updateGlobalBellBadge())()`);
    assert.strictEqual(app.window.document.getElementById('bell-badge').textContent, '9+', 'the badge never grows past 9+');
  });

  test('updateGlobalBellBadge() is safe with no badge element and no session', async () => {
    app.eval(`document.body.innerHTML=''`);
    await app.eval(`(async()=>await updateGlobalBellBadge())()`);
    app.window.localStorage.removeItem('farm_user');
    await app.eval(`(async()=>await updateGlobalBellBadge())()`);
    assert.strictEqual(await app.eval(`(async()=>await getUnreadNotificationCount())()`), 0);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('NS.save() writes once per id and de-duplicates via the persisted sent-set', async () => {
    reset();
    app.eval(`localStorage.removeItem('_sentNotifIds');NS._sentIds=new Set()`);
    await app.eval(`(async()=>await NS.save({type:'warning',cat:'تجربة',title:'عنوان',msg:'نص',id:'fixed-id-1',date:todayStr()}))()`);
    assert.strictEqual(J(db.collection('notifications')).length, 1);
    await app.eval(`(async()=>await NS.save({type:'warning',cat:'تجربة',title:'عنوان',msg:'نص',id:'fixed-id-1',date:todayStr()}))()`);
    assert.strictEqual(J(db.collection('notifications')).length, 1, 'the same notification is never stored twice');
    const persisted = JSON.parse(app.window.localStorage.getItem('_sentNotifIds'));
    assert.ok(persisted.includes('fixed-id-1'), 'the de-dup set survives a page reload');
    await app.eval(`(async()=>await NS.save({type:'info',cat:'تجربة',title:'آخر',msg:'نص',id:'fixed-id-2',date:todayStr()}))()`);
    assert.strictEqual(J(db.collection('notifications')).length, 2);
  });

  test('NS.save() generates a stable id when the caller omits one', async () => {
    reset();
    app.eval(`localStorage.removeItem('_sentNotifIds');NS._sentIds=new Set()`);
    await app.eval(`(async()=>await NS.save({type:'info',title:'بلا معرف',date:todayStr()}))()`);
    const n = J(db.collection('notifications'))[0];
    assert.ok(n.id && n.id.length, 'an id was derived');
    assert.strictEqual(n.id, ('info-بلا معرف-' + app.eval(`todayStr()`)).replace(/\s/g, ''), 'deterministic from type+title+date');
  });

  test('NS.push() does not throw in a browser with no Notification API (the APK WebView case)', () => {
    // Regression: reading Notification.permission without a feature check
    // threw a ReferenceError and aborted the whole calling check.
    delete app.window.Notification;
    assert.strictEqual(app.eval(`typeof Notification`), 'undefined');
    app.eval(`NS.push('عنوان','نص','🐐','tag','dashboard.html','info')`); // must not throw
    assert.ok(true);
  });

  test('NS.playAlert() honours the sound setting and never throws without Web Audio', () => {
    app.window.localStorage.setItem('farm_notif_sound', 'off');
    app.eval(`NS._audioCtx=null`);
    app.eval(`NS.playAlert('danger')`);
    app.window.localStorage.removeItem('farm_notif_sound');
    app.eval(`NS.playAlert('info')`);
    assert.ok(true, 'both paths are silent and safe in a DOM with no AudioContext');
  });

  test('NS.checkWeather() walks the documented severity ladder, warns on humidity, and throttles once per day', async () => {
    // Regression cover for TWO bugs. (1) The duplicate-key bug fixed in the
    //     previous pass: the object literal defined checkWeather twice, so the
    //     richer implementation was dead code. (2) O-16, closed in this pass:
    //     the behaviours that died with that dead twin — the 40/35/5/12 °C
    //     ladder, the humidity>85 respiratory warning, the once-per-day
    //     throttle and the daily all-clear — are restored and pinned here, so
    //     they cannot silently go missing a second time.
    reset();
    app.eval(`localStorage.removeItem('_sentNotifIds');localStorage.removeItem('_lastWeatherAlert');NS._sentIds=new Set();NS._lastWeatherTemp=null`);
    const at = async (temp, humidity = 40) => {
      db.data.notifications = {};
      // Reset the sudden-change memory AND the daily throttle, so each band is
      // measured on its own instead of also triggering the ≥8° swing detector
      // or being suppressed by an earlier call on the same day.
      app.eval(`NS._sentIds=new Set();NS._lastWeatherTemp=null;localStorage.removeItem('_lastWeatherAlert')`);
      app.eval(`window.getWeather=async()=>({main:{temp:${temp},humidity:${humidity}},weather:[{description:'x'}]})`);
      await app.eval(`(async()=>await NS.checkWeather())()`);
      // NS.save() is deliberately not awaited inside checkWeather() (a
      // notification must never block the check), so let the write land
      // before asserting on the collection.
      await new Promise((r) => setTimeout(r, 40));
      return J(db.collection('notifications'));
    };
    let notes = await at(42);
    assert.strictEqual(notes.length, 1, 'extreme heat notifies');
    assert.strictEqual(notes[0].type, 'danger');
    assert.match(notes[0].title, /إجهاد حراري شديد/);
    assert.match(notes[0].title, /[٠-٩]/, 'the temperature is Arabic-Indic in the title');

    notes = await at(36);
    assert.strictEqual(notes.length, 1, 'a 36 °C afternoon is a warning, not silence (O-16)');
    assert.strictEqual(notes[0].type, 'warning');
    assert.match(notes[0].title, /إجهاد حراري/);

    notes = await at(30);
    assert.strictEqual(notes.length, 1, 'mild weather now says so, instead of looking like the check never ran');
    assert.strictEqual(notes[0].type, 'info');
    assert.match(notes[0].title, /الطقس مناسب/);

    notes = await at(4);
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0].type, 'danger', '≤5 °C is the danger band, ≤12 °C the warning band');
    assert.match(notes[0].title, /برد شديد/);

    notes = await at(10);
    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0].type, 'warning');
    assert.match(notes[0].title, /برودة/);

    notes = await at(22, 92);
    assert.strictEqual(notes.length, 1, 'humidity above 85% is its own respiratory warning');
    assert.match(notes[0].title, /رطوبة عالية/);
    assert.strictEqual(notes[0].href, 'health.html', 'and it links to the health register');

    // The same temperature twice on one day → one notification (id is
    // date+temp scoped), which is what keeps this from spamming every 15 min.
    db.data.notifications = {};
    app.eval(`NS._sentIds=new Set();NS._lastWeatherTemp=null;localStorage.removeItem('_lastWeatherAlert')`);
    app.eval(`window.getWeather=async()=>({main:{temp:42,humidity:40}})`);
    await app.eval(`(async()=>await NS.checkWeather())()`);
    await new Promise((r) => setTimeout(r, 40));
    // Second poll in the SAME session: _sentIds is what stops the 15-minute
    // timer from re-notifying, so it must not be cleared here.
    await app.eval(`(async()=>await NS.checkWeather())()`);
    await new Promise((r) => setTimeout(r, 40));
    assert.strictEqual(J(db.collection('notifications')).length, 1,
      'the once-per-day throttle stops the 15-minute poller re-notifying the same heat');

    // A sudden swing of ≥8 °C is its own, deliberately separate alert.
    app.eval(`NS._lastWeatherTemp=30;localStorage.removeItem('_lastWeatherAlert')`);
    app.eval(`window.getWeather=async()=>({main:{temp:20,humidity:40}})`);
    db.data.notifications = {};
    app.eval(`NS._sentIds=new Set()`);
    await app.eval(`(async()=>await NS.checkWeather())()`);
    await new Promise((r) => setTimeout(r, 40));
    const swing = J(db.collection('notifications'));
    assert.ok(swing.some((n) => /تغير مفاجئ/.test(n.title)), 'a ≥8° swing is reported: ' + JSON.stringify(swing));
  });

  test('the weather implementation exists exactly ONCE (no duplicate object key can shadow it again)', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'notifications-service.js'), 'utf8');
    const defs = src.match(/^\s{2}(?:async\s+)?checkWeather\s*\(/gm) || [];
    assert.strictEqual(defs.length, 1, `checkWeather is defined ${defs.length} times — a duplicate key silently kills the first`);
  });

  test('NS.checkWeather() survives a failing weather API without notifying anything', async () => {
    reset();
    app.eval(`localStorage.removeItem('_lastWeatherAlert');NS._sentIds=new Set()`);
    app.eval(`window.getWeather=async()=>null`);
    await app.eval(`(async()=>await NS.checkWeather())()`);
    assert.deepStrictEqual(J(db.collection('notifications')), []);
    app.eval(`window.getWeather=async()=>{throw new Error('network')}`);
    await app.eval(`(async()=>await NS.checkWeather())()`);
    assert.deepStrictEqual(J(db.collection('notifications')), [], 'a throw is caught inside the service');
  });

  test('NS.expireOld() deletes only READ notifications older than the cutoff', async () => {
    const old = app.eval(`shiftDateLocal(new Date(),-(NS.EXPIRE_DAYS+5))`);
    const recent = app.eval(`todayStr()`);
    reset({
      notifications: {
        n1: { title: 'old read', read: true, date: old },
        n2: { title: 'old unread', read: false, date: old },
        n3: { title: 'new read', read: true, date: recent },
        n4: { title: 'no date', read: true },
      },
    });
    const n = await app.eval(`(async()=>await NS.expireOld())()`);
    assert.strictEqual(n, 1, 'exactly one expired');
    const left = J(db.collection('notifications')).map((x) => x.title).sort();
    assert.deepStrictEqual(left, ['new read', 'no date', 'old unread'], 'an unread notification is NEVER auto-expired');
  });

  test('NS.markAllRead() clears every unread flag and refreshes the badge', async () => {
    reset({ notifications: { n1: { title: 'a' }, n2: { title: 'b' }, n3: { title: 'c', read: true } } });
    app.eval(`document.body.innerHTML='<span id="bell-badge"></span>'`);
    await app.eval(`(async()=>await NS.markAllRead())()`);
    const all = J(db.collection('notifications'));
    assert.ok(all.every((x) => x.read === true), 'every notification is read');
    assert.strictEqual(await app.eval(`(async()=>await getUnreadNotificationCount())()`), 0);
  });

  test('NS.updateBadge() reuses the shared counter (one implementation, not two)', async () => {
    reset({ notifications: { n1: { title: 'a' }, n2: { title: 'b' } } });
    app.eval(`document.body.innerHTML='<span id="bell-badge" style="display:none"></span>'`);
    await app.eval(`(async()=>await NS.updateBadge())()`);
    const b = app.window.document.getElementById('bell-badge');
    assert.strictEqual(b.textContent, '2');
    assert.strictEqual(b.style.display, 'flex');
    app.window.localStorage.removeItem('farm_user');
    await app.eval(`(async()=>await NS.updateBadge())()`);
    app.eval(`setUser({id:'admin1',role:'admin',name:'مدير'})`);
  });

  test('openNotificationsPopup() builds the modal from real collections and never throws on failure', async () => {
    reset({
      notifications: { n1: { title: 'تنبيه', msg: 'نص', date: app.eval(`todayStr()`) } },
      vaccinations: { v1: { name: 'حمى', status: 'pending', scheduled_date: app.eval(`todayStr()`) } },
      breeding: {}, health: {}, inventory_meds: {}, inventory_feeds: {}, login_notifications: {}, animals: {},
    });
    app.eval(`document.body.innerHTML='<div id="modal-root"></div>'`);
    await app.eval(`(async()=>await window.openNotificationsPopup())()`);
    await new Promise((r) => setTimeout(r, 60));
    const html = app.window.document.getElementById('modal-root').innerHTML;
    assert.ok(html.length > 100, 'the popup rendered content');
    assert.ok(!/undefined|NaN/.test(html), 'no undefined/NaN leaked into the markup');
  });

  test('loadNotifDropdown() computes day distances from real records (regression: the `t` binding)', async () => {
    // The dropdown derives "بعد N يوم" from `new Date(expected_birth) - t`.
    // If that Date binding ever goes missing again the whole function throws
    // inside its own try/catch and the dropdown silently renders nothing but
    // a spinner forever — asserted here so it cannot regress unnoticed.
    reset({
      breeding: { b1: { status: 'pregnant', female_tag: 'F-9', expected_birth: app.eval(`shiftDateLocal(new Date(),3)`) } },
      vaccinations: { v1: { name: 'حمى', status: 'overdue', target_section: 'ج١ع١' } },
      inventory_meds: { m1: { name: 'دواء', quantity: 1, min_quantity: 5 } },
      health: {}, inventory_feeds: {}, login_notifications: {},
    });
    app.eval(`document.body.innerHTML='<div id="notif-dropdown" style="display:none"></div><span id="bell-badge"></span>'`);
    await app.eval(`(async()=>await loadNotifDropdown())()`);
    await new Promise((r) => setTimeout(r, 50));
    const dd = app.window.document.getElementById('notif-dropdown');
    assert.ok(!/spinner/.test(dd.innerHTML), 'the loading spinner must be replaced by real content');
    assert.ok(/ولادة متوقعة/.test(dd.innerHTML), 'the expected birth is listed');
    assert.ok(/بعد [٠-٩]+ يوم/.test(dd.innerHTML), 'the day distance is computed and Arabic-Indic: ' + dd.innerHTML.slice(0, 300));
    assert.ok(/تحصين متأخر/.test(dd.innerHTML), 'the overdue vaccination is listed');
    assert.ok(/مخزون منخفض/.test(dd.innerHTML), 'the low-stock warning is listed');
    assert.strictEqual(app.window.document.getElementById('bell-badge').textContent, '1',
      'only DANGER items drive this badge (the overdue vaccine); the 3-day birth and the low stock are warnings');
  });

  test('notification text is HTML-escaped in the dropdown (stored XSS guard)', async () => {
    reset({
      vaccinations: { v1: { name: '<img src=x onerror=alert(1)>', status: 'overdue', target_section: '"><script>alert(2)</script>' } },
      inventory_meds: { m1: { name: '<svg onload=alert(3)>', quantity: 1, min_quantity: 5 } },
      breeding: {}, health: {}, inventory_feeds: {}, login_notifications: {}, notifications: {},
    });
    app.eval(`document.body.innerHTML='<div id="notif-dropdown" style="display:none"></div>'`);
    await app.eval(`(async()=>await loadNotifDropdown())()`);
    await new Promise((r) => setTimeout(r, 50));
    const html = app.window.document.getElementById('notif-dropdown').innerHTML;
    assert.ok(!/<img/i.test(html), 'the payload must not become a real element: ' + html.slice(0, 200));
    assert.ok(!/<script/i.test(html));
    assert.ok(html.includes('&lt;img'), 'it is escaped, not dropped: ' + html.slice(0, 400));
    assert.strictEqual(app.window.document.querySelectorAll('#notif-dropdown img').length, 0);
    assert.strictEqual(app.window.document.querySelectorAll('#notif-dropdown svg').length, 0);
  });
});
