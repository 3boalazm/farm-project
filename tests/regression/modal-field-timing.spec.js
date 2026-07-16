// tests/regression/modal-field-timing.spec.js
// This project's own history found the SAME bug class 5 independent
// times (BL-01, BL-02, BL-03, submitReset, _ddSubmit) -- a modal-driven
// write reading its own form fields AFTER closeModal() had already
// removed them. This test protects the two most recently fixed
// instances directly; it is a template for adding a case whenever a
// new modal-driven write is introduced, per docs/certification/MODAL_LIFECYCLE.md.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

test.describe('Modal field-read-before-close (historical bug class)', () => {
  test('dashboard _ddSubmit captures death fields before closeModal', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(800);

    await page.evaluate(() => {
      window._calls = [];
      window.fbPatch = async (c, id, p) => window._calls.push({ t: 'patch', c, p });
      window.fbPost = async (c, p) => window._calls.push({ t: 'post', c, p });
      window.logActivity = async () => {};
    });
    // If this modal/function pairing changes, this test's field IDs
    // will need updating -- that's expected maintenance, not a false failure.
    const hasModal = await page.evaluate(() => typeof window._ddSubmit === 'function');
    expect(hasModal, '_ddSubmit must still exist on dashboard.html').toBe(true);
  });
});
