'use strict';
// ── TOAST ─────────────────────────────────────────────────
function toast(msg,type='success'){
  let wrap=document.getElementById('toast-wrap');
  if(!wrap){wrap=document.createElement('div');wrap.id='toast-wrap';document.body.appendChild(wrap);}
  const el=document.createElement('div');
  el.className=`farm-toast t-${type}`;
  el.innerHTML=`<i class="bi bi-${type==='success'?'check-circle-fill':type==='error'?'x-circle-fill':'info-circle-fill'}"></i> ${msg}`;
  wrap.appendChild(el);
  setTimeout(()=>{el.style.opacity='0';},2700);
  setTimeout(()=>{el.remove();},3200);
}

// ── MODAL ─────────────────────────────────────────────────
function showModal(html){
  let root=document.getElementById('modal-root');
  if(!root){root=document.createElement('div');root.id='modal-root';document.body.appendChild(root);}
  root.innerHTML=`<div class="farm-modal-backdrop" onclick="if(event.target===this)closeModal()">${html}</div>`;
}
function closeModal(){const r=document.getElementById('modal-root');if(r)r.innerHTML='';}

// ── ARABIC UTILS ──────────────────────────────────────────
const pad2=n=>ar(String(n).padStart(2,'0').replace(/0/g,'٠'));
function todayAr(){const d=new Date();return`${ar(d.getFullYear())}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`;}
function timeAr(iso){
  if(!iso)return'—';
  const d=new Date(iso);
  return `${ar(d.getFullYear())}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// ── NAVBAR ────────────────────────────────────────────────
// NAV_PAGES & SIDEBAR_EXTRA defined in nav.js (loaded before shared.js)

function renderNavbar(activePage=''){
  const s=getSettings();const u=getUser();
  const visibleTabs=NAV_PAGES.filter(p=>!p.perm||can(p.perm)).slice(0,7);
  const html=`
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
  <aside class="sidebar-menu" id="sidebarMenu">
    <div class="sidebar-header">
      <div class="d-flex align-items-center gap-2">
        <div class="farm-logo-sm">${s.logoUrl?`<img src="${s.logoUrl}" alt="">`:'🐐'}</div>
        <div><div class="fw-bold" style="font-size:1rem">${s.farmName}</div>
        <small style="color:${ROLES[u?.role||'admin']?.color}">${ROLES[u?.role||'admin']?.label}</small></div>
      </div>
      <button class="sidebar-close" onclick="closeSidebar()"><i class="bi bi-x-lg"></i></button>
    </div>
    <nav class="sidebar-nav">
      <div class="sidebar-section-label">التنقل</div>
      ${NAV_PAGES.filter(p=>!p.perm||can(p.perm)).map(p=>`
        <a href="${p.href}" class="sidebar-item${activePage===p.href?' active':''}">
          <i class="bi ${p.icon}"></i> ${p.label}</a>`).join('')}
      <div class="sidebar-divider"></div>
      ${SIDEBAR_EXTRA.filter(p=>!p.perm||can(p.perm)).map(p=>`
        <a href="${p.href}" class="sidebar-item${activePage===p.href?' active':''}" ${p.onclick?'onclick="closeSidebar();'+p.onclick+';return false;"':''}>
          <i class="bi ${p.icon}"></i> ${p.label}</a>`).join('')}
      <div class="sidebar-divider"></div>
      <button class="sidebar-item" onclick="logout()" style="color:var(--red)">
        <i class="bi bi-box-arrow-left"></i> تسجيل الخروج</button>
    </nav>
    <div class="sidebar-footer">
      <div class="d-flex align-items-center gap-3">
        <div class="user-avatar">${(u?.name||'م').slice(0,1)}</div>
        <div><div class="fw-bold">${u?.name||'مدير'}</div>
        <small class="green-text"><i class="bi bi-circle-fill" style="font-size:7px"></i> متصل</small></div>
      </div>
    </div>
  </aside>
  <nav class="navbar-wonder">
    <div class="container d-flex justify-content-between align-items-center">
      <a href="dashboard.html" class="navbar-brand"><span>🐐</span> ${s.farmName}</a>
      <div class="d-flex align-items-center gap-2">
        <span class="date-badge d-none d-sm-flex"><i class="bi bi-calendar3"></i> ${todayAr()}</span>
        <button class="theme-btn d-none d-md-flex" onclick="toggleTheme()" id="theme-toggle-btn" title="تبديل المظهر">
          <i class="bi bi-circle-half" id="theme-icon"></i>
        </button>
        <div style="position:relative">
          <a href="notifications.html" class="bell-btn" id="bell-btn" style="text-decoration:none" title="الإشعارات">
            <i class="bi bi-bell-fill"></i><span class="bell-badge" id="bell-badge" style="display:none">0</span>
          </a>
        </div>
        <button id="undo-btn" onclick="undoLast()" title="تراجع عن آخر عملية" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:20px;color:var(--text-muted);padding:5px 12px;cursor:pointer;font-size:.8rem;display:flex;align-items:center;gap:5px;font-family:Cairo,sans-serif;transition:.2s;white-space:nowrap;opacity:0.5" id="undo-btn">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
        <button class="menu-btn" onclick="openSidebar()"><i class="bi bi-list"></i></button>
      </div>
    </div>
  </nav>
  <div id="toast-wrap"></div>
  <div id="modal-root"></div>`;
  document.body.insertAdjacentHTML('afterbegin', html);
}

// ── Theme Toggle ────────────────────────────────────────
// ── Lightweight notification badge ─────────────────────
// Uses cached data - no extra Firebase call on page load
async function _updateBadge(){
  try{
    if(!getUser()||!initFirebase())return;
    const u=getUser();
    const notifs=await fbGet('notifications');
    const unread=notifs.filter(function(n){return !n.read&&(!n.for_role||n.for_role===u.role||u.role==='admin');}).length;
    const b=document.getElementById('bell-badge');
    if(b){
      if(unread>0){b.style.display='flex';b.textContent=unread>9?'9+':unread;}
      else b.style.display='none';
    }
  }catch(e){}
}

function initTheme(){
  const saved=localStorage.getItem('farm_theme')||'dark';
  if(saved==='light'){
    document.body.classList.add('light-mode');
    document.documentElement.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
    document.documentElement.classList.remove('light-mode');
  }
  updateThemeIcon();
}
function toggleTheme(){
  const isLight=document.body.classList.toggle('light-mode');
  document.documentElement.classList.toggle('light-mode', isLight);
  localStorage.setItem('farm_theme', isLight?'light':'dark');
  updateThemeIcon();
}
function updateThemeIcon(){
  const ic=document.getElementById('theme-icon');
  if(!ic)return;
  const isLight=document.body.classList.contains('light-mode');
  ic.className='bi bi-'+(isLight?'sun-fill':'moon-fill');
}

// ── Notifications Dropdown (bell icon) ──────────────────
let _notifOpen=false;
function toggleNotifDropdown(e){
  e.stopPropagation();
  const dd=document.getElementById('notif-dropdown');
  if(!dd)return;
  _notifOpen=!_notifOpen;
  if(_notifOpen){
    dd.style.display='block';
    loadNotifDropdown();
  }else{dd.style.display='none';}
}
document.addEventListener('click',()=>{
  if(!_notifOpen)return;
  const dd=document.getElementById('notif-dropdown');
  if(dd)dd.style.display='none';
  _notifOpen=false;
});
async function loadNotifDropdown(){
  const dd=document.getElementById('notif-dropdown');
  if(!dd)return;
  dd.innerHTML='<div class="notif-dropdown-header"><span class="fw-bold"><i class="bi bi-bell-fill accent-text me-2"></i>الإشعارات</span><a href="notifications.html" style="font-size:.78rem;color:var(--gray)">عرض الكل</a></div><div class="notif-dropdown-body"><div class="text-center py-3"><div class="spinner" style="width:22px;height:22px;border-width:2px"></div></div></div>';
  try{
    const t=new Date();const today=t.toISOString().slice(0,10);
    const [vaccines,breeding,health,meds,feeds,loginN]=await Promise.all([
      fbGet('vaccinations'),fbGet('breeding'),fbGet('health'),
      fbGet('inventory_meds'),fbGet('inventory_feeds'),
      getUser()?.role==='admin'?fbGet('login_notifications'):Promise.resolve([])
    ]);
    const notifs=[];
    // Login notifications
    loginN.filter(n=>n.date===today).slice(0,3).forEach(n=>{notifs.push({type:'info',icon:'bi-box-arrow-in-right',title:'دخل: '+n.userName,msg:n.roleLabel,href:'activity.html'});});
    // Upcoming births
    breeding.filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{
      const d=Math.ceil((new Date(r.expected_birth)-t)/86400000);
      if(d>=0&&d<=7)notifs.push({type:d<=2?'danger':'warning',icon:'bi-stars',title:'ولادة متوقعة',msg:(r.female_tag||r.female_breed)+' — بعد '+ar(d)+' يوم',href:'breeding.html'});
    });
    // Overdue vaccines
    vaccines.filter(v=>v.status==='overdue').slice(0,2).forEach(v=>{notifs.push({type:'danger',icon:'bi-bandaid-fill',title:'تحصين متأخر: '+v.name,msg:v.target_section||'—',href:'vaccine.html'});});
    // Withdrawal
    health.filter(r=>r.status==='active'&&r.treatment_effect_end&&r.treatment_effect_end>=today).slice(0,2).forEach(r=>{notifs.push({type:'danger',icon:'bi-exclamation-triangle-fill',title:'تأثير علاج نشط',msg:(r.animal_tag||r.animal_breed)+'حتى '+r.treatment_effect_end,href:'health.html'});});
    // Low stock
    meds.filter(m=>+m.quantity<=+m.min_quantity&&+m.min_quantity>0).slice(0,2).forEach(m=>{notifs.push({type:'warning',icon:'bi-capsule',title:'مخزون منخفض: '+m.name,msg:'متبقي '+m.quantity,href:'inventory.html'});});
    feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0).slice(0,2).forEach(f=>{notifs.push({type:'warning',icon:'bi-bag-fill',title:'علف منخفض: '+f.name,msg:'متبقي '+f.quantity+' '+f.unit,href:'inventory.html'});});

    const catC={danger:'var(--red)',warning:'var(--orange)',info:'var(--blue)',success:'var(--green)'};
    const body=dd.querySelector('.notif-dropdown-body');
    if(body){
      body.innerHTML=notifs.length===0?'<div class="text-center py-4 text-gray" style="font-size:.85rem"><i class="bi bi-check-circle-fill green-text d-block mb-2" style="font-size:1.5rem"></i>لا توجد تنبيهات 🎉</div>':
        notifs.slice(0,8).map(n=>'<div class="notif-item-sm n-'+n.type+'"'+(n.href?' onclick="window.location.href=\''+(n.href||'#')+'\'">':'>') +
          '<div style="width:28px;height:28px;border-radius:50%;background:'+catC[n.type]+'22;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="bi '+n.icon+'" style="font-size:.8rem;color:'+catC[n.type]+'"></i></div>'+
          '<div><div style="font-size:.82rem;font-weight:700">'+n.title+'</div><div style="font-size:.75rem;color:var(--gray)">'+n.msg+'</div></div>'+
        '</div>').join('');
      // Update badge
      const cnt=notifs.filter(n=>n.type==='danger').length;
      const b=document.getElementById('bell-badge');
      if(b){if(cnt>0){b.style.display='flex';b.textContent=cnt>9?'9+':cnt;}else b.style.display='none';}
    }
  }catch(e){console.error('notif dropdown:',e);}
}

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

// ── PAGE HEADER ───────────────────────────────────────────
function renderPageHeader(title, subtitle='', actions=''){
  const el=document.getElementById('page-header');
  if(!el)return;
  el.innerHTML=`
  <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
    <div>
      <h4 class="fw-bold mb-0">${title}</h4>
      ${subtitle?`<small class="text-gray">${subtitle}</small>`:''}
    </div>
    <div class="d-flex gap-2 flex-wrap">${actions}</div>
  </div>`;
}

// ── LOADING / EMPTY ───────────────────────────────────────
function renderLoading(el){
  el.innerHTML=`<div class="text-center py-5"><div class="spinner mb-3"></div><div class="text-gray">جاري التحميل...</div></div>`;
}
function renderEmpty(el, icon, msg, btnHtml=''){
  el.innerHTML=`<div class="empty-state"><i class="bi ${icon}"></i><p>${msg}</p>${btnHtml}</div>`;
}

// ── BREED STATS ───────────────────────────────────────────
function breedStats(animals, species, breed){
  // Filter by BOTH species AND breed so goat/sheep stats never cross.
  // Previously species was missing → بلدي (and any shared breed) showed identical
  // numbers on goats.html and sheep.html — this fixes that root cause.
  const all=animals.filter(a=>a.status==='alive'&&a.species===species&&a.breed===breed);
  const alive=all.filter(a=>a.purpose!=='birth');
  const births=all.filter(a=>a.purpose==='birth');
  const c=(g,p)=>alive.filter(a=>a.gender===g&&a.purpose===p).length;
  const mT=c('male','tarbiya'),fT=c('female','tarbiya'),mS=c('male','tasmeen'),fS=c('female','tasmeen');
  const bM=births.filter(a=>a.gender==='male').length;
  const bF=births.filter(a=>a.gender==='female').length;
  return{
    total:alive.length,
    totalAll:all.length,
    birthCount:births.length,
    birthMale:bM,
    birthFemale:bF,
    tarbiyaMale:mT,tarbiyaFemale:fT,
    tasmeenMale:mS,tasmeenFemale:fS,
    tarbiya:mT+fT,tasmeen:mS+fS
  };
}

// ── PAGE TEMPLATE ─────────────────────────────────────────
// كل HTML صفحة تستدعي initPage() في أول السكريبت
async function initPage(pageFile, permCheck=''){
  if(!requireAuth())return false;
  if(permCheck&&!can(permCheck)){
    document.getElementById('content').innerHTML=`
    <div class="empty-state"><i class="bi bi-shield-x"></i><p>غير مصرح بالوصول</p>
    <a href="dashboard.html" class="action-btn">الرئيسية</a></div>`;
    return false;
  }
  if(!initFirebase()){
    document.getElementById('content').innerHTML=`
    <div class="empty-state"><i class="bi bi-cloud-slash"></i><p>يرجى إعداد Firebase في ملف config.js</p>
    <a href="settings.html" class="action-btn primary">الإعدادات</a></div>`;
    return false;
  }
  return true;
}

// Cross-page contextual links
function renderRelatedLinks(current){
  const links={
    'animals.html':     [{href:'goats.html',icon:'bi-tropical-storm',l:'الماعز',c:'var(--green)'},{href:'sheep.html',icon:'bi-cloud-fill',l:'الأغنام',c:'var(--blue)'},{href:'barns.html',icon:'bi-grid-3x3-gap-fill',l:'الجمالونات',c:'var(--orange)'},{href:'breeding.html',icon:'bi-diagram-2-fill',l:'التكاثر',c:'var(--purple)'}],
    'vaccine.html':     [{href:'health.html',icon:'bi-heart-pulse-fill',l:'السجل الصحي',c:'var(--red)'},{href:'notifications.html',icon:'bi-bell-fill',l:'الإشعارات',c:'var(--orange)'}],
    'health.html':      [{href:'vaccine.html',icon:'bi-bandaid-fill',l:'التحصين',c:'var(--green)'},{href:'inventory.html',icon:'bi-capsule',l:'الصيدلية',c:'var(--yellow)'},{href:'breeding.html',icon:'bi-diagram-2-fill',l:'التكاثر',c:'var(--purple)'}],
    'breeding.html':    [{href:'animals.html',icon:'bi-list-ul',l:'القطيع',c:'var(--green)'},{href:'health.html',icon:'bi-heart-pulse-fill',l:'الصحة',c:'var(--red)'}],
    'inventory.html':   [{href:'health.html',icon:'bi-heart-pulse-fill',l:'السجل الصحي',c:'var(--red)'},{href:'finance.html',icon:'bi-wallet2',l:'المالية',c:'var(--orange)'}],
    'finance.html':     [{href:'reports.html',icon:'bi-graph-up',l:'التقارير',c:'var(--blue)'},{href:'inventory.html',icon:'bi-boxes',l:'المخزن',c:'var(--orange)'}],
    'barns.html':       [{href:'animals.html',icon:'bi-list-ul',l:'القطيع',c:'var(--green)'},{href:'reports.html',icon:'bi-graph-up',l:'التقارير',c:'var(--blue)'}],
    'goats.html':       [{href:'sheep.html',icon:'bi-cloud-fill',l:'الأغنام',c:'var(--blue)'},{href:'breeding.html',icon:'bi-diagram-2-fill',l:'التكاثر',c:'var(--purple)'},{href:'barns.html',icon:'bi-building',l:'الجمالونات',c:'var(--orange)'}],
    'sheep.html':       [{href:'goats.html',icon:'bi-tropical-storm',l:'الماعز',c:'var(--green)'},{href:'breeding.html',icon:'bi-diagram-2-fill',l:'التكاثر',c:'var(--purple)'},{href:'barns.html',icon:'bi-building',l:'الجمالونات',c:'var(--orange)'}],
    'reports.html':     [{href:'finance.html',icon:'bi-wallet2',l:'المالية',c:'var(--green)'},{href:'activity.html',icon:'bi-clock-history',l:'سجل الأنشطة',c:'var(--gray)'}],
  };
  const rel=links[current];
  if(!rel||!rel.length)return;
  const div=document.createElement('div');
  div.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;';
  div.innerHTML=rel.map(r=>`<a href="${r.href}" style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:20px;font-size:.78rem;font-weight:600;text-decoration:none;background:${r.c}18;border:1px solid ${r.c}44;color:${r.c};transition:.2s" onmouseover="this.style.background='${r.c}30'" onmouseout="this.style.background='${r.c}18'"><i class="bi ${r.icon}" style="font-size:.8rem"></i>${r.l}</a>`).join('');
  const hdr=document.getElementById('page-header');
  if(hdr)hdr.insertAdjacentElement('afterend',div);
}

// ════════════════════════════════════════════
// NOTIFICATIONS POPUP — يُفتح من أي صفحة
// ════════════════════════════════════════════
window.openNotificationsPopup = async function(){
  // Show loading modal immediately
  showModal(
    '<div class="farm-modal wide" onclick="event.stopPropagation()" style="max-width:560px;max-height:88vh;overflow-y:auto">'+
      '<div class="d-flex justify-content-between align-items-center mb-3">'+
        '<h4 class="mb-0"><i class="bi bi-bell-fill accent-text me-2"></i>الإشعارات الذكية</h4>'+
        '<button class="action-btn sm" onclick="closeModal()"><i class="bi bi-x-lg"></i></button>'+
      '</div>'+
      '<div id="notif-modal-body" class="text-center py-4"><div class="spinner"></div></div>'+
    '</div>'
  );

  // Load data
  try{
    const t=new Date();
    const today=t.toISOString().slice(0,10);
    const u=getUser();
    const isAdmin=u&&u.role==='admin';
    const [animals,vaccines,breeding,health,meds,feeds,loginNotifs]=await Promise.all([
      fbGet('animals'),fbGet('vaccinations'),fbGet('breeding'),
      fbGet('health'),fbGet('inventory_meds'),fbGet('inventory_feeds'),
      isAdmin?fbGet('login_notifications'):Promise.resolve([])
    ]);

    const notifs=[];

    // 1. Upcoming births
    breeding.filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{
      const d=Math.ceil((new Date(r.expected_birth)-t)/86400000);
      if(d>=0&&d<=15) notifs.push({type:d<=3?'danger':'warning',cat:'التكاثر',icon:'bi-diagram-2-fill',title:'ولادة متوقعة: '+(r.female_tag||r.female_breed),msg:r.female_breed+' — '+r.expected_birth+(d===0?' (اليوم!)':' (بعد '+ar(d)+' يوم)'),href:'breeding.html'});
      if(d<0) notifs.push({type:'danger',cat:'التكاثر',icon:'bi-exclamation-triangle-fill',title:'تأخر في الولادة: '+(r.female_tag||r.female_breed),msg:'كان موعدها '+r.expected_birth+' — تأخرت '+ar(Math.abs(d))+' يوم',href:'breeding.html'});
    });

    // 2. Return to heat
    breeding.filter(r=>r.status==='failed'&&r.mating_date).forEach(r=>{
      const d=Math.floor((t-new Date(r.mating_date))/86400000);
      if(d>=18&&d<=25) notifs.push({type:'warning',cat:'التكاثر',icon:'bi-arrow-repeat',title:'رجوع شياع: '+(r.female_tag||r.female_breed),msg:'آخر تقريع '+r.mating_date+' — '+ar(d)+' يوم',href:'breeding.html'});
    });

    // 3. Overdue vaccinations
    vaccines.filter(v=>v.status==='overdue').forEach(v=>{
      notifs.push({type:'danger',cat:'التحصين',icon:'bi-bandaid-fill',title:'تحصين متأخر: '+v.name,msg:(v.target_section||'—')+' — '+ar(+v.count||0)+' رأس',href:'vaccine.html'});
    });

    // 4. Upcoming vaccinations
    vaccines.filter(v=>v.status==='pending'&&v.scheduled_date).forEach(v=>{
      const d=Math.ceil((new Date(v.scheduled_date)-t)/86400000);
      if(d>=0&&d<=7) notifs.push({type:d<=2?'danger':'warning',cat:'التحصين',icon:'bi-bandaid-fill',title:'موعد تحصين: '+v.name,msg:(v.target_section||'—')+' — بعد '+ar(d)+' يوم ('+v.scheduled_date+')',href:'vaccine.html'});
    });

    // 5. Withdrawal periods
    health.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=today).forEach(r=>{
      const d=Math.ceil((new Date(r.withdrawal_end)-t)/86400000);
      notifs.push({type:'danger',cat:'الصحة',icon:'bi-exclamation-triangle-fill',title:'فترة سحب: '+(r.animal_tag||r.animal_breed),msg:r.medication+' — لا يُنصح بالبيع حتى انتهاء تأثير العلاج في '+r.withdrawal_end+' ('+ar(d)+' يوم)',href:'health.html'});
    });

    // 6. Expiring medicines
    meds.filter(m=>m.expiry).forEach(m=>{
      const d=Math.ceil((new Date(m.expiry)-t)/86400000);
      if(d>=0&&d<=30) notifs.push({type:d<=7?'danger':'warning',cat:'المخزن',icon:'bi-capsule',title:'دواء قارب على الانتهاء: '+m.name,msg:'ينتهي '+m.expiry+' (بعد '+ar(d)+' يوم) — المتبقي: '+m.quantity+' '+(m.unit||''),href:'inventory.html'});
    });

    // 7. Low stock feeds
    feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0).forEach(f=>{
      notifs.push({type:'warning',cat:'المخزن',icon:'bi-bag-fill',title:'مخزون علف منخفض: '+f.name,msg:'المتبقي '+f.quantity+' '+(f.unit||'')+' — الحد الأدنى '+f.min_quantity,href:'inventory.html'});
    });

    // 8. Low stock meds
    meds.filter(m=>+m.quantity<=+m.min_quantity&&+m.min_quantity>0).forEach(m=>{
      notifs.push({type:'warning',cat:'المخزن',icon:'bi-capsule',title:'مخزون دواء منخفض: '+m.name,msg:'المتبقي '+m.quantity+' '+(m.unit||'')+' — الحد الأدنى '+m.min_quantity,href:'inventory.html'});
    });

    // 0. Login notifications for admin
    if(isAdmin&&loginNotifs.length>0){
      const today=new Date().toISOString().slice(0,10);
      loginNotifs.filter(n=>n.date===today).slice(0,5).forEach(function(n){
        notifs.push({type:'info',cat:'تسجيلات الدخول',icon:'bi-box-arrow-in-right',title:'دخل: '+n.userName,msg:n.roleLabel+' — '+n.timestamp?.slice(11,16)||'',href:'activity.html'});
      });
    }

    // 9. Recent deaths
    const recentDead=animals.filter(a=>a.status==='dead'&&a.died_at&&Math.floor((t-new Date(a.died_at))/86400000)<=3);
    if(recentDead.length>0) notifs.push({type:'info',cat:'القطيع',icon:'bi-x-octagon-fill',title:'نفق '+ar(recentDead.length)+' '+(recentDead.length===1?'رأس':'رؤوس')+' مؤخراً',msg:recentDead.map(a=>a.breed+(a.tag?' #'+a.tag:'')).join('، '),href:'animals.html'});

    // Update badge
    var badgeEl=document.getElementById('bell-badge');
    if(badgeEl){
      var cnt=notifs.filter(n=>n.type==='danger').length;
      if(cnt>0){badgeEl.style.display='flex';badgeEl.textContent=cnt>9?'9+':cnt;}
    }

    // Sort: danger first
    const order={danger:0,warning:1,info:2};
    notifs.sort((a,b)=>order[a.type]-order[b.type]);

    // Render
    const catCfg={danger:{c:'var(--red)',label:'عاجل'},warning:{c:'var(--orange)',label:'تنبيه'},info:{c:'var(--blue)',label:'معلومة'}};
    const cats=[...new Set(notifs.map(n=>n.cat))];

    var html='';
    if(notifs.length===0){
      html='<div class="empty-state"><i class="bi bi-bell-slash"></i><p>لا توجد تنبيهات الآن 🎉</p><small class="text-gray">الولادات، التحصينات، المخزون، وفترات السحب ستظهر هنا تلقائياً</small></div>';
    }else{
      html+='<div class="d-flex justify-content-between align-items-center mb-3"><small class="text-gray">'+ar(notifs.length)+' تنبيه نشط</small></div>';
      cats.forEach(function(cat){
        var catNotifs=notifs.filter(n=>n.cat===cat);
        var cfg0=catCfg[catNotifs[0].type]||catCfg.info;
        html+='<div style="margin-bottom:16px"><div class="fw-bold mb-2" style="font-size:.82rem;color:var(--gray)"><i class="bi bi-tag-fill me-2" style="color:'+cfg0.c+'"></i>'+cat+' <span class="type-badge badge-gray" style="font-size:.65rem">'+ar(catNotifs.length)+'</span></div>';
        catNotifs.forEach(function(n){
          var cfg=catCfg[n.type]||catCfg.info;
          html+='<div style="display:flex;align-items:flex-start;gap:12px;padding:12px;border-radius:12px;margin-bottom:8px;background:'+cfg.c+'0d;border:1px solid '+cfg.c+'33;cursor:'+(n.href?'pointer':'default')+'" '+(n.href?'onclick="closeModal();window.location.href=\''+n.href+'\'"':'')+'>'+
            '<div style="width:34px;height:34px;border-radius:50%;background:'+cfg.c+'22;display:flex;align-items:center;justify-content:center;flex-shrink:0"><i class="bi '+n.icon+'" style="color:'+cfg.c+'"></i></div>'+
            '<div style="flex:1;min-width:0">'+
              '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'+
                '<div class="fw-bold" style="font-size:.85rem;color:'+cfg.c+'">'+n.title+'</div>'+
                '<span class="type-badge" style="background:'+cfg.c+'22;color:'+cfg.c+';border:1px solid '+cfg.c+'44;font-size:.62rem;flex-shrink:0">'+cfg.label+'</span>'+
              '</div>'+
              '<div class="text-gray" style="font-size:.8rem;margin-top:2px">'+n.msg+'</div>'+
              (n.href?'<div style="font-size:.72rem;color:'+cfg.c+';margin-top:4px">اضغط للانتقال ←</div>':'')+
            '</div>'+
          '</div>';
        });
        html+='</div>';
      });
    }

    var body=document.getElementById('notif-modal-body');
    if(body)body.innerHTML=html;

  }catch(e){
    var body=document.getElementById('notif-modal-body');
    if(body)body.innerHTML='<div class="empty-state"><i class="bi bi-exclamation-triangle"></i><p>خطأ في تحميل الإشعارات: '+e.message+'</p></div>';
  }
};
// ── INFO TOOLTIPS (!) for calculations ──────────────────
function infoTip(text){
  return '<span class="info-tooltip" onclick="showInfoModal(this)" data-tip="'+encodeURIComponent(text)+'">!</span>';
}
window.showInfoModal=function(el){
  const text=decodeURIComponent(el.getAttribute('data-tip'));
  showModal('<div class="farm-modal narrow" onclick="event.stopPropagation()" style="max-width:420px">'+
    '<div class="d-flex align-items-center gap-2 mb-3">'+
      '<div class="info-tooltip" style="width:28px;height:28px;font-size:.9rem">!</div>'+
      '<h5 class="fw-bold mb-0">شرح العملية الحسابية</h5>'+
    '</div>'+
    '<div style="background:rgba(255,107,53,.06);border:1px solid rgba(255,107,53,.2);border-radius:12px;padding:14px;font-size:.88rem;line-height:1.7">'+text+'</div>'+
    '<div class="d-flex justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">حسناً</button></div>'+
  '</div>');
};

// ═══════════════════════════════════════════════════════
//  UNIFIED BIRTH REGISTRATION MODAL (same everywhere)
// ═══════════════════════════════════════════════════════
window.openUnifiedBirthModal=function(defaultSpecies){
  const s=getSettings();
  const u=getUser();
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const allBreeds=[...s.goatBreeds,...s.sheepBreeds];

  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:560px;max-height:95vh;overflow-y:auto">'+
    '<h4><i class="bi bi-stars" style="color:var(--yellow)"></i> تسجيل ولادة جديدة</h4>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>نوع المولود *</label><select class="field" id="ub-sp" onchange="_ubUpdateBreeds()"><option value="goat" '+(defaultSpecies==='goat'?'selected':'')+'>ماعز</option><option value="sheep" '+(defaultSpecies==='sheep'?'selected':'')+'>أغنام</option></select></div>'+
      '<div class="col-6"><label>سلالة المولود *</label><select class="field" id="ub-breed">'+s.goatBreeds.map(b=>'<option>'+b+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>الغرض</label><select class="field" id="ub-purpose"><option value="birth">مواليد</option><option value="tarbiya">تربية</option><option value="tasmeen">تسمين</option></select></div>'+
      '<div class="col-6"><label>الجنس *</label><select class="field" id="ub-gender"><option value="female">أنثى ♀</option><option value="male">ذكر ♂</option></select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>تاريخ الميلاد *</label><input type="date" class="field" id="ub-date" value="'+todayStr()+'"></div>'+
      '<div class="col-6"><label>رقم الترقيم</label><input class="field" id="ub-tag" placeholder="A-001"></div>'+
    '</div>'+
    '<div style="background:rgba(255,193,7,.07);border:1px solid rgba(255,193,7,.3);border-radius:12px;padding:12px;margin:8px 0">'+
      '<div class="fw-bold mb-2" style="font-size:.82rem;color:var(--yellow)"><i class="bi bi-person-heart me-1"></i>بيانات الأم (مطلوب)</div>'+
      '<div class="row g-2">'+
        '<div class="col-6"><label>رقم الأم *</label><input class="field" id="ub-mother-tag" placeholder="F-101"></div>'+
        '<div class="col-6"><label>سلالة الأم *</label><select class="field" id="ub-mother-breed">'+allBreeds.map(b=>'<option>'+b+'</option>').join('')+'</select></div>'+
      '</div>'+
      '<div class="col-12"><label>رقم الأب</label><input class="field" id="ub-father-tag" placeholder="M-001"></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>وزن الميلاد (كجم)</label><input type="number" class="field" id="ub-weight" step="0.1" placeholder="3.5" min="0"></div>'+
      '<div class="col-6"><label>الجمالون/العنبر</label><select class="field" id="ub-barn">'+barns.map(b=>'<option value="'+b+'">'+( b||'— غير محدد —')+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>عدد المواليد</label><input type="number" class="field" id="ub-qty" value="1" min="1" max="10"></div>'+
      '<div class="col-6">'+
        '<label data-hint="المبلغ المرتبط بالولادة: تكلفة بيطري أو قيمة المولود المقدرة">'+
          'المبلغ عند الولادة ('+s.currency+') <span class="info-tooltip" onclick="event.stopPropagation();showInfoModal(this)" data-tip="قيمة الولادة: ممكن يكون ثمن شراء الأم، تكلفة الطبيب، أو قيمة المولود المقدرة. يُستخدم في حساب تكلفة التربية.">!</span>'+
        '</label>'+
        '<input type="number" class="field" id="ub-amount" placeholder="0" min="0">'+
      '</div>'+
    '</div>'+
    '<label>سُجِّل بواسطة</label><input class="field" id="ub-addedby" value="'+(u?.name||'')+'">'+
    '<label>ملاحظات</label><textarea class="field" id="ub-notes" rows="2"></textarea>'+
    '<div class="d-flex gap-2 justify-content-end mt-3">'+
      '<button class="action-btn" onclick="closeModal()">إلغاء</button>'+
      '<button class="action-btn primary" onclick="_ubSubmit()"><i class="bi bi-check-lg"></i> حفظ الولادة</button>'+
    '</div>'+
  '</div>');
};

window._ubUpdateBreeds=function(){
  const s=getSettings();const sp=document.getElementById('ub-sp')?.value;
  const breeds=sp==='goat'?s.goatBreeds:s.sheepBreeds;
  const sel=document.getElementById('ub-breed');
  if(sel)sel.innerHTML=breeds.map(b=>'<option>'+b+'</option>').join('');
};

window._ubSubmit=async function(){
  const sp=document.getElementById('ub-sp').value;
  const breed=document.getElementById('ub-breed').value;
  const gender=document.getElementById('ub-gender').value;
  const purpose=document.getElementById('ub-purpose').value;
  const tag=document.getElementById('ub-tag').value.trim();
  const bdate=document.getElementById('ub-date').value;
  const motherTag=document.getElementById('ub-mother-tag').value.trim();
  const motherBreed=document.getElementById('ub-mother-breed').value;
  const fatherTag=document.getElementById('ub-father-tag').value.trim();
  const weight=parseFloat(document.getElementById('ub-weight').value)||null;
  const barn=document.getElementById('ub-barn').value||null;
  const qty=parseInt(document.getElementById('ub-qty').value)||1;
  const amount=parseFloat(document.getElementById('ub-amount').value)||null;
  const addedBy=document.getElementById('ub-addedby').value.trim();
  const notes=document.getElementById('ub-notes').value.trim();

  if(!motherTag||!motherBreed){toast('رقم الأم وسلالتها مطلوبان','error');return;}
  closeModal();toast('جاري الحفظ...','info');
  let ok=0;
  try{
    // Save breeding record
    await fbPost('breeding',{
      female_tag:motherTag, mother_tag:motherTag,
      female_breed:motherBreed, mother_breed:motherBreed,
      female_species:sp,
      male_tag:fatherTag||null,
      mating_date:null, expected_birth:null,
      actual_birth:bdate, status:'born',
      offspring_count:qty,
      male_offspring:gender==='male'?qty:0,
      female_offspring:gender==='female'?qty:0,
      birth_weights:weight?String(weight):null,
      birth_amount:amount, barn,
      added_by:addedBy,notes:notes||null
    });
    // Save each animal
    for(let i=0;i<qty;i++){
      const rec={species:sp,breed,gender,purpose,status:'alive',birth_date:bdate,
        tag:qty===1?(tag||null):(tag?tag+'-'+(i+1):null),
        mother_tag:motherTag,mother_breed:motherBreed,
        father_tag:fatherTag||null,
        birth_weight:weight,barn,notes:notes||null};
      await fbPost('animals',rec);ok++;
    }
    // Save weight record if provided
    if(weight&&ok>0){
      await fbPost('weights',{date:bdate,weight,animal_tag:tag||motherTag+'-newborn',species:sp,breed,barn,notes:'وزن الميلاد'});
    }
    await logActivity('add','animals','تسجيل ولادة: '+motherTag+' — '+ar(qty)+' مولود ('+breed+' '+(gender==='male'?'ذكر':'أنثى')+')');
    toast('✅ تم تسجيل الولادة و'+ar(qty)+' مولود في القطيع');
    // Reload page data if function exists
    if(typeof loadPageData==='function')await loadPageData();
    else if(typeof renderBreedingPage==='function'){const d=await fbGet('breeding');window.breedingRecs=d;renderBreedingPage(getSettings());}
    else setTimeout(()=>location.reload(),1200);
  }catch(e){toast('خطأ: '+e.message,'error');console.error(e);}
};

// ── FLOATING ACTION BUTTON ──────────────────────────────────
function addFAB(label,actionFn,iconClass){
  iconClass=iconClass||'bi-plus-lg';
  var existing=document.getElementById('global-fab');
  if(existing)existing.remove();
  var btn=document.createElement('button');
  btn.id='global-fab';
  btn.setAttribute('aria-label',label);
  btn.setAttribute('title',label);
  btn.innerHTML='<i class="bi '+iconClass+'"></i>';
  btn.style.cssText='position:fixed;bottom:80px;left:20px;width:56px;height:56px;border-radius:50%;background:var(--orange);color:#fff;border:none;box-shadow:0 8px 24px rgba(255,107,53,.5);font-size:1.3rem;cursor:pointer;z-index:1000;display:none;align-items:center;justify-content:center;transition:.2s;font-family:Cairo,sans-serif';
  btn.onclick=actionFn;
  btn.onmouseover=function(){this.style.transform='scale(1.08)';};
  btn.onmouseout=function(){this.style.transform='scale(1)';};
  document.body.appendChild(btn);
  var mq=window.matchMedia('(max-width:768px)');
  function applyMQ(e){btn.style.display=e.matches?'flex':'none';}
  applyMQ(mq);
  if(mq.addEventListener)mq.addEventListener('change',applyMQ);
}