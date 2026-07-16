// tests/smoke/pages-load.spec.js
// Broad, shallow: every page loads with zero real script errors.
// Not a substitute for the deeper suites -- catches the "page is
// completely broken" class of regression cheaply and fast.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

const PAGES = [
  'dashboard.html', 'animals.html', 'animal-detail.html', 'breeding.html',
  'production.html', 'reports.html', 'inventory.html', 'settings.html',
  'login.html', 'health.html', 'vaccine.html', 'goats.html', 'sheep.html',
  'births.html', 'dead.html', 'barns.html', 'diary.html', 'cost.html',
  'assistant.html', 'users.html',
];

test.describe('Smoke: every page loads without real script errors', () => {
  for (const p of PAGES) {
    test(`${p} loads cleanly`, async ({ page }) => {
      await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`${BASE_URL}/${p}`, { waitUntil: 'load' });
      await page.waitForTimeout(300);
      const realErrors = errors.filter((e) => !e.includes('Failed to fetch') && !e.includes('NetworkError'));
      expect(realErrors, `${p} produced unexpected script errors`).toEqual([]);
    });
  }
});
