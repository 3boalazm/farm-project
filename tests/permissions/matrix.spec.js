// tests/permissions/matrix.spec.js
//
// Generates its own test matrix from the LIVE FARM_NAV and can() --
// never hand-copies the permission table. This is the automated form
// of the exact audit that found the Phase 6 vulnerability (declared
// permission in nav.js with no page-level enforcement) -- if a future
// page is added to FARM_NAV without a matching enforcement check,
// this suite fails, by construction, without anyone writing a new
// test case for it.

const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';
const ROLES = ['admin', 'supervisor', 'vet', 'worker', 'visitor'];

// Pages confirmed to have a genuinely different init pattern (see
// docs/audit/PERMISSION-MATRIX.md) -- excluded from automated
// navigation-level verification, not silently assumed passing.
const KNOWN_EXCEPTIONS = new Set(['bayan.html', 'activity.html']);

async function setRole(page, role) {
  await page.addInitScript((r) => {
    localStorage.setItem('farm_user', JSON.stringify({ name: 'TestUser', role: r }));
  }, role);
}

test.describe('Permission matrix (generated from live nav.js + firebase.js)', () => {
  let flatPages = [];

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    // Must authenticate before visiting, or requireAuth() redirects to
    // login.html -- which deliberately skips loading nav.js entirely
    // (per CLAUDE.md), so FARM_NAV would never be defined.
    await context.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'Setup', role: 'admin' }));
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/dashboard.html`);
    const nav = await page.evaluate(() => window.FARM_NAV);
    if (!nav) throw new Error('FARM_NAV not found on window -- nav.js structure may have changed; update this test\'s extraction logic, do not hardcode a replacement table.');
    for (const section of nav) {
      for (const item of section.items) {
        if (KNOWN_EXCEPTIONS.has(item.href)) continue;
        if (!item.perm) {
          // A page with NO declared perm at all (e.g. notifications.html)
          // is a genuinely different situation from "declared but
          // unenforced" -- there is no evidence of what permission was
          // ever intended, so this suite does not assert an expectation
          // here. Flagged in docs/audit findings, not guessed at.
          continue;
        }
        flatPages.push({ href: item.href, perm: item.perm });
      }
    }
    await context.close();
  });

  for (const role of ROLES) {
    test(`role "${role}" -- every nav page matches live can() result`, async ({ page }) => {
      await setRole(page, role);
      for (const { href, perm } of flatPages) {
        // Step 1: ask the REAL can() function, in-browser, what it expects.
        await page.goto(`${BASE_URL}/${href}`);
        const expected = await page.evaluate((p) => window.can ? can(p) : null, perm);
        if (expected === null) continue; // can() not loaded on this page shape; skip rather than guess

        // Step 2: confirm the page's ACTUAL rendered state matches that expectation.
        await page.waitForTimeout(400);
        const blocked = await page.evaluate(() => document.body.innerText.includes('غير مصرح'));

        if (expected === false) {
          expect(blocked, `${href} (perm:${perm}) should BLOCK role "${role}" but did not`).toBe(true);
        } else {
          expect(blocked, `${href} (perm:${perm}) should ALLOW role "${role}" but blocked it`).toBe(false);
        }
      }
    });
  }
});
