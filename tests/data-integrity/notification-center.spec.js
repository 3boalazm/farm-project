// tests/data-integrity/notification-center.spec.js
// Sprint 9 (v1.1): regression protection for the extended notification
// system. NS.checkAll()'s existing 6 trigger types are NOT re-tested
// here (pre-existing, unmodified behavior) -- these tests cover
// specifically what Sprint 9 added: the operational-priority trigger,
// the global bell badge, expiration, and the read_at timestamp.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function setupNotifMocks(page, overrides = {}) {
  await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
  await page.goto(`${BASE_URL}/notifications.html`);
  await page.waitForTimeout(600);
  await page.evaluate((ov) => {
    window._notifs = ov.notifications || [];
    window.fbGet = async (c) => {
      if (c === 'animals') return ov.animals || [];
      if (c === 'health') return ov.health || [];
      if (c === 'weight_alerts') return ov.weight_alerts || [];
      if (c === 'production_log') return ov.production_log || [];
      if (c === 'vaccinations') return ov.vaccinations || [];
      if (c === 'breeding') return ov.breeding || [];
      if (c === 'inventory_meds') return [];
      if (c === 'inventory_feeds') return [];
      if (c === 'login_notifications') return [];
      if (c === 'notifications') return window._notifs.slice();
      return [];
    };
    window.fbPost = async (c, d) => {
      if (c === 'notifications') { const id = 'n' + window._notifs.length; window._notifs.push({ ...d, _id: id }); return id; }
      return 'id';
    };
    window.fbPatch = async (c, id, d) => {
      if (c === 'notifications') { const n = window._notifs.find((x) => x._id === id); if (n) Object.assign(n, d); }
    };
    window.fbDelete = async (c, id) => {
      if (c === 'notifications') { window._notifs = window._notifs.filter((x) => x._id !== id); }
    };
    window.logActivity = async () => {};
    window.initFirebase = () => true;
    window.getWeather = async () => null;
    localStorage.removeItem('_sentNotifIds');
  }, overrides);
}

test.describe('Notification Center (Sprint 9)', () => {
  test('operational-priority trigger creates a correctly-shaped notification for a real high-priority animal', async ({ page }) => {
    await setupNotifMocks(page, {
      animals: [{ _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-1', status: 'active', diagnosis: 'x', date: '2026-07-15', medication: 'm', bcs: '2' }],
      weight_alerts: [{ animal_id: 'x1', status: 'active', rule_type: 'weight_loss' }],
      vaccinations: [{ target_section: 'B1', status: 'overdue', name: 'v', _id: 'v1' }],
    });
    await page.evaluate(async () => { await NS.checkAll(); });
    const notif = await page.evaluate(() => window._notifs.find((n) => n.cat === 'الذكاء التشغيلي'));
    expect(notif).toBeTruthy();
    expect(notif.animal_id).toBe('x1');
    expect(notif.animal_tag).toBe('G-1');
    expect(notif.priorityLevel).toBe('high');
    expect(notif.href).toBe('animal-detail.html?id=x1');
  });

  test('a low-priority animal does NOT generate an operational-priority notification', async ({ page }) => {
    await setupNotifMocks(page, {
      animals: [{ _id: 'x2', tag: 'G-2', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-2', status: 'active', diagnosis: 'x', date: '2026-07-15' }],
    });
    await page.evaluate(async () => { await NS.checkAll(); });
    const notif = await page.evaluate(() => window._notifs.find((n) => n.cat === 'الذكاء التشغيلي'));
    expect(notif, 'a medium-level (score 30) animal must not trigger a notification').toBeFalsy();
  });

  test('deduplication: repeated checkAll() calls never duplicate the same operational-priority notification', async ({ page }) => {
    await setupNotifMocks(page, {
      animals: [{ _id: 'x3', tag: 'G-3', barn: 'B1', status: 'alive' }],
      health: [{ animal_tag: 'G-3', status: 'active', diagnosis: 'x', date: '2026-07-15', medication: 'm', bcs: '2' }],
      weight_alerts: [{ animal_id: 'x3', status: 'active', rule_type: 'weight_loss' }],
      vaccinations: [{ target_section: 'B1', status: 'overdue', name: 'v', _id: 'v1' }],
    });
    await page.evaluate(async () => { await NS.checkAll(); await NS.checkAll(); await NS.checkAll(); });
    const matches = await page.evaluate(() => window._notifs.filter((n) => n.animal_id === 'x3'));
    expect(matches.length, 'three checkAll() calls must produce exactly one notification, not three').toBe(1);
  });

  test('read/unread: markRead sets read=true and stamps read_at', async ({ page }) => {
    await setupNotifMocks(page, { notifications: [{ _id: 'n1', read: false, title: 'x', created_at: new Date().toISOString() }] });
    await page.evaluate(() => window.markRead('n1', '#'));
    const n = await page.evaluate(() => window._notifs.find((x) => x._id === 'n1'));
    expect(n.read).toBe(true);
    expect(n.read_at).toBeTruthy();
  });

  test('deep link: markRead with a real href navigates there', async ({ page }) => {
    await setupNotifMocks(page, { notifications: [{ _id: 'n2', read: false, title: 'x', href: 'animal-detail.html?id=x9' }] });
    await page.evaluate(() => window.markRead('n2', 'animal-detail.html?id=x9'));
    await page.waitForURL(/animal-detail\.html\?id=x9/);
    expect(page.url()).toContain('animal-detail.html?id=x9');
  });

  test('expiration: a read notification older than 30 days is removed; an unread one, even older, is not', async ({ page }) => {
    const oldDate = new Date(); oldDate.setDate(oldDate.getDate() - 45);
    const oldDateStr = oldDate.toISOString().slice(0, 10);
    await setupNotifMocks(page, {
      notifications: [
        { _id: 'old-read', read: true, date: oldDateStr, title: 'old read' },
        { _id: 'old-unread', read: false, date: oldDateStr, title: 'old unread' },
        { _id: 'recent-read', read: true, date: new Date().toISOString().slice(0, 10), title: 'recent read' },
      ],
    });
    const expiredCount = await page.evaluate(async () => NS.expireOld());
    const remaining = await page.evaluate(() => window._notifs.map((n) => n._id));
    expect(expiredCount).toBe(1);
    expect(remaining).not.toContain('old-read');
    expect(remaining, 'unread notifications are never auto-expired, regardless of age').toContain('old-unread');
    expect(remaining).toContain('recent-read');
  });

  test('global bell badge: shared count function matches raw unread data exactly', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      window.fbGet = async (c) => (c === 'notifications'
        ? [{ read: false, for_role: 'admin' }, { read: false, for_role: 'admin' }, { read: true, for_role: 'admin' }]
        : []);
    });
    const count = await page.evaluate(() => window.getUnreadNotificationCount());
    expect(count).toBe(2);
  });

  test('permission behavior: notifications.html loads cleanly for a non-admin role', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'V', role: 'visitor' })));
    await page.goto(`${BASE_URL}/notifications.html`);
    await page.waitForTimeout(600);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });
});
