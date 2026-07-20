'use strict';
document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbarV2('farm-profile.html');
  const [animals,users]=await Promise.all([fbGet('animals'),fbGet('users')]);
  renderFarmProfile(s,animals,users);
});

function renderFarmProfile(s,animals,users){
  const alive=animals.filter(a=>a.status==='alive');
  const dead=animals.filter(a=>window.isRealDeath(a));

  renderPageHeaderV2({
    title: '<i class="bi bi-building accent-text"></i> ملف المزرعة',
    description: s.farmAddress||'',
    breadcrumb: [{label:'الرئيسية', href:'dashboard.html'}, {label:'ملف المزرعة'}],
    primaryAction: can('admin')?`<button class="action-btn primary" onclick="openEditProfile()"><i class="bi bi-pencil-fill"></i> تعديل</button>`:''
  });
  const el=document.getElementById('content');

  el.innerHTML=`
  <!-- Header card -->
  <div class="profile-header mb-4">
    <div class="d-flex align-items-start gap-4 flex-wrap">
      <div style="width:90px;height:90px;border-radius:20px;background:linear-gradient(135deg,var(--orange),#ff8a65);display:flex;align-items:center;justify-content:center;font-size:2.8rem;overflow:hidden;flex-shrink:0">
        ${s.logoUrl?`<img src="${s.logoUrl}" style="width:100%;height:100%;object-fit:cover">`:'🐐'}
      </div>
      <div class="flex-grow-1">
        <h2 class="fw-bold mb-1">${s.farmName}</h2>
        <div class="d-flex gap-3 flex-wrap text-gray" style="font-size:.85rem">
          ${s.farmAddress?`<span><i class="bi bi-geo-alt-fill accent-text me-1"></i>${s.farmAddress}</span>`:''}
          <span><i class="bi bi-cash accent-text me-1"></i>العملة: ${s.currency}</span>
          <span><i class="bi bi-people-fill accent-text me-1"></i>${ar(users.length)} مستخدم</span>
        </div>
        ${s.farmLat&&s.farmLng?`<div class="mt-2"><a href="https://www.google.com/maps?q=${s.farmLat},${s.farmLng}" target="_blank" class="action-btn sm"><i class="bi bi-map"></i> عرض على الخريطة</a></div>`:''}
      </div>
    </div>
  </div>

  <div class="row g-3 mb-4">
    <!-- Farm info -->
    <div class="col-md-4">
      <div class="wonder-card">
        <div class="section-title mb-3"><i class="bi bi-building accent-text"></i> بيانات المزرعة</div>
        ${[['الاسم',s.farmName],['المالك/المدير',s.ownerName],['العنوان',s.farmAddress||'—'],['العملة',s.currency],['أيام الحمل',ar(s.pregnancyDays)+' يوم'],['تنبيه التحصين قبل',ar(s.vaccinationAlertDays)+' يوم'],['أيام الفطام',ar(s.weaningDays)+' يوم']].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold">${v}</span></div>`).join('')}
      </div>
    </div>
    <!-- Stats -->
    <div class="col-md-4">
      <div class="wonder-card">
        <div class="section-title mb-3"><i class="bi bi-bar-chart-fill accent-text"></i> إحصائيات القطيع</div>
        ${[['إجمالي الحيوانات',ar(animals.length)],['الحيوانات الحية',ar(alive.length)],['النافق',ar(dead.length)],['المواليد',ar(alive.filter(a=>a.purpose==='birth').length)],['سلالات الماعز',ar(s.goatBreeds.length)],['سلالات الأغنام',ar(s.sheepBreeds.length)]].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold green-text">${v}</span></div>`).join('')}
      </div>
    </div>
    <!-- Users -->
    <div class="col-md-4">
      <div class="wonder-card">
        <div class="section-title mb-3"><i class="bi bi-people-fill accent-text"></i> المستخدمون (${ar(users.length)})</div>
        ${users.slice(0,5).map(u=>`<div class="d-flex align-items-center gap-2 py-2" style="border-bottom:1px solid #1e1e1e">
          <div class="user-avatar" style="width:32px;height:32px;font-size:.8rem;background:${ROLES[u.role]?.color||'var(--gray)'}22;color:${ROLES[u.role]?.color||'var(--gray)'}">${(u.name||'?').slice(0,1)}</div>
          <div><div style="font-size:.85rem;font-weight:600">${u.name||'—'}</div><small class="text-gray">${ROLES[u.role]?.label||u.role}</small></div>
          <span class="ms-auto type-badge ${u.active!==false?'badge-tarbiya':'badge-danger'}" style="font-size:.65rem">${u.active!==false?'نشط':'غير نشط'}</span>
        </div>`).join('')}
      </div>
    </div>
  </div>

  <!-- Barn layout -->
  <div class="wonder-card">
    <div class="section-title mb-3"><i class="bi bi-grid-3x3-gap-fill accent-text"></i> هيكل المزرعة — الجمالونات والعنابر</div>
    <div class="row g-2">
      ${[1,2,3,4,5].map(g=>{
        const barnCounts=[1,2].map(e=>{const code=`ج${g}ع${e}`;return{code,count:alive.filter(a=>a.barn===code).length};});
        return`<div class="col-md-2 col-6">
          <div class="wonder-card text-center" style="border-color:rgba(255,107,53,.3)">
            <div class="fw-bold accent-text mb-2">جمالون ${ar(g)}</div>
            ${barnCounts.map(b=>`<div class="mb-1 p-2" style="background:rgba(255,255,255,.04);border-radius:8px;border:1px solid #2a2a2a">
              <div style="font-size:.72rem;color:var(--gray)">${b.code}</div>
              <div class="fw-bold green-text" style="font-size:1.2rem">${ar(b.count)}</div>
              <div style="font-size:.65rem;color:var(--gray)">رأس</div>
            </div>`).join('')}
            <div class="mt-1 text-gray" style="font-size:.75rem">الإجمالي: ${ar(barnCounts.reduce((t,b)=>t+b.count,0))}</div>
          </div>
        </div>`;
      }).join('')}
      <div class="col-md-2 col-6">
        <div class="wonder-card text-center" style="border-color:rgba(0,230,118,.3)">
          <div class="fw-bold green-text mb-2">إجمالي المزرعة</div>
          <div class="summary-number green-text mb-1">${ar(alive.length)}</div>
          <div style="font-size:.75rem;color:var(--gray)">رأس حي</div>
          <div class="mt-2" style="font-size:.75rem;color:var(--gray)">في العنابر: ${ar(alive.filter(a=>a.barn).length)}</div>
          <div style="font-size:.75rem;color:var(--gray)">غير محدد: ${ar(alive.filter(a=>!a.barn).length)}</div>
        </div>
      </div>
    </div>
  </div>`;
}

window.openEditProfile=function(){
  const s=getSettings();
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-height:92vh;overflow-y:auto">
    <h4><i class="bi bi-pencil-fill accent-text"></i> تعديل ملف المزرعة</h4>
    <label>اسم المزرعة</label><input class="field" id="fp-name" value="${s.farmName}">
    <label>اسم المالك/المدير</label><input class="field" id="fp-owner" value="${s.ownerName}">
    <label>العنوان</label><input class="field" id="fp-address" value="${s.farmAddress||''}" placeholder="العامرية، الإسكندرية">
    <label>رابط شعار المزرعة (URL)</label><input class="field" id="fp-logo" value="${s.logoUrl||''}" placeholder="https://..." dir="ltr">
    <div class="row g-2">
      <div class="col-6"><label>خط العرض (Latitude)</label><input class="field" id="fp-lat" value="${s.farmLat||''}" placeholder="30.9500" dir="ltr"></div>
      <div class="col-6"><label>خط الطول (Longitude)</label><input class="field" id="fp-lng" value="${s.farmLng||''}" placeholder="29.7972" dir="ltr"></div>
    </div>
    <small class="text-gray d-block mb-2">الموقع الحالي: المزرعة النموذجية بالعامرية 30°57'00.2"N 29°47'50"E</small>
    <button class="action-btn sm mb-3" onclick="useDefaultLocation()"><i class="bi bi-geo-alt-fill"></i> استخدام موقع المزرعة الافتراضي</button>
    <label>العملة</label><select class="field" id="fp-cur">${['ج.م','ر.س','د.إ','د.ك','د.ا'].map(c=>`<option value="${c}" ${s.currency===c?'selected':''}>${c}</option>`).join('')}</select>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="saveProfile()">حفظ</button>
    </div>
  </div>`);
};

window.useDefaultLocation=function(){
  document.getElementById('fp-lat').value='30.9500';
  document.getElementById('fp-lng').value='29.7972';
  document.getElementById('fp-address').value='المزرعة النموذجية بالعامرية، الإسكندرية';
};

window.saveProfile=async function(){
  const s=getSettings();
  s.farmName=document.getElementById('fp-name').value.trim()||s.farmName;
  s.ownerName=document.getElementById('fp-owner').value.trim()||s.ownerName;
  s.farmAddress=document.getElementById('fp-address').value.trim();
  s.logoUrl=document.getElementById('fp-logo').value.trim();
  s.farmLat=document.getElementById('fp-lat').value.trim();
  s.farmLng=document.getElementById('fp-lng').value.trim();
  s.currency=document.getElementById('fp-cur').value;
  saveSettings(s);
  await logActivity('edit','settings','تعديل ملف المزرعة');
  toast('تم حفظ ملف المزرعة');closeModal();location.reload();
};
