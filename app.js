'use strict';
// =====================================================
// FARM MANAGEMENT SYSTEM — app.js
// =====================================================

// ---- 1. ARABIC UTILS ----
const AR = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
const ar = n => String(n).replace(/\d/g, d => AR[+d]);
const pad2ar = n => ar(String(n).padStart(2,'0').replace(/0/g,'٠'));
function todayAr() {
  const d = new Date();
  return `${ar(d.getFullYear())}/${pad2ar(d.getMonth()+1)}/${pad2ar(d.getDate())}`;
}
const todayStr = () => new Date().toISOString().slice(0,10);

// ---- 2. TOAST ----
function toast(msg, type='success') {
  const el = document.createElement('div');
  el.className = `farm-toast t-${type}`;
  const ico = type==='success'?'check-circle-fill':type==='error'?'x-circle-fill':'info-circle-fill';
  el.innerHTML = `<i class="bi bi-${ico}"></i> ${msg}`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; }, 2800);
  setTimeout(()=>{ el.remove(); }, 3300);
}

// ---- 3. SETTINGS ----
const DEFAULT_SETTINGS = {
  farmName:'بيان المزرعة', ownerName:'مدير المزرعة', currency:'ج.م',
  goatBreeds:['شامي','بور','بلدي'], sheepBreeds:['برقي','دوربر','ميت ماستر'],
  pregnancyDays:150, vaccinationAlertDays:7, supabaseUrl:'', supabaseKey:''
};
function getSettings() {
  try { return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('farm_settings')||'null')}; }
  catch { return {...DEFAULT_SETTINGS}; }
}
function saveSettings(s) { localStorage.setItem('farm_settings', JSON.stringify(s)); }

// ---- 4. LOCAL STORES ----
function ls(k) { try { return JSON.parse(localStorage.getItem(k)||'[]'); } catch { return []; } }
function ss(k,v) { localStorage.setItem(k, JSON.stringify(v)); }
function genId() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }

const Breeding = {
  all:()=>ls('farm_breeding'),
  add(r){ ss('farm_breeding',[r,...ls('farm_breeding')]); },
  update(id,p){ ss('farm_breeding',ls('farm_breeding').map(r=>r.id===id?{...r,...p}:r)); },
  del(id){ ss('farm_breeding',ls('farm_breeding').filter(r=>r.id!==id)); }
};
const Health = {
  all:()=>ls('farm_health'),
  add(r){ ss('farm_health',[r,...ls('farm_health')]); },
  update(id,p){ ss('farm_health',ls('farm_health').map(r=>r.id===id?{...r,...p}:r)); },
  del(id){ ss('farm_health',ls('farm_health').filter(r=>r.id!==id)); }
};
const Finance = {
  all:()=>ls('farm_finance'),
  add(r){ ss('farm_finance',[r,...ls('farm_finance')]); },
  del(id){ ss('farm_finance',ls('farm_finance').filter(r=>r.id!==id)); }
};
const Notifs = {
  all:()=>ls('farm_notifs'),
  add(n){ ss('farm_notifs',[n,...ls('farm_notifs')].slice(0,100)); },
  markRead(id){ ss('farm_notifs',ls('farm_notifs').map(n=>n.id===id?{...n,read:true}:n)); },
  markAllRead(){ ss('farm_notifs',ls('farm_notifs').map(n=>({...n,read:true}))); },
  clear(){ ss('farm_notifs',[]); },
  hasId(id){ return ls('farm_notifs').some(n=>n.id===id); }
};

// ---- 5. SUPABASE ----
let sb = null;
function initSB() {
  const s = getSettings();
  if (s.supabaseUrl && s.supabaseKey && window.supabase) {
    try { sb = window.supabase.createClient(s.supabaseUrl, s.supabaseKey); return true; }
    catch(e) { console.error('Supabase init error:', e); return false; }
  }
  return false;
}
async function sbFrom(table) {
  if (!sb) initSB();
  return sb ? sb.from(table) : null;
}

// ---- 6. APP STATE ----
const S = {
  tab: 'dash',
  animals: [],
  vaccinations: [],
  notes: [],
  loading: true,
};

// ---- 7. DATA LOADING ----
async function loadData() {
  S.loading = true;
  renderPage();
  if (!sb && !initSB()) {
    S.loading = false;
    renderPage();
    return;
  }
  try {
    const [a,v,n] = await Promise.all([
      sb.from('animals').select('*').limit(2000),
      sb.from('vaccinations').select('*').order('scheduled_date',{ascending:true}),
      sb.from('notes').select('*').order('created_at')
    ]);
    if(a.data) S.animals = a.data;
    if(v.data) S.vaccinations = v.data;
    if(n.data) S.notes = n.data;
    generateNotifications();
  } catch(e) { console.error(e); toast('خطأ في تحميل البيانات','error'); }
  S.loading = false;
  renderPage();
}

// ---- 8. AUTO NOTIFICATIONS ----
function generateNotifications() {
  const t = todayStr();
  const s = getSettings();
  S.vaccinations.forEach(v => {
    if(v.status==='overdue') {
      const id = `vo-${v.id}`;
      if(!Notifs.hasId(id)) Notifs.add({id,type:'danger',title:'تحصين متأخر',message:`"${v.name}" للقسم ${v.target_section} متأخر عن موعده`,date:t,read:false,src:'vaccination'});
    }
    if(v.status==='pending' && v.scheduled_date) {
      const days = Math.ceil((new Date(v.scheduled_date)-new Date())/86400000);
      if(days>=0 && days<=s.vaccinationAlertDays) {
        const id = `vd-${v.id}-${v.scheduled_date}`;
        if(!Notifs.hasId(id)) Notifs.add({id,type:'warning',title:'موعد تحصين قريب',message:`"${v.name}" بعد ${ar(days)} يوم`,date:t,read:false,src:'vaccination'});
      }
    }
  });
  Breeding.all().filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{
    const days = Math.ceil((new Date(r.expected_birth)-new Date())/86400000);
    if(days>=0 && days<=7) {
      const id = `bd-${r.id}`;
      if(!Notifs.hasId(id)) Notifs.add({id,type:days<=2?'danger':'warning',title:'موعد ولادة قريب',message:`الأنثى ${r.female_tag||r.female_breed} موعد ولادتها بعد ${ar(Math.max(0,days))} يوم`,date:t,read:false,src:'breeding'});
    }
  });
  Health.all().filter(r=>r.status==='active'&&r.withdrawal_end>=t).forEach(r=>{
    const id = `wd-${r.id}`;
    if(!Notifs.hasId(id)) Notifs.add({id,type:'danger',title:'فترة سحب نشطة',message:`${r.animal_tag||r.animal_breed} — لا يباع حتى ${r.withdrawal_end}`,date:t,read:false,src:'health'});
  });
  updateBadge();
}
function updateBadge() {
  const cnt = Notifs.all().filter(n=>!n.read).length;
  const b = document.getElementById('bell-badge');
  if(!b) return;
  if(cnt>0){ b.style.display='flex'; b.textContent=cnt>9?'9+':cnt; }
  else { b.style.display='none'; }
}

// ---- 9. BREED STATS ----
function breedStats(breed) {
  const alive = S.animals.filter(a=>a.status==='alive'&&a.breed===breed);
  const c=(g,p)=>alive.filter(a=>a.gender===g&&a.purpose===p).length;
  return {
    total:alive.length,
    tarbiyaMale:c('male','tarbiya'), tarbiyaFemale:c('female','tarbiya'),
    tasmeenMale:c('male','tasmeen'), tasmeenFemale:c('female','tasmeen'),
    tarbiya:c('male','tarbiya')+c('female','tarbiya'),
    tasmeen:c('male','tasmeen')+c('female','tasmeen'),
  };
}

// ---- 10. SIDEBAR & NAV ----
const PAGES = [
  {id:'dash',icon:'bi-grid-1x2-fill',label:'النظرة العامة',section:'القطيع'},
  {id:'goats',icon:'bi-tropical-storm',label:'قسم الماعز'},
  {id:'sheep',icon:'bi-cloud-fill',label:'قسم الأغنام'},
  {id:'vaccine',icon:'bi-bandaid-fill',label:'التحصين',section:'الصحة'},
  {id:'health',icon:'bi-heart-pulse-fill',label:'السجل الصحي'},
  {id:'breeding',icon:'bi-diagram-2-fill',label:'التكاثر والولادة',section:'الإدارة'},
  {id:'finance',icon:'bi-wallet2',label:'المالية والحسابات'},
  {id:'data',icon:'bi-clipboard-data-fill',label:'الملاحظات والبيانات'},
];
const PAGE_TITLES = {
  dash:'النظرة العامة',goats:'قسم الماعز',sheep:'قسم الأغنام',
  vaccine:'التحصين',health:'السجل الصحي',breeding:'التكاثر والولادة',
  finance:'المالية والحسابات',data:'الملاحظات والبيانات',
  notifications:'الإشعارات',settings:'الإعدادات'
};

function renderSidebar() {
  const s = getSettings();
  document.getElementById('sb-farm-name').textContent = s.farmName;
  document.getElementById('sb-owner').textContent = s.ownerName;
  document.getElementById('sb-avatar').textContent = s.ownerName.slice(0,1);
  const unread = Notifs.all().filter(n=>!n.read).length;
  let html = '';
  PAGES.forEach(p => {
    if(p.section) html += `<div class="sidebar-section-label">${p.section}</div>`;
    html += `<button class="sidebar-item${S.tab===p.id?' active':''}" onclick="switchTab('${p.id}');closeSidebar()">
      <i class="bi ${p.icon}"></i> ${p.label}</button>`;
  });
  html += `<div class="sidebar-divider"></div>
  <button class="sidebar-item${S.tab==='notifications'?' active':''}" onclick="switchTab('notifications');closeSidebar()">
    <i class="bi bi-bell-fill"></i> الإشعارات
    ${unread>0?`<span class="bell-badge" style="position:relative;inset:auto;margin-right:auto">${unread}</span>`:''}
  </button>
  <button class="sidebar-item${S.tab==='settings'?' active':''}" onclick="switchTab('settings');closeSidebar()">
    <i class="bi bi-gear-fill"></i> الإعدادات
  </button>
  <div class="sidebar-divider"></div>
  <button class="sidebar-item" onclick="openAddAnimal();closeSidebar()"><i class="bi bi-plus-circle-fill" style="color:var(--wonder-green)"></i> إضافة حيوان</button>
  <button class="sidebar-item" onclick="openMarkDeath();closeSidebar()"><i class="bi bi-x-octagon-fill" style="color:#f44336"></i> تسجيل نفوق</button>
  <button class="sidebar-item" onclick="exportExcel();closeSidebar()"><i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> تصدير Excel</button>`;
  document.getElementById('sidebar-nav').innerHTML = html;
}

function renderTabs() {
  const tabs = [{id:'dash',label:'الرئيسية'},{id:'goats',label:'ماعز'},{id:'sheep',label:'أغنام'},
    {id:'vaccine',label:'تحصين'},{id:'breeding',label:'تكاثر'},{id:'health',label:'صحة'},
    {id:'finance',label:'مالية'},{id:'data',label:'ملاحظات'}];
  document.getElementById('tab-pills').innerHTML = tabs.map(t=>
    `<li class="nav-item"><button class="nav-link${S.tab===t.id?' active':''}" onclick="switchTab('${t.id}')">${t.label}</button></li>`
  ).join('');
}

function switchTab(id) {
  S.tab = id;
  document.getElementById('page-title-h').textContent = PAGE_TITLES[id]||id;
  const alive = S.animals.filter(a=>a.status==='alive');
  const total = alive.filter(a=>a.purpose!=='birth').length;
  const dead = S.animals.filter(a=>a.status==='dead').length;
  document.getElementById('page-subtitle').innerHTML = `${ar(total)} حيوان إجمالي${dead>0?` <span style="color:#f44336">• ${ar(dead)} نافق</span>`:''}`;
  renderPage();
  renderSidebar();
  renderTabs();
}

// ---- 11. PAGE ROUTER ----
function renderPage() {
  const el = document.getElementById('page-content');
  if(S.loading && sb) { el.innerHTML = `<div class="text-center py-5"><div class="spinner mb-3"></div><div class="text-gray">جاري التحميل...</div></div>`; return; }
  if(!sb) { renderSetupPage(el); return; }
  switch(S.tab) {
    case 'dash':      renderDashboard(el); break;
    case 'goats':     renderSpecies(el,'goat'); break;
    case 'sheep':     renderSpecies(el,'sheep'); break;
    case 'vaccine':   renderVaccinations(el); break;
    case 'breeding':  renderBreeding(el); break;
    case 'health':    renderHealth(el); break;
    case 'finance':   renderFinance(el); break;
    case 'data':      renderDataNotes(el); break;
    case 'notifications': renderNotifications(el); break;
    case 'settings':  renderSettings(el); break;
    default:          renderDashboard(el);
  }
}

// ---- 12. SETUP PAGE (no Supabase configured) ----
function renderSetupPage(el) {
  el.innerHTML = `
  <div class="wonder-card animate-in text-center" style="max-width:480px;margin:40px auto">
    <div style="font-size:3rem;margin-bottom:16px">🐐</div>
    <h4 class="fw-bold mb-2">مرحباً بك في بيان المزرعة</h4>
    <p class="text-gray mb-4">لتفعيل البيانات المباشرة، أدخل بيانات Supabase الخاصة بك في الإعدادات.</p>
    <button class="action-btn primary" onclick="switchTab('settings')"><i class="bi bi-gear-fill"></i> اذهب إلى الإعدادات</button>
  </div>
  <div class="row g-3 mt-2">
    ${[{icon:'bi-tropical-storm',label:'إدارة القطيع',desc:'ماعز وأغنام بكل سلالاتها'},
       {icon:'bi-bandaid-fill',label:'التحصين',desc:'جدول ومتابعة التطعيمات'},
       {icon:'bi-heart-pulse-fill',label:'السجل الصحي',desc:'علاجات وفترات السحب'},
       {icon:'bi-diagram-2-fill',label:'التكاثر',desc:'تسجيل التقريع والولادات'},
       {icon:'bi-wallet2',label:'المالية',desc:'إيرادات ومصروفات المزرعة'},
       {icon:'bi-bell-fill',label:'الإشعارات',desc:'تنبيهات تلقائية ذكية'}].map(f=>`
    <div class="col-md-4 col-6">
      <div class="wonder-card text-center p-3">
        <i class="bi ${f.icon} accent-text d-block mb-2" style="font-size:1.8rem"></i>
        <div class="fw-bold" style="font-size:.9rem">${f.label}</div>
        <small class="text-gray">${f.desc}</small>
      </div>
    </div>`).join('')}
  </div>`;
}

// ---- 13. DASHBOARD ----
function renderDashboard(el) {
  const s = getSettings();
  const alive = S.animals.filter(a=>a.status==='alive');
  const totalGoats = alive.filter(a=>a.species==='goat'&&a.purpose!=='birth').length;
  const totalSheep = alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth').length;
  const goatB = alive.filter(a=>a.species==='goat'&&a.purpose==='birth');
  const sheepB = alive.filter(a=>a.species==='sheep'&&a.purpose==='birth');
  const dead = S.animals.filter(a=>a.status==='dead').length;

  const statsHTML = [
    {label:'إجمالي القطيع',val:totalGoats+totalSheep+goatB.length+sheepB.length,color:'var(--accent-orange)',icon:'bi-bar-chart-fill'},
    {label:'إجمالي الماعز',val:totalGoats,color:'var(--wonder-green)',icon:'bi-tropical-storm'},
    {label:'إجمالي الأغنام',val:totalSheep,color:'var(--blue)',icon:'bi-cloud-fill'},
    {label:'المواليد',val:goatB.length+sheepB.length,color:'var(--yellow)',icon:'bi-stars'},
    {label:'النافق',val:dead,color:'#f44336',icon:'bi-x-octagon-fill'},
  ].map(st=>`<div class="col-6 col-md-4 col-lg animate-in">
    <div class="summary-card"><i class="bi ${st.icon} d-block mb-2" style="font-size:1.4rem;color:${st.color}"></i>
    <div class="summary-number" style="color:${st.color}">${ar(st.val)}</div>
    <small class="text-gray">${st.label}</small></div></div>`).join('');

  const allBreeds = [...s.goatBreeds.map(k=>({k,e:'🐐'})),...s.sheepBreeds.map(k=>({k,e:'🐑'}))];
  const breedsHTML = allBreeds.map(({k,e},i)=>{
    const bs = breedStats(k);
    return `<div class="col-md-4 col-sm-6 animate-in" style="animation-delay:${i*.07}s">
      <div class="breed-card">
        <div class="breed-header"><div class="breed-icon">${e}</div>
        <div><div class="fw-bold">${k}</div><small class="text-gray">إجمالي: ${ar(bs.total)}</small></div></div>
        <div class="row g-2">
          <div class="col-6"><div class="gender-box"><span class="gender-count green-text">${ar(bs.tarbiyaMale)}</span><small class="text-gray">ذكور تربية</small></div></div>
          <div class="col-6"><div class="gender-box"><span class="gender-count green-text">${ar(bs.tarbiyaFemale)}</span><small class="text-gray">إناث تربية</small></div></div>
          ${bs.tasmeenMale+bs.tasmeenFemale>0?`
          <div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenMale)}</span><small class="text-gray">ذكور تسمين</small></div></div>
          <div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenFemale)}</span><small class="text-gray">إناث تسمين</small></div></div>`:''}
        </div>
        <div class="mt-3">${bs.tarbiya>0?`<span class="type-badge badge-tarbiya">تربية ${ar(bs.tarbiya)}</span> `:''}${bs.tasmeen>0?`<span class="type-badge badge-tasmeen">تسمين ${ar(bs.tasmeen)}</span>`:''}</div>
      </div></div>`;
  }).join('');

  const birthsHTML = [
    {title:'ولدات الماعز',b:{total:goatB.length,male:goatB.filter(a=>a.gender==='male').length,female:goatB.filter(a=>a.gender==='female').length}},
    {title:'ولدات الأغنام',b:{total:sheepB.length,male:sheepB.filter(a=>a.gender==='male').length,female:sheepB.filter(a=>a.gender==='female').length}},
  ].map(x=>`<div class="col-md-6">
    <div class="d-flex justify-content-between align-items-center p-3" style="background:rgba(255,255,255,.04);border-radius:14px">
      <div><div class="fw-bold">${x.title}</div><small class="text-gray">الإجمالي: ${ar(x.b.total)}</small></div>
      <div class="d-flex gap-3">
        <div class="text-center"><div class="fw-bold green-text" style="font-size:1.4rem">${ar(x.b.male)}</div><small class="text-gray">ذكور</small></div>
        <div class="text-center"><div class="fw-bold accent-text" style="font-size:1.4rem">${ar(x.b.female)}</div><small class="text-gray">إناث</small></div>
      </div></div></div>`).join('');

  el.innerHTML = `
  <div class="d-flex gap-2 flex-wrap mb-4 animate-in">
    <button class="action-btn primary" onclick="openAddAnimal()"><i class="bi bi-plus-lg"></i> إضافة حيوان</button>
    <button class="action-btn danger" onclick="openMarkDeath()"><i class="bi bi-x-octagon"></i> تسجيل نفوق</button>
    <button class="action-btn" onclick="exportExcel()"><i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> تصدير Excel</button>
  </div>
  <div class="row g-3 mb-4">${statsHTML}</div>
  <h5 class="fw-bold mb-3 animate-in"><i class="bi bi-grid-3x3-gap-fill accent-text"></i> توزيع السلالات</h5>
  <div class="row g-3 mb-4">${breedsHTML}</div>
  <div class="births-section animate-in">
    <h5 class="fw-bold mb-3"><i class="bi bi-stars" style="color:var(--yellow)"></i> الولدات <small class="text-gray fw-normal">— إجمالي: ${ar(goatB.length+sheepB.length)}</small></h5>
    <div class="row g-3">${birthsHTML}</div>
  </div>`;
}

// ---- 14. SPECIES PAGE ----
function renderSpecies(el, species) {
  const s = getSettings();
  const breeds = species==='goat' ? s.goatBreeds : s.sheepBreeds;
  const emoji = species==='goat'?'🐐':'🐑';
  const color = species==='goat'?'var(--wonder-green)':'var(--blue)';
  const alive = S.animals.filter(a=>a.status==='alive');
  const total = alive.filter(a=>a.species===species&&a.purpose!=='birth').length;
  const births = alive.filter(a=>a.species===species&&a.purpose==='birth');
  const sorted = [...breeds].sort((a,b)=>breedStats(b).total-breedStats(a).total);

  const breedsHTML = breeds.map((breed,i)=>{
    const bs = breedStats(breed);
    return `<div class="col-lg-4 col-md-6 animate-in" style="animation-delay:${i*.08}s">
      <div class="breed-card">
        <div class="breed-header"><div class="breed-icon">${emoji}</div>
        <div><div class="fw-bold">${breed}</div><small class="text-gray">إجمالي السلالة</small></div></div>
        <div class="stat-value mb-3" style="color:${color}">${ar(bs.total)}</div>
        <div class="text-gray mb-2 fw-bold" style="font-size:.82rem">تربية (${ar(bs.tarbiya)})</div>
        <div class="row g-2 mb-3">
          <div class="col-6"><div class="gender-box"><span class="gender-count">${ar(bs.tarbiyaMale)}</span><small class="text-gray">ذكور</small></div></div>
          <div class="col-6"><div class="gender-box"><span class="gender-count">${ar(bs.tarbiyaFemale)}</span><small class="text-gray">إناث</small></div></div>
        </div>
        <div class="text-gray mb-2 fw-bold" style="font-size:.82rem">تسمين (${ar(bs.tasmeen)})</div>
        <div class="row g-2">
          <div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenMale)}</span><small class="text-gray">ذكور</small></div></div>
          <div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenFemale)}</span><small class="text-gray">إناث</small></div></div>
        </div>
      </div></div>`;
  }).join('');

  const animalRows = S.animals.filter(a=>a.species===species).slice(0,60).map(a=>`
    <tr>
      <td class="fw-bold">${a.breed}</td>
      <td>${a.gender==='male'?'♂ ذكر':'♀ أنثى'}</td>
      <td><span class="type-badge ${a.purpose==='tasmeen'?'badge-tasmeen':'badge-tarbiya'}">${a.purpose==='tarbiya'?'تربية':a.purpose==='tasmeen'?'تسمين':'مواليد'}</span></td>
      <td>${a.tag||'<span class="text-gray">—</span>'}</td>
      <td><span class="type-badge ${a.status==='alive'?'badge-tarbiya':'badge-danger'}">${a.status==='alive'?'حي':'نافق'}</span></td>
      <td class="text-gray">${(a.created_at||'').slice(0,10)||'—'}</td>
    </tr>`).join('');

  el.innerHTML = `
  <div class="wonder-card animate-in mb-4">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
      <div><div class="text-gray mb-1">${species==='goat'?'إجمالي الماعز':'إجمالي الأغنام'}</div>
      <div class="stat-value" style="color:${color}">${emoji} ${ar(total)}</div></div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="action-btn primary" onclick="openAddAnimal('${species}')"><i class="bi bi-plus-lg"></i> إضافة</button>
        <button class="action-btn danger" onclick="openMarkDeath('${species}')"><i class="bi bi-x-octagon"></i> نفوق</button>
      </div>
    </div>
    ${sorted[0]?`<div class="mt-3"><span class="type-badge badge-tarbiya">السلالة الأكبر: ${sorted[0]} — ${ar(breedStats(sorted[0]).total)}</span></div>`:''}
  </div>
  <div class="row g-3 mb-4">${breedsHTML}</div>
  <div class="births-section mb-4 animate-in">
    <h5 class="fw-bold mb-3">المواليد <small class="text-gray fw-normal">— ${ar(births.length)}</small></h5>
    <div class="row g-3">
      <div class="col-6"><div class="summary-card"><div class="summary-number">${ar(births.filter(a=>a.gender==='male').length)}</div><small class="text-gray">ذكور</small></div></div>
      <div class="col-6"><div class="summary-card"><div class="summary-number accent-text">${ar(births.filter(a=>a.gender==='female').length)}</div><small class="text-gray">إناث</small></div></div>
    </div>
  </div>
  <div class="wonder-card p-0 animate-in">
    <div class="p-3 pb-2 d-flex justify-content-between align-items-center">
      <h6 class="fw-bold mb-0">قائمة الحيوانات <small class="text-gray fw-normal">(آخر ٦٠)</small></h6>
    </div>
    <div class="table-responsive">
      <table class="table table-dark table-bordered mb-0 text-center" style="--bs-border-color:#2a2a2a;font-size:.82rem">
        <thead><tr class="text-gray"><th>السلالة</th><th>الجنس</th><th>الغرض</th><th>الترقيم</th><th>الحالة</th><th>الإضافة</th></tr></thead>
        <tbody>${animalRows||'<tr><td colspan="6" class="text-gray py-4">لا توجد حيوانات</td></tr>'}</tbody>
      </table>
    </div>
  </div>`;
}

// ---- 15. VACCINATIONS ----
let vaccFilter = 'all';
function renderVaccinations(el) {
  const done = S.vaccinations.filter(v=>v.status==='done').reduce((s,v)=>s+v.count,0);
  const pend = S.vaccinations.filter(v=>v.status==='pending').reduce((s,v)=>s+v.count,0);
  const over = S.vaccinations.filter(v=>v.status==='overdue').reduce((s,v)=>s+v.count,0);
  const tot = done+pend+over||1;
  const filtered = vaccFilter==='all'?S.vaccinations:S.vaccinations.filter(v=>v.status===vaccFilter);

  el.innerHTML = `
  <div class="row g-3 mb-4">
    ${[{l:'تم التحصين',v:done,pct:Math.round(done/tot*100),c:'var(--wonder-green)'},{l:'قيد الانتظار',v:pend,pct:Math.round(pend/tot*100),c:'var(--accent-orange)'},{l:'متأخر',v:over,pct:Math.round(over/tot*100),c:'#f44336'}].map(s=>`
    <div class="col-md-4"><div class="summary-card animate-in">
      <div class="summary-number" style="color:${s.c}">${ar(s.v)}</div>
      <div class="text-gray">${s.l}</div><small class="fw-bold" style="color:${s.c}">${ar(s.pct)}٪</small>
    </div></div>`).join('')}
  </div>
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${['all','pending','overdue','done'].map(f=>`<button class="filter-btn${vaccFilter===f?' active':''}" onclick="setVaccFilter('${f}')">${f==='all'?'الكل':f==='done'?'منجز':f==='pending'?'قيد الانتظار':'متأخر'} (${f==='all'?S.vaccinations.length:S.vaccinations.filter(v=>v.status===f).length})</button>`).join('')}
    </div>
    <button class="action-btn primary" onclick="openAddVaccination()"><i class="bi bi-plus-lg"></i> تحصين جديد</button>
  </div>
  ${filtered.length===0?`<div class="empty-state animate-in"><i class="bi bi-bandaid"></i><p>لا توجد تحصينات</p><button class="action-btn primary" onclick="openAddVaccination()"><i class="bi bi-plus-lg"></i> أضف تحصيناً</button></div>`:
  filtered.map(v=>`
  <div class="record-card animate-in">
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
      <div>
        <div class="fw-bold mb-1"><span class="status-dot ${v.status==='done'?'dot-green':v.status==='overdue'?'dot-red':'dot-orange'}"></span>${v.name}</div>
        <small class="text-gray">${v.target_section} • ${ar(v.count)} رأس${v.scheduled_date?` • ${v.scheduled_date}`:''}</small>
      </div>
      <div class="d-flex gap-2 align-items-center flex-wrap">
        <span class="${v.status==='done'?'green-text':v.status==='overdue'?'':'accent-text'} fw-bold" style="${v.status==='overdue'?'color:#f44336':''}">${v.status==='done'?'تم التنفيذ':v.status==='overdue'?'متأخر':'قيد الانتظار'}</span>
        ${v.status!=='done'?`<button class="action-btn primary sm" onclick="markVaccDone('${v.id}')"><i class="bi bi-check-lg"></i> تنفيذ</button>`:''}
        <button class="action-btn sm" onclick="openEditVaccination('${v.id}')"><i class="bi bi-pencil"></i></button>
        <button class="action-btn danger sm" onclick="deleteVaccination('${v.id}')"><i class="bi bi-trash"></i></button>
      </div>
    </div>
    <div class="progress-wonder"><div class="progress-bar-wonder" style="width:${v.progress}%;${v.status==='overdue'?'background:linear-gradient(90deg,#f44336,#ff8a65)':''}"></div></div>
    <small class="text-gray">${ar(v.progress)}٪</small>
  </div>`).join('')}`;
}
window.setVaccFilter = function(f){ vaccFilter=f; renderPage(); };
window.markVaccDone = async function(id){
  if(!sb) return;
  const {error} = await sb.from('vaccinations').update({status:'done',done_date:todayStr(),progress:100}).eq('id',id);
  if(error) toast('فشل التحديث','error'); else { toast('تم تسجيل التحصين كمنجز'); await loadData(); }
};
window.deleteVaccination = async function(id){
  if(!confirm('هل تريد حذف هذا التحصين؟')) return;
  const {error} = await sb.from('vaccinations').delete().eq('id',id);
  if(error) toast('فشل الحذف','error'); else { toast('تم الحذف'); await loadData(); }
};

// ---- 16. BREEDING ----
let breedingFilter = 'all';
const BSTATUS = {pregnant:{l:'حامل',c:'var(--blue)',d:'dot-blue'},born:{l:'ولادة ناجحة',c:'var(--wonder-green)',d:'dot-green'},failed:{l:'إجهاض / فشل',c:'#f44336',d:'dot-red'},pending:{l:'قيد الانتظار',c:'var(--accent-orange)',d:'dot-orange'}};
function renderBreeding(el) {
  const recs = Breeding.all();
  const filtered = breedingFilter==='all'?recs:recs.filter(r=>r.status===breedingFilter);
  const stats = {total:recs.length,pregnant:recs.filter(r=>r.status==='pregnant').length,born:recs.filter(r=>r.status==='born').length,offspring:recs.reduce((s,r)=>s+(r.offspring_count||0),0)};

  el.innerHTML = `
  <div class="row g-3 mb-4">
    ${[{l:'إجمالي السجلات',v:stats.total,c:'var(--accent-orange)'},{l:'حوامل الآن',v:stats.pregnant,c:'var(--blue)'},{l:'ولادات ناجحة',v:stats.born,c:'var(--wonder-green)'},{l:'إجمالي المواليد',v:stats.offspring,c:'var(--yellow)'}].map(s=>`
    <div class="col-6 col-md-3"><div class="summary-card animate-in"><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}
  </div>
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${['all','pending','pregnant','born','failed'].map(f=>`<button class="filter-btn${breedingFilter===f?' active':''}" onclick="setBreedingFilter('${f}')">${f==='all'?'الكل':BSTATUS[f]?.l||f} (${f==='all'?recs.length:recs.filter(r=>r.status===f).length})</button>`).join('')}
    </div>
    <button class="action-btn primary" onclick="openAddBreeding()"><i class="bi bi-plus-lg"></i> تسجيل تقريع</button>
  </div>
  ${filtered.length===0?`<div class="empty-state animate-in"><i class="bi bi-diagram-2"></i><p>لا توجد سجلات تكاثر</p><button class="action-btn primary" onclick="openAddBreeding()"><i class="bi bi-plus-lg"></i> سجّل أول تقريع</button></div>`:
  filtered.map(r=>{
    const st = BSTATUS[r.status];
    const daysLeft = r.expected_birth?Math.ceil((new Date(r.expected_birth)-new Date())/86400000):null;
    return `<div class="record-card animate-in">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <div class="fw-bold mb-1"><span class="status-dot ${st.d}"></span>
          <span class="type-badge ms-1" style="background:${st.c}22;color:${st.c};border:1px solid ${st.c}44">${st.l}</span></div>
          <div class="mb-1"><span class="text-gray">الأنثى:</span> <strong>${r.female_tag||'—'}</strong>
          <span class="text-gray mx-2">|</span><span class="text-gray">الفحل:</span> <strong>${r.male_tag||'—'}</strong></div>
          <small class="text-gray">${r.female_breed||''} • تاريخ التقريع: ${r.mating_date||''}
          ${r.status==='pregnant'&&daysLeft!==null?`<span style="color:${daysLeft<7?'#f44336':'var(--accent-orange)'};margin-right:8px">${daysLeft>0?`متبقي ${ar(daysLeft)} يوم`:'موعد الولادة اليوم!'}</span>`:''}
          ${r.status==='born'&&r.offspring_count?`<span class="green-text" style="margin-right:8px">• ${ar(r.offspring_count)} مواليد</span>`:''}
          </small>
        </div>
        <div class="d-flex gap-2">
          <button class="action-btn sm" onclick="openEditBreeding('${r.id}')"><i class="bi bi-pencil"></i></button>
          <button class="action-btn danger sm" onclick="deleteBreeding('${r.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>
      ${r.notes?`<small class="text-gray d-block mt-2"><i class="bi bi-chat-left-text-fill" style="margin-left:4px"></i>${r.notes}</small>`:''}
    </div>`;
  }).join('')}`;
}
window.setBreedingFilter = f=>{ breedingFilter=f; renderPage(); };
window.deleteBreeding = function(id){ if(!confirm('حذف هذا السجل؟')) return; Breeding.del(id); toast('تم الحذف'); renderPage(); };

// ---- 17. HEALTH ----
let healthFilter = 'all';
function renderHealth(el) {
  const recs = Health.all();
  const t = todayStr();
  const inW = recs.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=t);
  const active = recs.filter(r=>r.status==='active');
  const filtered = healthFilter==='all'?recs:healthFilter==='active'?active:healthFilter==='withdrawal'?inW:recs.filter(r=>r.status==='completed');

  el.innerHTML = `
  <div class="row g-3 mb-4">
    ${[{l:'قيد العلاج',v:active.length,c:'var(--accent-orange)'},{l:'فترة سحب',v:inW.length,c:'#f44336'},{l:'مكتملة',v:recs.filter(r=>r.status==='completed').length,c:'var(--wonder-green)'},{l:'إجمالي',v:recs.length,c:'#9e9e9e'}].map(s=>`
    <div class="col-6 col-md-3"><div class="summary-card animate-in"><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}
  </div>
  ${inW.length>0?`<div class="withdrawal-alert animate-in mb-3">
    <div class="fw-bold mb-2" style="color:#f44336"><i class="bi bi-exclamation-triangle-fill me-2"></i>تحذير: ${ar(inW.length)} حيوان في فترة سحب</div>
    ${inW.map(r=>`<div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
      <span class="type-badge badge-danger">${r.animal_tag||r.animal_breed}</span>
      <small class="text-gray">${r.medication} — ينتهي ${r.withdrawal_end} (${ar(Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000))} يوم)</small>
    </div>`).join('')}
  </div>`:''}
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">
      ${[{f:'all',l:'الكل',cnt:recs.length},{f:'active',l:'قيد العلاج',cnt:active.length},{f:'withdrawal',l:'فترة سحب',cnt:inW.length},{f:'completed',l:'مكتملة',cnt:recs.filter(r=>r.status==='completed').length}].map(x=>`<button class="filter-btn${healthFilter===x.f?' active':''}" onclick="setHealthFilter('${x.f}')">${x.l} (${x.cnt})</button>`).join('')}
    </div>
    <button class="action-btn primary" onclick="openAddHealth()"><i class="bi bi-plus-lg"></i> سجل صحي جديد</button>
  </div>
  ${filtered.length===0?`<div class="empty-state animate-in"><i class="bi bi-heart-pulse"></i><p>لا توجد سجلات</p><button class="action-btn primary" onclick="openAddHealth()"><i class="bi bi-plus-lg"></i> أضف سجلاً</button></div>`:
  filtered.map(r=>{
    const inWithdrawal = r.withdrawal_end&&r.withdrawal_end>=t;
    const wDays = inWithdrawal?Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000):0;
    return `<div class="record-card animate-in">
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div>
          <div class="fw-bold mb-1">
            <span class="type-badge ${r.status==='completed'?'badge-tarbiya':'badge-tasmeen'} me-2">${r.status==='active'?'قيد العلاج':'مكتمل'}</span>
            ${r.animal_tag?`<span class="text-gray" style="font-size:.82rem">${r.animal_tag} — </span>`:''}${r.animal_breed}
          </div>
          <div class="mb-1"><span class="text-gray">التشخيص:</span> <strong>${r.diagnosis}</strong>
          <span class="text-gray mx-2">|</span><span class="text-gray">الدواء:</span> <strong>${r.medication}</strong>${r.dosage?` <span class="text-gray">— ${r.dosage}</span>`:''}</div>
          ${inWithdrawal?`<small style="color:#f44336"><i class="bi bi-exclamation-triangle-fill me-1"></i>فترة السحب: ${ar(r.withdrawal_days)} يوم — ينتهي ${r.withdrawal_end} (متبقي ${ar(wDays)} يوم)</small>`:''}
          <small class="text-gray d-block">${r.date}</small>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          ${r.status==='active'?`<button class="action-btn primary sm" onclick="markHealthDone('${r.id}')"><i class="bi bi-check-lg"></i> إكمال</button>`:''}
          <button class="action-btn sm" onclick="openEditHealth('${r.id}')"><i class="bi bi-pencil"></i></button>
          <button class="action-btn danger sm" onclick="deleteHealth('${r.id}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('')}`;
}
window.setHealthFilter = f=>{ healthFilter=f; renderPage(); };
window.markHealthDone = function(id){ Health.update(id,{status:'completed'}); toast('تم إكمال العلاج'); renderPage(); };
window.deleteHealth = function(id){ if(!confirm('حذف هذا السجل؟')) return; Health.del(id); toast('تم الحذف'); renderPage(); };

// ---- 18. FINANCE ----
let financeFilter = 'all';
let financeMonth = '';
const INCOME_CATS = ['بيع حيوانات','بيع ألبان','بيع صوف','إيراد آخر'];
const EXPENSE_CATS = ['أعلاف','أدوية وبيطرة','عمالة','كهرباء ومياه','معدات','نقل','مصروف آخر'];
function renderFinance(el) {
  const s = getSettings();
  let recs = Finance.all();
  if(financeFilter!=='all') recs = recs.filter(r=>r.type===financeFilter);
  if(financeMonth) recs = recs.filter(r=>r.date.startsWith(financeMonth));
  recs.sort((a,b)=>b.date.localeCompare(a.date));
  const all = Finance.all();
  const totalIncome = all.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const totalExpense = all.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const net = totalIncome - totalExpense;
  const curr = s.currency;

  const byCat = {};
  all.filter(r=>r.type==='expense').forEach(r=>{ byCat[r.category]=(byCat[r.category]||0)+r.amount; });
  const catEntries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);

  const rows = recs.map(r=>`<tr>
    <td class="text-gray">${r.date}</td>
    <td><span class="type-badge ${r.type==='income'?'badge-tarbiya':'badge-tasmeen'}">${r.type==='income'?'إيراد':'مصروف'}</span></td>
    <td>${r.category}</td>
    <td>${r.description||'<span class="text-gray">—</span>'}</td>
    <td class="fw-bold ${r.type==='income'?'green-text':'accent-text'}">${r.type==='income'?'+':'-'}${r.amount.toLocaleString('ar-EG')} ${curr}</td>
    <td><button class="action-btn danger sm" onclick="deleteFinance('${r.id}')"><i class="bi bi-trash"></i></button></td>
  </tr>`).join('');

  el.innerHTML = `
  <div class="row g-3 mb-4">
    <div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number green-text">${totalIncome.toLocaleString('ar-EG')}</div><small class="text-gray">الإيرادات (${curr})</small></div></div>
    <div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number accent-text">${totalExpense.toLocaleString('ar-EG')}</div><small class="text-gray">المصروفات (${curr})</small></div></div>
    <div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number" style="color:${net>=0?'var(--wonder-green)':'#f44336'}">${net>=0?'+':''}${net.toLocaleString('ar-EG')}</div><small class="text-gray">${net>=0?'صافي الربح':'صافي الخسارة'} (${curr})</small></div></div>
  </div>
  ${catEntries.length>0?`<div class="wonder-card mb-4 animate-in">
    <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> توزيع المصروفات</h6>
    ${catEntries.map(([cat,amt])=>{const pct=totalExpense>0?Math.round(amt/totalExpense*100):0;return `<div class="finance-bar-wrap"><div class="label-row"><span class="text-gray">${cat}</span><span class="fw-bold accent-text">${amt.toLocaleString('ar-EG')} ${curr} (${pct}٪)</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${pct}%"></div></div></div>`;}).join('')}
  </div>`:''}
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="d-flex gap-2 flex-wrap align-items-center">
      ${['all','income','expense'].map(f=>`<button class="filter-btn${financeFilter===f?' active':''}" onclick="setFinanceFilter('${f}')">${f==='all'?'الكل':f==='income'?'إيرادات':'مصروفات'}</button>`).join('')}
      <input type="month" value="${financeMonth}" onchange="setFinanceMonth(this.value)" style="background:#1a1a1a;border:1px solid #333;border-radius:10px;padding:6px 12px;color:#e8e8e8;font-size:.82rem;font-family:'Cairo',sans-serif">
    </div>
    <button class="action-btn primary" onclick="openAddFinance()"><i class="bi bi-plus-lg"></i> إضافة معاملة</button>
  </div>
  ${recs.length===0?`<div class="empty-state animate-in"><i class="bi bi-wallet2"></i><p>لا توجد معاملات</p><button class="action-btn primary" onclick="openAddFinance()"><i class="bi bi-plus-lg"></i> أضف أول معاملة</button></div>`:`
  <div class="wonder-card p-0 animate-in">
    <div class="table-responsive">
      <table class="table table-dark table-bordered mb-0 text-center" style="--bs-border-color:#2a2a2a;font-size:.82rem">
        <thead><tr class="text-gray"><th>التاريخ</th><th>النوع</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr style="background:rgba(255,255,255,.03)">
          <td colspan="4" class="fw-bold text-gray">الإجمالي</td>
          <td colspan="2" class="fw-bold">
            <span class="green-text">+${recs.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0).toLocaleString('ar-EG')}</span> / 
            <span class="accent-text">-${recs.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0).toLocaleString('ar-EG')}</span>
          </td>
        </tr></tfoot>
      </table>
    </div>
  </div>`}`;
}
window.setFinanceFilter = f=>{ financeFilter=f; renderPage(); };
window.setFinanceMonth = m=>{ financeMonth=m; renderPage(); };
window.deleteFinance = function(id){ if(!confirm('حذف هذه المعاملة؟')) return; Finance.del(id); toast('تم الحذف'); renderPage(); };

// ---- 19. NOTIFICATIONS ----
function renderNotifications(el) {
  const notifs = Notifs.all();
  const unread = notifs.filter(n=>!n.read).length;
  const TYPE_CFG = {
    danger:{c:'#f44336',ico:'bi-exclamation-triangle-fill'},
    warning:{c:'var(--accent-orange)',ico:'bi-exclamation-circle-fill'},
    info:{c:'var(--blue)',ico:'bi-info-circle-fill'},
    success:{c:'var(--wonder-green)',ico:'bi-check-circle-fill'},
  };
  const SRC = {vaccination:'التحصين',breeding:'التكاثر',health:'الصحة',finance:'المالية',system:'النظام'};

  el.innerHTML = `
  <div class="wonder-card animate-in mb-4">
    <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
      <div><h5 class="fw-bold mb-1"><i class="bi bi-bell-fill accent-text"></i> الإشعارات</h5>
      <small class="text-gray">${unread>0?`<span class="accent-text fw-bold">${ar(unread)} غير مقروء</span>`:'لا توجد إشعارات جديدة'}</small></div>
      <div class="d-flex gap-2">
        ${unread>0?`<button class="action-btn" onclick="markAllNotifs()"><i class="bi bi-check2-all"></i> تحديد الكل كمقروء</button>`:''}
        ${notifs.length>0?`<button class="action-btn danger" onclick="clearAllNotifs()"><i class="bi bi-trash"></i> مسح الكل</button>`:''}
      </div>
    </div>
  </div>
  ${notifs.length===0?`<div class="empty-state animate-in"><i class="bi bi-bell-slash"></i><p>لا توجد إشعارات حالياً</p><small>ستظهر هنا تنبيهات التحصينات والولادات وفترات السحب</small></div>`:
  notifs.map(n=>{
    const cfg = TYPE_CFG[n.type]||TYPE_CFG.info;
    return `<div class="notif-item n-${n.type}${!n.read?' unread':''} animate-in" onclick="readNotif('${n.id}')">
      <div class="d-flex align-items-start gap-3">
        <i class="bi ${cfg.ico} flex-shrink-0 mt-1" style="color:${cfg.c};font-size:1.1rem"></i>
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start">
            <div class="fw-bold mb-1">${n.title}</div>
            <div class="d-flex align-items-center gap-2">
              <span class="type-badge" style="background:${cfg.c}22;color:${cfg.c};border:1px solid ${cfg.c}44;font-size:.65rem">${SRC[n.src]||n.src}</span>
              ${!n.read?`<span style="width:8px;height:8px;border-radius:50%;background:${cfg.c};display:inline-block;flex-shrink:0"></span>`:''}
            </div>
          </div>
          <div class="text-gray" style="font-size:.85rem">${n.message}</div>
          <small class="text-gray" style="font-size:.72rem;opacity:.7">${n.date}</small>
        </div>
      </div>
    </div>`;
  }).join('')}`;
}
window.readNotif = function(id){ Notifs.markRead(id); updateBadge(); renderPage(); };
window.markAllNotifs = function(){ Notifs.markAllRead(); updateBadge(); toast('تم تحديد الكل كمقروء'); renderPage(); };
window.clearAllNotifs = function(){ if(!confirm('مسح جميع الإشعارات؟')) return; Notifs.clear(); updateBadge(); toast('تم المسح'); renderPage(); };

// ---- 20. DATA / NOTES ----
function renderDataNotes(el) {
  const s = getSettings();
  const alive = S.animals.filter(a=>a.status==='alive');
  const sheepNotes = S.notes.filter(n=>n.category==='sheep');
  const goatNotes = S.notes.filter(n=>n.category==='goat');
  const generalNotes = S.notes.filter(n=>n.category==='general');

  const totalGoats = alive.filter(a=>a.species==='goat'&&a.purpose!=='birth').length;
  const totalSheep = alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth').length;
  const goatB = alive.filter(a=>a.species==='goat'&&a.purpose==='birth');
  const sheepB = alive.filter(a=>a.species==='sheep'&&a.purpose==='birth');

  const goatTotals = s.goatBreeds.reduce((acc,b)=>{ const bs=breedStats(b); acc.tm+=bs.tarbiyaMale;acc.tf+=bs.tarbiyaFemale;acc.sm+=bs.tasmeenMale;acc.sf+=bs.tasmeenFemale;acc.t+=bs.total; return acc; },{tm:0,tf:0,sm:0,sf:0,t:0});
  const sheepTotals = s.sheepBreeds.reduce((acc,b)=>{ const bs=breedStats(b); acc.tm+=bs.tarbiyaMale;acc.tf+=bs.tarbiyaFemale;acc.sm+=bs.tasmeenMale;acc.sf+=bs.tasmeenFemale;acc.t+=bs.total; return acc; },{tm:0,tf:0,sm:0,sf:0,t:0});

  const noteList = (notes) => notes.length===0?'<small class="text-gray">لا توجد ملاحظات</small>':notes.map((n,i)=>`
    <div class="note-card d-flex gap-3">
      <div class="note-number">${ar(i+1)}</div>
      <div class="flex-grow-1"><div>${n.body}</div>${n.tag?`<small class="accent-text fw-bold">${n.tag}</small>`:''}</div>
      <button class="action-btn danger sm flex-shrink-0" onclick="deleteNote('${n.id}')"><i class="bi bi-trash"></i></button>
    </div>`).join('');

  el.innerHTML = `
  <div class="d-flex justify-content-end mb-3">
    <button class="action-btn primary" onclick="openAddNote()"><i class="bi bi-plus-lg"></i> إضافة ملاحظة</button>
  </div>
  <div class="wonder-card animate-in mb-4"><h4 class="fw-bold mb-1"><i class="bi bi-clipboard-data-fill accent-text"></i> ملاحظات التوريدات</h4><small class="text-gray">سجل التوريدات والاستلامات</small></div>
  <h5 class="fw-bold mb-3">ملاحظات الأغنام</h5>${noteList(sheepNotes)}
  <h5 class="fw-bold mb-3 mt-4">ملاحظات الماعز</h5>${noteList(goatNotes)}
  ${generalNotes.length>0?`<h5 class="fw-bold mb-3 mt-4">ملاحظات عامة</h5>${noteList(generalNotes)}`:''}
  <h5 class="fw-bold mb-3 mt-4 animate-in">جدول ملخص البيانات</h5>
  <div class="wonder-card p-0 animate-in">
    <div class="table-responsive">
      <table class="table table-dark table-bordered mb-0 align-middle text-center" style="--bs-border-color:#2a2a2a;font-size:.82rem">
        <thead><tr class="text-gray"><th>القسم</th><th>السلالة</th><th>ذكور تربية</th><th>إناث تربية</th><th>ذكور تسمين</th><th>إناث تسمين</th><th>الإجمالي</th></tr></thead>
        <tbody>
          ${s.goatBreeds.map((b,i)=>{ const bs=breedStats(b); return `<tr>${i===0?`<td rowspan="${s.goatBreeds.length}" class="green-text fw-bold">الماعز</td>`:''}<td>${b}</td><td>${ar(bs.tarbiyaMale)}</td><td>${ar(bs.tarbiyaFemale)}</td><td>${ar(bs.tasmeenMale)}</td><td>${ar(bs.tasmeenFemale)}</td><td class="fw-bold">${ar(bs.total)}</td></tr>`; }).join('')}
          <tr style="background:rgba(0,230,118,.06)"><td colspan="2" class="green-text fw-bold">إجمالي الماعز</td><td>${ar(goatTotals.tm)}</td><td>${ar(goatTotals.tf)}</td><td>${ar(goatTotals.sm)}</td><td>${ar(goatTotals.sf)}</td><td class="fw-bold green-text">${ar(goatTotals.t)}</td></tr>
          ${s.sheepBreeds.map((b,i)=>{ const bs=breedStats(b); return `<tr>${i===0?`<td rowspan="${s.sheepBreeds.length}" class="fw-bold" style="color:#2196f3">الأغنام</td>`:''}<td>${b}</td><td>${ar(bs.tarbiyaMale)}</td><td>${ar(bs.tarbiyaFemale)}</td><td>${ar(bs.tasmeenMale)}</td><td>${ar(bs.tasmeenFemale)}</td><td class="fw-bold">${ar(bs.total)}</td></tr>`; }).join('')}
          <tr style="background:rgba(33,150,243,.06)"><td colspan="2" class="fw-bold" style="color:#2196f3">إجمالي الأغنام</td><td>${ar(sheepTotals.tm)}</td><td>${ar(sheepTotals.tf)}</td><td>${ar(sheepTotals.sm)}</td><td>${ar(sheepTotals.sf)}</td><td class="fw-bold" style="color:#2196f3">${ar(sheepTotals.t)}</td></tr>
          <tr style="background:rgba(255,193,7,.06)"><td colspan="2" class="fw-bold" style="color:#ffc107">الولدات</td><td colspan="2">ذكور: ${ar(goatB.filter(a=>a.gender==='male').length+sheepB.filter(a=>a.gender==='male').length)}</td><td colspan="2">إناث: ${ar(goatB.filter(a=>a.gender==='female').length+sheepB.filter(a=>a.gender==='female').length)}</td><td class="fw-bold" style="color:#ffc107">${ar(goatB.length+sheepB.length)}</td></tr>
          <tr style="background:rgba(255,107,53,.1)"><td colspan="6" class="accent-text fw-bold">الإجمالي الكلي للمزرعة</td><td class="accent-text fw-bold">${ar(totalGoats+totalSheep+goatB.length+sheepB.length)}</td></tr>
        </tbody>
      </table>
    </div>
  </div>`;
}
window.deleteNote = async function(id){
  if(!confirm('حذف هذه الملاحظة؟')) return;
  if(!sb) return;
  const {error} = await sb.from('notes').delete().eq('id',id);
  if(error) toast('فشل الحذف','error'); else { toast('تم الحذف'); await loadData(); }
};

// ---- 21. SETTINGS ----
function renderSettings(el) {
  const s = getSettings();
  el.innerHTML = `
  <div class="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2 animate-in">
    <div><h5 class="fw-bold mb-1"><i class="bi bi-gear-fill accent-text"></i> الإعدادات</h5><small class="text-gray">تخصيص بيانات ومتغيرات المزرعة</small></div>
    <button class="action-btn primary" onclick="saveSettingsForm()"><i class="bi bi-floppy-fill"></i> حفظ التغييرات</button>
  </div>

  <div class="settings-section animate-in">
    <h6><i class="bi bi-house-fill accent-text"></i> معلومات المزرعة</h6>
    <div class="row g-3">
      <div class="col-md-6"><label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">اسم المزرعة</label>
        <input class="farm-modal input" id="set-farmName" value="${s.farmName}" style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none"></div>
      <div class="col-md-6"><label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">اسم المدير</label>
        <input id="set-ownerName" value="${s.ownerName}" style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none"></div>
      <div class="col-md-6"><label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">العملة</label>
        <select id="set-currency" style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none">
          ${['ج.م','ر.س','د.إ','د.ك','د.ا','ل.ل','د.م'].map(c=>`<option value="${c}" ${s.currency===c?'selected':''}>${c}</option>`).join('')}
        </select></div>
    </div>
  </div>

  <div class="settings-section animate-in">
    <h6><i class="bi bi-tropical-storm accent-text"></i> سلالات الماعز</h6>
    <div id="goat-chips" class="mb-3">${s.goatBreeds.map(b=>`<span class="tag-chip">🐐 ${b}<button class="rm" onclick="removeBreed('goat','${b}')"><i class="bi bi-x-lg"></i></button></span>`).join('')}</div>
    <div class="d-flex gap-2"><input id="new-goat-breed" placeholder="أضف سلالة ماعز..." style="flex:1;background:#111;border:1px solid #333;border-radius:12px;padding:9px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none">
    <button class="action-btn primary" onclick="addBreed('goat')"><i class="bi bi-plus-lg"></i></button></div>
  </div>

  <div class="settings-section animate-in">
    <h6><i class="bi bi-cloud-fill accent-text"></i> سلالات الأغنام</h6>
    <div id="sheep-chips" class="mb-3">${s.sheepBreeds.map(b=>`<span class="tag-chip" style="background:rgba(255,107,53,.1);border-color:rgba(255,107,53,.25);color:var(--accent-orange)">🐑 ${b}<button class="rm" onclick="removeBreed('sheep','${b}')"><i class="bi bi-x-lg"></i></button></span>`).join('')}</div>
    <div class="d-flex gap-2"><input id="new-sheep-breed" placeholder="أضف سلالة أغنام..." style="flex:1;background:#111;border:1px solid #333;border-radius:12px;padding:9px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none">
    <button class="action-btn primary" onclick="addBreed('sheep')"><i class="bi bi-plus-lg"></i></button></div>
  </div>

  <div class="settings-section animate-in">
    <h6><i class="bi bi-sliders accent-text"></i> المتغيرات والحدود</h6>
    <div class="row g-3">
      <div class="col-md-6"><label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">أيام الحمل (لحساب موعد الولادة)</label>
        <input type="number" id="set-pregnancyDays" value="${s.pregnancyDays}" min="100" max="200" style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none">
        <small class="text-gray">الافتراضي: ١٥٠ يوم</small></div>
      <div class="col-md-6"><label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">تنبيه التحصين قبل (أيام)</label>
        <input type="number" id="set-vaccinationAlertDays" value="${s.vaccinationAlertDays}" min="1" max="30" style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.9rem;outline:none"></div>
    </div>
  </div>

  <div class="settings-section animate-in" style="border-color:rgba(33,150,243,.3)">
    <h6><i class="bi bi-database-fill" style="color:#2196f3"></i> إعدادات Supabase</h6>
    <small class="text-gray d-block mb-3">ادخل بيانات قاعدة البيانات لتفعيل الحيوانات والتحصينات والملاحظات</small>
    <label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">Supabase URL</label>
    <input id="set-supabaseUrl" value="${s.supabaseUrl}" placeholder="https://xxxx.supabase.co" style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.88rem;outline:none;margin-bottom:12px;direction:ltr">
    <label class="text-gray" style="font-size:.82rem;margin-bottom:4px;display:block">Supabase Anon Key</label>
    <input id="set-supabaseKey" value="${s.supabaseKey}" placeholder="eyJhbGciOi..." style="width:100%;background:#111;border:1px solid #333;border-radius:12px;padding:10px 14px;color:#e8e8e8;font-family:'Cairo',sans-serif;font-size:.88rem;outline:none;direction:ltr">
  </div>

  <div class="d-flex justify-content-end mt-3">
    <button class="action-btn primary" onclick="saveSettingsForm()" style="padding:10px 28px"><i class="bi bi-floppy-fill"></i> حفظ جميع الإعدادات</button>
  </div>`;
}
window.saveSettingsForm = function() {
  const s = getSettings();
  s.farmName = document.getElementById('set-farmName').value.trim() || s.farmName;
  s.ownerName = document.getElementById('set-ownerName').value.trim() || s.ownerName;
  s.currency = document.getElementById('set-currency').value;
  s.pregnancyDays = parseInt(document.getElementById('set-pregnancyDays').value) || 150;
  s.vaccinationAlertDays = parseInt(document.getElementById('set-vaccinationAlertDays').value) || 7;
  const url = document.getElementById('set-supabaseUrl').value.trim();
  const key = document.getElementById('set-supabaseKey').value.trim();
  s.supabaseUrl = url;
  s.supabaseKey = key;
  saveSettings(s);
  if(url && key) { sb = null; initSB(); loadData(); }
  document.getElementById('nav-farm-name').textContent = s.farmName;
  document.getElementById('sb-farm-name').textContent = s.farmName;
  document.getElementById('sb-owner').textContent = s.ownerName;
  document.getElementById('footer-name').textContent = s.farmName;
  toast('تم حفظ الإعدادات');
  renderSettings(document.getElementById('page-content'));
};
window.addBreed = function(type) {
  const inp = document.getElementById(`new-${type}-breed`);
  const val = inp.value.trim();
  if(!val) return;
  const s = getSettings();
  const arr = type==='goat'?s.goatBreeds:s.sheepBreeds;
  if(arr.includes(val)) { toast('السلالة موجودة بالفعل','error'); return; }
  arr.push(val);
  saveSettings(s);
  toast('تمت إضافة السلالة');
  renderSettings(document.getElementById('page-content'));
};
window.removeBreed = function(type, name) {
  const s = getSettings();
  const arr = type==='goat'?s.goatBreeds:s.sheepBreeds;
  if(arr.length<=1) { toast('يجب الإبقاء على سلالة واحدة على الأقل','error'); return; }
  const idx = arr.indexOf(name);
  if(idx>-1) arr.splice(idx,1);
  saveSettings(s);
  toast('تم الحذف');
  renderSettings(document.getElementById('page-content'));
};

// ---- 22. MODALS ----
function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="farm-modal-backdrop" onclick="if(event.target===this)closeModal()">${html}</div>`;
}
window.closeModal = function() { document.getElementById('modal-root').innerHTML = ''; };

// ADD ANIMAL
window.openAddAnimal = function(defaultSpecies) {
  const s = getSettings();
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()">
    <h4><i class="bi bi-plus-circle accent-text"></i> إضافة حيوان جديد</h4>
    <label>النوع</label>
    <select id="m-species" onchange="updateBreedOptions()">
      <option value="goat" ${defaultSpecies==='goat'?'selected':''}>ماعز</option>
      <option value="sheep" ${defaultSpecies==='sheep'?'selected':''}>أغنام</option>
    </select>
    <label>الغرض</label>
    <select id="m-purpose" onchange="toggleBreed()">
      <option value="tarbiya">تربية</option>
      <option value="tasmeen">تسمين</option>
      <option value="birth">مواليد</option>
    </select>
    <div id="m-breed-wrap">
      <label>السلالة</label>
      <select id="m-breed">${s.goatBreeds.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    </div>
    <label>الجنس</label>
    <select id="m-gender"><option value="female">أنثى</option><option value="male">ذكر</option></select>
    <div class="row g-2">
      <div class="col-6"><label>رقم الترقيم (اختياري)</label><input id="m-tag" placeholder="A-123"></div>
      <div class="col-6"><label>الكمية</label><input type="number" id="m-qty" value="1" min="1" max="500"></div>
    </div>
    <label>ملاحظات (اختياري)</label><textarea id="m-notes" rows="2"></textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitAddAnimal()">حفظ</button>
    </div>
  </div>`);
};
window.updateBreedOptions = function() {
  const s = getSettings();
  const species = document.getElementById('m-species').value;
  const breeds = species==='goat'?s.goatBreeds:s.sheepBreeds;
  document.getElementById('m-breed').innerHTML = breeds.map(b=>`<option value="${b}">${b}</option>`).join('');
};
window.toggleBreed = function() {
  const p = document.getElementById('m-purpose').value;
  document.getElementById('m-breed-wrap').style.display = p==='birth'?'none':'block';
};
window.submitAddAnimal = async function() {
  if(!sb) { toast('لم يتم تكوين Supabase','error'); return; }
  const species = document.getElementById('m-species').value;
  const purpose = document.getElementById('m-purpose').value;
  const breed = purpose==='birth'?'مواليد':document.getElementById('m-breed').value;
  const gender = document.getElementById('m-gender').value;
  const tag = document.getElementById('m-tag').value.trim();
  const notes = document.getElementById('m-notes').value.trim();
  const qty = parseInt(document.getElementById('m-qty').value)||1;
  const btn = document.querySelector('#modal-root .action-btn.primary');
  btn.disabled=true; btn.textContent='جاري الحفظ...';
  let success=0;
  for(let i=0;i<qty;i++) {
    const payload = {species,breed,gender,purpose,status:'alive'};
    if(tag) payload.tag = qty===1?tag:`${tag}-${i+1}`;
    if(notes) payload.notes = notes;
    const {error} = await sb.from('animals').insert(payload);
    if(!error) success++;
  }
  if(success>0) { toast(`تمت إضافة ${ar(success)} حيوان`); closeModal(); await loadData(); }
  else toast('فشل الحفظ','error');
};

// MARK DEATH
window.openMarkDeath = function(defaultSpecies) {
  const s = getSettings();
  const alive = S.animals.filter(a=>a.status==='alive'&&(!defaultSpecies||a.species===defaultSpecies));
  const breeds = [...new Set(alive.map(a=>a.breed))];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()">
    <h4 style="color:#ff8a8a"><i class="bi bi-exclamation-triangle"></i> تسجيل نفوق حيوان</h4>
    <label>السلالة</label>
    <select id="d-breed" onchange="updateDeathCandidates()">
      <option value="">— الكل —</option>
      ${breeds.map(b=>`<option value="${b}">${b}</option>`).join('')}
    </select>
    <label>اختر الحيوان (المتاح: <span id="d-count">${ar(alive.length)}</span>)</label>
    <select id="d-animal">
      <option value="">— اختر —</option>
      ${alive.slice(0,200).map(a=>`<option value="${a.id}">${a.breed} • ${a.gender==='male'?'ذكر':'أنثى'} • ${a.purpose==='tarbiya'?'تربية':a.purpose==='tasmeen'?'تسمين':'مواليد'}${a.tag?` • ${a.tag}`:''}</option>`).join('')}
    </select>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn danger" onclick="submitMarkDeath()">تأكيد النفوق</button>
    </div>
  </div>`);
};
window.updateDeathCandidates = function() {
  const breed = document.getElementById('d-breed').value;
  const candidates = S.animals.filter(a=>a.status==='alive'&&(!breed||a.breed===breed));
  document.getElementById('d-count').textContent = ar(candidates.length);
  document.getElementById('d-animal').innerHTML = '<option value="">— اختر —</option>'+
    candidates.slice(0,200).map(a=>`<option value="${a.id}">${a.breed} • ${a.gender==='male'?'ذكر':'أنثى'}${a.tag?` • ${a.tag}`:''}</option>`).join('');
};
window.submitMarkDeath = async function() {
  const id = document.getElementById('d-animal').value;
  if(!id) { toast('يرجى اختيار حيوان','error'); return; }
  const {error} = await sb.from('animals').update({status:'dead',died_at:new Date().toISOString()}).eq('id',id);
  if(error) toast('فشل التسجيل','error'); else { toast('تم تسجيل النفوق'); closeModal(); await loadData(); }
};

// ADD/EDIT VACCINATION
let editVaccId = null;
window.openAddVaccination = function() { editVaccId=null; _showVaccModal({}); };
window.openEditVaccination = function(id) { editVaccId=id; _showVaccModal(S.vaccinations.find(v=>v.id===id)||{}); };
function _showVaccModal(v) {
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:460px">
    <h4><i class="bi bi-bandaid-fill accent-text"></i> ${editVaccId?'تعديل':'إضافة'} تحصين</h4>
    <label>اسم التحصين *</label><input id="v-name" value="${v.name||''}" placeholder="مثال: تحصين الجدري">
    <label>القسم المستهدف *</label><input id="v-section" value="${v.target_section||''}" placeholder="مثال: جميع الماعز">
    <div class="row g-2">
      <div class="col-6"><label>عدد الرؤوس</label><input type="number" id="v-count" value="${v.count||0}" min="0"></div>
      <div class="col-6"><label>الحالة</label>
        <select id="v-status">
          <option value="pending" ${v.status==='pending'?'selected':''}>قيد الانتظار</option>
          <option value="done" ${v.status==='done'?'selected':''}>تم التنفيذ</option>
          <option value="overdue" ${v.status==='overdue'?'selected':''}>متأخر</option>
        </select>
      </div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>تاريخ الموعد</label><input type="date" id="v-scheduled" value="${v.scheduled_date||''}"></div>
      <div class="col-6"><label>تاريخ التنفيذ</label><input type="date" id="v-done" value="${v.done_date||''}"></div>
    </div>
    <label>نسبة الإنجاز</label>
    <input type="range" id="v-progress" min="0" max="100" value="${v.progress||0}" oninput="document.getElementById('v-pct').textContent=this.value+'٪'">
    <small class="text-gray" id="v-pct">${ar(v.progress||0)}٪</small>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitVaccination()">حفظ</button>
    </div>
  </div>`);
}
window.submitVaccination = async function() {
  const name = document.getElementById('v-name').value.trim();
  const section = document.getElementById('v-section').value.trim();
  if(!name||!section) { toast('يرجى ملء الاسم والقسم','error'); return; }
  const payload = {name,target_section:section,count:parseInt(document.getElementById('v-count').value)||0,status:document.getElementById('v-status').value,scheduled_date:document.getElementById('v-scheduled').value||null,done_date:document.getElementById('v-done').value||null,progress:parseInt(document.getElementById('v-progress').value)||0};
  const q = editVaccId ? sb.from('vaccinations').update(payload).eq('id',editVaccId) : sb.from('vaccinations').insert(payload);
  const {error} = await q;
  if(error) toast('خطأ: '+error.message,'error');
  else { toast(editVaccId?'تم التحديث':'تمت الإضافة'); closeModal(); await loadData(); }
};

// ADD BREEDING
let editBreedingId = null;
window.openAddBreeding = function() { editBreedingId=null; _showBreedingModal({}); };
window.openEditBreeding = function(id) { editBreedingId=id; _showBreedingModal(Breeding.all().find(r=>r.id===id)||{}); };
function _showBreedingModal(r) {
  const s = getSettings();
  const allBreeds = [...s.goatBreeds,...s.sheepBreeds];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px;max-height:90vh;overflow-y:auto">
    <h4><i class="bi bi-diagram-2-fill accent-text"></i> ${editBreedingId?'تعديل':'تسجيل'} تقريع</h4>
    <div class="row g-2">
      <div class="col-6"><label>النوع</label>
        <select id="b-species" onchange="updateBreedingBreeds()">
          <option value="goat" ${r.female_species==='goat'?'selected':''}>ماعز</option>
          <option value="sheep" ${r.female_species==='sheep'?'selected':''}>أغنام</option>
        </select>
      </div>
      <div class="col-6"><label>سلالة الأنثى</label>
        <select id="b-fbreed">${(r.female_species==='sheep'?s.sheepBreeds:s.goatBreeds).map(b=>`<option value="${b}" ${r.female_breed===b?'selected':''}>${b}</option>`).join('')}</select>
      </div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>رقم ترقيم الأنثى *</label><input id="b-ftag" value="${r.female_tag||''}" placeholder="F-101"></div>
      <div class="col-6"><label>رقم ترقيم الفحل</label><input id="b-mtag" value="${r.male_tag||''}" placeholder="M-001"></div>
    </div>
    <label>سلالة الفحل</label>
    <select id="b-mbreed">${allBreeds.map(b=>`<option value="${b}" ${r.male_breed===b?'selected':''}>${b}</option>`).join('')}</select>
    <div class="row g-2">
      <div class="col-6"><label>تاريخ التقريع *</label><input type="date" id="b-mdate" value="${r.mating_date||new Date().toISOString().slice(0,10)}" onchange="calcExpectedBirth()"></div>
      <div class="col-6"><label>موعد الولادة المتوقع</label><input type="date" id="b-edate" value="${r.expected_birth||''}"></div>
    </div>
    <label>الحالة</label>
    <select id="b-status" onchange="toggleBornFields()">
      ${['pending','pregnant','born','failed'].map(st=>`<option value="${st}" ${r.status===st?'selected':''}>${{pending:'قيد الانتظار',pregnant:'حامل',born:'ولدت',failed:'إجهاض / فشل'}[st]}</option>`).join('')}
    </select>
    <div id="born-fields" style="display:${r.status==='born'?'block':'none'}">
      <label>تاريخ الولادة الفعلي</label><input type="date" id="b-adate" value="${r.actual_birth||''}">
      <div class="row g-2">
        <div class="col-4"><label>إجمالي المواليد</label><input type="number" min="0" id="b-total" value="${r.offspring_count||''}"></div>
        <div class="col-4"><label>ذكور</label><input type="number" min="0" id="b-male" value="${r.male_offspring||''}"></div>
        <div class="col-4"><label>إناث</label><input type="number" min="0" id="b-female" value="${r.female_offspring||''}"></div>
      </div>
    </div>
    <label>ملاحظات</label><textarea id="b-notes" rows="2">${r.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitBreeding()">حفظ</button>
    </div>
  </div>`);
}
window.updateBreedingBreeds = function() {
  const s = getSettings();
  const sp = document.getElementById('b-species').value;
  const breeds = sp==='goat'?s.goatBreeds:s.sheepBreeds;
  document.getElementById('b-fbreed').innerHTML = breeds.map(b=>`<option value="${b}">${b}</option>`).join('');
};
window.calcExpectedBirth = function() {
  const d = document.getElementById('b-mdate').value;
  if(d) { const dt=new Date(d); dt.setDate(dt.getDate()+getSettings().pregnancyDays); document.getElementById('b-edate').value=dt.toISOString().slice(0,10); }
};
window.toggleBornFields = function() {
  document.getElementById('born-fields').style.display = document.getElementById('b-status').value==='born'?'block':'none';
};
window.submitBreeding = function() {
  const ftag = document.getElementById('b-ftag').value.trim();
  if(!ftag) { toast('يرجى إدخال ترقيم الأنثى','error'); return; }
  const status = document.getElementById('b-status').value;
  const rec = {
    id: editBreedingId||genId(),
    female_tag:ftag, female_breed:document.getElementById('b-fbreed').value,
    female_species:document.getElementById('b-species').value,
    male_tag:document.getElementById('b-mtag').value.trim(),
    male_breed:document.getElementById('b-mbreed').value,
    mating_date:document.getElementById('b-mdate').value,
    expected_birth:document.getElementById('b-edate').value,
    actual_birth:status==='born'?document.getElementById('b-adate').value:null,
    offspring_count:status==='born'?parseInt(document.getElementById('b-total').value)||null:null,
    male_offspring:status==='born'?parseInt(document.getElementById('b-male').value)||null:null,
    female_offspring:status==='born'?parseInt(document.getElementById('b-female').value)||null:null,
    status, notes:document.getElementById('b-notes').value.trim()||null,
    created_at: editBreedingId?Breeding.all().find(r=>r.id===editBreedingId)?.created_at:new Date().toISOString()
  };
  if(editBreedingId) Breeding.update(editBreedingId,rec); else Breeding.add(rec);
  toast(editBreedingId?'تم التحديث':'تمت الإضافة'); closeModal(); renderPage();
};

// ADD HEALTH
let editHealthId = null;
window.openAddHealth = function() { editHealthId=null; _showHealthModal({}); };
window.openEditHealth = function(id) { editHealthId=id; _showHealthModal(Health.all().find(r=>r.id===id)||{}); };
function _showHealthModal(r) {
  const s = getSettings();
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px;max-height:90vh;overflow-y:auto">
    <h4><i class="bi bi-heart-pulse-fill accent-text"></i> ${editHealthId?'تعديل':'إضافة'} سجل صحي</h4>
    <div class="row g-2">
      <div class="col-6"><label>النوع</label>
        <select id="h-species" onchange="updateHealthBreeds()">
          <option value="goat" ${r.animal_species==='goat'?'selected':''}>ماعز</option>
          <option value="sheep" ${r.animal_species==='sheep'?'selected':''}>أغنام</option>
        </select>
      </div>
      <div class="col-6"><label>السلالة</label>
        <select id="h-breed">${s.goatBreeds.map(b=>`<option value="${b}" ${r.animal_breed===b?'selected':''}>${b}</option>`).join('')}</select>
      </div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>رقم الترقيم</label><input id="h-tag" value="${r.animal_tag||''}" placeholder="A-123"></div>
      <div class="col-6"><label>تاريخ العلاج *</label><input type="date" id="h-date" value="${r.date||new Date().toISOString().slice(0,10)}"></div>
    </div>
    <label>التشخيص *</label><input id="h-diagnosis" value="${r.diagnosis||''}" placeholder="مثال: التهاب رئوي">
    <div class="row g-2">
      <div class="col-6"><label>الدواء *</label><input id="h-med" value="${r.medication||''}" placeholder="اسم الدواء"></div>
      <div class="col-6"><label>الجرعة</label><input id="h-dose" value="${r.dosage||''}" placeholder="5 مل"></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>تاريخ انتهاء العلاج</label><input type="date" id="h-tend" value="${r.treatment_end||''}" onchange="calcWithdrawal()"></div>
      <div class="col-6"><label>فترة السحب (أيام)</label><input type="number" id="h-wdays" value="${r.withdrawal_days||0}" min="0" onchange="calcWithdrawal()"></div>
    </div>
    <div id="h-wdisplay" style="display:none;background:rgba(244,67,54,.05);border:1px solid rgba(244,67,54,.3);border-radius:10px;padding:8px 12px;margin-top:8px;font-size:.82rem;color:#f44336">
      <i class="bi bi-exclamation-triangle-fill me-1"></i> لا يجوز البيع أو الذبح قبل: <span id="h-wdate"></span>
    </div>
    <label>الحالة</label>
    <select id="h-status">
      <option value="active" ${r.status==='active'?'selected':''}>قيد العلاج</option>
      <option value="completed" ${r.status==='completed'?'selected':''}>مكتمل</option>
    </select>
    <label>ملاحظات</label><textarea id="h-notes" rows="2">${r.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitHealth()">حفظ</button>
    </div>
  </div>`);
}
window.updateHealthBreeds = function() {
  const s = getSettings();
  const sp = document.getElementById('h-species').value;
  const breeds = sp==='goat'?s.goatBreeds:s.sheepBreeds;
  document.getElementById('h-breed').innerHTML = breeds.map(b=>`<option value="${b}">${b}</option>`).join('');
};
window.calcWithdrawal = function() {
  const tend = document.getElementById('h-tend').value;
  const wdays = parseInt(document.getElementById('h-wdays').value)||0;
  if(tend && wdays>0) {
    const dt = new Date(tend); dt.setDate(dt.getDate()+wdays);
    const wdate = dt.toISOString().slice(0,10);
    document.getElementById('h-wdate').textContent = wdate;
    document.getElementById('h-wdisplay').style.display = 'block';
  } else { document.getElementById('h-wdisplay').style.display = 'none'; }
};
window.submitHealth = function() {
  const diag = document.getElementById('h-diagnosis').value.trim();
  const med = document.getElementById('h-med').value.trim();
  if(!diag||!med) { toast('يرجى إدخال التشخيص والدواء','error'); return; }
  const tend = document.getElementById('h-tend').value;
  const wdays = parseInt(document.getElementById('h-wdays').value)||0;
  let withdrawal_end = '';
  if(tend && wdays>0) { const dt=new Date(tend); dt.setDate(dt.getDate()+wdays); withdrawal_end=dt.toISOString().slice(0,10); }
  const rec = {
    id: editHealthId||genId(),
    animal_tag:document.getElementById('h-tag').value.trim(),
    animal_breed:document.getElementById('h-breed').value,
    animal_species:document.getElementById('h-species').value,
    date:document.getElementById('h-date').value,
    diagnosis:diag, medication:med,
    dosage:document.getElementById('h-dose').value.trim(),
    withdrawal_days:wdays, treatment_end:tend, withdrawal_end,
    status:document.getElementById('h-status').value,
    notes:document.getElementById('h-notes').value.trim()||null,
    created_at: editHealthId?Health.all().find(r=>r.id===editHealthId)?.created_at:new Date().toISOString()
  };
  if(editHealthId) Health.update(editHealthId,rec); else Health.add(rec);
  toast(editHealthId?'تم التحديث':'تمت الإضافة'); closeModal(); renderPage();
};

// ADD FINANCE
window.openAddFinance = function() {
  const s = getSettings();
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:440px">
    <h4><i class="bi bi-wallet2 accent-text"></i> إضافة معاملة مالية</h4>
    <div class="row g-2">
      <div class="col-6"><label>التاريخ</label><input type="date" id="f-date" value="${new Date().toISOString().slice(0,10)}"></div>
      <div class="col-6"><label>النوع</label>
        <select id="f-type" onchange="updateFinanceCats()">
          <option value="income">إيراد</option>
          <option value="expense">مصروف</option>
        </select>
      </div>
    </div>
    <label>الفئة *</label>
    <select id="f-cat">${INCOME_CATS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
    <div class="row g-2">
      <div class="col-6"><label>المبلغ (${s.currency}) *</label><input type="number" id="f-amount" min="0" step="0.01" placeholder="0.00"></div>
      <div class="col-6"><label>الوصف</label><input id="f-desc" placeholder="تفاصيل المعاملة"></div>
    </div>
    <label>ملاحظات</label><textarea id="f-notes" rows="2"></textarea>
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitFinance()">حفظ</button>
    </div>
  </div>`);
};
window.updateFinanceCats = function() {
  const t = document.getElementById('f-type').value;
  const cats = t==='income'?INCOME_CATS:EXPENSE_CATS;
  document.getElementById('f-cat').innerHTML = cats.map(c=>`<option value="${c}">${c}</option>`).join('');
};
window.submitFinance = function() {
  const amount = parseFloat(document.getElementById('f-amount').value);
  const cat = document.getElementById('f-cat').value;
  if(!amount||!cat) { toast('يرجى إدخال المبلغ والفئة','error'); return; }
  Finance.add({id:genId(),date:document.getElementById('f-date').value,type:document.getElementById('f-type').value,category:cat,amount,description:document.getElementById('f-desc').value.trim(),notes:document.getElementById('f-notes').value.trim()||null,created_at:new Date().toISOString()});
  toast('تمت الإضافة'); closeModal(); renderPage();
};

// ADD NOTE
window.openAddNote = function() {
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:420px">
    <h4><i class="bi bi-plus-circle accent-text"></i> إضافة ملاحظة جديدة</h4>
    <label>القسم</label>
    <select id="n-cat"><option value="general">عامة</option><option value="goat">ماعز</option><option value="sheep">أغنام</option></select>
    <label>الملاحظة *</label><textarea id="n-body" rows="3" placeholder="اكتب الملاحظة هنا..."></textarea>
    <label>التصنيف (اختياري)</label><input id="n-tag" placeholder="مثال: توريد جديد، استلام...">
    <div class="d-flex gap-2 justify-content-end mt-3">
      <button class="action-btn" onclick="closeModal()">إلغاء</button>
      <button class="action-btn primary" onclick="submitNote()">حفظ</button>
    </div>
  </div>`);
};
window.submitNote = async function() {
  const body = document.getElementById('n-body').value.trim();
  if(!body) { toast('يرجى كتابة الملاحظة','error'); return; }
  if(!sb) { toast('لم يتم تكوين Supabase','error'); return; }
  const {error} = await sb.from('notes').insert({category:document.getElementById('n-cat').value,body,tag:document.getElementById('n-tag').value.trim()||null});
  if(error) toast('خطأ: '+error.message,'error'); else { toast('تمت الإضافة'); closeModal(); await loadData(); }
};

// ---- 23. EXCEL EXPORT ----
window.exportExcel = function() {
  if(typeof XLSX==='undefined') { toast('مكتبة Excel غير متاحة','error'); return; }
  const s = getSettings();
  const wb = XLSX.utils.book_new();
  const summary = [['القسم','السلالة','ذكور تربية','إناث تربية','ذكور تسمين','إناث تسمين','الإجمالي'],
    ...s.goatBreeds.map(b=>{ const bs=breedStats(b); return ['الماعز',b,bs.tarbiyaMale,bs.tarbiyaFemale,bs.tasmeenMale,bs.tasmeenFemale,bs.total]; }),
    ...s.sheepBreeds.map(b=>{ const bs=breedStats(b); return ['الأغنام',b,bs.tarbiyaMale,bs.tarbiyaFemale,bs.tasmeenMale,bs.tasmeenFemale,bs.total]; })];
  const ws1=XLSX.utils.aoa_to_sheet(summary); ws1['!cols']=Array(7).fill({wch:16});
  XLSX.utils.book_append_sheet(wb,ws1,'الملخص');
  const list=[['النوع','السلالة','الجنس','الغرض','الحالة','الترقيم','تاريخ الإضافة','تاريخ النفوق'],
    ...S.animals.map(a=>[a.species==='goat'?'ماعز':'أغنام',a.breed,a.gender==='male'?'ذكر':'أنثى',{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose,a.status==='alive'?'حي':'نافق',a.tag||'',(a.created_at||'').slice(0,10),(a.died_at||'').slice(0,10)])];
  const ws2=XLSX.utils.aoa_to_sheet(list); ws2['!cols']=Array(8).fill({wch:14});
  XLSX.utils.book_append_sheet(wb,ws2,'الحيوانات');
  const vacc=[['اسم التحصين','القسم','العدد','الحالة','تاريخ الموعد','نسبة الإنجاز'],
    ...S.vaccinations.map(v=>[v.name,v.target_section,v.count,{done:'تم',pending:'قيد الانتظار',overdue:'متأخر'}[v.status],v.scheduled_date||'',v.progress])];
  const ws3=XLSX.utils.aoa_to_sheet(vacc); ws3['!cols']=Array(6).fill({wch:18});
  XLSX.utils.book_append_sheet(wb,ws3,'التحصينات');
  const fin=[['التاريخ','النوع','الفئة','الوصف','المبلغ',...Finance.all().map(r=>[r.date,r.type==='income'?'إيراد':'مصروف',r.category,r.description||'',r.amount])].flat()];
  XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['التاريخ','النوع','الفئة','الوصف',`المبلغ (${s.currency})`],...Finance.all().map(r=>[r.date,r.type==='income'?'إيراد':'مصروف',r.category,r.description||'',r.amount])]),'المالية');
  XLSX.writeFile(wb,`farm-report-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('تم تصدير التقرير');
};

// ---- 24. SIDEBAR CONTROLS ----
window.openSidebar = function() {
  renderSidebar();
  document.getElementById('sidebarOverlay').classList.add('active');
  document.getElementById('sidebarMenu').classList.add('active');
  document.body.style.overflow='hidden';
};
window.closeSidebar = function() {
  document.getElementById('sidebarOverlay').classList.remove('active');
  document.getElementById('sidebarMenu').classList.remove('active');
  document.body.style.overflow='';
};

// ---- 25. INIT ----
window.addEventListener('DOMContentLoaded', async () => {
  const s = getSettings();
  document.getElementById('nav-farm-name').textContent = s.farmName;
  document.getElementById('sb-farm-name').textContent = s.farmName;
  document.getElementById('sb-owner').textContent = s.ownerName;
  document.getElementById('sb-avatar').textContent = s.ownerName.slice(0,1);
  document.getElementById('footer-name').textContent = s.farmName;
  document.getElementById('today-display').textContent = todayAr();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('page-title-h').textContent = 'النظرة العامة';
  document.getElementById('page-subtitle').textContent = '';
  renderTabs();
  updateBadge();
  initSB();
  await loadData();
});
