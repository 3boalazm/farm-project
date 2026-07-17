'use strict';
let breedingRecs=[], bFilter='all', editBId=null;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  // SECURITY FIX: nav.js grants this page perm:'breeding', but no
  // can('breeding') check enforced it.
  if(!can('breeding')){
    document.body.innerHTML='<div class="page-wrap"><div class="empty-state" style="padding-top:100px"><i class="bi bi-shield-x" style="font-size:3rem;display:block;margin-bottom:10px;opacity:.4"></i><p>غير مصرح بالوصول</p><a href="dashboard.html" class="action-btn">الرئيسية</a></div></div>';
    return;
  }
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('breeding.html');

  // FAB for mobile
  addFAB('تسجيل تقريع جديد', function(){
    var btn=document.querySelector('.action-btn.primary[onclick*="Breed"],button[onclick*="breed"]');
    if(btn)btn.click(); else toast('افتح نموذج التقريع من الأزرار', 'info');
  }, 'bi-diagram-2-fill');
  renderLoading(document.getElementById('content'));
  try{ breedingRecs=await fbGet('breeding'); }catch(e){ toast('خطأ: '+e.message,'error'); }
  renderBreedingPage(s);
  renderRelatedLinks('breeding.html');
});

function renderBreedingPage(s){
  const pregnant=breedingRecs.filter(r=>r.status==='pregnant');
  const born=breedingRecs.filter(r=>r.status==='born');
  const failed=breedingRecs.filter(r=>r.status==='failed');
  const twins=born.filter(r=>r.offspring_count>=2);
  const returnHeat=failed.filter(r=>r.mating_date&&daysSince(r.mating_date)>=18);
  const upcoming=pregnant.filter(r=>r.expected_birth&&daysUntil(r.expected_birth)>=0&&daysUntil(r.expected_birth)<=15);

  renderPageHeader('<i class="bi bi-diagram-2-fill accent-text"></i> التكاثر والمواليد',
    ar(breedingRecs.length)+' سجل • '+ar(pregnant.length)+' حامل',
    '<button class="action-btn primary" onclick="openBModal()" data-hint="سجّل عملية تقريع جديدة"><i class="bi bi-plus-lg"></i> تسجيل تقريع</button>'+
    '<button class="action-btn" onclick="openBirthModal()" data-hint="سجّل مولود جديد مباشرة" style="background:rgba(255,193,7,.1);border-color:rgba(255,193,7,.3);color:var(--yellow)"><i class="bi bi-stars"></i> تسجيل ولادة</button>'+
    '<button class="action-btn sm" onclick="showFertilityReport()"><i class="bi bi-graph-up"></i> تقرير الخصوبة</button>'+
    '<button class="action-btn sm" onclick="exportBreedingCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>'
  );

  const el=document.getElementById('content');
  const filtered=bFilter==='all'?breedingRecs:breedingRecs.filter(r=>r.status===bFilter);

  var statsHtml=['#مجموعات التكاثر',ar(breedingRecs.length),'bi-collection-fill','var(--orange)','حوامل الآن',ar(pregnant.length),'bi-heart-fill','var(--blue)','مواليد ناجحة',ar(born.length),'bi-check-circle-fill','var(--green)','إجمالي المواليد',ar(born.reduce((t,r)=>t+(+r.offspring_count||0),0)),'bi-people-fill','var(--yellow)','توائم',ar(twins.length),'bi-people-fill','var(--purple)','رجع شياع',ar(returnHeat.length),'bi-arrow-repeat','var(--red)'];
  var statsCards='';
  for(var si=0;si<36;si+=6){
    var l=statsHtml[si+4],v=statsHtml[si+5]||statsHtml[si+1],ic=statsHtml[si+6]||statsHtml[si+2],c=statsHtml[si+7]||statsHtml[si+3];
    if(si===0){l='إجمالي السجلات';v=ar(breedingRecs.length);ic='bi-collection-fill';c='var(--orange)';}
    else if(si===6){l='حوامل الآن';v=ar(pregnant.length);ic='bi-heart-fill';c='var(--blue)';}
    else if(si===12){l='مواليد ناجحة';v=ar(born.length);ic='bi-check-circle-fill';c='var(--green)';}
    else if(si===18){l='إجمالي المواليد';v=ar(born.reduce((t,r)=>t+(+r.offspring_count||0),0));ic='bi-people-fill';c='var(--yellow)';}
    else if(si===24){l='توائم';v=ar(twins.length);ic='bi-people-fill';c='var(--purple)';}
    else if(si===30){l='رجع شياع';v=ar(returnHeat.length);ic='bi-arrow-repeat';c='var(--red)';}
    statsCards+='<div class="col-6 col-md-4 col-lg-2"><div class="summary-card"><i class="bi '+ic+' d-block mb-2" style="color:'+c+';font-size:1.2rem"></i><div class="summary-number" style="color:'+c+'">'+v+'</div><small class="text-gray">'+l+'</small></div></div>';
  }

  var upcomingHtml='';
  if(upcoming.length){
    upcomingHtml='<div class="births-section mb-4"><div class="fw-bold mb-2" style="color:var(--yellow)"><i class="bi bi-alarm-fill me-2"></i>ولادات متوقعة خلال ١٥ يوم — '+ar(upcoming.length)+' إناث</div>'+
      upcoming.map(r=>{var d=daysUntil(r.expected_birth);return'<div class="d-flex align-items-center gap-2 mt-2 flex-wrap">'+
        '<span class="type-badge badge-yellow">'+(r.female_tag||r.female_breed||'—')+'</span>'+
        '<small class="text-gray">'+r.female_breed+' • '+r.expected_birth+' <span style="color:'+(d<=3?'var(--red)':'var(--orange)')+'">('+(d===0?'اليوم!':d<0?'تأخرت!':'بعد '+ar(d)+' يوم')+')</span></small>'+
        '<button class="action-btn primary sm" onclick="markBorn(\''+r._id+'\')"><i class="bi bi-stars"></i> تسجيل الولادة</button>'+
      '</div>';}).join('')+
    '</div>';
  }

  var returnHeatHtml='';
  if(returnHeat.length){
    returnHeatHtml='<div style="background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.25);border-radius:14px;padding:14px 18px;margin-bottom:16px">'+
      '<div class="fw-bold mb-2 red-text"><i class="bi bi-arrow-repeat me-2"></i>إناث يحتجن إعادة تقريع — '+ar(returnHeat.length)+'</div>'+
      returnHeat.map(r=>'<div class="d-flex gap-2 mt-1 flex-wrap"><span class="type-badge badge-danger">'+(r.female_tag||r.female_breed)+'</span><small class="text-gray">آخر تقريع: '+r.mating_date+' (منذ '+ar(daysSince(r.mating_date))+' يوم)</small><button class="action-btn primary sm" onclick="openBModal(null,\''+encodeURIComponent(r.female_tag||'')+'\',\''+encodeURIComponent(r.female_breed||'')+'\',\''+encodeURIComponent(r.female_species||'goat')+'\')"><i class="bi bi-plus-lg"></i> إعادة تقريع</button></div>').join('')+
    '</div>';
  }

  var filtersHtml='<div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div class="filter-bar">'+
    [{f:'all',l:'الكل',n:breedingRecs.length},{f:'pending',l:'انتظار',n:breedingRecs.filter(r=>r.status==='pending').length},{f:'pregnant',l:'حامل',n:pregnant.length},{f:'born',l:'ولدت',n:born.length},{f:'failed',l:'فشل',n:failed.length}]
    .map(x=>'<button class="filter-btn'+(bFilter===x.f?' active':'')+'" onclick="bFilter=\''+x.f+'\';renderBreedingPage(getSettings())">'+x.l+' ('+ar(x.n)+')</button>').join('')+
  '</div></div>';

  var recHtml='';
  if(filtered.length===0){recHtml='<div class="empty-state"><i class="bi bi-diagram-2"></i><p>لا توجد سجلات</p><button class="action-btn primary" onclick="openBModal()">سجّل أول تقريع</button></div>';}
  else{
    var statusCfg={pregnant:{c:'var(--blue)',l:'حامل'},born:{c:'var(--green)',l:'ولدت'},failed:{c:'var(--red)',l:'فشل/إجهاض'},pending:{c:'var(--orange)',l:'انتظار'}};
    recHtml=filtered.map(function(r){
      var sc=statusCfg[r.status]||statusCfg.pending;
      var d=r.expected_birth?daysUntil(r.expected_birth):null;
      return'<div class="record-card">'+
        '<div class="d-flex justify-content-between align-items-start flex-wrap gap-2">'+
          '<div class="flex-grow-1">'+
            '<div class="d-flex align-items-center gap-2 flex-wrap mb-1">'+
              '<span class="type-badge" style="background:'+sc.c+'22;color:'+sc.c+';border:1px solid '+sc.c+'44">'+sc.l+'</span>'+
              (r.offspring_count>=2?'<span class="type-badge badge-purple">توائم</span>':'')+
              (r.birth_amount?'<span class="type-badge badge-gray">💰 '+ar(r.birth_amount)+' '+getSettings().currency+'</span>':'')+
            '</div>'+
            '<div style="font-size:.85rem"><span class="text-gray">الأنثى: </span><strong>'+(r.female_tag||r.mother_tag||'—')+' ('+(r.female_breed||'—')+')</strong>'+
            ' <span class="text-gray mx-2">|</span><span class="text-gray">الفحل: </span><strong>'+(r.male_tag||'—')+' ('+(r.male_breed||'—')+')</strong></div>'+
            '<small class="text-gray">التقريع: '+(r.mating_date||'—')+
            (r.expected_birth?' | الولادة المتوقعة: '+r.expected_birth+(r.status==='pregnant'&&d!==null?' <span style="color:'+(d<=0?'var(--red)':d<=7?'var(--orange)':'var(--gray)')+'">('+(d===0?'اليوم!':d<0?'تأخرت!':'بعد '+ar(d)+' يوم')+')</span>':''):'')+
            (r.status==='born'&&r.offspring_count?' | المواليد: '+ar(r.offspring_count)+' ('+ar(r.male_offspring||0)+' ذكور / '+ar(r.female_offspring||0)+' إناث)':'')+
            (r.added_by?' | بقلم: '+r.added_by:'')+
            (r.barn?' | '+r.barn:'')+
            '</small>'+
            (r.notes?'<div class="text-gray mt-1" style="font-size:.78rem">'+r.notes+'</div>':'')+
          '</div>'+
          '<div class="d-flex gap-2 flex-shrink-0">'+
            (r.status==='pregnant'?'<button class="action-btn primary sm" onclick="markBorn(\''+r._id+'\')"><i class="bi bi-stars"></i> ولادة</button>':'')+
            '<button class="action-btn sm" onclick="openBModal(\''+r._id+'\')"><i class="bi bi-pencil"></i></button>'+
            '<button class="action-btn danger sm" onclick="delBreeding(\''+r._id+'\')"><i class="bi bi-trash"></i></button>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join('');
  }

  el.innerHTML='<div class="row g-3 mb-4">'+statsCards+'</div>'+upcomingHtml+returnHeatHtml+filtersHtml+recHtml;
}

function daysUntil(d){return Math.ceil((new Date(d)-new Date())/86400000);}
function daysSince(d){return Math.floor((new Date()-new Date(d))/86400000);}

window.markBorn=function(id){
  const r=breedingRecs.find(x=>x._id===id);
  if(!r)return;
  openBModal(id,null,null,null,true);
};

window.delBreeding=async function(id){
  if(!confirm('حذف هذا السجل؟'))return;
  try{await fbDelete('breeding',id);await logActivity('delete','breeding','حذف سجل تكاثر');toast('تم الحذف');breedingRecs=breedingRecs.filter(r=>r._id!==id);renderBreedingPage(getSettings());}
  catch(e){toast('فشل: '+e.message,'error');}
};

// ── تسجيل مولود جديد مباشرة ──
window.openBirthModal=function(){
  const s=getSettings();
  const u=getUser();
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const allBreeds=[...s.goatBreeds,...s.sheepBreeds];
  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:540px;max-height:92vh;overflow-y:auto">'+
    '<h4><i class="bi bi-stars" style="color:var(--yellow)"></i> تسجيل مواليد جديدة</h4>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>نوع المولود</label><select class="field" id="nb-sp"><option value="goat">ماعز</option><option value="sheep">أغنام</option></select></div>'+
      '<div class="col-6"><label>سلالة المولود</label><select class="field" id="nb-breed">'+allBreeds.map(b=>'<option value="'+b+'">'+b+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>الغرض</label><select class="field" id="nb-pur"><option value="birth">مواليد</option><option value="tarbiya">تربية</option><option value="tasmeen">تسمين</option></select></div>'+
      '<div class="col-6"><label>الجنس</label><select class="field" id="nb-gender"><option value="female">أنثى</option><option value="male">ذكر</option></select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>تاريخ الميلاد</label><input type="date" class="field" id="nb-date" value="'+todayStr()+'"></div>'+
      '<div class="col-6"><label>رقم الترقيم</label><input class="field" id="nb-tag" placeholder="A-001"></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>رقم الأم *</label><input class="field" id="nb-mother-tag" placeholder="F-101" required></div>'+
      '<div class="col-6"><label>سلالة الأم *</label><select class="field" id="nb-mother-breed">'+allBreeds.map(b=>'<option value="'+b+'">'+b+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>رقم الأب</label><input class="field" id="nb-father-tag" placeholder="M-001"></div>'+
      '<div class="col-6"><label>وزن الميلاد (كجم)</label><input type="number" class="field" id="nb-weight" step="0.1" placeholder="3.5"></div>'+
    '</div>'+
    '<label>الجمالون/العنبر</label><select class="field" id="nb-barn">'+barns.map(b=>'<option value="'+b+'">'+( b||'— غير محدد —')+'</option>').join('')+'</select>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>عدد المواليد</label><input type="number" class="field" id="nb-qty" value="1" min="1" max="10"></div>'+
      '<div class="col-6">'+
        '<label data-hint="المبلغ المدفوع أو القيمة المقدرة للمولود عند الولادة">المبلغ عند الولادة ('+getSettings().currency+') <span class="info-tooltip" onclick="showInfoModal(this)" data-tip="المبلغ المرتبط بعملية الولادة: سواء كان ثمن شراء الأنثى أو تكلفة الخدمة البيطرية أو قيمة المولود المقدرة">!</span></label>'+
        '<input type="number" class="field" id="nb-amount" placeholder="0" min="0">'+
      '</div>'+
    '</div>'+
    '<label>سُجِّل بواسطة</label><input class="field" id="nb-addedby" value="'+(u?.name||'')+'" readonly>'+
    '<label>ملاحظات</label><textarea class="field" id="nb-notes" rows="2"></textarea>'+
    '<div class="d-flex gap-2 justify-content-end mt-3">'+
      '<button class="action-btn" onclick="closeModal()">إلغاء</button>'+
      '<button class="action-btn primary" onclick="submitBirthDirect()">حفظ الولادة</button>'+
    '</div>'+
  '</div>');
};

window.submitBirthDirect=async function(){
  const motherTag=document.getElementById('nb-mother-tag').value.trim();
  const motherBreed=document.getElementById('nb-mother-breed').value;
  if(!motherTag){toast('رقم الأم مطلوب','error');return;}
  const s=getSettings();const qty=+document.getElementById('nb-qty').value||1;
  const rec={
    female_tag:motherTag, mother_tag:motherTag,
    female_breed:motherBreed, mother_breed:motherBreed,
    female_species:document.getElementById('nb-sp').value,
    male_tag:document.getElementById('nb-father-tag').value.trim()||null,
    mating_date:null, expected_birth:null,
    actual_birth:document.getElementById('nb-date').value,
    status:'born',
    offspring_count:qty,
    male_offspring:document.getElementById('nb-gender').value==='male'?qty:0,
    female_offspring:document.getElementById('nb-gender').value==='female'?qty:0,
    birth_weights:document.getElementById('nb-weight').value||null,
    birth_amount:+document.getElementById('nb-amount').value||null,
    barn:document.getElementById('nb-barn').value||null,
    added_by:document.getElementById('nb-addedby').value||getUser()?.name,
    notes:document.getElementById('nb-notes').value.trim()||null
  };
  // Field-read-timing fix (Repository 5, BL-03): these four were
  // previously re-read inside the try block, AFTER closeModal() had
  // already removed the modal's DOM — capturing them here, alongside
  // rec's own fields, uses the exact same read expressions, just moved
  // earlier. No value, order, or write logic changes.
  const breed=document.getElementById('nb-breed').value;
  const gender=document.getElementById('nb-gender').value;
  const tag=document.getElementById('nb-tag').value.trim();
  const pur=document.getElementById('nb-pur').value;
  // Discovered during live Phase 6 verification (missed in the initial
  // Phase 1 audit): the loop body below also re-read 'nb-father-tag'
  // fresh on every iteration, after closeModal — same root cause,
  // same fix pattern, now captured here alongside rec's own identical
  // read of the same field (rec.male_tag uses this exact expression).
  const fatherTag=rec.male_tag;
  // Also add animal records
  closeModal();toast('جاري الحفظ...','info');
  try{
    await fbPost('breeding',rec);
    const sp=rec.female_species;
    const bdate=rec.actual_birth;
    const barn=rec.barn;
    for(let i=0;i<qty;i++){
      await fbPost('animals',{species:sp,breed,gender,purpose:pur,status:'alive',birth_date:bdate,tag:qty===1?(tag||null):(tag?tag+'-'+ar(i+1):null),barn,mother_tag:motherTag,mother_breed:motherBreed,father_tag:fatherTag});
    }
    await logActivity('add','breeding','تسجيل ولادة: '+motherTag+' — '+ar(qty)+' مواليد');
    toast('✅ تمت إضافة '+ar(qty)+' مواليد في القطيع');
    breedingRecs=await fbGet('breeding');renderBreedingPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

// ── سجل تقريع ──
window.openBModal=function(id, prefTag, prefBreed, prefSpecies, jumpToBorn){
  const s=getSettings();
  editBId=id||null;
  const r=id?breedingRecs.find(x=>x._id===id):{};
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const allBreeds=[...s.goatBreeds,...s.sheepBreeds];
  const u=getUser();
  const sp=r.female_species||decodeURIComponent(prefSpecies||'goat');
  const defaultStatus=jumpToBorn?'born':(r.status||'pending');

  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:560px;max-height:92vh;overflow-y:auto">'+
    '<h4><i class="bi bi-diagram-2-fill accent-text"></i> '+(id?'تعديل':'تسجيل')+' تقريع</h4>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>نوع الأنثى</label><select class="field" id="b-sp" onchange="window._updateBBreeds()"><option value="goat" '+(sp==='goat'?'selected':'')+'>ماعز</option><option value="sheep" '+(sp==='sheep'?'selected':'')+'>أغنام</option></select></div>'+
      '<div class="col-6"><label>سلالة الأنثى</label><select class="field" id="b-fb">'+((sp==='sheep'?s.sheepBreeds:s.goatBreeds).map(b=>'<option value="'+b+'" '+((r.female_breed||decodeURIComponent(prefBreed||''))===b?'selected':'')+'>'+b+'</option>')).join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>ترقيم الأنثى (الأم) *</label><input class="field" id="b-ft" value="'+(r.female_tag||decodeURIComponent(prefTag||''))+'" placeholder="F-101"></div>'+
      '<div class="col-6"><label>ترقيم الفحل</label><input class="field" id="b-mt" value="'+(r.male_tag||'')+'" placeholder="M-001"></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>سلالة الفحل</label><select class="field" id="b-mb">'+allBreeds.map(b=>'<option value="'+b+'" '+(r.male_breed===b?'selected':'')+'>'+b+'</option>').join('')+'</select></div>'+
      '<div class="col-6"><label>الجمالون/العنبر</label><select class="field" id="b-barn">'+barns.map(b=>'<option value="'+b+'" '+(r.barn===b?'selected':'')+'>'+( b||'— غير محدد —')+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>تاريخ التقريع</label><input type="date" class="field" id="b-md" value="'+(r.mating_date||todayStr())+'" onchange="window._calcExpBirth()"></div>'+
      '<div class="col-6"><label>موعد الولادة المتوقع</label><input type="date" class="field" id="b-ed" value="'+(r.expected_birth||'')+'"></div>'+
    '</div>'+
    '<label>الحالة</label><select class="field" id="b-st" onchange="window._toggleBornFields()">'+
      ['pending','pregnant','born','failed'].map(st=>'<option value="'+st+'" '+(defaultStatus===st?'selected':'')+'>'+{pending:'قيد الانتظار',pregnant:'حامل',born:'ولدت',failed:'فشل/إجهاض'}[st]+'</option>').join('')+
    '</select>'+
    '<div id="b-born-fields" style="display:'+(defaultStatus==='born'?'block':'none')+'">'+
      '<label>تاريخ الولادة الفعلي</label><input type="date" class="field" id="b-ad" value="'+(r.actual_birth||todayStr())+'">'+
      '<div class="row g-2">'+
        '<div class="col-4"><label>إجمالي المواليد</label><input type="number" class="field" min="0" id="b-tot" value="'+(r.offspring_count||'')+'"></div>'+
        '<div class="col-4"><label>ذكور</label><input type="number" class="field" min="0" id="b-mal" value="'+(r.male_offspring||'')+'"></div>'+
        '<div class="col-4"><label>إناث</label><input type="number" class="field" min="0" id="b-fem" value="'+(r.female_offspring||'')+'"></div>'+
      '</div>'+
      '<div class="row g-2">'+
        '<div class="col-6"><label>أوزان المواليد (كجم)</label><input class="field" id="b-weights" value="'+(r.birth_weights||'')+'" placeholder="4.5, 3.8"></div>'+
        '<div class="col-6"><label data-hint="المبلغ المدفوع أو القيمة عند الولادة">المبلغ عند الولادة ('+s.currency+') <span class="info-tooltip" onclick="event.stopPropagation();showInfoModal(this)" data-tip="قيمة الولادة: تكلفة بيطري، ثمن الأم، أو قيمة المولود">!</span></label>'+
          '<input type="number" class="field" id="b-amount" value="'+(r.birth_amount||'')+'" placeholder="0"></div>'+
      '</div>'+
    '</div>'+
    '<label>سُجِّل بواسطة</label><input class="field" id="b-addedby" value="'+(r.added_by||u?.name||'')+'">'+
    '<label>ملاحظات</label><textarea class="field" id="b-notes" rows="2">'+(r.notes||'')+'</textarea>'+
    '<div class="d-flex gap-2 justify-content-end mt-3">'+
      '<button class="action-btn" onclick="closeModal()">إلغاء</button>'+
      '<button class="action-btn primary" onclick="submitBreeding()">حفظ</button>'+
    '</div>'+
  '</div>');
};
window._updateBBreeds=function(){const s=getSettings();const sp=document.getElementById('b-sp')?.value;document.getElementById('b-fb').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>'<option>'+b+'</option>').join('');};
window._calcExpBirth=function(){const d=document.getElementById('b-md')?.value;if(d){const dt=new Date(d);dt.setDate(dt.getDate()+(getSettings().pregnancyDays||150));document.getElementById('b-ed').value=dt.toISOString().slice(0,10);}};
window._toggleBornFields=function(){const s=document.getElementById('b-st')?.value;if(document.getElementById('b-born-fields'))document.getElementById('b-born-fields').style.display=s==='born'?'block':'none';};

window.submitBreeding=async function(){
  const ft=document.getElementById('b-ft').value.trim();if(!ft){toast('يرجى إدخال ترقيم الأنثى','error');return;}
  const status=document.getElementById('b-st').value;
  const motherTag=ft; const motherBreed=document.getElementById('b-fb').value;
  const data={female_tag:ft,mother_tag:ft,female_breed:motherBreed,mother_breed:motherBreed,female_species:document.getElementById('b-sp').value,male_tag:document.getElementById('b-mt').value.trim()||null,male_breed:document.getElementById('b-mb').value,barn:document.getElementById('b-barn').value||null,mating_date:document.getElementById('b-md').value,expected_birth:document.getElementById('b-ed').value||null,status,actual_birth:status==='born'?(document.getElementById('b-ad')?.value||null):null,offspring_count:status==='born'?(+document.getElementById('b-tot')?.value||null):null,male_offspring:status==='born'?(+document.getElementById('b-mal')?.value||null):null,female_offspring:status==='born'?(+document.getElementById('b-fem')?.value||null):null,birth_weights:status==='born'?(document.getElementById('b-weights')?.value||null):null,birth_amount:+document.getElementById('b-amount')?.value||null,added_by:document.getElementById('b-addedby').value||getUser()?.name,notes:document.getElementById('b-notes').value.trim()||null};
  // Wave B Commit 1/N (D-02): a birth-status transition creates real
  // animal records via the same createOffspringAnimal() helper _ubSubmit
  // uses. Only fires on a genuine transition INTO 'born' -- an already-
  // 'born' record being merely edited (e.g. fixing a typo) must not
  // re-create animals. Checked against the pre-edit in-memory record,
  // before this function's own write overwrites it.
  var wasAlreadyBorn = !!(editBId && typeof breedingRecs!=='undefined' && breedingRecs && breedingRecs.some(function(r){return r._id===editBId && r.status==='born';}));
  closeModal();toast('جاري الحفظ...','info');
  try{
    let breedingId=editBId;
    if(editBId){await fbPatch('breeding',editBId,data);await logActivity('edit','breeding','تعديل تقريع: '+ft);}
    else{breedingId=await fbPost('breeding',data);await logActivity('add','breeding','تسجيل تقريع: '+ft+(status==='pregnant'?' — حامل':status==='born'?' — ولادة':''));}
    // Sprint 1, Epic 1: attach task automation -- additive only, does not
    // change the breeding write above. Never blocks on failure.
    if(status==='pregnant'&&data.expected_birth&&window.autoGenerateTask){
      window.autoGenerateTask('expected_birth_approaching',{sourceId:breedingId,female_tag:data.female_tag,expected_birth:data.expected_birth,barn:data.barn}).catch(function(){});
    }
    if(status==='born' && !wasAlreadyBorn){
      // birth_weights is a single free-text field on this form (unlike
      // _ubSubmit's per-batch numeric input). Only apply it as a real
      // per-animal weight when it is unambiguously ONE clean number --
      // never guess a split across multiple offspring.
      var singleWeight=null;
      if(data.birth_weights){
        var wTrim=data.birth_weights.trim();
        if(/^-?\d+(\.\d+)?$/.test(wTrim))singleWeight=parseFloat(wTrim);
      }
      var maleCount=data.male_offspring||0, femaleCount=data.female_offspring||0;
      for(var mi=0;mi<maleCount;mi++){
        await window.createOffspringAnimal({species:data.female_species,breed:data.female_breed,gender:'male',purpose:'birth',birthDate:data.actual_birth,motherTag:data.mother_tag,motherBreed:data.mother_breed,fatherTag:data.male_tag,weight:singleWeight,barn:data.barn,notes:data.notes});
      }
      for(var fi=0;fi<femaleCount;fi++){
        await window.createOffspringAnimal({species:data.female_species,breed:data.female_breed,gender:'female',purpose:'birth',birthDate:data.actual_birth,motherTag:data.mother_tag,motherBreed:data.mother_breed,fatherTag:data.male_tag,weight:singleWeight,barn:data.barn,notes:data.notes});
      }
      // Sprint 11 (v1.4): closes the ORIGINAL 'expected_birth_approaching'
      // reminder task created when this SAME breeding record was first
      // marked pregnant -- discovered gap (docs/features/WORKFLOW-DISCOVERY.md):
      // nothing previously resolved that reminder once the birth actually
      // happened. Additive only, never blocks on failure.
      if(window.completeWorkflow){
        window.completeWorkflow('birth', { sourceId:breedingId, animalTag:data.female_tag }).then(function(r){
          if(r&&r.recommendation&&r.recommendation.text&&r.recommendation.actionable!==false)toast('💡 '+r.recommendation.text,'info');
        }).catch(function(){});
      }
    }
    toast(editBId?'تم التحديث':'تمت الإضافة');
    breedingRecs=await fbGet('breeding');renderBreedingPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.showFertilityReport=function(){
  const born=breedingRecs.filter(r=>r.status==='born');
  const total=breedingRecs.filter(r=>r.status!=='pending').length||1;
  const rate=Math.round(born.length/total*100);
  const twins=born.filter(r=>r.offspring_count>=2);
  const twinRate=born.length?Math.round(twins.length/born.length*100):0;
  const totalMoney=born.reduce((t,r)=>t+(+r.birth_amount||0),0);
  const femaleStats={};
  born.forEach(r=>{if(r.female_tag){if(!femaleStats[r.female_tag])femaleStats[r.female_tag]={tag:r.female_tag,breed:r.female_breed,count:0,offspring:0};femaleStats[r.female_tag].count++;femaleStats[r.female_tag].offspring+=(+r.offspring_count||0);}});
  const topFemales=Object.values(femaleStats).sort((a,b)=>b.offspring-a.offspring).slice(0,5);
  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px">'+
    '<h4><i class="bi bi-graph-up accent-text"></i> تقرير الخصوبة والتكاثر</h4>'+
    '<div class="row g-3 mb-3">'+
      '<div class="col-4"><div class="stat-mini"><div class="num green-text">'+ar(rate)+'٪</div><div class="lbl">معدل الخصوبة</div></div></div>'+
      '<div class="col-4"><div class="stat-mini"><div class="num" style="color:var(--purple)">'+ar(twinRate)+'٪</div><div class="lbl">معدل التوائم</div></div></div>'+
      '<div class="col-4"><div class="stat-mini"><div class="num yellow-text">'+ar(born.reduce((t,r)=>t+(+r.offspring_count||0),0))+'</div><div class="lbl">إجمالي المواليد</div></div></div>'+
    '</div>'+
    (totalMoney>0?'<div class="detail-row"><span class="detail-key">إجمالي مبالغ الولادات</span><span class="detail-val green-text">'+totalMoney.toLocaleString('ar-EG')+' '+getSettings().currency+'</span></div>':'')+
    (topFemales.length?'<h6 class="fw-bold mt-3 mb-2">الإناث الأعلى إنتاجاً</h6><table class="tbl w-100"><thead><tr><th>الترقيم</th><th>السلالة</th><th>ولادات</th><th>مواليد</th></tr></thead><tbody>'+topFemales.map(f=>'<tr><td class="fw-bold">'+f.tag+'</td><td class="text-gray">'+f.breed+'</td><td>'+ar(f.count)+'</td><td class="green-text fw-bold">'+ar(f.offspring)+'</td></tr>').join('')+'</tbody></table>':'')+
    '<div class="d-flex justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إغلاق</button></div>'+
  '</div>');
};

window.exportBreedingCSV=function(){
  const rows=[['الأنثى','السلالة','الفحل','التقريع','الولادة المتوقعة','الحالة','المواليد','ذكور','إناث','المبلغ','بقلم'],...breedingRecs.map(r=>[r.female_tag||'',r.female_breed||'',r.male_tag||'',r.mating_date||'',r.expected_birth||'',{pending:'انتظار',pregnant:'حامل',born:'ولدت',failed:'فشل'}[r.status]||r.status,r.offspring_count||'',r.male_offspring||'',r.female_offspring||'',r.birth_amount||'',r.added_by||''])];
  const csv=rows.map(r=>r.map(x=>'"'+x+'"').join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download='breeding-'+todayStr()+'.csv';a.click();
  toast('تم التصدير');
};
