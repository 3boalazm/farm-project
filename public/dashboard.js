function openSidebar(){
  document.getElementById('sidebarOverlay').classList.add('active');
  document.getElementById('sidebarMenu').classList.add('active');
  document.body.style.overflow='hidden';
}
function closeSidebar(){
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.getElementById('sidebarMenu').classList.remove('active');
  document.body.style.overflow='';
}
function switchTab(name){
  document.querySelectorAll('.sidebar-item').forEach(i=>i.classList.remove('active'));
  const link=document.querySelector(`.sidebar-item[onclick*="switchTab('${name}')"]`);
  if(link) link.classList.add('active');
  const map={dash:'dash-tab',goats:'goats-tab',sheep:'sheep-tab',vaccine:'vaccine-tab',data:'data-tab'};
  const el=document.getElementById(map[name]);
  if(el && window.bootstrap){ new bootstrap.Tab(el).show(); }
  if(window.innerWidth<992) closeSidebar();
}
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.animate-in').forEach((el,i)=>{
    el.style.opacity='0';
    setTimeout(()=>{el.style.animation='fadeInUp .6s ease forwards';el.style.opacity='1';},i*80);
  });
});
