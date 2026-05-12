'use strict';
document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  initFirebase();
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('farm-profile.html');
  renderPageHeader('<i class="bi bi-building accent-text"></i> ملف المزرعة','','');
  const el=document.getElementById('content');
  renderLoading(el);
  try{
    await load_farm_profile(el, s);
  }catch(e){
    toast('خطأ في التحميل: '+e.message,'error');
    el.innerHTML=`<div class="empty-state"><i class="bi bi-building"></i><p>${e.message}</p></div>`;
  }
});

async function load_farm_profile(el, s){
  el.innerHTML=`<div class="wonder-card text-center py-4">
    <i class="bi bi-building accent-text d-block mb-3" style="font-size:2.5rem"></i>
    <h5 class="fw-bold">ملف المزرعة</h5>
    <p class="text-gray">هذه الصفحة قيد التطوير</p>
    <a href="dashboard.html" class="action-btn primary mt-2">الرئيسية</a>
  </div>`;
}
