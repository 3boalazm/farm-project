'use strict';
let breedingRecs=[], bFilter='all', editBId=null;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('breeding.html');
  breedingRecs=await fbGet('breeding');
  renderBreedingPage(s);
});

function renderBreedingPage(s){
  const pregnant=breedingRecs.filter(r=>r.status==='pregnant');
  const born=breedingRecs.filter(r=>r.status==='born');
  const failed=breedingRecs.filter(r=>r.status==='failed');
  const pending=breedingRecs.filter(r=>r.status==='pending');
  const t=todayStr();

  // Upcoming births in 15 days
  const upcoming=pregnant.filter(r=>r.expected_birth&&daysUntil(r.expected_birth)>=0&&daysUntil(r.expected_birth)<=15);
  // Return to heat (failed, >21 days ago)
  const returnHeat=failed.filter(r=>r.mating_date&&daysSince(r.mating_date)>=18);
  // Twins stats
  const twins=born.filter(r=>r.offspring_count>=2);

  renderPageHeader('<i class="bi bi-diagram-2-fill accent-text"></i> التكاثر والولادات',
    `${ar(breedingRecs.length)} سجل • ${ar(pregnant.length)} حامل`,
    `<button class="action-btn primary" onclick="openBModal()"><i class="bi bi-plus-lg"></i> تسجيل تقريع</button>`
  );
  const el=document.getElementById('content');
  const filtered=bFilter==='all'?breedingRecs:breedingRecs.filter(r=>r.status===bFilter);

  el.innerHTML=`
  <div class="row g-3 mb-4">
    ${[{l:'إجمالي السجلات',v:breedingRecs.length,c:'var(--orange)',i:'bi-collection-fill'},{l:'حوامل الآن',v:pregnant.length,c:'var(--blue)',i:'bi-heart-fill'},{l:'ولادات ناجحة',v:born.length,c:'var(--green)',i:'bi-stars'},{l:'إجمالي المواليد',v:born.reduce((t,r)=>t+(+r.offspring_count||0),0),c:'var(--yellow)',i:'bi-people-fill'},{l:'توائم',v:twins.length,c:'var(--purple)',i:'bi-people-fill'},{l:'رجع شياع',v:returnHeat.length,c:'var(--red)',i:'bi-arrow-repeat'}].map(s=>`<div class="col-6 col-md-4 col-lg-2"><div class="summary-card"><i class="bi ${s.i} d-block mb-2" style="color:${s.c};font-size:1.2rem"></i><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}
  </div>

  ${upcoming.length>0?`<div class="births-section mb-4">
    <div class="fw-bold mb-2" style="color:var(--yellow)"><i class="bi bi-alarm-fill me-2"></i>ولادات متوقعة خلال ١٥ يوم — ${ar(upcoming.length)} إناث</div>
    ${upcoming.map(r=>{const d=daysUntil(r.expected_birth);return`<div class="d-flex align-items-center gap-2 mt-2 flex-wrap">
      <span class="type-badge badge-yellow">${r.female_tag||r.female_breed}</span>
      <small class="text-gray">${r.female_breed} • موعد الولادة: ${r.expected_birth} <span style="color:${d<=3?'var(--red)':'var(--orange)'}">(${d===0?'اليوم!':d<0?'تأخرت!':'بعد '+ar(d)+' يوم'})</span></small>
    </div>`;}).join('')}
  </div>`:''}

  ${returnHeat.length>0?`<div style="background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.25);border-radius:14px;padding:14px 18px;margin-bottom:16px">
    <div class="fw-bold mb-2 red-text"><i class="bi bi-arrow-repeat me-2"></i>إناث يحتجن إعادة تقريع (رجع شياع) — ${ar(returnHeat.length)}</div>
    ${returnHeat.map(r=>`<div class="d-flex gap-2 mt-1 flex-wrap"><span class="type-badge badge-danger">${r.female_tag||r.female_breed}</span><small class="text-gray">آخر تقريع: ${r.mating_date} (منذ ${ar(daysSince(r.mating_date))} يوم)</small><button class="action-btn primary sm" onclick="openBModal(null,'${r.female_tag||''}','${r.female_breed||''}','${r.female_species||'goat'}')"><i class="bi bi-plus-lg"></i> إعادة تقريع</button></div>`).join('')}
  </div>`:''}

  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${['all','pending','pregnant','born','failed'].map(f=>`<button class="filter-btn${bFilter===f?' active':''}" onclick="bFilter='${f}';renderBreedingPage(getSettings())">${{all:'الكل',pending:'انتظار',pregnant:'حامل',born:'ولدت',failed:'فشل'}[f]} (${f==='all'?breedingRecs.length:breedingRecs.filter(r=>r.status===f).length})</button>`).join('')}
    </div>
    <div class="d-flex gap-2">
      <button class="action-btn sm" onclick="showFertilityReport()"><i class="bi bi-graph-up"></i> تقرير الخصوبة</button>
      <button class="action-btn sm" onclick="exportBreedingCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>
    </div>
  </div>

  ${filtered.length===0?`<div class="empty-state"><i class="bi bi-diagram-2"></i><p>لا توجد سجلات</p><button class="action-btn primary" onclick="openBModal()">سجّل أول تقريع</button></div>`:
  filtered.map(r=>{
    const d=r.expected_birth?daysUntil(r.expected_birth):null;
    const statusCfg={pregnant:{c:'var(--blue)',l:'حامل'},born:{c:'var(--green)',l:'ولدت'},failed:{c:'var(--red)',l:'فشل/إجهاض'},pending:{c:'var(--orange)',l:'انتظار'}};
    const sc=statusCfg[r.status]||statusCfg.pending;
    return`<div class="record-card">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div class="flex-grow-1">
          <div class="d-flex align-items-center gap-2 flex-wrap mb-1">
            <span class="type-badge" style="background:${sc.c}22;color:${sc.c};border:1px solid ${sc.c}44">${sc.l}</span>
            ${r.offspring_count>=2?`<span class="type-badge badge-purple"><i class="bi bi-people-fill me-1"></i>توائم</span>`:''}
          </div>
          <div style="font-size:.85rem">
            <span class="text-gray">الأنثى: </span><strong>${r.female_tag||'—'} ${r.female_breed?`(${r.female_breed})`:''}</strong>
            <span class="text-gray mx-2">|</span><span class="text-gray">الفحل: </span><strong>${r.male_tag||'—'} ${r.male_breed?`(${r.male_breed})`:''}</strong>
          </div>
          <small class="text-gray">
            التقريع: ${r.mating_date||'—'}
            ${r.expected_birth?` | الولادة المتوقعة: ${r.expected_birth} ${r.status==='pregnant'&&d!==null?`<span style="color:${d<=0?'var(--red)':d<=7?'var(--orange)':'var(--gray)'}">(${d===0?'اليوم!':d<0?'تأخرت!':'بعد '+ar(d)+' يوم'})</span>`:''}`:' '}
            ${r.status==='born'&&r.offspring_count?` | المواليد: ${ar(r.offspring_count)} (${ar(r.male_offspring||0)} ذكور / ${ar(r.female_offspring||0)} إناث)` :''}
            ${r.barn?` | ${r.barn}`:''}
          </small>
          ${r.notes?`<div class="text-gray mt-1" style="font-size:.78rem">${r.notes}</div>`:''}
        </div>
        <div class="d-flex gap-2 flex-shrink-0">
          <button class="action-btn sm" onclick="openBModal('${r._id}')"><i class="bi bi-pencil"></i></button>
          <button class="action-btn danger sm" onclick="delBreeding('${r._id}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('')}`;
}

function daysUntil(d){return Math.ceil((new Date(d)-new Date())/86400000);}
function daysSince(d){return Math.floor((new Date()-new Date(d))/86400000);}

window.showFertilityReport=function(){
  const born=breedingRecs.filter(r=>r.status==='born');
  const total=breedingRecs.filter(r=>r.status!=='pending').length||1;
  const rate=Math.round(born.length/total*100);
  const twins=born.filter(r=>r.offspring_count>=2);
  const twinRate=born.length?Math.round(twins.length/born.length*100):0;
  // Top females by offspring
  const femaleStats={};
  born.forEach(r=>{if(r.female_tag){if(!femaleStats[r.female_tag])femaleStats[r.female_tag]={tag:r.female_tag,breed:r.female_breed,count:0,offspring:0};femaleStats[r.female_tag].count++;femaleStats[r.female_tag].offspring+=(+r.offspring_count||0);}});
  const topFemales=Object.values(femaleStats).sort((a,b)=>b.offspring-a.offspring).slice(0,5);

  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px">
    <h4><i class="bi bi-graph-up accent-text"></i> تقرير الخصوبة والتكاثر</h4>
    <div class="row g-3 mb-3">
      ${[{l:'معدل الخصوبة',v:ar(rate)+'٪',c:'var(--green)'},{l:'معدل التوائم',v:ar(twinRate)+'٪',c:'var(--purple)'},{l:'إجمالي المواليد',v:ar(born.reduce((t,r)=>t+(+r.offspring_count||0),0)),c:'var(--yellow)'}].map(s=>`<div class="col-4"><div class="stat-mini"><div class="num" style="color:${s.c}">${s.v}</div><div class="lbl">${s.l}</div></div></div>`).join('')}
    </div>
    ${topFemales.length>0?`<h6 class="fw-bold mb-2">الإناث الأعلى إنتاجاً</h6>
    <table class="tbl w-100"><thead><tr><th>الترقيم</th><th>السلالة</th><th>ولادات</th><th>مواليد</th></tr></thead>
    <tbody>${topFemales.map(f=>`<tr><td class="fw-bold">${f.tag}</td><td class="text-gray">${f.breed||'—'}</td><td>${ar(f.count)}</td><td class="fw-bold green-text">${ar(f.offspring)}</td></tr>`).join('')}</tbody>
    </table>`:''}
    <div class="d-flex justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إغلاق</button></div>
  </div>`);
};

window.delBreeding=async function(id){
  if(!confirm('حذف هذا السجل؟'))return;
  try{await fbDelete('breeding',id);await logActivity('delete','breeding','حذف سجل تكاثر');toast('تم الحذف');breedingRecs=breedingRecs.filter(r=>r._id!==id);renderBreedingPage(getSettings());}
  catch(e){toast('فشل: '+e.message,'error');}
};

window.openBModal=function(id, prefTag='', prefBreed='', prefSpecies='goat'){
  const s=getSettings();
  editBId=id||null;
  const r=id?breedingRecs.find(x=>x._id===id):{};
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const allBreeds=[...s.goatBreeds,...s.sheepBreeds];
  const sp=r.female_species||prefSpecies;

  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:540px;max-height:92vh;overflow-y:auto">
    <h4><i class="bi bi-diagram-2-fill accent-text"></i> ${id?'تعديل':'تسجيل'} تقريع</h4>
    <div class="row g-2">
      <div class="col-6"><label>نوع الأنثى</label><select class="field" id="b-sp" onchange="updateBBreeds()"><option value="goat" ${sp==='goat'?'selected':''}>ماعز</option><option value="sheep" ${sp==='sheep'?'selected':''}>أغنام</option></select></div>
      <div class="col-6"><label>سلالة الأنثى</label><select class="field" id="b-fb">${(sp==='sheep'?s.sheepBreeds:s.goatBreeds).map(b=>`<option value="${b}" ${(r.female_breed||prefBreed)===b?'selected':''}>${b}</option>`).join('')}</select></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>ترقيم الأنثى *</label><input class="field" id="b-ft" value="${r.female_tag||prefTag}" placeholder="F-101"></div>
      <div class="col-6"><label>ترقيم الفحل</label><input class="field" id="b-mt" value="${r.male_tag||''}" placeholder="M-001"></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>سلالة الفحل</label><select class="field" id="b-mb">${allBreeds.map(b=>`<option value="${b}" ${r.male_breed===b?'selected':''}>${b}</option>`).join('')}</select></div>
      <div class="col-6"><label>الجمالون/العنبر</label><select class="field" id="b-barn">${barns.map(b=>`<option value="${b}" ${r.barn===b?'selected':''}>${b||'— غير محدد —'}</option>`).join('')}</select></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>تاريخ التقريع *</label><input type="date" class="field" id="b-md" value="${r.mating_date||todayStr()}" onchange="calcExpectedBirth()"></div>
      <div class="col-6"><label>موعد الولادة المتوقع</label><input type="date" class="field" id="b-ed" value="${r.expected_birth||''}"></div>
    </div>
    <label>الحالة</label><select class="field" id="b-st" onchange="toggleBornFields()">${['pending','pregnant','born','failed'].map(st=>`<option value="${st}" ${(r.status||'pending')===st?'selected':''}>${{pending:'قيد الانتظار',pregnant:'حامل',born:'ولدت',failed:'فشل/إجهاض'}[st]}</option>`).join('')}</select>
    <div id="b-born-fields" style="display:${r.status==='born'?'block':'none'}">
      <label>تاريخ الولادة الفعلي</label><input type="date" class="field" id="b-ad" value="${r.actual_birth||''}">
      <div class="row g-2">
        <div class="col-4"><label>الإجمالي</label><input type="number" class="field" min="0" id="b-tot" value="${r.offspring_count||''}"></div>
        <div class="col-4"><label>ذكور</label><input type="number" class="field" min="0" id="b-mal" value="${r.male_offspring||''}"></div>
        <div class="col-4"><label>إناث</label><input type="number" class="field" min="0" id="b-fem" value="${r.female_offspring||''}"></div>
      </div>
      <label>أوزان المواليد عند الميلاد (كجم)</label><input class="field" id="b-weights" value="${r.birth_weights||''}" placeholder="مثال: 4.5, 3.8">
    </div>
    <label>ملاحظات</label><textarea class="field" id="b-notes" rows="2">${r.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitBreeding()">حفظ</button>
    </div>
  </div>`);
};

window.updateBBreeds=function(){const s=getSettings();const sp=document.getElementById('b-sp').value;document.getElementById('b-fb').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>`<option value="${b}">${b}</option>`).join('');};
window.calcExpectedBirth=function(){const d=document.getElementById('b-md').value;if(d){const dt=new Date(d);dt.setDate(dt.getDate()+(getSettings().pregnancyDays||150));document.getElementById('b-ed').value=dt.toISOString().slice(0,10);}};
window.toggleBornFields=function(){document.getElementById('b-born-fields').style.display=document.getElementById('b-st').value==='born'?'block':'none';};

window.submitBreeding=async function(){
  const ft=document.getElementById('b-ft').value.trim();if(!ft){toast('يرجى إدخال ترقيم الأنثى','error');return;}
  const status=document.getElementById('b-st').value;
  const data={female_tag:ft,female_breed:document.getElementById('b-fb').value,female_species:document.getElementById('b-sp').value,male_tag:document.getElementById('b-mt').value.trim(),male_breed:document.getElementById('b-mb').value,barn:document.getElementById('b-barn').value,mating_date:document.getElementById('b-md').value,expected_birth:document.getElementById('b-ed').value||null,status,actual_birth:status==='born'?document.getElementById('b-ad').value:null,offspring_count:status==='born'?+document.getElementById('b-tot').value||null:null,male_offspring:status==='born'?+document.getElementById('b-mal').value||null:null,female_offspring:status==='born'?+document.getElementById('b-fem').value||null:null,birth_weights:status==='born'?document.getElementById('b-weights').value.trim():null,notes:document.getElementById('b-notes').value.trim()||null};
  closeModal();toast('جاري الحفظ...','info');
  try{
    if(editBId){await fbPatch('breeding',editBId,data);await logActivity('edit','breeding','تعديل سجل تقريع: '+ft);}
    else{await fbPost('breeding',data);await logActivity('add','breeding',`تسجيل تقريع — الأنثى ${ft} — ${status==='pregnant'?'حامل':status==='born'?'ولادة':'انتظار'}`);}
    toast(editBId?'تم التحديث':'تمت الإضافة');
    breedingRecs=await fbGet('breeding');renderBreedingPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.exportBreedingCSV=function(){
  const rows=[['الأنثى','السلالة','الفحل','التقريع','الولادة المتوقعة','الحالة','المواليد','ذكور','إناث'],
    ...breedingRecs.map(r=>[r.female_tag||'',r.female_breed||'',r.male_tag||'',r.mating_date||'',r.expected_birth||'',{pending:'انتظار',pregnant:'حامل',born:'ولدت',failed:'فشل'}[r.status]||r.status,r.offspring_count||'',r.male_offspring||'',r.female_offspring||''])
  ];
  const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`breeding-${todayStr()}.csv`;a.click();
  toast('تم التصدير');
};
