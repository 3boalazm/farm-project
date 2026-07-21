'use strict';
let healthRecs=[], healthFilter='all', editHealthId=null;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  // SECURITY FIX (Phase 6 hardening): nav.js grants perm:'health', unenforced
  // until now -- same bug class as vaccine.js, breeding.js, inventory.js.
  if (!can('health')) {
    document.getElementById('content').innerHTML='<div class="empty-state"><i class="bi bi-shield-x"></i><p>غير مصرح بالوصول لبيانات الصحة</p></div>';
    renderNavbarV2('health.html');
    return;
  }
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbarV2('health.html');

  // FAB for mobile
  addFAB('تسجيل سجل صحي جديد', function(){ openAddHealth(); });
  renderRelatedLinks('health.js');
  healthRecs=await fbGet('health');
  renderHealthPage(s);
});

function renderHealthPage(s){
  const t=todayStr();
  const active=healthRecs.filter(r=>r.status==='active');
  const inWithdrawal=healthRecs.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=t);
  const completed=healthRecs.filter(r=>r.status==='completed');

  renderPageHeaderV2({
    title: '<i class="bi bi-heart-pulse-fill accent-text"></i> السجل الصحي',
    description: `${ar(healthRecs.length)} سجل • ${ar(active.length)} قيد العلاج`,
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'السجل الصحي'}],
    primaryAction: can('health')?`<button class="action-btn primary" onclick="openHealthModal()"><i class="bi bi-plus-lg"></i> سجل جديد</button>`:'',
    secondaryActions: `<button class="action-btn sm" onclick="exportHealthCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>`
  });
  const el=document.getElementById('content');

  // KPI Summary (Analytics Template) — was 4 plain summary-cards, now the shared KPI Card component
  const kpiHtml = `
  <div class="row g-3 mb-4">
    <div class="col-6 col-md-3">${renderKPICard({ label:'قيد العلاج', value: ar(active.length), status: active.length>0?'watch':'normal' })}</div>
    <div class="col-6 col-md-3">${renderKPICard({ label:'فترة سحب', value: ar(inWithdrawal.length), status: inWithdrawal.length>0?'alert':'normal' })}</div>
    <div class="col-6 col-md-3">${renderKPICard({ label:'مكتملة', value: ar(completed.length), status:'normal' })}</div>
    <div class="col-6 col-md-3">${renderKPICard({ label:'إجمالي', value: ar(healthRecs.length), status:'normal' })}</div>
  </div>`;

  // Chart Grid (Analytics Template) — status distribution, degrades gracefully if empty
  const statusDonut = renderDonutSVG([
    { label:'قيد العلاج', value: active.length, color:'#f59e0b' },
    { label:'مكتمل', value: completed.length, color:'#10b981' },
  ], { size:140 });

  // Treatment Trend — NEW, was missing (module structure calls for it, per
  // Repository 3 Phase 2). Reuses renderLineChartSVG exactly as dashboard.html
  // does; built entirely from healthRecs already loaded on this page — no new
  // Firebase call added.
  const arMonthsH=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const nowH=new Date();
  const treatmentTrend=[];
  for(let i=5;i>=0;i--){
    const d=new Date(nowH.getFullYear(),nowH.getMonth()-i,1);
    const mStr=d.toISOString().slice(0,7);
    const count=healthRecs.filter(r=>(r.date||'').startsWith(mStr)).length;
    treatmentTrend.push({ label: arMonthsH[d.getMonth()].slice(0,3), value: count });
  }
  const trendSvg=renderLineChartSVG(treatmentTrend,{color:'#f59e0b'});

  const analyticsHtml = `<div class="row g-3 mb-4">
    <div class="col-md-5">${renderChartContainer({ title:'توزيع الحالات', subtitle:'قيد العلاج مقابل مكتمل', chartHtml: statusDonut||'', state: statusDonut?'ready':'empty' })}</div>
    <div class="col-md-7">${renderChartContainer({ title:'اتجاه العلاجات', subtitle:'آخر 6 أشهر', chartHtml: trendSvg||'', state: trendSvg?'ready':'empty' })}</div>
  </div>`;

  // Withdrawal warnings — now individual Alert Cards (severity: critical) instead of one grouped banner
  const withdrawalAlertsHtml = inWithdrawal.length>0 ? `
    <div class="mb-4">
      <div class="fw-bold mb-2" style="color:var(--red)"><i class="bi bi-exclamation-triangle-fill me-2"></i>تحذير: حيوانات في فترة تأثير العلاج</div>
      ${inWithdrawal.map(r=>{
        const dLeft=Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000);
        return renderAlertCard({ severity:'critical', icon:'bi-exclamation-triangle-fill',
          title:`${r.animal_tag||r.animal_breed} — ${r.medication}`,
          message:'يُمنع البيع أو الذبح أو استخدام المنتجات',
          source:r.barn||'', deadline:`ينتهي ${r.withdrawal_end} (متبقي ${ar(Math.max(0,dLeft))} يوم)` });
      }).join('')}
    </div>` : '';

  let filtered=healthFilter==='all'?healthRecs:healthFilter==='active'?active:healthFilter==='withdrawal'?inWithdrawal:completed;

  // Filter Bar + Data list (Listing Template) — kept as record-cards, not forced into a literal <table>:
  // health records carry rich per-record detail (diagnosis/medication/dosage/withdrawal/BCS) that
  // compresses badly into narrow table columns, so the existing card-list is the better fit here.
  el.innerHTML = kpiHtml + analyticsHtml + withdrawalAlertsHtml + `
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${[{f:'all',l:'الكل',n:healthRecs.length},{f:'active',l:'قيد العلاج',n:active.length},{f:'withdrawal',l:'فترة سحب',n:inWithdrawal.length},{f:'completed',l:'مكتمل',n:completed.length}].map(x=>`<button class="filter-btn${healthFilter===x.f?' active':''}" onclick="healthFilter='${x.f}';renderHealthPage(getSettings())">${x.l} (${x.n})</button>`).join('')}
    </div>
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
          ${r.status==='active'&&can('health')?`<button class="action-btn primary sm" onclick="event.stopPropagation();completeHealth('${r._id}')"><i class="bi bi-check-lg" aria-hidden="true"></i><span class="visually-hidden">إكمال العلاج</span></button>`:''}
          ${can('health')?`<button class="action-btn sm" onclick="event.stopPropagation();openHealthModal('${r._id}')"><i class="bi bi-pencil" aria-hidden="true"></i><span class="visually-hidden">تعديل</span></button>`:''}
          ${can('admin')?`<button class="action-btn danger sm" onclick="event.stopPropagation();delHealth('${r._id}')"><i class="bi bi-trash" aria-hidden="true"></i><span class="visually-hidden">حذف</span></button>`:''}
        </div>
      </div>
    </div>`;
  }).join('')}
  ${(function(){
    // Recent Activity (Analytics Template) — NEW, was missing. Reuses
    // renderTimeline/renderTimelineItem exactly as dashboard.html's own
    // "Recent Activity" section; built from healthRecs already loaded,
    // no new Firebase call added.
    const recent=[...healthRecs].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,6);
    return `<div class="wonder-card mt-4">
      <h6 class="fw-bold mb-3" style="font-size:var(--text-lg)"><i class="bi bi-clock-history accent-text me-2"></i>النشاط الأخير</h6>
      ${recent.length?renderTimeline(recent.map(r=>renderTimelineItem({
          time: r.date||'',
          eventType: r.status==='active'?'سجل علاج جديد':'علاج مكتمل',
          entity: `${r.animal_breed||''}${r.animal_tag?' #'+r.animal_tag:''} — ${r.diagnosis||''}`,
        }))):`<div class="empty-state py-3"><i class="bi bi-clock-history"></i><p>لا يوجد نشاط مسجّل بعد</p></div>`}
    </div>`;
  })()}`;
}

window.completeHealth=async function(id){
  try{
    const r=healthRecs.find(function(x){return x._id===id;});
    await fbPatch('health',id,{status:'completed'});await logActivity('edit','health','إكمال علاج');toast('تم إكمال العلاج');
    // Sprint 11 (v1.4): closes the ORIGINAL 'medication_followup' reminder
    // task created when this same health record's withdrawal_end was
    // first set -- discovered gap (docs/features/WORKFLOW-DISCOVERY.md).
    // Recommendation reuses evaluateHealthRisk() live, never re-scores.
    if(window.completeWorkflow && r){
      // ID-first, tag-fallback: records saved after this session's fix
      // already carry animal_id (a single-item fetch); older records
      // fall back to the tag-based lookup this always used.
      const animal = r.animal_id ? await window.findAnimal(r.animal_id) : (await fbGet('animals')).find(function(a){return a.tag===r.animal_tag;});
      window.completeWorkflow('medication', { sourceId:id, animalId:animal?animal._id:null, animalTag:r.animal_tag, barn:animal?animal.barn:null }).then(function(res){
        if(res&&res.recommendation&&res.recommendation.text&&res.recommendation.actionable!==false)toast('💡 '+res.recommendation.text,'info');
      }).catch(function(){});
    }
    healthRecs=await fbGet('health');renderHealthPage(getSettings());
  }
  catch(e){toast('فشل: '+e.message,'error');}
};

window.delHealth=async function(id){
  if(!can('admin')){toast('ليس لديك صلاحية لتنفيذ هذا الإجراء','error');return;}
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
      ${inW?`<span class="type-badge badge-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>فترة تأثير علاج نشط</span>`:''}
    </div>
    ${[['الحيوان',`${r.animal_breed||'—'} ${r.animal_tag?'#'+r.animal_tag:''}`],['النوع',r.animal_species==='goat'?'ماعز':'أغنام'],['الجمالون/العنبر',r.barn||'—'],['التشخيص',r.diagnosis],['الدواء',r.medication],['الجرعة',r.dosage||'—'],['تاريخ العلاج',r.date||'—'],['نهاية العلاج',r.treatment_end||'—'],['أيام تأثير العلاج',r.withdrawal_days?ar(r.withdrawal_days)+' يوم':'—'],['انتهاء تأثير العلاج',r.withdrawal_end||'—'],['BCS',r.bcs?r.bcs+'/5':'—'],['الطبيب',r.vet_name||'—'],['ملاحظات',r.notes||'—']].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold">${v}</span></div>`).join('')}
    ${inW?`<div class="mt-3 p-3 text-center" style="background:rgba(244,67,54,.08);border-radius:10px;border:1px solid rgba(244,67,54,.25)">
      <div style="font-size:1.8rem;font-weight:800;color:var(--red)">${ar(Math.max(0,dLeft))}</div>
      <small class="text-gray">يوم متبقي حتى انتهاء تأثير العلاج (${r.withdrawal_end})</small>
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
      <div class="col-6"><label>أيام تأثير العلاج</label><input type="number" class="field" id="h-wdays" value="${r.withdrawal_days||0}" min="0" onchange="calcWithdrawal()"></div>
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
  const animalTag=document.getElementById('h-tag').value.trim();
  // Resolved ONCE, here, before the record is saved -- so the stored
  // health record itself carries animal_id, and every downstream use
  // (risk evaluation, inventory deduction, workflow) reuses this same
  // resolution instead of each doing its own separate fbGet/find.
  const matchedAnimal=animalTag?await window.findByTag(animalTag):null;
  if(animalTag && !matchedAnimal) toast('تنبيه: لم يتم العثور على حيوان بهذا الرقم — سيتم الحفظ كنص فقط','warning');
  const data={animal_tag:animalTag,animal_id:matchedAnimal?matchedAnimal._id:null,animal_breed:document.getElementById('h-breed').value,animal_species:document.getElementById('h-sp').value,barn:document.getElementById('h-barn').value,date:document.getElementById('h-date').value,vet_name:document.getElementById('h-vet').value.trim()||null,diagnosis:diag,medication:med,dosage:document.getElementById('h-dose').value.trim(),withdrawal_days:wdays,treatment_end:tend,withdrawal_end:withdrawal_end||null,bcs:document.getElementById('h-bcs').value||null,status:document.getElementById('h-stat').value,notes:document.getElementById('h-notes').value.trim()||null};
  closeModal();toast('جاري الحفظ...','info');
  try{
    let healthId=editHealthId;
    if(editHealthId){await fbPatch('health',editHealthId,data);await logActivity('edit','health','تعديل سجل: '+diag);}
    else{healthId=await fbPost('health',data);await logActivity('add','health','إضافة سجل: '+diag+' | '+med+(withdrawal_end?` | سحب حتى ${withdrawal_end}`:''));}
    // Sprint 1, Epic 1: attach task automation -- additive only, does not
    // change the health write above. Never blocks on failure.
    if(data.withdrawal_end&&window.autoGenerateTask){
      window.autoGenerateTask('medication_followup',{sourceId:healthId,animal_tag:data.animal_tag,withdrawal_end:data.withdrawal_end,barn:data.barn}).catch(function(){});
    }
    // Sprint 3, Epic 3: attach health risk evaluation -- reuses the SAME
    // resolution from above (matchedAnimal), no second fbGet('animals').
    // Fire-and-forget; never blocks on failure or delays the save above.
    if(window.evaluateHealthRisk&&matchedAnimal){
      (function(match){
          window.evaluateHealthRisk(match._id, match.tag, match.barn);
          // Sprint 14 (v1.7): deduct medication stock -- Best Effort,
          // never blocks the health record itself (already saved above).
          if(window.recordInventoryTransaction&&data.medication&&!editHealthId){
            window.recordInventoryTransaction('meds', data.medication, -1, 'treatment', healthId).catch(function(){});
          }
          // Sprint 11 (v1.4): recommendation only, reusing the SAME
          // resolved animal (no duplicate fbGet('animals') lookup). A
          // NEW health record has no prior reminder of its own to close.
          if(window.completeWorkflow&&!editHealthId){
            window.completeWorkflow('health',{sourceId:healthId, animalId:match._id, animalTag:match.tag, barn:match.barn}).then(function(r){
              if(r&&r.recommendation&&r.recommendation.text&&r.recommendation.actionable!==false)toast('💡 '+r.recommendation.text,'info');
            }).catch(function(){});
          }
      })(matchedAnimal);
    }
    toast(editHealthId?'تم التحديث':'تمت الإضافة');
    healthRecs=await fbGet('health');renderHealthPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.exportHealthCSV=function(){
  const rows=[['الحيوان','السلالة','الجمالون','التاريخ','التشخيص','الدواء','الجرعة','أيام تأثير العلاج','انتهاء تأثير العلاج','الحالة','BCS'],
    ...healthRecs.map(r=>[r.animal_tag||'',r.animal_breed||'',r.barn||'',r.date||'',r.diagnosis||'',r.medication||'',r.dosage||'',r.withdrawal_days||0,r.withdrawal_end||'',r.status==='active'?'نشط':'مكتمل',r.bcs||''])
  ];
  const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`health-${todayStr()}.csv`;a.click();
  toast('تم التصدير');
};
