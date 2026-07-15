'use strict';

// ── Chart.js — dynamic load ───────────────────────────────
function loadChartJS(cb) {
  if (window.Chart) { cb(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
  s.onload = cb;
  s.onerror = function() { console.warn('Chart.js failed'); cb(); };
  document.head.appendChild(s);
}

const CHART_COLORS = ['#ff6b35','#00e676','#2196f3','#9c27b0','#ffc107','#f44336','#00bcd4','#8bc34a','#ff9800','#e91e63'];
const isDark   = () => !document.documentElement.classList.contains('light-mode');
const textClr  = () => isDark() ? '#b0b0b0' : '#64748b';
const gridClr  = () => isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
const _charts  = {};

function mkChart(id, cfg) {
  if (_charts[id]) _charts[id].destroy();
  var ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return null;
  return (_charts[id] = new Chart(ctx, cfg));
}

var _data = {};
var _tab  = 'herd';

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent  = s.farmName;
  renderNavbar('reports.html');
  renderRelatedLinks('reports.js');
  renderPageHeaderV2({
    title: '<i class="bi bi-graph-up accent-text"></i> التقارير والإحصائيات',
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'التقارير'}],
    secondaryActions: `<button class="action-btn" onclick="shareWhatsApp()" style="background:rgba(37,211,102,.1);border-color:rgba(37,211,102,.35);color:#25d366">
       <i class="bi bi-whatsapp"></i> واتساب
     </button>`,
    primaryAction: `<button class="action-btn primary" onclick="exportAllExcel()"><i class="bi bi-file-earmark-excel-fill"></i> Excel</button>`
  });
  const el = document.getElementById('content');
  renderLoading(el);
  const [animals,breeding,health,vaccines,finance,meds,feeds] = await Promise.all([
    fbGet('animals'),fbGet('breeding'),fbGet('health'),
    fbGet('vaccinations'),fbGet('finance'),
    fbGet('inventory_meds'),fbGet('inventory_feeds'),
  ]);
  _data = {animals,breeding,health,vaccines,finance,meds,feeds,s};
  window._reportData = _data;
  loadChartJS(() => renderReports(el, s));
});

// ── Metrics ───────────────────────────────────────────────
function computeMetrics(d) {
  const s = d.s; const curr = s.currency||'ج.م';
  const all=d.animals||[]; const alive=all.filter(a=>a.status==='alive'); const dead=all.filter(a=>a.status==='dead');
  const goats=alive.filter(a=>a.species==='goat'&&a.purpose!=='birth');
  const sheep=alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth');
  const births=alive.filter(a=>a.purpose==='birth');
  const allBreeds=[...(s.goatBreeds||[]),...(s.sheepBreeds||[])];
  const breedDist=allBreeds.map(b=>({breed:b,count:alive.filter(a=>a.breed===b).length})).filter(b=>b.count>0).sort((a,b)=>b.count-a.count);
  const barnNames=['ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const barnDist=barnNames.map(b=>({barn:b,count:alive.filter(a=>a.barn===b).length,breeds:[...new Set(alive.filter(a=>a.barn===b).map(a=>a.breed))]}));
  const br=d.breeding||[];
  const born=br.filter(r=>r.status==='born'); const preg=br.filter(r=>r.status==='pregnant'); const failed=br.filter(r=>r.status==='failed');
  const bTotal=br.filter(r=>r.status!=='pending').length||1;
  const fertilityRate=((born.length/bTotal)*100).toFixed(1);
  const twinRate=born.length?((born.filter(r=>r.offspring_count>=2).length/born.length)*100).toFixed(1):0;
  const totalBirths=born.reduce((t,r)=>t+(+r.offspring_count||0),0);
  const fin=d.finance||[];
  const income=fin.filter(r=>r.type==='income').reduce((t,r)=>t+(+r.amount||0),0);
  const expense=fin.filter(r=>r.type==='expense').reduce((t,r)=>t+(+r.amount||0),0);
  const monthlyFin=buildMonthlyFin(fin);
  const health=d.health||[];
  const activeHealth=health.filter(r=>r.status==='active');
  const withdrawalHealth=health.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=todayStr());
  const vac=d.vaccines||[];
  const vacDone=vac.filter(v=>v.status==='done').reduce((t,v)=>t+(+v.count||0),0);
  const vacPend=vac.filter(v=>v.status==='pending').reduce((t,v)=>t+(+v.count||0),0);
  const vacOver=vac.filter(v=>v.status==='overdue').reduce((t,v)=>t+(+v.count||0),0);
  const deathRate=all.length?((dead.length/all.length)*100).toFixed(1):0;
  return {curr,alive,dead,goats,sheep,births,breedDist,barnDist,barnNames,born,preg,failed,fertilityRate,twinRate,totalBirths,income,expense,monthlyFin,health,activeHealth,withdrawalHealth,vac,vacDone,vacPend,vacOver,deathRate};
}

function buildMonthlyFin(fin) {
  const months={};const now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months[d.toISOString().slice(0,7)]={income:0,expense:0};}
  fin.forEach(r=>{const k=(r.date||'').slice(0,7);if(months[k]){if(r.type==='income')months[k].income+=+r.amount||0;else months[k].expense+=+r.amount||0;}});
  return months;
}

function buildMonthlyBreeding(br) {
  const months={};const now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months[d.toISOString().slice(0,7)]={births:0,events:0};}
  br.filter(r=>r.status==='born').forEach(r=>{const k=(r.mating_date||'').slice(0,7);if(months[k]){months[k].births+=+r.offspring_count||0;months[k].events+=1;}});
  return months;
}

function groupBy(arr,key){return(arr||[]).reduce((acc,item)=>{const k=item[key]||'غير محدد';if(!acc[k])acc[k]=[];acc[k].push(item);return acc;},{});}
function monthLabel(k){const[,mo]=k.split('-');return['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][+mo-1];}

// ── Main render ───────────────────────────────────────────
function renderReports(el, s) {
  const m = computeMetrics(_data);
  el.innerHTML = `
  <div class="row g-3 mb-4">
    ${[
      {l:'إجمالي القطيع',v:ar(m.alive.length),status:'normal',h:'animals.html'},
      {l:'معدل النفوق',v:ar(+m.deathRate)+'٪',status:+m.deathRate>5?'alert':'normal',h:'dead.html'},
      {l:'معدل الخصوبة',v:ar(+m.fertilityRate)+'٪',status:+m.fertilityRate>70?'normal':'watch',h:'breeding.html'},
      {l:'إجمالي المواليد',v:ar(m.totalBirths),status:'normal',h:'births.html'},
      {l:'الإيرادات',v:m.income.toLocaleString('ar-EG')+' '+m.curr,status:'normal',h:'finance.html'},
      {l:'صافي الربح',v:((m.income-m.expense)>=0?'+':'')+(m.income-m.expense).toLocaleString('ar-EG')+' '+m.curr,status:(m.income-m.expense)>=0?'normal':'alert',h:'finance.html'},
    ].map(k=>`<div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:`<a href="${k.h}" style="color:inherit;text-decoration:none">${k.l}</a>`, value:k.v, status:k.status })}</div>`).join('')}
  </div>
  <div class="d-flex gap-2 flex-wrap mb-4">
    ${[['herd','bi-grid-3x3-gap-fill','القطيع'],['finance','bi-wallet2','المالية'],['health','bi-heart-pulse-fill','الصحة'],['breeding','bi-diagram-2-fill','التكاثر']].map(([t,i,l])=>`<button class="filter-btn${_tab===t?' active':''}" onclick="switchTab('${t}')"><i class="bi ${i} me-1"></i>${l}</button>`).join('')}
  </div>
  <div id="tab-content"></div>`;
  renderTab(_tab, m);
}

window.switchTab = function(tab) {
  _tab = tab;
  const labels = {herd:'القطيع',finance:'المالية',health:'الصحة',breeding:'التكاثر'};
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.textContent.trim().includes(labels[tab]||tab)));
  renderTab(tab, computeMetrics(_data));
};

function renderTab(tab, m) {
  const el = document.getElementById('tab-content');
  if (!el) return;
  if (tab==='herd')     renderHerdTab(el,m);
  if (tab==='finance')  renderFinanceTab(el,m);
  if (tab==='health')   renderHealthTab(el,m);
  if (tab==='breeding') renderBreedingTab(el,m);
}

// ════════════════ TAB 1: HERD ═════════════════════════════
function renderHerdTab(el, m) {
  el.innerHTML = `
  <div class="row g-3 mb-4">
    <div class="col-md-5"><div class="wonder-card h-100">
      <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> توزيع السلالات</h6>
      <div style="position:relative;height:200px"><canvas id="chart-breed-pie"></canvas></div>
      <div id="breed-legend" class="mt-3"></div>
    </div></div>
    <div class="col-md-7"><div class="wonder-card h-100">
      <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill accent-text"></i> الذكور والإناث بالسلالة</h6>
      <div style="position:relative;height:220px"><canvas id="chart-breed-bar"></canvas></div>
    </div></div>
  </div>
  <div class="row g-3 mb-4">
    <div class="col-md-6"><div class="wonder-card">
      <h6 class="fw-bold mb-3"><i class="bi bi-table accent-text"></i> ملخص القطيع</h6>
      <table class="tbl"><thead><tr><th>الفئة</th><th>الإجمالي</th><th>ذكور</th><th>إناث</th></tr></thead><tbody>
        ${[{l:'ماعز (تربية وتسمين)',a:m.goats.filter(a=>a.species==='goat')},{l:'أغنام (تربية وتسمين)',a:m.sheep.filter(a=>a.species==='sheep')},{l:'المواليد',a:m.births},{l:'النافق',a:m.dead}].map(row=>`<tr><td>${row.l}</td><td class="fw-bold">${ar(row.a.length)}</td><td class="text-gray">${ar(row.a.filter(a=>a.gender==='male').length)}</td><td class="text-gray">${ar(row.a.filter(a=>a.gender==='female').length)}</td></tr>`).join('')}
      </tbody></table>
    </div></div>
    <div class="col-md-6"><div class="wonder-card">
      <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart accent-text"></i> توزيع الغرض</h6>
      <div style="position:relative;height:160px"><canvas id="chart-purpose"></canvas></div>
    </div></div>
  </div>
  <div class="wonder-card mb-4">
    <h6 class="fw-bold mb-3"><i class="bi bi-building accent-text"></i> توزيع القطيع على الجمالونات</h6>
    <div style="position:relative;height:190px;margin-bottom:8px"><canvas id="chart-barns"></canvas></div>
    <div class="table-responsive mt-3"><table class="tbl">
      <thead><tr><th>الجمالون</th><th>الرؤوس</th><th>السلالات</th><th>الإشغال</th></tr></thead>
      <tbody>
        ${m.barnDist.map(b=>{const pct=Math.min(100,Math.round(b.count/200*100));return`<tr><td class="fw-bold">${b.barn}</td><td>${ar(b.count)}</td><td class="text-gray" style="font-size:.78rem">${b.breeds.slice(0,3).join('، ')||'—'}</td><td style="min-width:130px"><div class="d-flex align-items-center gap-2"><div class="finance-bar flex-grow-1" style="height:7px"><div class="finance-bar-fill" style="width:${pct}%;background:${pct>80?'var(--red)':pct>60?'var(--orange)':'var(--green)'}"></div></div><small style="color:${pct>80?'var(--red)':pct>60?'var(--orange)':'var(--green)'};min-width:32px">${pct}٪</small></div></td></tr>`;}).join('')}
        <tr style="border-top:2px solid var(--border)"><td class="fw-bold accent-text">الإجمالي</td><td class="fw-bold">${ar(m.alive.length)}</td><td colspan="2"></td></tr>
      </tbody>
    </table></div>
  </div>`;
  setTimeout(()=>{
    if(!window.Chart)return;
    mkChart('chart-breed-pie',{type:'doughnut',data:{labels:m.breedDist.map(b=>b.breed),datasets:[{data:m.breedDist.map(b=>b.count),backgroundColor:CHART_COLORS,borderWidth:0,hoverOffset:6}]},options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>` ${c.label}: ${ar(c.parsed)} رأس`}}}}});
    const legEl=document.getElementById('breed-legend');
    if(legEl)legEl.innerHTML=m.breedDist.map((b,i)=>{const pct=m.alive.length?Math.round(b.count/m.alive.length*100):0;return`<div class="d-flex align-items-center justify-content-between mb-1"><div class="d-flex align-items-center gap-2"><span style="width:10px;height:10px;border-radius:3px;background:${CHART_COLORS[i%CHART_COLORS.length]};display:inline-block"></span><small>${b.breed}</small></div><small class="fw-bold">${ar(b.count)} (${pct}٪)</small></div>`;}).join('');
    mkChart('chart-breed-bar',{type:'bar',data:{labels:m.breedDist.map(b=>b.breed),datasets:[{label:'ذكور',data:m.breedDist.map(b=>m.alive.filter(a=>a.breed===b.breed&&a.gender==='male').length),backgroundColor:'rgba(33,150,243,0.75)',borderRadius:4},{label:'إناث',data:m.breedDist.map(b=>m.alive.filter(a=>a.breed===b.breed&&a.gender==='female').length),backgroundColor:'rgba(255,107,53,0.75)',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:textClr(),font:{family:'Cairo'}}}},scales:{x:{ticks:{color:textClr()},grid:{color:gridClr()}},y:{ticks:{color:textClr()},grid:{color:gridClr()}}}}});
    const pd=[m.alive.filter(a=>a.purpose==='tarbiya').length,m.alive.filter(a=>a.purpose==='tasmeen').length,m.alive.filter(a=>a.purpose==='birth').length];
    mkChart('chart-purpose',{type:'doughnut',data:{labels:['تربية','تسمين','مواليد'],datasets:[{data:pd,backgroundColor:['#00e676','#ff6b35','#ffc107'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{position:'right',labels:{color:textClr(),font:{family:'Cairo',size:11}}}}}});
    const bc=m.barnDist.map(b=>b.count);
    mkChart('chart-barns',{type:'bar',data:{labels:m.barnNames,datasets:[{label:'عدد الرؤوس',data:bc,backgroundColor:bc.map(c=>c>160?'rgba(244,67,54,0.75)':c>100?'rgba(255,193,7,0.75)':'rgba(0,230,118,0.75)'),borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:textClr()},grid:{display:false}},y:{ticks:{color:textClr()},grid:{color:gridClr()},max:220}}}});
  },50);
}

// ════════════════ TAB 2: FINANCE ══════════════════════════
function renderFinanceTab(el, m) {
  if(!can('finance')){el.innerHTML='<div class="empty-state"><i class="bi bi-lock"></i><p>ليس لديك صلاحية لعرض البيانات المالية</p></div>';return;}
  const fin=_data.finance||[]; const curr=m.curr; const net=m.income-m.expense;
  const incCats=groupBy(fin.filter(r=>r.type==='income'),'category');
  const expCats=groupBy(fin.filter(r=>r.type==='expense'),'category');
  const mKeys=Object.keys(m.monthlyFin);
  // Comparison controls (Phase 5): this month vs last month, from the same monthlyFin data already computed
  const thisM=m.monthlyFin[mKeys[mKeys.length-1]]||{income:0,expense:0};
  const lastM=m.monthlyFin[mKeys[mKeys.length-2]]||{income:0,expense:0};
  const pctChange=(cur,prev)=>prev>0?Math.round(((cur-prev)/prev)*100):(cur>0?100:0);
  const incTrend=pctChange(thisM.income,lastM.income);
  const expTrend=pctChange(thisM.expense,lastM.expense);
  el.innerHTML=`
  <div class="row g-3 mb-4">
    ${[{l:'الإيرادات',v:m.income.toLocaleString('ar-EG')+' '+curr,status:'normal',trend:incTrend,trendDir:incTrend>=0?'up':'down',period:'مقابل الشهر الماضي'},{l:'المصروفات',v:m.expense.toLocaleString('ar-EG')+' '+curr,status:'watch',trend:expTrend,trendDir:expTrend>=0?'up':'down',period:'مقابل الشهر الماضي'},{l:'صافي الربح',v:(net>=0?'+':'')+net.toLocaleString('ar-EG')+' '+curr,status:net>=0?'normal':'alert'},{l:'عدد العمليات',v:ar(fin.length),status:'normal'}].map(k=>`<div class="col-6 col-md-3">${renderKPICard({ label:k.l, value:k.v, status:k.status, trend:k.trend, trendDir:k.trendDir, comparisonPeriod:k.period })}</div>`).join('')}
  </div>
  <div class="wonder-card mb-4">
    <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill accent-text"></i> الإيرادات والمصروفات الشهرية</h6>
    <div style="position:relative;height:220px"><canvas id="chart-fin-monthly"></canvas></div>
  </div>
  <div class="row g-3 mb-4">
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-arrow-up-circle-fill" style="color:var(--green)"></i> مصادر الإيرادات</h6>${renderCatBars(incCats,m.income,'var(--green)')}</div></div>
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-arrow-down-circle-fill" style="color:var(--red)"></i> بنود المصروفات</h6>${renderCatBars(expCats,m.expense,'var(--red)')}</div></div>
  </div>
  <div class="wonder-card mb-4">
    <h6 class="fw-bold mb-3"><i class="bi bi-clock-history accent-text"></i> آخر العمليات</h6>
    <div class="table-responsive"><table class="tbl">
      <thead><tr><th>التاريخ</th><th>النوع</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th></tr></thead>
      <tbody>${fin.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,10).map(r=>`<tr><td class="text-gray">${r.date||'—'}</td><td><span class="type-badge ${r.type==='income'?'badge-tarbiya':'badge-danger'}">${r.type==='income'?'إيراد':'مصروف'}</span></td><td class="text-gray">${r.category||'—'}</td><td>${r.description||'—'}</td><td class="fw-bold ${r.type==='income'?'green-text':'red-text'}">${(+r.amount||0).toLocaleString('ar-EG')} ${curr}</td></tr>`).join('')}</tbody>
    </table></div>
    <div class="mt-2 text-center"><a href="finance.html" class="action-btn sm"><i class="bi bi-arrow-left"></i> كل العمليات</a></div>
  </div>`;
  setTimeout(()=>{
    if(!window.Chart)return;
    mkChart('chart-fin-monthly',{type:'bar',data:{labels:mKeys.map(monthLabel),datasets:[{label:'الإيرادات',data:mKeys.map(k=>m.monthlyFin[k].income),backgroundColor:'rgba(0,230,118,0.7)',borderRadius:4},{label:'المصروفات',data:mKeys.map(k=>m.monthlyFin[k].expense),backgroundColor:'rgba(244,67,54,0.7)',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:textClr(),font:{family:'Cairo'}}}},scales:{x:{ticks:{color:textClr()},grid:{display:false}},y:{ticks:{color:textClr(),callback:v=>v.toLocaleString('ar-EG')},grid:{color:gridClr()}}}}});
  },50);
}

function renderCatBars(cats,total,color) {
  const entries=Object.entries(cats).map(([cat,recs])=>({cat:cat||'أخرى',total:recs.reduce((t,r)=>t+(+r.amount||0),0)})).sort((a,b)=>b.total-a.total);
  if(!entries.length)return'<div class="text-gray text-center py-3" style="font-size:.85rem">لا توجد بيانات</div>';
  return entries.map(e=>{const pct=total>0?Math.round(e.total/total*100):0;return`<div class="finance-bar-wrap"><div class="lb"><span>${e.cat}</span><span class="fw-bold">${e.total.toLocaleString('ar-EG')} (${pct}٪)</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${pct}%;background:${color}"></div></div></div>`;}).join('');
}

// ════════════════ TAB 3: HEALTH ═══════════════════════════
function renderHealthTab(el, m) {
  const health=_data.health||[]; const vac=_data.vaccines||[];
  const meds=_data.meds||[]; const feeds=_data.feeds||[];
  const diagTop=Object.entries(groupBy(health,'diagnosis')).map(([d,r])=>({d,count:r.length})).sort((a,b)=>b.count-a.count).slice(0,6);
  const medTop=Object.entries(groupBy(health,'medication')).map(([med,r])=>({med,count:r.length})).sort((a,b)=>b.count-a.count).slice(0,5);
  const expiringMeds=meds.filter(med=>{if(!med.expiry)return false;const d=Math.ceil((new Date(med.expiry)-new Date())/86400000);return d>=0&&d<=30;});
  const lowFeeds=feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0);
  el.innerHTML=`
  <div class="row g-3 mb-4">
    ${[{l:'قيد العلاج',v:ar(m.activeHealth.length),status:m.activeHealth.length?'watch':'normal'},{l:'فترة سحب',v:ar(m.withdrawalHealth.length),status:m.withdrawalHealth.length?'alert':'normal'},{l:'إجمالي السجلات',v:ar(health.length),status:'normal'},{l:'تحصين متأخر',v:ar(vac.filter(v=>v.status==='overdue').length),status:vac.filter(v=>v.status==='overdue').length?'alert':'normal'},{l:'أدوية قاربت نهايتها',v:ar(expiringMeds.length),status:expiringMeds.length?'watch':'normal'},{l:'أعلاف عند الحد',v:ar(lowFeeds.length),status:lowFeeds.length?'alert':'normal'}].map(k=>`<div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:k.l, value:k.v, status:k.status })}</div>`).join('')}
  </div>
  <div class="row g-3 mb-4">
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill accent-text"></i> التشخيصات الأكثر شيوعاً</h6>${diagTop.length?'<div style="position:relative;height:200px"><canvas id="chart-diag"></canvas></div>':'<div class="text-gray text-center py-4">لا توجد سجلات بعد</div>'}</div></div>
    <div class="col-md-6"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> حالة التحصين</h6><div style="position:relative;height:160px"><canvas id="chart-vac"></canvas></div><div class="row g-2 mt-2">${[['تم التنفيذ',m.vacDone,'var(--green)'],['انتظار',m.vacPend,'var(--orange)'],['متأخر',m.vacOver,'var(--red)']].map(([l,v,c])=>`<div class="col-4 text-center"><div class="fw-bold" style="color:${c}">${ar(v)}</div><small class="text-gray">${l}</small></div>`).join('')}</div></div></div>
  </div>
  ${m.withdrawalHealth.length?`<div class="withdrawal-alert mb-4"><div class="fw-bold red-text mb-2"><i class="bi bi-exclamation-triangle-fill me-2"></i>تحذير: ${ar(m.withdrawalHealth.length)} حيوان في فترة تأثير علاج</div>${m.withdrawalHealth.slice(0,4).map(r=>{const d=Math.max(0,Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000));return`<div class="d-flex align-items-center gap-2 mt-1 flex-wrap"><span class="type-badge badge-danger">${r.animal_tag||r.animal_breed||'—'}</span><small class="text-gray">${r.medication} — ينتهي ${r.withdrawal_end} <span style="color:var(--red)">(${ar(d)} يوم)</span></small></div>`;}).join('')}<div class="mt-2"><a href="health.html" class="action-btn sm danger"><i class="bi bi-arrow-left"></i> عرض الكل</a></div></div>`:''}
  ${expiringMeds.length?`<div class="wonder-card mb-4" style="border-color:rgba(255,193,7,.3)"><h6 class="fw-bold mb-3" style="color:var(--yellow)"><i class="bi bi-capsule me-2"></i>أدوية قاربت الانتهاء (30 يوم)</h6><div class="table-responsive"><table class="tbl"><thead><tr><th>الدواء</th><th>الكمية</th><th>تاريخ الانتهاء</th><th>متبقي</th></tr></thead><tbody>${expiringMeds.map(med=>{const d=Math.ceil((new Date(med.expiry)-new Date())/86400000);return`<tr><td class="fw-bold">${med.name||'—'}</td><td>${med.quantity||0} ${med.unit||''}</td><td class="text-gray">${med.expiry}</td><td><span class="type-badge ${d<=7?'badge-danger':'badge-yellow'}">${ar(d)} يوم</span></td></tr>`;}).join('')}</tbody></table></div><div class="mt-2"><a href="inventory.html" class="action-btn sm"><i class="bi bi-arrow-left"></i> الصيدلية</a></div></div>`:''}
  ${medTop.length?`<div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-capsule-pill accent-text"></i> الأدوية الأكثر استخداماً</h6>${medTop.map((m2,i)=>`<div class="finance-bar-wrap"><div class="lb"><span>${m2.med||'غير محدد'}</span><span class="fw-bold">${ar(m2.count)} مرة</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${Math.round(m2.count/medTop[0].count*100)}%;background:${CHART_COLORS[i]}"></div></div></div>`).join('')}</div>`:''}`;
  setTimeout(()=>{
    if(!window.Chart)return;
    if(diagTop.length)mkChart('chart-diag',{type:'bar',data:{labels:diagTop.map(d=>d.d||'غير محدد'),datasets:[{label:'الحالات',data:diagTop.map(d=>d.count),backgroundColor:'rgba(244,67,54,0.7)',borderRadius:4}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{ticks:{color:textClr()},grid:{color:gridClr()}},y:{ticks:{color:textClr(),font:{size:11}}}}}});
    mkChart('chart-vac',{type:'doughnut',data:{labels:['منجز','انتظار','متأخر'],datasets:[{data:[m.vacDone,m.vacPend,m.vacOver],backgroundColor:['#00e676','#ffc107','#f44336'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{display:false}}}});
  },50);
}

// ════════════════ TAB 4: BREEDING ═════════════════════════
function renderBreedingTab(el, m) {
  const br=_data.breeding||[]; const s=_data.s;
  const allBreeds=[...(s.goatBreeds||[]),...(s.sheepBreeds||[])];
  const breedFert=allBreeds.map(breed=>{const recs=br.filter(r=>r.female_breed===breed||r.mother_breed===breed);const born=recs.filter(r=>r.status==='born');const rate=recs.length?Math.round(born.length/recs.length*100):0;return{breed,total:recs.length,born:born.length,rate};}).filter(b=>b.total>0);
  const mb=buildMonthlyBreeding(br); const mKeys=Object.keys(mb);
  el.innerHTML=`
  <div class="row g-3 mb-4">
    ${[{l:'إجمالي السجلات',v:ar(br.length),status:'normal'},{l:'حوامل حالياً',v:ar(m.preg.length),status:'normal'},{l:'ولادات ناجحة',v:ar(m.born.length),status:'normal'},{l:'إجمالي المواليد',v:ar(m.totalBirths),status:'normal'},{l:'معدل التوائم',v:ar(+m.twinRate)+'٪',status:'normal'},{l:'معدل الخصوبة',v:ar(+m.fertilityRate)+'٪',status:+m.fertilityRate>70?'normal':'watch'}].map(k=>`<div class="col-6 col-md-4 col-lg-2">${renderKPICard({ label:k.l, value:k.v, status:k.status })}</div>`).join('')}
  </div>
  <div class="row g-3 mb-4">
    <div class="col-md-5"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> توزيع الحالات</h6><div style="position:relative;height:180px"><canvas id="chart-br-status"></canvas></div><div class="row g-2 mt-2">${[['حامل',m.preg.length,'var(--blue)'],['ولدت',m.born.length,'var(--green)'],['فشل',m.failed.length,'var(--red)']].map(([l,v,c])=>`<div class="col-4 text-center"><div class="fw-bold" style="color:${c}">${ar(v)}</div><small class="text-gray">${l}</small></div>`).join('')}</div></div></div>
    <div class="col-md-7"><div class="wonder-card h-100"><h6 class="fw-bold mb-3"><i class="bi bi-graph-up accent-text"></i> المواليد شهرياً</h6><div style="position:relative;height:200px"><canvas id="chart-br-monthly"></canvas></div></div></div>
  </div>
  ${breedFert.length?`<div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-table accent-text"></i> معدل الخصوبة بالسلالة</h6><div class="table-responsive"><table class="tbl"><thead><tr><th>السلالة</th><th>سجلات</th><th>ولادات</th><th>المعدل</th></tr></thead><tbody>${breedFert.map(b=>`<tr><td class="fw-bold">${b.breed}</td><td>${ar(b.total)}</td><td class="green-text fw-bold">${ar(b.born)}</td><td><div class="d-flex align-items-center gap-2"><div class="finance-bar" style="width:80px;height:6px"><div class="finance-bar-fill" style="width:${b.rate}%;background:${b.rate>70?'var(--green)':b.rate>40?'var(--orange)':'var(--red)'}"></div></div><span class="fw-bold" style="color:${b.rate>70?'var(--green)':b.rate>40?'var(--orange)':'var(--red)'}">${ar(b.rate)}٪</span></div></td></tr>`).join('')}</tbody></table></div></div>`:''}
  ${m.preg.length?`<div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-stars" style="color:var(--yellow)"></i> الحوامل الحاليات</h6><div class="table-responsive"><table class="tbl"><thead><tr><th>الأم</th><th>السلالة</th><th>التقريع</th><th>الولادة المتوقعة</th><th>متبقي</th></tr></thead><tbody>${m.preg.sort((a,b)=>(a.expected_birth||'').localeCompare(b.expected_birth||'')).slice(0,8).map(r=>{const d=r.expected_birth?Math.ceil((new Date(r.expected_birth)-new Date())/86400000):null;return`<tr><td class="fw-bold">${r.female_tag||'—'}</td><td class="text-gray">${r.female_breed||'—'}</td><td class="text-gray">${r.mating_date||'—'}</td><td>${r.expected_birth||'—'}</td><td>${d!==null?`<span class="type-badge ${d<=0?'badge-danger':d<=7?'badge-yellow':'badge-tarbiya'}">${d<=0?'تأخرت!':d===0?'اليوم!':'بعد '+ar(d)+' يوم'}</span>`:'—'}</td></tr>`;}).join('')}</tbody></table></div><div class="mt-2"><a href="breeding.html" class="action-btn sm"><i class="bi bi-arrow-left"></i> كل السجلات</a></div></div>`:''}`;
  setTimeout(()=>{
    if(!window.Chart)return;
    mkChart('chart-br-status',{type:'doughnut',data:{labels:['حامل','ولدت','فشل'],datasets:[{data:[m.preg.length,m.born.length,m.failed.length],backgroundColor:['#2196f3','#00e676','#f44336'],borderWidth:0,hoverOffset:4}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{display:false}}}});
    mkChart('chart-br-monthly',{type:'line',data:{labels:mKeys.map(monthLabel),datasets:[{label:'المواليد',data:mKeys.map(k=>mb[k].births),borderColor:'#00e676',backgroundColor:'rgba(0,230,118,0.1)',fill:true,tension:0.4,pointRadius:5},{label:'حالات ولادة',data:mKeys.map(k=>mb[k].events),borderColor:'#ffc107',backgroundColor:'rgba(255,193,7,0.1)',fill:true,tension:0.4,pointRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{labels:{color:textClr(),font:{family:'Cairo'}}}},scales:{x:{ticks:{color:textClr()},grid:{display:false}},y:{ticks:{color:textClr(),stepSize:1},grid:{color:gridClr()}}}}});
  },50);
}

// ════════════════ EXCEL EXPORT ════════════════════════════
window.shareWhatsApp = function() {
  var d = _data;
  if (!d || !d.animals) { toast('البيانات لم تُحمَّل بعد','error'); return; }
  var s = d.s || getSettings();
  var alive = (d.animals||[]).filter(function(a){return a.status==='alive';});
  var preg  = (d.breeding||[]).filter(function(r){return r.status==='pregnant';});
  var active= (d.health||[]).filter(function(r){return r.status==='active';});
  var inc   = (d.finance||[]).filter(function(r){return r.type==='income';}).reduce(function(t,r){return t+(+r.amount||0);},0);
  var exp   = (d.finance||[]).filter(function(r){return r.type==='expense';}).reduce(function(t,r){return t+(+r.amount||0);},0);

  // Breed breakdown
  var allBreeds = [...(s.goatBreeds||[]),...(s.sheepBreeds||[])];
  var breedLines = allBreeds.map(function(b){
    var cnt = alive.filter(function(a){return a.breed===b;}).length;
    return cnt > 0 ? '  • '+b+': '+cnt+' رأس' : null;
  }).filter(Boolean).join('%0A');

  var text = [
    '🐐 *تقرير مزرعة '+s.farmName+'*',
    '📅 '+todayAr(),
    '',
    '📊 *إجمالي القطيع:* '+ar(alive.length)+' رأس',
    '  🐐 ماعز: '+ar(alive.filter(function(a){return a.species==='goat';}).length),
    '  🐑 أغنام: '+ar(alive.filter(function(a){return a.species==='sheep';}).length),
    '',
    '*توزيع السلالات:*',
    breedLines,
    '',
    '🤰 *حوامل حالياً:* '+ar(preg.length)+' رأس',
    (active.length ? '💊 *قيد العلاج:* '+ar(active.length)+' رأس' : '✅ لا توجد حالات علاج نشطة'),
    '',
    '💰 *الإيرادات:* '+inc.toLocaleString('ar-EG')+' '+s.currency,
    '💸 *المصروفات:* '+exp.toLocaleString('ar-EG')+' '+s.currency,
    '📈 *صافي الربح:* '+((inc-exp)>=0?'+':'')+(inc-exp).toLocaleString('ar-EG')+' '+s.currency,
    '',
    '_تم إنشاء هذا التقرير تلقائياً من نظام بيان المزرعة_',
  ].join('%0A');

  var encoded = encodeURIComponent(text);
  window.open('https://wa.me/?text=' + encoded, '_blank');
  logActivity('export','reports','مشاركة تقرير عبر واتساب');
};

window.exportAllExcel = async function() {
  const d=_data;
  if(!d||!d.animals){toast('البيانات لم تُحمَّل بعد','error');return;}
  if(typeof XLSX==='undefined'){toast('مكتبة Excel غير متاحة','error');return;}
  const s=d.s; const wb=XLSX.utils.book_new();
  const ws1=XLSX.utils.aoa_to_sheet([['النوع','السلالة','الجنس','الغرض','الحالة','الترقيم','الجمالون','تاريخ الميلاد','تاريخ الإضافة'],...(d.animals||[]).map(a=>[a.species==='goat'?'ماعز':'أغنام',a.breed||'',a.gender==='male'?'ذكر':'أنثى',{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose||'',a.status==='alive'?'حي':'نافق',a.tag||'',a.barn||'',a.birth_date||'',(a.created_at||a.imported_at||'').slice(0,10)])]);ws1['!cols']=Array(9).fill({wch:14});XLSX.utils.book_append_sheet(wb,ws1,'القطيع');
  if(can('finance')){const ws2=XLSX.utils.aoa_to_sheet([['التاريخ','النوع','الفئة','الوصف','المبلغ'],...(d.finance||[]).map(r=>[r.date||'',r.type==='income'?'إيراد':'مصروف',r.category||'',r.description||'',+r.amount||0])]);ws2['!cols']=Array(5).fill({wch:16});XLSX.utils.book_append_sheet(wb,ws2,'المالية');}
  const ws3=XLSX.utils.aoa_to_sheet([['الحيوان','السلالة','التاريخ','التشخيص','الدواء','الجرعة','أيام التأثير','انتهاء التأثير','الحالة','الطبيب'],...(d.health||[]).map(r=>[r.animal_tag||'',r.animal_breed||'',r.date||'',r.diagnosis||'',r.medication||'',r.dosage||'',r.withdrawal_days||0,r.withdrawal_end||'',r.status==='active'?'قيد العلاج':'مكتمل',r.vet_name||''])]);ws3['!cols']=Array(10).fill({wch:13});XLSX.utils.book_append_sheet(wb,ws3,'السجل الصحي');
  const ws4=XLSX.utils.aoa_to_sheet([['الأنثى','السلالة','الفحل','التقريع','الولادة المتوقعة','الحالة','المواليد','توائم'],...(d.breeding||[]).map(r=>[r.female_tag||r.mother_tag||'',r.female_breed||'',r.male_tag||'',r.mating_date||'',r.expected_birth||'',{pregnant:'حامل',born:'ولدت',failed:'فشل',pending:'انتظار'}[r.status]||r.status||'',r.offspring_count||0,r.offspring_count>=2?'نعم':'لا'])]);ws4['!cols']=Array(8).fill({wch:14});XLSX.utils.book_append_sheet(wb,ws4,'التكاثر');
  const ws5=XLSX.utils.aoa_to_sheet([['التحصين','القسم','العدد','الحالة','الموعد','تاريخ التنفيذ','الإنجاز','نفّذها'],...(d.vaccines||[]).map(v=>[v.name||'',v.target_section||'',+v.count||0,{done:'تم',pending:'انتظار',overdue:'متأخر'}[v.status]||v.status||'',v.scheduled_date||'',v.done_date||'',v.progress||0,v.executed_by||''])]);ws5['!cols']=Array(8).fill({wch:14});XLSX.utils.book_append_sheet(wb,ws5,'التحصين');
  const ws6=XLSX.utils.aoa_to_sheet([['النوع','الصنف','الكمية','الوحدة','الحد الأدنى','تاريخ الانتهاء','الحالة'],...(d.meds||[]).map(m2=>['دواء',m2.name||'',+m2.quantity||0,m2.unit||'',+m2.min_quantity||0,m2.expiry||'',m2.expiry&&Math.ceil((new Date(m2.expiry)-new Date())/86400000)<=30?'قارب الانتهاء':'جيد']),...(d.feeds||[]).map(f=>['علف',f.name||'',+f.quantity||0,f.unit||'',+f.min_quantity||0,'',+f.quantity<=+f.min_quantity&&+f.min_quantity>0?'عند الحد الأدنى':'كافٍ'])]);ws6['!cols']=Array(7).fill({wch:14});XLSX.utils.book_append_sheet(wb,ws6,'المخزون');
  XLSX.writeFile(wb,`farm-report-${todayStr()}.xlsx`);
  toast('تم تصدير التقرير الشامل ✓');
  await logActivity('export','reports','تصدير تقرير Excel شامل — '+(d.animals||[]).length+' حيوان');
};
