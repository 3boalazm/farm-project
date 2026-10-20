// tests/security/xss-hardening.spec.js
// Regression protection for the XSS fixes applied 2026-08-24
// (see docs/repository/XSS-AUDIT-2026-08-23.md and
// docs/repository/XSS-FIX-2026-08-24.md). Each test injects a malicious
// payload through a real render function and asserts it never executes
// and never appears as a live tag in the resulting markup, while normal
// text (including Arabic) still renders correctly.

const { test, expect } = require('../fixtures/farm-test');
const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

const PAYLOADS = {
  scriptTag: '<script>window.__xss=true</script>',
  imgOnerror: '<img src=x onerror="window.__xss=true">',
  attrBreak: '"><img src=x onerror="window.__xss=true">',
  quotesAmp: `" ' < > &`,
};
const ARABIC = 'شامي بلدي — نص عربي طبيعي ٠١٢٣';

async function armXssDetector(page) {
  await page.addInitScript(() => { window.__xss = false; });
}

test.describe('XSS hardening: shared helpers', () => {
  test('escapeHtml() neutralizes every dangerous character and round-trips Arabic unchanged', async ({ page }) => {
    await page.goto(`${BASE_URL}/login.html`);
    const result = await page.evaluate((payloads) => {
      const out = {};
      for (const [name, val] of Object.entries(payloads)) out[name] = window.escapeHtml(val);
      out.arabic = window.escapeHtml('شامي بلدي — نص عربي طبيعي ٠١٢٣');
      return out;
    }, PAYLOADS);
    expect(result.scriptTag).not.toContain('<script>');
    expect(result.imgOnerror).not.toContain('<img');
    expect(result.attrBreak).not.toContain('"><img');
    expect(result.quotesAmp).toBe('&quot; &#39; &lt; &gt; &amp;');
    expect(result.arabic).toBe('شامي بلدي — نص عربي طبيعي ٠١٢٣');
  });

  test('renderAlertCard() and renderTimelineItem() escape every plain-text field', async ({ page }) => {
    await armXssDetector(page);
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(500);
    const html = await page.evaluate((payload) => {
      window.alert = () => { window.__xss = true; };
      const alertHtml = window.renderAlertCard({ severity: 'critical', title: 'ok', message: payload, source: payload, deadline: payload, actionLabel: payload, actionHref: 'x.html' });
      const timelineHtml = window.renderTimelineItem({ time: '10:00', eventType: payload, entity: payload, description: payload });
      return alertHtml + timelineHtml;
    }, PAYLOADS.imgOnerror);
    expect(html).not.toContain('<img src=x onerror="window.__xss=true">');
    expect(await page.evaluate(() => window.__xss)).toBe(false);
  });
});

test.describe('XSS hardening: assistant.html chat', () => {
  test('addMsg() escapes user input, bot text, and LLM-echoed content, while real newlines still become <br>', async ({ page }) => {
    await armXssDetector(page);
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/assistant.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.alert = () => { window.__xss = true; }; });

    const result = await page.evaluate((payloads) => {
      const cases = {};
      for (const [name, val] of Object.entries(payloads)) {
        const div = window.addMsg('bot', val);
        cases[name] = { html: div.innerHTML, text: div.textContent };
      }
      const multi = window.addMsg('bot', 'سطر واحد\nسطر تاني\n<img src=x onerror="window.__xss=true">');
      cases.multiline = { html: multi.innerHTML, brCount: (multi.innerHTML.match(/<br>/g) || []).length };
      return cases;
    }, PAYLOADS);

    expect(await page.evaluate(() => window.__xss)).toBe(false);
    expect(result.scriptTag.html).not.toContain('<script>');
    expect(result.scriptTag.text).toBe(PAYLOADS.scriptTag);
    expect(result.imgOnerror.html).not.toContain('<img src=x');
    expect(result.multiline.brCount).toBe(2);
    expect(result.multiline.html).not.toContain('<img src=x');
  });

  test('showConfirmation() escapes LLM-extracted field names, values, and summary (the pre-save preview)', async ({ page }) => {
    await armXssDetector(page);
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/assistant.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.alert = () => { window.__xss = true; }; });

    const html = await page.evaluate((payloads) => {
      window.showConfirmation({
        action: 'add_animal',
        summary: payloads.imgOnerror,
        data: { breed: payloads.scriptTag, tag: payloads.attrBreak, notes: 'ملاحظة عادية' },
      });
      return document.getElementById('chat-messages').lastElementChild.innerHTML;
    }, PAYLOADS);

    expect(await page.evaluate(() => window.__xss)).toBe(false);
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('"><img');
    expect(html).toContain('ملاحظة عادية');
  });

  test('editAndConfirm() escapes mother_tag/notes in the edit modal\'s value attributes', async ({ page }) => {
    await armXssDetector(page);
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/assistant.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.alert = () => { window.__xss = true; }; });

    const result = await page.evaluate((payloads) => {
      window._pendingAction = { action: 'add_birth', data: { mother_tag: payloads.attrBreak, notes: payloads.scriptTag, species: 'goat' } };
      window.editAndConfirm();
      const modalHtml = document.querySelector('.farm-modal').innerHTML;
      const mtagValue = document.getElementById('ea-mtag').value;
      window.closeModal();
      return { modalHtml, mtagValue };
    }, PAYLOADS);

    expect(await page.evaluate(() => window.__xss)).toBe(false);
    expect(result.modalHtml).not.toContain('"><img');
    expect(result.mtagValue, 'the real value must still be recoverable from the input, not corrupted').toBe(PAYLOADS.attrBreak);
  });
});

test.describe('XSS hardening: pedigree rendering', () => {
  test('renderNode()/renderCenterNode() escape breed/tag in both text content and aria-label attributes', async ({ page }) => {
    await armXssDetector(page);
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/pedigree.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.alert = () => { window.__xss = true; }; });

    for (const [name, payload] of Object.entries(PAYLOADS)) {
      const html = await page.evaluate((val) => {
        const animal = { _id: 'test123', breed: val, tag: val, gender: 'male', species: 'goat' };
        return window.renderNode(animal, null, 'male') + window.renderCenterNode(animal);
      }, payload);
      expect(html, `renderNode payload=${name}`).not.toContain('<script>');
      expect(html, `renderNode payload=${name}`).not.toContain('<img src=x');
    }

    // Arabic and normal special characters must still render correctly.
    const arabicHtml = await page.evaluate((val) => {
      const animal = { _id: 'test456', breed: val, tag: 'A-100', gender: 'female', species: 'sheep' };
      return window.renderNode(animal, null, 'female');
    }, ARABIC);
    expect(arabicHtml).toContain(ARABIC);
    expect(await page.evaluate(() => window.__xss)).toBe(false);
  });
});

test.describe('XSS hardening: toast() and notification rendering (existing choke points, guarded against regression)', () => {
  test('toast() still escapes its message', async ({ page }) => {
    await armXssDetector(page);
    await page.addInitScript(() => localStorage.setItem('farm_user', JSON.stringify({ name: 'T', role: 'admin' })));
    await page.goto(`${BASE_URL}/dashboard.html`);
    await page.waitForTimeout(500);
    await page.evaluate(() => { window.alert = () => { window.__xss = true; }; });
    await page.evaluate((payload) => window.toast(payload, 'error'), PAYLOADS.imgOnerror);
    await page.waitForTimeout(100);
    const toastHtml = await page.evaluate(() => document.querySelector('.farm-toast')?.innerHTML || '');
    expect(toastHtml).not.toContain('<img src=x');
    expect(await page.evaluate(() => window.__xss)).toBe(false);
  });
});
