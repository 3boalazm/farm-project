'use strict';
let meds=[], feeds=[], equipment=[], invTab='meds', editInvId=null;

document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('inventory.html');

  // FAB for mobile
  addFAB('إضافة للمخزن', function(){ openAddInv(); }, 'bi-plus-square-fill');
  renderRelatedLinks('inventory.js');
  await loadInventory();
  renderInventoryPage(s);
});

async function loadInventory(){
  [meds,feeds,equipment]=await Promise.all([fbGet('inventory_meds'),fbGet('inventory_feeds'),fbGet('inventory_equipment')]);
}

function renderInventoryPage(s){
  const t=todayStr();
  const expiringSoon=meds.filter(m=>m.expiry&&daysLeft(m.expiry)>=0&&daysLeft(m.expiry)<=30).length;
  const lowFeedItems=feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0);
  const lowMedItems=meds.filter(m=>+m.quantity<=+m.min_quantity&&+m.min_quantity>0);

  renderPageHeaderV2({
    title: '<i class="bi bi-boxes accent-text"></i> التغذية والمخزن',
    description: `صيدلية ${ar(meds.length)} | أعلاف ${ar(feeds.length)} | معدات ${ar(equipment.length)}`,
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'المخزون'}],
    primaryAction: `<button class="action-btn primary" onclick="openAddInv()"><i class="bi bi-plus-lg"></i> إضافة</button>`,
    secondaryActions: `<button class="action-btn sm" onclick="exportInvCSV()"><i class="bi bi-filetype-csv"></i> تصدير</button>`
  });
  const el=document.getElementById('content');

  // Alerts — one Alert Card per real signal, instead of one grouped banner
  const alertsHtml = [
    expiringSoon>0 ? renderAlertCard({ severity:'critical', icon:'bi-capsule', title:`${ar(expiringSoon)} دواء قارب على الانتهاء`, source:'الصيدلية', actionLabel:'عرض', actionHref:'javascript:invTab="meds";renderInventoryPage(getSettings())' }) : '',
    lowMedItems.length>0 ? renderAlertCard({ severity:'critical', icon:'bi-exclamation-triangle', title:`${ar(lowMedItems.length)} دواء وصل للحد الأدنى`, message: lowMedItems.slice(0,3).map(m=>m.name).join('، '), source:'الصيدلية' }) : '',
    lowFeedItems.length>0 ? renderAlertCard({ severity:'watch', icon:'bi-exclamation-triangle', title:`${ar(lowFeedItems.length)} علف وصل للحد الأدنى`, message: lowFeedItems.slice(0,3).map(f=>f.name).join('، '), source:'الأعلاف' }) : '',
  ].filter(Boolean).join('');

  // Stock Indicators (farm-specific component) — quick visual scan of anything running low, separate from the full detail tables below
  const stockIndicatorsHtml = (lowMedItems.length + lowFeedItems.length) > 0 ? renderSectionContainer({
    title: 'أصناف تحتاج انتباه',
    description: 'أقل من أو عند الحد الأدنى',
    contentHtml: [...lowMedItems, ...lowFeedItems].slice(0,8).map(item => renderInventoryStockIndicator({ name:item.name, quantity:+item.quantity, minQuantity:+item.min_quantity, unit:item.unit||'' })).join('')
  }) : '';

  el.innerHTML=`
  ${alertsHtml ? `<div class="mb-4">${alertsHtml}</div>` : ''}
  ${stockIndicatorsHtml ? `<div class="mb-4">${stockIndicatorsHtml}</div>` : ''}

  <div class="row g-3 mb-4">
    ${[{l:'أدوية',v:meds.length,tab:'meds'},{l:'أعلاف',v:feeds.length,tab:'feeds'},{l:'معدات',v:equipment.length,tab:'equip'}].map(x=>`
      <div class="col-md-4">${renderKPICard({
        label: `<span onclick="invTab='${x.tab}';renderInventoryPage(getSettings())" style="cursor:pointer">${x.l}</span>`,
        value: ar(x.v), status: invTab===x.tab?'watch':'normal'
      })}</div>`).join('')}
  </div>

  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      <button class="filter-btn${invTab==='meds'?' active':''}" onclick="invTab='meds';renderInventoryPage(getSettings())"><i class="bi bi-capsule"></i> الصيدلية (${meds.length})</button>
      <button class="filter-btn${invTab==='feeds'?' active':''}" onclick="invTab='feeds';renderInventoryPage(getSettings())"><i class="bi bi-bag-fill"></i> الأعلاف (${feeds.length})</button>
      <button class="filter-btn${invTab==='equip'?' active':''}" onclick="invTab='equip';renderInventoryPage(getSettings())"><i class="bi bi-tools"></i> المعدات (${equipment.length})</button>
      <button class="filter-btn${invTab==='consumption'?' active':''}" onclick="invTab='consumption';renderInventoryPage(getSettings())"><i class="bi bi-bar-chart-fill"></i> استهلاك الأعلاف</button>
    </div>
    <div class="d-flex gap-2">
      ${invTab==='feeds'?`<button class="action-btn sm" onclick="showFCR()"><i class="bi bi-calculator"></i> FCR</button>`:''}
    </div>
  </div>

  ${invTab==='meds'?renderMedsTable():''}
  ${invTab==='feeds'?renderFeedsTable(s):''}
  ${invTab==='equip'?renderEquipTable():''}
  ${invTab==='consumption'?renderConsumptionTab():''}`;
}

function renderMedsTable(){
  if(!meds.length)return`<div class="empty-state"><i class="bi bi-capsule"></i><p>الصيدلية فارغة</p><button class="action-btn primary" onclick="openAddInv()"><i class="bi bi-plus-lg"></i> إضافة دواء</button></div>`;
  const t=todayStr();
  return renderDataTableWrapper({
    title: 'الصيدلية',
    headers: ['الدواء','الكمية','الوحدة','الحد الأدنى','تاريخ الانتهاء','الغرض','الجمالون',''],
    rowsHtml: meds.map(m=>{const d=m.expiry?daysLeft(m.expiry):null;const warn=d!==null&&d<=30;const low=+m.quantity<=+m.min_quantity&&+m.min_quantity>0;return`<tr><td class="fw-bold">${m.name}</td><td class="${low?'red-text fw-bold':'fw-bold'}">${m.quantity}${low?` <i class="bi bi-exclamation-triangle-fill red-text"></i>`:''}</td><td class="text-gray">${m.unit||'—'}</td><td class="text-gray">${m.min_quantity||0}</td><td class="${d===null?'text-gray':d<=7?'red-text':d<=30?'accent-text':'green-text'}">${m.expiry||'—'} ${warn?`(${ar(d)} يوم)`:''}</td><td class="text-gray">${m.purpose||'—'}</td><td class="text-gray">${m.barn||'—'}</td><td><div class="d-flex gap-1"><button class="icon-btn edit" onclick="openEditInv('meds','${m._id}')"><i class="bi bi-pencil"></i></button><button class="icon-btn" onclick="openUseModal('meds','${m._id}','${m.name}',${m.quantity})" style="color:var(--orange)"><i class="bi bi-dash-circle"></i></button><button class="icon-btn del" onclick="delInv('meds','${m._id}')"><i class="bi bi-trash"></i></button></div></td></tr>`;}).join('')
  });
}

function renderFeedsTable(s){
  if(!feeds.length)return`<div class="empty-state"><i class="bi bi-bag-fill"></i><p>مخزن الأعلاف فارغ</p><button class="action-btn primary" onclick="openAddInv()"><i class="bi bi-plus-lg"></i> إضافة علف</button></div>`;
  const totalCost=feeds.reduce((t,f)=>(+f.cost_per_unit||0)*(+f.quantity||0)+t,0);
  return`<div class="wonder-card mb-3 text-center"><small class="text-gray">إجمالي تكلفة المخزون: </small><strong class="accent-text">${totalCost.toLocaleString('ar-EG')} ${s.currency}</strong></div>` +
  renderDataTableWrapper({
    title: 'الأعلاف',
    headers: ['العلف','الكمية','الوحدة','الحد الأدنى','التكلفة/وحدة','الإجمالي','الجمالون',''],
    rowsHtml: feeds.map(f=>{const low=+f.quantity<=+f.min_quantity&&+f.min_quantity>0;return`<tr><td class="fw-bold">${f.name}</td><td class="${low?'red-text fw-bold':'fw-bold'}">${f.quantity}${low?` <i class="bi bi-exclamation-triangle-fill red-text"></i>`:''}</td><td class="text-gray">${f.unit||'—'}</td><td class="text-gray">${f.min_quantity||0}</td><td class="text-gray">${f.cost_per_unit?f.cost_per_unit+' '+s.currency:'—'}</td><td class="accent-text fw-bold">${f.cost_per_unit&&f.quantity?(+f.cost_per_unit*(+f.quantity)).toLocaleString('ar-EG')+' '+s.currency:'—'}</td><td class="text-gray">${f.barn||'—'}</td><td><div class="d-flex gap-1"><button class="icon-btn edit" onclick="openEditInv('feeds','${f._id}')"><i class="bi bi-pencil"></i></button><button class="icon-btn" onclick="openUseModal('feeds','${f._id}','${f.name}',${f.quantity})" style="color:var(--orange)"><i class="bi bi-dash-circle"></i></button><button class="icon-btn del" onclick="delInv('feeds','${f._id}')"><i class="bi bi-trash"></i></button></div></td></tr>`;}).join('')
  });
}

function renderEquipTable(){
  if(!equipment.length)return`<div class="empty-state"><i class="bi bi-tools"></i><p>لا توجد معدات مسجلة</p><button class="action-btn primary" onclick="openAddInv()"><i class="bi bi-plus-lg"></i> إضافة معدة</button></div>`;
  return renderDataTableWrapper({
    title: 'المعدات',
    headers: ['المعدة','النوع','الحالة','صيانة قادمة','ملاحظات',''],
    rowsHtml: equipment.map(e=>{const d=e.next_maintenance?daysLeft(e.next_maintenance):null;return`<tr><td class="fw-bold">${e.name}</td><td class="text-gray">${e.type||'—'}</td><td><span class="type-badge ${e.status==='working'?'badge-tarbiya':e.status==='broken'?'badge-danger':'badge-yellow'}">${{working:'يعمل',broken:'معطل',maintenance:'صيانة'}[e.status]||e.status}</span></td><td class="${d!==null&&d<=30?'red-text':'text-gray'}">${e.next_maintenance||'—'} ${d!==null&&d<=30?`(${ar(d)} يوم)`:''}</td><td class="text-gray">${e.notes||'—'}</td><td><div class="d-flex gap-1"><button class="icon-btn edit" onclick="openEditInv('equip','${e._id}')"><i class="bi bi-pencil"></i></button><button class="icon-btn del" onclick="delInv('equip','${e._id}')"><i class="bi bi-trash"></i></button></div></td></tr>`;}).join('')
  });
}

function daysLeft(d){return Math.ceil((new Date(d)-new Date())/86400000);}

window.showFCR=function(){
  var feedTypes=[
    {id:'concentrate', label:'علف مركز', unit:'كجم'},
    {id:'clover_dry',  label:'برسيم جاف (دريس)', unit:'كجم'},
    {id:'clover_green',label:'برسيم أخضر', unit:'كجم'},
    {id:'peanut',      label:'عرش فول سوداني', unit:'كجم'},
    {id:'panicum',     label:'بونيكام', unit:'كجم'},
    {id:'salt',        label:'قوالب أملاح وفيتامينات', unit:'قرص'},
    {id:'custom1',     label:'إضافة يدوية ١', unit:'كجم'},
    {id:'custom2',     label:'إضافة يدوية ٢', unit:'كجم'},
  ];

  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:520px;max-height:92vh;overflow-y:auto">'+
    '<h4><i class="bi bi-calculator accent-text"></i> حاسبة كفاءة التحويل الغذائي (FCR)</h4>'+
    '<div style="background:rgba(255,107,53,.06);border-radius:10px;padding:10px 14px;font-size:.82rem;margin-bottom:12px">'+
      '<strong>FCR = إجمالي العلف المستهلك ÷ الزيادة في الوزن</strong><br>'+
      '<span class="text-gray">كلما قل الرقم كان الحيوان أكثر كفاءة: أقل من 3 = ممتاز | 3-5 = جيد | 5-7 = مقبول | أكثر من 7 = ضعيف</span>'+
    '</div>'+
    '<h6 class="fw-bold mb-2">أنواع الغذاء المقدم (كجم/يوم)</h6>'+
    '<div class="row g-2 mb-3" id="fcr-feeds">'+
      feedTypes.map(f=>'<div class="col-6"><label class="text-gray" style="font-size:.72rem">'+f.label+'</label><input type="number" class="field fcr-feed-input" data-unit="'+f.unit+'" id="fcr-'+f.id+'" step="0.1" min="0" placeholder="0" value="0"></div>').join('')+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>إجمالي الأيام</label><input type="number" class="field" id="fcr-days" value="30" min="1"></div>'+
      '<div class="col-6"><label>الزيادة في الوزن (كجم)</label><input type="number" class="field" id="fcr-weight" step="0.1" min="0" placeholder="مثال: 20"></div>'+
    '</div>'+
    '<div id="fcr-result" class="mt-3 p-3 text-center" style="background:rgba(0,230,118,.06);border-radius:12px;display:none">'+
      '<div style="display:flex;justify-content:space-around;flex-wrap:wrap;gap:10px;margin-bottom:10px">'+
        '<div class="stat-mini" style="flex:1"><div class="num accent-text" id="fcr-total-feed">—</div><div class="lbl">إجمالي العلف (كجم)</div></div>'+
        '<div class="stat-mini" style="flex:1"><div class="num green-text" id="fcr-val">—</div><div class="lbl">معامل FCR</div></div>'+
      '</div>'+
      '<div id="fcr-rating" class="mt-2" style="font-size:.88rem"></div>'+
      '<div id="fcr-breakdown" class="mt-3" style="font-size:.78rem;text-align:right"></div>'+
    '</div>'+
    '<div class="d-flex gap-2 justify-content-end mt-3">'+
      '<button class="action-btn" onclick="closeModal()">إغلاق</button>'+
      '<button class="action-btn primary" onclick="window._calcFCR()"><i class="bi bi-calculator"></i> احسب</button>'+
    '</div>'+
  '</div>');
};

window._calcFCR=function(){
  const days=+document.getElementById('fcr-days').value||1;
  const weight=+document.getElementById('fcr-weight').value||0;
  if(!weight){toast('يرجى إدخال الزيادة في الوزن','error');return;}
  const inputs=document.querySelectorAll('.fcr-feed-input');
  let totalPerDay=0;let breakdown='<strong>تفاصيل العلف اليومي:</strong><br>';let hasAny=false;
  inputs.forEach(inp=>{
    const v=+inp.value||0;const label=inp.previousElementSibling?.textContent||'';
    if(v>0){totalPerDay+=v;breakdown+=label+': '+v+' '+inp.dataset.unit+'/يوم<br>';hasAny=true;}
  });
  if(!hasAny){toast('يرجى إدخال كمية علف واحدة على الأقل','error');return;}
  const totalFeed=totalPerDay*days;
  const fcr=(totalFeed/weight).toFixed(2);
  const el=document.getElementById('fcr-result');el.style.display='block';
  document.getElementById('fcr-total-feed').textContent=ar(Math.round(totalFeed));
  document.getElementById('fcr-val').textContent=fcr;
  const rating=fcr<=3?'ممتاز 🟢 — كفاءة عالية جداً':fcr<=5?'جيد 🟡 — كفاءة طبيعية':fcr<=7?'مقبول 🟠 — يمكن التحسين':'ضعيف 🔴 — راجع نوع الغذاء والكميات';
  document.getElementById('fcr-rating').textContent='التقييم: '+rating;
  document.getElementById('fcr-breakdown').innerHTML=breakdown;
};
window.calcFCR=function(){
  const feed=+document.getElementById('fcr-feed').value;const weight=+document.getElementById('fcr-weight').value;
  if(!feed||!weight){toast('يرجى إدخال الكميتين','error');return;}
  const fcr=(feed/weight).toFixed(2);
  const el=document.getElementById('fcr-result');el.style.display='block';
  document.getElementById('fcr-val').textContent=fcr;
  const rating=fcr<=3?'ممتاز 🟢':fcr<=5?'جيد 🟡':fcr<=7?'مقبول 🟠':'ضعيف 🔴';
  document.getElementById('fcr-rating').textContent='التقييم: '+rating;
};

window.openAddInv=function(){
  const s=getSettings();
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const tab=invTab;
  if(tab==='meds'){
    showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-capsule accent-text"></i> إضافة دواء</h4>
    <label>اسم الدواء *</label><input class="field" id="i-name" placeholder="مثال: فيتامين أ + د">
    <div class="row g-2"><div class="col-4"><label>الكمية *</label><input type="number" class="field" id="i-qty" value="0" min="0"></div><div class="col-4"><label>الوحدة</label><input class="field" id="i-unit" value="عبوة" placeholder="عبوة، قرص..."></div><div class="col-4"><label>الحد الأدنى</label><input type="number" class="field" id="i-min" value="0" min="0"></div></div>
    <div class="row g-2"><div class="col-6"><label>تاريخ الانتهاء</label><input type="date" class="field" id="i-exp"></div><div class="col-6"><label>الجمالون</label><select class="field" id="i-barn">${barns.map(b=>`<option value="${b}">${b||'— الكل —'}</option>`).join('')}</select></div></div>
    <label>الغرض</label><input class="field" id="i-purpose" placeholder="تطعيم، علاج، فيتامين...">
    <label>ملاحظات</label><textarea class="field" id="i-notes" rows="2"></textarea>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitInv('meds')">حفظ</button></div></div>`);
  } else if(tab==='feeds'){
    showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-bag-fill accent-text"></i> إضافة علف</h4>
    <label>اسم العلف *</label><input class="field" id="i-name" placeholder="مثال: علف وطنية بروتين 14٪">
    <div class="row g-2"><div class="col-3"><label>الكمية *</label><input type="number" class="field" id="i-qty" value="0" min="0" step="0.5"></div><div class="col-3"><label>الوحدة</label><input class="field" id="i-unit" value="شيكارة" placeholder="كجم، شيكارة..."></div><div class="col-3"><label>وزن الوحدة (كجم)</label><input type="number" class="field" id="i-weight" value="50" min="0"></div><div class="col-3"><label>الحد الأدنى</label><input type="number" class="field" id="i-min" value="0" min="0"></div></div>
    <div class="row g-2"><div class="col-6"><label>التكلفة للوحدة (${s.currency})</label><input type="number" class="field" id="i-cost" value="0" min="0" step="0.5"></div><div class="col-6"><label>الجمالون</label><select class="field" id="i-barn">${barns.map(b=>`<option value="${b}">${b||'— الكل —'}</option>`).join('')}</select></div></div>
    <label>نوع العلف</label><select class="field" id="i-purpose"><option>علف مركز</option><option>برسيم جاف (دريس)</option><option>برسيم أخضر</option><option>عرش فول سوداني</option><option>بونيكام</option><option>قوالب أملاح</option><option>فيتامينات</option><option>خلطة تسمين</option><option>خلطة مرضعات</option><option>أخرى</option></select>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitInv('feeds')">حفظ</button></div></div>`);
  } else {
    showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-tools accent-text"></i> إضافة معدة</h4>
    <label>اسم المعدة *</label><input class="field" id="i-name">
    <div class="row g-2"><div class="col-6"><label>النوع</label><input class="field" id="i-type" placeholder="آلة، مركبة، حظيرة..."></div><div class="col-6"><label>الحالة</label><select class="field" id="i-status"><option value="working">يعمل</option><option value="broken">معطل</option><option value="maintenance">صيانة</option></select></div></div>
    <div class="row g-2"><div class="col-6"><label>موعد الصيانة القادمة</label><input type="date" class="field" id="i-maint"></div><div class="col-6"><label>رقم الأصل</label><input class="field" id="i-asset" placeholder="EQ-001"></div></div>
    <label>ملاحظات</label><textarea class="field" id="i-notes" rows="2"></textarea>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitInv('equip')">حفظ</button></div></div>`);
  }
};

window.openEditInv=function(type,id){
  editInvId=id;
  const list=type==='meds'?meds:type==='feeds'?feeds:equipment;
  const item=list.find(x=>x._id===id);
  if(!item)return;
  invTab=type;openAddInv();
  // Pre-fill after modal opens
  setTimeout(()=>{
    if(document.getElementById('i-name'))document.getElementById('i-name').value=item.name||'';
    if(document.getElementById('i-qty'))document.getElementById('i-qty').value=item.quantity||0;
    if(document.getElementById('i-unit'))document.getElementById('i-unit').value=item.unit||'';
    if(document.getElementById('i-min'))document.getElementById('i-min').value=item.min_quantity||0;
    if(document.getElementById('i-exp'))document.getElementById('i-exp').value=item.expiry||'';
    if(document.getElementById('i-barn'))document.getElementById('i-barn').value=item.barn||'';
    if(document.getElementById('i-purpose'))document.getElementById('i-purpose').value=item.purpose||'';
    if(document.getElementById('i-notes'))document.getElementById('i-notes').value=item.notes||'';
    if(document.getElementById('i-cost'))document.getElementById('i-cost').value=item.cost_per_unit||0;
    if(document.getElementById('i-weight'))document.getElementById('i-weight').value=item.unit_weight||50;
    if(document.getElementById('i-type'))document.getElementById('i-type').value=item.type||'';
    if(document.getElementById('i-status'))document.getElementById('i-status').value=item.status||'working';
    if(document.getElementById('i-maint'))document.getElementById('i-maint').value=item.next_maintenance||'';
    if(document.getElementById('i-asset'))document.getElementById('i-asset').value=item.asset_number||'';
  },100);
};

window.openUseModal=function(type,id,name,current){
  showModal(`<div class="farm-modal narrow" onclick="event.stopPropagation()"><h4><i class="bi bi-dash-circle accent-text"></i> تسجيل استخدام: ${name}</h4>
    <p class="text-gray" style="font-size:.85rem">المتاح: <strong>${current}</strong></p>
    <label>الكمية المستخدمة *</label><input type="number" class="field" id="use-qty" step="0.5" min="0.5" max="${current}" placeholder="الكمية">
    <label>السبب</label><input class="field" id="use-reason" placeholder="علاج، تطعيم، تغذية...">
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn danger" onclick="submitUse('${type}','${id}','${name}',${current})">تسجيل الاستخدام</button></div>
  </div>`);
};
window.submitUse=async function(type,id,name,current){
  const used=+document.getElementById('use-qty').value;
  const reason=document.getElementById('use-reason').value.trim();
  if(!used||used<=0||used>current){toast('كمية غير صحيحة','error');return;}
  const newQty=+(current-used).toFixed(2);
  closeModal();
  try{
    const table=type==='meds'?'inventory_meds':'inventory_feeds';
    await fbPatch(table,id,{quantity:newQty});
    await logActivity('edit','inventory',`استخدام ${used} وحدة من ${name} — المتبقي: ${newQty} ${reason?'| '+reason:''}`);
    toast(`تم تسجيل الاستخدام — المتبقي: ${newQty}`);
    await loadInventory();renderInventoryPage(getSettings());
  }catch(e){toast('فشل: '+e.message,'error');}
};

window.submitInv=async function(type){
  const name=document.getElementById('i-name')?.value.trim();
  if(!name){toast('يرجى إدخال الاسم','error');return;}
  let data={name};
  if(type==='meds'){data={...data,quantity:+document.getElementById('i-qty').value||0,unit:document.getElementById('i-unit').value.trim(),min_quantity:+document.getElementById('i-min').value||0,expiry:document.getElementById('i-exp').value||null,barn:document.getElementById('i-barn').value,purpose:document.getElementById('i-purpose').value.trim(),notes:document.getElementById('i-notes').value.trim()||null};}
  else if(type==='feeds'){data={...data,quantity:+document.getElementById('i-qty').value||0,unit:document.getElementById('i-unit').value.trim(),unit_weight:+document.getElementById('i-weight').value||50,min_quantity:+document.getElementById('i-min').value||0,cost_per_unit:+document.getElementById('i-cost').value||0,barn:document.getElementById('i-barn').value,purpose:document.getElementById('i-purpose').value};}
  else{data={...data,type:document.getElementById('i-type').value.trim(),status:document.getElementById('i-status').value,next_maintenance:document.getElementById('i-maint').value||null,asset_number:document.getElementById('i-asset').value.trim(),notes:document.getElementById('i-notes').value.trim()||null};}
  closeModal();toast('جاري الحفظ...','info');
  const fbTable={meds:'inventory_meds',feeds:'inventory_feeds',equip:'inventory_equipment'}[type];
  try{
    if(editInvId){await fbPatch(fbTable,editInvId,data);await logActivity('edit','inventory','تعديل: '+name);}
    else{await fbPost(fbTable,data);await logActivity('add','inventory','إضافة: '+name);}
    editInvId=null;toast('تمت الإضافة');await loadInventory();renderInventoryPage(getSettings());
  }catch(e){toast('خطأ: '+e.message,'error');}
};

window.delInv=async function(type,id){
  if(!confirm('حذف هذا العنصر؟'))return;
  const fbTable={meds:'inventory_meds',feeds:'inventory_feeds',equip:'inventory_equipment'}[type];
  try{await fbDelete(fbTable,id);await logActivity('delete','inventory','حذف من المخزن');toast('تم الحذف');await loadInventory();renderInventoryPage(getSettings());}
  catch(e){toast('فشل: '+e.message,'error');}
};

window.exportInvCSV=function(){
  const list=invTab==='meds'?meds:invTab==='feeds'?feeds:equipment;
  const s=getSettings();
  const rows=invTab==='meds'?[['الدواء','الكمية','الوحدة','الحد الأدنى','الانتهاء','الغرض','الجمالون'],...list.map(m=>[m.name,m.quantity,m.unit||'',m.min_quantity||0,m.expiry||'',m.purpose||'',m.barn||''])]:invTab==='feeds'?[['العلف','الكمية','الوحدة','الحد الأدنى','التكلفة/وحدة','الجمالون'],...list.map(f=>[f.name,f.quantity,f.unit||'',f.min_quantity||0,f.cost_per_unit||0,f.barn||''])]:
  [['المعدة','النوع','الحالة','الصيانة','رقم الأصل'],...list.map(e=>[e.name,e.type||'',e.status||'',e.next_maintenance||'',e.asset_number||''])];
  const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`inventory-${invTab}-${todayStr()}.csv`;a.click();
  toast('تم التصدير');
};

// ══════════════════════════════════════════
//  FEED INTAKE PER BARN (استهلاك الأعلاف)
// ══════════════════════════════════════════
var _consumption = [];

function renderConsumptionTab() {
  return `
  <div class="wonder-card mb-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h6 class="fw-bold mb-0"><i class="bi bi-bar-chart-fill accent-text me-2"></i>تسجيل استهلاك الأعلاف اليومي</h6>
      <button class="action-btn primary" onclick="openLogConsumption()">
        <i class="bi bi-plus-lg"></i> تسجيل استهلاك
      </button>
    </div>
    <p class="text-gray mb-3" style="font-size:.82rem">سجّل كمية العلف المستهلكة يومياً لكل جمالون — يساعد في حساب تكلفة التغذية ومعدل الاستهلاك</p>
    <div id="consumption-records"><div class="text-center py-3"><div class="spinner"></div></div></div>
  </div>`;
}

window.loadConsumptionRecords = async function() {
  var el = document.getElementById('consumption-records');
  if (!el) return;
  try {
    _consumption = await fbGet('feed_consumption');
    _consumption.sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
    if (!_consumption.length) {
      el.innerHTML = '<div class="empty-state" style="padding:20px 0"><i class="bi bi-bar-chart" style="font-size:1.5rem;opacity:.3;display:block;margin-bottom:8px"></i><p style="font-size:.82rem">لا توجد سجلات استهلاك بعد<br>اضغط "تسجيل استهلاك" للبدء</p></div>';
      return;
    }

    // Summary by barn (last 7 days)
    var d7ago = new Date(); d7ago.setDate(d7ago.getDate()-7);
    var recent = _consumption.filter(function(r){ return r.date >= d7ago.toISOString().slice(0,10); });
    var barnTotals = {};
    recent.forEach(function(r){
      if(!barnTotals[r.barn]) barnTotals[r.barn] = 0;
      barnTotals[r.barn] += +r.quantity_kg||0;
    });

    var summaryHTML = Object.keys(barnTotals).length ?
      '<div class="mb-3"><h6 class="text-gray mb-2" style="font-size:.78rem">ملخص آخر 7 أيام:</h6>'+
      '<div class="d-flex flex-wrap gap-2">' +
      Object.keys(barnTotals).map(function(barn){
        return '<span class="type-badge badge-gray"><i class="bi bi-building me-1"></i>'+barn+': <strong>'+barnTotals[barn].toFixed(1)+'</strong> كجم</span>';
      }).join('') +
      '</div></div>' : '';

    el.innerHTML = summaryHTML +
      '<div class="table-responsive"><table class="tbl" style="font-size:.8rem">'+
        '<thead><tr><th>التاريخ</th><th>الجمالون</th><th>نوع العلف</th><th>الكمية (كجم)</th><th>مسجّل بواسطة</th><th>ملاحظات</th><th></th></tr></thead>'+
        '<tbody>'+
        _consumption.slice(0,30).map(function(r){
          return '<tr>'+
            '<td class="text-gray">'+( r.date||'—')+'</td>'+
            '<td><span class="type-badge badge-gray">'+( r.barn||'—')+'</span></td>'+
            '<td class="fw-bold">'+( r.feed_name||'—')+'</td>'+
            '<td class="fw-bold green-text">'+ar(+(+r.quantity_kg||0).toFixed(1))+' كجم</td>'+
            '<td class="text-gray">'+( r.recorded_by||'—')+'</td>'+
            '<td class="text-gray" style="font-size:.75rem">'+( r.notes||'')+'</td>'+
            '<td><button class="action-btn sm danger" onclick="delConsumption(\'' + r._id + '\')"><i class="bi bi-trash"></i></button></td>'+
          '</tr>';
        }).join('')+
        '</tbody></table></div>';
  } catch(e) {
    el.innerHTML = '<div class="red-text">خطأ في تحميل البيانات: '+e.message+'</div>';
  }
};

// Auto-load when consumption tab is active
var _oldRenderInventoryPage = renderInventoryPage;

// Hook into tab switch
var _origRender = window.renderInventoryPage;
setTimeout(function(){
  var orig = window.renderInventoryPage;
  if(orig) {
    window.renderInventoryPage = function(s) {
      orig(s);
      if(invTab === 'consumption') {
        setTimeout(function(){ window.loadConsumptionRecords && window.loadConsumptionRecords(); }, 100);
      }
    };
  }
}, 500);

window.openLogConsumption = function() {
  var s = getSettings();
  var barnNames = ['ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  var feedNames = feeds.map(function(f){return f.name;});
  var user = getUser();

  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:480px">'+
    '<h4><i class="bi bi-bar-chart-fill accent-text me-2"></i>تسجيل استهلاك الأعلاف</h4>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>التاريخ *</label><input type="date" class="field" id="fc-date" value="'+todayStr()+'"></div>'+
      '<div class="col-6"><label>الجمالون / العنبر *</label>'+
        '<select class="field" id="fc-barn">'+
          barnNames.map(function(b){return '<option value="'+b+'">'+b+'</option>';}).join('')+
        '</select>'+
      '</div>'+
    '</div>'+
    '<label>نوع العلف *</label>'+
    '<select class="field" id="fc-feed">'+
      (feedNames.length
        ? feedNames.map(function(f){return '<option>'+f+'</option>';}).join('')
        : '<option value="">أضف أعلافاً في تبويب الأعلاف أولاً</option>')+
    '</select>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>الكمية (كجم) *</label><input type="number" class="field" id="fc-qty" step="0.5" min="0" placeholder="50"></div>'+
      '<div class="col-6"><label>مسجّل بواسطة</label><input class="field" id="fc-by" value="'+(user?.name||'')+'"></div>'+
    '</div>'+
    '<label>ملاحظات</label><input class="field" id="fc-notes" placeholder="اختياري">'+
    '<div class="d-flex gap-2 justify-content-end mt-3">'+
      '<button class="action-btn" onclick="closeModal()">إلغاء</button>'+
      '<button class="action-btn primary" onclick="logConsumption()"><i class="bi bi-check-lg"></i> حفظ</button>'+
    '</div>'+
  '</div>');
};

window.logConsumption = async function() {
  var date      = document.getElementById('fc-date').value;
  var barn      = document.getElementById('fc-barn').value;
  var feed_name = document.getElementById('fc-feed').value;
  var qty       = parseFloat(document.getElementById('fc-qty').value);
  var by        = document.getElementById('fc-by').value.trim();
  var notes     = document.getElementById('fc-notes').value.trim();

  if (!date || !barn || !feed_name || isNaN(qty) || qty <= 0) {
    toast('يرجى تعبئة جميع الحقول الإلزامية','error'); return;
  }

  closeModal();
  try {
    await fbPost('feed_consumption', {
      date: date, barn: barn, feed_name: feed_name,
      quantity_kg: qty, recorded_by: by||null, notes: notes||null,
      created_at: new Date().toISOString(),
    });
    await logActivity('add','feed_consumption','تسجيل استهلاك: '+feed_name+' — '+barn+' — '+qty+'كجم');
    toast('✅ تم تسجيل استهلاك '+ar(qty)+' كجم من '+feed_name);
    setTimeout(function(){ loadConsumptionRecords(); }, 500);
  } catch(e) {
    toast('خطأ: '+e.message,'error');
  }
};

window.delConsumption = async function(id) {
  if (!id || !confirm('حذف هذا السجل؟')) return;
  try {
    await fbDelete('feed_consumption', id);
    toast('تم الحذف');
    loadConsumptionRecords();
  } catch(e) { toast('خطأ في الحذف','error'); }
};
