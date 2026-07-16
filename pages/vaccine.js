'use strict';
let vaccines=[], vaccFilter='all', editVaccId=null;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  // SECURITY FIX (Phase 6 hardening): nav.js grants perm:'health', unenforced until now.
  if (!can('health')) {
    document.getElementById('content').innerHTML='<div class="empty-state"><i class="bi bi-shield-x"></i><p>غير مصرح بالوصول لبيانات التحصين</p></div>';
    renderNavbar('vaccine.html');
    return;
  }
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('vaccine.html');

  // FAB for mobile
  addFAB('تحصين جديد', function(){ openVaccModal(); }, 'bi-bandaid-fill');
  renderRelatedLinks('vaccine.js');
  vaccines=await fbGet('vaccinations');
  renderVaccPage(s);
});

function renderVaccPage(s){
  renderPageHeader('<i class="bi bi-bandaid-fill accent-text"></i> التحصين',
    `${ar(vaccines.length)} تحصين مسجّل`,
    can('health')?`<div class="d-flex gap-2">
      <button class="action-btn" onclick="openTemplates()" style="background:rgba(33,150,243,.1);border-color:rgba(33,150,243,.35);color:var(--blue)">
        <i class="bi bi-bookmark-fill"></i> القوالب
      </button>
      <button class="action-btn primary" onclick="openVaccModal()"><i class="bi bi-plus-lg"></i> جدول تحصين جديد</button>
    </div>`:''
  );
  const el=document.getElementById('content');
  const done=vaccines.filter(v=>v.status==='done').reduce((t,v)=>t+(+v.count||0),0);
  const pend=vaccines.filter(v=>v.status==='pending').reduce((t,v)=>t+(+v.count||0),0);
  const over=vaccines.filter(v=>v.status==='overdue').reduce((t,v)=>t+(+v.count||0),0);
  const tot=done+pend+over||1;

  // Upcoming in next 7 days
  const upcoming=vaccines.filter(v=>v.status==='pending'&&v.scheduled_date&&daysUntil(v.scheduled_date)>=0&&daysUntil(v.scheduled_date)<=7);

  const filtered=vaccFilter==='all'?vaccines:vaccines.filter(v=>v.status===vaccFilter);

  el.innerHTML=`
  <div class="row g-3 mb-4">
    ${[{l:'تم التنفيذ',v:done,pct:Math.round(done/tot*100),c:'var(--green)',i:'bi-check-circle-fill'},
       {l:'قيد الانتظار',v:pend,pct:Math.round(pend/tot*100),c:'var(--orange)',i:'bi-clock-fill'},
       {l:'متأخر',v:over,pct:Math.round(over/tot*100),c:'var(--red)',i:'bi-exclamation-circle-fill'}
    ].map(s=>`<div class="col-md-4"><div class="summary-card">
      <i class="bi ${s.i} d-block mb-2" style="font-size:1.4rem;color:${s.c}"></i>
      <div class="summary-number" style="color:${s.c}">${ar(s.v)}</div>
      <div class="text-gray">${s.l}</div><small style="color:${s.c};font-weight:700">${ar(s.pct)}٪</small>
    </div></div>`).join('')}
  </div>

  ${upcoming.length>0?`<div style="background:rgba(255,193,7,.08);border:1px solid rgba(255,193,7,.25);border-radius:16px;padding:16px 20px;margin-bottom:16px">
    <div class="fw-bold mb-2" style="color:var(--yellow)"><i class="bi bi-alarm-fill me-2"></i>تحصينات قادمة خلال ٧ أيام</div>
    ${upcoming.map(v=>`<div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
      <span class="type-badge badge-yellow">${v.name}</span>
      <small class="text-gray">${v.target_section||'—'} • ${ar(+v.count||0)} رأس • بعد ${ar(daysUntil(v.scheduled_date))} يوم (${v.scheduled_date})</small>
      ${can('health')?`<button class="action-btn primary sm" aria-label="تعليم كمنجز" onclick="markDone('${v._id}')"><i class="bi bi-check-lg"></i> تنفيذ الآن</button>`:''}
    </div>`).join('')}
  </div>`:''}

  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${['all','pending','overdue','done'].map(f=>`<button class="filter-btn${vaccFilter===f?' active':''}" onclick="vaccFilter='${f}';renderVaccPage(getSettings())">${{all:'الكل',pending:'انتظار',overdue:'متأخر',done:'منجز'}[f]} (${f==='all'?vaccines.length:vaccines.filter(v=>v.status===f).length})</button>`).join('')}
    </div>
    <button class="action-btn sm" onclick="exportVaccCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>
  </div>

  ${filtered.length===0?`<div class="empty-state"><i class="bi bi-bandaid"></i><p>لا توجد تحصينات</p></div>`:
  filtered.map(v=>{
    const d=v.scheduled_date?daysUntil(v.scheduled_date):null;
    return`<div class="record-card">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div class="flex-grow-1">
          <div class="fw-bold mb-1 d-flex align-items-center gap-2 flex-wrap">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${v.status==='done'?'var(--green)':v.status==='overdue'?'var(--red)':'var(--orange)'}"></span>
            ${v.name}
            <span class="type-badge ${v.status==='done'?'badge-tarbiya':v.status==='overdue'?'badge-danger':'badge-yellow'}" style="font-size:.7rem">${{done:'تم',overdue:'متأخر',pending:'انتظار'}[v.status]}</span>
          </div>
          <div class="d-flex gap-3 flex-wrap" style="font-size:.82rem">
            <span class="text-gray"><i class="bi bi-building me-1"></i>${v.target_section||'كل الأقسام'}</span>
            <span class="text-gray"><i class="bi bi-collection me-1"></i>${ar(+v.count||0)} رأس</span>
            ${v.scheduled_date?`<span class="text-gray"><i class="bi bi-calendar3 me-1"></i>موعد: ${v.scheduled_date} ${d!==null&&v.status==='pending'?`<span style="color:${d<3?'var(--red)':'var(--orange)'}">(${d>0?'بعد '+ar(d)+' يوم':'اليوم!'})</span>`:''}</span>`:''}
            ${v.done_date?`<span class="green-text"><i class="bi bi-check-circle me-1"></i>نُفِّذ: ${v.done_date}</span>`:''}
            ${v.executed_by?`<span class="text-gray"><i class="bi bi-person me-1"></i>${v.executed_by}</span>`:''}
          </div>
          <div class="progress-wonder"><div class="progress-bar-wonder" style="width:${v.progress||0}%;${v.status==='overdue'?'background:linear-gradient(90deg,var(--red),#ff8a65)':''}"></div></div>
          <small class="text-gray">${ar(v.progress||0)}٪</small>
          ${v.notes?`<div class="text-gray mt-1" style="font-size:.78rem"><i class="bi bi-chat-left-text me-1"></i>${v.notes}</div>`:''}
        </div>
        <div class="d-flex gap-2 flex-wrap flex-shrink-0">
          ${v.status!=='done'&&can('health')?`<button class="action-btn primary sm" aria-label="تعليم كمنجز" onclick="markDone('${v._id}')"><i class="bi bi-check-lg"></i> تنفيذ</button>`:''}
          ${can('health')?`<button class="action-btn sm" onclick="openVaccModal('${v._id}')"><i class="bi bi-pencil"></i></button>`:''}
          ${can('admin')?`<button class="action-btn danger sm" onclick="delVacc('${v._id}')"><i class="bi bi-trash"></i></button>`:''}
        </div>
      </div>
    </div>`;
  }).join('')}`;
}

function daysUntil(dateStr){return Math.ceil((new Date(dateStr)-new Date())/86400000);}

window.markDone=async function(id){
  const u=getUser();
  try{
    await fbPatch('vaccinations',id,{status:'done',done_date:todayStr(),progress:100,executed_by:u?.name||'—'});
    await logActivity('edit','vaccine','تنفيذ تحصين: '+vaccines.find(v=>v._id===id)?.name);
    toast('تم تسجيل التحصين كمنجز');
    vaccines=await fbGet('vaccinations');
    renderVaccPage(getSettings());
  }catch(e){toast('فشل: '+e.message,'error');}
};

window.delVacc=async function(id){
  if(!confirm('حذف هذا التحصين؟'))return;
  try{
    await fbDelete('vaccinations',id);
    await logActivity('delete','vaccine','حذف تحصين');
    toast('تم الحذف');
    vaccines=vaccines.filter(v=>v._id!==id);
    renderVaccPage(getSettings());
  }catch(e){toast('فشل: '+e.message,'error');}
};

window.openVaccModal=function(id){
  const s=getSettings();
  editVaccId=id||null;
  const v=id?vaccines.find(x=>x._id===id):{};
  const barns=['ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢','كل الأقسام'];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:520px;max-height:92vh;overflow-y:auto">
    <h4><i class="bi bi-bandaid-fill accent-text"></i> ${id?'تعديل':'إضافة'} تحصين</h4>
    <label>اسم التحصين *</label><input class="field" id="v-name" value="${v.name||''}" placeholder="مثال: تطعيم الجدري">
    <label>القسم المستهدف</label>
    <select class="field" id="v-section">${barns.map(b=>`<option value="${b}" ${v.target_section===b?'selected':''}>${b}</option>`).join('')}</select>
    <div class="row g-2">
      <div class="col-6"><label>عدد الرؤوس</label><input type="number" class="field" id="v-count" value="${v.count||0}" min="0"></div>
      <div class="col-6"><label>الحالة</label>
        <select class="field" id="v-status">
          <option value="pending" ${v.status==='pending'||!v.status?'selected':''}>قيد الانتظار</option>
          <option value="done" ${v.status==='done'?'selected':''}>تم</option>
          <option value="overdue" ${v.status==='overdue'?'selected':''}>متأخر</option>
        </select>
      </div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>تاريخ الموعد</label><input type="date" class="field" id="v-scheduled" value="${v.scheduled_date||''}"></div>
      <div class="col-6"><label>تاريخ التنفيذ</label><input type="date" class="field" id="v-done-date" value="${v.done_date||''}"></div>
    </div>
    <label>نسبة الإنجاز ٪</label>
    <input type="range" class="field" id="v-prog" min="0" max="100" value="${v.progress||0}" oninput="document.getElementById('v-pct').textContent=this.value+'٪'">
    <small class="text-gray" id="v-pct">${ar(v.progress||0)}٪</small>
    <label>تكرار التحصين</label>
    <select class="field" id="v-repeat">
      <option value="" ${!v.repeat?'selected':''}>مرة واحدة</option>
      <option value="monthly" ${v.repeat==='monthly'?'selected':''}>شهري</option>
      <option value="quarterly" ${v.repeat==='quarterly'?'selected':''}>كل ٣ أشهر</option>
      <option value="biannual" ${v.repeat==='biannual'?'selected':''}>نصف سنوي</option>
      <option value="annual" ${v.repeat==='annual'?'selected':''}>سنوي</option>
    </select>
    <label>ملاحظات</label><textarea class="field" id="v-notes" rows="2">${v.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitVacc()">حفظ</button>
    </div>
  </div>`);
};

window.submitVacc=async function(){
  const name=document.getElementById('v-name').value.trim();
  if(!name){toast('يرجى إدخال اسم التحصين','error');return;}
  const data={name,target_section:document.getElementById('v-section').value,count:+document.getElementById('v-count').value||0,status:document.getElementById('v-status').value,scheduled_date:document.getElementById('v-scheduled').value||null,done_date:document.getElementById('v-done-date').value||null,progress:+document.getElementById('v-prog').value||0,repeat:document.getElementById('v-repeat').value||null,notes:document.getElementById('v-notes').value.trim()||null};
  closeModal();toast('جاري الحفظ...','info');
  try{
    if(editVaccId){await fbPatch('vaccinations',editVaccId,data);await logActivity('edit','vaccine','تعديل تحصين: '+name);}
    else{await fbPost('vaccinations',data);await logActivity('add','vaccine','إضافة تحصين: '+name);}
    toast(editVaccId?'تم التحديث':'تمت الإضافة');
    vaccines=await fbGet('vaccinations');
    renderVaccPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.exportVaccCSV=function(){
  const rows=[['اسم التحصين','القسم','العدد','الحالة','تاريخ الموعد','تاريخ التنفيذ','الإنجاز%'],
    ...vaccines.map(v=>[v.name,v.target_section||'',v.count||0,{done:'تم',pending:'انتظار',overdue:'متأخر'}[v.status]||v.status,v.scheduled_date||'',v.done_date||'',v.progress||0])
  ];
  const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`vaccinations-${todayStr()}.csv`;a.click();
  toast('تم التصدير');
};


// ── Vaccination Templates ──────────────────────────────
var VACC_TEMPLATES_DEFAULT = [
  {id:'t1',name:'طاعون الغنم والماعز',target:'كل القطيع',interval_months:6,notes:'مرتين سنوياً — ربيع وخريف',vaccine_type:'معطّل'},
  {id:'t2',name:'حمى القلاعية والطرق', target:'كل القطيع',interval_months:6,notes:'مرتين سنوياً',vaccine_type:'معطّل'},
  {id:'t3',name:'الجدري (الماعز)',      target:'الماعز فقط',interval_months:12,notes:'سنوي للماعز',vaccine_type:'حي مخفف'},
  {id:'t4',name:'التهاب الكبد المعدي',  target:'كل القطيع',interval_months:12,notes:'سنوي',vaccine_type:'معطّل'},
  {id:'t5',name:'التسمم الدموي',        target:'كل القطيع',interval_months:6, notes:'قبل موسم البرد',vaccine_type:'مصل'},
  {id:'t6',name:'الدودة الشريطية',      target:'المواليد',  interval_months:3, notes:'عمر 3-4 أسابيع',vaccine_type:'طارد'},
];

window.openTemplates = async function() {
  var stored = [];
  try { stored = await fbGet('vaccination_templates'); } catch(e) {}
  var allTpls = VACC_TEMPLATES_DEFAULT.concat((stored||[]).filter(function(t){return t.custom;}));

  var rows = allTpls.map(function(t) {
    var next = new Date();
    next.setMonth(next.getMonth() + (t.interval_months||6));
    var nextStr = next.toISOString().slice(0,10);
    var delBtn = t.custom
      ? '<button class="action-btn sm danger" data-id="' + (t._id||'') + '" onclick="deleteTpl(this)" style="padding:3px 8px"><i class="bi bi-trash"></i></button>'
      : '';
    return '<div class="wonder-card mb-2 p-3">' +
      '<div class="d-flex justify-content-between align-items-start gap-2">' +
        '<div>' +
          '<div class="fw-bold">' + t.name + '</div>' +
          '<small class="text-gray">' + t.target + ' | كل ' + (t.interval_months||12) + ' شهر' +
            (t.vaccine_type ? ' | ' + t.vaccine_type : '') + '</small>' +
          (t.notes ? '<div class="text-gray mt-1" style="font-size:.75rem">' + t.notes + '</div>' : '') +
        '</div>' +
        '<div class="d-flex gap-2 flex-shrink-0">' +
          delBtn +
          '<button class="action-btn sm primary" data-tpl-id="' + (t._id||t.id||'') + '" data-next="' + nextStr + '" onclick="applyTplByBtn(this)">' +
            '<i class="bi bi-play-fill"></i> تطبيق' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  showModal(
    '<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:600px;max-height:90vh;overflow-y:auto">' +
    '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h4 class="mb-0"><i class="bi bi-bookmark-fill accent-text me-2"></i>قوالب التحصين</h4>' +
      '<button class="action-btn sm primary" onclick="openSaveTemplate()"><i class="bi bi-plus-lg"></i> قالب جديد</button>' +
    '</div>' +
    '<p class="text-gray mb-3" style="font-size:.82rem">اضغط تطبيق لإنشاء جدول تحصين من القالب مباشرة</p>' +
    rows +
    '<div class="d-flex justify-content-end mt-2"><button class="action-btn" onclick="closeModal()">إغلاق</button></div>' +
    '</div>'
  );

  // Store for reference
  window._allTpls = allTpls;
};

window.applyTplByBtn = function(btn) {
  var id   = btn.dataset.tplId;
  var next = btn.dataset.next;
  var tpl  = (window._allTpls||VACC_TEMPLATES_DEFAULT).find(function(t){ return (t._id||t.id) === id; });
  if (!tpl) { toast('القالب غير موجود','error'); return; }
  applyTemplate(tpl, next);
};

window.applyTemplate = function(tpl, suggestedDate) {
  closeModal();
  window._pendingTpl = tpl;
  showModal(
    '<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px">' +
    '<h4><i class="bi bi-bandaid-fill accent-text me-2"></i>تطبيق قالب: ' + tpl.name + '</h4>' +
    '<div class="mb-3 p-3" style="background:rgba(33,150,243,.07);border:1px solid rgba(33,150,243,.2);border-radius:10px;font-size:.82rem">' +
      '<div class="fw-bold mb-1" style="color:var(--blue)">' + tpl.name + '</div>' +
      '<div class="text-gray">' + tpl.target + ' | كل ' + (tpl.interval_months||12) + ' شهر</div>' +
      (tpl.notes ? '<div class="text-gray">' + tpl.notes + '</div>' : '') +
    '</div>' +
    '<div class="row g-2">' +
      '<div class="col-6"><label>التاريخ المقترح</label><input type="date" class="field" id="tpl-date" value="' + (suggestedDate||todayStr()) + '"></div>' +
      '<div class="col-6"><label>القسم / العنبر</label><input class="field" id="tpl-section" value="' + tpl.target + '"></div>' +
    '</div>' +
    '<label>عدد الرؤوس</label><input type="number" class="field" id="tpl-count" value="0" min="0">' +
    '<label>ملاحظات</label><textarea class="field" id="tpl-notes" rows="2">' + (tpl.notes||'') + '</textarea>' +
    '<div class="d-flex gap-2 justify-content-end mt-3">' +
      '<button class="action-btn" onclick="closeModal()">إلغاء</button>' +
      '<button class="action-btn primary" onclick="submitTpl()"><i class="bi bi-check-lg"></i> حفظ الجدول</button>' +
    '</div></div>'
  );
};


window.submitTpl = async function() {
  var tpl = window._pendingTpl || {};
  var vaccName = tpl.name || '—'; 
  var date    = document.getElementById('tpl-date').value;
  var section = document.getElementById('tpl-section').value.trim();
  var count   = parseInt(document.getElementById('tpl-count').value)||0;
  var notes   = document.getElementById('tpl-notes').value.trim();
  if (!date) { toast('أدخل التاريخ','error'); return; }
  closeModal();
  try {
    await fbPost('vaccinations', {
      name:vaccName, target_section:section, count:count,
      scheduled_date:date, status:'pending', notes:notes||null,
      from_template:true, created_at:todayStr(),
    });
    await logActivity('add','vaccinations','جدولة من قالب: '+vaccName);
    toast('✅ تم إنشاء جدول التحصين');
    vaccines = await fbGet('vaccinations',true);
    renderVaccPage(getSettings());
  } catch(e) { toast('خطأ: '+e.message,'error'); }
};

window.openSaveTemplate = function() {
  closeModal();
  showModal(
    '<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:460px">' +
    '<h4><i class="bi bi-bookmark-plus-fill accent-text me-2"></i>حفظ قالب جديد</h4>' +
    '<label>اسم التحصين *</label><input class="field" id="ntpl-name" placeholder="طاعون الغنم">' +
    '<div class="row g-2">' +
      '<div class="col-6"><label>الفئة المستهدفة</label><input class="field" id="ntpl-target" placeholder="كل القطيع"></div>' +
      '<div class="col-6"><label>التكرار (شهر)</label><input type="number" class="field" id="ntpl-interval" value="6" min="1" max="24"></div>' +
    '</div>' +
    '<label>نوع اللقاح</label><input class="field" id="ntpl-type" placeholder="معطّل / حي / مصل">' +
    '<label>ملاحظات</label><textarea class="field" id="ntpl-notes" rows="2"></textarea>' +
    '<div class="d-flex gap-2 justify-content-end mt-3">' +
      '<button class="action-btn" onclick="openTemplates()">رجوع</button>' +
      '<button class="action-btn primary" onclick="saveNewTpl()"><i class="bi bi-floppy-fill"></i> حفظ</button>' +
    '</div></div>'
  );
};

window.saveNewTpl = async function() {
  var name = document.getElementById('ntpl-name').value.trim();
  if (!name) { toast('أدخل اسم التحصين','error'); return; }
  try {
    await fbPost('vaccination_templates',{
      name:name,
      target:document.getElementById('ntpl-target').value.trim()||'كل القطيع',
      interval_months:parseInt(document.getElementById('ntpl-interval').value)||6,
      vaccine_type:document.getElementById('ntpl-type').value.trim(),
      notes:document.getElementById('ntpl-notes').value.trim(),
      custom:true, created_at:todayStr(),
    });
    toast('✅ تم حفظ القالب');
    openTemplates();
  } catch(e) { toast('خطأ: '+e.message,'error'); }
};

window.deleteTpl = async function(btn) {
  var id = btn && btn.dataset ? btn.dataset.id : btn;
  if (!id || !confirm('حذف هذا القالب؟')) return;
  try { await fbDelete('vaccination_templates',id); toast('تم الحذف'); openTemplates(); }
  catch(e) { toast('خطأ','error'); }
};