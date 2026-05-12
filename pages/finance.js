'use strict';
let finRecs=[], finFilter='all', finMonth='', editFinId=null;
const INCOME_CATS=['بيع حيوانات','بيع ألبان','بيع صوف','بيع سماد','إيراد آخر'];
const EXPENSE_CATS=['أعلاف ومواد تغذية','أدوية وتحصينات','عمالة','كهرباء ومياه','صيانة معدات','نقل وشحن','إيجار','مصروف آخر'];

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  if(!can('finance')){document.getElementById('content').innerHTML='<div class="empty-state"><i class="bi bi-shield-x"></i><p>غير مصرح بالوصول للبيانات المالية</p></div>';renderNavbar('finance.html');return;}
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('finance.html');
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

  renderPageHeader('<i class="bi bi-wallet2 accent-text"></i> المالية والحسابات','','<button class="action-btn primary" onclick="openFinModal()"><i class="bi bi-plus-lg"></i> إضافة معاملة</button>');
  const el=document.getElementById('content');

  el.innerHTML=`
  <div class="row g-3 mb-4">
    <div class="col-md-4"><div class="summary-card"><i class="bi bi-arrow-up-circle-fill d-block mb-2" style="color:var(--green);font-size:1.4rem"></i><div class="summary-number green-text">${totalIn.toLocaleString('ar-EG')}</div><small class="text-gray">الإيرادات (${curr})</small></div></div>
    <div class="col-md-4"><div class="summary-card"><i class="bi bi-arrow-down-circle-fill d-block mb-2" style="color:var(--orange);font-size:1.4rem"></i><div class="summary-number accent-text">${totalEx.toLocaleString('ar-EG')}</div><small class="text-gray">المصروفات (${curr})</small></div></div>
    <div class="col-md-4"><div class="summary-card"><i class="bi bi-${net>=0?'graph-up-arrow':'graph-down-arrow'} d-block mb-2" style="color:${net>=0?'var(--green)':'var(--red)'};font-size:1.4rem"></i><div class="summary-number" style="color:${net>=0?'var(--green)':'var(--red)'}">${net>=0?'+':''}${net.toLocaleString('ar-EG')}</div><small class="text-gray">${net>=0?'صافي الربح':'صافي الخسارة'} (${curr})</small></div></div>
  </div>

  ${topCats.length>0?`<div class="wonder-card mb-4"><h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> توزيع المصروفات</h6>
  ${topCats.map(([cat,amt])=>{const pct=totalEx?Math.round(amt/totalEx*100):0;return`<div class="finance-bar-wrap"><div class="lb"><span class="text-gray">${cat}</span><span class="fw-bold accent-text">${amt.toLocaleString('ar-EG')} ${curr} (${pct}٪)</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${pct}%"></div></div></div>`;}).join('')}
  </div>`:''}

  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="d-flex gap-2 flex-wrap align-items-center">
      ${['all','income','expense'].map(f=>`<button class="filter-btn${finFilter===f?' active':''}" onclick="finFilter='${f}';renderFinancePage(getSettings())">${{all:'الكل',income:'إيرادات',expense:'مصروفات'}[f]}</button>`).join('')}
      <input type="month" class="field" value="${finMonth}" onchange="finMonth=this.value;renderFinancePage(getSettings())" style="max-width:160px;padding:5px 10px;font-size:.78rem">
    </div>
    <div class="d-flex gap-2">
      <button class="action-btn sm" onclick="showCostPerHead()"><i class="bi bi-calculator"></i> تكلفة/رأس</button>
      <button class="action-btn sm" onclick="exportFinCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>
    </div>
  </div>

  ${recs.length===0?`<div class="empty-state"><i class="bi bi-wallet2"></i><p>لا توجد معاملات مالية</p></div>`:`
  <div class="wonder-card p-0"><div class="table-responsive"><table class="tbl">
    <thead><tr><th>التاريخ</th><th>النوع</th><th>الفئة</th><th>الوصف</th><th>الجمالون</th><th>المبلغ (${curr})</th><th></th></tr></thead>
    <tbody>${recs.map(r=>`<tr>
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
    </tr>`).join('')}
    <tfoot><tr style="background:rgba(255,255,255,.03)">
      <td colspan="5" class="fw-bold text-gray">الإجمالي المعروض</td>
      <td colspan="2" class="fw-bold"><span class="green-text">+${recs.filter(r=>r.type==='income').reduce((t,r)=>t+(+r.amount||0),0).toLocaleString('ar-EG')}</span> / <span class="accent-text">-${recs.filter(r=>r.type==='expense').reduce((t,r)=>t+(+r.amount||0),0).toLocaleString('ar-EG')}</span></td>
    </tr></tfoot>
  </table></div></div>`}`;
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
  const data={date:document.getElementById('f-date').value,type:document.getElementById('f-type').value,category:cat,amount,description:document.getElementById('f-desc').value.trim()||null,barn:document.getElementById('f-barn').value||null};
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
