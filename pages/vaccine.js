'use strict';
document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  initFirebase();
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('vaccine.html');
  renderPageHeader('<i class="bi bi-bandaid-fill accent-text"></i> التحصين','','');
  const el=document.getElementById('content');
  renderLoading(el);
  try{
    await load_vaccine(el, s);
  }catch(e){
    toast('خطأ في التحميل: '+e.message,'error');
    el.innerHTML=`<div class="empty-state"><i class="bi bi-bandaid-fill"></i><p>${e.message}</p></div>`;
  }
});

async function load_vaccine(el, s){
  el.innerHTML=`<div class="wonder-card text-center py-4">
    <i class="bi bi-bandaid-fill accent-text d-block mb-3" style="font-size:2.5rem"></i>
    <h5 class="fw-bold">التحصين</h5>
    <p class="text-gray">هذه الصفحة قيد التطوير</p>
    <a href="dashboard.html" class="action-btn primary mt-2">الرئيسية</a>
  </div>`;
}
