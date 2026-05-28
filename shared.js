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
  var root=document.getElementById('modal-root');
  if(!root){root=document.createElement('div');root.id='modal-root';document.body.appendChild(root);}
  root.innerHTML='<div class="farm-modal-backdrop" role="dialog" aria-modal="true" aria-label="نافذة منبثقة" onclick="if(event.target===this)closeModal()">'+html+'</div>';
  document.body.style.overflow='hidden';
  setTimeout(function(){
    var first=root.querySelector('input:not([type=hidden]),select,textarea,button:not([onclick*="closeModal"]),[tabindex]');
    if(first)first.focus();
  },80);
}
function closeModal(){
  var r=document.getElementById('modal-root');
  if(r)r.innerHTML='';
  document.body.style.overflow='';
}

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
  <a href="#main-content" class="skip-to-content" style="position:fixed;top:-40px;left:50%;transform:translateX(-50%);background:var(--orange);color:#fff;padding:8px 18px;border-radius:0 0 10px 10px;z-index:99999;font-weight:700;transition:.2s;font-family:Cairo,sans-serif" onfocus="this.style.top='0'" onblur="this.style.top='-40px'">انتقل للمحتوى الرئيسي</a>
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
        <button class="menu-btn" onclick="openGlobalSearch()" title="بحث شامل (Ctrl+K)" style="color:var(--text-gray)">
          <i class="bi bi-search"></i>
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
  <div id="modal-root"></div>
  <div id="offline-banner" style="display:none;position:fixed;bottom:0;left:0;right:0;z-index:9000;
    background:rgba(244,67,54,.95);color:#fff;padding:10px 16px;text-align:center;
    font-size:.82rem;font-weight:600;font-family:'Cairo',sans-serif;backdrop-filter:blur(4px);
    border-top:1px solid rgba(255,255,255,.2)">
    <i class="bi bi-wifi-off me-2"></i>أنت غير متصل بالإنترنت — البيانات محفوظة محلياً وستُزامَن عند الاتصال
    <button onclick="document.getElementById('offline-banner').style.display='none'"
      style="background:rgba(255,255,255,.2);border:none;color:#fff;border-radius:6px;padding:2px 10px;margin-right:12px;cursor:pointer;font-family:'Cairo',sans-serif;font-size:.78rem">✕</button>
  </div>
  <!-- Global Search Overlay -->
  <div id="gs-overlay" style="display:none;position:fixed;inset:0;z-index:8000;background:rgba(0,0,0,.75);
    backdrop-filter:blur(6px)" onclick="closeGlobalSearch()">
    <div onclick="event.stopPropagation()" style="max-width:600px;margin:80px auto 0;padding:0 16px">
      <div style="background:var(--bg-2);border:1px solid var(--border-2);border-radius:18px;overflow:hidden;
        box-shadow:0 24px 64px rgba(0,0,0,.5)">
        <div style="display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)">
          <i class="bi bi-search" style="color:var(--orange);font-size:1.1rem;flex-shrink:0"></i>
          <input id="gs-input" placeholder="ابحث في القطيع، السجلات الصحية، التكاثر..."
            style="flex:1;background:none;border:none;outline:none;font-family:'Cairo',sans-serif;
            font-size:.95rem;color:var(--text)" oninput="runGlobalSearch(this.value)" autocomplete="off">
          <small style="color:var(--text-muted);flex-shrink:0">Esc للإغلاق</small>
        </div>
        <div id="gs-results" style="max-height:420px;overflow-y:auto;padding:8px"></div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  initOfflineDetection();
  document.addEventListener('keydown', function(e){
    if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openGlobalSearch();}
    if(e.key==='Escape'){closeGlobalSearch();}
  });
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
function breedStats(animals, breed){
  const alive=animals.filter(a=>a.status==='alive'&&a.breed===breed);
  const c=(g,p)=>alive.filter(a=>a.gender===g&&a.purpose===p).length;
  return{total:alive.length,tarbiyaMale:c('male','tarbiya'),tarbiyaFemale:c('female','tarbiya'),tasmeenMale:c('male','tasmeen'),tasmeenFemale:c('female','tasmeen'),tarbiya:c('male','tarbiya')+c('female','tarbiya'),tasmeen:c('male','tasmeen')+c('female','tasmeen')};
}

// ── PAGE TEMPLATE ─────────────────────────────────────────
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

// ── OFFLINE DETECTION ──────────────────────────────────────
function initOfflineDetection(){
  window.addEventListener('online', ()=>{
    document.getElementById('offline-banner').style.display='none';
    toast('تم استعادة الاتصال بالإنترنت','success');
  });
  window.addEventListener('offline', ()=>{
    document.getElementById('offline-banner').style.display='block';
  });
  if(!navigator.onLine) document.getElementById('offline-banner').style.display='block';
}

// ── UNDO SYSTEM ───────────────────────────────────────────
let _lastAction=null;
function trackAction(type, collection, id, oldData){
  _lastAction={type,collection,id,oldData,time:Date.now()};
  const btn=document.getElementById('undo-btn');
  if(btn){btn.style.opacity='1';btn.classList.add('pulse-orange');}
}
async function undoLast(){
  if(!_lastAction)return;
  if(Date.now()-_lastAction.time>60000){toast('انتهت صلاحية التراجع (60 ثانية)','error');return;}
  try{
    if(_lastAction.type==='edit') await fbPatch(_lastAction.collection,_lastAction.id,_lastAction.oldData);
    else if(_lastAction.type==='add') await fbDelete(_lastAction.collection,_lastAction.id);
    toast('تم التراجع بنجاح');
    _lastAction=null;
    const btn=document.getElementById('undo-btn');
    if(btn)btn.style.opacity='0.5';
    setTimeout(()=>location.reload(),800);
  }catch(e){toast('فشل التراجع: '+e.message,'error');}
}

// ── GLOBAL SEARCH ─────────────────────────────────────────
let _gsCache={};
function openGlobalSearch(){
  document.getElementById('gs-overlay').style.display='block';
  document.getElementById('gs-input').focus();
  // Pre-fetch search data
  Promise.all([fbGet('animals'),fbGet('health'),fbGet('breeding')]).then(res=>{
    _gsCache={animals:res[0],health:res[1],breeding:res[2]};
  });
}
function closeGlobalSearch(){
  document.getElementById('gs-overlay').style.display='none';
  document.getElementById('gs-input').value='';
  document.getElementById('gs-results').innerHTML='';
}
function runGlobalSearch(q){
  q=q.trim().toLowerCase();
  const res=document.getElementById('gs-results');
  if(q.length<2){res.innerHTML='';return;}

  var results = [];
  (_gsCache.animals||[]).forEach(function(a){
    var haystack = [a.tag, a.breed, a.barn, a.notes, a.species==='goat'?'ماعز':'أغنام',
                    a.gender==='male'?'ذكر':'أنثى', a.purpose].filter(Boolean).join(' ').toLowerCase();
    if(haystack.includes(q)){
      var icon = a.species==='goat'?'🐐':'🐑';
      var purposeL = {tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose||'';
      results.push({
        type:'animal', icon:icon,
        title: a.breed + (a.tag?' #'+a.tag:''),
        sub:  (a.gender==='male'?'ذكر':'أنثى') + ' | ' + purposeL + (a.barn?' | '+a.barn:'') + ' | ' + (a.status==='alive'?'حي':'نافق'),
        color: a.status==='alive'?'var(--green)':'var(--red)',
        href: 'animal-detail.html?id=' + a._id,
      });
    }
  });

  (_gsCache.health||[]).forEach(function(r){
    var haystack = [r.animal_tag, r.animal_breed, r.diagnosis, r.medication].filter(Boolean).join(' ').toLowerCase();
    if(haystack.includes(q)){
      results.push({
        type:'health', icon:'💊',
        title: (r.animal_tag||r.animal_breed||'—') + ': ' + (r.diagnosis||'—'),
        sub:  r.medication + (r.date?' | '+r.date:''),
        color: r.status==='active'?'var(--orange)':'var(--green)',
        href: 'health.html',
      });
    }
  });

  (_gsCache.breeding||[]).forEach(function(r){
    var haystack = [r.female_tag, r.female_breed, r.male_tag].filter(Boolean).join(' ').toLowerCase();
    if(haystack.includes(q)){
      var statusL = {pregnant:'حامل',born:'ولدت',failed:'فشل',pending:'انتظار'}[r.status]||r.status||'';
      results.push({
        type:'breeding', icon:'🐣',
        title: 'تكاثر: ' + (r.female_tag||r.female_breed||'—'),
        sub:  statusL + (r.expected_birth?' | موعد: '+r.expected_birth:'') + (r.mating_date?' | تقريع: '+r.mating_date:''),
        color:'var(--purple)',
        href: 'breeding.html',
      });
    }
  });

  if(!results.length){
    res.innerHTML = '<div class="text-center py-4 text-gray" style="font-size:.82rem"><i class="bi bi-search d-block mb-2" style="font-size:1.5rem;opacity:.3"></i>لا توجد نتائج لـ "' + q + '"</div>';
    return;
  }

  var catLabels = { animal:'القطيع', health:'السجل الصحي', breeding:'التكاثر' };
  var cats = [...new Set(results.map(function(r){return r.type;}))];
  res.innerHTML = cats.map(function(cat){
    var items = results.filter(function(r){return r.type===cat;}).slice(0,5);
    return '<div style="padding:6px 8px"><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);padding:4px 8px 6px">' + (catLabels[cat]||cat) + ' (' + ar(items.length) + ')</div>' +
      items.map(function(item){
        return `<a href="${item.href}" onclick="closeGlobalSearch()" style="text-decoration:none;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;transition:.15s;margin-bottom:2px;color:var(--text)" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background=''">
          <span style="font-size:1.2rem;flex-shrink:0">${item.icon}</span>
          <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.85rem">${item.title}</div>
          <small style="color:var(--text-muted)">${item.sub}</small></div>
          <i class="bi bi-chevron-left" style="color:var(--text-muted);font-size:.7rem;flex-shrink:0"></i>
        </a>`;
      }).join('') +
    '</div>';
  }).join('<div style="height:1px;background:var(--border-3);margin:4px 8px"></div>') +
  '<div class="text-center" style="padding:8px;font-size:.72rem;color:var(--text-muted)">' + ar(results.length) + ' نتيجة</div>';
}
