'use strict';

// ── State ─────────────────────────────────────────────────
var _prodData = [];
var _animalsLst = [];
var _tab = 'milk';   // milk | wool | weight | summary
var _chart = null;

// ── Boot ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent = s.farmName;
  renderNavbarV2('production.html');
  renderPageHeaderV2({
    title: '<i class="bi bi-droplet-fill accent-text"></i> إدارة الإنتاج',
    description: 'الحليب • الصوف • الأوزان',
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'الإنتاج'}],
    primaryAction: can('animals') ? `<button class="action-btn primary" onclick="openProdEntry()" aria-label="تسجيل إنتاج جديد"><i class="bi bi-plus-lg"></i> تسجيل إنتاج</button>` : ''
  });
  await loadData();
  renderMain();
});

async function loadData() {
  const el = document.getElementById('content');
  renderLoading(el);
  try {
    const [prod, animals] = await Promise.all([
      fbGet('production_log').catch(() => []),
      fbGet('animals'),
    ]);
    _prodData   = prod || [];
    _animalsLst = (animals || []).filter(a => a.status === 'alive');
  } catch (e) {
    toast('خطأ في التحميل: ' + e.message, 'error');
  }
}

// ── Main render ───────────────────────────────────────────
function renderMain() {
  const el = document.getElementById('content');
  const stats = computeStats();

  // ── Analytics Row (Overview level) — NEW, was missing. ──
  // The existing "Summary" tab already has monthly milk/wool trend and a
  // breed-weight comparison, but both are Chart.js-based and hidden behind
  // a tab click. This adds always-visible, at-a-glance equivalents right
  // after the KPI row — matching dashboard.html/health.js's information
  // architecture (KPIs, then Analytics, immediately visible) — using the
  // exact SVG primitives named for reuse (renderLineChartSVG,
  // renderGroupedBarSVG), NOT Chart.js. This does not replace, remove, or
  // alter any of the existing tab-level Chart.js visualizations below.
  const arMonthsP=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const nowP=new Date();
  const trendMonths=[]; const compareMonths=[];
  for(let i=5;i>=0;i--){
    const d=new Date(nowP.getFullYear(),nowP.getMonth()-i,1);
    const mStr=d.toISOString().slice(0,7);
    const monthTotal=_prodData.filter(p=>(p.date||'').startsWith(mStr)).reduce((t,p)=>t+(+p.quantity||0),0);
    trendMonths.push({ label: arMonthsP[d.getMonth()].slice(0,3), value: monthTotal });
    const milkTotal=_prodData.filter(p=>p.type==='milk'&&(p.date||'').startsWith(mStr)).reduce((t,p)=>t+(+p.quantity||0),0);
    const woolTotal=_prodData.filter(p=>p.type==='wool'&&(p.date||'').startsWith(mStr)).reduce((t,p)=>t+(+p.quantity||0),0);
    compareMonths.push({ label: arMonthsP[d.getMonth()].slice(0,3), values:[milkTotal,woolTotal] });
  }
  const prodTrendSvg=renderLineChartSVG(trendMonths,{color:'#3b82f6'});
  const prodCompareSvg=renderGroupedBarSVG(compareMonths,{colors:['#3b82f6','#f59e0b']});
  const analyticsRowHtml = `<div class="row g-3 mb-4">
    <div class="col-md-6">${renderChartContainer({ title:'اتجاه الإنتاج', subtitle:'إجمالي كل الأنواع — آخر 6 أشهر', chartHtml: prodTrendSvg||'', state: prodTrendSvg?'ready':'empty' })}</div>
    <div class="col-md-6">${renderChartContainer({ title:'مقارنة الإنتاج', subtitle:'الحليب مقابل الصوف — آخر 6 أشهر', chartHtml: prodCompareSvg||'', state: prodCompareSvg?'ready':'empty' })}</div>
  </div>`;

  el.innerHTML = `
  <!-- KPI Row (Analytics Template) -->
  <div class="row g-3 mb-4">
    <div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:'إنتاج الحليب اليوم', value: ar(stats.milkToday.toFixed(1)), unit:'ل', status:'normal' })}</div>
    <div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:'إجمالي الحليب (شهر)', value: ar(stats.milkMonth.toFixed(1)), unit:'ل', status:'normal' })}</div>
    <div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:'إنتاج الصوف (سنة)', value: ar(stats.woolYear.toFixed(1)), unit:'كجم', status:'normal' })}</div>
    <div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:'متوسط الوزن', value: stats.avgWeight ? ar(stats.avgWeight.toFixed(1)) : '—', unit: stats.avgWeight ? 'كجم' : '', status:'normal' })}</div>
    <div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:'الإناث المنتجة', value: ar(stats.activeFemales), status:'normal' })}</div>
    <div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:'سجلات الإنتاج', value: ar(_prodData.length), status: _prodData.length===0?'watch':'normal' })}</div>
  </div>

  ${analyticsRowHtml}

  <!-- Tab Navigation -->
  <div class="d-flex gap-2 flex-wrap mb-4" role="tablist" aria-label="فلاتر الإنتاج">
    ${[['milk','bi-droplet-fill','الحليب'],['wool','bi-scissors','الصوف'],['weight','bi-rulers','الأوزان'],['summary','bi-graph-up','ملخص']].map(([t,i,l]) =>
      `<button class="filter-btn${_tab===t?' active':''}" onclick="switchProdTab('${t}')" role="tab" aria-selected="${_tab===t}"><i class="bi ${i} me-1" aria-hidden="true"></i>${l}</button>`
    ).join('')}
    <button class="action-btn sm ms-auto" onclick="exportProduction()" aria-label="تصدير إلى Excel">
      <i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> Excel
    </button>
  </div>

  <!-- Tab content -->
  <div id="prod-tab-content"></div>

  <!-- Recent Activity (Analytics Template) — NEW, was missing. Reuses
       renderTimeline/renderTimelineItem exactly as dashboard.html/health.js;
       built from _prodData already loaded, no new Firebase call added. -->
  <div class="wonder-card mt-4">
    <h6 class="fw-bold mb-3" style="font-size:var(--text-lg)"><i class="bi bi-clock-history accent-text me-2"></i>النشاط الأخير</h6>
    ${(function(){
      const typeLabel={milk:'تسجيل حليب',wool:'تسجيل صوف',weight:'تسجيل وزن'};
      const recent=[..._prodData].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6);
      return recent.length?renderTimeline(recent.map(p=>renderTimelineItem({
        time: p.date||'',
        eventType: typeLabel[p.type]||p.type,
        entity: `${p.animal_breed||''}${p.animal_tag?' #'+p.animal_tag:''} — ${ar(+p.quantity||0)} ${p.unit==='liter'?'لتر':'كجم'}`,
      }))):`<div class="empty-state py-3"><i class="bi bi-clock-history"></i><p>لا يوجد نشاط مسجّل بعد</p></div>`;
    })()}
  </div>

  <!-- FAB for mobile quick entry -->
  <button class="fab-btn" onclick="openProdEntry()" aria-label="تسجيل إنتاج سريع" title="تسجيل إنتاج"
    style="position:fixed;bottom:80px;left:20px;width:56px;height:56px;border-radius:50%;
      background:var(--orange);color:#fff;border:none;box-shadow:0 8px 24px rgba(16,185,129,.5);
      font-size:1.4rem;cursor:pointer;z-index:1000;display:none;align-items:center;justify-content:center">
    <i class="bi bi-plus-lg"></i>
  </button>
  <style>
    @media (max-width:768px) { .fab-btn { display:flex !important; } }
  </style>`;

  renderTab();
}

// ── Compute Stats ─────────────────────────────────────────
function computeStats() {
  const today = todayStr();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const yearAgo  = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const monthStr = monthAgo.toISOString().slice(0,10);
  const yearStr  = yearAgo.toISOString().slice(0,10);

  const milk = _prodData.filter(p => p.type === 'milk');
  const wool = _prodData.filter(p => p.type === 'wool');
  const weight = _prodData.filter(p => p.type === 'weight');

  return {
    milkToday: milk.filter(p => p.date === today).reduce((t,p) => t + (+p.quantity||0), 0),
    milkMonth: milk.filter(p => p.date >= monthStr).reduce((t,p) => t + (+p.quantity||0), 0),
    woolYear:  wool.filter(p => p.date >= yearStr).reduce((t,p) => t + (+p.quantity||0), 0),
    avgWeight: weight.length ? weight.reduce((t,p) => t + (+p.quantity||0), 0) / weight.length : 0,
    activeFemales: _animalsLst.filter(a => a.gender === 'female' && a.purpose !== 'birth').length,
  };
}

// ── Tab switching ─────────────────────────────────────────
window.switchProdTab = function(tab) {
  _tab = tab;
  document.querySelectorAll('.filter-btn[role="tab"]').forEach(b => {
    const isActive = b.textContent.trim().includes({milk:'الحليب',wool:'الصوف',weight:'الأوزان',summary:'ملخص'}[tab]);
    b.classList.toggle('active', isActive);
    b.setAttribute('aria-selected', isActive);
  });
  renderTab();
};

function renderTab() {
  const el = document.getElementById('prod-tab-content');
  if (!el) return;
  if (_tab === 'milk')    renderMilkTab(el);
  if (_tab === 'wool')    renderWoolTab(el);
  if (_tab === 'weight')  renderWeightTab(el);
  if (_tab === 'summary') renderSummaryTab(el);
}

// ══════════════════════════════════════════
//  Tab: MILK
// ══════════════════════════════════════════
function renderMilkTab(el) {
  const milk = _prodData.filter(p => p.type === 'milk').sort((a,b) => (b.date||'').localeCompare(a.date||''));

  // Daily totals (last 14 days)
  const daily = {};
  const now = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    daily[d.toISOString().slice(0,10)] = 0;
  }
  milk.forEach(p => { if (daily[p.date] !== undefined) daily[p.date] += +p.quantity || 0; });

  el.innerHTML = `
  <div class="mb-4">
    ${renderChartContainer({
      title: 'إنتاج الحليب', subtitle: 'آخر 14 يوم',
      chartHtml: `<div style="position:relative;height:220px"><canvas id="milk-chart" aria-label="مخطط إنتاج الحليب"></canvas></div>`,
      state: milk.length ? 'ready' : 'empty',
      emptyMsg: 'لا توجد سجلات حليب بعد — اضغط تسجيل إنتاج'
    })}
  </div>

  ${milk.length ? renderDataTableWrapper({
    title: 'سجلات الحليب الأخيرة',
    headers: ['التاريخ','الحيوان','السلالة','الكمية (لتر)','مسجّل بواسطة','ملاحظات',''],
    rowsHtml: milk.slice(0, 50).map(p => `
      <tr>
        <td class="text-gray">${p.date || '—'}</td>
        <td class="fw-bold">${p.animal_tag || '—'}</td>
        <td class="text-gray">${p.animal_breed || '—'}</td>
        <td class="green-text fw-bold">${ar(+p.quantity || 0)} ل</td>
        <td class="text-gray">${p.recorded_by || '—'}</td>
        <td class="text-gray" style="font-size:.75rem">${p.notes || '—'}</td>
        <td><button class="action-btn sm danger" onclick="delProdRec('${p._id}')" aria-label="حذف السجل" style="padding:3px 8px"><i class="bi bi-trash" aria-hidden="true"></i></button></td>
      </tr>`).join('')
  }) : ''}`;

  // Draw chart
  if (milk.length) {
    setTimeout(() => {
      const labels = Object.keys(daily).map(d => d.slice(5));  // MM-DD
      const data   = Object.values(daily);
      if (_chart) _chart.destroy();
      _chart = new Chart(document.getElementById('milk-chart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'لتر/يوم',
            data: data,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.15)',
            fill: true,
            tension: 0.35,
            pointRadius: 4,
            pointBackgroundColor: '#3b82f6',
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#b0b0b0', font: { family:'Cairo' } } } },
          scales: {
            x: { ticks: { color: '#b0b0b0' }, grid: { display:false } },
            y: { ticks: { color: '#b0b0b0' }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
          },
        },
      });
    }, 50);
  }
}

// ══════════════════════════════════════════
//  Tab: WOOL
// ══════════════════════════════════════════
function renderWoolTab(el) {
  const wool = _prodData.filter(p => p.type === 'wool').sort((a,b) => (b.date||'').localeCompare(a.date||''));
  const totalKg = wool.reduce((t,p) => t + (+p.quantity || 0), 0);

  // Group by month for last 12 months
  const monthly = {};
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly[d.toISOString().slice(0,7)] = 0;
  }
  wool.forEach(p => {
    const k = (p.date||'').slice(0,7);
    if (monthly[k] !== undefined) monthly[k] += +p.quantity || 0;
  });

  el.innerHTML = `
  <div class="row g-3 mb-4">
    <div class="col-md-4">${renderKPICard({ label:'إجمالي الصوف المنتج', value: ar(totalKg.toFixed(1)), unit:'كجم', status:'normal' })}</div>
    <div class="col-md-4">${renderKPICard({ label:'عملية جز', value: ar(wool.length), status:'normal' })}</div>
    <div class="col-md-4">${renderKPICard({ label:'متوسط/عملية', value: wool.length ? ar((totalKg/wool.length).toFixed(2)) : '٠', unit:'كجم', status:'normal' })}</div>
  </div>

  <div class="mb-4">
    ${renderChartContainer({
      title: 'إنتاج الصوف', subtitle: 'شهريًا',
      chartHtml: `<div style="position:relative;height:220px"><canvas id="wool-chart" aria-label="مخطط إنتاج الصوف الشهري"></canvas></div>`,
      state: wool.length ? 'ready' : 'empty',
      emptyMsg: 'لا توجد سجلات صوف بعد'
    })}
  </div>

  ${wool.length ? renderDataTableWrapper({
    title: 'سجلات الصوف',
    headers: ['التاريخ','الحيوان','السلالة','الكمية (كجم)','مسجّل بواسطة','ملاحظات',''],
    rowsHtml: wool.slice(0, 50).map(p => `
      <tr>
        <td class="text-gray">${p.date || '—'}</td>
        <td class="fw-bold">${p.animal_tag || '—'}</td>
        <td class="text-gray">${p.animal_breed || '—'}</td>
        <td style="color:var(--yellow);font-weight:700">${ar((+p.quantity||0).toFixed(1))} كجم</td>
        <td class="text-gray">${p.recorded_by || '—'}</td>
        <td class="text-gray" style="font-size:.75rem">${p.notes || '—'}</td>
        <td><button class="action-btn sm danger" onclick="delProdRec('${p._id}')" aria-label="حذف السجل" style="padding:3px 8px"><i class="bi bi-trash" aria-hidden="true"></i></button></td>
      </tr>`).join('')
  }) : ''}`;

  if (wool.length) {
    setTimeout(() => {
      const labels = Object.keys(monthly).map(k => {
        const [, mo] = k.split('-');
        return ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][+mo - 1];
      });
      const data = Object.values(monthly);
      if (_chart) _chart.destroy();
      _chart = new Chart(document.getElementById('wool-chart'), {
        type: 'bar',
        data: {
          labels: labels,
          datasets: [{ label: 'كجم', data: data, backgroundColor: 'rgba(245,158,11,0.75)', borderRadius: 5 }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#b0b0b0', font: { family:'Cairo' } } } },
          scales: {
            x: { ticks: { color: '#b0b0b0' }, grid: { display:false } },
            y: { ticks: { color: '#b0b0b0' }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
          },
        },
      });
    }, 50);
  }
}

// ══════════════════════════════════════════
//  Tab: WEIGHT
// ══════════════════════════════════════════
function renderWeightTab(el) {
  const weight = _prodData.filter(p => p.type === 'weight').sort((a,b) => (b.date||'').localeCompare(a.date||''));

  // Group by breed - average weights
  const byBreed = {};
  weight.forEach(p => {
    const k = p.animal_breed || 'غير محدد';
    if (!byBreed[k]) byBreed[k] = [];
    byBreed[k].push(+p.quantity || 0);
  });
  const breedAvg = Object.entries(byBreed).map(([breed, weights]) => ({
    breed,
    avg: weights.reduce((t,w) => t + w, 0) / weights.length,
    count: weights.length,
  })).sort((a,b) => b.count - a.count);

  el.innerHTML = `
  <div class="mb-4">
    ${renderChartContainer({
      title: 'متوسط الأوزان', subtitle: 'حسب السلالة',
      chartHtml: `<div style="position:relative;height:240px"><canvas id="weight-chart" aria-label="مخطط متوسط الأوزان بالسلالة"></canvas></div>`,
      state: breedAvg.length ? 'ready' : 'empty',
      emptyMsg: 'لا توجد سجلات أوزان بعد'
    })}
  </div>

  ${weight.length ? renderDataTableWrapper({
    title: 'سجلات الأوزان',
    headers: ['التاريخ','الحيوان','السلالة','الوزن (كجم)','مسجّل بواسطة','ملاحظات',''],
    rowsHtml: weight.slice(0, 60).map(p => `
      <tr>
        <td class="text-gray">${p.date || '—'}</td>
        <td class="fw-bold">${p.animal_tag || '—'}</td>
        <td class="text-gray">${p.animal_breed || '—'}</td>
        <td class="green-text fw-bold">${ar((+p.quantity||0).toFixed(1))} كجم</td>
        <td class="text-gray">${p.recorded_by || '—'}</td>
        <td class="text-gray" style="font-size:.75rem">${p.notes || '—'}</td>
        <td><button class="action-btn sm danger" onclick="delProdRec('${p._id}')" aria-label="حذف السجل" style="padding:3px 8px"><i class="bi bi-trash" aria-hidden="true"></i></button></td>
      </tr>`).join('')
  }) : ''}`;

  if (breedAvg.length) {
    setTimeout(() => {
      if (_chart) _chart.destroy();
      _chart = new Chart(document.getElementById('weight-chart'), {
        type: 'bar',
        data: {
          labels: breedAvg.map(b => b.breed),
          datasets: [
            { label: 'متوسط الوزن (كجم)', data: breedAvg.map(b => b.avg.toFixed(1)), backgroundColor: 'rgba(52,211,153,0.75)', borderRadius: 4 },
            { label: 'عدد القياسات',      data: breedAvg.map(b => b.count),         backgroundColor: 'rgba(59,130,246,0.6)', borderRadius: 4, yAxisID: 'y1' },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#b0b0b0', font: { family:'Cairo' } } } },
          scales: {
            x:  { ticks: { color: '#b0b0b0' }, grid: { display:false } },
            y:  { ticks: { color: '#b0b0b0' }, grid: { color: 'rgba(255,255,255,0.06)' }, title: { display: true, text: 'متوسط الوزن (كجم)', color:'#b0b0b0' } },
            y1: { position: 'right', ticks: { color: '#b0b0b0' }, grid: { display: false }, title: { display: true, text: 'عدد القياسات', color:'#b0b0b0' } },
          },
        },
      });
    }, 50);
  }
}

// ══════════════════════════════════════════
//  Tab: SUMMARY (cross-type)
// ══════════════════════════════════════════
function renderSummaryTab(el) {
  // Top producers (milk)
  const milk = _prodData.filter(p => p.type === 'milk');
  const animalMilk = {};
  milk.forEach(p => {
    const k = p.animal_tag || 'غير محدد';
    if (!animalMilk[k]) animalMilk[k] = { tag: k, breed: p.animal_breed, total: 0, count: 0 };
    animalMilk[k].total += +p.quantity || 0;
    animalMilk[k].count += 1;
  });
  const topMilk = Object.values(animalMilk).sort((a,b) => b.total - a.total).slice(0, 8);

  // Production by month (all types)
  const monthly = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthly[d.toISOString().slice(0,7)] = { milk: 0, wool: 0, weight: 0 };
  }
  _prodData.forEach(p => {
    const k = (p.date||'').slice(0,7);
    if (monthly[k]) monthly[k][p.type] = (monthly[k][p.type] || 0) + (+p.quantity || 0);
  });

  el.innerHTML = `
  <div class="row g-3 mb-4">
    <div class="col-md-6">
      ${(function(){
        // MIGRATED from a manual <table class="tbl"> inside renderSectionContainer
        // to renderDataTableWrapper (Repository 3, Phase 3 — Table Governance).
        // Verified before migrating: this table has no sorting, filtering,
        // row actions, pagination, or export of its own — a static top-8
        // ranked list — so renderDataTableWrapper's identical <table class="tbl">
        // output plus its title/empty-state chrome preserves 100% of the
        // existing behaviour, nothing is downgraded.
        return renderDataTableWrapper({
          title: 'أعلى منتجي الحليب',
          headers: ['#','الحيوان','السلالة','إجمالي','متوسط/يوم'],
          state: topMilk.length ? 'ready' : 'empty',
          emptyMsg: 'لا توجد بيانات',
          rowsHtml: topMilk.map((a, i) => `
            <tr>
              <td class="fw-bold accent-text">${ar(i+1)}</td>
              <td class="fw-bold">${a.tag}</td>
              <td class="text-gray">${a.breed || '—'}</td>
              <td class="blue-text fw-bold">${ar(a.total.toFixed(1))} ل</td>
              <td class="text-gray">${ar((a.total/a.count).toFixed(2))} ل</td>
            </tr>`).join('')
        });
      })()}
    </div>
    <div class="col-md-6">
      ${renderChartContainer({
        title: 'الإنتاج الشهري', subtitle: 'آخر 6 أشهر',
        chartHtml: `<div style="position:relative;height:240px"><canvas id="summary-chart"></canvas></div>`,
        state: _prodData.length ? 'ready' : 'empty',
        emptyMsg: 'لا توجد بيانات'
      })}
    </div>
  </div>`;

  if (_prodData.length) {
    setTimeout(() => {
      const mKeys = Object.keys(monthly);
      const labels = mKeys.map(k => {
        const [, mo] = k.split('-');
        return ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][+mo - 1];
      });
      if (_chart) _chart.destroy();
      _chart = new Chart(document.getElementById('summary-chart'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: 'الحليب (ل)', data: mKeys.map(k => monthly[k].milk),   borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.35 },
            { label: 'الصوف (كجم)', data: mKeys.map(k => monthly[k].wool),   borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)',  fill: true, tension: 0.35 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#b0b0b0', font: { family:'Cairo' } } } },
          scales: {
            x: { ticks: { color: '#b0b0b0' }, grid: { display:false } },
            y: { ticks: { color: '#b0b0b0' }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true },
          },
        },
      });
    }, 50);
  }
}

// ══════════════════════════════════════════
//  Entry Modal
// ══════════════════════════════════════════
window.openProdEntry = function() {
  const u = getUser();
  const tags = _animalsLst.slice(0, 200).map(a => ({
    id:    a._id,
    tag:   a.tag || a._id.slice(0,6),
    breed: a.breed || '',
    label: (a.tag ? '#' + a.tag + ' • ' : '') + (a.breed||'') + ' • ' + (a.gender === 'female' ? '♀' : '♂'),
  }));
  showModal(
    '<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px">' +
      '<h4><i class="bi bi-plus-circle accent-text"></i> تسجيل إنتاج جديد</h4>' +
      '<div class="row g-2">' +
        '<div class="col-6">' +
          '<label>نوع الإنتاج *</label>' +
          '<select class="field" id="pr-type" onchange="_prUpdateUnit()" aria-label="نوع الإنتاج">' +
            '<option value="milk">🥛 حليب (لتر/يوم)</option>' +
            '<option value="wool">✂️ صوف (كجم/جزة)</option>' +
            '<option value="weight">⚖️ وزن (كجم)</option>' +
          '</select>' +
        '</div>' +
        '<div class="col-6">' +
          '<label>التاريخ *</label>' +
          '<input type="date" class="field" id="pr-date" value="' + todayStr() + '" aria-label="تاريخ التسجيل">' +
        '</div>' +
      '</div>' +
      '<label>الحيوان *</label>' +
      '<select class="field" id="pr-animal" aria-label="اختيار الحيوان">' +
        '<option value="">— اختر حيواناً —</option>' +
        tags.map(function(t){ return '<option value="' + t.id + '">' + t.label + '</option>'; }).join('') +
      '</select>' +
      '<div class="row g-2">' +
        '<div class="col-6">' +
          '<label>الكمية <span id="pr-unit">(لتر)</span> *</label>' +
          '<input type="number" class="field" id="pr-qty" step="0.1" min="0" placeholder="2.5" aria-label="كمية الإنتاج">' +
        '</div>' +
        '<div class="col-6">' +
          '<label>مسجّل بواسطة</label>' +
          '<input class="field" id="pr-by" value="' + (u?.name || '') + '" aria-label="اسم المسجّل">' +
        '</div>' +
      '</div>' +
      '<label>ملاحظات</label>' +
      '<input class="field" id="pr-notes" placeholder="اختياري" aria-label="ملاحظات">' +
      '<div class="d-flex gap-2 justify-content-end mt-3">' +
        '<button class="action-btn" onclick="closeModal()" aria-label="إلغاء">إلغاء</button>' +
        '<button class="action-btn primary" onclick="submitProd()" aria-label="حفظ السجل"><i class="bi bi-check-lg" aria-hidden="true"></i> حفظ</button>' +
      '</div>' +
    '</div>'
  );
};

window._prUpdateUnit = function() {
  const t = document.getElementById('pr-type')?.value;
  const u = document.getElementById('pr-unit');
  if (u) u.textContent = t === 'milk' ? '(لتر)' : '(كجم)';
};

window.submitProd = async function() {
  const type   = document.getElementById('pr-type').value;
  const date   = document.getElementById('pr-date').value;
  const aId    = document.getElementById('pr-animal').value;
  const qty    = parseFloat(document.getElementById('pr-qty').value);
  const by     = document.getElementById('pr-by').value.trim();
  const notes  = document.getElementById('pr-notes').value.trim();

  if (!aId || !date || isNaN(qty) || qty <= 0) {
    toast('يرجى تعبئة جميع الحقول الإلزامية', 'error'); return;
  }

  const animal = _animalsLst.find(a => a._id === aId);
  if (!animal) { toast('الحيوان غير موجود', 'error'); return; }

  // Validate: milk only from females
  if (type === 'milk' && animal.gender !== 'female') {
    if (!confirm('هذا حيوان ذكر — هل تريد المتابعة؟ (الحليب عادة للإناث)')) return;
  }

  closeModal();
  try {
    await fbPost('production_log', {
      type:   type,
      date:   date,
      animal_id:    animal._id,
      animal_tag:   animal.tag || '—',
      animal_breed: animal.breed || '—',
      animal_species: animal.species,
      animal_gender:  animal.gender,
      quantity:    qty,
      unit:        type === 'milk' ? 'liter' : 'kg',
      recorded_by: by || null,
      notes:       notes || null,
      created_at:  new Date().toISOString(),
    });

    // Also update animal's current_weight if type=weight
    if (type === 'weight') {
      try { await fbPatch('animals', animal._id, { current_weight: qty, weight_updated: date }); } catch(e) {}
      try { await fbPost('animals/'+animal._id+'/weights', { weight: qty, date: date, notes: notes || null }); } catch(e) {}
      // Sprint 2, Epic 2: attach weight intelligence -- additive only,
      // does not change the writes above. Never blocks on failure.
      if (window.evaluateWeightAlert) { window.evaluateWeightAlert(animal._id, animal.tag, animal.barn).catch(function(){}); }
    } else if (type === 'milk' || type === 'wool') {
      // Sprint 4, Epic 4: attach production intelligence -- additive
      // only, milk/wool exclusively (weight is Sprint 2's domain,
      // handled in the branch above, never here). Never blocks on failure.
      if (window.evaluateProductionAlert) { window.evaluateProductionAlert(animal._id, animal.tag, type, animal.barn).catch(function(){}); }
      // Sprint 11 (v1.4): recommendation only -- Production Intelligence
      // (Sprint 4) already self-resolves, so there is no stale reminder to close here.
      if (window.completeWorkflow) { window.completeWorkflow('production', {sourceId:animal._id, animalId:animal._id, animalTag:animal.tag, barn:animal.barn, productionType:type}).then(function(r){ if(r&&r.recommendation&&r.recommendation.text&&r.recommendation.actionable!==false) toast('💡 '+r.recommendation.text,'info'); }).catch(function(){}); }
    }

    const typeLabel = { milk:'حليب', wool:'صوف', weight:'وزن' }[type];
    await logActivity('add', 'production_log', `تسجيل ${typeLabel}: ${animal.tag||animal.breed} = ${qty}`);
    toast(`✅ تم تسجيل ${typeLabel} — ${ar(qty)} ${type === 'milk' ? 'لتر' : 'كجم'}`);

    await loadData();
    renderMain();
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

window.delProdRec = async function(id) {
  if (!can('animals')) { toast('ليس لديك صلاحية لتنفيذ هذا الإجراء', 'error'); return; }
  if (!id || !confirm('حذف هذا السجل نهائياً؟')) return;
  try {
    await fbDelete('production_log', id);
    toast('تم الحذف');
    await loadData();
    renderMain();
  } catch (e) { toast('خطأ: ' + e.message, 'error'); }
};

// ══════════════════════════════════════════
//  Export
// ══════════════════════════════════════════
window.exportProduction = function() {
  if (typeof XLSX === 'undefined') {
    // Load SheetJS dynamically
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => exportProduction();
    document.head.appendChild(s);
    toast('جاري تحميل مكتبة Excel...', 'info');
    return;
  }
  const wb = XLSX.utils.book_new();
  const rows = [
    ['التاريخ','نوع الإنتاج','رقم الحيوان','السلالة','الجنس','الكمية','الوحدة','مسجّل بواسطة','ملاحظات'],
    ..._prodData.map(p => [
      p.date || '',
      { milk:'حليب', wool:'صوف', weight:'وزن' }[p.type] || p.type,
      p.animal_tag || '',
      p.animal_breed || '',
      p.animal_gender === 'male' ? 'ذكر' : 'أنثى',
      +p.quantity || 0,
      p.unit === 'liter' ? 'لتر' : 'كجم',
      p.recorded_by || '',
      p.notes || '',
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{wch:12},{wch:12},{wch:14},{wch:14},{wch:8},{wch:10},{wch:8},{wch:14},{wch:20}];
  XLSX.utils.book_append_sheet(wb, ws, 'الإنتاج');
  XLSX.writeFile(wb, 'production-' + todayStr() + '.xlsx');
  toast('تم التصدير ✓');
  logActivity('export', 'production_log', 'تصدير سجل الإنتاج (' + _prodData.length + ' سجل)');
};
