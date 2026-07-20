// tests/ssot/weight.spec.js
// Regression protection for the certified Weight SSOT (docs/certification/WEIGHT.md).
// Fails if a future change re-introduces a second weight-storage path or breaks
// the current_weight synchronization this session's own Wave A work established.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Weight SSOT regression', () => {
  test('submitAddWeight writes only to the canonical path and syncs current_weight', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/animal-detail.html?id=testAnimal`);
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      window._calls = [];
      window._weightsDB = [];
      window.fbPost = async (c, p) => {
        window._calls.push({ t: 'post', c });
        if (c.endsWith('/weights')) window._weightsDB.push({ ...p, _id: 'w' + Math.random() });
        return 'id';
      };
      window.fbGet = async (c) => (c.endsWith('/weights') ? window._weightsDB.slice() : []);
      window.fbPatch = async (c, id, p) => window._calls.push({ t: 'patch', c, p });
      window.logActivity = async () => {};
      window.renderDetail = () => {};
      window.getSettings = () => ({});
      window.toast = () => {};
      document.body.insertAdjacentHTML('beforeend', '<input id="w-kg" value="30"><input id="w-date" value="2026-01-01"><input id="w-notes">');
    });

    await page.evaluate(() => window.submitAddWeight());
    await page.waitForTimeout(300);

    const calls = await page.evaluate(() => window._calls);
    const weightPosts = calls.filter((c) => c.t === 'post' && c.c.endsWith('/weights'));
    const legacyPosts = calls.filter((c) => c.c === 'weight_log' || c.c === 'weights');
    const syncPatch = calls.find((c) => c.t === 'patch' && c.p && 'current_weight' in c.p);

    expect(weightPosts.length, 'exactly one canonical weight write expected').toBe(1);
    expect(legacyPosts.length, 'zero writes to any retired legacy collection expected').toBe(0);
    expect(syncPatch, 'current_weight must be synced after a successful add').toBeTruthy();
    expect(syncPatch.p.current_weight).toBe(30);
  });
});
