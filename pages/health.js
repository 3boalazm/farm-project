'use strict';
let healthRecs=[], healthFilter='all', editHealthId=null;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('health.html');
  healthRecs=await fbGet('health');
  renderHealthPage(s);
});

function renderHealthPage(s){
  const t=todayStr();
  const active=healthRecs.filter(r=>r.status==='active');
  const inWithdrawal=healthRecs.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=t);
  const completed=healthRecs.filter(r=>r.status==='completed');

  renderPageHeader('<i class="bi bi-heart-pulse-fill accent-text"></i> السجل الصحي',
    `${ar(healthRecs.length)} سجل • ${ar(active.length)} قيد العلاج`,
    can('health')?`<button class="action-btn primary" onclick="openHealthModal()"><i class="bi bi-plus-lg"></i> سجل جديد</button>`:''
  );
  const el=document.getElementById('content');

  // Withdrawal alert banner
  const withdrawalAlert=inWithdrawal.length>0?`<div class="withdrawal-alert mb-4">
    <div class="fw-bold mb-2 red-text"><i class="bi bi-exclamation-triangle-fill me-2"></i>تحذير: ${ar(inWithdrawal.length)} حيوان في فترة السحب — يُمنع البيع أو الذبح أو استخدام المنتجات</div>
    ${inWithdrawal.map(r=>{const dLeft=Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000);return`<div class="d-flex align-items-center gap-2 mt-2 flex-wrap">
      <span class="type-badge badge-danger">${r.animal_tag||r.animal_breed}</span>
      <small class="text-gray">${r.medication} — ينتهي ${r.withdrawal_end} <span style="color:var(--red)">(متبقي ${ar(Math.max(0,dLeft))} يوم)</span></small>
    </div>`;}).join('')}
  </div>`:'';

  let filtered=healthFilter==='all'?healthRecs:healthFilter==='active'?active:healthFilter==='withdrawal'?inWithdrawal:completed;

  el.innerHTML=`
  <div class="row g-3 mb-4">
    ${[{l:'قيد العلاج',v:active.length,c:'var(--orange)',i:'bi-activity'},{l:'فترة سحب',v:inWithdrawal.length,c:'var(--red)',i:'bi-exclamation-triangle-fill'},{l:'مكتملة',v:completed.length,c:'var(--green)',i:'bi-check-circle-fill'},{l:'إجمالي',v:healthRecs.length,c:'var(--gray)',i:'bi-clipboard2-pulse-fill'}].map(s=>`<div class="col-6 col-md-3"><div class="summary-card"><i class="bi ${s.i} d-block mb-2" style="color:${s.c};font-size:1.3rem"></i><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}
  </div>
  ${withdrawalAlert}
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${[{f:'all',l:'الكل',n:healthRecs.length},{f:'active',l:'قيد العلاج',n:active.length},{f:'withdrawal',l:'فترة سحب',n:inWithdrawal.length},{f:'completed',l:'مكتمل',n:completed.length}].map(x=>`<button class="filter-btn${healthFilter===x.f?' active':''}" onclick="healthFilter='${x.f}';renderHealthPage(getSettings())">${x.l} (${x.n})</button>`).join('')}
    </div>
    <button class="action-btn sm" onclick="exportHealthCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>
  </div>
  ${filtered.length===0?`<div class="empty-state"><i class="bi bi-heart-pulse"></i><p>لا توجد سجلات</p></div>`:
  filtered.map(r=>{
    const inW=r.withdrawal_end&&r.withdrawal_end>=t;
    const dLeft=inW?Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000):0;
    return`<div class="record-card" style="cursor:pointer" onclick="showHealthDetail('${r._id}')">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span class="type-badge ${r.status==='active'?'badge-tasmeen':'badge-tarbiya'}">${r.status==='active'?'قيد العلاج':'مكتمل'}</span>
            ${inW?`<span class="type-badge badge-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>سحب ${ar(Math.max(0,dLeft))} يوم</span>`:''}
            <span class="fw-bold">${r.animal_breed||'—'} ${r.animal_tag?`<span class="text-gray">#${r.animal_tag}</span>`:''}</span>
          </div>
          <div style="font-size:.85rem">
            <span class="text-gray">التشخيص: </span><strong>${r.diagnosis}</strong>
            <span class="text-gray mx-2">|</span><span class="text-gray">الدواء: </span><strong>${r.medication}</strong>
            ${r.dosage?`<span class="text-gray"> — ${r.dosage}</span>`:''}
          </div>
          ${r.bcs?`<small class="text-gray mt-1 d-block">تقييم الحالة الجسمانية (BCS): <strong>${r.bcs}/5</strong></small>`:''}
          <small class="text-gray">${r.date||'—'} ${r.barn?`• ${r.barn}`:''}</small>
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          ${r.status==='active'&&can('health')?`<button class="action-btn primary sm" onclick="event.stopPropagation();completeHealth('${r._id}')"><i class="bi bi-check-lg"></i></button>`:''}
          ${can('health')?`<button class="action-btn sm" onclick="event.stopPropagation();openHealthModal('${r._id}')"><i class="bi bi-pencil"></i></button>`:''}
          ${can('admin')?`<button class="action-btn danger sm" onclick="event.stopPropagation();delHealth('${r._id}')"><i class="bi bi-trash"></i></button>`:''}
        </div>
      </div>
    </div>`;
  }).join('')}`;
}

window.completeHealth=async function(id){
  try{await fbPatch('health',id,{status:'completed'});await logActivity('edit','health','إكمال علاج');toast('تم إكمال العلاج');healthRecs=await fbGet('health');renderHealthPage(getSettings());}
  catch(e){toast('فشل: '+e.message,'error');}
};

window.delHealth=async function(id){
  if(!confirm('حذف هذا السجل؟'))return;
  try{await fbDelete('health',id);await logActivity('delete','health','حذف سجل صحي');toast('تم الحذف');healthRecs=healthRecs.filter(r=>r._id!==id);renderHealthPage(getSettings());}
  catch(e){toast('فشل: '+e.message,'error');}
};

window.showHealthDetail=function(id){
  const r=healthRecs.find(x=>x._id===id);if(!r)return;
  const t=todayStr();const inW=r.withdrawal_end&&r.withdrawal_end>=t;
  const dLeft=inW?Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000):0;
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:540px;max-height:92vh;overflow-y:auto">
    <h4><i class="bi bi-heart-pulse-fill accent-text"></i> تفاصيل السجل الصحي</h4>
    <div class="d-flex gap-2 mb-3 flex-wrap">
      <span class="type-badge ${r.status==='active'?'badge-tasmeen':'badge-tarbiya'}">${r.status==='active'?'قيد العلاج':'مكتمل'}</span>
      ${inW?`<span class="type-badge badge-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>فترة سحب نشطة</span>`:''}
    </div>
    ${[['الحيوان',`${r.animal_breed||'—'} ${r.animal_tag?'#'+r.animal_tag:''}`],['النوع',r.animal_species==='goat'?'ماعز':'أغنام'],['الجمالون/العنبر',r.barn||'—'],['التشخيص',r.diagnosis],['الدواء',r.medication],['الجرعة',r.dosage||'—'],['تاريخ العلاج',r.date||'—'],['نهاية العلاج',r.treatment_end||'—'],['أيام السحب',r.withdrawal_days?ar(r.withdrawal_days)+' يوم':'—'],['ينتهي السحب',r.withdrawal_end||'—'],['BCS',r.bcs?r.bcs+'/5':'—'],['الطبيب',r.vet_name||'—'],['ملاحظات',r.notes||'—']].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold">${v}</span></div>`).join('')}
    ${inW?`<div class="mt-3 p-3 text-center" style="background:rgba(244,67,54,.08);border-radius:10px;border:1px solid rgba(244,67,54,.25)">
      <div style="font-size:1.8rem;font-weight:800;color:var(--red)">${ar(Math.max(0,dLeft))}</div>
      <small class="text-gray">يوم متبقي حتى انتهاء فترة السحب (${r.withdrawal_end})</small>
    </div>`:''}
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إغلاق</button>
      ${r.status==='active'&&can('health')?`<button class="action-btn primary" onclick="closeModal();completeHealth('${r._id}')"><i class="bi bi-check-lg"></i> إكمال العلاج</button>`:''}
    </div>
  </div>`);
};

window.openHealthModal=function(id){
  const s=getSettings();
  editHealthId=id||null;
  const r=id?healthRecs.find(x=>x._id===id):{};
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const allBreeds=[...s.goatBreeds,...s.sheepBreeds];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:520px;max-height:92vh;overflow-y:auto">
    <h4><i class="bi bi-heart-pulse-fill accent-text"></i> ${id?'تعديل':'إضافة'} سجل صحي</h4>
    <div class="row g-2">
      <div class="col-6"><label>النوع</label><select class="field" id="h-sp" onchange="updateHBreeds()"><option value="goat" ${r.animal_species==='goat'?'selected':''}>ماعز</option><option value="sheep" ${r.animal_species==='sheep'?'selected':''}>أغنام</option></select></div>
      <div class="col-6"><label>السلالة</label><select class="field" id="h-breed">${(r.animal_species==='sheep'?s.sheepBreeds:s.goatBreeds).map(b=>`<option value="${b}" ${r.animal_breed===b?'selected':''}>${b}</option>`).join('')}</select></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>رقم الترقيم</label><input class="field" id="h-tag" value="${r.animal_tag||''}" placeholder="A-123"></div>
      <div class="col-6"><label>الجمالون/العنبر</label><select class="field" id="h-barn">${barns.map(b=>`<option value="${b}" ${r.barn===b?'selected':''}>${b||'— غير محدد —'}</option>`).join('')}</select></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>تاريخ العلاج *</label><input type="date" class="field" id="h-date" value="${r.date||todayStr()}"></div>
      <div class="col-6"><label>اسم الطبيب</label><input class="field" id="h-vet" value="${r.vet_name||''}" placeholder="د. أحمد"></div>
    </div>
    <label>التشخيص *</label><input class="field" id="h-diag" value="${r.diagnosis||''}" placeholder="التشخيص">
    <div class="row g-2">
      <div class="col-6"><label>الدواء *</label><input class="field" id="h-med" value="${r.medication||''}"></div>
      <div class="col-6"><label>الجرعة</label><input class="field" id="h-dose" value="${r.dosage||''}" placeholder="5 مل"></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>نهاية العلاج</label><input type="date" class="field" id="h-tend" value="${r.treatment_end||''}" onchange="calcWithdrawal()"></div>
      <div class="col-6"><label>أيام السحب</label><input type="number" class="field" id="h-wdays" value="${r.withdrawal_days||0}" min="0" onchange="calcWithdrawal()"></div>
    </div>
    <div id="h-wshow" style="display:${r.withdrawal_end?'block':'none'};background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.25);border-radius:10px;padding:8px 12px;margin-top:8px;font-size:.8rem;color:var(--red)">
      ⚠️ لا يجوز البيع أو الذبح أو استخدام المنتجات قبل: <strong id="h-wdate">${r.withdrawal_end||''}</strong>
    </div>
    <div class="row g-2 mt-1">
      <div class="col-6"><label>تقييم الحالة الجسمانية (BCS)</label>
        <select class="field" id="h-bcs">
          <option value="">— اختر —</option>
          ${[1,1.5,2,2.5,3,3.5,4,4.5,5].map(v=>`<option value="${v}" ${r.bcs==v?'selected':''}>${v}/5</option>`).join('')}
        </select>
      </div>
      <div class="col-6"><label>الحالة</label><select class="field" id="h-stat"><option value="active" ${r.status==='active'||!r.status?'selected':''}>قيد العلاج</option><option value="completed" ${r.status==='completed'?'selected':''}>مكتمل</option></select></div>
    </div>
    <label>ملاحظات</label><textarea class="field" id="h-notes" rows="2">${r.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitHealth()">حفظ</button>
    </div>
  </div>`);
};

window.updateHBreeds=function(){
  const s=getSettings();const sp=document.getElementById('h-sp').value;
  document.getElementById('h-breed').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>`<option value="${b}">${b}</option>`).join('');
};

window.calcWithdrawal=function(){
  const tend=document.getElementById('h-tend').value;
  const wdays=+document.getElementById('h-wdays').value||0;
  if(tend&&wdays>0){const dt=new Date(tend);dt.setDate(dt.getDate()+wdays);const we=dt.toISOString().slice(0,10);document.getElementById('h-wdate').textContent=we;document.getElementById('h-wshow').style.display='block';}
  else document.getElementById('h-wshow').style.display='none';
};

window.submitHealth=async function(){
  const diag=document.getElementById('h-diag').value.trim();const med=document.getElementById('h-med').value.trim();
  if(!diag||!med){toast('يرجى إدخال التشخيص والدواء','error');return;}
  const tend=document.getElementById('h-tend').value;const wdays=+document.getElementById('h-wdays').value||0;
  let withdrawal_end='';if(tend&&wdays>0){const dt=new Date(tend);dt.setDate(dt.getDate()+wdays);withdrawal_end=dt.toISOString().slice(0,10);}
  const data={animal_tag:document.getElementById('h-tag').value.trim(),animal_breed:document.getElementById('h-breed').value,animal_species:document.getElementById('h-sp').value,barn:document.getElementById('h-barn').value,date:document.getElementById('h-date').value,vet_name:document.getElementById('h-vet').value.trim()||null,diagnosis:diag,medication:med,dosage:document.getElementById('h-dose').value.trim(),withdrawal_days:wdays,treatment_end:tend,withdrawal_end:withdrawal_end||null,bcs:document.getElementById('h-bcs').value||null,status:document.getElementById('h-stat').value,notes:document.getElementById('h-notes').value.trim()||null};
  closeModal();toast('جاري الحفظ...','info');
  try{
    if(editHealthId){await fbPatch('health',editHealthId,data);await logActivity('edit','health','تعديل سجل: '+diag);}
    else{await fbPost('health',data);await logActivity('add','health','إضافة سجل: '+diag+' | '+med+(withdrawal_end?` | سحب حتى ${withdrawal_end}`:''));}
    toast(editHealthId?'تم التحديث':'تمت الإضافة');
    healthRecs=await fbGet('health');renderHealthPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.exportHealthCSV=function(){
  const rows=[['الحيوان','السلالة','الجمالون','التاريخ','التشخيص','الدواء','الجرعة','أيام السحب','ينتهي السحب','الحالة','BCS'],
    ...healthRecs.map(r=>[r.animal_tag||'',r.animal_breed||'',r.barn||'',r.date||'',r.diagnosis||'',r.medication||'',r.dosage||'',r.withdrawal_days||0,r.withdrawal_end||'',r.status==='active'?'نشط':'مكتمل',r.bcs||''])
  ];
  const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`health-${todayStr()}.csv`;a.click();
  toast('تم التصدير');
};
