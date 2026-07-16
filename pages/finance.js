'use strict';
let finRecs=[], finFilter='all', finMonth='', editFinId=null;
const INCOME_CATS=['بيع حيوانات','بيع ألبان','بيع صوف','بيع سماد','إيراد آخر'];
const EXPENSE_CATS=['أعلاف ومواد تغذية','أدوية وتحصينات','عمالة','كهرباء ومياه','صيانة معدات','نقل وشحن','إيجار','مصروف آخر'];

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  if(!can('finance')){document.getElementById('content').innerHTML='<div class="empty-state"><i class="bi bi-shield-x"></i><p>غير مصرح بالوصول للبيانات المالية</p></div>';renderNavbar('finance.html');return;}

  // FAB for mobile
  addFAB('إضافة معاملة مالية', function(){
    var btn=document.querySelector('.action-btn.primary');
    if(btn)btn.click();
  }, 'bi-wallet2');
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('finance.html');
  renderRelatedLinks('finance.js');
  finRecs=await fbGet('finance');
  renderFinancePage(s);
});

function renderFinancePage(s){
  let recs=[...finRecs];
  if(finFilter!=='all')recs=recs.filter(r=>r.type===finFilter);
  if(finMonth)recs=recs.filter(r=>(r.date||'').startsWith(finMonth));
  recs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));

  const totalIn=finRecs.filter(r=>r.type==='income').reduce((t,r)=>t+(+r.amount||0),0);
  const totalEx=finRecs.filter(r=>r.type==='expense').reduce((t,r)=>t+(+r.amount||0),0);
  const net=totalIn-totalEx;
  const curr=s.currency;

  // By category
  const byCat={};finRecs.filter(r=>r.type==='expense').forEach(r=>{byCat[r.category]=(byCat[r.category]||0)+(+r.amount||0);});
  const topCats=Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,6);

  renderPageHeaderV2({
    title: '<i class="bi bi-wallet2 accent-text"></i> المالية والحسابات',
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'المالية'}],
    primaryAction: '<button class="action-btn primary" onclick="openFinModal()"><i class="bi bi-plus-lg"></i> إضافة معاملة</button>',
    secondaryActions: `<button class="action-btn sm" onclick="showCostPerHead()"><i class="bi bi-calculator"></i> تكلفة/رأس</button><button class="action-btn sm" onclick="exportFinCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>`
  });
  const el=document.getElementById('content');

  const kpiHtml = `
  <div class="row g-3 mb-4">
    <div class="col-md-4">${renderKPICard({ label:'الإيرادات', value: totalIn.toLocaleString('ar-EG'), unit:curr, status:'normal' })}</div>
    <div class="col-md-4">${renderKPICard({ label:'المصروفات', value: totalEx.toLocaleString('ar-EG'), unit:curr, status:'watch' })}</div>
    <div class="col-md-4">${renderKPICard({ label: net>=0?'صافي الربح':'صافي الخسارة', value: (net>=0?'+':'')+net.toLocaleString('ar-EG'), unit:curr, status: net>=0?'normal':'alert' })}</div>
  </div>`;

  const distributionHtml = topCats.length>0 ? renderChartContainer({
    title:'توزيع المصروفات', subtitle:'أعلى الفئات', state:'ready',
    chartHtml: topCats.map(([cat,amt])=>{const pct=totalEx?Math.round(amt/totalEx*100):0;return`<div class="finance-bar-wrap"><div class="lb"><span class="text-gray">${cat}</span><span class="fw-bold accent-text">${amt.toLocaleString('ar-EG')} ${curr} (${pct}٪)</span></div><div class="finance-bar" role="presentation" aria-hidden="true"><div class="finance-bar-fill" style="width:${pct}%"></div></div></div>`;}).join('')
  }) : '';

  // Monthly Trend / Revenue vs Expense — NEW, was missing. A single grouped-bar
  // chart, by month, naturally answers both the "Monthly Trend" and "Revenue vs
  // Expense" requirements at once (each month's bar pair IS the comparison, and
  // the sequence of months IS the trend) — the same pattern dashboard.html
  // already uses for its own revenue/expense chart. Reuses renderGroupedBarSVG
  // exactly; built from finRecs already loaded, no new Firebase call added.
  const arMonthsF=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const nowF=new Date();
  const revExpTrendF=[];
  for(let i=5;i>=0;i--){
    const d=new Date(nowF.getFullYear(),nowF.getMonth()-i,1);
    const mStr=d.toISOString().slice(0,7);
    const monthInc=finRecs.filter(r=>r.type==='income'&&(r.date||'').startsWith(mStr)).reduce((t,r)=>t+(+r.amount||0),0);
    const monthExp=finRecs.filter(r=>r.type==='expense'&&(r.date||'').startsWith(mStr)).reduce((t,r)=>t+(+r.amount||0),0);
    revExpTrendF.push({ label: arMonthsF[d.getMonth()].slice(0,3), values:[monthInc,monthExp] });
  }
  const revExpSvg=renderGroupedBarSVG(revExpTrendF,{colors:['#10b981','#ef4444']});
  const trendHtml=renderChartContainer({ title:'الإيرادات مقابل المصروفات', subtitle:'آخر 6 أشهر', chartHtml: revExpSvg||'', state: revExpSvg?'ready':'empty' });

  el.innerHTML = kpiHtml + `<div class="row g-3 mb-4"><div class="col-md-5">${distributionHtml}</div><div class="col-md-7">${trendHtml}</div></div>` + `
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="d-flex gap-2 flex-wrap align-items-center">
      ${['all','income','expense'].map(f=>`<button class="filter-btn${finFilter===f?' active':''}" onclick="finFilter='${f}';renderFinancePage(getSettings())">${{all:'الكل',income:'إيرادات',expense:'مصروفات'}[f]}</button>`).join('')}
      <input type="month" class="field" value="${finMonth}" onchange="finMonth=this.value;renderFinancePage(getSettings())" style="max-width:160px;padding:5px 10px;font-size:.78rem">
    </div>
  </div>
  ${recs.length===0 ? `<div class="empty-state"><i class="bi bi-wallet2"></i><p>لا توجد معاملات مالية</p></div>` : renderDataTableWrapper({
    title: 'المعاملات المالية',
    headers: ['التاريخ','النوع','الفئة','الوصف','الجمالون',`المبلغ (${curr})`,''],
    rowsHtml: recs.map(r=>`<tr>
      <td class="text-gray">${r.date||'—'}</td>
      <td><span class="type-badge ${r.type==='income'?'badge-tarbiya':'badge-tasmeen'}">${r.type==='income'?'إيراد':'مصروف'}</span></td>
      <td>${r.category||'—'}</td>
      <td>${r.description||'—'}</td>
      <td class="text-gray">${r.barn||'—'}</td>
      <td class="fw-bold ${r.type==='income'?'green-text':'accent-text'}">${r.type==='income'?'+':'-'}${(+r.amount||0).toLocaleString('ar-EG')}</td>
      <td><div class="d-flex gap-1">
        <button class="icon-btn edit" onclick="openFinModal('${r._id}')"><i class="bi bi-pencil"></i></button>
        <button class="icon-btn del" onclick="delFin('${r._id}')"><i class="bi bi-trash"></i></button>
      </div></td>
    </tr>`).join(''),
    paginationHtml: `<span class="text-gray" style="font-size:var(--text-xs)">الإجمالي المعروض: <span class="green-text fw-bold">+${recs.filter(r=>r.type==='income').reduce((t,r)=>t+(+r.amount||0),0).toLocaleString('ar-EG')}</span> / <span class="accent-text fw-bold">-${recs.filter(r=>r.type==='expense').reduce((t,r)=>t+(+r.amount||0),0).toLocaleString('ar-EG')}</span></span>`
  })}` + `
  <!-- Recent Activity (Analytics Template) — NEW, was missing. Reuses
       renderTimeline/renderTimelineItem exactly as dashboard.html/health.js/
       production.js; built from finRecs already loaded, no new Firebase call. -->
  <div class="wonder-card mt-4">
    <h6 class="fw-bold mb-3" style="font-size:var(--text-lg)"><i class="bi bi-clock-history accent-text me-2"></i>النشاط الأخير</h6>
    ${(function(){
      const recent=[...finRecs].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6);
      return recent.length?renderTimeline(recent.map(r=>renderTimelineItem({
        time: r.date||'',
        eventType: r.type==='income'?'إيراد':'مصروف',
        entity: `${r.category||''} — ${(+r.amount||0).toLocaleString('ar-EG')} ${curr}`,
      }))):`<div class="empty-state py-3"><i class="bi bi-clock-history"></i><p>لا يوجد نشاط مسجّل بعد</p></div>`;
    })()}
  </div>`;
}

window.showCostPerHead=async function(){
  const s=getSettings();
  const animals=await fbGet('animals');
  const alive=animals.filter(a=>a.status==='alive').length||1;
  const totalEx=finRecs.filter(r=>r.type==='expense').reduce((t,r)=>t+(+r.amount||0),0);
  const perHead=(totalEx/alive).toFixed(2);
  showModal(`<div class="farm-modal narrow" onclick="event.stopPropagation()"><h4><i class="bi bi-calculator accent-text"></i> تكلفة الرأس الواحد</h4>
    <div class="row g-3 mb-3">
      <div class="col-6"><div class="stat-mini"><div class="num accent-text">${totalEx.toLocaleString('ar-EG')}</div><div class="lbl">إجمالي المصروفات (${s.currency})</div></div></div>
      <div class="col-6"><div class="stat-mini"><div class="num green-text">${ar(alive)}</div><div class="lbl">عدد الرؤوس الحية</div></div></div>
    </div>
    <div class="p-4 text-center" style="background:rgba(255,107,53,.08);border-radius:14px;border:1px solid rgba(255,107,53,.25)">
      <div style="font-size:2rem;font-weight:800;color:var(--orange)">${(+perHead).toLocaleString('ar-EG')} ${s.currency}</div>
      <div class="text-gray">متوسط التكلفة لكل رأس</div>
    </div>
    <p class="text-gray mt-3" style="font-size:.8rem">* يشمل إجمالي المصروفات المسجلة في النظام مقسومة على عدد الرؤوس الحية</p>
    <div class="d-flex justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إغلاق</button></div>
  </div>`);
};

window.openFinModal=function(id){
  const s=getSettings();
  editFinId=id||null;
  const r=id?finRecs.find(x=>x._id===id):{};
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-wallet2 accent-text"></i> ${id?'تعديل':'إضافة'} معاملة مالية</h4>
    <div class="row g-2">
      <div class="col-6"><label>التاريخ</label><input type="date" class="field" id="f-date" value="${r.date||todayStr()}"></div>
      <div class="col-6"><label>النوع</label><select class="field" id="f-type" onchange="updateFinCats()"><option value="income" ${r.type==='income'?'selected':''}>إيراد</option><option value="expense" ${r.type==='expense'?'selected':''}>مصروف</option></select></div>
    </div>
    <label>الفئة *</label><select class="field" id="f-cat">${(r.type==='expense'?EXPENSE_CATS:INCOME_CATS).map(c=>`<option value="${c}" ${r.category===c?'selected':''}>${c}</option>`).join('')}</select>
    <div class="row g-2">
      <div class="col-6"><label>المبلغ (${s.currency}) *</label><input type="number" class="field" id="f-amount" value="${r.amount||''}" min="0" step="0.01"></div>
      <div class="col-6"><label>الجمالون</label><select class="field" id="f-barn">${barns.map(b=>`<option value="${b}" ${r.barn===b?'selected':''}>${b||'— الكل —'}</option>`).join('')}</select></div>
    </div>
    <label>القائم بالمعاملة</label><input class="field" id="f-by" value="${r.added_by||getUser()?.name||''}" placeholder="اسم الشخص">
    <label>الوصف</label><input class="field" id="f-desc" value="${r.description||''}" placeholder="تفاصيل المعاملة">
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitFin()">حفظ</button>
    </div>
  </div>`);
};

window.updateFinCats=function(){const t=document.getElementById('f-type').value;document.getElementById('f-cat').innerHTML=(t==='income'?INCOME_CATS:EXPENSE_CATS).map(c=>`<option value="${c}">${c}</option>`).join('');};

window.submitFin=async function(){
  const amount=+document.getElementById('f-amount').value;const cat=document.getElementById('f-cat').value;
  if(!amount||!cat){toast('يرجى إدخال المبلغ والفئة','error');return;}
  const data={date:document.getElementById('f-date').value,type:document.getElementById('f-type').value,category:cat,amount,description:document.getElementById('f-desc').value.trim()||null,barn:document.getElementById('f-barn').value||null,added_by:document.getElementById('f-by')?.value.trim()||getUser()?.name||null};
  closeModal();toast('جاري الحفظ...','info');
  try{
    if(editFinId){await fbPatch('finance',editFinId,data);await logActivity('edit','finance',`تعديل معاملة: ${cat} ${amount}`);}
    else{await fbPost('finance',data);await logActivity('add','finance',`${data.type==='income'?'إيراد':'مصروف'}: ${cat} — ${amount} ${getSettings().currency}`);}
    toast(editFinId?'تم التحديث':'تمت الإضافة');editFinId=null;finRecs=await fbGet('finance');renderFinancePage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.delFin=async function(id){
  if(!confirm('حذف هذه المعاملة؟'))return;
  try{await fbDelete('finance',id);await logActivity('delete','finance','حذف معاملة مالية');toast('تم الحذف');finRecs=finRecs.filter(r=>r._id!==id);renderFinancePage(getSettings());}
  catch(e){toast('فشل: '+e.message,'error');}
};

window.exportFinCSV=function(){
  const s=getSettings();
  const rows=[['التاريخ','النوع','الفئة','الوصف','الجمالون',`المبلغ (${s.currency})`],
    ...finRecs.map(r=>[r.date||'',r.type==='income'?'إيراد':'مصروف',r.category||'',r.description||'',r.barn||'',r.amount||0])
  ];
  const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`finance-${todayStr()}.csv`;a.click();
  toast('تم التصدير');
};
