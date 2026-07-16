// tests/ssot/birth.spec.js
// Regression protection for the certified Birth SSOT (docs/certification/BIRTH.md).

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Birth SSOT regression', () => {
  test('createOffspringAnimal creates one breeding record and correct offspring via _ubSubmit', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/breeding.html`);
    await page.waitForTimeout(800);
    await page.evaluate(() => { window.fbGet = async () => []; });
    await page.evaluate(() => window.openUnifiedBirthModal());
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      window._calls = [];
      window.fbPost = async (c, p) => { window._calls.push({ t: 'post', c, p }); return 'newAnimalId'; };
      window.fbPatch = async () => {};
      window.logActivity = async () => {};
      window.toast = () => {};
      window.location.reload = () => {};
    });
    await page.selectOption('#ub-gender', 'female');
    await page.fill('#ub-mother-tag', 'F-REGTEST');
    await page.fill('#ub-qty', '2');
    await page.evaluate(() => window._ubSubmit());
    await page.waitForTimeout(300);

    const calls = await page.evaluate(() => window._calls);
    const breedingPosts = calls.filter((c) => c.c === 'breeding');
    const animalPosts = calls.filter((c) => c.c === 'animals');

    expect(breedingPosts.length, 'exactly one breeding record per birth event').toBe(1);
    expect(animalPosts.length, 'one animal document per offspring (qty=2)').toBe(2);
    for (const a of animalPosts) {
      expect(a.p.mother_tag, 'every offspring must carry the correct mother_tag').toBe('F-REGTEST');
    }
  });
});
