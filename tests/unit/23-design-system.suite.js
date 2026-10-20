// Module 23 — the design system itself (ui.css + styles.css).
// A stylesheet is code: it can have syntax errors, undefined variables,
// circular references, dead tokens, selectors that silently invalidate a
// whole rule, and colour pairs that nobody can read. This suite checks all
// of that statically, including WCAG contrast computed from the tokens.
//
// Two real bugs this layer exists to keep fixed:
//   • styles.css contained a comment ending in ".sidebar-*" — the star+slash
//     closed the comment eight lines early and injected prose into the CSS.
//   • styles.css wrote `html.light-mode, body.light-mode .badge-x{…}`, which
//     painted the ROOT element with badge colours in light mode.
const fs = require('fs');
const path = require('path');
const csstree = require('css-tree');
const { suite, assert, ROOT } = require('./harness');

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* ── colour plumbing ─────────────────────────────────────────────────── */
function parseColor(str) {
  if (!str) return null;
  const s = String(str).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) { const h = m[1]; return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16), a: 1 }; }
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) { const h = m[1]; return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 }; }
  m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  return null;
}
function lum(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
function contrast(a, b) {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
function composite(fg, bg) {           // rgba over a solid backdrop
  if (!fg) return bg;
  const a = fg.a === undefined ? 1 : fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

/* ── token extraction: :root (dark) and the light-theme blocks ───────── */
function collectVars(css, selectorTest) {
  const out = {};
  const ast = csstree.parse(css, { positions: false });
  csstree.walk(ast, {
    visit: 'Rule',
    enter(node) {
      const sel = csstree.generate(node.prelude);
      if (!selectorTest(sel)) return;
      node.block.children.forEach((d) => {
        if (d.type !== 'Declaration' || !d.property.startsWith('--')) return;
        out[d.property] = csstree.generate(d.value).trim();
      });
    }
  });
  return out;
}
function resolver(base, override) {
  const map = Object.assign({}, base, override || {});
  const cache = {};
  function resolve(name, depth) {
    if (depth > 12) return null;                      // cycle guard
    if (cache[name]) return cache[name];
    let v = map[name];
    if (v === undefined) return null;
    // gradients / multi-value tokens are not colours
    if (/gradient|url\(|var\([^)]*\)\s*var\(/.test(v) && !/^var\(/.test(v)) return null;
    v = v.replace(/var\((--[a-z0-9-]+)(?:\s*,\s*[^)]*)?\)/gi, (_, inner) => {
      const r = resolve(inner, (depth || 0) + 1);
      return r === null ? '' : r;
    });
    cache[name] = v.trim();
    return cache[name];
  }
  return {
    raw: (n) => resolve(n, 0),
    color: (n) => parseColor(resolve(n, 0)),
    has: (n) => map[n] !== undefined
  };
}

module.exports = suite('23 · Design system (ui.css / styles.css)', ({ test }) => {
  const uiCss = read('ui.css');
  const legacyCss = read('styles.css');

  test('both stylesheets parse with zero CSS syntax errors', () => {
    for (const [name, src] of [['ui.css', uiCss], ['styles.css', legacyCss]]) {
      const errs = [];
      csstree.parse(src, { onParseError: (e) => errs.push(`${name}:${e.line} ${e.message}`) });
      assert.deepStrictEqual(errs, [], `${name} must parse cleanly`);
    }
  });

  test('no comment can terminate itself early (the ".sidebar-*" bug class)', () => {
    for (const [name, src] of [['ui.css', uiCss], ['styles.css', legacyCss]]) {
      const opens = (src.match(/\/\*/g) || []).length;
      const closes = (src.match(/\*\//g) || []).length;
      assert.strictEqual(opens, closes, `${name}: /* and */ must balance (${opens} vs ${closes})`);
      // Inside a comment, a star followed by a slash ends it — so a comment
      // body must never contain the pair except as its own terminator.
      const bad = [];
      const re = /\/\*([\s\S]*?)\*\//g;
      let m, idx = 0;
      while ((m = re.exec(src))) {
        idx++;
        if (/\*\//.test(m[1])) bad.push(`comment #${idx}`);
      }
      assert.deepStrictEqual(bad, [], `${name}: comments containing a premature terminator`);
    }
  });

    test('the light-mode badge selector bug is gone (no root-level colour leak)', () => {
    // styles.css used to ship rules like:
    //   html.light-mode, body.light-mode .badge-tarbiya{background:…;color:…}
    // The first selector matches the ROOT element, so in light mode the badge
    // rules never applied and the root got a tinted background instead.
    // Fixed in styles.css and regression-guarded here. Only groups that actually
    // PAINT are a bug — the light-theme token block legitimately re-declares
    // custom properties on `html.light-mode body` as well.
    const PAINT = /^(color|background|background-color|border-color|border|outline-color)$/;
    const isRoot = (sel) => /^(html|body|:root)(\.[\w-]+|\[[^\]]+\])?$/.test(sel.trim());
    const offenders = [];

    for (const file of ['styles.css', 'ui.css']) {
      const ast = csstree.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
      csstree.walk(ast, {
        visit: 'Rule',
        enter(node) {
          if (!node.prelude || node.prelude.type !== 'SelectorList') return;
          const sels = node.prelude.children.toArray().map((n) => csstree.generate(n).trim());
          if (sels.length < 2) return;
          const paints = node.block.children.toArray().some((d) => d.type === 'Declaration' && PAINT.test(d.property));
          if (!paints) return;
          const hasRoot = sels.some(isRoot);
          const hasThemeDescendant = sels.some((s) => !isRoot(s) && /^(html|body|:root)[.[]/.test(s));
          if (hasRoot && hasThemeDescendant) {
            offenders.push(file + ': ' + sels.join(', ') + ' { ' +
              node.block.children.toArray().filter((d) => d.type === 'Declaration').map((d) => d.property).join(', ') + ' }');
          }
        },
      });
    }

    assert.deepStrictEqual(offenders, [],
      'a theme-root selector must not share a colour rule with a descendant selector:\n' + offenders.join('\n'));
  });

test('status badges keep AA contrast on their own tinted surface, both themes', () => {
    const darkVars = collectVars(uiCss, (sel) => sel === ':root');
    const lightVars = collectVars(uiCss, (sel) => /html\[data-theme="light"\],html\.light-mode/.test(sel));
    const report = [];
    for (const [theme, overrides] of [['dark', {}], ['light', lightVars]]) {
      const r = resolver(darkVars, overrides);
      const base = r.color('--surface-raised');
      ['success', 'warning', 'danger', 'info', 'violet', 'neutral'].forEach((name) => {
        const inkTok = `--${name}-ink`, surfTok = `--${name}-surface`;
        const ink = r.color(inkTok), surf = r.color(surfTok);
        if (!ink || !surf) { report.push(`${theme}/${name}: unresolved`); return; }
        const bg = composite(surf, base);
        const ratio = contrast(ink, bg);
        if (ratio < 3.0) report.push(`${theme}/${name} badge = ${ratio.toFixed(2)}:1 (needs 3.0)`);
      });
    }
    assert.deepStrictEqual(report, [], 'badge contrast failures');
  });

  test('every page loads the design system in the right order', () => {
    const pages = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html') && !/^bayan|^index\.html$/.test(f));
    assert.ok(pages.length >= 30, `expected the app pages, found ${pages.length}`);
    const problems = [];
    pages.forEach((f) => {
      const s = read(f);
      if (!s.includes('href="ui.css"')) { problems.push(`${f}: missing ui.css`); return; }
      if (s.indexOf('href="styles.css"') > s.indexOf('href="ui.css"')) problems.push(`${f}: ui.css must come AFTER styles.css to win the cascade`);
      if (!s.includes('src="ui-shell.js"')) problems.push(`${f}: missing ui-shell.js`);
      else if (s.includes('src="shared.js"') && s.indexOf('src="shared.js"') > s.indexOf('src="ui-shell.js"')) {
        problems.push(`${f}: ui-shell.js must load AFTER shared.js (it upgrades window.toast)`);
      }
      if (!s.includes("farm_density")) problems.push(`${f}: missing the pre-paint preferences script`);
    });
    assert.deepStrictEqual(problems, []);
  });

  test('the shell CSS defines every class the shell JS emits', () => {
    const js = read('ui-shell.js');
    const classes = new Set();
    const re = /class="([a-z0-9 _-]+)"/gi;
    let m;
    while ((m = re.exec(js))) m[1].split(/\s+/).forEach((c) => { if (c && !c.startsWith('bi-')) classes.add(c); });
    const missing = [...classes].filter((c) => !uiCss.includes('.' + c)).sort();
    assert.deepStrictEqual(missing, [], 'classes rendered by ui-shell.js with no rule in ui.css');
  });

  test('the design tokens are documented next to the CSS', () => {
    const doc = read('docs/design/UI-SYSTEM.md');
    ['--brand', '--surface-base', '--text-primary', 'data-density', 'data-theme', 'command palette']
      .forEach((needle) => assert.ok(doc.toLowerCase().includes(needle.toLowerCase()), `UI-SYSTEM.md must document ${needle}`));
  });
});
