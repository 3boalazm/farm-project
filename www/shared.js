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
        <button id="undo-btn" onclick="undoLast()" title="تراجع عن آخر عملية" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:20px;color:var(--text-muted);padding:5px 12px;cursor:pointer;font-size:.8rem;display:flex;align-items:center;gap:5px;font-family:Cairo,sans-serif;transition:.2s;white-space:nowrap;opacity:0.5">
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

// ── Notifications Dropdown ──────────────────────────────
let _notifOpen=false;
function toggleNotifDropdown(e){
  e.stopPropagation();
  const dd=document.getElementById('notif-dropdown');
  if(!dd)return;
  _notifOpen=!_notifOpen;
  if(_notifOpen){dd.style.display='block';loadNotifDropdown();}else{dd.style.display='none';}
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
    loginN.filter(n=>n.date===today).slice(0,3).forEach(n=>{notifs.push({type:'info',icon:'bi-box-arrow-in-right',title:'دخل: '+n.userName,msg:n.roleLabel,href:'activity.html'});});
    breeding.filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{
      const d=Math.ceil((new Date(r.expected_birth)-t)/86400000);
      if(d>=0&&d<=7)notifs.push({type:d<=2?'danger':'warning',icon:'bi-stars',title:'ولادة متوقعة',msg:(r.female_tag||r.female_breed)+' — بعد '+ar(d)+' يوم',href:'breeding.html'});
    });
    vaccines.filter(v=>v.status==='overdue').slice(0,2).forEach(v=>{notifs.push({type:'danger',icon:'bi-bandaid-fill',title:'تحصين متأخر: '+v.name,msg:v.target_section||'—',href:'vaccine.html'});});
    health.filter(r=>r.status==='active'&&r.treatment_effect_end&&r.treatment_effect_end>=today).slice(0,2).forEach(r=>{notifs.push({type:'danger',icon:'bi-exclamation-triangle-fill',title:'تأثير علاج نشط',msg:(r.animal_tag||r.animal_breed)+'حتى '+r.treatment_effect_end,href:'health.html'});});
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
function renderLoading(el, rows){
  if(!el)return;
  rows=rows||4;
  var skRow='<div class="skeleton" style="height:52px;margin-bottom:10px"></div>';
  el.innerHTML='<div style="padding:16px">'+
    '<div class="skeleton" style="height:28px;width:35%;margin-bottom:20px"></div>'+
    skRow.repeat(rows)+
  '</div>';
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

// ── RELATED LINKS ─────────────────────────────────────────
function renderRelatedLinks(page){}

// ── INFO TIP ──────────────────────────────────────────────
function infoTip(text){return '<span class="info-tooltip" title="'+text+'">!</span>';}
function showInfoModal(el){toast(el.dataset.tip||el.title,'info');}

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
  var banner=document.getElementById('offline-banner');
  window.addEventListener('online',function(){
    if(banner)banner.style.display='none';
    toast('تم استعادة الاتصال بالإنترنت','success');
  });
  window.addEventListener('offline',function(){
    if(banner)banner.style.display='block';
    toast('⚠️ انقطع الاتصال — البيانات تُحفظ محلياً','error');
  });
  if(!navigator.onLine&&banner)banner.style.display='block';
}

// ── UNDO SYSTEM ───────────────────────────────────────────
var _lastAction=null;
function trackAction(type, collection, id, oldData){
  _lastAction={type,collection,id,oldData,time:Date.now()};
  const btn=document.getElementById('undo-btn');
  if(btn){btn.style.opacity='1';}
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
var _gsCache={};
var _gsTimer=null;
function openGlobalSearch(){
  var overlay=document.getElementById('gs-overlay');
  if(overlay)overlay.style.display='block';
  var inp=document.getElementById('gs-input');
  if(inp)inp.focus();
  if(typeof fbGet==='function'){
    Promise.all([fbGet('animals'),fbGet('health'),fbGet('breeding')]).then(function(res){
      _gsCache={animals:res[0]||[],health:res[1]||[],breeding:res[2]||[]};
    }).catch(function(){});
  }
}
function closeGlobalSearch(){
  var overlay=document.getElementById('gs-overlay');
  if(overlay)overlay.style.display='none';
  var inp=document.getElementById('gs-input');
  if(inp)inp.value='';
  var res=document.getElementById('gs-results');
  if(res)res.innerHTML='';
}
function runGlobalSearch(q){
  q=q.trim().toLowerCase();
  var res=document.getElementById('gs-results');
  if(q.length<2){if(res)res.innerHTML='';return;}
  clearTimeout(_gsTimer);
  _gsTimer=setTimeout(function(){_doSearch(q);},250);
}
function _doSearch(q){
  var res=document.getElementById('gs-results');
  if(!res)return;
  var results=[];
  (_gsCache.animals||[]).forEach(function(a){
    var haystack=[a.tag,a.breed,a.barn,a.notes,a.species==='goat'?'ماعز':'أغنام',
      a.gender==='male'?'ذكر':'أنثى',a.purpose].filter(Boolean).join(' ').toLowerCase();
    if(haystack.includes(q)){
      var purposeL={tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose||'';
      results.push({type:'animal',icon:a.species==='goat'?'🐐':'🐑',
        title:a.breed+(a.tag?' #'+a.tag:''),
        sub:(a.gender==='male'?'ذكر':'أنثى')+' | '+purposeL+(a.barn?' | '+a.barn:'')+' | '+(a.status==='alive'?'حي':'نافق'),
        color:a.status==='alive'?'var(--green)':'var(--red)',href:'animal-detail.html?id='+a._id});
    }
  });
  (_gsCache.health||[]).forEach(function(r){
    var haystack=[r.animal_tag,r.animal_breed,r.diagnosis,r.medication].filter(Boolean).join(' ').toLowerCase();
    if(haystack.includes(q)){
      results.push({type:'health',icon:'💊',
        title:(r.animal_tag||r.animal_breed||'—')+': '+(r.diagnosis||'—'),
        sub:r.medication+(r.date?' | '+r.date:''),
        color:r.status==='active'?'var(--orange)':'var(--green)',href:'health.html'});
    }
  });
  (_gsCache.breeding||[]).forEach(function(r){
    var haystack=[r.female_tag,r.female_breed,r.male_tag].filter(Boolean).join(' ').toLowerCase();
    if(haystack.includes(q)){
      var statusL={pregnant:'حامل',born:'ولدت',failed:'فشل',pending:'انتظار'}[r.status]||r.status||'';
      results.push({type:'breeding',icon:'🐣',
        title:'تكاثر: '+(r.female_tag||r.female_breed||'—'),
        sub:statusL+(r.expected_birth?' | موعد: '+r.expected_birth:'')+(r.mating_date?' | تقريع: '+r.mating_date:''),
        color:'var(--purple)',href:'breeding.html'});
    }
  });
  if(!results.length){
    res.innerHTML='<div class="text-center py-4 text-gray" style="font-size:.82rem"><i class="bi bi-search d-block mb-2" style="font-size:1.5rem;opacity:.3"></i>لا توجد نتائج لـ "'+q+'"</div>';
    return;
  }
  var catLabels={animal:'القطيع',health:'السجل الصحي',breeding:'التكاثر'};
  var cats=[...new Set(results.map(function(r){return r.type;}))];
  res.innerHTML=cats.map(function(cat){
    var items=results.filter(function(r){return r.type===cat;}).slice(0,5);
    return '<div style="padding:6px 8px"><div style="font-size:.72rem;font-weight:700;color:var(--text-muted);padding:4px 8px 6px">'+(catLabels[cat]||cat)+' ('+ar(items.length)+')</div>'+
      items.map(function(item){
        return '<a href="'+item.href+'" onclick="closeGlobalSearch()" style="text-decoration:none;display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;transition:.15s;margin-bottom:2px;color:var(--text)" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'\'">'+
          '<span style="font-size:1.2rem;flex-shrink:0">'+item.icon+'</span>'+
          '<div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.85rem">'+item.title+'</div>'+
          '<small style="color:var(--text-muted)">'+item.sub+'</small></div>'+
          '<i class="bi bi-chevron-left" style="color:var(--text-muted);font-size:.7rem;flex-shrink:0"></i>'+
          '</a>';
      }).join('')+'</div>';
  }).join('<div style="height:1px;background:var(--border-3);margin:4px 8px"></div>')+
  '<div class="text-center" style="padding:8px;font-size:.72rem;color:var(--text-muted)">'+ar(results.length)+' نتيجة</div>';
}

// ── UNIFIED BIRTH MODAL ──────────────────────────────────
window.openUnifiedBirthModal=function(sp){{
  const s=getSettings();const u=getUser();
  const allBreeds=[...s.goatBreeds,...s.sheepBreeds];
  const barns=['','ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  showModal('<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:520px;max-height:92vh;overflow-y:auto">'+
    '<h4><i class="bi bi-stars" style="color:var(--yellow)"></i> تسجيل ولادة جديدة</h4>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>النوع</label><select class="field" id="ub-sp" onchange="_ubUpdateBreeds()"><option value="goat"'+(sp==='goat'?' selected':'')+'>🐐 ماعز</option><option value="sheep"'+(sp==='sheep'?' selected':'')+'>🐑 أغنام</option></select></div>'+
      '<div class="col-6"><label>السلالة</label><select class="field" id="ub-breed">'+( sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>'<option>'+b+'</option>').join('')+'</select></div>'+
    '</div>'+
    '<div class="row g-2">'+
      '<div class="col-6"><label>الجنس</label><select class="field" id="ub-gender"><option value="female">أنثى ♀</option><option value="male">ذكر ♂</option></select></div>'+
      '<div class="col-6"><label>الغرض</label><select class="field" id="ub-purpose"><option value="birth">مواليد</option><option value="tarbiya">تربية</option><option value="tasmeen">تسمين</option></select></div>'+
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
      '<div class="col-6"><label>المبلغ عند الولادة ('+s.currency+')</label><input type="number" class="field" id="ub-amount" placeholder="0" min="0"></div>'+
    '</div>'+
    '<label>سُجِّل بواسطة</label><input class="field" id="ub-addedby" value="'+(u?.name||'')+'">'+
    '<label>ملاحظات</label><textarea class="field" id="ub-notes" rows="2"></textarea>'+
    '<div class="d-flex gap-2 justify-content-end mt-3">'+
      '<button class="action-btn" onclick="closeModal()">إلغاء</button>'+
      '<button class="action-btn primary" onclick="_ubSubmit()"><i class="bi bi-check-lg"></i> حفظ الولادة</button>'+
    '</div>'+
  '</div>');
}};

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
    await fbPost('breeding',{female_tag:motherTag,mother_tag:motherTag,female_breed:motherBreed,mother_breed:motherBreed,female_species:sp,male_tag:fatherTag||null,mating_date:null,expected_birth:null,actual_birth:bdate,status:'born',offspring_count:qty,male_offspring:gender==='male'?qty:0,female_offspring:gender==='female'?qty:0,birth_weights:weight?String(weight):null,birth_amount:amount,barn,added_by:addedBy,notes:notes||null});
    for(let i=0;i<qty;i++){
      const rec={species:sp,breed,gender,purpose,status:'alive',birth_date:bdate,tag:qty===1?(tag||null):(tag?tag+'-'+(i+1):null),mother_tag:motherTag,mother_breed:motherBreed,father_tag:fatherTag||null,birth_weight:weight,barn,notes:notes||null};
      await fbPost('animals',rec);ok++;
    }
    if(weight&&ok>0)await fbPost('weight_log',{date:bdate,weight,animal_tag:tag||motherTag+'-newborn',species:sp,breed,barn,notes:'وزن الميلاد'});
    await logActivity('add','animals','تسجيل ولادة: '+motherTag+' — '+ar(qty)+' مولود ('+breed+' '+(gender==='male'?'ذكر':'أنثى')+')');
    toast('✅ تم تسجيل الولادة و'+ar(qty)+' مولود في القطيع');
    fbCacheInvalidate('animals');
    if(typeof loadPageData==='function')await loadPageData();
    else setTimeout(()=>location.reload(),1200);
  }catch(e){toast('خطأ: '+e.message,'error');console.error(e);}
};

// ── M3 PROGRESS INDICATORS ────────────────────────────────
window.renderM3Progress=function(value,label,color,size){
  color=color||'var(--color-interactive,var(--orange))';
  size=size||'';
  value=Math.max(0,Math.min(100,value||0));
  return '<div style="--progress-fill:'+color+'">'+
    (label?'<div class="d-flex justify-content-between mb-1"><small class="text-gray">'+label+'</small><small style="color:'+color+';font-weight:700">'+ar(Math.round(value))+'٪</small></div>':'')+
    '<div class="m3-progress '+size+'" role="progressbar" aria-valuenow="'+Math.round(value)+'" aria-valuemin="0" aria-valuemax="100">'+
      '<div class="m3-progress-fill" style="width:'+value+'%"></div>'+
    '</div></div>';
};
window.renderM3Circular=function(value,size,color,label){
  size=size||48;color=color||'var(--orange)';value=Math.max(0,Math.min(100,value||0));
  var r=(size-6)/2,circ=2*Math.PI*r,offset=circ-(value/100)*circ;
  return '<div class="m3-circular" style="width:'+size+'px;height:'+size+'px" role="img" aria-label="'+(label||'تقدم')+' '+Math.round(value)+'٪">'+
    '<svg width="'+size+'" height="'+size+'" viewBox="0 0 '+size+' '+size+'" style="transform:rotate(-90deg)">'+
      '<circle fill="none" stroke="var(--bg-3,#1a1a1a)" stroke-width="5" cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+r+'"/>'+
      '<circle fill="none" stroke="'+color+'" stroke-width="5" stroke-linecap="round" cx="'+(size/2)+'" cy="'+(size/2)+'" r="'+r+'" stroke-dasharray="'+circ.toFixed(1)+'" stroke-dashoffset="'+offset.toFixed(1)+'"/>'+
    '</svg>'+
    '<div style="position:absolute;font-size:'+(Math.round(size/4))+'px;font-weight:800;color:'+color+'">'+ar(Math.round(value))+'</div>'+
  '</div>';
};
window.renderM3Steps=function(current,total,labels){
  var html='<div class="m3-steps mb-1">';
  for(var i=0;i<total;i++){
    var cls=i<current?'done':i===current?'active':'';
    html+='<div class="m3-step '+cls+'" title="'+(labels&&labels[i]?labels[i]:i+1)+'"></div>';
  }
  html+='</div>';
  if(labels)html+='<small class="text-gray">'+(labels[Math.min(current,total-1)]||('الخطوة '+ar(current+1)))+'</small>';
  return html;
};

// ── FAB HELPER ────────────────────────────────────────────
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
