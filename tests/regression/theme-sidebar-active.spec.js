// tests/regression/theme-sidebar-active.spec.js
// Hotfix: sidebar active-item contrast failure in light mode.
// Root cause: .sidebar-item.active used var(--green) for its
// background, but --green is redefined to a much darker shade in
// light-mode CSS (intended for use as accent TEXT on a light
// background), while the sidebar itself stays a dark gradient in BOTH
// themes. Result: dark-green text on a near-identical dark-green
// background, ~1.98:1 contrast (WCAG AA requires 4.5:1). Fixed by
// using a fixed, theme-independent bright green (the value --green
// already held in dark mode) instead of the theme-swapping variable --
// the smallest possible change: one CSS rule, two values, no selector
// changes, no JS changes, no other rule touched.

const { test, expect } = require('@playwright/test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

async function getActiveItemStyle(page) {
  return page.evaluate(() => {
    const el = document.querySelector('.sidebar-item.active');
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { background: cs.backgroundColor, color: cs.color };
  });
}

function contrastRatio(rgb1, rgb2) {
  function luminance(rgbStr) {
    const [r, g, b] = rgbStr.match(/\d+/g).map(Number).map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const L1 = luminance(rgb1);
  const L2 = luminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

test.describe('Theme switch: sidebar active-item contrast (hotfix regression)', () => {
  test('Light mode: active item meets WCAG AA contrast (>= 4.5:1)', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
      localStorage.setItem('farm_theme', 'light');
    });
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    const style = await getActiveItemStyle(page);
    expect(style, 'active sidebar item must exist').toBeTruthy();
    const ratio = contrastRatio(style.background, style.color);
    expect(ratio, `contrast ratio ${ratio.toFixed(2)}:1 must meet WCAG AA`).toBeGreaterThanOrEqual(4.5);
  });

  test('Dark mode: active item styling is completely unchanged by the fix', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    const style = await getActiveItemStyle(page);
    expect(style.background).toBe('rgb(52, 211, 153)');
    expect(style.color).toBe('rgb(2, 44, 34)');
  });

  test('Light -> Dark -> Light: active item updates immediately and correctly each time', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    const initialDark = await getActiveItemStyle(page);

    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(150);
    const afterLight = await getActiveItemStyle(page);

    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(150);
    const afterDarkAgain = await getActiveItemStyle(page);

    expect(afterLight.background).toBe(initialDark.background);
    expect(afterDarkAgain).toEqual(initialDark);
  });

  test('Navigation after switching to light mode: correct active item on a different page', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
      localStorage.setItem('farm_theme', 'light');
    });
    await page.goto(`${BASE_URL}/animals.html`);
    await page.waitForTimeout(700);
    const style = await getActiveItemStyle(page);
    expect(style.background).toBe('rgb(52, 211, 153)');
    const ratio = contrastRatio(style.background, style.color);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('Refresh after switching to light mode: theme and active item both persist correctly', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(150);
    await page.reload();
    await page.waitForTimeout(700);
    const isLight = await page.evaluate(() => document.documentElement.classList.contains('light-mode'));
    expect(isLight, 'theme choice must survive a refresh').toBe(true);
    const style = await getActiveItemStyle(page);
    const ratio = contrastRatio(style.background, style.color);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('Mobile drawer: active item has correct, readable colors', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
      localStorage.setItem('farm_theme', 'light');
    });
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => window.openSidebar && window.openSidebar());
    await page.waitForTimeout(300);
    const style = await getActiveItemStyle(page);
    const ratio = contrastRatio(style.background, style.color);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('Desktop sidebar: same fix applies, no viewport-specific regression', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' }));
      localStorage.setItem('farm_theme', 'light');
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    const style = await getActiveItemStyle(page);
    const ratio = contrastRatio(style.background, style.color);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  test('Regression: unrelated systems (bell badge, notification dropdown, theme icon) are untouched', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(200);
    const bellExists = await page.evaluate(() => !!document.getElementById('bell-badge'));
    const iconUpdated = await page.evaluate(() => document.getElementById('theme-icon')?.className.includes('sun-fill'));
    const dropdownFnExists = await page.evaluate(() => typeof window.toggleNotifDropdown === 'function');
    expect(bellExists).toBe(true);
    expect(iconUpdated).toBe(true);
    expect(dropdownFnExists).toBe(true);
    expect(errors.filter((e) => !e.includes('Failed to fetch'))).toEqual([]);
  });

  test('No duplicate renders: toggling theme does not re-invoke renderNavbar (sidebar node identity preserved)', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(700);
    await page.evaluate(() => { window.__sidebarRef = document.getElementById('sidebarMenu'); });
    await page.evaluate(() => window.toggleTheme());
    await page.waitForTimeout(150);
    const sameNode = await page.evaluate(() => window.__sidebarRef === document.getElementById('sidebarMenu'));
    expect(sameNode, 'the fix is pure CSS -- the sidebar DOM node must not be recreated on theme toggle').toBe(true);
  });
});
