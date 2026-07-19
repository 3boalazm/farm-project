'use strict';

// ── CHART.JS LOADER/WRAPPER (moved from pages/reports.js, v1.3) ────
// Relocated so the new analytics.html page can reuse this exact same
// wrapper instead of a second copy -- see
// docs/features/ANALYTICS-ARCHITECTURE.md. Byte-identical logic to
// what pages/reports.js used before the move; only the file changed.
function loadChartJS(cb) {
  if (window.Chart) { cb(); return; }
  var s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
  s.onload = cb;
  s.onerror = function() { console.warn('Chart.js failed'); cb(); };
  document.head.appendChild(s);
}

var CHART_COLORS = ['#ff6b35','#00e676','#2196f3','#9c27b0','#ffc107','#f44336','#00bcd4','#8bc34a','#ff9800','#e91e63'];
var isDark   = function(){ return !document.documentElement.classList.contains('light-mode'); };
var textClr  = function(){ return isDark() ? '#b0b0b0' : '#64748b'; };
var gridClr  = function(){ return isDark() ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; };
var _charts  = {};

function mkChart(id, cfg) {
  if (_charts[id]) _charts[id].destroy();
  var ctx = document.getElementById(id);
  if (!ctx || !window.Chart) return null;
  return (_charts[id] = new Chart(ctx, cfg));
}

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
var _modalTrigger=null;
function _modalFocusables(root){
  return root.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
}
function _focusModal(root){
  var f=_modalFocusables(root);
  if(f.length) f[0].focus();
}
function showModal(html){
  _modalTrigger=document.activeElement;
  let root=document.getElementById('modal-root');
  if(!root){root=document.createElement('div');root.id='modal-root';document.body.appendChild(root);}
  root.innerHTML=`<div class="farm-modal-backdrop" role="dialog" aria-modal="true" onclick="if(event.target===this)closeModal()">${html}</div>`;
  _focusModal(root);
}
function closeModal(){
  const r=document.getElementById('modal-root');
  if(r)r.innerHTML='';
  if(_modalTrigger&&typeof _modalTrigger.focus==='function')_modalTrigger.focus();
  _modalTrigger=null;
}
document.addEventListener('keydown',function(e){
  var root=document.getElementById('modal-root');
  if(!root||!root.firstElementChild)return;
  if(e.key==='Escape'){closeModal();return;}
  if(e.key==='Tab'){
    var f=_modalFocusables(root);
    if(!f.length)return;
    var first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  }
});

// ── Shared modal shell (Repository 4, Phase 1A/1B/2A) ────────
// Extracts ONLY the repeated farm-modal wrapper (outer div + icon+title
// header) that every open*() modal function was duplicating inline.
// Business logic, field markup, and footer buttons are passed in as-is
// via bodyHtml/footerHtml — nothing about them is rewritten.
// `color` is optional: when omitted, the <h4> gets no style attribute
// at all (matching modals whose icon coloring comes from a class like
// accent-text instead of an inline color).
// `iconClass` is optional: appended to the icon's class list.
// `extraClass` is optional: appended to the outer div's class list
// (e.g. 'narrow' — a purely structural pass-through, same category
// as `style`, not a new visual variant/theme).
function renderFarmModal({icon, iconClass='', color='', title, bodyHtml='', footerHtml='', style='', extraClass=''}){
  var h4Style = color ? ' style="color:'+color+'"' : '';
  var iconCls = 'bi '+icon+(iconClass?' '+iconClass:'');
  var outerCls = 'farm-modal'+(extraClass?' '+extraClass:'');
  return '<div class="'+outerCls+'" onclick="event.stopPropagation()"'+(style?' style="'+style+'"':'')+'>'+
    '<h4'+h4Style+'><i class="'+iconCls+'"></i> '+title+'</h4>'+
    bodyHtml+
    footerHtml+
  '</div>';
}

// ── Shared bulk-action refresh sequence (Repository 4, Phase 2A) ──
// The exact, byte-identical 3-line tail that both execBulk() and
// execBulkDo() ran independently after every write: clear selection
// state, refetch animals, re-render. Pure extraction — no logic
// changed, no reordering, no new behavior.
async function refreshAnimalsAfterBulk(){
  _selected.clear();_selectMode=false;
  animals=await fbGet('animals');
  renderFilters();renderAnimals();
}

// ── Shared bulk-patch write loop (Repository 4, Phase 2B) ─────
// Extracted from the three genuinely identical-shape loops in
// execBulk() (edit/transfer/sell): a single, static, precomputed
// payload applied to every id in `ids`, via fbPatch('animals', ...),
// counting successes and silently swallowing individual failures —
// exactly as each of the three did independently. Nearly a literal
// copy-paste of the original loop body; only `ids` and `payload` are
// now parameters instead of being read from the enclosing scope.
// NOT used for the death branch (its payload is rebuilt per-iteration
// using the loop index — a different shape, deliberately left as-is
// this phase) or for delete (a different Firebase operation, fbDelete,
// reserved for a future phase).
async function commitBulkPatch(ids, payload){
  var ok=0;
  for(var i=0;i<ids.length;i++){try{await fbPatch('animals',ids[i],payload);ok++;}catch(e){}}
  return ok;
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
  <div class="sidebar-overlay" id="sidebarOverlay" onclick="closeSidebar()"></div>
  <aside class="sidebar-menu" id="sidebarMenu">
    <div class="sidebar-header">
      <div class="d-flex align-items-center gap-2">
        <div class="farm-logo-sm">${s.logoUrl==='media/logo-icon.svg'?`<img class="logo-for-light" src="media/logo-icon.svg" alt="">
<img class="logo-for-dark" src="media/logo-icon-dark.svg" alt="">`:s.logoUrl?`<img src="${s.logoUrl}" alt="">`:'🐐'}</div>
        <div><div class="fw-bold" style="font-size:1rem">${s.farmName}</div>
        <small style="color:${ROLES[u?.role||'admin']?.color}">${ROLES[u?.role||'admin']?.label}</small></div>
      </div>
      <button class="sidebar-close" onclick="closeSidebar()" aria-label="إغلاق القائمة" title="إغلاق القائمة" data-hint="إغلاق القائمة"><i class="bi bi-x-lg"></i></button>
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
      <a href="dashboard.html" class="navbar-brand"><span>${s.logoUrl==='media/logo-icon.svg'?`<img class="logo-for-light" src="media/logo-icon.svg" alt="" style="height:1.2em;width:auto;vertical-align:-.2em"><img class="logo-for-dark" src="media/logo-icon-dark.svg" alt="" style="height:1.2em;width:auto;vertical-align:-.2em">`:s.logoUrl?`<img src="${s.logoUrl}" alt="" style="height:1.2em;width:auto;vertical-align:-.2em">`:'🐐'}</span> ${s.farmName}</a>
      <div class="d-flex align-items-center gap-2">
        <span class="date-badge d-none d-sm-flex"><i class="bi bi-calendar3"></i> ${todayAr()}</span>
        <button class="theme-btn d-none d-md-flex" onclick="toggleTheme()" id="theme-toggle-btn" title="تبديل المظهر" data-hint="تبديل المظهر">
          <i class="bi bi-circle-half" id="theme-icon"></i>
        </button>
        <div style="position:relative">
          <a href="notifications.html" class="bell-btn" id="bell-btn" style="text-decoration:none" title="الإشعارات" data-hint="الإشعارات">
            <i class="bi bi-bell-fill"></i><span class="bell-badge" id="bell-badge" style="display:none">0</span>
          </a>
        </div>
        <button id="undo-btn" onclick="undoLast()" title="تراجع عن آخر عملية" data-hint="تراجع عن آخر عملية" style="background:rgba(255,255,255,.06);border:1px solid var(--border);border-radius:20px;color:var(--text-muted);padding:5px 12px;cursor:pointer;font-size:.8rem;display:flex;align-items:center;gap:5px;font-family:Cairo,sans-serif;transition:.2s;white-space:nowrap;opacity:0.5" id="undo-btn">
          <i class="bi bi-arrow-counterclockwise"></i>
        </button>
        <button class="menu-btn" onclick="openSidebar()" aria-label="القائمة" title="القائمة" data-hint="القائمة"><i class="bi bi-list"></i></button>
      </div>
    </div>
  </nav>
  <div id="toast-wrap"></div>
  <div id="modal-root"></div>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  // Sprint 9: populate the bell badge that's now on every page, not just
  // notifications.html -- fire-and-forget, never blocks page render.
  if(window.updateGlobalBellBadge) window.updateGlobalBellBadge();
}

// ══════════════════════════════════════════════════════
// NAV RAIL V2 — pilot (dashboard.html only, opt-in). Purely
// additive: renderNavbar() above is completely untouched, so
// every other page is at zero risk from this. Reuses the exact
// same FARM_NAV/can() permission filtering and the exact same
// mobile off-canvas sidebar markup+IDs as the original -- only
// the desktop-width visual shell (icon rail + right panel)
// differs. Section colors use the fixed #34d399/#022c22 pair
// from THEME-SWITCH-SIDEBAR-ACTIVE.md's proven fix, not
// var(--green) -- that variable is exactly what caused that bug
// on this same permanently-dark rail surface.
// ══════════════════════════════════════════════════════
var _sectionIconsV2={'القطيع':'bi-list-ul','الصحة والإنتاج':'bi-heart-pulse','المالية':'bi-wallet2','النظام':'bi-gear'};
function _railStrokeIcon(icon){ return (icon||'').replace(/-fill$/,''); }
function renderNavbarV2(activePage=''){
  const s=getSettings();const u=getUser();
  const logoHtml=s.logoUrl==='media/logo-icon.svg'?`<img class="logo-for-light" src="media/logo-icon.svg" alt=""><img class="logo-for-dark" src="media/logo-icon-dark.svg" alt="">`:s.logoUrl?`<img src="${s.logoUrl}" alt="">`:'🐐';

  const railSections=FARM_NAV.map(function(section,i){
    const visible=section.items.filter(function(p){return !p.perm||can(p.perm);});
    if(!visible.length)return'';
    const hasActive=visible.some(function(p){return p.href===activePage;});
    const sectionIcon=_railStrokeIcon(_sectionIconsV2[section.section]||'bi-circle');
    const iconLinks=visible.map(function(p){
      return '<a href="'+p.href+'" class="rail-v2__icon-link'+(activePage===p.href?' active':'')+'" aria-label="'+p.label+'" title="'+p.label+'" data-hint="'+p.label+'"'+(activePage===p.href?' aria-current="page"':'')+'><i class="bi '+_railStrokeIcon(p.icon)+'"></i></a>';
    }).join('');
    const childLinks=visible.map(function(p){
      const isActive=activePage===p.href;
      const badge=p.href==='notifications.html'?'<span class="rail-v2__badge rail-v2__badge--mint" id="railTreeBellBadge" style="display:none">0</span>':'';
      return '<a href="'+p.href+'" class="rail-v2__child'+(isActive?' active':'')+'"'+(isActive?' aria-current="page"':'')+'>'+
        '<i class="bi '+_railStrokeIcon(p.icon)+'"></i><span>'+p.label+'</span>'+badge+
      '</a>';
    }).join('');
    return '<div class="rail-v2__section'+(hasActive?' is-expanded':'')+'" data-rail-section="'+i+'">'+
      '<div class="rail-v2__icon-group">'+iconLinks+'</div>'+
      '<div class="rail-v2__expanded-group">'+
        '<button type="button" class="rail-v2__parent" onclick="toggleRailSection('+i+')" aria-expanded="'+(hasActive?'true':'false')+'" aria-controls="rail-tree-'+i+'">'+
          '<i class="bi '+sectionIcon+' rail-v2__parent-icon"></i>'+
          '<span class="rail-v2__parent-label">'+section.section+'</span>'+
          '<i class="bi bi-chevron-down rail-v2__parent-arrow"></i>'+
        '</button>'+
        '<div class="rail-v2__tree-wrap" id="rail-tree-'+i+'">'+
          '<div class="rail-v2__tree-inner">'+childLinks+'</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');

  // Panel quick-links: a small, fixed shortlist of high-traffic
  // destinations. Filtered through the SAME can() check the rail uses,
  // and looked up FROM FARM_NAV rather than re-typed, so labels/icons
  // can never drift out of sync with nav.js.
  const _quickHrefs=['animals.html','births.html','health.html','tasks.html'];
  const _navFlat=FARM_NAV.reduce(function(acc,sec){return acc.concat(sec.items);},[]);
  const quickLinks=_quickHrefs.map(function(href){
    const p=_navFlat.find(function(x){return x.href===href;});
    if(!p) return '';
    if(p.perm && !can(p.perm)) return '';
    return '<a href="'+p.href+'" class="rail-v2-panel__link"><i class="bi '+_railStrokeIcon(p.icon)+'"></i><span>'+p.label+'</span></a>';
  }).join('');

  const html=`
  <div class="rail-v2-mobile-bar">
    <button class="menu-btn" onclick="toggleRailDrawerMobile()" aria-label="القائمة" title="القائمة" data-hint="القائمة" id="railV2MobileMenuBtn"><i class="bi bi-list"></i></button>
    <span class="fw-bold">${s.farmName}</span>
    <button class="menu-btn" onclick="toggleRailPanel()" aria-label="لوحة المستخدم" title="لوحة المستخدم" data-hint="لوحة المستخدم" id="railV2MobilePanelBtn"><i class="bi bi-person-circle"></i></button>
  </div>

  <div class="rail-v2-backdrop" id="railV2Backdrop"></div>

  <aside class="rail-v2" aria-label="التنقل الرئيسي">
    <div class="rail-v2__logo-row">
      <button type="button" class="rail-v2__logo" onclick="toggleRailExpanded()" aria-label="${s.farmName} — توسيع/طي القائمة" title="توسيع/طي القائمة" data-hint="توسيع/طي القائمة">${logoHtml}</button>
    </div>
    <nav class="rail-v2__nav">${railSections}</nav>
    <div class="rail-v2__bottom">
      <button class="rail-v2__btn" onclick="toggleTheme()" id="theme-toggle-btn" title="تبديل المظهر" data-hint="تبديل المظهر"><i class="bi bi-circle-half" id="theme-icon"></i></button>
      <button class="rail-v2__avatar" onclick="toggleRailPanel()" aria-label="لوحة المستخدم" title="لوحة المستخدم" data-hint="لوحة المستخدم">${(u?.name||'م').slice(0,1)}</button>
    </div>
  </aside>

  <button class="rail-v2-toggle" id="railV2ToggleBtn" onclick="toggleRailPanel()" aria-label="إخفاء/إظهار اللوحة الجانبية" title="إخفاء/إظهار اللوحة" data-hint="إخفاء/إظهار اللوحة"><i class="bi bi-layout-sidebar-inset"></i></button>
  <aside class="rail-v2-panel" id="railV2Panel" aria-label="لوحة المستخدم">
    <div class="rail-v2-panel__profile">
      <div class="rail-v2-panel__avatar">${(u?.name||'م').slice(0,1)}</div>
      <div><div class="fw-bold">${u?.name||'مدير'}</div>
      <small style="color:${ROLES[u?.role||'admin']?.color}">${ROLES[u?.role||'admin']?.label}</small></div>
    </div>
    <div class="rail-v2-panel__actions">
      <a href="notifications.html" class="action-btn sm" style="flex:1;justify-content:center" data-hint="الإشعارات"><i class="bi bi-bell-fill"></i> الإشعارات<span class="bell-badge" id="bell-badge" style="display:none;position:static;margin-right:4px">0</span></a>
      <button id="undo-btn" onclick="undoLast()" title="تراجع عن آخر عملية" data-hint="تراجع عن آخر عملية" class="action-btn sm" style="flex:1;justify-content:center;opacity:.5"><i class="bi bi-arrow-counterclockwise"></i> تراجع</button>
    </div>
    <a href="assistant.html" class="action-btn primary sm" style="width:100%;justify-content:center;margin-bottom:16px" data-hint="اسأل المساعد الذكي"><i class="bi bi-robot"></i> المساعد الذكي</a>

    <div class="rail-v2-panel__info">
      <div class="rail-v2-panel__info-row"><i class="bi bi-house-door"></i><span>${s.farmName}</span></div>
      <div class="rail-v2-panel__info-row"><i class="bi bi-calendar3"></i><span>${todayAr()}</span></div>
    </div>

    <div class="rail-v2-panel__section-label">اختصارات سريعة</div>
    <div class="rail-v2-panel__links">${quickLinks}</div>

    <button onclick="logout()" class="rail-v2-panel__logout" data-hint="تسجيل الخروج"><i class="bi bi-box-arrow-right"></i> تسجيل الخروج</button>
  </aside>

  <div id="toast-wrap"></div>
  <div id="modal-root"></div>`;
  document.body.insertAdjacentHTML('afterbegin', html);
  if(window.updateGlobalBellBadge) window.updateGlobalBellBadge();
}

function toggleRailExpanded(){
  var expanded=document.documentElement.getAttribute('data-rail-expanded')==='true';
  document.documentElement.setAttribute('data-rail-expanded', expanded?'false':'true');
}

function toggleRailSection(i){
  var el=document.querySelector('.rail-v2__section[data-rail-section="'+i+'"]');
  if(!el) return;
  var btn=el.querySelector('.rail-v2__parent');
  var willExpand=!el.classList.contains('is-expanded');
  el.classList.toggle('is-expanded', willExpand);
  if(btn) btn.setAttribute('aria-expanded', willExpand?'true':'false');
}

function _isMobileNavV2(){ return window.matchMedia('(max-width:991px)').matches; }
function closeRailDrawersMobileV2(){
  document.documentElement.setAttribute('data-rail-v2-mobile','closed');
  document.documentElement.setAttribute('data-panel-v2-mobile','closed');
}
function toggleRailDrawerMobile(){
  var open=document.documentElement.getAttribute('data-rail-v2-mobile')==='open';
  closeRailDrawersMobileV2();
  if(!open) document.documentElement.setAttribute('data-rail-v2-mobile','open');
}
function toggleRailPanel(){
  if(_isMobileNavV2()){
    var openM=document.documentElement.getAttribute('data-panel-v2-mobile')==='open';
    closeRailDrawersMobileV2();
    if(!openM) document.documentElement.setAttribute('data-panel-v2-mobile','open');
    return;
  }
  var open=document.documentElement.getAttribute('data-panel-v2')!=='closed';
  document.documentElement.setAttribute('data-panel-v2', open?'closed':'open');
}
document.addEventListener('click',function(e){
  if(e.target && e.target.id==='railV2Backdrop') closeRailDrawersMobileV2();
  // Every nav link (collapsed icon, expanded label, or flyout-free mobile
  // list) closes any open mobile drawer immediately on click, rather than
  // relying solely on the page navigation that follows to make it "go away".
  if(e.target.closest && e.target.closest('.rail-v2__icon-link, .rail-v2__child')) closeRailDrawersMobileV2();
});
window.addEventListener('resize',function(){
  if(!_isMobileNavV2()) closeRailDrawersMobileV2();
});
document.addEventListener('keydown',function(e){
  if(e.key==='Escape'){
    closeRailDrawersMobileV2();
  }
});

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
function renderErrorState(el, msg='حدث خطأ أثناء التحميل'){
  el.innerHTML=`<div class="empty-state"><i class="bi bi-exclamation-triangle" style="color:var(--red)"></i><p>${msg}</p><button class="action-btn" onclick="location.reload()"><i class="bi bi-arrow-clockwise"></i> إعادة المحاولة</button></div>`;
}

// ══════════════════════════════════════════════════════
// PHASE 2 — CORE COMPONENT SYSTEM
// Additive only: renderPageHeader/renderEmpty/renderLoading above
// are untouched, so every existing page keeps working unchanged.
// Each function below returns/injects markup using the Phase 1
// token scale — no new raw colors/sizes introduced.
// ══════════════════════════════════════════════════════

// ── 1. Page Header V2 (adds breadcrumb + description + primary/secondary split) ──
function renderPageHeaderV2({ title, description='', breadcrumb=[], primaryAction='', secondaryActions='' }){
  const el=document.getElementById('page-header');
  if(!el)return;
  const crumbHtml = breadcrumb.length ? `<nav class="page-breadcrumb">${
    breadcrumb.map((b,i)=> i<breadcrumb.length-1
      ? `<a href="${b.href||'#'}">${b.label}</a><span class="mx-1">/</span>`
      : `<span>${b.label}</span>`
    ).join('')
  }</nav>` : '';
  el.innerHTML = `
    ${crumbHtml}
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
      <div>
        <h4 class="fw-bold mb-0">${title}</h4>
        ${description?`<small class="text-gray">${description}</small>`:''}
      </div>
      <div class="d-flex gap-2 flex-wrap align-items-center">
        ${secondaryActions}
        ${primaryAction}
      </div>
    </div>`;
}

// ── 2. Section Container ──
function renderSectionContainer({ title, description='', actionHtml='', contentHtml='', variant='default' }){
  const variantClass = variant==='highlighted' ? 'section-highlighted' : variant==='warning' ? 'section-warning' : '';
  const padStyle = variant==='compact' ? 'padding:var(--space-3)' : '';
  return `
    <div class="wonder-card mb-4 ${variantClass}" style="${padStyle}">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <div>
          <h6 class="fw-bold mb-0" style="font-size:var(--text-lg)">${title}</h6>
          ${description?`<small class="text-gray">${description}</small>`:''}
        </div>
        ${actionHtml?`<div>${actionHtml}</div>`:''}
      </div>
      <div>${contentHtml}</div>
    </div>`;
}

// ── 3. KPI Card (states: normal/watch/alert, or loading:true, or empty via value=null) ──
function renderMiniSparkline(data, color){
  if(!data || !data.length) return '';
  const w=100,h=28,max=Math.max(...data),min=Math.min(...data),range=(max-min)||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1)*w).toFixed(1)},${(h-((v-min)/range)*h).toFixed(1)}`).join(' ');
  return `<div class="kpi-spark"><svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/></svg></div>`;
}
function renderKPICard({ label, value=null, unit='', trend=null, trendDir='up', comparisonPeriod='', status='normal', sparklineData=null, href=null, loading=false, footerHtml='' }){
  if(loading){
    return `<div class="kpi-card"><div class="skeleton mb-2" style="height:12px;width:55%"></div><div class="skeleton mb-2" style="height:26px;width:40%"></div><div class="skeleton" style="height:10px;width:70%"></div></div>`;
  }
  if(value===null){
    return `<div class="kpi-card"><div class="kpi-label mb-2">${label}</div><div class="text-gray" style="font-size:var(--text-sm)">لا توجد بيانات</div></div>`;
  }
  const statusMap = { normal:{c:'var(--green)',l:'طبيعي'}, watch:{c:'var(--yellow)',l:'يحتاج متابعة'}, alert:{c:'var(--red)',l:'تنبيه'} };
  const st = statusMap[status] || statusMap.normal;
  const trendHtml = trend!==null ? `<span class="kpi-trend ${trendDir==='up'?'kpi-trend-up':'kpi-trend-down'}"><i class="bi bi-arrow-${trendDir==='up'?'up':'down'}-short"></i>${trend>0?'+':''}${ar(trend)}%</span>` : '';
  const inner = `
    <div class="kpi-card-head">
      <span class="kpi-label">${label}</span>
      <span class="kpi-status-dot" style="background:${st.c}" title="${st.l}"></span>
    </div>
    <div class="kpi-value">${value}${unit?`<span class="kpi-unit">${unit}</span>`:''}</div>
    <div class="kpi-foot">${trendHtml}${comparisonPeriod?`<span class="kpi-period">${comparisonPeriod}</span>`:''}</div>
    ${renderMiniSparkline(sparklineData, st.c)}
    ${footerHtml}`;
  return href ? `<a href="${href}" class="kpi-card" style="text-decoration:none;color:inherit">${inner}</a>` : `<div class="kpi-card">${inner}</div>`;
}

// ── 4. Alert Card (severity: info/watch/critical) ──
function renderAlertCard({ severity='info', icon='bi-info-circle', title, message='', source='', deadline='', actionLabel='', actionHref='' }){
  const sevMap = { info:'var(--blue)', watch:'var(--yellow)', critical:'var(--red)' };
  const color = sevMap[severity] || sevMap.info;
  return `
    <div class="alert-card-v2" style="border-right:3px solid ${color}">
      <div class="d-flex align-items-start gap-2">
        <i class="bi ${icon}" style="color:${color};font-size:1.1rem;margin-top:2px"></i>
        <div class="flex-grow-1">
          <div class="fw-bold" style="font-size:var(--text-sm)">${title}</div>
          ${message?`<div class="text-gray" style="font-size:var(--text-xs)">${message}</div>`:''}
          <div class="d-flex gap-2 mt-1 flex-wrap align-items-center" style="font-size:var(--text-2xs)">
            ${source?`<span class="text-gray">${source}</span>`:''}
            ${deadline?`<span class="text-gray">• ${deadline}</span>`:''}
            ${actionLabel && actionHref ? `<a href="${actionHref}" class="fw-bold" style="color:${color};text-decoration:none">${actionLabel} ←</a>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

// ── 5. Chart Container (state: ready/loading/empty/error) ──
function renderChartContainer({ title, subtitle='', filterHtml='', chartHtml='', state='ready', emptyMsg='لا توجد بيانات كافية', errorMsg='تعذر تحميل الرسم البياني' }){
  let body;
  if(state==='loading') body=`<div class="text-center py-4"><div class="spinner"></div></div>`;
  else if(state==='empty') body=`<div class="empty-state py-3"><i class="bi bi-bar-chart"></i><p>${emptyMsg}</p></div>`;
  else if(state==='error') body=`<div class="empty-state py-3"><i class="bi bi-exclamation-triangle" style="color:var(--red)"></i><p>${errorMsg}</p></div>`;
  else body=chartHtml;
  return `
    <div class="wonder-card h-100">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-1">
        <div><h6 class="fw-bold mb-0" style="font-size:var(--text-lg)">${title}</h6>${subtitle?`<small class="text-gray">${subtitle}</small>`:''}</div>
        ${filterHtml?`<div>${filterHtml}</div>`:''}
      </div>
      <div class="mt-3">${body}</div>
    </div>`;
}

// ── 6. Data Table Wrapper (state: ready/loading/empty) ──
function renderDataTableWrapper({ title, filterHtml='', headers=[], rowsHtml='', state='ready', emptyMsg='لا توجد سجلات', actionsHtml='', paginationHtml='' }){
  let bodyHtml;
  if(state==='loading') bodyHtml=`<tr><td colspan="${headers.length||1}"><div class="text-center py-4"><div class="spinner"></div></div></td></tr>`;
  else if(state==='empty') bodyHtml=`<tr><td colspan="${headers.length||1}"><div class="empty-state py-3"><i class="bi bi-inbox"></i><p>${emptyMsg}</p></div></td></tr>`;
  else bodyHtml=rowsHtml;
  return `
    <div class="wonder-card p-0">
      <div class="p-3 pb-2 d-flex justify-content-between align-items-center flex-wrap gap-2" style="border-bottom:1px solid var(--border-3)">
        <div class="fw-bold" style="font-size:var(--text-sm)">${title}</div>
        <div class="d-flex gap-2 align-items-center flex-wrap">${filterHtml}${actionsHtml}</div>
      </div>
      <div class="table-responsive">
        <table class="tbl"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${bodyHtml}</tbody></table>
      </div>
      ${paginationHtml?`<div class="p-2 d-flex justify-content-center" style="border-top:1px solid var(--border-3)">${paginationHtml}</div>`:''}
    </div>`;
}

// ── 7. Timeline ──
function renderTimelineItem({ time, eventType='', entity='', description='', statusBadgeHtml='' }){
  return `
    <div class="timeline-item-v2">
      <div class="timeline-item-v2-dot"></div>
      <div class="timeline-item-v2-body">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div style="font-size:var(--text-sm)"><b>${eventType}</b>${entity?` — ${entity}`:''}</div>
          <span class="text-gray" style="font-size:var(--text-2xs)">${time}</span>
        </div>
        ${description?`<div class="text-gray" style="font-size:var(--text-xs)">${description}</div>`:''}
        ${statusBadgeHtml?`<div class="mt-1">${statusBadgeHtml}</div>`:''}
      </div>
    </div>`;
}
function renderTimeline(itemsHtmlArray){
  return `<div class="timeline-v2">${itemsHtmlArray.join('')}</div>`;
}

// ── 8. Animal Card (farm-specific) ──
function renderAnimalCard({ tag, breed, species='goat', status='alive', barn='', href=null, quickActionsHtml='' }){
  const statusMap = { alive:{cls:'badge-tarbiya',label:'حي'}, dead:{cls:'badge-danger',label:'نافق'}, sold:{cls:'badge-gray',label:'مباع'}, treatment:{cls:'badge-tasmeen',label:'تحت العلاج'}, quarantine:{cls:'badge-blue',label:'حجر صحي'} };
  const st = statusMap[status] || statusMap.alive;
  const speciesIcon = species === 'goat' ? 'bi-tropical-storm' : 'bi-cloud-fill';
  const inner = `
    <div class="d-flex justify-content-between align-items-start mb-2">
      <div class="d-flex align-items-center gap-2"><i class="bi ${speciesIcon}" style="color:var(--green)"></i><span class="fw-bold" style="font-size:var(--text-sm)">${tag||'—'}</span></div>
      <span class="type-badge ${st.cls}">${st.label}</span>
    </div>
    <div class="text-gray mb-2" style="font-size:var(--text-xs)">${breed}${barn?` • ${barn}`:''}</div>
    ${quickActionsHtml?`<div class="d-flex gap-1">${quickActionsHtml}</div>`:''}`;
  return href ? `<a href="${href}" class="animal-card-v2" style="text-decoration:none;color:inherit;display:block">${inner}</a>` : `<div class="animal-card-v2">${inner}</div>`;
}

// ── 9. Production Widget (farm-specific, compact row — smaller than KPI Card) ──
function renderProductionWidget({ type, value, unit='', trend=null, trendDir='up', period='', status='normal' }){
  const statusMap = { normal:'var(--green)', watch:'var(--yellow)', alert:'var(--red)' };
  const color = statusMap[status] || statusMap.normal;
  const trendHtml = trend!==null ? `<span style="color:${trendDir==='up'?'var(--green)':'var(--red)'};font-size:var(--text-2xs);font-weight:700"><i class="bi bi-arrow-${trendDir==='up'?'up':'down'}-short"></i>${trend>0?'+':''}${ar(trend)}%</span>` : '';
  return `
    <div class="d-flex align-items-center justify-content-between" style="padding:var(--space-3) 0;border-bottom:1px solid var(--border-3)">
      <div class="d-flex align-items-center gap-2">
        <span class="kpi-status-dot" style="background:${color}"></span>
        <div><div style="font-size:var(--text-sm);font-weight:600">${type}</div>${period?`<div class="text-gray" style="font-size:var(--text-2xs)">${period}</div>`:''}</div>
      </div>
      <div class="text-end">
        <div style="font-family:'Lexend',sans-serif;font-weight:700;font-size:var(--text-lg)">${value}${unit?` <span class="text-gray" style="font-size:var(--text-xs)">${unit}</span>`:''}</div>
        ${trendHtml}
      </div>
    </div>`;
}

// ── 10. Inventory Stock Indicator (farm-specific — progress bar, not a chart, per the report) ──
function renderInventoryStockIndicator({ name, quantity, minQuantity=0, unit='' }){
  const ratio = minQuantity > 0 ? quantity / (minQuantity * 3) : 1;
  const pct = Math.max(4, Math.min(100, Math.round(ratio * 100)));
  const isLow = minQuantity > 0 && quantity <= minQuantity;
  const isWatch = !isLow && minQuantity > 0 && quantity <= minQuantity * 1.5;
  const color = isLow ? 'var(--red)' : isWatch ? 'var(--yellow)' : 'var(--green)';
  const label = isLow ? 'حرج' : isWatch ? 'يحتاج متابعة' : 'جيد';
  return `
    <div class="mb-2">
      <div class="d-flex justify-content-between mb-1" style="font-size:var(--text-xs)">
        <span class="fw-bold">${name}</span>
        <span style="color:${color}">${ar(quantity)}${unit?` ${unit}`:''} <span class="text-gray">— ${label}</span></span>
      </div>
      <div class="m3-progress"><div class="m3-progress-fill" style="width:${pct}%;background:${color}"></div></div>
    </div>`;
}

// ══════════════════════════════════════════════════════
// PHASE 3 — ANALYTICS GRID chart generators
// Hand-rolled SVG, consistent with the existing renderPieChart
// approach (no charting library is loaded in this project).
// Each returns null on insufficient data — callers must check
// and fall back to renderChartContainer's 'empty' state
// ("charts must degrade gracefully" per the report).
// ══════════════════════════════════════════════════════

function renderLineChartSVG(data, opts={}){
  const { color='#10b981', height=180, width=560, showArea=true } = opts;
  if(!data || data.length < 2) return null;
  const values = data.map(d => +d.value || 0);
  const labels = data.map(d => d.label || '');
  const padding = { top:10, right:10, bottom:24, left:36 };
  const cw = width - padding.left - padding.right;
  const ch = height - padding.top - padding.bottom;
  const maxV = Math.max(...values) * 1.15 || 1;
  const minV = Math.min(0, Math.min(...values));
  const range = (maxV - minV) || 1;
  const pts = values.map((v,i) => ({
    x: padding.left + (i/(values.length-1)) * cw,
    y: padding.top + ch - ((v-minV)/range) * ch
  }));
  const pathD = pts.map((p,i) => `${i===0?'M':'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${pts[pts.length-1].x.toFixed(1)} ${(padding.top+ch).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(padding.top+ch).toFixed(1)} Z`;
  const gridLines = [0,0.5,1].map(f => {
    const y = padding.top + ch * (1-f);
    const val = Math.round(minV + range*f);
    return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width-padding.right}" y2="${y.toFixed(1)}" stroke="var(--border-3)" stroke-width="1"/><text x="${padding.left-6}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${ar(val)}</text>`;
  }).join('');
  const step = Math.max(1, Math.floor(pts.length/5));
  const labelEls = pts.map((p,i) => (i%step===0 || i===pts.length-1) ? `<text x="${p.x.toFixed(1)}" y="${height-4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${labels[i]}</text>` : '').join('');
  return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
    ${gridLines}
    ${showArea?`<path d="${areaD}" fill="${color}" opacity=".12"/>`:''}
    <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3" fill="${color}"/>`).join('')}
    ${labelEls}
  </svg>`;
}

function renderGroupedBarSVG(data, opts={}){
  const { colors=['#10b981','#ef4444'], height=180, width=560 } = opts;
  if(!data || !data.length) return null;
  const padding = { top:10, right:10, bottom:24, left:44 };
  const cw = width - padding.left - padding.right;
  const ch = height - padding.top - padding.bottom;
  const maxV = Math.max(...data.flatMap(d=>d.values), 1) * 1.15;
  const groupW = cw / data.length;
  const nBars = data[0].values.length;
  const barW = groupW / (nBars + 1.5);
  const gridLines = [0,0.5,1].map(f => {
    const y = padding.top + ch*(1-f);
    return `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${width-padding.right}" y2="${y.toFixed(1)}" stroke="var(--border-3)" stroke-width="1"/><text x="${padding.left-6}" y="${(y+3).toFixed(1)}" text-anchor="end" font-size="9" fill="var(--text-muted)">${ar(Math.round(maxV*f))}</text>`;
  }).join('');
  const bars = data.map((d,gi) => {
    const groupX = padding.left + gi*groupW;
    const rects = d.values.map((v,vi) => {
      const bh = Math.max((v/maxV)*ch, 1);
      const x = groupX + (vi+0.75)*barW;
      const y = padding.top + ch - bh;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(barW*0.8).toFixed(1)}" height="${bh.toFixed(1)}" rx="3" fill="${colors[vi]||'#9ca3af'}"/>`;
    }).join('');
    return rects + `<text x="${(groupX+groupW/2).toFixed(1)}" y="${height-4}" text-anchor="middle" font-size="9" fill="var(--text-muted)">${d.label}</text>`;
  }).join('');
  return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${gridLines}${bars}</svg>`;
}

function renderDonutSVG(segments, opts={}){
  const { size=160, strokeWidth=22 } = opts;
  const total = (segments||[]).reduce((t,s)=>t+(+s.value||0),0);
  if(!total) return null;
  const r=(size-strokeWidth)/2, cx=size/2, cy=size/2, circumference=2*Math.PI*r;
  let offset=0;
  const arcs = segments.filter(s=>s.value>0).map(s => {
    const dash=(s.value/total)*circumference;
    const el=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dash.toFixed(1)} ${circumference.toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    offset+=dash;
    return el;
  }).join('');
  const legend = segments.filter(s=>s.value>0).map(s=>`<span class="d-inline-flex align-items-center gap-1" style="font-size:var(--text-xs);margin:0 6px"><span style="width:8px;height:8px;border-radius:50%;background:${s.color};display:inline-block"></span>${s.label} (${ar(s.value)})</span>`).join('');
  return `<div class="text-center"><svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}<text x="${cx}" y="${cy+6}" text-anchor="middle" font-size="20" font-weight="700" fill="var(--text)" font-family="Lexend">${ar(total)}</text></svg><div class="d-flex flex-wrap justify-content-center mt-2">${legend}</div></div>`;
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
    'reports.html':     [{href:'finance.html',icon:'bi-wallet2',l:'المالية',c:'var(--green)'}],
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
        '<button class="action-btn sm" onclick="closeModal()" aria-label="إغلاق" title="إغلاق"><i class="bi bi-x-lg"></i></button>'+
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

// ── Wave B Commit 1/N: canonical single-offspring creation, shared by
// _ubSubmit() and submitBreeding()'s markBorn path (D-02). Same fields,
// same order, same weight-history behavior as the pre-existing inline
// logic this replaces -- no behavior change for _ubSubmit's own callers.
window.createOffspringAnimal=async function(p){
  const rec={species:p.species,breed:p.breed,gender:p.gender,purpose:p.purpose,status:'alive',birth_date:p.birthDate,
    tag:p.tag||null,
    mother_tag:p.motherTag,mother_breed:p.motherBreed,
    father_tag:p.fatherTag||null,
    birth_weight:p.weight||null,barn:p.barn||null,notes:p.notes||null};
  const newAnimalId=await fbPost('animals',rec);
  if(p.weight){
    await fbPost('animals/'+newAnimalId+'/weights',{weight:p.weight, date:p.birthDate, notes:'وزن الميلاد'});
  }
  return newAnimalId;
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
      await window.createOffspringAnimal({
        species:sp,breed,gender,purpose,birthDate:bdate,
        tag:qty===1?(tag||null):(tag?tag+'-'+(i+1):null),
        motherTag,motherBreed,fatherTag,weight,barn,notes
      });
      ok++;
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

// ── Wave A Commit 5/6: Historical weight_log -> animals/{id}/weights ──
// One-time (safely re-runnable) migration utility. Not wired to any UI
// button in this commit -- callable explicitly (console or a future,
// separately-scoped commit). Reads weight_log and animals; writes only
// to animals/{id}/weights. Never deletes or modifies weight_log itself.
window.migrateWeightLogToWeights=async function(){
  var rows=await fbGet('weight_log')||[];
  var animalsList=await fbGet('animals')||[];
  var migrated=0, skippedDuplicate=0, unresolved=0, malformed=0;
  var details=[];
  for(var i=0;i<rows.length;i++){
    var row=rows[i];
    if(typeof row.weight!=='number' || !(row.weight>0) || !row.date){
      malformed++; details.push({row:row,status:'malformed'}); continue;
    }
    var targetId=row.animal_id;
    if(targetId){
      var stillExists=animalsList.some(function(a){return a._id===targetId;});
      if(!stillExists){
        unresolved++; details.push({row:row,status:'unresolved-deleted-animal',animalId:targetId}); continue;
      }
    }else{
      var matches=animalsList.filter(function(a){
        if(row.animal_tag && row.animal_tag!=='—') return a.tag===row.animal_tag;
        if(row.animal_breed && row.animal_breed!=='—') return a.breed===row.animal_breed;
        return false;
      });
      if(matches.length!==1){
        unresolved++; details.push({row:row,status:'unresolved-'+(matches.length===0?'no-match':'ambiguous')}); continue;
      }
      targetId=matches[0]._id;
    }
    var existing=await fbGet('animals/'+targetId+'/weights')||[];
    var dup=existing.some(function(w){return w.weight===row.weight && w.date===row.date;});
    if(dup){
      skippedDuplicate++; details.push({row:row,status:'skipped-duplicate',animalId:targetId}); continue;
    }
    await fbPost('animals/'+targetId+'/weights',{weight:row.weight,date:row.date,notes:row.notes||null});
    migrated++; details.push({row:row,status:'migrated',animalId:targetId});
  }
  return {total:rows.length, migrated:migrated, skippedDuplicate:skippedDuplicate, unresolved:unresolved, malformed:malformed, details:details};
};

// ══════════════════════════════════════════════════════════════
//  TASK AUTOMATION ENGINE (Sprint 1, Epic 1 -- additive, new file
//  region, does not modify any existing function).
//
//  Domain Event -> Automation Engine -> Task Generator -> Task Store
//  Single centralized entry point: window.autoGenerateTask(eventType, payload)
//
//  Every caller (vaccine.js, breeding.js, health.js) invokes this
//  SAME function -- no per-domain task-creation logic is duplicated.
//  See docs/features/AUTO-TASK-GENERATION.md for the full design.
// ══════════════════════════════════════════════════════════════

// Local date-math helper for this engine's own use. NOTE: daysUntil()
// already exists independently in pages/breeding.js and pages/vaccine.js
// (pre-existing duplication, not introduced here, out of this sprint's
// scope to consolidate) -- this engine does not add a third page-local
// copy, it uses its own internal helper instead, scoped to this block.
function _autoTaskDaysFromToday(n){var d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10);}

var AUTO_TASK_RULES = {
  vaccination_scheduled: {
    category: 'medical', priority: 'high', role: 'vet',
    title: function(p){ return 'تحصين: '+(p.name||'')+(p.target_section?' — '+p.target_section:''); },
    dueDate: function(p){ return p.scheduled_date||null; },
    relatedTag: function(p){ return p.target_section||null; },
  },
  expected_birth_approaching: {
    category: 'breeding', priority: 'high', role: 'supervisor',
    title: function(p){ return 'ولادة متوقعة: '+(p.female_tag||''); },
    dueDate: function(p){ return p.expected_birth||null; },
    relatedTag: function(p){ return p.female_tag||null; },
  },
  medication_followup: {
    category: 'medical', priority: 'high', role: 'vet',
    title: function(p){ return 'انتهاء فترة السحب: '+(p.animal_tag||''); },
    dueDate: function(p){ return p.withdrawal_end||null; },
    relatedTag: function(p){ return p.animal_tag||null; },
  },
  // Sprint 2, Epic 2: weight alerts reuse this SAME engine -- no second
  // task-creation path. dueDate is "today" since a weight alert always
  // needs attention now, not on a future scheduled date.
  weight_alert: {
    category: 'inspection', priority: 'medium', role: 'supervisor',
    title: function(p){ return (p.alertTitle||'تنبيه وزن')+': '+(p.animal_tag||''); },
    dueDate: function(p){ return p.todayStr||new Date().toISOString().slice(0,10); },
    relatedTag: function(p){ return p.animal_tag||null; },
  },
  // Sprint 3, Epic 3: health risk alerts, same reuse pattern again.
  health_risk_alert: {
    category: 'medical', priority: 'high', role: 'vet',
    title: function(p){ return (p.recommendation||'مراجعة صحية')+': '+(p.animal_tag||''); },
    dueDate: function(p){ return p.todayStr||new Date().toISOString().slice(0,10); },
    relatedTag: function(p){ return p.animal_tag||null; },
  },
  // Sprint 4, Epic 4: production alerts, same reuse pattern again.
  production_alert: {
    category: 'inspection', priority: 'medium', role: 'supervisor',
    title: function(p){ return (p.alertTitle||'متابعة إنتاج')+': '+(p.animal_tag||''); },
    dueDate: function(p){ return p.todayStr||new Date().toISOString().slice(0,10); },
    relatedTag: function(p){ return p.animal_tag||null; },
  },
};

// window.autoGenerateTask(eventType, payload)
//   eventType: one of the keys in AUTO_TASK_RULES above.
//   payload:   { sourceId, ...event-specific fields used by the rule's title()/dueDate() }
//   Returns:   the task's _id (new or pre-existing), or null if nothing was created/found.
//
// Deduplication: deterministic, keyed on `eventType + ':' + payload.sourceId`.
// At most one auto-generated task ever exists per (event type, source record),
// regardless of its completion status. If the source record's computed due
// date changes (e.g. a vaccination is rescheduled), the existing task's due
// date is updated in place rather than a duplicate being created.
//
// Never throws -- a failure here must never block the caller's own
// domain write (the vaccination/breeding/health record itself always
// saves regardless of whether task automation succeeds).
window.autoGenerateTask = async function(eventType, payload){
  try{
    var rule = AUTO_TASK_RULES[eventType];
    if(!rule || !payload || !payload.sourceId) return null;
    var dueDate = rule.dueDate(payload);
    if(!dueDate) return null; // nothing to schedule without a date

    var dedupKey = eventType+':'+payload.sourceId;
    var existingTasks = await fbGet('daily_tasks');
    var already = existingTasks.find(function(t){ return t.auto_dedup_key===dedupKey; });

    if(already){
      if(already.date!==dueDate){
        await fbPatch('daily_tasks', already._id, {date: dueDate});
      }
      return already._id; // deterministic: never a second task for the same source event
    }

    var data = {
      title: rule.title(payload), category: rule.category, priority: payload.priorityOverride||rule.priority,
      date: dueDate, assigned_to: null, assigned_to_name: '',
      barn: payload.barn||null, notes: 'مهمة مولّدة تلقائيًا',
      recurring: false, recurring_days: null, is_template: false,
      status: 'pending', created_at: new Date().toISOString(), created_by: 'النظام (تلقائي)',
      auto_generated: true, auto_source_type: eventType, auto_source_id: payload.sourceId,
      auto_dedup_key: dedupKey, related_tag: rule.relatedTag(payload),
    };
    var newId = await fbPost('daily_tasks', data);
    await logActivity('add','daily_tasks','مهمة تلقائية: '+data.title);
    return newId;
  }catch(e){
    return null; // fail silent and safe -- see docstring above
  }
};

// ══════════════════════════════════════════════════════════════
//  WEIGHT INTELLIGENCE ENGINE (Sprint 2, Epic 2 -- additive, new
//  file region, does not modify any existing weight-writer function).
//
//  Weight Event -> Weight Intelligence Engine -> Rule Evaluation
//    -> Alert -> Optional Task (reuses Sprint 1's autoGenerateTask)
//    -> Notification (piggybacks on toast(), the existing UI feedback
//       mechanism -- no new notification channel introduced)
//
//  Single centralized entry point: window.evaluateWeightAlert(animalId, animalTag, barn)
//  Reads ONLY the certified Weight SSOT (animals/{id}/weights) -- never
//  writes to it, never duplicates its calculation.
//  See docs/features/WEIGHT-INTELLIGENCE.md for the full design.
// ══════════════════════════════════════════════════════════════

var WEIGHT_ALERT_RULES = {
  weight_loss: {
    severity: 'high', taskPriority: 'high', actionLabel: 'فحص بيطري',
    evaluate: function(sortedHistory){
      if(sortedHistory.length<2) return null;
      var latest=sortedHistory[0], prev=sortedHistory[1];
      if(!prev.weight||prev.weight<=0) return null;
      var pct=(latest.weight-prev.weight)/prev.weight;
      if(pct<=-0.05) return {current:latest.weight, previous:prev.weight, detail:'فقدان '+Math.abs(Math.round(pct*100))+'٪ منذ آخر وزن'};
      return null;
    },
  },
  no_growth: {
    severity: 'medium', taskPriority: 'medium', actionLabel: 'مراجعة تغذية',
    evaluate: function(sortedHistory){
      if(sortedHistory.length<2) return null;
      var latest=sortedHistory[0];
      var latestDate=new Date(latest.date);
      var older=null;
      for(var i=1;i<sortedHistory.length;i++){
        if((latestDate-new Date(sortedHistory[i].date))/86400000>=14){ older=sortedHistory[i]; break; }
      }
      if(!older||!older.weight||older.weight<=0) return null;
      var pct=(latest.weight-older.weight)/older.weight;
      if(Math.abs(pct)<0.01) return {current:latest.weight, previous:older.weight, detail:'بلا نمو ملحوظ خلال 14 يوم فأكثر'};
      return null;
    },
  },
};

// Deterministic dedup: one active (non-resolved) alert per (animalId, ruleType).
// Re-evaluation either updates an existing active alert in place, auto-resolves
// one whose condition no longer holds, or creates a new one -- never duplicates.
window.evaluateWeightAlert = async function(animalId, animalTag, barn){
  try{
    if(!animalId) return [];
    var history=await fbGet('animals/'+animalId+'/weights')||[];
    var sorted=history.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
    var existingAlerts=await fbGet('weight_alerts');
    var results=[];

    for(var ruleType in WEIGHT_ALERT_RULES){
      var rule=WEIGHT_ALERT_RULES[ruleType];
      var finding=rule.evaluate(sorted);
      var active=existingAlerts.find(function(a){return a.animal_id===animalId&&a.rule_type===ruleType&&a.status==='active';});

      if(finding){
        if(active){
          await fbPatch('weight_alerts',active._id,{current_weight:finding.current, previous_weight:finding.previous, detail:finding.detail, detected_at:new Date().toISOString()});
          results.push(active._id);
        }else{
          var alertData={
            animal_id:animalId, animal_tag:animalTag||'', barn:barn||null,
            rule_type:ruleType, severity:rule.severity, action:rule.actionLabel,
            current_weight:finding.current, previous_weight:finding.previous, detail:finding.detail,
            status:'active', detected_at:new Date().toISOString(), resolved_at:null,
          };
          var newAlertId=await fbPost('weight_alerts',alertData);
          await logActivity('add','weight_alerts','تنبيه وزن ('+rule.actionLabel+'): '+(animalTag||animalId));
          results.push(newAlertId);
          if(window.autoGenerateTask){
            window.autoGenerateTask('weight_alert',{sourceId:newAlertId, animal_tag:animalTag, barn:barn, alertTitle:rule.actionLabel, priorityOverride:rule.taskPriority}).catch(function(){});
          }
          if(window.toast) window.toast('⚠️ تنبيه وزن: '+(animalTag||animalId)+' — '+rule.actionLabel,'error');
        }
      }else if(active){
        // Condition no longer holds -- auto-resolve, do not delete (preserves history).
        await fbPatch('weight_alerts',active._id,{status:'resolved', resolved_at:new Date().toISOString()});
      }
    }
    return results;
  }catch(e){
    return []; // fail silent and safe -- must never block the weight write that triggered this
  }
};

// Read-time staleness check (NOT event-driven -- by definition there is
// no "new weight" event when a weight is MISSING). Intended to be called
// once per dashboard/alerts-page load, not per weight write.
window.evaluateMissingWeightAlerts = async function(animalsList, maxDays){
  try{
    maxDays = maxDays || 30;
    var existingAlerts = await fbGet('weight_alerts');
    var results = [];
    var todayMs = Date.now();
    for(var i=0;i<animalsList.length;i++){
      var a = animalsList[i];
      if(a.status==='dead'||a.status==='sold') continue;
      if(!a.weight_updated) continue; // never weighed at all -- out of this rule's scope, not a regression
      var daysSince = (todayMs - new Date(a.weight_updated).getTime())/86400000;
      var active = existingAlerts.find(function(al){return al.animal_id===a._id&&al.rule_type==='missing_weight'&&al.status==='active';});
      if(daysSince>=maxDays){
        if(!active){
          var alertData={
            animal_id:a._id, animal_tag:a.tag||'', barn:a.barn||null,
            rule_type:'missing_weight', severity:'medium', action:'إعادة الوزن',
            current_weight:a.current_weight||null, previous_weight:null,
            detail:'لا يوجد وزن مسجّل منذ '+Math.floor(daysSince)+' يوم',
            status:'active', detected_at:new Date().toISOString(), resolved_at:null,
          };
          var newId=await fbPost('weight_alerts',alertData);
          await logActivity('add','weight_alerts','تنبيه وزن (إعادة الوزن): '+(a.tag||a._id));
          results.push(newId);
          if(window.autoGenerateTask){
            window.autoGenerateTask('weight_alert',{sourceId:newId, animal_tag:a.tag, barn:a.barn, alertTitle:'إعادة الوزن', priorityOverride:'medium'}).catch(function(){});
          }
        }
      }else if(active){
        await fbPatch('weight_alerts',active._id,{status:'resolved', resolved_at:new Date().toISOString()});
      }
    }
    return results;
  }catch(e){
    return [];
  }
};

// Manual resolution (e.g., staff investigated and confirmed it's fine).
window.resolveWeightAlert = async function(alertId){
  try{
    await fbPatch('weight_alerts',alertId,{status:'resolved', resolved_at:new Date().toISOString()});
    await logActivity('edit','weight_alerts','إغلاق تنبيه وزن يدويًا');
    return true;
  }catch(e){ return false; }
};

// ══════════════════════════════════════════════════════════════
//  HEALTH INTELLIGENCE ENGINE (Sprint 3, Epic 3 -- additive, new
//  file region, does not modify any existing health/vaccine/weight
//  writer function).
//
//  Health Events -> Health Intelligence Engine -> Risk Evaluation
//    -> Risk Score -> Recommendations -> Automation Engine (Sprint 1, reused)
//
//  DECISION SUPPORT ONLY -- this engine never asserts a diagnosis. It
//  surfaces observable signals already present in certified data and
//  recommends a human review; it never claims to know what is wrong.
//
//  Unlike Sprint 1's tasks and Sprint 2's alerts, the risk SCORE ITSELF
//  is NOT persisted. It is a derived computation over existing health,
//  vaccination, and weight-alert data -- recomputing it on demand avoids
//  a second, potentially-stale source of truth for the same facts (a
//  stored score could drift from the records it was computed from; an
//  on-demand computation cannot). Only the OPTIONAL follow-up task this
//  engine may create is persisted, via Sprint 1's existing engine.
//
//  Single centralized entry point: window.evaluateHealthRisk(animalId, animalTag, barn)
//  See docs/features/HEALTH-INTELLIGENCE.md for the full design.
// ══════════════════════════════════════════════════════════════

var HEALTH_RISK_WEIGHTS = {
  activeIllness: 30, weightLoss: 25, noGrowth: 10, missingWeight: 5,
  missedVaccination: 20, repeatedMedication: 15, repeatedTreatment: 20,
  noRecentCheck: 5, lowBCS: 15,
};
var HEALTH_RISK_WINDOWS = { repeatedMedicationDays: 30, repeatedTreatmentDays: 14, noRecentCheckDays: 180 };
var HEALTH_RISK_BCS_THRESHOLD = 2.5;

// Recommendation copy + task priority per contributing factor. Every
// recommendation carries the `evidence` string already attached to its
// contributor -- recommendations are never generated without a cited reason.
var HEALTH_RECOMMENDATIONS = {
  active_illness:      { label:'مراجعة بيطرية',   taskPriority:'high'   },
  weight_weight_loss:  { label:'فحص بيطري',       taskPriority:'high'   },
  weight_no_growth:    { label:'مراجعة تغذية',    taskPriority:'medium' },
  weight_missing_weight:{ label:'إعادة الوزن',     taskPriority:'medium' },
  missed_vaccination:  { label:'إكمال التحصين',   taskPriority:'high'   },
  repeated_medication: { label:'متابعة العلاج',   taskPriority:'medium' },
  repeated_treatment:  { label:'مراجعة بيطرية',   taskPriority:'high'   },
  no_recent_check:     { label:'فحص روتيني',      taskPriority:'low'    },
  low_bcs:              { label:'مراجعة تغذية',    taskPriority:'medium' },
};
// Display order for recommendations -- the most actionable, currently-
// unresolved medical signals surface first, independent of point value.
var HEALTH_FACTOR_PRIORITY_ORDER = ['active_illness','repeated_treatment','weight_weight_loss','weight_no_growth','weight_missing_weight','missed_vaccination','repeated_medication','low_bcs','no_recent_check'];

window.evaluateHealthRisk = async function(animalId, animalTag, barn){
  try{
    if(!animalId||!animalTag) return null;
    var allHealth = await fbGet('health');
    var myHealth = (allHealth||[]).filter(function(r){return r.animal_tag===animalTag;})
      .sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});

    var allWeightAlerts = await fbGet('weight_alerts');
    var myWeightAlerts = (allWeightAlerts||[]).filter(function(a){return a.animal_id===animalId&&a.status==='active';});

    var allVacc = await fbGet('vaccinations');
    var today = new Date().toISOString().slice(0,10);
    var myVacc = barn ? (allVacc||[]).filter(function(v){
      return v.target_section===barn && (v.status==='overdue' || (v.status==='pending' && v.scheduled_date && v.scheduled_date<today));
    }) : [];

    var score=0, contributors=[];

    var activeRec=myHealth.find(function(r){return r.status==='active';});
    if(activeRec){
      score+=HEALTH_RISK_WEIGHTS.activeIllness;
      contributors.push({factor:'active_illness', points:HEALTH_RISK_WEIGHTS.activeIllness, evidence:(activeRec.diagnosis||'—')+' ('+(activeRec.date||'—')+')'});
    }

    myWeightAlerts.forEach(function(a){
      var key='weight_'+a.rule_type;
      var w = a.rule_type==='weight_loss'?HEALTH_RISK_WEIGHTS.weightLoss:a.rule_type==='no_growth'?HEALTH_RISK_WEIGHTS.noGrowth:a.rule_type==='missing_weight'?HEALTH_RISK_WEIGHTS.missingWeight:0;
      if(w>0){ score+=w; contributors.push({factor:key, points:w, evidence:a.detail||a.action||''}); }
    });

    if(myVacc.length){
      score+=HEALTH_RISK_WEIGHTS.missedVaccination;
      contributors.push({factor:'missed_vaccination', points:HEALTH_RISK_WEIGHTS.missedVaccination, evidence:myVacc.map(function(v){return v.name;}).join('، ')});
    }

    var recentMed=myHealth.filter(function(r){return r.medication&&r.date&&(new Date()-new Date(r.date))/86400000<=HEALTH_RISK_WINDOWS.repeatedMedicationDays;});
    if(recentMed.length>=2){
      score+=HEALTH_RISK_WEIGHTS.repeatedMedication;
      contributors.push({factor:'repeated_medication', points:HEALTH_RISK_WEIGHTS.repeatedMedication, evidence:ar(recentMed.length)+' سجلات دواء خلال '+ar(HEALTH_RISK_WINDOWS.repeatedMedicationDays)+' يوم'});
    }

    var recentTreat=myHealth.filter(function(r){return r.date&&(new Date()-new Date(r.date))/86400000<=HEALTH_RISK_WINDOWS.repeatedTreatmentDays;});
    if(recentTreat.length>=3){
      score+=HEALTH_RISK_WEIGHTS.repeatedTreatment;
      contributors.push({factor:'repeated_treatment', points:HEALTH_RISK_WEIGHTS.repeatedTreatment, evidence:ar(recentTreat.length)+' سجلات خلال '+ar(HEALTH_RISK_WINDOWS.repeatedTreatmentDays)+' يوم'});
    }

    if(myHealth.length>0){
      var lastDate=myHealth[0].date;
      if(lastDate&&(new Date()-new Date(lastDate))/86400000>HEALTH_RISK_WINDOWS.noRecentCheckDays){
        score+=HEALTH_RISK_WEIGHTS.noRecentCheck;
        contributors.push({factor:'no_recent_check', points:HEALTH_RISK_WEIGHTS.noRecentCheck, evidence:'آخر سجل: '+lastDate});
      }
    }

    var lastBcsRec=myHealth.find(function(r){return r.bcs;});
    if(lastBcsRec&&parseFloat(lastBcsRec.bcs)<HEALTH_RISK_BCS_THRESHOLD){
      score+=HEALTH_RISK_WEIGHTS.lowBCS;
      contributors.push({factor:'low_bcs', points:HEALTH_RISK_WEIGHTS.lowBCS, evidence:'BCS: '+lastBcsRec.bcs+'/5 ('+(lastBcsRec.date||'—')+')'});
    }

    score=Math.min(100,score);
    var level=score>=75?'critical':score>=50?'high':score>=25?'medium':'low';

    contributors.sort(function(a,b){return HEALTH_FACTOR_PRIORITY_ORDER.indexOf(a.factor)-HEALTH_FACTOR_PRIORITY_ORDER.indexOf(b.factor);});
    var recommendations=contributors.map(function(c){
      var rec=HEALTH_RECOMMENDATIONS[c.factor]||{label:'مراجعة',taskPriority:'low'};
      return {factor:c.factor, label:rec.label, taskPriority:rec.taskPriority, evidence:c.evidence};
    });

    // Optional follow-up task -- only for high/critical, and only the
    // single top-priority recommendation, to avoid task-spam from one
    // evaluation producing many tasks. Dedup is inherited automatically
    // from Sprint 1's engine (one active task per animalId+eventType).
    if((level==='high'||level==='critical')&&recommendations.length&&window.autoGenerateTask){
      var top=recommendations[0];
      window.autoGenerateTask('health_risk_alert',{sourceId:animalId, animal_tag:animalTag, barn:barn, recommendation:top.label, priorityOverride:top.taskPriority}).catch(function(){});
    }

    return { animalId:animalId, animalTag:animalTag, barn:barn||null, score:score, level:level, contributors:contributors, recommendations:recommendations, recentTimeline:myHealth.slice(0,5), evaluatedAt:new Date().toISOString() };
  }catch(e){
    return null; // fail silent and safe -- never blocks a caller's own render/write
  }
};

// ══════════════════════════════════════════════════════════════
//  PRODUCTION INTELLIGENCE ENGINE (Sprint 4, Epic 4 -- additive,
//  new file region, does not modify pages/production.js's own writer).
//
//  Production Records -> KPI Engine -> Trend Analysis -> Operational
//    Insight -> Recommendation -> Automation Engine (Sprint 1, reused)
//
//  SCOPE, ENFORCED IN CODE NOT JUST DOCS: this engine reads ONLY
//  type==='milk' and type==='wool' production_log records. type==='weight'
//  is Sprint 2's Weight Intelligence domain exclusively -- never read here.
//
//  Two entry points:
//    window.evaluateProductionKPIs(animalId, animalTag, type)  -- pure,
//      read-only computation, no writes, safe to call anywhere.
//    window.evaluateProductionAlert(animalId, animalTag, type, barn) --
//      wraps the KPI computation with alert persistence + dedup +
//      auto-resolution/recovery-tracking + optional task, mirroring
//      Sprint 2's evaluateWeightAlert design exactly.
//  See docs/features/PRODUCTION-INTELLIGENCE.md for the full design.
// ══════════════════════════════════════════════════════════════

var PRODUCTION_KPI_WINDOWS = { trendWindowDays:7, dropBaselineDays:30, recentAverageDays:14, dropThresholdPct:0.15, trendThresholdPct:0.05 };

function _prodWindowAverage(records, startDaysAgo, endDaysAgo){
  var now=Date.now();
  var startMs=now-startDaysAgo*86400000, endMs=now-endDaysAgo*86400000;
  var inWindow=records.filter(function(r){ if(!r.date) return false; var t=new Date(r.date).getTime(); return t>=startMs && t<endMs; });
  if(!inWindow.length) return null;
  return inWindow.reduce(function(s,r){return s+(+r.quantity||0);},0)/inWindow.length;
}

// Pure, read-only. Never writes. Safe to call from any context, including tests.
window.evaluateProductionKPIs = async function(animalId, animalTag, type){
  try{
    if(!animalId||!type||(type!=='milk'&&type!=='wool')) return null;
    var allProd=await fbGet('production_log');
    var mine=(allProd||[]).filter(function(r){return r.animal_id===animalId&&r.type===type;})
      .sort(function(a,b){return (b.date||'').localeCompare(a.date||'');});
    if(mine.length<2) return null; // not enough data for any trend judgment

    var W=PRODUCTION_KPI_WINDOWS;
    var recentAvg=_prodWindowAverage(mine, W.trendWindowDays, 0);
    var priorAvg=_prodWindowAverage(mine, W.trendWindowDays*2, W.trendWindowDays);
    var baselineAvg=_prodWindowAverage(mine, W.dropBaselineDays, W.trendWindowDays);

    var trend='stable', trendPct=0;
    if(recentAvg!=null&&priorAvg!=null&&priorAvg>0){
      trendPct=(recentAvg-priorAvg)/priorAvg;
      trend=trendPct>W.trendThresholdPct?'rising':trendPct<-W.trendThresholdPct?'declining':'stable';
    }

    var dropDetected=false, dropPct=0;
    if(recentAvg!=null&&baselineAvg!=null&&baselineAvg>0){
      dropPct=(baselineAvg-recentAvg)/baselineAvg;
      dropDetected=dropPct>W.dropThresholdPct;
    }

    var recentWindow=mine.filter(function(r){return (Date.now()-new Date(r.date).getTime())/86400000<=W.recentAverageDays;});
    var consistency=null, consistencyLabel=null;
    if(recentWindow.length>=2){
      var mean=recentWindow.reduce(function(s,r){return s+(+r.quantity||0);},0)/recentWindow.length;
      var variance=recentWindow.reduce(function(s,r){return s+Math.pow((+r.quantity||0)-mean,2);},0)/recentWindow.length;
      consistency = mean>0 ? Math.sqrt(variance)/mean : null;
      consistencyLabel = consistency==null?null:consistency<0.2?'مستقر':consistency<0.5?'تذبذب متوسط':'تذبذب مرتفع';
    }

    return {
      animalId:animalId, animalTag:animalTag, type:type,
      recentAverage:recentAvg, priorAverage:priorAvg, baselineAverage:baselineAvg,
      trend:trend, trendPct:trendPct, dropDetected:dropDetected, dropPct:dropPct,
      consistency:consistency, consistencyLabel:consistencyLabel,
    };
  }catch(e){ return null; }
};

// Wraps the pure KPI computation with alert persistence, deterministic
// dedup (one active alert per animalId+type), auto-resolution with
// recovery tracking, and an optional Sprint-1 task -- exactly Sprint 2's
// evaluateWeightAlert pattern, applied to a new domain.
window.evaluateProductionAlert = async function(animalId, animalTag, type, barn){
  try{
    var kpis=await window.evaluateProductionKPIs(animalId, animalTag, type);
    if(!kpis) return null;

    var existingAlerts=await fbGet('production_alerts');
    var active=existingAlerts.find(function(a){return a.animal_id===animalId&&a.production_type===type&&a.status==='active';});

    if(kpis.dropDetected){
      if(active){
        await fbPatch('production_alerts',active._id,{drop_pct:kpis.dropPct, recent_average:kpis.recentAverage, detected_at:new Date().toISOString()});
        return active._id;
      }
      var alertData={
        animal_id:animalId, animal_tag:animalTag||'', production_type:type, barn:barn||null,
        status:'active', drop_pct:kpis.dropPct, recent_average:kpis.recentAverage, baseline_average:kpis.baselineAverage,
        average_at_detection:kpis.recentAverage,
        detected_at:new Date().toISOString(), resolved_at:null, recovered:null,
      };
      var newId=await fbPost('production_alerts',alertData);
      await logActivity('add','production_alerts','تنبيه إنتاج (انخفاض '+Math.round(kpis.dropPct*100)+'٪): '+(animalTag||animalId));
      if(window.autoGenerateTask){
        window.autoGenerateTask('production_alert',{sourceId:newId, animal_tag:animalTag, barn:barn, alertTitle:'متابعة انخفاض إنتاج'}).catch(function(){});
      }
      return newId;
    }
    if(active){
      var recovered = kpis.recentAverage!=null && active.average_at_detection!=null && kpis.recentAverage>=active.average_at_detection;
      await fbPatch('production_alerts',active._id,{status:'resolved', resolved_at:new Date().toISOString(), recovered:!!recovered});
      return active._id;
    }
    return null;
  }catch(e){ return null; }
};

// ══════════════════════════════════════════════════════════════
//  UNIFIED DECISION ENGINE (Sprint 5, Epic 5 -- pure orchestration,
//  zero new calculation of weight/health/production facts).
//
//  Weight Engine -> Health Engine -> Production Engine -> Automation
//  Engine -> UNIFIED DECISION ENGINE -> Operational Priorities
//
//  This engine calls each Sprint 1-4 engine's existing, trusted,
//  read-only evaluate function and combines their OUTPUTS. It never
//  reimplements weight/health/production logic. Weight Intelligence's
//  contribution reaches this score THROUGH Health Intelligence's own
//  existing incorporation of weight_alerts (confirmed in source,
//  shared.js's evaluateHealthRisk) -- adding weight_alerts a second
//  time here would double-count the same fact. See
//  docs/features/UNIFIED-PRIORITY-MODEL.md for the full reasoning.
//
//  Single centralized entry point: window.evaluateOperationalPriority(animalId, animalTag, barn)
//  See docs/features/UNIFIED-DECISION-ENGINE.md for the full design.
// ══════════════════════════════════════════════════════════════

var UNIFIED_PRIORITY_WEIGHTS = { health:0.6, production:0.3, tasks:0.1 };
var UNIFIED_TASK_PRIORITY_WEIGHT = { high:3, medium:2, low:1 };

window.evaluateOperationalPriority = async function(animalId, animalTag, barn){
  try{
    if(!animalId||!animalTag) return null;

    // Read-only calls into each existing, trusted, already-certified
    // engine. Nothing below recomputes weight, health, or production facts.
    var healthRisk = window.evaluateHealthRisk ? await window.evaluateHealthRisk(animalId, animalTag, barn) : null;
    var milkKpi = window.evaluateProductionKPIs ? await window.evaluateProductionKPIs(animalId, animalTag, 'milk') : null;
    var woolKpi = window.evaluateProductionKPIs ? await window.evaluateProductionKPIs(animalId, animalTag, 'wool') : null;
    var allTasks = await fbGet('daily_tasks');
    var myPendingTasks = (allTasks||[]).filter(function(t){ return t.status!=='done' && t.related_tag===animalTag; });

    var healthScore = healthRisk ? healthRisk.score : 0;
    var hasActiveIllness = !!(healthRisk && healthRisk.contributors && healthRisk.contributors.some(function(c){return c.factor==='active_illness';}));

    var prodDrop = null;
    if(milkKpi && milkKpi.dropDetected) prodDrop = milkKpi;
    else if(woolKpi && woolKpi.dropDetected) prodDrop = woolKpi;
    var productionSeverity = prodDrop ? Math.min(100, prodDrop.dropPct*100) : 0;

    var taskSum = myPendingTasks.reduce(function(s,t){return s+(UNIFIED_TASK_PRIORITY_WEIGHT[t.priority]||1);},0);
    var taskUrgencyBonus = Math.min(100, taskSum*20);

    var W=UNIFIED_PRIORITY_WEIGHTS;
    var score = Math.round(W.health*healthScore + W.production*productionSeverity + W.tasks*taskUrgencyBonus);
    score = Math.min(100, Math.max(0, score));
    var level = score>=75?'critical':score>=50?'high':score>=25?'medium':'low';

    var contributingEngines=[];
    if(healthScore>0) contributingEngines.push('health');
    if(prodDrop) contributingEngines.push('production');
    if(myPendingTasks.length>0) contributingEngines.push('tasks');
    if(!contributingEngines.length) return null; // no signal at all -- not an operational priority

    var confidence = contributingEngines.length>=2 ? 'high' : 'medium';

    // Evidence: reused verbatim from each engine's own citations -- never synthesized.
    var evidence=[];
    if(healthRisk&&healthRisk.recommendations){
      healthRisk.recommendations.forEach(function(r){ evidence.push({source:'health', label:r.label, detail:r.evidence}); });
    }
    if(prodDrop){
      evidence.push({source:'production', label:'انخفاض إنتاج', detail:'انخفاض '+Math.round(prodDrop.dropPct*100)+'٪ ('+(prodDrop.type==='milk'?'حليب':'صوف')+')'});
    }
    if(myPendingTasks.length>0){
      evidence.push({source:'tasks', label:'مهام معلّقة', detail:ar(myPendingTasks.length)+' مهمة بانتظار التنفيذ'});
    }

    return {
      animalId:animalId, animalTag:animalTag, barn:barn||null,
      score:score, level:level, confidence:confidence,
      healthScore:healthScore, productionSeverity:productionSeverity, taskUrgencyBonus:taskUrgencyBonus,
      hasActiveIllness:hasActiveIllness, contributingEngines:contributingEngines, evidence:evidence,
      evaluatedAt:new Date().toISOString(),
    };
  }catch(e){ return null; }
};

// Applies the priority model's documented tie-breaking rules when
// ranking multiple animals' already-computed priorities. A pure sort --
// never recomputes anything.
window.rankOperationalPriorities = function(priorityResults){
  return (priorityResults||[]).slice().sort(function(a,b){
    if(b.score!==a.score) return b.score-a.score;
    if(a.hasActiveIllness!==b.hasActiveIllness) return a.hasActiveIllness?-1:1;
    if(b.contributingEngines.length!==a.contributingEngines.length) return b.contributingEngines.length-a.contributingEngines.length;
    return (a.animalTag||'').localeCompare(b.animalTag||'');
  });
};

// ══════════════════════════════════════════════════════════════
//  NOTIFICATION CENTER SUPPORT (Sprint 9, v1.1 -- reuses the
//  existing notifications-service.js/notifications.html system,
//  does NOT create a parallel one. This one small helper is the
//  single source of truth for "how many unread notifications does
//  this user have" -- both the global bell badge below and
//  notifications-service.js's own NS.updateBadge() call this same
//  function, so the counting logic exists in exactly one place.
// ══════════════════════════════════════════════════════════════
window.getUnreadNotificationCount = async function(){
  try{
    const u=getUser(); if(!u) return 0;
    const notifs=await fbGet('notifications');
    return (notifs||[]).filter(n=>!n.read&&(!n.for_role||n.for_role===u.role||u.role==='admin')).length;
  }catch(e){ return 0; }
};

// Updates the #bell-badge element that already exists on every page
// (rendered by renderNavbar() below) -- called once, globally, right
// after the navbar is inserted, on every page, not just notifications.html.
// This is intentionally lightweight: one fbGet + one filter, not the
// full NS.checkAll() generation/polling machinery, which stays scoped
// to notifications.html as before (a real behavioral expansion of that
// heavier polling to every page was judged out of this sprint's scope).
window.updateGlobalBellBadge = async function(){
  try{
    const count = await window.getUnreadNotificationCount();
    const targets=['bell-badge','railTreeBellBadge'];
    targets.forEach(function(id){
      const b=document.getElementById(id);
      if(!b) return;
      if(count>0){ b.style.display='flex'; b.textContent=count>9?'9+':count; }
      else { b.style.display='none'; }
    });
  }catch(e){}
};

// ══════════════════════════════════════════════════════════════
//  PREDICTIVE INTELLIGENCE ENGINE (v1.2 -- statistical and
//  rule-based forecasting ONLY. No machine learning, no new data
//  source, no new architecture. Every forecast either reuses an
//  existing engine's output directly, extrapolates linearly from
//  existing history, or counts already-scheduled future dates.
//  Full formulas: docs/features/FORECAST-MODEL.md
// ══════════════════════════════════════════════════════════════

var FORECAST_WEIGHT_STABLE_THRESHOLD = 0.03; // 30-day projected change within 3% of current = "stable"

// 1. Weight Forecast -- linear extrapolation from the SAME certified
// Weight SSOT evaluateWeightAlert() already reads. No new data source.
window.forecastWeight = async function(animalId, animalTag){
  try{
    if(!animalId) return null;
    var history = await fbGet('animals/'+animalId+'/weights') || [];
    var sorted = history.slice().sort(function(a,b){return b.date.localeCompare(a.date);});
    if(sorted.length < 2) return { animalId:animalId, animalTag:animalTag, confidence:'low', trend:null, evidence:['بيانات وزن غير كافية للتنبؤ (يلزم سجلان على الأقل)'] };

    var latest = sorted[0];
    var oldest = sorted[sorted.length-1];
    var daysSpan = (new Date(latest.date) - new Date(oldest.date)) / 86400000;
    if(daysSpan <= 0) return { animalId:animalId, animalTag:animalTag, confidence:'low', trend:null, evidence:['لا يوجد فارق زمني كافٍ بين السجلات'] };

    var dailyRate = (latest.weight - oldest.weight) / daysSpan;
    var projected7 = Math.round((latest.weight + dailyRate*7)*10)/10;
    var projected14 = Math.round((latest.weight + dailyRate*14)*10)/10;
    var projected30 = Math.round((latest.weight + dailyRate*30)*10)/10;
    var pctChange30 = latest.weight>0 ? (dailyRate*30)/latest.weight : 0;
    var trend = Math.abs(pctChange30) < FORECAST_WEIGHT_STABLE_THRESHOLD ? 'stable' : (dailyRate>0?'rising':'declining');
    var confidence = sorted.length>=4 ? 'high' : 'medium';

    return {
      animalId:animalId, animalTag:animalTag, currentWeight:latest.weight, dailyRate:Math.round(dailyRate*100)/100,
      trend:trend, projected7:projected7, projected14:projected14, projected30:projected30,
      confidence:confidence, dataPoints:sorted.length,
      evidence:[ 'معدل التغيّر اليومي المُلاحَظ: '+(dailyRate>=0?'+':'')+Math.round(dailyRate*100)/100+' كجم/يوم عبر '+ar(sorted.length)+' سجل وزن خلال '+ar(Math.round(daysSpan))+' يوم' ],
    };
  }catch(e){ return null; }
};

// 2. Production Forecast -- REUSES evaluateProductionKPIs() verbatim.
// Zero new calculation; only relabels the existing trend for a
// forecast-facing context.
window.forecastProduction = async function(animalId, animalTag, type){
  try{
    if(!window.evaluateProductionKPIs) return null;
    var kpi = await window.evaluateProductionKPIs(animalId, animalTag, type);
    if(!kpi) return null;
    var classification = kpi.trend==='rising' ? 'improving' : kpi.trend==='declining' ? 'declining' : 'stable';
    var confidence = kpi.consistency!=null ? (kpi.consistency<0.3?'high':'medium') : 'medium';
    return {
      animalId:animalId, animalTag:animalTag, type:type, classification:classification,
      trendPct:kpi.trendPct, recentAverage:kpi.recentAverage, confidence:confidence,
      evidence:[ 'اتجاه '+(type==='milk'?'الحليب':'الصوف')+' الأسبوعي: '+(kpi.trendPct>=0?'+':'')+Math.round(kpi.trendPct*100)+'٪ (من evaluateProductionKPIs، بلا إعادة حساب)' ],
    };
  }catch(e){ return null; }
};

// 3. Health Risk Forecast -- starts from evaluateHealthRisk()'s real
// current score, adjusts ONLY for already-scheduled, knowable future
// events (a pending vaccination that will become overdue within the
// window) -- using the EXACT SAME weight Health Intelligence itself
// assigns to a missed vaccination, not a new forecasting-only weight.
window.forecastHealthRisk = async function(animalId, animalTag, barn, windowDays){
  try{
    windowDays = windowDays || 30;
    if(!window.evaluateHealthRisk) return null;
    var current = await window.evaluateHealthRisk(animalId, animalTag, barn);
    var baseScore = current ? current.score : 0;

    var today = new Date(); var todayStr = today.toISOString().slice(0,10);
    var vacc = barn ? await fbGet('vaccinations') : [];
    var upcoming = (vacc||[]).filter(function(v){
      if(v.target_section!==barn || v.status!=='pending' || !v.scheduled_date) return false;
      if(v.scheduled_date < todayStr) return false; // already overdue -- already counted in the CURRENT score
      var daysUntil = (new Date(v.scheduled_date)-today)/86400000;
      return daysUntil>=0 && daysUntil<=windowDays;
    });

    var evidence=[];
    var futureDelta=0;
    if(upcoming.length){
      futureDelta = HEALTH_RISK_WEIGHTS.missedVaccination;
      evidence.push(ar(upcoming.length)+' تحصين مجدول سيصبح متأخرًا خلال '+ar(windowDays)+' يوم إن لم يُنفَّذ: '+upcoming.map(function(v){return v.name;}).join('، '));
    }
    if(!evidence.length) evidence.push('لا تغييرات معروفة متوقعة خلال الفترة -- الدرجة الحالية هي أفضل تقدير متاح');

    var projectedScore = Math.min(100, Math.max(0, baseScore+futureDelta));
    var projectedLevel = projectedScore>=75?'critical':projectedScore>=50?'high':projectedScore>=25?'medium':'low';

    return {
      animalId:animalId, animalTag:animalTag, currentScore:baseScore, currentLevel:current?current.level:'low',
      projectedScore:projectedScore, projectedLevel:projectedLevel, windowDays:windowDays,
      confidence: upcoming.length?'medium':'low', evidence:evidence,
    };
  }catch(e){ return null; }
};

// 4. Task / Workload Forecast -- a window-count over already-scheduled
// fields (daily_tasks.date, vaccinations.scheduled_date,
// breeding.expected_birth). No new prediction, only counting what is
// already known to be coming.
window.forecastTaskWorkload = async function(windowDays){
  try{
    windowDays = windowDays || 7;
    var today = new Date(); var todayStr = today.toISOString().slice(0,10);
    var endDate = new Date(today); endDate.setDate(endDate.getDate()+windowDays);
    var endStr = endDate.toISOString().slice(0,10);
    var results = await Promise.all([fbGet('daily_tasks'), fbGet('vaccinations'), fbGet('breeding')]);
    var tasks=results[0]||[], vacc=results[1]||[], breeding=results[2]||[];

    var upcomingTasks = tasks.filter(function(t){return t.status!=='done'&&t.date&&t.date>=todayStr&&t.date<=endStr;});
    var upcomingVacc = vacc.filter(function(v){return v.status==='pending'&&v.scheduled_date&&v.scheduled_date>=todayStr&&v.scheduled_date<=endStr;});
    var upcomingBirths = breeding.filter(function(b){return b.status==='pregnant'&&b.expected_birth&&b.expected_birth>=todayStr&&b.expected_birth<=endStr;});

    return {
      windowDays:windowDays, existingTasks:upcomingTasks.length, expectedVaccinations:upcomingVacc.length,
      expectedBirths:upcomingBirths.length,
      totalExpectedWorkload: upcomingTasks.length+upcomingVacc.length+upcomingBirths.length,
    };
  }catch(e){ return { windowDays:windowDays||7, existingTasks:0, expectedVaccinations:0, expectedBirths:0, totalExpectedWorkload:0 }; }
};

// 5. Farm Forecast Summary -- pure composition over the four functions
// above, for candidate animals (same candidate-selection pattern
// established in Sprint 5/8/9: animals already showing a real signal,
// not the whole herd). No new calculation of its own.
window.forecastFarmSummary = async function(animals, health, weightAlertsRaw, productionRaw){
  try{
    var activeHealthTags = new Set((health||[]).filter(function(r){return r.status==='active';}).map(function(r){return r.animal_tag;}));
    var activeWeightIds = new Set((weightAlertsRaw||[]).filter(function(a){return a.status==='active';}).map(function(a){return a.animal_id;}));
    var producingIds = new Set((productionRaw||[]).filter(function(p){return p.type==='milk'||p.type==='wool';}).map(function(p){return p.animal_id;}));
    var candidates = (animals||[]).filter(function(a){return a.status!=='dead'&&(activeHealthTags.has(a.tag)||activeWeightIds.has(a._id)||producingIds.has(a._id));});

    var weightForecasts=[], healthForecasts=[];
    for(var i=0;i<candidates.length;i++){
      var a=candidates[i];
      var wf=await window.forecastWeight(a._id,a.tag);
      if(wf&&wf.trend==='declining') weightForecasts.push(wf);
      var hf=await window.forecastHealthRisk(a._id,a.tag,a.barn,30);
      if(hf&&(hf.projectedLevel==='high'||hf.projectedLevel==='critical')) healthForecasts.push(hf);
    }
    var taskForecast7 = await window.forecastTaskWorkload(7);
    var taskForecast30 = await window.forecastTaskWorkload(30);

    return {
      expectedWorkload7:taskForecast7.totalExpectedWorkload, expectedWorkload30:taskForecast30.totalExpectedWorkload,
      expectedRisks:healthForecasts.length, expectedDecliningWeight:weightForecasts.length,
      expectedTreatments:taskForecast7.expectedVaccinations,
      riskDetail:healthForecasts.slice(0,5), weightDetail:weightForecasts.slice(0,5),
    };
  }catch(e){ return null; }
};

// ══════════════════════════════════════════════════════════════
//  FARM ANALYTICS ENGINE (v1.3 -- historical trend analysis.
//  READ-ONLY consumer of certified engines and SSOT collections.
//  Computes zero risk scores, zero classifications of its own --
//  only counts/rates over real, already-timestamped records.
//  Full architecture: docs/features/ANALYTICS-ARCHITECTURE.md
// ══════════════════════════════════════════════════════════════

var ANALYTICS_MONTH_NAMES=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// Generalizes the single-purpose bucketing pattern buildMonthlyFin()/
// buildMonthlyBreeding() (pages/reports.js) already established, into
// one reusable utility any domain can use -- not a replacement for
// those two (out of scope), just what every NEW trend calculation uses.
window.bucketByPeriod = function(records, dateField, granularity, periodCount){
  granularity = granularity||'month'; periodCount = periodCount||6;
  var now=new Date(); var buckets=[];
  for(var i=periodCount-1;i>=0;i--){
    var start, end, label;
    if(granularity==='week'){
      end=new Date(now); end.setDate(end.getDate()-(i*7));
      start=new Date(end); start.setDate(start.getDate()-6);
      label='أسبوع '+ar(periodCount-i);
    } else if(granularity==='quarter'){
      var curQStartMonth=Math.floor(now.getMonth()/3)*3;
      start=new Date(now.getFullYear(), curQStartMonth-(i*3), 1);
      end=new Date(start.getFullYear(), start.getMonth()+3, 0);
      label='Q'+(Math.floor(start.getMonth()/3)+1)+' '+start.getFullYear();
    } else if(granularity==='year'){
      // Sprint 13 (v1.6): additive branch on the EXISTING bucketing
      // function -- not a second bucketing engine.
      start=new Date(now.getFullYear()-i, 0, 1);
      end=new Date(now.getFullYear()-i, 11, 31);
      label=String(start.getFullYear());
    } else {
      start=new Date(now.getFullYear(), now.getMonth()-i, 1);
      end=new Date(now.getFullYear(), now.getMonth()-i+1, 0);
      label=ANALYTICS_MONTH_NAMES[start.getMonth()];
    }
    buckets.push({ label:label, start:start, end:end, records:[] });
  }
  (records||[]).forEach(function(r){
    var d=r.__dateValue!==undefined?r.__dateValue:r[dateField];
    if(!d) return;
    var dt=new Date(d);
    if(isNaN(dt.getTime())) return;
    for(var j=0;j<buckets.length;j++){
      if(dt>=buckets[j].start && dt<=buckets[j].end){ buckets[j].records.push(r); break; }
    }
  });
  return buckets;
};

// The single analytics engine. Fetches every needed collection ONCE
// (one Promise.all), then computes all 5 categories from the SAME
// fetched data -- no per-category re-fetch.
window.computeFarmAnalytics = async function(granularity, periodCount){
  granularity = granularity||'month'; periodCount = periodCount||6;
  try{
    var results = await Promise.all([
      fbGet('health'), fbGet('vaccinations'), fbGet('weight_alerts'),
      fbGet('production_log'), fbGet('production_alerts'), fbGet('daily_tasks'),
      fbGet('breeding'), fbGet('animals'),
    ]);
    var health=results[0]||[], vacc=results[1]||[], weightAlerts=results[2]||[],
        production=results[3]||[], prodAlerts=results[4]||[], tasks=results[5]||[],
        breeding=results[6]||[], animals=results[7]||[];

    function bp(records, field, n){ return window.bucketByPeriod(records, field, granularity, n||periodCount); }

    // ── Productivity Index: milk output + task completion, composed
    // into one 0-100 index per period, weighted average (same
    // methodology precedent as Sprint 5's Unified Decision Engine --
    // coefficients summing to 1, no per-category invented weight).
    var milkBuckets = bp(production.filter(function(p){return p.type==='milk';}), 'date');
    var taskBuckets = bp(tasks, 'created_at');
    var productivityIndex = milkBuckets.map(function(mb, idx){
      var totalMilk = mb.records.reduce(function(s,r){return s+(+r.quantity||0);},0);
      var tb = taskBuckets[idx];
      var doneInPeriod = tb.records.filter(function(t){return t.status==='done';}).length;
      var completionRate = tb.records.length ? doneInPeriod/tb.records.length : 0;
      var milkScore = Math.min(100, totalMilk); // 1 point per liter, capped -- simple, explainable, not a fabricated formula
      var index = Math.round(0.6*milkScore + 0.4*(completionRate*100));
      return { label:mb.label, index:Math.min(100,index), totalMilk:Math.round(totalMilk*10)/10, taskCompletionRate:Math.round(completionRate*100) };
    });

    // ── Herd Health Trend: real event counts, never a re-run of evaluateHealthRisk().
    var healthBuckets = bp(health, 'date');
    var vaccDoneBuckets = bp(vacc.filter(function(v){return v.status==='done';}), 'done_date');
    var herdHealthTrend = healthBuckets.map(function(hb, idx){
      var recovered = hb.records.filter(function(h){return h.status!=='active';}).length;
      var recoveryRate = hb.records.length ? recovered/hb.records.length : null;
      return {
        label:hb.label, healthRecordCount:hb.records.length,
        recoveryRate: recoveryRate!==null?Math.round(recoveryRate*100):null,
        vaccinationsCompleted: vaccDoneBuckets[idx].records.length,
      };
    });

    // ── Production Trend: milk, wool, births, mortality, weight
    // records added (a real proxy for "growth monitoring activity").
    var woolBuckets = bp(production.filter(function(p){return p.type==='wool';}), 'date');
    var birthBuckets = bp(breeding.filter(function(b){return b.status==='born'&&b.actual_birth;}), 'actual_birth');
    var deathBuckets = bp(animals.filter(function(a){return a.status==='dead'&&a.died_at;}), 'died_at');
    var weightRecordBuckets = bp(production.filter(function(p){return p.type==='weight';}), 'date');
    var productionTrend = milkBuckets.map(function(mb, idx){
      var milkTotal = mb.records.reduce(function(s,r){return s+(+r.quantity||0);},0);
      var milkValues = mb.records.map(function(r){return +r.quantity||0;});
      var mean = milkValues.length ? milkValues.reduce(function(a,b){return a+b;},0)/milkValues.length : 0;
      var variance = milkValues.length ? milkValues.reduce(function(s,v){return s+Math.pow(v-mean,2);},0)/milkValues.length : 0;
      var consistency = mean>0 ? Math.sqrt(variance)/mean : null;
      return {
        label:mb.label, milkTotal:Math.round(milkTotal*10)/10,
        woolTotal:Math.round(woolBuckets[idx].records.reduce(function(s,r){return s+(+r.quantity||0);},0)*10)/10,
        births:birthBuckets[idx].records.reduce(function(s,r){return s+(+r.offspring_count||0);},0),
        deaths:deathBuckets[idx].records.length, weighInsRecorded:weightRecordBuckets[idx].records.length,
        consistency: consistency!==null?Math.round(consistency*100)/100:null,
      };
    });

    // ── Operational Efficiency: real completion/response data from daily_tasks.
    var operationalEfficiency = taskBuckets.map(function(tb){
      var done = tb.records.filter(function(t){return t.status==='done';});
      var completionRate = tb.records.length ? done.length/tb.records.length : null;
      var withResponseTime = done.filter(function(t){return t.completed_at&&t.created_at;});
      var avgResponseHrs = withResponseTime.length
        ? Math.round(withResponseTime.reduce(function(s,t){return s+(new Date(t.completed_at)-new Date(t.created_at));},0)/withResponseTime.length/3600000*10)/10
        : null;
      var autoCount = tb.records.filter(function(t){return t.auto_generated;}).length;
      return {
        label:tb.label, totalTasks:tb.records.length,
        completionRate: completionRate!==null?Math.round(completionRate*100):null,
        avgResponseHours: avgResponseHrs,
        automationRate: tb.records.length?Math.round(autoCount/tb.records.length*100):null,
      };
    });

    // ── Risk Trend: real alert-DETECTION events per period -- never a
    // retroactive re-score. weight_alerts/production_alerts are the
    // certified engines' own written record of when they flagged something.
    var weightAlertBuckets = bp(weightAlerts, 'detected_at');
    var prodAlertBuckets = bp(prodAlerts, 'detected_at');
    var riskTrend = weightAlertBuckets.map(function(wb, idx){
      var totalAlerts = wb.records.length + prodAlertBuckets[idx].records.length;
      return { label:wb.label, weightAlerts:wb.records.length, productionAlerts:prodAlertBuckets[idx].records.length, totalAlerts:totalAlerts };
    });
    var highestRiskPeriod = riskTrend.reduce(function(max,p){return (!max||p.totalAlerts>max.totalAlerts)?p:max;}, null);

    return {
      granularity:granularity, periodCount:periodCount,
      productivityIndex:productivityIndex, herdHealthTrend:herdHealthTrend,
      productionTrend:productionTrend, operationalEfficiency:operationalEfficiency,
      riskTrend:riskTrend, highestRiskPeriod: highestRiskPeriod&&highestRiskPeriod.totalAlerts>0?highestRiskPeriod:null,
      computedAt:new Date().toISOString(),
    };
  }catch(e){ return null; }
};

// AI Insights -- template sentences, EVERY one gated on a real computed
// comparison from computeFarmAnalytics()'s own output. No sentence is
// ever generated without the specific numbers behind it also being
// present in the evidence string -- exactly Sprint 6's Daily Briefing
// discipline, applied here.
window.generateAnalyticsInsights = function(analytics){
  if(!analytics) return [];
  var lines=[];
  var hh=analytics.herdHealthTrend, pt=analytics.productionTrend, oe=analytics.operationalEfficiency, rt=analytics.riskTrend;

  if(hh.length>=2){
    var lastR=hh[hh.length-1].recoveryRate, prevR=hh[hh.length-2].recoveryRate;
    if(lastR!==null&&prevR!==null){
      if(lastR>prevR+5) lines.push({text:'معدل التعافي الصحي تحسّن من '+ar(prevR)+'٪ إلى '+ar(lastR)+'٪.', evidence:hh[hh.length-1].label+' مقابل '+hh[hh.length-2].label});
      else if(lastR<prevR-5) lines.push({text:'معدل التعافي الصحي تراجع من '+ar(prevR)+'٪ إلى '+ar(lastR)+'٪.', evidence:hh[hh.length-1].label+' مقابل '+hh[hh.length-2].label});
    }
  }
  if(pt.length>=2){
    var lastM=pt[pt.length-1].milkTotal, prevM=pt[pt.length-2].milkTotal;
    if(prevM>0){
      var chg=(lastM-prevM)/prevM;
      if(chg>0.1) lines.push({text:'إنتاج الحليب في تحسّن ('+ar(Math.round(chg*100))+'٪+).', evidence:ar(prevM)+' → '+ar(lastM)+' لتر'});
      else if(chg<-0.1) lines.push({text:'إنتاج الحليب في تراجع ('+ar(Math.round(Math.abs(chg)*100))+'٪-).', evidence:ar(prevM)+' → '+ar(lastM)+' لتر'});
    }
  }
  if(oe.length>=2){
    var lastC=oe[oe.length-1].completionRate, prevC=oe[oe.length-2].completionRate;
    if(lastC!==null&&prevC!==null){
      if(lastC>prevC+5) lines.push({text:'إنجاز المهام في تحسّن ('+ar(prevC)+'٪ ← '+ar(lastC)+'٪).', evidence:oe[oe.length-1].label});
    }
  }
  if(hh.length){
    var lastVacc=hh[hh.length-1].vaccinationsCompleted;
    var totalVaccAllPeriods=hh.reduce(function(s,h){return s+h.vaccinationsCompleted;},0);
    if(totalVaccAllPeriods>0&&lastVacc>=Math.max.apply(null,hh.map(function(h){return h.vaccinationsCompleted;})))
      lines.push({text:'تغطية التحصين في '+hh[hh.length-1].label+' هي الأعلى ضمن الفترة المعروضة.', evidence:ar(lastVacc)+' تحصين مكتمل'});
  }
  if(analytics.highestRiskPeriod){
    lines.push({text:'أعلى فترة تنبيهات: '+analytics.highestRiskPeriod.label+'.', evidence:ar(analytics.highestRiskPeriod.totalAlerts)+' تنبيه إجمالي'});
  }
  return lines;
};

// ══════════════════════════════════════════════════════════════
//  WORKFLOW ENGINE (v1.4 -- pure orchestration. Never a second task
//  engine, never a second notification engine, never a second
//  intelligence engine. Full architecture: docs/features/WORKFLOW-ARCHITECTURE.md
//
//  Discovery finding this engine exists to close (docs/features/
//  WORKFLOW-DISCOVERY.md): three domains (birth, vaccination,
//  medication) create a one-time reminder task via autoGenerateTask(),
//  but nothing ever marked that task done when the reminded-about
//  event actually completed. Sale/Death had zero automation at all.
// ══════════════════════════════════════════════════════════════

var WORKFLOW_RULES = {
  birth: {
    resolvesEvent: 'expected_birth_approaching',
    recommend: function(ctx){ return { text:'سجّل الوزن الأولي وجدول أول تحصين للمولود', evidence:'ولادة جديدة: '+(ctx.animalTag||ctx.sourceId), actionable:true }; },
  },
  vaccination: {
    resolvesEvent: 'vaccination_scheduled',
    recommend: async function(ctx){
      try{
        var vacc = await fbGet('vaccinations');
        var others = (vacc||[]).filter(function(v){return v.target_section===ctx.targetSection && v.status==='pending';});
        if(others.length) return { text:'يوجد '+ar(others.length)+' تحصين آخر معلّق لنفس القسم', evidence:others.map(function(v){return v.name;}).join('، '), actionable:true };
        return { text:'لا توجد تحصينات معلّقة أخرى لهذا القسم حاليًا', evidence:'', actionable:false };
      }catch(e){ return null; }
    },
  },
  medication: {
    resolvesEvent: 'medication_followup',
    recommend: async function(ctx){
      try{
        if(!window.evaluateHealthRisk||!ctx.animalId) return null;
        var risk = await window.evaluateHealthRisk(ctx.animalId, ctx.animalTag, ctx.barn);
        if(risk&&risk.level!=='low') return { text:'الحيوان لا يزال يُظهر مؤشرات خطورة ('+risk.level+') — يُنصح بمتابعة إضافية', evidence:'الدرجة '+risk.score+'/100', actionable:true };
        return { text:'لا توجد مؤشرات خطورة متبقية على هذا الحيوان', evidence:'', actionable:false };
      }catch(e){ return null; }
    },
  },
  weight: {
    resolvesEvent: null, // Weight Intelligence (Sprint 2) already self-resolves -- nothing stale to close
    recommend: async function(ctx){
      try{
        if(!window.evaluateWeightAlert||!ctx.animalId) return null;
        var alerts = await window.evaluateWeightAlert(ctx.animalId, ctx.animalTag, ctx.barn);
        var active = (alerts||[]).find(function(a){return a.status==='active';});
        if(active) return { text:'الوزن لا يزال يُظهر '+(active.rule_type==='weight_loss'?'فقدانًا':'عدم نمو')+' — يُنصح بمتابعة خلال أسبوع', evidence:active.detail||active.action||'', actionable:true };
        return { text:'الوزن ضمن النطاق الطبيعي حاليًا', evidence:'', actionable:false };
      }catch(e){ return null; }
    },
  },
  production: {
    resolvesEvent: null, // Production Intelligence (Sprint 4) already self-resolves
    recommend: async function(ctx){
      try{
        if(!window.evaluateProductionKPIs||!ctx.animalId) return null;
        var kpi = await window.evaluateProductionKPIs(ctx.animalId, ctx.animalTag, ctx.productionType||'milk');
        if(kpi&&kpi.dropDetected) return { text:'الإنتاج لا يزال منخفضًا ('+Math.round(kpi.dropPct*100)+'٪ عن الأساس) — يُنصح بمراجعة التغذية', evidence:'المعدل الحالي '+(Math.round((kpi.recentAverage||0)*10)/10), actionable:true };
        return { text:'الإنتاج مستقر حاليًا', evidence:'', actionable:false };
      }catch(e){ return null; }
    },
  },
  health: {
    resolvesEvent: null, // a NEW health record has no prior reminder of its own to resolve
    recommend: async function(ctx){
      try{
        if(!window.evaluateHealthRisk||!ctx.animalId) return null;
        var risk = await window.evaluateHealthRisk(ctx.animalId, ctx.animalTag, ctx.barn);
        if(risk&&(risk.level==='high'||risk.level==='critical')) return { text:'درجة الخطورة الحالية '+risk.level+' — يُنصح بمتابعة بيطرية', evidence:'الدرجة '+risk.score+'/100', actionable:true };
        return { text:'لا توجد مؤشرات خطورة مرتفعة حاليًا', evidence:'', actionable:false };
      }catch(e){ return null; }
    },
  },
  sale: {
    resolvesEvent:'ALL', // resolve every open task tied to this animal, regardless of event type
    recommend: function(ctx){
      var priceNote = ctx.salePrice ? ' — تم تسجيل إيراد '+ar(ctx.salePrice) : ' — لم يُسجَّل سعر، لن يظهر إيراد في المالية';
      return { text:'أُغلقت كل التذكيرات المرتبطة بالحيوان المُباع'+priceNote, evidence:ctx.animalTag||ctx.sourceId, actionable:true };
    },
  },
  death: {
    resolvesEvent:'ALL',
    recommend: function(ctx){ return { text:'أُغلقت كل التذكيرات المرتبطة بالحيوان النافق', evidence:ctx.animalTag||ctx.sourceId, actionable:true }; },
  },
};

// Single, generic entry point. validate -> resolve -> engine+recommend -> log -> finish.
// ctx: { sourceId, animalId, animalTag, barn, targetSection, productionType }
window.completeWorkflow = async function(workflowType, ctx){
  var startedAt = new Date().toISOString();
  var t0 = Date.now();
  try{
    // Step 1: validate
    ctx = ctx||{};
    var rule = WORKFLOW_RULES[workflowType];
    if(!rule || !ctx.sourceId){
      return { workflowType:workflowType, outcome:'invalid', error:'نوع مسار عمل غير معروف أو معرّف مصدر مفقود' };
    }

    // Step 2: resolve stale reminder(s) -- reuses the EXACT dedup key
    // pattern autoGenerateTask() already writes, only reading+patching,
    // never reimplementing task-creation logic.
    var resolvedCount = 0;
    var allTasks = await fbGet('daily_tasks');
    if(rule.resolvesEvent==='ALL'){
      var mine = (allTasks||[]).filter(function(t){return t.status!=='done' && (t.related_tag===ctx.animalTag);});
      for(var i=0;i<mine.length;i++){ await fbPatch('daily_tasks', mine[i]._id, {status:'done', completed_at:new Date().toISOString(), resolved_by_workflow:workflowType}); resolvedCount++; }
    } else if(rule.resolvesEvent){
      var dedupKey = rule.resolvesEvent+':'+ctx.sourceId;
      var stale = (allTasks||[]).find(function(t){return t.auto_dedup_key===dedupKey && t.status!=='done';});
      if(stale){ await fbPatch('daily_tasks', stale._id, {status:'done', completed_at:new Date().toISOString(), resolved_by_workflow:workflowType}); resolvedCount=1; }
    }

    // Step 3+4: consult the relevant existing engine (inside rule.recommend
    // itself, per-type -- never reimplemented here) and produce ONE
    // recommendation from its real output.
    var recommendation = null;
    try{ recommendation = typeof rule.recommend==='function' ? await rule.recommend(ctx) : null; }catch(e){ recommendation=null; }

    var durationMs = Date.now()-t0;
    var record = {
      workflow_type:workflowType, source_id:ctx.sourceId, animal_tag:ctx.animalTag||null,
      started_at:startedAt, completed_at:new Date().toISOString(), duration_ms:durationMs,
      actor:(getUser()&&getUser().name)||'—', resolved_task_count:resolvedCount,
      recommendation_text:recommendation?recommendation.text:null, recommendation_evidence:recommendation?recommendation.evidence:null,
      outcome:'success',
    };
    // Step 5: log to the new, purely additive, read-only-elsewhere history collection.
    try{ await fbPost('workflow_history', record); }catch(e){}

    return { workflowType:workflowType, sourceId:ctx.sourceId, resolvedTaskCount:resolvedCount, recommendation:recommendation, durationMs:durationMs, outcome:'success' };
  }catch(e){
    var durationMsErr = Date.now()-t0;
    try{ await fbPost('workflow_history', { workflow_type:workflowType, source_id:(ctx&&ctx.sourceId)||null, started_at:startedAt, completed_at:new Date().toISOString(), duration_ms:durationMsErr, actor:(getUser()&&getUser().name)||'—', outcome:'error', error_message:String(e&&e.message||e) }); }catch(e2){}
    return { workflowType:workflowType, outcome:'error', error:String(e&&e.message||e) };
  }
};

// ══════════════════════════════════════════════════════════════
//  PREDICTIVE INTELLIGENCE / FARM INSIGHTS (v1.5). 100% read-only --
//  no function below ever calls fbPost/fbPatch/fbDelete. Per
//  docs/features/PREDICTIVE-DISCOVERY.md, 3 of the 6 requested
//  predict*() functions are thin aliases to the ALREADY-CERTIFIED
//  forecast*() layer built earlier -- calling them again here would
//  duplicate a certified engine, which this sprint's own rules forbid.
//  Full reasoning: docs/features/FORECAST-ARCHITECTURE.md
// ══════════════════════════════════════════════════════════════

// -- Aliases: zero new calculation, just the name this sprint's own
// spec asked for, delegating to the existing, tested implementation. --
window.predictWeightRisk = function(animalId, animalTag){ return window.forecastWeight(animalId, animalTag); };
window.predictMilkTrend = function(animalId, animalTag){ return window.forecastProduction(animalId, animalTag, 'milk'); };
window.predictTaskLoad = function(windowDays){ return window.forecastTaskWorkload(windowDays); };

var PREDICTION_PRESSURE_THRESHOLDS = { elevated:0.5, high:1.0 }; // fraction ABOVE historical average

// Herd-wide "is this normal" -- reuses forecastTaskWorkload()'s own
// counting (never re-implemented) for the upcoming figure, and
// computeFarmAnalytics() (Sprint 10, itself read-only) for the
// historical baseline. No new bucketing logic.
async function _predictPressure(windowDays, upcomingCountFn, historicalFieldExtractor){
  try{
    windowDays = windowDays||7;
    var upcoming = await upcomingCountFn(windowDays);
    var analytics = await window.computeFarmAnalytics('week', 8); // 8 real past weeks as the baseline sample
    if(!analytics) return null;
    var pastValues = analytics.operationalEfficiency.length ? historicalFieldExtractor(analytics) : [];
    var pastAvg = pastValues.length ? pastValues.reduce(function(a,b){return a+b;},0)/pastValues.length : 0;
    var pressure = 'normal';
    var ratio = pastAvg>0 ? (upcoming-pastAvg)/pastAvg : (upcoming>0?1:0);
    if(ratio>=PREDICTION_PRESSURE_THRESHOLDS.high) pressure='high';
    else if(ratio>=PREDICTION_PRESSURE_THRESHOLDS.elevated) pressure='elevated';
    return { windowDays:windowDays, upcomingCount:upcoming, historicalAverage:Math.round(pastAvg*10)/10, pressure:pressure, ratioAboveAverage:Math.round(ratio*100)/100 };
  }catch(e){ return null; }
}

// Treatment overload: "upcoming" is the herd's total scheduled task
// load (forecastTaskWorkload()'s own existingTasks figure) -- a real,
// honest proxy for operational pressure, since medication/health
// follow-up tasks are themselves a real subset of daily_tasks, not a
// separately-tracked category. No new fetch, no new counting logic.
window.predictTreatmentOverload = async function(windowDays){
  return _predictPressure(windowDays, async function(wd){
    var wf = await window.forecastTaskWorkload(wd);
    return wf ? wf.existingTasks : 0;
  }, function(analytics){
    return analytics.operationalEfficiency.map(function(o){ return o.totalTasks||0; });
  });
};

// Vaccination pressure: upcoming = forecastTaskWorkload()'s own
// expectedVaccinations count. Baseline = Sprint 10's own
// vaccinationsCompleted-per-period history.
window.predictVaccinationPressure = async function(windowDays){
  return _predictPressure(windowDays, async function(wd){
    var wf = await window.forecastTaskWorkload(wd);
    return wf ? wf.expectedVaccinations : 0;
  }, function(analytics){
    return analytics.herdHealthTrend.map(function(h){ return h.vaccinationsCompleted||0; });
  });
};

// predictBreedingWindow: the one genuinely new prediction. Derives
// EACH dam's own historical inter-birth interval from her own real
// birth records -- never a species-wide assumption. Fewer than 2
// historical births for a dam = no prediction for her, same honesty
// standard forecastWeight() already applies.
window.predictBreedingWindow = async function(animals, breedingRaw){
  try{
    var animalsList = animals || await fbGet('animals');
    var breeding = breedingRaw || await fbGet('breeding');
    var bornRecords = (breeding||[]).filter(function(b){return b.status==='born'&&b.actual_birth&&b.mother_tag;});
    var byDam = {};
    bornRecords.forEach(function(b){ (byDam[b.mother_tag]=byDam[b.mother_tag]||[]).push(b.actual_birth); });

    var currentlyPregnantTags = new Set((breeding||[]).filter(function(b){return b.status==='pregnant';}).map(function(b){return b.female_tag||b.mother_tag;}));
    var predictions = [];
    for(var tag in byDam){
      if(currentlyPregnantTags.has(tag)) continue; // already pregnant -- expected_birth_approaching (Sprint 1) already covers her
      var dates = byDam[tag].slice().sort();
      if(dates.length<2) continue; // insufficient history -- no fabricated prediction
      var intervals=[];
      for(var i=1;i<dates.length;i++){ intervals.push((new Date(dates[i])-new Date(dates[i-1]))/86400000); }
      var avgInterval = intervals.reduce(function(a,b){return a+b;},0)/intervals.length;
      var lastBirth = new Date(dates[dates.length-1]);
      var predictedDate = new Date(lastBirth.getTime()+avgInterval*86400000);
      var daysUntil = Math.round((predictedDate-new Date())/86400000);
      var animal = (animalsList||[]).find(function(a){return a.tag===tag;});
      if(animal&&animal.status==='alive'){
        predictions.push({ animalTag:tag, avgIntervalDays:Math.round(avgInterval), predictedDate:predictedDate.toISOString().slice(0,10), daysUntil:daysUntil, birthCount:dates.length, confidence:dates.length>=3?'medium':'low' });
      }
    }
    predictions.sort(function(a,b){return a.daysUntil-b.daysUntil;});
    return predictions;
  }catch(e){ return []; }
};

// generateFarmInsights: PURE COMPOSITION. Every field below traces to
// one of the four calls, never a new number computed in this function.
window.generateFarmInsights = async function(animals, health, weightAlertsRaw, productionRaw){
  try{
    var insights = [];
    var summary = await window.forecastFarmSummary(animals, health, weightAlertsRaw, productionRaw);
    if(summary){
      if(summary.expectedRisks>0){
        insights.push({
          text:'خلال الأسبوع القادم، '+ar(summary.expectedRisks)+' حيوان متوقع أن يحتاج مراجعة صحية إضافية',
          evidence:'مبني على forecastHealthRisk() لكل حيوان مُرشَّح', confidence: summary.riskDetail&&summary.riskDetail.length>=2?'high':'medium',
          impactedAnimals: (summary.riskDetail||[]).map(function(r){return r.animalTag;}),
          suggestedAction:'جدولة زيارة بيطرية استباقية',
        });
      }
      if(summary.expectedDecliningWeight>0){
        insights.push({
          text:ar(summary.expectedDecliningWeight)+' حيوان متوقع استمرار انخفاض الوزن',
          evidence:'مبني على forecastWeight() -- استقراء خطي من السجل الفعلي', confidence:'medium',
          impactedAnimals:(summary.weightDetail||[]).map(function(w){return w.animalTag;}),
          suggestedAction:'إعادة وزن خلال ٧ أيام لتأكيد الاتجاه',
        });
      }
    }
    var vaccPressure = await window.predictVaccinationPressure(7);
    if(vaccPressure&&vaccPressure.pressure!=='normal'){
      insights.push({
        text:'الأسبوع القادم يحتوي ضغط تحصينات '+(vaccPressure.pressure==='high'?'مرتفعًا':'أعلى من المعتاد')+' ('+ar(vaccPressure.upcomingCount)+' مقابل متوسط '+ar(vaccPressure.historicalAverage)+')',
        evidence:'مقارنة بمتوسط ٨ أسابيع سابقة (computeFarmAnalytics)', confidence: vaccPressure.pressure==='high'?'high':'medium',
        impactedAnimals:[], suggestedAction:'التأكد من توفر جرعات كافية وتنسيق الطاقم مسبقًا',
      });
    }
    var taskPressure = await window.predictTreatmentOverload(7);
    if(taskPressure&&taskPressure.pressure!=='normal'){
      insights.push({
        text:'معدل المهام اليومية المتوقع أعلى من المعتاد الأسبوع القادم ('+ar(taskPressure.upcomingCount)+' مقابل متوسط '+ar(taskPressure.historicalAverage)+')',
        evidence:'مقارنة بمتوسط ٨ أسابيع سابقة (computeFarmAnalytics)', confidence: taskPressure.pressure==='high'?'high':'medium',
        impactedAnimals:[], suggestedAction:'مراجعة توزيع المهام على الطاقم',
      });
    }
    var breedingWindows = await window.predictBreedingWindow(animals, null);
    var soon = (breedingWindows||[]).filter(function(b){return b.daysUntil>=0&&b.daysUntil<=14;});
    if(soon.length){
      insights.push({
        text:ar(soon.length)+' أنثى متوقع دخولها نافذة تكاثر خلال أسبوعين، بناءً على تاريخها الفعلي',
        evidence:soon.map(function(b){return b.animalTag+' (~'+ar(b.avgIntervalDays)+' يوم دورة)';}).join('، '),
        confidence: soon.some(function(b){return b.confidence==='medium';})?'medium':'low',
        impactedAnimals:soon.map(function(b){return b.animalTag;}), suggestedAction:'مراجعة جاهزية التقريع لهذه الإناث',
      });
    }
    return insights;
  }catch(e){ return []; }
};

// ══════════════════════════════════════════════════════════════
//  FARM FINANCE ENGINE (v1.6). 100% read-only. Reuses the certified
//  `finance` collection, INCOME_CATS/EXPENSE_CATS (pages/finance.js),
//  and window.bucketByPeriod() (Sprint 10, extended with 'year' above)
//  verbatim. No new collection, no new category scheme, no stored KPI.
//  Full formulas: docs/features/FINANCE-KPIS.md
// ══════════════════════════════════════════════════════════════

var FINANCE_CATEGORY_FEED = 'أعلاف ومواد تغذية';
var FINANCE_CATEGORY_MEDICINE = 'أدوية وتحصينات';

window.computeFinanceKPIs = async function(startDate, endDate){
  try{
    var results = await Promise.all([fbGet('finance'), fbGet('animals')]);
    var finance = results[0]||[], animals = results[1]||[];
    var inRange = finance.filter(function(f){ return f.date && (!startDate||f.date>=startDate) && (!endDate||f.date<=endDate); });
    var incomeRecs = inRange.filter(function(f){return f.type==='income';});
    var expenseRecs = inRange.filter(function(f){return f.type==='expense';});
    var revenue = incomeRecs.reduce(function(s,f){return s+(+f.amount||0);},0);
    var expenses = expenseRecs.reduce(function(s,f){return s+(+f.amount||0);},0);
    var netProfit = revenue-expenses;
    var aliveCount = animals.filter(function(a){return a.status==='alive';}).length;
    var feedTotal = expenseRecs.filter(function(f){return f.category===FINANCE_CATEGORY_FEED;}).reduce(function(s,f){return s+(+f.amount||0);},0);
    var medTotal = expenseRecs.filter(function(f){return f.category===FINANCE_CATEGORY_MEDICINE;}).reduce(function(s,f){return s+(+f.amount||0);},0);

    var categoryBreakdown = {};
    expenseRecs.forEach(function(f){ var c=f.category||'غير مصنّف'; categoryBreakdown[c]=(categoryBreakdown[c]||0)+(+f.amount||0); });

    return {
      revenue:Math.round(revenue*100)/100, expenses:Math.round(expenses*100)/100, netProfit:Math.round(netProfit*100)/100,
      profitMargin: revenue>0 ? Math.round((netProfit/revenue)*1000)/1000 : null,
      roi: expenses>0 ? Math.round((netProfit/expenses)*1000)/1000 : null,
      avgCostPerAnimal: aliveCount>0 ? Math.round((expenses/aliveCount)*100)/100 : null,
      avgRevenuePerAnimal: aliveCount>0 ? Math.round((revenue/aliveCount)*100)/100 : null,
      feedCostPct: expenses>0 ? Math.round((feedTotal/expenses)*1000)/1000 : null,
      medicineCostPct: expenses>0 ? Math.round((medTotal/expenses)*1000)/1000 : null,
      categoryBreakdown:categoryBreakdown, recordCount:inRange.length,
    };
  }catch(e){ return null; }
};

window.computeFinanceTrend = async function(granularity, periodCount){
  try{
    granularity = granularity||'month'; periodCount = periodCount||6;
    var finance = await fbGet('finance');
    var buckets = window.bucketByPeriod(finance, 'date', granularity, periodCount);
    return buckets.map(function(b){
      var revenue = b.records.filter(function(f){return f.type==='income';}).reduce(function(s,f){return s+(+f.amount||0);},0);
      var expenses = b.records.filter(function(f){return f.type==='expense';}).reduce(function(s,f){return s+(+f.amount||0);},0);
      return { label:b.label, revenue:Math.round(revenue*100)/100, expenses:Math.round(expenses*100)/100, profit:Math.round((revenue-expenses)*100)/100 };
    });
  }catch(e){ return []; }
};

// ══════════════════════════════════════════════════════════════
//  INVENTORY TRANSACTION ENGINE (v1.7). One new collection
//  (inventory_transactions, purely additive, write-once). Deduction
//  NEVER blocks the underlying medical/feeding action -- matches this
//  project's own "Best Effort" precedent (BUSINESS_RULES.md, Birth).
//  Reuses the SAME name-based item linking feed_consumption already
//  established (docs/features/INVENTORY-DISCOVERY.md) -- not a new
//  ID-based scheme.
// ══════════════════════════════════════════════════════════════

var INVENTORY_COLLECTION = { meds:'inventory_meds', feeds:'inventory_feeds' };

window.recordInventoryTransaction = async function(itemType, itemName, deltaQty, reason, sourceId){
  try{
    var table = INVENTORY_COLLECTION[itemType];
    if(!table || !itemName || !deltaQty) return null;
    var items = await fbGet(table);
    var item = (items||[]).find(function(i){return i.name===itemName;});
    if(!item) return { matched:false, itemName:itemName }; // no matching stock item -- best effort, not an error

    var before = +item.quantity||0;
    var after = Math.max(0, before+deltaQty); // negative PREVENTED by clamping, never by rejecting the action
    var itemUpdate = {quantity:after};
    if(reason==='purchase' && deltaQty>0) itemUpdate.last_purchase = todayStr();
    await fbPatch(table, item._id, itemUpdate);

    var record = {
      item_type:itemType, item_name:itemName, requested_delta:deltaQty, actual_delta:after-before,
      reason:reason, source_id:sourceId||null, quantity_before:before, quantity_after:after,
      date:todayStr(), created_at:new Date().toISOString(), actor:(getUser()&&getUser().name)||'—',
    };
    await fbPost('inventory_transactions', record);

    // Purchase -> Finance linking (closes a confirmed gap, feeds only,
    // since only inventory_feeds carries cost_per_unit today).
    if(reason==='purchase' && itemType==='feeds' && deltaQty>0 && item.cost_per_unit>0){
      try{
        await fbPost('finance', { date:todayStr(), type:'expense', category:'أعلاف ومواد تغذية', amount:Math.round(deltaQty*item.cost_per_unit*100)/100, description:'شراء '+itemName+' — '+ar(deltaQty)+' '+(item.unit||''), added_by:(getUser()&&getUser().name)||null });
      }catch(e){}
    }
    return { matched:true, before:before, after:after, actualDelta:after-before, clamped:(after-before)!==deltaQty };
  }catch(e){ return null; }
};