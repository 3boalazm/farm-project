// scripts/debug-dashboard-render.js
//
// Dev tool, not part of any suite: it renders dashboard.html's OWN inline
// script inside the unit harness's jsdom window, so "the page rendered
// nothing" can be reproduced without a browser binary. Written while fixing
// the 2026-10 browser-suite failures in an environment where Chromium cannot
// be installed (no libnss3, no apt, no route to the Playwright CDN) — CI was
// the only browser, at five minutes per round trip.
//
//   node scripts/debug-dashboard-render.js
//
// It reports which dashboard tab panel contains a given string, which panels
// are hidden, and whether renderDashboard() threw. jsdom has no layout, so
// innerText does not exist here — that difference is itself the lesson: the
// browser specs assert on innerText, which skips hidden panels, and the v2
// dashboard put four of its five sections behind tabs.
const fs = require('fs');
const { bootApp } = require('../tests/unit/harness');

(async () => {
  const html = fs.readFileSync('dashboard.html', 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const main = scripts.sort((a, b) => b.length - a.length)[0];
  const app = await bootApp({
    files: ['config.js', 'firebase.js', 'nav.js', 'shared.js', 'ui-shell.js'],
    user: { id: 'admin1', name: 'T', role: 'admin', active: true },
    db: { seed: {} },
  });
  try {
    await app.eval(main);
    console.log('inline script evaluated OK; renderDashboard is', await app.eval(`typeof renderDashboard`));
  } catch (e) {
    console.log('EVAL THREW:', String(e.message).split('\n').slice(0, 4).join(' | '));
  }
  const animals = [
    { _id: 'x1', tag: 'G-1', barn: 'B1', status: 'alive', species: 'goat' },
    { _id: 'x2', tag: 'G-2', barn: 'B1', status: 'alive', species: 'sheep' },
  ];
  const call = `(()=>{ try { renderDashboard(${JSON.stringify(animals)},[],[],[],[],[],[],[],[],[],[],[],[]); return 'rendered'; } catch(e){ return 'THREW: '+e.message+' @ '+String(e.stack).split('\\n')[1]; } })()`;
  console.log(await app.eval(call));
  const out = await app.eval(`(()=>{
    const needles = ['مؤشرات تنفيذية','المهام القادمة','الجدول الزمني التشغيلي','موجز اليوم','يحتاج انتباهًا اليوم'];
    const panels = [...document.querySelectorAll('.dash-tab-panel')];
    const where = {};
    for (const n of needles) {
      where[n] = panels.filter(p => (p.textContent||'').includes(n)).map(p => p.id);
    }
    where['__inventoryCard'] = panels.filter(p => p.querySelector('#inventory-exec-card')).map(p => p.id);
    where['__panelCount'] = panels.length;
    where['__hidden'] = panels.filter(p => p.hidden).map(p => p.id);
    return where;
  })()`);
  console.log(JSON.stringify(out, null, 1));
  app.close();
  process.exit(0);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
