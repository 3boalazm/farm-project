'use strict';
// Analytics page (v1.3). Dashboard = today. Analytics = historical
// insight -- reuses computeFarmAnalytics()/generateAnalyticsInsights()
// (shared.js) verbatim. This file computes NOTHING itself beyond
// wiring the granularity selector and rendering what the engine returns.

var _granularity = 'month';
var _periodCount = 6;
var _analyticsData = null;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  if (!can('reports')) {
    document.body.innerHTML='<div class="page-wrap"><div class="empty-state" style="padding-top:100px"><i class="bi bi-shield-x" style="font-size:3rem;display:block;margin-bottom:10px;opacity:.4"></i><p>غير مصرح بالوصول</p><a href="dashboard.html" class="action-btn">الرئيسية</a></div></div>';
    return;
  }
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent = s.farmName;
  renderNavbar('analytics.html');
  renderRelatedLinks('analytics.js');
  renderPageHeaderV2({
    title: '<i class="bi bi-bar-chart-line-fill accent-text"></i> التحليلات',
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'التحليلات'}],
    description: 'رؤى تاريخية إحصائية — دعم قرار، وليس تشخيصًا',
    secondaryActions: `<button class="action-btn" onclick="shareAnalyticsWhatsApp()" style="background:rgba(37,211,102,.1);border-color:rgba(37,211,102,.35);color:#25d366">
       <i class="bi bi-whatsapp"></i> واتساب
     </button>`,
    primaryAction: `<button class="action-btn primary" onclick="exportAnalyticsExcel()"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button>`
  });
  const el = document.getElementById('content');
  loadChartJS(() => loadAndRender(el));
});

async function loadAndRender(el) {
  renderLoading(el);
  _analyticsData = await window.computeFarmAnalytics(_granularity, _periodCount);
  renderAnalyticsPage(el);
}

window.switchGranularity = function(g) {
  _granularity = g;
  _periodCount = g==='week' ? 8 : g==='quarter' ? 4 : g==='year' ? 5 : 6;
  loadAndRender(document.getElementById('content'));
};

function renderAnalyticsPage(el) {
  const a = _analyticsData;
  if (!a) { el.innerHTML = '<div class="empty-state py-5"><i class="bi bi-inbox"></i><p>تعذّر تحميل التحليلات</p></div>'; return; }

  const insights = window.generateAnalyticsInsights(a);
  const latestProd = a.productivityIndex[a.productivityIndex.length-1];
  const latestHealth = a.herdHealthTrend[a.herdHealthTrend.length-1];
  const latestOps = a.operationalEfficiency[a.operationalEfficiency.length-1];
  const latestRisk = a.riskTrend[a.riskTrend.length-1];

  el.innerHTML = `
  <div class="d-flex gap-2 flex-wrap mb-4">
    ${[['week','أسبوعي'],['month','شهري'],['quarter','فصلي'],['year','سنوي']].map(([g,l])=>`<button class="filter-btn${_granularity===g?' active':''}" onclick="switchGranularity('${g}')">${l}</button>`).join('')}
  </div>

  ${insights.length ? `
  <div class="wonder-card mb-4 p-3" style="border-inline-start:3px solid var(--blue)">
    <div class="text-gray mb-2" style="font-size:.8rem"><i class="bi bi-lightbulb-fill me-1"></i>رؤى محسوبة من البيانات الفعلية (دعم قرار، وليس تشخيصًا)</div>
    <div style="font-size:.85rem;line-height:1.9">${insights.map(i=>`<i class="bi bi-dot"></i>${i.text} <small class="text-gray">(${i.evidence})</small>`).join('<br>')}</div>
  </div>` : ''}

  <div class="row g-3 mb-4">
    ${[
      {l:'مؤشر الإنتاجية',v:latestProd?ar(latestProd.index):'—',status:latestProd&&latestProd.index>=60?'normal':'watch'},
      {l:'معدل التعافي الصحي',v:latestHealth&&latestHealth.recoveryRate!==null?ar(latestHealth.recoveryRate)+'٪':'—',status:'normal'},
      {l:'إنجاز المهام',v:latestOps&&latestOps.completionRate!==null?ar(latestOps.completionRate)+'٪':'—',status:'normal'},
      {l:'تنبيهات الفترة الأخيرة',v:latestRisk?ar(latestRisk.totalAlerts):'—',status:latestRisk&&latestRisk.totalAlerts>0?'watch':'normal'},
    ].map(k=>`<div class="col-6 col-md-3">${renderKPICard({label:k.l, value:k.v, status:k.status})}</div>`).join('')}
  </div>

  <div class="row g-3 mb-4">
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-speedometer2 accent-text"></i> مؤشر الإنتاجية</h6><div style="position:relative;height:220px"><canvas id="chart-productivity"></canvas></div></div></div>
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-droplet-fill accent-text"></i> اتجاه الإنتاج</h6><div style="position:relative;height:220px"><canvas id="chart-production"></canvas></div></div></div>
  </div>
  <div class="row g-3 mb-4">
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-heart-pulse-fill accent-text"></i> اتجاه صحة القطيع</h6><div style="position:relative;height:220px"><canvas id="chart-health"></canvas></div></div></div>
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-exclamation-triangle-fill accent-text"></i> اتجاه المخاطر</h6><div style="position:relative;height:220px"><canvas id="chart-risk"></canvas></div></div></div>
  </div>
  <div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-check2-square accent-text"></i> الكفاءة التشغيلية</h6><div style="position:relative;height:220px"><canvas id="chart-ops"></canvas></div></div>
  <div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-cash-stack accent-text"></i> الاتجاه المالي</h6><div style="position:relative;height:220px"><canvas id="chart-finance"></canvas></div></div>
  <div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-boxes accent-text"></i> استهلاك المخزون</h6><div style="position:relative;height:220px"><canvas id="chart-inventory"></canvas></div></div>

  ${renderDataTableWrapper({
    title:'ملخص الفترات', headers:['الفترة','مؤشر الإنتاجية','تعافي صحي','إنجاز مهام','تنبيهات'],
    rowsHtml: a.productivityIndex.map((p,idx)=>`<tr><td class="fw-bold">${p.label}</td><td>${ar(p.index)}</td><td>${a.herdHealthTrend[idx].recoveryRate!==null?ar(a.herdHealthTrend[idx].recoveryRate)+'٪':'—'}</td><td>${a.operationalEfficiency[idx].completionRate!==null?ar(a.operationalEfficiency[idx].completionRate)+'٪':'—'}</td><td>${ar(a.riskTrend[idx].totalAlerts)}</td></tr>`).join('')
  })}`;

  setTimeout(() => {
    if (!window.Chart) return;
    var labels = a.productivityIndex.map(p=>p.label);
    // Sprint 12 (v1.5): one projected period appended, using the SAME
    // simple 2-point linear technique forecastWeight() already applies
    // per-animal (last value + (last - previous)) -- applied here to
    // the herd-aggregate milk series from computeFarmAnalytics(), not a
    // new statistical method. Historical bars stay bars; the
    // projection is a separate, dashed LINE dataset overlaid via
    // Chart.js's own mixed-type support (still one mkChart() call).
    var milkSeries = a.productionTrend.map(p=>p.milkTotal);
    var projectedMilk = null;
    if (milkSeries.length>=2) {
      var lastM=milkSeries[milkSeries.length-1], prevM=milkSeries[milkSeries.length-2];
      projectedMilk = Math.max(0, Math.round((lastM+(lastM-prevM))*10)/10);
    }
    var forecastLabels = labels.concat(projectedMilk!==null ? ['متوقع'] : []);
    var milkBarData = milkSeries.concat(projectedMilk!==null ? [null] : []);
    var milkLineData = projectedMilk!==null ? labels.map(()=>null).concat([projectedMilk]) : null;
    if (milkLineData) { milkLineData[labels.length-1] = milkSeries[milkSeries.length-1]; } // connect the dashed segment to the last real point
    mkChart('chart-productivity', {type:'line', data:{labels:labels, datasets:[{label:'المؤشر', data:a.productivityIndex.map(p=>p.index), borderColor:'#00e676', backgroundColor:'rgba(0,230,118,0.1)', fill:true, tension:0.4}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:textClr()},grid:{display:false}}, y:{ticks:{color:textClr()},grid:{color:gridClr()},min:0,max:100}}}});
    mkChart('chart-production', {type:'bar', data:{labels:forecastLabels, datasets:[
      {type:'bar', label:'حليب (فعلي)', data:milkBarData, backgroundColor:'#2196f3'},
      ...(milkLineData ? [{type:'line', label:'متوقع', data:milkLineData, borderColor:'#2196f3', borderDash:[6,4], backgroundColor:'transparent', pointRadius:4, tension:0}] : []),
    ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textClr()}}}, scales:{x:{ticks:{color:textClr()},grid:{display:false}}, y:{ticks:{color:textClr()},grid:{color:gridClr()}}}}});
    mkChart('chart-health', {type:'line', data:{labels:labels, datasets:[{label:'معدل التعافي ٪', data:a.herdHealthTrend.map(h=>h.recoveryRate), borderColor:'#9c27b0', backgroundColor:'rgba(156,39,176,0.1)', fill:true, tension:0.4}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{ticks:{color:textClr()},grid:{display:false}}, y:{ticks:{color:textClr()},grid:{color:gridClr()},min:0,max:100}}}});
    mkChart('chart-risk', {type:'bar', data:{labels:labels, datasets:[{label:'وزن', data:a.riskTrend.map(r=>r.weightAlerts), backgroundColor:'#f44336'},{label:'إنتاج', data:a.riskTrend.map(r=>r.productionAlerts), backgroundColor:'#ff9800'}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textClr()}}}, scales:{x:{ticks:{color:textClr()},grid:{display:false},stacked:true}, y:{ticks:{color:textClr()},grid:{color:gridClr()},stacked:true}}}});
    mkChart('chart-ops', {type:'radar', data:{labels:['إنجاز المهام','الأتمتة'], datasets:a.operationalEfficiency.map((o,i)=>({label:o.label, data:[o.completionRate||0, o.automationRate||0], borderColor:CHART_COLORS[i%CHART_COLORS.length], backgroundColor:CHART_COLORS[i%CHART_COLORS.length]+'22'}))}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textClr()}}}, scales:{r:{ticks:{color:textClr(),backdropColor:'transparent'},grid:{color:gridClr()},pointLabels:{color:textClr()},min:0,max:100}}}});
  }, 50);
  renderFinanceTrendChart();
  renderInventoryTrendChart();
}

// Sprint 13 (v1.6): Financial Trends -- reuses window.computeFinanceTrend()
// verbatim (itself a thin caller of Sprint 10's bucketByPeriod()), same
// granularity the page is currently showing, same mkChart() wrapper.
// Sprint 14 (v1.7): Inventory consumption trend -- reuses
// window.bucketByPeriod() (Sprint 10) directly on feed_consumption,
// same granularity the page is currently showing. No new bucketing engine.
async function renderInventoryTrendChart() {
  if (!window.bucketByPeriod || !window.Chart) return;
  try {
    const consumption = await fbGet('feed_consumption').catch(()=>[]);
    const buckets = window.bucketByPeriod(consumption, 'date', _granularity, _periodCount);
    const ilabels = buckets.map(b=>b.label);
    const kgPerPeriod = buckets.map(b=>b.records.reduce((s,c)=>s+(+c.quantity_kg||0),0));
    mkChart('chart-inventory', {type:'bar', data:{labels:ilabels, datasets:[{label:'استهلاك علف (كجم)', data:kgPerPeriod, backgroundColor:'#ff9800', borderRadius:4}]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textClr()}}}, scales:{x:{ticks:{color:textClr()},grid:{display:false}}, y:{ticks:{color:textClr()},grid:{color:gridClr()}}}}});
  } catch(e) {}
}

async function renderFinanceTrendChart() {
  if (!window.computeFinanceTrend || !window.Chart) return;
  try {
    const trend = await window.computeFinanceTrend(_granularity, _periodCount);
    if (!trend.length) return;
    const flabels = trend.map(t=>t.label);
    mkChart('chart-finance', {type:'line', data:{labels:flabels, datasets:[
      {label:'الإيرادات', data:trend.map(t=>t.revenue), borderColor:'#00e676', backgroundColor:'rgba(0,230,118,0.1)', fill:true, tension:0.4},
      {label:'المصروفات', data:trend.map(t=>t.expenses), borderColor:'#f44336', backgroundColor:'rgba(244,67,54,0.1)', fill:true, tension:0.4},
      {label:'صافي الربح', data:trend.map(t=>t.profit), borderColor:'#2196f3', backgroundColor:'transparent', borderDash:[4,3], tension:0.4},
    ]}, options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{labels:{color:textClr()}}}, scales:{x:{ticks:{color:textClr()},grid:{display:false}}, y:{ticks:{color:textClr()},grid:{color:gridClr()}}}}});
  } catch(e) {}
}

// Exports (v1.3): extends the existing Excel/WhatsApp mechanisms
// reports.js already established -- same libraries, same proportionate
// pattern. PDF explicitly not built (no PDF infrastructure exists
// anywhere in this app -- see docs/release/KNOWN-LIMITATIONS.md); this
// export function is written so a future PDF export could reuse the
// exact same _analyticsData this function already has, without any
// recalculation, if that infrastructure is ever added.
window.exportAnalyticsExcel = function() {
  const a = _analyticsData;
  if (!a) { toast('البيانات لم تُحمَّل بعد','error'); return; }
  if (typeof XLSX === 'undefined') { toast('مكتبة Excel غير متاحة','error'); return; }
  const wb = XLSX.utils.book_new();
  const ws1 = XLSX.utils.aoa_to_sheet([['الفترة','مؤشر الإنتاجية','إجمالي الحليب','إنجاز المهام٪'], ...a.productivityIndex.map(p=>[p.label,p.index,p.totalMilk,p.taskCompletionRate])]);
  XLSX.utils.book_append_sheet(wb, ws1, 'الإنتاجية');
  const ws2 = XLSX.utils.aoa_to_sheet([['الفترة','سجلات صحية','معدل التعافي٪','تحصينات مكتملة'], ...a.herdHealthTrend.map(h=>[h.label,h.healthRecordCount,h.recoveryRate,h.vaccinationsCompleted])]);
  XLSX.utils.book_append_sheet(wb, ws2, 'صحة القطيع');
  const ws3 = XLSX.utils.aoa_to_sheet([['الفترة','حليب','صوف','مواليد','نفوق'], ...a.productionTrend.map(p=>[p.label,p.milkTotal,p.woolTotal,p.births,p.deaths])]);
  XLSX.utils.book_append_sheet(wb, ws3, 'الإنتاج');
  const ws4 = XLSX.utils.aoa_to_sheet([['الفترة','إجمالي المهام','إنجاز٪','متوسط استجابة (ساعة)','أتمتة٪'], ...a.operationalEfficiency.map(o=>[o.label,o.totalTasks,o.completionRate,o.avgResponseHours,o.automationRate])]);
  XLSX.utils.book_append_sheet(wb, ws4, 'الكفاءة التشغيلية');
  const ws5 = XLSX.utils.aoa_to_sheet([['الفترة','تنبيهات وزن','تنبيهات إنتاج','الإجمالي'], ...a.riskTrend.map(r=>[r.label,r.weightAlerts,r.productionAlerts,r.totalAlerts])]);
  XLSX.utils.book_append_sheet(wb, ws5, 'المخاطر');
  XLSX.writeFile(wb, `farm-analytics-${todayStr()}.xlsx`);
  toast('تم تصدير التحليلات ✓');
  logActivity('export','analytics','تصدير تحليلات Excel — '+a.granularity);
};

window.shareAnalyticsWhatsApp = function() {
  const a = _analyticsData;
  if (!a) { toast('البيانات لم تُحمَّل بعد','error'); return; }
  const s = getSettings();
  const latestProd = a.productivityIndex[a.productivityIndex.length-1];
  const latestHealth = a.herdHealthTrend[a.herdHealthTrend.length-1];
  const insights = window.generateAnalyticsInsights(a);
  const text = [
    '📊 *تحليلات مزرعة '+s.farmName+'*',
    '📅 '+todayAr(),
    '',
    latestProd ? '📈 *مؤشر الإنتاجية:* '+ar(latestProd.index)+'/100 ('+latestProd.label+')' : '',
    latestHealth&&latestHealth.recoveryRate!==null ? '💚 *معدل التعافي الصحي:* '+ar(latestHealth.recoveryRate)+'٪' : '',
    '',
    insights.length ? '*أبرز الرؤى:*' : '',
    ...insights.slice(0,3).map(i=>'  • '+i.text),
    '',
    '_تم إنشاء هذا الملخص تلقائياً من نظام بيان المزرعة_',
  ].filter(Boolean).join('%0A');
  window.open('https://wa.me/?text='+encodeURIComponent(text), '_blank');
  logActivity('export','analytics','مشاركة تحليلات عبر واتساب');
};
