'use strict';
// =====================================================
// FARM v2 — COMPLETE MANAGEMENT SYSTEM
// =====================================================

// ╔══════════════════════════════════════════════════╗
// ║  ⚙️  إعداد Supabase — عدّل هنا مرة واحدة بس   ║
// ║  بعد التعديل ارفع الملف والكل يشتغل معاه       ║
// ╚══════════════════════════════════════════════════╝
const SUPABASE_URL  = '';   // مثال: 'https://xxxx.supabase.co'
const SUPABASE_KEY  = '';   // anon/public key
// ═══════════════════════════════════════════════════

// ---- ARABIC ----
const AR=['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
const ar=n=>String(n).replace(/\d/g,d=>AR[+d]);
const pad2=n=>ar(String(n).padStart(2,'0').replace(/0/g,'٠'));
function todayAr(){const d=new Date();return`${ar(d.getFullYear())}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())}`;}
const todayStr=()=>new Date().toISOString().slice(0,10);
function daysFromNow(ds){if(!ds)return null;return Math.ceil((new Date(ds)-new Date())/86400000);}

// ---- TOAST ----
function toast(msg,type='success'){
  const el=document.createElement('div');
  el.className=`farm-toast t-${type}`;
  el.innerHTML=`<i class="bi bi-${type==='success'?'check-circle-fill':type==='error'?'x-circle-fill':'info-circle-fill'}"></i> ${msg}`;
  document.getElementById('toast-wrap').appendChild(el);
  setTimeout(()=>{el.style.opacity='0';},2600);
  setTimeout(()=>{el.remove();},3100);
}

// ---- ROLES ----
const ROLES={
  admin:{label:'مدير',icon:'bi-shield-fill',color:'var(--orange)'},
  supervisor:{label:'مشرف',icon:'bi-person-badge-fill',color:'var(--blue)'},
  vet:{label:'طبيب بيطري',icon:'bi-heart-pulse-fill',color:'var(--green)'},
  worker:{label:'عامل',icon:'bi-person-fill',color:'var(--gray)'},
};
const ROLE_PERMS={
  admin:()=>true,
  supervisor:(p)=>!['users','finance','reports_finance'].includes(p),
  vet:(p)=>['health','vaccinations','pharmacy','breeding','dash','notifications'].includes(p),
  worker:(p)=>['dash','animals','weight','births','notifications'].includes(p),
};
function can(page){const u=getUser();if(!u)return false;if(u.role==='admin')return true;return(ROLE_PERMS[u.role]||((p)=>false))(page);}

// ---- STORAGE ----
function ls(k){try{return JSON.parse(localStorage.getItem(k)||'[]');}catch{return[];}}
function lsObj(k,def={}){try{return{...def,...JSON.parse(localStorage.getItem(k)||'null')};}catch{return def;}}
function ss(k,v){localStorage.setItem(k,JSON.stringify(v));}
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}

// ---- STORES ----
const Users={
  all:()=>ls('farm_users'),
  get:(id)=>ls('farm_users').find(u=>u.id===id),
  add(u){ss('farm_users',[...ls('farm_users'),u]);},
  update(id,p){ss('farm_users',ls('farm_users').map(u=>u.id===id?{...u,...p}:u));},
  del(id){ss('farm_users',ls('farm_users').filter(u=>u.id!==id));},
  init(){if(ls('farm_users').length===0){ss('farm_users',[{id:'admin1',name:'مدير المزرعة',role:'admin',pin:'1234',active:true,created:todayStr()}]);}}
};
const Animals={all:()=>ls('farm_animals_local'),get:(id)=>ls('farm_animals_local').find(a=>a.id===id),save:(arr)=>ss('farm_animals_local',arr)};
const Weights={
  all:()=>sb?S.weights:ls('farm_weights'),
  forAnimal:(aid)=>Weights.all().filter(w=>w.animal_id===aid).sort((a,b)=>b.date.localeCompare(a.date)),
  async add(r){if(await sbSave('weights',r))await loadData();else{ss('farm_weights',[...ls('farm_weights'),r]);renderPage();}},
  async del(id){if(await sbDel('weights',id))await loadData();else{ss('farm_weights',ls('farm_weights').filter(r=>r.id!==id));renderPage();}}
};
const Milk={
  all:()=>sb?S.milk:ls('farm_milk'),
  forAnimal:(aid)=>Milk.all().filter(m=>m.animal_id===aid).sort((a,b)=>b.date.localeCompare(a.date)),
  async add(r){if(await sbSave('milk',r))await loadData();else{ss('farm_milk',[...ls('farm_milk'),r]);renderPage();}},
  async del(id){if(await sbDel('milk',id))await loadData();else{ss('farm_milk',ls('farm_milk').filter(r=>r.id!==id));renderPage();}}
};
// كل البيانات تروح Supabase لو متصل، لو لأ localStorage
async function sbSave(table,rec){
  if(!sb)return false;
  try{await SB.upsert(table,rec);return true;}
  catch(e){console.error('sbSave',table,e);toast('خطأ في الحفظ: '+e.message,'error');return false;}
}
async function sbDel(table,id){
  if(!sb)return false;
  try{await SB.delete(table,id);return true;}
  catch(e){console.error('sbDel',table,e);toast('خطأ في الحذف: '+e.message,'error');return false;}
}

const Breeding={
  all:()=>sb?S.breeding:ls('farm_breeding'),
  async add(r){if(await sbSave('breeding',r))await loadData();else{ss('farm_breeding',[r,...ls('farm_breeding')]);renderPage();}},
  async update(id,p){const r={...Breeding.all().find(x=>x.id===id),...p};if(await sbSave('breeding',r))await loadData();else{ss('farm_breeding',ls('farm_breeding').map(x=>x.id===id?r:x));renderPage();}},
  async del(id){if(await sbDel('breeding',id))await loadData();else{ss('farm_breeding',ls('farm_breeding').filter(x=>x.id!==id));renderPage();}}
};
const Health={
  all:()=>sb?S.health:ls('farm_health'),
  async add(r){if(await sbSave('health',r))await loadData();else{ss('farm_health',[r,...ls('farm_health')]);renderPage();}},
  async update(id,p){const r={...Health.all().find(x=>x.id===id),...p};if(await sbSave('health',r))await loadData();else{ss('farm_health',ls('farm_health').map(x=>x.id===id?r:x));renderPage();}},
  async del(id){if(await sbDel('health',id))await loadData();else{ss('farm_health',ls('farm_health').filter(x=>x.id!==id));renderPage();}}
};
const Finance={
  all:()=>sb?S.finance:ls('farm_finance'),
  async add(r){if(await sbSave('finance',r))await loadData();else{ss('farm_finance',[r,...ls('farm_finance')]);renderPage();}},
  async del(id){if(await sbDel('finance',id))await loadData();else{ss('farm_finance',ls('farm_finance').filter(x=>x.id!==id));renderPage();}}
};
const Inventory={
  meds:()=>sb?S.meds:ls('farm_meds'),
  async addMed(r){if(await sbSave('inventory_meds',r))await loadData();else{ss('farm_meds',[r,...ls('farm_meds')]);renderPage();}},
  async updateMed(id,p){const r={...Inventory.meds().find(x=>x.id===id),...p};if(await sbSave('inventory_meds',r))await loadData();else{ss('farm_meds',ls('farm_meds').map(x=>x.id===id?r:x));renderPage();}},
  async delMed(id){if(await sbDel('inventory_meds',id))await loadData();else{ss('farm_meds',ls('farm_meds').filter(x=>x.id!==id));renderPage();}},
  feeds:()=>sb?S.feeds:ls('farm_feeds'),
  async addFeed(r){if(await sbSave('inventory_feeds',r))await loadData();else{ss('farm_feeds',[r,...ls('farm_feeds')]);renderPage();}},
  async updateFeed(id,p){const r={...Inventory.feeds().find(x=>x.id===id),...p};if(await sbSave('inventory_feeds',r))await loadData();else{ss('farm_feeds',ls('farm_feeds').map(x=>x.id===id?r:x));renderPage();}},
  async delFeed(id){if(await sbDel('inventory_feeds',id))await loadData();else{ss('farm_feeds',ls('farm_feeds').filter(x=>x.id!==id));renderPage();}},
  equipment:()=>sb?S.equipment:ls('farm_equipment'),
  async addEquip(r){if(await sbSave('inventory_equipment',r))await loadData();else{ss('farm_equipment',[r,...ls('farm_equipment')]);renderPage();}},
  async updateEquip(id,p){const r={...Inventory.equipment().find(x=>x.id===id),...p};if(await sbSave('inventory_equipment',r))await loadData();else{ss('farm_equipment',ls('farm_equipment').map(x=>x.id===id?r:x));renderPage();}},
  async delEquip(id){if(await sbDel('inventory_equipment',id))await loadData();else{ss('farm_equipment',ls('farm_equipment').filter(x=>x.id!==id));renderPage();}}
};
const Notifs={all:()=>ls('farm_notifs'),add(n){ss('farm_notifs',[n,...ls('farm_notifs')].slice(0,120));},markRead(id){ss('farm_notifs',ls('farm_notifs').map(n=>n.id===id?{...n,read:true}:n));},markAllRead(){ss('farm_notifs',ls('farm_notifs').map(n=>({...n,read:true})));},clear(){ss('farm_notifs',[]);},hasId(id){return ls('farm_notifs').some(n=>n.id===id);}};

// ---- SETTINGS ----
const DEFAULT_SETTINGS={farmName:'بيان المزرعة',ownerName:'مدير المزرعة',currency:'ج.م',logoUrl:'',farmAddress:'',goatBreeds:['شامي','بور','بلدي'],sheepBreeds:['برقي','دوربر','ميت ماستر'],pregnancyDays:150,vaccinationAlertDays:7,weaningDays:60,supabaseUrl:'',supabaseKey:''};
function getSettings(){
  const cfg=window.FARM_CONFIG||{};
  const saved=lsObj('farm_settings',DEFAULT_SETTINGS);
  // config.js يأخذ أولوية على أي شيء محفوظ
  if(cfg.farmName)saved.farmName=cfg.farmName;
  if(cfg.ownerName)saved.ownerName=cfg.ownerName;
  if(cfg.currency)saved.currency=cfg.currency;
  if(cfg.supabaseUrl)saved.supabaseUrl=cfg.supabaseUrl;
  if(cfg.supabaseKey)saved.supabaseKey=cfg.supabaseKey;
  return saved;
}
function saveSettings(s){ss('farm_settings',s);}

// ---- AUTH ----
function getUser(){try{return JSON.parse(sessionStorage.getItem('farm_user')||'null');}catch{return null;}}
function setUser(u){sessionStorage.setItem('farm_user',JSON.stringify(u));}
window.logout=function(){sessionStorage.removeItem('farm_user');showLogin();};

// ---- SUPABASE DIRECT FETCH (لا يحتاج أي library) ----
let sb=null; // kept for compatibility checks
let SB_URL='', SB_KEY='';

function initSB(){
  const cfg=window.FARM_CONFIG||{};
  const s=getSettings();
  SB_URL=(cfg.supabaseUrl||s.supabaseUrl||'').replace(/\/$/,'');
  SB_KEY=cfg.supabaseKey||s.supabaseKey||'';
  if(SB_URL&&SB_KEY){sb=true;return true;}
  sb=null;return false;
}

// طلب مباشر لـ Supabase REST API بدون أي مكتبة خارجية
async function sbReq(table, method='GET', body=null, filter=''){
  const url=`${SB_URL}/rest/v1/${table}${filter?'?'+filter:''}`;
  const opts={method,headers:{'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Content-Type':'application/json','Prefer':method==='POST'?'return=representation':''}};
  if(body)opts.body=JSON.stringify(body);
  const res=await fetch(url,opts);
  if(!res.ok){const err=await res.text();throw new Error(`${table} ${method}: ${res.status} ${err}`);}
  if(method==='DELETE'||res.status===204)return{data:null};
  const data=await res.json();
  return{data};
}

// دوال مساعدة مطابقة لـ Supabase JS client
const SB={
  select:(t,filter='')=>sbReq(t,'GET',null,filter+'&order=created_at.desc&limit=2000'),
  insert:(t,rec)=>sbReq(t,'POST',rec),
  upsert:(t,rec)=>sbReq(t,'POST',rec,'on_conflict=id'),
  update:(t,id,patch)=>sbReq(t,'PATCH',patch,`id=eq.${id}`),
  delete:(t,id)=>sbReq(t,'DELETE',null,`id=eq.${id}`),
};

// ---- APP STATE ----
const S={route:'dash',routeHistory:[],animals:[],vaccinations:[],notes:[],breeding:[],health:[],finance:[],meds:[],feeds:[],equipment:[],weights:[],milk:[],loading:false,animalFilter:{search:'',species:'all',purpose:'all',status:'alive'}};

// ---- NAVIGATION ----
function navigate(route,pushHistory=true){if(pushHistory&&S.route!==route)S.routeHistory.push(S.route);S.route=route;renderAll();}
function goBack(){if(S.routeHistory.length>0)navigate(S.routeHistory.pop(),false);else navigate('dash',false);}
window.navigate=navigate;window.goBack=goBack;
function renderAll(){updateNavbar();renderSidebar();renderTabs();renderPage();updateBadge();}

// ---- NAVBAR ----
const PAGE_TITLES={dash:'النظرة العامة',animals:'إدارة القطيع',goats:'قسم الماعز',sheep:'قسم الأغنام',vaccine:'التحصين',health:'السجل الصحي',breeding:'التكاثر والولادة',finance:'المالية',inventory:'التغذية والمخزن',reports:'التقارير',notifications:'الإشعارات',users:'إدارة المستخدمين','farm-profile':'ملف المزرعة',settings:'الإعدادات',data:'الملاحظات'};
function updateNavbar(){
  const s=getSettings();const u=getUser();
  document.getElementById('nav-farm-name').textContent=s.farmName;
  document.getElementById('today-display').textContent=todayAr();
  document.getElementById('footer-name').textContent=s.farmName;
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  const backBtn=document.getElementById('back-btn');
  backBtn.style.display=(S.route.includes('/')||S.routeHistory.length>0)?'inline-flex':'none';
  const bcBar=document.getElementById('breadcrumb-bar');
  if(S.route.includes('/')){
    bcBar.style.display='block';
    const parts=S.route.split('/');
    document.getElementById('breadcrumb-content').innerHTML=`<a href="#" onclick="navigate('${parts[0]}');return false;">${PAGE_TITLES[parts[0]]||parts[0]}</a> <i class="bi bi-chevron-left" style="font-size:.62rem"></i> تفاصيل`;
  }else{bcBar.style.display='none';}
  document.getElementById('page-title-h').textContent=PAGE_TITLES[S.route]||S.route;
  const alive=S.animals.filter(a=>a.status==='alive').filter(a=>a.purpose!=='birth').length;
  const dead=S.animals.filter(a=>a.status==='dead').length;
  document.getElementById('page-subtitle').innerHTML=`${ar(alive)} حيوان حي${dead>0?` <span style="color:var(--red)">• ${ar(dead)} نافق</span>`:''}`;
}

// ---- SIDEBAR ----
const SB_SECTIONS=[
  {s:'القطيع',items:[{id:'dash',icon:'bi-grid-1x2-fill',l:'الرئيسية',p:'dash'},{id:'animals',icon:'bi-list-ul',l:'إدارة القطيع',p:'animals'},{id:'goats',icon:'bi-tropical-storm',l:'الماعز',p:'animals'},{id:'sheep',icon:'bi-cloud-fill',l:'الأغنام',p:'animals'}]},
  {s:'الصحة',items:[{id:'vaccine',icon:'bi-bandaid-fill',l:'التحصين',p:'health'},{id:'health',icon:'bi-heart-pulse-fill',l:'السجل الصحي',p:'health'},{id:'breeding',icon:'bi-diagram-2-fill',l:'التكاثر والولادة',p:'breeding'}]},
  {s:'الإدارة',items:[{id:'inventory',icon:'bi-boxes',l:'التغذية والمخزن',p:'inventory'},{id:'finance',icon:'bi-wallet2',l:'المالية',p:'finance'},{id:'reports',icon:'bi-graph-up',l:'التقارير',p:'reports'},{id:'data',icon:'bi-clipboard-data-fill',l:'الملاحظات',p:'animals'}]},
];
function renderSidebar(){
  const s=getSettings();const u=getUser();
  document.getElementById('sb-farm-name').textContent=s.farmName;
  document.getElementById('sb-avatar').textContent=(u?.name||'م').slice(0,1);
  document.getElementById('sb-user-name').textContent=u?.name||'مدير';
  const roleInfo=ROLES[u?.role||'admin'];
  document.getElementById('sb-role-label').innerHTML=`<span style="color:${roleInfo?.color}">${roleInfo?.label||''}</span>`;
  const logoEl=document.getElementById('sb-logo');
  logoEl.innerHTML=s.logoUrl?`<img src="${s.logoUrl}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:10px">`:'🐐';
  const unread=Notifs.all().filter(n=>!n.read).length;
  let html='';
  SB_SECTIONS.forEach(sec=>{
    const vis=sec.items.filter(i=>can(i.p));
    if(!vis.length)return;
    html+=`<div class="sidebar-section-label">${sec.s}</div>`;
    vis.forEach(i=>{html+=`<button class="sidebar-item${S.route===i.id?' active':''}" onclick="navigate('${i.id}');closeSidebar()"><i class="bi ${i.icon}"></i> ${i.l}</button>`;});
  });
  html+=`<div class="sidebar-divider"></div>`;
  html+=`<button class="sidebar-item${S.route==='notifications'?' active':''}" onclick="navigate('notifications');closeSidebar()"><i class="bi bi-bell-fill"></i> الإشعارات ${unread>0?`<span class="bell-badge" style="position:relative;inset:auto;margin-right:auto">${unread}</span>`:''}</button>`;
  if(can('users')){html+=`<button class="sidebar-item${S.route==='users'?' active':''}" onclick="navigate('users');closeSidebar()"><i class="bi bi-people-fill"></i> المستخدمون</button>`;}
  html+=`<button class="sidebar-item${S.route==='farm-profile'?' active':''}" onclick="navigate('farm-profile');closeSidebar()"><i class="bi bi-building"></i> ملف المزرعة</button>`;
  html+=`<button class="sidebar-item${S.route==='settings'?' active':''}" onclick="navigate('settings');closeSidebar()"><i class="bi bi-gear-fill"></i> الإعدادات</button>`;
  html+=`<div class="sidebar-divider"></div>`;
  if(can('animals'))html+=`<button class="sidebar-item" onclick="openAddAnimal();closeSidebar()"><i class="bi bi-plus-circle-fill" style="color:var(--green)"></i> إضافة حيوان</button>`;
  if(can('animals'))html+=`<button class="sidebar-item" onclick="openMarkDeath();closeSidebar()"><i class="bi bi-x-octagon-fill" style="color:var(--red)"></i> تسجيل نفوق</button>`;
  html+=`<button class="sidebar-item" onclick="exportExcel();closeSidebar()"><i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> تصدير Excel</button>`;
  document.getElementById('sidebar-nav').innerHTML=html;
}
window.openSidebar=function(){renderSidebar();document.getElementById('sidebarOverlay').classList.add('active');document.getElementById('sidebarMenu').classList.add('active');document.body.style.overflow='hidden';};
window.closeSidebar=function(){document.getElementById('sidebarOverlay').classList.remove('active');document.getElementById('sidebarMenu').classList.remove('active');document.body.style.overflow='';};

// ---- TABS ----
const TABS=[{id:'dash',l:'الرئيسية',p:'dash'},{id:'animals',l:'القطيع',p:'animals'},{id:'vaccine',l:'تحصين',p:'health'},{id:'health',l:'صحة',p:'health'},{id:'breeding',l:'تكاثر',p:'breeding'},{id:'inventory',l:'المخزن',p:'inventory'},{id:'finance',l:'مالية',p:'finance'},{id:'reports',l:'تقارير',p:'reports'}];
function renderTabs(){document.getElementById('tab-pills').innerHTML=TABS.filter(t=>can(t.p)).map(t=>`<li class="nav-item"><button class="nav-link${S.route===t.id?' active':''}" onclick="navigate('${t.id}')">${t.l}</button></li>`).join('');}

// ---- AUTO NOTIFICATIONS ----
function generateNotifications(){
  const t=todayStr();const s=getSettings();
  const existing=new Set(Notifs.all().map(n=>n.id));
  S.vaccinations.forEach(v=>{
    if(v.status==='overdue'){const id=`vo-${v.id}`;if(!existing.has(id))Notifs.add({id,type:'danger',title:'تحصين متأخر',message:`"${v.name}" للقسم ${v.target_section} متأخر`,date:t,read:false,src:'vaccination'});}
    if(v.status==='pending'&&v.scheduled_date){const d=daysFromNow(v.scheduled_date);if(d>=0&&d<=s.vaccinationAlertDays){const id=`vd-${v.id}-${v.scheduled_date}`;if(!existing.has(id))Notifs.add({id,type:'warning',title:'موعد تحصين قريب',message:`"${v.name}" بعد ${ar(d)} يوم`,date:t,read:false,src:'vaccination'});}}
  });
  Breeding.all().filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{const d=daysFromNow(r.expected_birth);if(d>=0&&d<=7){const id=`bd-${r.id}`;if(!existing.has(id))Notifs.add({id,type:d<=2?'danger':'warning',title:'موعد ولادة قريب',message:`${r.female_tag||r.female_breed} بعد ${ar(Math.max(0,d))} يوم`,date:t,read:false,src:'breeding'});}});
  Health.all().filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=t).forEach(r=>{const id=`wd-${r.id}`;if(!existing.has(id))Notifs.add({id,type:'danger',title:'فترة سحب نشطة',message:`${r.animal_tag||r.animal_breed} — لا يباع حتى ${r.withdrawal_end}`,date:t,read:false,src:'health'});});
  Inventory.meds().filter(m=>m.expiry&&daysFromNow(m.expiry)<=30&&daysFromNow(m.expiry)>=0).forEach(m=>{const id=`med-exp-${m.id}`;const d=daysFromNow(m.expiry);if(!existing.has(id))Notifs.add({id,type:d<=7?'danger':'warning',title:'دواء قارب على الانتهاء',message:`"${m.name}" ينتهي بعد ${ar(d)} يوم`,date:t,read:false,src:'inventory'});});
  Inventory.feeds().filter(f=>f.quantity<=f.min_quantity&&f.min_quantity>0).forEach(f=>{const id=`feed-low-${f.id}`;if(!existing.has(id))Notifs.add({id,type:'warning',title:'مخزون علف منخفض',message:`"${f.name}" وصل للحد الأدنى (${f.quantity} ${f.unit})`,date:t,read:false,src:'inventory'});});
  updateBadge();
}
function updateBadge(){const cnt=Notifs.all().filter(n=>!n.read).length;const b=document.getElementById('bell-badge');if(!b)return;if(cnt>0){b.style.display='flex';b.textContent=cnt>9?'9+':cnt;}else b.style.display='none';}

// ---- BREED STATS ----
function breedStats(breed){
  const alive=S.animals.filter(a=>a.status==='alive'&&a.breed===breed);
  const c=(g,p)=>alive.filter(a=>a.gender===g&&a.purpose===p).length;
  return{total:alive.length,tarbiyaMale:c('male','tarbiya'),tarbiyaFemale:c('female','tarbiya'),tasmeenMale:c('male','tasmeen'),tasmeenFemale:c('female','tasmeen'),tarbiya:c('male','tarbiya')+c('female','tarbiya'),tasmeen:c('male','tasmeen')+c('female','tasmeen')};
}

// ---- MODAL ----
function showModal(html){document.getElementById('modal-root').innerHTML=`<div class="farm-modal-backdrop" onclick="if(event.target===this)closeModal()">${html}</div>`;}
window.closeModal=function(){document.getElementById('modal-root').innerHTML='';};

// ---- PAGE ROUTER ----
function renderPage(){
  const el=document.getElementById('page-content');
  if(!getUser()){el.innerHTML='';return;}
  if(S.loading&&sb){el.innerHTML=`<div class="text-center py-5"><div class="spinner mb-3"></div><div class="text-gray">جاري التحميل...</div></div>`;return;}
  const r=S.route;
  if(r.startsWith('animals/')){renderAnimalDetail(el,r.slice(8));return;}
  if(r.startsWith('health/')){renderHealthDetail(el,r.slice(7));return;}
  if(r.startsWith('users/')){renderUserDetail(el,r.slice(6));return;}
  if(!sb&&!(window.FARM_CONFIG?.supabaseUrl)&&!getSettings().supabaseUrl&&['dash','animals','goats','sheep','vaccine','data'].includes(r)){renderSetup(el);return;}
  ({dash:renderDashboard,animals:renderAnimals,goats:()=>renderSpecies(el,'goat'),sheep:()=>renderSpecies(el,'sheep'),vaccine:renderVaccinations,health:renderHealthPage,breeding:renderBreeding,inventory:renderInventory,finance:renderFinance,reports:renderReports,notifications:renderNotifications,data:renderDataNotes,users:renderUsers,'farm-profile':renderFarmProfile,settings:renderSettings}[r]||renderDashboard)(el);
}
function renderSetup(el){el.innerHTML=`<div class="wonder-card animate-in text-center" style="max-width:460px;margin:40px auto"><div style="font-size:3rem;margin-bottom:14px">🐐</div><h4 class="fw-bold mb-2">مرحباً في بيان المزرعة</h4><p class="text-gray mb-4">أدخل بيانات Supabase أو استخدم وضع التخزين المحلي</p><div class="d-flex gap-2 justify-content-center"><button class="action-btn primary" onclick="navigate('settings')"><i class="bi bi-gear-fill"></i> إعداد Supabase</button><button class="action-btn" onclick="useLocal()"><i class="bi bi-laptop"></i> وضع محلي</button></div></div>`;}
window.useLocal=function(){S.animals=Animals.all();generateNotifications();renderPage();};

// ====================================================
// DASHBOARD
// ====================================================
function renderDashboard(el){
  const s=getSettings();
  const alive=S.animals.filter(a=>a.status==='alive');
  const tG=alive.filter(a=>a.species==='goat'&&a.purpose!=='birth').length;
  const tS=alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth').length;
  const gB=alive.filter(a=>a.species==='goat'&&a.purpose==='birth');
  const sB=alive.filter(a=>a.species==='sheep'&&a.purpose==='birth');
  const dead=S.animals.filter(a=>a.status==='dead').length;
  const pregnant=Breeding.all().filter(r=>r.status==='pregnant').length;
  const treating=Health.all().filter(r=>r.status==='active').length;
  const inc=Finance.all().filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const exp=Finance.all().filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);
  const curr=s.currency;
  const qs=[{l:'إجمالي القطيع',v:tG+tS+gB.length+sB.length,c:'var(--orange)',i:'bi-bar-chart-fill',rt:'animals'},{l:'الماعز',v:tG,c:'var(--green)',i:'bi-tropical-storm',rt:'goats'},{l:'الأغنام',v:tS,c:'var(--blue)',i:'bi-cloud-fill',rt:'sheep'},{l:'المواليد',v:gB.length+sB.length,c:'var(--yellow)',i:'bi-stars',rt:'animals'},{l:'حوامل',v:pregnant,c:'var(--purple)',i:'bi-diagram-2',rt:'breeding'},{l:'قيد العلاج',v:treating,c:'var(--red)',i:'bi-heart-pulse',rt:'health'}];
  const allBreeds=[...s.goatBreeds.map(k=>({k,e:'🐐'})),...s.sheepBreeds.map(k=>({k,e:'🐑'}))];
  el.innerHTML=`
  <div class="row g-3 mb-4">${qs.map((st,i)=>`<div class="col-6 col-md-4 col-lg-2 animate-in" style="animation-delay:${i*.05}s"><div class="summary-card" style="cursor:pointer" onclick="navigate('${st.rt}')"><i class="bi ${st.i} d-block mb-2" style="font-size:1.3rem;color:${st.c}"></i><div class="summary-number" style="color:${st.c}">${ar(st.v)}</div><small class="text-gray">${st.l}</small></div></div>`).join('')}</div>
  ${can('finance')?`<div class="row g-3 mb-4"><div class="col-md-4"><div class="wonder-card animate-in text-center"><div style="font-size:1.1rem;font-weight:700;color:var(--green)">${inc.toLocaleString('ar-EG')} ${curr}</div><small class="text-gray">الإيرادات</small></div></div><div class="col-md-4"><div class="wonder-card animate-in text-center"><div style="font-size:1.1rem;font-weight:700;color:var(--orange)">${exp.toLocaleString('ar-EG')} ${curr}</div><small class="text-gray">المصروفات</small></div></div><div class="col-md-4"><div class="wonder-card animate-in text-center"><div style="font-size:1.1rem;font-weight:700;color:${inc-exp>=0?'var(--green)':'var(--red)'}">${(inc-exp>=0?'+':'')+(inc-exp).toLocaleString('ar-EG')} ${curr}</div><small class="text-gray">صافي الربح</small></div></div></div>`:''}
  <div class="d-flex gap-2 flex-wrap mb-4 animate-in">
    ${can('animals')?`<button class="action-btn primary" onclick="openAddAnimal()"><i class="bi bi-plus-lg"></i> إضافة حيوان</button>`:''}
    ${can('animals')?`<button class="action-btn danger" onclick="openMarkDeath()"><i class="bi bi-x-octagon"></i> نفوق</button>`:''}
    <button class="action-btn" onclick="exportExcel()"><i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> Excel</button>
  </div>
  <div class="section-header animate-in"><div class="section-title"><i class="bi bi-grid-3x3-gap-fill accent-text"></i> توزيع السلالات</div><button class="action-btn sm" onclick="navigate('animals')">عرض الكل <i class="bi bi-arrow-left"></i></button></div>
  <div class="row g-3 mb-4">${allBreeds.map(({k,e},i)=>{const bs=breedStats(k);return`<div class="col-md-4 col-sm-6 animate-in" style="animation-delay:${i*.06}s"><div class="breed-card" style="cursor:pointer" onclick="navigate('animals')"><div class="breed-header"><div class="breed-icon">${e}</div><div><div class="fw-bold">${k}</div><small class="text-gray">إجمالي: ${ar(bs.total)}</small></div></div><div class="row g-2"><div class="col-6"><div class="gender-box"><span class="gender-count green-text">${ar(bs.tarbiyaMale)}</span><small class="text-gray">ذكور تربية</small></div></div><div class="col-6"><div class="gender-box"><span class="gender-count green-text">${ar(bs.tarbiyaFemale)}</span><small class="text-gray">إناث تربية</small></div></div>${bs.tasmeenMale+bs.tasmeenFemale>0?`<div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenMale)}</span><small class="text-gray">ذكور تسمين</small></div></div><div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenFemale)}</span><small class="text-gray">إناث تسمين</small></div></div>`:''}</div><div class="mt-2">${bs.tarbiya>0?`<span class="type-badge badge-tarbiya">تربية ${ar(bs.tarbiya)}</span> `:''} ${bs.tasmeen>0?`<span class="type-badge badge-tasmeen">تسمين ${ar(bs.tasmeen)}</span>`:''}</div></div></div>`;}).join('')}
  </div>
  <div class="births-section animate-in"><h6 class="fw-bold mb-3"><i class="bi bi-stars" style="color:var(--yellow)"></i> الولدات — ${ar(gB.length+sB.length)}</h6>
    <div class="row g-3">${[{t:'ولدات الماعز',b:{total:gB.length,male:gB.filter(a=>a.gender==='male').length,female:gB.filter(a=>a.gender==='female').length}},{t:'ولدات الأغنام',b:{total:sB.length,male:sB.filter(a=>a.gender==='male').length,female:sB.filter(a=>a.gender==='female').length}}].map(x=>`<div class="col-md-6"><div class="d-flex justify-content-between align-items-center p-3" style="background:rgba(255,255,255,.03);border-radius:12px"><div><div class="fw-bold">${x.t}</div><small class="text-gray">${ar(x.b.total)}</small></div><div class="d-flex gap-3"><div class="text-center"><div class="fw-bold green-text">${ar(x.b.male)}</div><small class="text-gray">ذكور</small></div><div class="text-center"><div class="fw-bold accent-text">${ar(x.b.female)}</div><small class="text-gray">إناث</small></div></div></div></div>`).join('')}</div>
  </div>`;
}

// ====================================================
// ANIMALS + PROFILES
// ====================================================
function renderAnimals(el){
  const f=S.animalFilter;let animals=[...S.animals];
  if(f.status!=='all')animals=animals.filter(a=>a.status===f.status);
  if(f.species!=='all')animals=animals.filter(a=>a.species===f.species);
  if(f.purpose!=='all')animals=animals.filter(a=>a.purpose===f.purpose);
  if(f.search){const q=f.search.toLowerCase();animals=animals.filter(a=>(a.tag||'').toLowerCase().includes(q)||(a.breed||'').includes(q));}
  animals=animals.slice(0,100);
  el.innerHTML=`
  <div class="wonder-card mb-4 animate-in"><div class="row g-2 align-items-end">
    <div class="col-md-4"><label class="text-gray" style="font-size:.72rem;font-weight:600">البحث</label><input class="field" placeholder="ابحث بالترقيم أو السلالة..." value="${f.search}" oninput="S.animalFilter.search=this.value;renderPage()"></div>
    <div class="col-md-2"><label class="text-gray" style="font-size:.72rem;font-weight:600">النوع</label><select class="field" onchange="S.animalFilter.species=this.value;renderPage()"><option value="all" ${f.species==='all'?'selected':''}>الكل</option><option value="goat" ${f.species==='goat'?'selected':''}>ماعز</option><option value="sheep" ${f.species==='sheep'?'selected':''}>أغنام</option></select></div>
    <div class="col-md-2"><label class="text-gray" style="font-size:.72rem;font-weight:600">الغرض</label><select class="field" onchange="S.animalFilter.purpose=this.value;renderPage()"><option value="all" ${f.purpose==='all'?'selected':''}>الكل</option><option value="tarbiya" ${f.purpose==='tarbiya'?'selected':''}>تربية</option><option value="tasmeen" ${f.purpose==='tasmeen'?'selected':''}>تسمين</option><option value="birth" ${f.purpose==='birth'?'selected':''}>مواليد</option></select></div>
    <div class="col-md-2"><label class="text-gray" style="font-size:.72rem;font-weight:600">الحالة</label><select class="field" onchange="S.animalFilter.status=this.value;renderPage()"><option value="alive" ${f.status==='alive'?'selected':''}>حي</option><option value="dead" ${f.status==='dead'?'selected':''}>نافق</option><option value="all" ${f.status==='all'?'selected':''}>الكل</option></select></div>
    <div class="col-md-2">${can('animals')?`<button class="action-btn primary w-100" onclick="openAddAnimal()"><i class="bi bi-plus-lg"></i> إضافة</button>`:''}</div>
  </div></div>
  <div class="d-flex justify-content-between align-items-center mb-3"><small class="text-gray">يُعرض ${ar(animals.length)} حيوان</small><button class="action-btn sm" onclick="exportAnimalsCSV()"><i class="bi bi-filetype-csv"></i> CSV</button></div>
  ${animals.length===0?`<div class="empty-state animate-in"><i class="bi bi-search"></i><p>لا توجد نتائج</p></div>`:
  animals.map(a=>`<div class="animal-row animate-in" onclick="navigate('animals/${a.id}')">
    <div class="animal-avatar">${a.species==='goat'?'🐐':'🐑'}</div>
    <div class="flex-grow-1">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <span class="fw-bold">${a.breed}</span>
        ${a.tag?`<span class="type-badge badge-gray">#${a.tag}</span>`:''}
        <span class="type-badge ${a.purpose==='tasmeen'?'badge-tasmeen':a.purpose==='birth'?'badge-blue':'badge-tarbiya'}">${{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose}</span>
        <span class="type-badge ${a.status==='alive'?'badge-tarbiya':'badge-danger'}">${a.status==='alive'?'حي':'نافق'}</span>
      </div>
      <small class="text-gray">${a.gender==='male'?'♂ ذكر':'♀ أنثى'} • ${(a.created_at||'').slice(0,10)||'—'}</small>
    </div>
    <i class="bi bi-chevron-left text-gray"></i>
  </div>`).join('')}`;
}

function renderAnimalDetail(el,id){
  let a=S.animals.find(x=>x.id===id)||Animals.all().find(x=>x.id===id);
  if(!a){el.innerHTML=`<div class="empty-state"><i class="bi bi-search"></i><p>الحيوان غير موجود</p><button class="action-btn" onclick="navigate('animals')">رجوع</button></div>`;return;}
  const weights=Weights.forAnimal(id);const milkRecs=Milk.forAnimal(id);
  const healthRecs=Health.all().filter(r=>r.animal_tag===a.tag||r.animal_tag===id);
  const breedingRecs=Breeding.all().filter(r=>r.female_tag===a.tag||r.female_tag===id||r.male_tag===a.tag);
  const latestW=weights[0]?.weight;
  el.innerHTML=`
  <div class="profile-header mb-4 animate-in">
    <div class="d-flex align-items-start gap-4 flex-wrap">
      <div style="font-size:4rem;line-height:1">${a.species==='goat'?'🐐':'🐑'}</div>
      <div class="flex-grow-1">
        <div class="d-flex align-items-center gap-2 flex-wrap mb-2">
          <h4 class="fw-bold mb-0">${a.breed} ${a.tag?`<span class="type-badge badge-gray">#${a.tag}</span>`:''}</h4>
          <span class="type-badge ${a.status==='alive'?'badge-tarbiya':'badge-danger'}">${a.status==='alive'?'حي':'نافق'}</span>
        </div>
        <div class="d-flex gap-3 flex-wrap text-gray" style="font-size:.83rem">
          <span><i class="bi bi-gender-ambiguous"></i> ${a.gender==='male'?'ذكر':'أنثى'}</span>
          <span><i class="bi bi-tag"></i> ${{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose}</span>
          ${a.birth_date?`<span><i class="bi bi-calendar3"></i> ${a.birth_date}</span>`:''}
          ${latestW?`<span><i class="bi bi-speedometer2"></i> ${latestW} كجم</span>`:''}
        </div>
        ${a.notes?`<p class="mt-2 text-gray" style="font-size:.83rem">${a.notes}</p>`:''}
      </div>
      ${can('animals')?`<div class="d-flex gap-2"><button class="action-btn sm" onclick="openEditAnimal('${id}')"><i class="bi bi-pencil-fill"></i> تعديل</button><button class="action-btn danger sm" onclick="confirmDeleteAnimal('${id}')"><i class="bi bi-trash"></i></button></div>`:''}
    </div>
  </div>
  <div class="row g-3 mb-4">
    <div class="col-6 col-md-3"><div class="stat-mini animate-in"><div class="num green-text">${ar(weights.length)}</div><div class="lbl">سجلات الوزن</div></div></div>
    <div class="col-6 col-md-3"><div class="stat-mini animate-in"><div class="num blue-text">${ar(milkRecs.length)}</div><div class="lbl">سجلات الحليب</div></div></div>
    <div class="col-6 col-md-3"><div class="stat-mini animate-in"><div class="num red-text">${ar(healthRecs.length)}</div><div class="lbl">سجلات صحية</div></div></div>
    <div class="col-6 col-md-3"><div class="stat-mini animate-in"><div class="num purple-text">${ar(breedingRecs.length)}</div><div class="lbl">سجلات تكاثر</div></div></div>
  </div>
  <div class="row g-3">
    <div class="col-md-6"><div class="wonder-card animate-in">
      <div class="section-header mb-3"><div class="section-title"><i class="bi bi-speedometer2 accent-text"></i> سجل الأوزان</div><button class="action-btn sm primary" onclick="openAddWeight('${id}','${a.tag||a.id}')"><i class="bi bi-plus-lg"></i></button></div>
      ${weights.length===0?`<div class="text-gray text-center py-3" style="font-size:.83rem">لا توجد سجلات وزن</div>`:
      `<table class="tbl" style="width:100%"><thead><tr><th>التاريخ</th><th>الوزن (كجم)</th><th>ملاحظات</th><th></th></tr></thead><tbody>${weights.slice(0,10).map(w=>`<tr><td class="text-gray">${w.date}</td><td class="fw-bold">${w.weight}</td><td class="text-gray">${w.notes||'—'}</td><td><button class="icon-btn del" onclick="delWeight('${w.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('')}</tbody></table>`}
    </div></div>
    <div class="col-md-6"><div class="wonder-card animate-in">
      <div class="section-header mb-3"><div class="section-title"><i class="bi bi-droplet-fill blue-text"></i> إنتاج الحليب</div><button class="action-btn sm primary" onclick="openAddMilk('${id}','${a.tag||a.id}')"><i class="bi bi-plus-lg"></i></button></div>
      ${milkRecs.length===0?`<div class="text-gray text-center py-3" style="font-size:.83rem">لا توجد سجلات حليب</div>`:
      `<table class="tbl" style="width:100%"><thead><tr><th>التاريخ</th><th>الكمية (لتر)</th><th></th></tr></thead><tbody>${milkRecs.slice(0,10).map(m=>`<tr><td class="text-gray">${m.date}</td><td class="fw-bold">${m.liters}</td><td><button class="icon-btn del" onclick="delMilk('${m.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('')}</tbody></table>`}
    </div></div>
    <div class="col-md-6"><div class="wonder-card animate-in">
      <div class="section-title mb-3"><i class="bi bi-heart-pulse-fill red-text"></i> السجلات الصحية</div>
      ${healthRecs.length===0?`<div class="text-gray text-center py-3" style="font-size:.83rem">لا توجد سجلات</div>`:healthRecs.slice(0,5).map(r=>`<div class="inventory-row"><div><div class="fw-bold" style="font-size:.83rem">${r.diagnosis}</div><small class="text-gray">${r.medication} • ${r.date}</small></div><span class="type-badge ${r.status==='active'?'badge-tasmeen':'badge-tarbiya'}" style="font-size:.68rem">${r.status==='active'?'نشط':'مكتمل'}</span></div>`).join('')}
    </div></div>
    <div class="col-md-6"><div class="wonder-card animate-in">
      <div class="section-title mb-3"><i class="bi bi-diagram-2-fill purple-text"></i> سجلات التكاثر</div>
      ${breedingRecs.length===0?`<div class="text-gray text-center py-3" style="font-size:.83rem">لا توجد سجلات</div>`:breedingRecs.slice(0,5).map(r=>`<div class="inventory-row"><div><div class="fw-bold" style="font-size:.83rem">${r.mating_date}</div><small class="text-gray">موعد الولادة: ${r.expected_birth||'—'}</small></div><span class="type-badge badge-blue" style="font-size:.68rem">${{pending:'انتظار',pregnant:'حامل',born:'ولدت',failed:'فشل'}[r.status]||r.status}</span></div>`).join('')}
    </div></div>
  </div>`;
}
window.openEditAnimal=function(id){
  const a=S.animals.find(x=>x.id===id)||Animals.all().find(x=>x.id===id);if(!a)return;
  const s=getSettings();const breeds=[...s.goatBreeds,...s.sheepBreeds];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-pencil-fill accent-text"></i> تعديل الحيوان</h4>
    <label>رقم الترقيم</label><input class="field" id="ea-tag" value="${a.tag||''}">
    <label>السلالة</label><select class="field" id="ea-breed">${breeds.map(b=>`<option value="${b}" ${a.breed===b?'selected':''}>${b}</option>`).join('')}</select>
    <div class="row g-2"><div class="col-6"><label>الجنس</label><select class="field" id="ea-gender"><option value="female" ${a.gender==='female'?'selected':''}>أنثى</option><option value="male" ${a.gender==='male'?'selected':''}>ذكر</option></select></div>
    <div class="col-6"><label>الغرض</label><select class="field" id="ea-purpose"><option value="tarbiya" ${a.purpose==='tarbiya'?'selected':''}>تربية</option><option value="tasmeen" ${a.purpose==='tasmeen'?'selected':''}>تسمين</option><option value="birth" ${a.purpose==='birth'?'selected':''}>مواليد</option></select></div></div>
    <label>تاريخ الميلاد</label><input type="date" class="field" id="ea-bdate" value="${a.birth_date||''}">
    <label>الحالة</label><select class="field" id="ea-status"><option value="alive" ${a.status==='alive'?'selected':''}>حي</option><option value="dead" ${a.status==='dead'?'selected':''}>نافق</option></select>
    <label>ملاحظات</label><textarea class="field" id="ea-notes" rows="2">${a.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitEditAnimal('${id}')">حفظ</button></div>
  </div>`);
};
window.submitEditAnimal=async function(id){
  const p={tag:document.getElementById('ea-tag').value.trim(),breed:document.getElementById('ea-breed').value,gender:document.getElementById('ea-gender').value,purpose:document.getElementById('ea-purpose').value,birth_date:document.getElementById('ea-bdate').value||null,status:document.getElementById('ea-status').value,notes:document.getElementById('ea-notes').value.trim()||null};
  if(sb){try{await SB.update('animals',id,p);}catch(e){toast('فشل: '+e.message,'error');return;}}else{const arr=Animals.all().map(a=>a.id===id?{...a,...p}:a);Animals.save(arr);S.animals=arr;}
  toast('تم التحديث');closeModal();navigate('animals/'+id,false);
};
window.confirmDeleteAnimal=function(id){
  if(!confirm('حذف هذا الحيوان نهائياً؟'))return;
  if(sb){SB.delete('animals',id).then(()=>{S.animals=S.animals.filter(a=>a.id!==id);toast('تم الحذف');navigate('animals');}).catch(e=>toast('فشل: '+e.message,'error'));}
  else{const arr=Animals.all().filter(a=>a.id!==id);Animals.save(arr);S.animals=arr;toast('تم الحذف');navigate('animals');}
};
window.exportAnimalsCSV=function(){const rows=[['النوع','السلالة','الجنس','الغرض','الحالة','الترقيم','تاريخ الإضافة'],...S.animals.map(a=>[a.species==='goat'?'ماعز':'أغنام',a.breed,a.gender==='male'?'ذكر':'أنثى',{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose,a.status==='alive'?'حي':'نافق',a.tag||'',(a.created_at||'').slice(0,10)])];const csv=rows.map(r=>r.join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`animals-${todayStr()}.csv`;a.click();toast('تم تصدير CSV');};

// ====================================================
// SPECIES
// ====================================================
function renderSpecies(el,species){
  const s=getSettings();const breeds=species==='goat'?s.goatBreeds:s.sheepBreeds;
  const emoji=species==='goat'?'🐐':'🐑';const color=species==='goat'?'var(--green)':'var(--blue)';
  const alive=S.animals.filter(a=>a.status==='alive');
  const total=alive.filter(a=>a.species===species&&a.purpose!=='birth').length;
  const births=alive.filter(a=>a.species===species&&a.purpose==='birth');
  const sorted=[...breeds].sort((a,b)=>breedStats(b).total-breedStats(a).total);
  el.innerHTML=`
  <div class="wonder-card mb-4 animate-in"><div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
    <div><div class="text-gray mb-1">${species==='goat'?'الماعز':'الأغنام'}</div><div class="stat-value" style="color:${color}">${emoji} ${ar(total)}</div></div>
    <div class="d-flex gap-2 flex-wrap">${can('animals')?`<button class="action-btn primary" onclick="openAddAnimal('${species}')"><i class="bi bi-plus-lg"></i> إضافة</button><button class="action-btn danger" onclick="openMarkDeath('${species}')"><i class="bi bi-x-octagon"></i> نفوق</button>`:''}</div>
  </div>${sorted[0]?`<div class="mt-3"><span class="type-badge badge-tarbiya">الأكبر: ${sorted[0]} — ${ar(breedStats(sorted[0]).total)}</span></div>`:''}</div>
  <div class="row g-3 mb-4">${breeds.map((breed,i)=>{const bs=breedStats(breed);return`<div class="col-lg-4 col-md-6 animate-in" style="animation-delay:${i*.07}s"><div class="breed-card" style="cursor:pointer" onclick="S.animalFilter.species='${species}';S.animalFilter.search='${breed}';navigate('animals')"><div class="breed-header"><div class="breed-icon">${emoji}</div><div><div class="fw-bold">${breed}</div><small class="text-gray">${ar(bs.total)} حيوان</small></div></div><div class="stat-value mb-2" style="color:${color}">${ar(bs.total)}</div><div class="row g-2"><div class="col-6"><div class="gender-box"><span class="gender-count">${ar(bs.tarbiyaMale)}</span><small class="text-gray">ذكور تربية</small></div></div><div class="col-6"><div class="gender-box"><span class="gender-count">${ar(bs.tarbiyaFemale)}</span><small class="text-gray">إناث تربية</small></div></div><div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenMale)}</span><small class="text-gray">ذكور تسمين</small></div></div><div class="col-6"><div class="gender-box"><span class="gender-count accent-text">${ar(bs.tasmeenFemale)}</span><small class="text-gray">إناث تسمين</small></div></div></div></div></div>`;}).join('')}</div>
  <div class="births-section animate-in"><h6 class="fw-bold mb-3">المواليد — ${ar(births.length)}</h6><div class="row g-3"><div class="col-6"><div class="summary-card"><div class="summary-number">${ar(births.filter(a=>a.gender==='male').length)}</div><small class="text-gray">ذكور</small></div></div><div class="col-6"><div class="summary-card"><div class="summary-number accent-text">${ar(births.filter(a=>a.gender==='female').length)}</div><small class="text-gray">إناث</small></div></div></div></div>`;
}

// ====================================================
// VACCINATIONS
// ====================================================
let vaccFilter='all';
function renderVaccinations(el){
  const vs=S.vaccinations;const done=vs.filter(v=>v.status==='done').reduce((s,v)=>s+v.count,0);
  const pend=vs.filter(v=>v.status==='pending').reduce((s,v)=>s+v.count,0);const over=vs.filter(v=>v.status==='overdue').reduce((s,v)=>s+v.count,0);const tot=done+pend+over||1;
  const filtered=vaccFilter==='all'?vs:vs.filter(v=>v.status===vaccFilter);
  el.innerHTML=`
  <div class="row g-3 mb-4">${[{l:'تم',v:done,pct:Math.round(done/tot*100),c:'var(--green)'},{l:'انتظار',v:pend,pct:Math.round(pend/tot*100),c:'var(--orange)'},{l:'متأخر',v:over,pct:Math.round(over/tot*100),c:'var(--red)'}].map(s=>`<div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><div class="text-gray">${s.l}</div><small class="fw-bold" style="color:${s.c}">${ar(s.pct)}٪</small></div></div>`).join('')}</div>
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">${['all','pending','overdue','done'].map(f=>`<button class="filter-btn${vaccFilter===f?' active':''}" onclick="vaccFilter='${f}';renderPage()">${f==='all'?'الكل':f==='done'?'منجز':f==='pending'?'انتظار':'متأخر'} (${f==='all'?vs.length:vs.filter(v=>v.status===f).length})</button>`).join('')}</div>
    ${can('health')?`<button class="action-btn primary" onclick="openAddVaccination()"><i class="bi bi-plus-lg"></i> تحصين جديد</button>`:''}
  </div>
  ${filtered.length===0?`<div class="empty-state animate-in"><i class="bi bi-bandaid"></i><p>لا توجد تحصينات</p></div>`:filtered.map(v=>`<div class="record-card animate-in"><div class="d-flex justify-content-between align-items-start flex-wrap gap-2"><div><div class="fw-bold mb-1"><span class="status-dot ${v.status==='done'?'dot-green':v.status==='overdue'?'dot-red':'dot-orange'}"></span>${v.name}</div><small class="text-gray">${v.target_section} • ${ar(v.count)} رأس${v.scheduled_date?` • ${v.scheduled_date}`:''}</small></div><div class="d-flex gap-2 align-items-center flex-wrap"><span class="${v.status==='done'?'green-text':v.status==='overdue'?'red-text':'accent-text'} fw-bold">${v.status==='done'?'تم':v.status==='overdue'?'متأخر':'انتظار'}</span>${v.status!=='done'&&can('health')?`<button class="action-btn primary sm" onclick="markVaccDone('${v.id}')"><i class="bi bi-check-lg"></i></button>`:''}${can('health')?`<button class="action-btn sm" onclick="openEditVaccination('${v.id}')"><i class="bi bi-pencil"></i></button>`:''}${can('admin')?`<button class="action-btn danger sm" onclick="delVacc('${v.id}')"><i class="bi bi-trash"></i></button>`:''}</div></div><div class="progress-wonder"><div class="progress-bar-wonder" style="width:${v.progress}%;${v.status==='overdue'?'background:linear-gradient(90deg,var(--red),#ff8a65)':''}"></div></div><small class="text-gray">${ar(v.progress)}٪</small></div>`).join('')}`;
}
window.markVaccDone=async function(id){
  if(!sb)return;
  try{await SB.update('vaccinations',id,{status:'done',done_date:todayStr(),progress:100});toast('تم');await loadData();}
  catch(e){toast('فشل: '+e.message,'error');}
};
window.delVacc=async function(id){
  if(!confirm('حذف؟'))return;if(!sb)return;
  try{await SB.delete('vaccinations',id);toast('تم');await loadData();}
  catch(e){toast('فشل: '+e.message,'error');}
};

// ====================================================
// HEALTH PAGE
// ====================================================
let healthFilter='all';
function renderHealthPage(el){
  const recs=Health.all();const t=todayStr();
  const inW=recs.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=t);
  const active=recs.filter(r=>r.status==='active');
  const filtered=healthFilter==='all'?recs:healthFilter==='active'?active:healthFilter==='withdrawal'?inW:recs.filter(r=>r.status==='completed');
  el.innerHTML=`
  <div class="row g-3 mb-4">${[{l:'قيد العلاج',v:active.length,c:'var(--orange)'},{l:'فترة سحب',v:inW.length,c:'var(--red)'},{l:'مكتملة',v:recs.filter(r=>r.status==='completed').length,c:'var(--green)'},{l:'إجمالي',v:recs.length,c:'var(--gray)'}].map(s=>`<div class="col-6 col-md-3"><div class="summary-card animate-in"><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}</div>
  ${inW.length>0?`<div class="withdrawal-alert animate-in mb-3"><div class="fw-bold mb-2 red-text"><i class="bi bi-exclamation-triangle-fill me-2"></i>${ar(inW.length)} حيوان في فترة سحب — لا يجوز البيع</div>${inW.map(r=>`<div class="d-flex align-items-center gap-2 mt-1 flex-wrap"><span class="type-badge badge-danger">${r.animal_tag||r.animal_breed}</span><small class="text-gray">${r.medication} — حتى ${r.withdrawal_end} (${ar(Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000))} يوم)</small></div>`).join('')}</div>`:''}
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">${[{f:'all',l:'الكل',cnt:recs.length},{f:'active',l:'نشط',cnt:active.length},{f:'withdrawal',l:'سحب',cnt:inW.length},{f:'completed',l:'مكتمل',cnt:recs.filter(r=>r.status==='completed').length}].map(x=>`<button class="filter-btn${healthFilter===x.f?' active':''}" onclick="healthFilter='${x.f}';renderPage()">${x.l} (${x.cnt})</button>`).join('')}</div>
    ${can('health')?`<button class="action-btn primary" onclick="openAddHealth()"><i class="bi bi-plus-lg"></i> سجل جديد</button>`:''}
  </div>
  ${filtered.length===0?`<div class="empty-state animate-in"><i class="bi bi-heart-pulse"></i><p>لا توجد سجلات</p></div>`:filtered.map(r=>{const inW2=r.withdrawal_end&&r.withdrawal_end>=t;return`<div class="record-card animate-in" style="cursor:pointer" onclick="navigate('health/${r.id}')"><div class="d-flex justify-content-between align-items-start flex-wrap gap-2"><div><div class="fw-bold mb-1"><span class="type-badge ${r.status==='completed'?'badge-tarbiya':'badge-tasmeen'} me-2">${r.status==='active'?'نشط':'مكتمل'}</span>${r.animal_breed} ${r.animal_tag?`#${r.animal_tag}`:''}</div><div class="mb-1"><span class="text-gray">التشخيص:</span> <strong>${r.diagnosis}</strong> | <span class="text-gray">الدواء:</span> <strong>${r.medication}</strong></div>${inW2?`<small class="red-text"><i class="bi bi-exclamation-triangle-fill me-1"></i>سحب حتى ${r.withdrawal_end}</small>`:''}${r.date?`<small class="text-gray d-block">${r.date}</small>`:''}</div><div class="d-flex gap-2">${r.status==='active'&&can('health')?`<button class="action-btn primary sm" onclick="event.stopPropagation();completeHealth('${r.id}')"><i class="bi bi-check-lg"></i></button>`:''}${can('health')?`<button class="action-btn sm" onclick="event.stopPropagation();openEditHealth('${r.id}')"><i class="bi bi-pencil"></i></button>`:''}${can('admin')?`<button class="action-btn danger sm" onclick="event.stopPropagation();delHealth('${r.id}')"><i class="bi bi-trash"></i></button>`:''}</div></div></div>`;}).join('')}`;
}
function renderHealthDetail(el,id){
  const r=Health.all().find(x=>x.id===id);
  if(!r){el.innerHTML=`<div class="empty-state"><i class="bi bi-search"></i><p>السجل غير موجود</p><button class="action-btn" onclick="navigate('health')">رجوع</button></div>`;return;}
  const t=todayStr();const inW=r.withdrawal_end&&r.withdrawal_end>=t;
  el.innerHTML=`
  <div class="profile-header mb-4 animate-in"><div class="d-flex justify-content-between align-items-start flex-wrap gap-3">
    <div><div class="d-flex gap-2 mb-2"><span class="type-badge ${r.status==='active'?'badge-tasmeen':'badge-tarbiya'}">${r.status==='active'?'قيد العلاج':'مكتمل'}</span>${inW?`<span class="type-badge badge-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>فترة سحب</span>`:''}</div><h4 class="fw-bold">${r.diagnosis}</h4><p class="text-gray">${r.animal_breed} ${r.animal_tag?`#${r.animal_tag}`:''}</p></div>
    ${can('health')?`<div class="d-flex gap-2">${r.status==='active'?`<button class="action-btn primary" onclick="completeHealth('${r.id}')"><i class="bi bi-check-lg"></i> إكمال</button>`:''}<button class="action-btn" onclick="openEditHealth('${r.id}')"><i class="bi bi-pencil"></i> تعديل</button><button class="action-btn danger" onclick="delHealth('${r.id}')"><i class="bi bi-trash"></i></button></div>`:''}
  </div></div>
  <div class="row g-3">
    <div class="col-md-6"><div class="wonder-card animate-in"><div class="section-title mb-3"><i class="bi bi-info-circle-fill accent-text"></i> تفاصيل العلاج</div>
      ${[['التشخيص',r.diagnosis],['الدواء',r.medication],['الجرعة',r.dosage||'—'],['التاريخ',r.date||'—'],['نهاية العلاج',r.treatment_end||'—'],['فترة السحب',r.withdrawal_days?`${r.withdrawal_days} يوم`:'—'],['ينتهي السحب',r.withdrawal_end||'—']].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold">${v}</span></div>`).join('')}
    </div></div>
    ${inW?`<div class="col-md-6"><div class="wonder-card animate-in" style="border-color:rgba(244,67,54,.3)"><div class="section-title mb-3 red-text"><i class="bi bi-exclamation-triangle-fill"></i> تحذير فترة السحب</div><p class="text-gray" style="font-size:.85rem">لا يجوز بيع الحيوان أو ذبحه أو استخدام منتجاته قبل انتهاء فترة السحب.</p><div class="mt-3 p-3 text-center" style="background:rgba(244,67,54,.07);border-radius:10px"><div style="font-size:1.6rem;font-weight:800;color:var(--red)">${ar(Math.ceil((new Date(r.withdrawal_end)-new Date())/86400000))}</div><small class="text-gray">يوم متبقي حتى ${r.withdrawal_end}</small></div></div></div>`:''  }
    ${r.notes?`<div class="col-12"><div class="wonder-card animate-in"><div class="section-title mb-2"><i class="bi bi-chat-left-text-fill accent-text"></i> ملاحظات</div><p style="font-size:.85rem;color:var(--light)">${r.notes}</p></div></div>`:''}
  </div>`;
}

// ====================================================
// BREEDING
// ====================================================
let breedingFilter='all';
const BSTATUS={pregnant:{l:'حامل',c:'var(--blue)',d:'dot-blue'},born:{l:'ولدت',c:'var(--green)',d:'dot-green'},failed:{l:'فشل',c:'var(--red)',d:'dot-red'},pending:{l:'انتظار',c:'var(--orange)',d:'dot-orange'}};
function renderBreeding(el){
  const recs=Breeding.all();const filtered=breedingFilter==='all'?recs:recs.filter(r=>r.status===breedingFilter);
  const stats={total:recs.length,pregnant:recs.filter(r=>r.status==='pregnant').length,born:recs.filter(r=>r.status==='born').length,offspring:recs.reduce((s,r)=>s+(r.offspring_count||0),0)};
  el.innerHTML=`
  <div class="row g-3 mb-4">${[{l:'إجمالي',v:stats.total,c:'var(--orange)'},{l:'حوامل',v:stats.pregnant,c:'var(--blue)'},{l:'ولادات',v:stats.born,c:'var(--green)'},{l:'مواليد',v:stats.offspring,c:'var(--yellow)'}].map(s=>`<div class="col-6 col-md-3"><div class="summary-card animate-in"><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}</div>
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar">${['all','pending','pregnant','born','failed'].map(f=>`<button class="filter-btn${breedingFilter===f?' active':''}" onclick="breedingFilter='${f}';renderPage()">${f==='all'?'الكل':BSTATUS[f]?.l||f} (${f==='all'?recs.length:recs.filter(r=>r.status===f).length})</button>`).join('')}</div>
    <button class="action-btn primary" onclick="openAddBreeding()"><i class="bi bi-plus-lg"></i> تسجيل تقريع</button>
  </div>
  ${filtered.length===0?`<div class="empty-state animate-in"><i class="bi bi-diagram-2"></i><p>لا توجد سجلات</p></div>`:filtered.map(r=>{const st=BSTATUS[r.status];const d=r.expected_birth?daysFromNow(r.expected_birth):null;return`<div class="record-card animate-in"><div class="d-flex justify-content-between align-items-start flex-wrap gap-2"><div><div class="fw-bold mb-1"><span class="status-dot ${st.d}"></span><span class="type-badge" style="background:${st.c}22;color:${st.c};border:1px solid ${st.c}44;margin-left:6px">${st.l}</span></div><div><span class="text-gray">الأنثى:</span> <strong>${r.female_tag||'—'} ${r.female_breed?`(${r.female_breed})`:''}</strong><span class="text-gray mx-2">|</span><span class="text-gray">الفحل:</span> <strong>${r.male_tag||'—'}</strong></div><small class="text-gray">تقريع: ${r.mating_date||'—'}${r.expected_birth?` | ولادة: ${r.expected_birth}`:''}${r.status==='pregnant'&&d!==null?`<span style="color:${d<7?'var(--red)':'var(--orange)'};margin-right:6px">${d>0?`متبقي ${ar(d)} يوم`:'اليوم!'}</span>`:''}${r.status==='born'&&r.offspring_count?`<span class="green-text" style="margin-right:6px">| ${ar(r.offspring_count)} مواليد</span>`:''}</small></div><div class="d-flex gap-2"><button class="action-btn sm" onclick="openEditBreeding('${r.id}')"><i class="bi bi-pencil"></i></button><button class="action-btn danger sm" onclick="delBreeding('${r.id}')"><i class="bi bi-trash"></i></button></div></div></div>`;}).join('')}`;
}

// ====================================================
// INVENTORY
// ====================================================
let inventoryTab='meds';
function renderInventory(el){
  const meds=Inventory.meds();const feeds=Inventory.feeds();const equip=Inventory.equipment();const t=todayStr();
  const expiring=meds.filter(m=>m.expiry&&daysFromNow(m.expiry)<=30&&daysFromNow(m.expiry)>=0).length;
  const lowStock=feeds.filter(f=>f.quantity<=f.min_quantity&&f.min_quantity>0).length;
  el.innerHTML=`
  <div class="row g-3 mb-4">${[{l:'أدوية',v:meds.length,c:'var(--red)',i:'bi-capsule',tab:'meds',warn:expiring>0?`${ar(expiring)} تنتهي قريباً`:''},{l:'أعلاف',v:feeds.length,c:'var(--orange)',i:'bi-bag-fill',tab:'feeds',warn:lowStock>0?`${ar(lowStock)} مخزون منخفض`:''},{l:'معدات',v:equip.length,c:'var(--blue)',i:'bi-tools',tab:'equip',warn:''}].map(s=>`<div class="col-md-4 animate-in"><div class="summary-card" style="cursor:pointer" onclick="inventoryTab='${s.tab}';renderPage()"><i class="bi ${s.i} d-block mb-2" style="font-size:1.4rem;color:${s.c}"></i><div class="summary-number" style="color:${s.c}">${ar(s.v)}</div><div class="text-gray">${s.l}</div>${s.warn?`<small class="red-text">${s.warn}</small>`:''}</div></div>`).join('')}</div>
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="filter-bar"><button class="filter-btn${inventoryTab==='meds'?' active':''}" onclick="inventoryTab='meds';renderPage()"><i class="bi bi-capsule"></i> الصيدلية (${meds.length})</button><button class="filter-btn${inventoryTab==='feeds'?' active':''}" onclick="inventoryTab='feeds';renderPage()"><i class="bi bi-bag-fill"></i> الأعلاف (${feeds.length})</button><button class="filter-btn${inventoryTab==='equip'?' active':''}" onclick="inventoryTab='equip';renderPage()"><i class="bi bi-tools"></i> المعدات (${equip.length})</button></div>
    <button class="action-btn primary" onclick="openAddInventoryItem()"><i class="bi bi-plus-lg"></i> إضافة</button>
  </div>
  ${inventoryTab==='meds'?renderMedsTable(meds):''}${inventoryTab==='feeds'?renderFeedsTable(feeds):''}${inventoryTab==='equip'?renderEquipTable(equip):''}`;
}
function renderMedsTable(meds){
  if(!meds.length)return`<div class="empty-state animate-in"><i class="bi bi-capsule"></i><p>لا توجد أدوية</p><button class="action-btn primary" onclick="openAddInventoryItem()"><i class="bi bi-plus-lg"></i> إضافة دواء</button></div>`;
  return`<div class="wonder-card p-0 animate-in"><div class="table-responsive"><table class="tbl" style="width:100%"><thead><tr><th>الدواء</th><th>الكمية</th><th>الوحدة</th><th>الانتهاء</th><th>الغرض</th><th></th></tr></thead><tbody>${meds.map(m=>{const d=m.expiry?daysFromNow(m.expiry):null;return`<tr><td class="fw-bold">${m.name}</td><td>${m.quantity}</td><td class="text-gray">${m.unit||'—'}</td><td class="${d===null?'text-gray':d<=7?'red-text':'green-text'}">${m.expiry||'—'}${d!==null&&d<=30?` (${ar(d)} يوم)`:''}</td><td class="text-gray">${m.purpose||'—'}</td><td><div class="d-flex gap-1"><button class="icon-btn edit" onclick="openEditMed('${m.id}')"><i class="bi bi-pencil"></i></button><button class="icon-btn del" onclick="delMed('${m.id}')"><i class="bi bi-trash"></i></button></div></td></tr>`;}).join('')}</tbody></table></div></div>`;
}
function renderFeedsTable(feeds){
  if(!feeds.length)return`<div class="empty-state animate-in"><i class="bi bi-bag-fill"></i><p>لا توجد أعلاف</p><button class="action-btn primary" onclick="openAddInventoryItem()"><i class="bi bi-plus-lg"></i> إضافة علف</button></div>`;
  return`<div class="wonder-card p-0 animate-in"><div class="table-responsive"><table class="tbl" style="width:100%"><thead><tr><th>العلف</th><th>الكمية</th><th>الوحدة</th><th>الحد الأدنى</th><th>التكلفة/${getSettings().currency}</th><th></th></tr></thead><tbody>${feeds.map(f=>{const low=f.quantity<=f.min_quantity&&f.min_quantity>0;return`<tr><td class="fw-bold">${f.name}</td><td class="${low?'red-text':'fw-bold'}">${f.quantity}${low?' ⚠️':''}</td><td class="text-gray">${f.unit||'—'}</td><td class="text-gray">${f.min_quantity||0}</td><td class="text-gray">${f.cost_per_unit||'—'}</td><td><div class="d-flex gap-1"><button class="icon-btn edit" onclick="openEditFeed('${f.id}')"><i class="bi bi-pencil"></i></button><button class="icon-btn del" onclick="delFeed('${f.id}')"><i class="bi bi-trash"></i></button></div></td></tr>`;}).join('')}</tbody></table></div></div>`;
}
function renderEquipTable(equip){
  if(!equip.length)return`<div class="empty-state animate-in"><i class="bi bi-tools"></i><p>لا توجد معدات</p><button class="action-btn primary" onclick="openAddInventoryItem()"><i class="bi bi-plus-lg"></i> إضافة معدة</button></div>`;
  return`<div class="wonder-card p-0 animate-in"><div class="table-responsive"><table class="tbl" style="width:100%"><thead><tr><th>المعدة</th><th>النوع</th><th>الحالة</th><th>صيانة قادمة</th><th>ملاحظات</th><th></th></tr></thead><tbody>${equip.map(e=>{const d=e.next_maintenance?daysFromNow(e.next_maintenance):null;return`<tr><td class="fw-bold">${e.name}</td><td class="text-gray">${e.type||'—'}</td><td><span class="type-badge ${e.status==='working'?'badge-tarbiya':e.status==='broken'?'badge-danger':'badge-yellow'}">${{working:'يعمل',broken:'معطل',maintenance:'صيانة'}[e.status]||e.status}</span></td><td class="${d!==null&&d<=30?'red-text':'text-gray'}">${e.next_maintenance||'—'}${d!==null&&d<=30?` (${ar(d)} يوم)`:''}</td><td class="text-gray">${e.notes||'—'}</td><td><div class="d-flex gap-1"><button class="icon-btn edit" onclick="openEditEquip('${e.id}')"><i class="bi bi-pencil"></i></button><button class="icon-btn del" onclick="delEquip('${e.id}')"><i class="bi bi-trash"></i></button></div></td></tr>`;}).join('')}</tbody></table></div></div>`;
}
window.openAddInventoryItem=function(){if(inventoryTab==='meds')openAddMed('');else if(inventoryTab==='feeds')openAddFeed('');else openAddEquip('');};

// ====================================================
// FINANCE
// ====================================================
let financeFilter='all',financeMonth='';
const INCOME_CATS=['بيع حيوانات','بيع ألبان','بيع صوف','إيراد آخر'];
const EXPENSE_CATS=['أعلاف','أدوية وبيطرة','عمالة','كهرباء ومياه','معدات','نقل','مصروف آخر'];
function renderFinance(el){
  const s=getSettings();let recs=Finance.all();
  if(financeFilter!=='all')recs=recs.filter(r=>r.type===financeFilter);
  if(financeMonth)recs=recs.filter(r=>r.date.startsWith(financeMonth));
  recs.sort((a,b)=>b.date.localeCompare(a.date));
  const all=Finance.all();const totalIn=all.filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);const totalEx=all.filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);const net=totalIn-totalEx;const curr=s.currency;
  const byCat={};all.filter(r=>r.type==='expense').forEach(r=>{byCat[r.category]=(byCat[r.category]||0)+r.amount;});
  el.innerHTML=`
  <div class="row g-3 mb-4"><div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number green-text">${totalIn.toLocaleString('ar-EG')}</div><small class="text-gray">الإيرادات (${curr})</small></div></div><div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number accent-text">${totalEx.toLocaleString('ar-EG')}</div><small class="text-gray">المصروفات (${curr})</small></div></div><div class="col-md-4"><div class="summary-card animate-in"><div class="summary-number" style="color:${net>=0?'var(--green)':'var(--red)'}">${net>=0?'+':''}${net.toLocaleString('ar-EG')}</div><small class="text-gray">صافي الربح (${curr})</small></div></div></div>
  ${Object.keys(byCat).length>0?`<div class="wonder-card mb-4 animate-in"><h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> توزيع المصروفات</h6>${Object.entries(byCat).sort((a,b)=>b[1]-a[1]).map(([cat,amt])=>{const pct=totalEx>0?Math.round(amt/totalEx*100):0;return`<div class="finance-bar-wrap"><div class="lb"><span class="text-gray">${cat}</span><span class="fw-bold accent-text">${amt.toLocaleString('ar-EG')} ${curr} (${pct}٪)</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${pct}%"></div></div></div>`;}).join('')}</div>`:''}
  <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div class="d-flex gap-2 flex-wrap align-items-center">${['all','income','expense'].map(f=>`<button class="filter-btn${financeFilter===f?' active':''}" onclick="financeFilter='${f}';renderPage()">${f==='all'?'الكل':f==='income'?'إيرادات':'مصروفات'}</button>`).join('')}<input type="month" class="field" value="${financeMonth}" onchange="financeMonth=this.value;renderPage()" style="padding:5px 10px;font-size:.78rem;max-width:160px"></div>
    <button class="action-btn primary" onclick="openAddFinance()"><i class="bi bi-plus-lg"></i> إضافة</button>
  </div>
  ${recs.length===0?`<div class="empty-state animate-in"><i class="bi bi-wallet2"></i><p>لا توجد معاملات</p></div>`:`<div class="wonder-card p-0 animate-in"><div class="table-responsive"><table class="tbl" style="width:100%"><thead><tr><th>التاريخ</th><th>النوع</th><th>الفئة</th><th>الوصف</th><th>المبلغ</th><th></th></tr></thead><tbody>${recs.map(r=>`<tr><td class="text-gray">${r.date}</td><td><span class="type-badge ${r.type==='income'?'badge-tarbiya':'badge-tasmeen'}">${r.type==='income'?'إيراد':'مصروف'}</span></td><td>${r.category}</td><td>${r.description||'—'}</td><td class="fw-bold ${r.type==='income'?'green-text':'accent-text'}">${r.type==='income'?'+':'-'}${r.amount.toLocaleString('ar-EG')} ${curr}</td><td><button class="icon-btn del" onclick="delFinance('${r.id}')"><i class="bi bi-trash"></i></button></td></tr>`).join('')}</tbody></table></div></div>`}`;
}

// ====================================================
// REPORTS
// ====================================================
function renderReports(el){
  const s=getSettings();const alive=S.animals.filter(a=>a.status==='alive');const dead=S.animals.filter(a=>a.status==='dead');
  const tG=alive.filter(a=>a.species==='goat'&&a.purpose!=='birth').length;const tS=alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth').length;
  const deathRate=S.animals.length>0?Math.round(dead.length/S.animals.length*100):0;
  const sB=Breeding.all().filter(r=>r.status==='born').length;const tB=Breeding.all().filter(r=>r.status!=='pending').length;
  const fertility=tB>0?Math.round(sB/tB*100):0;
  const inc=Finance.all().filter(r=>r.type==='income').reduce((s,r)=>s+r.amount,0);
  const exp=Finance.all().filter(r=>r.type==='expense').reduce((s,r)=>s+r.amount,0);const curr=s.currency;
  el.innerHTML=`
  <div class="d-flex justify-content-end mb-3 gap-2 animate-in"><button class="action-btn" onclick="exportExcel()"><i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> Excel</button><button class="action-btn" onclick="exportReportCSV()"><i class="bi bi-filetype-csv"></i> CSV</button></div>
  <div class="row g-3 mb-4">${[{l:'إجمالي القطيع',v:tG+tS+alive.filter(a=>a.purpose==='birth').length,c:'var(--orange)',sub:`${ar(tG)} ماعز + ${ar(tS)} أغنام`},{l:'معدل النفوق',v:`${ar(deathRate)}٪`,c:deathRate>10?'var(--red)':'var(--green)',sub:`${ar(dead.length)} من ${ar(S.animals.length)}`},{l:'معدل الخصوبة',v:`${ar(fertility)}٪`,c:fertility>70?'var(--green)':'var(--orange)',sub:`${ar(sB)} ولادة`},{l:'حوامل الآن',v:Breeding.all().filter(r=>r.status==='pregnant').length,c:'var(--purple)',sub:'تحت المراقبة'}].map(s=>`<div class="col-md-3 col-6 animate-in"><div class="wonder-card text-center"><div style="font-size:1.4rem;font-weight:700;color:${s.c}">${s.v}</div><div class="fw-bold" style="font-size:.88rem">${s.l}</div><small class="text-gray">${s.sub}</small></div></div>`).join('')}</div>
  ${can('finance')?`<div class="wonder-card mb-4 animate-in"><h6 class="fw-bold mb-3"><i class="bi bi-wallet2 accent-text"></i> الملخص المالي</h6><div class="row g-3"><div class="col-4 text-center"><div style="font-size:1.1rem;font-weight:700;color:var(--green)">${inc.toLocaleString('ar-EG')} ${curr}</div><small class="text-gray">إيرادات</small></div><div class="col-4 text-center"><div style="font-size:1.1rem;font-weight:700;color:var(--orange)">${exp.toLocaleString('ar-EG')} ${curr}</div><small class="text-gray">مصروفات</small></div><div class="col-4 text-center"><div style="font-size:1.1rem;font-weight:700;color:${inc-exp>=0?'var(--green)':'var(--red)'}">${(inc-exp>=0?'+':'')+(inc-exp).toLocaleString('ar-EG')} ${curr}</div><small class="text-gray">صافي الربح</small></div></div></div>`:''}
  <div class="row g-3"><div class="col-md-6"><div class="wonder-card animate-in"><h6 class="fw-bold mb-3"><i class="bi bi-graph-up accent-text"></i> توزيع السلالات</h6>${[...s.goatBreeds,...s.sheepBreeds].map(b=>{const bs=breedStats(b);const pct=tG+tS>0?Math.round(bs.total/(tG+tS)*100):0;return`<div class="finance-bar-wrap"><div class="lb"><span>${b}</span><span class="text-gray">${ar(bs.total)} (${pct}٪)</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,var(--green),#00c853)"></div></div></div>`;}).join('')}</div></div>
  <div class="col-md-6"><div class="wonder-card animate-in"><h6 class="fw-bold mb-3"><i class="bi bi-bandaid-fill accent-text"></i> ملخص التحصين</h6>${[{l:'تم',v:S.vaccinations.filter(v=>v.status==='done').reduce((s,v)=>s+v.count,0),c:'var(--green)'},{l:'ينتظر',v:S.vaccinations.filter(v=>v.status==='pending').reduce((s,v)=>s+v.count,0),c:'var(--orange)'},{l:'متأخر',v:S.vaccinations.filter(v=>v.status==='overdue').reduce((s,v)=>s+v.count,0),c:'var(--red)'}].map(x=>`<div class="d-flex justify-content-between py-2" style="border-bottom:1px solid #1e1e1e"><span class="text-gray">${x.l}</span><span class="fw-bold" style="color:${x.c}">${ar(x.v)}</span></div>`).join('')}</div></div></div>`;
}
window.exportReportCSV=function(){const s=getSettings();const rows=[['السلالة','ذكور تربية','إناث تربية','ذكور تسمين','إناث تسمين','الإجمالي'],...[...s.goatBreeds,...s.sheepBreeds].map(b=>{const bs=breedStats(b);return[b,bs.tarbiyaMale,bs.tarbiyaFemale,bs.tasmeenMale,bs.tasmeenFemale,bs.total];})];const csv=rows.map(r=>r.join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`report-${todayStr()}.csv`;a.click();toast('تم تصدير CSV');};
window.exportAnimalsCSV=function(){const rows=[['النوع','السلالة','الجنس','الغرض','الحالة','الترقيم'],...S.animals.map(a=>[a.species==='goat'?'ماعز':'أغنام',a.breed,a.gender==='male'?'ذكر':'أنثى',{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose,a.status==='alive'?'حي':'نافق',a.tag||''])];const csv=rows.map(r=>r.join(',')).join('\n');const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,\uFEFF'+encodeURIComponent(csv);a.download=`animals-${todayStr()}.csv`;a.click();toast('تم تصدير CSV');};

// ====================================================
// NOTIFICATIONS
// ====================================================
function renderNotifications(el){
  const notifs=Notifs.all();const unread=notifs.filter(n=>!n.read).length;
  const CFG={danger:{c:'var(--red)',i:'bi-exclamation-triangle-fill'},warning:{c:'var(--orange)',i:'bi-exclamation-circle-fill'},info:{c:'var(--blue)',i:'bi-info-circle-fill'},success:{c:'var(--green)',i:'bi-check-circle-fill'}};
  const SRC={vaccination:'التحصين',breeding:'التكاثر',health:'الصحة',inventory:'المخزن',system:'النظام'};
  el.innerHTML=`
  <div class="wonder-card mb-4 animate-in"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2"><div><h5 class="fw-bold mb-1"><i class="bi bi-bell-fill accent-text"></i> الإشعارات</h5><small class="text-gray">${unread>0?`<span class="accent-text fw-bold">${ar(unread)} غير مقروء</span>`:'كل شيء مقروء'}</small></div><div class="d-flex gap-2">${unread>0?`<button class="action-btn" onclick="Notifs.markAllRead();updateBadge();toast('تم');renderPage()"><i class="bi bi-check2-all"></i> تحديد الكل كمقروء</button>`:''}${notifs.length>0?`<button class="action-btn danger" onclick="if(confirm('مسح الكل؟'))Notifs.clear(),updateBadge(),toast('تم المسح'),renderPage()"><i class="bi bi-trash"></i> مسح</button>`:''}</div></div></div>
  ${notifs.length===0?`<div class="empty-state animate-in"><i class="bi bi-bell-slash"></i><p>لا توجد إشعارات</p><small class="text-gray">ستظهر هنا تنبيهات التحصينات والولادات وفترات السحب</small></div>`:
  notifs.map(n=>{const cfg=CFG[n.type]||CFG.info;return`<div class="notif-item n-${n.type}${!n.read?' unread':''} animate-in" onclick="Notifs.markRead('${n.id}');updateBadge();renderPage()"><div class="d-flex gap-3 align-items-start"><i class="bi ${cfg.i} mt-1 flex-shrink-0" style="color:${cfg.c};font-size:.95rem"></i><div class="flex-grow-1"><div class="d-flex justify-content-between align-items-start"><div class="fw-bold" style="font-size:.88rem">${n.title}</div><div class="d-flex gap-2 align-items-center"><span class="type-badge" style="background:${cfg.c}22;color:${cfg.c};border:1px solid ${cfg.c}33;font-size:.62rem">${SRC[n.src]||n.src||''}</span>${!n.read?`<span style="width:7px;height:7px;border-radius:50%;background:${cfg.c};display:inline-block;flex-shrink:0"></span>`:''}</div></div><div class="text-gray" style="font-size:.8rem">${n.message}</div><small class="text-gray" style="font-size:.68rem;opacity:.7">${n.date}</small></div></div></div>`;}).join('')}`;
}

// ====================================================
// DATA / NOTES
// ====================================================
function renderDataNotes(el){
  const s=getSettings();const alive=S.animals.filter(a=>a.status==='alive');
  const sheepN=S.notes.filter(n=>n.category==='sheep');const goatN=S.notes.filter(n=>n.category==='goat');const genN=S.notes.filter(n=>n.category==='general');
  const tG=alive.filter(a=>a.species==='goat'&&a.purpose!=='birth').length;const tS=alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth').length;
  const gB=alive.filter(a=>a.species==='goat'&&a.purpose==='birth');const sB=alive.filter(a=>a.species==='sheep'&&a.purpose==='birth');
  const noteList=(notes)=>notes.length===0?`<small class="text-gray">لا توجد ملاحظات</small>`:notes.map((n,i)=>`<div class="note-card d-flex gap-3"><div class="note-number">${ar(i+1)}</div><div class="flex-grow-1"><div>${n.body}</div>${n.tag?`<small class="accent-text fw-bold">${n.tag}</small>`:''}</div>${can('animals')?`<button class="icon-btn del" onclick="delNote('${n.id}')"><i class="bi bi-trash"></i></button>`:''}</div>`).join('');
  el.innerHTML=`
  <div class="d-flex justify-content-end mb-3">${can('animals')?`<button class="action-btn primary" onclick="openAddNote()"><i class="bi bi-plus-lg"></i> ملاحظة جديدة</button>`:''}</div>
  <h6 class="fw-bold mb-3">ملاحظات الأغنام</h6>${noteList(sheepN)}
  <h6 class="fw-bold mb-3 mt-4">ملاحظات الماعز</h6>${noteList(goatN)}
  ${genN.length>0?`<h6 class="fw-bold mb-3 mt-4">ملاحظات عامة</h6>${noteList(genN)}`:''}
  <h6 class="fw-bold mb-3 mt-4 animate-in">جدول ملخص البيانات</h6>
  <div class="wonder-card p-0 animate-in"><div class="table-responsive"><table class="tbl" style="width:100%">
    <thead><tr><th>القسم</th><th>السلالة</th><th>ذكور تربية</th><th>إناث تربية</th><th>ذكور تسمين</th><th>إناث تسمين</th><th>الإجمالي</th></tr></thead>
    <tbody>
    ${s.goatBreeds.map((b,i)=>{const bs=breedStats(b);return`<tr>${i===0?`<td rowspan="${s.goatBreeds.length}" class="green-text fw-bold">الماعز</td>`:''}<td>${b}</td><td>${ar(bs.tarbiyaMale)}</td><td>${ar(bs.tarbiyaFemale)}</td><td>${ar(bs.tasmeenMale)}</td><td>${ar(bs.tasmeenFemale)}</td><td class="fw-bold">${ar(bs.total)}</td></tr>`;}).join('')}
    <tr style="background:rgba(0,230,118,.05)"><td colspan="2" class="green-text fw-bold">إجمالي الماعز</td><td colspan="4"></td><td class="fw-bold green-text">${ar(tG)}</td></tr>
    ${s.sheepBreeds.map((b,i)=>{const bs=breedStats(b);return`<tr>${i===0?`<td rowspan="${s.sheepBreeds.length}" class="fw-bold blue-text">الأغنام</td>`:''}<td>${b}</td><td>${ar(bs.tarbiyaMale)}</td><td>${ar(bs.tarbiyaFemale)}</td><td>${ar(bs.tasmeenMale)}</td><td>${ar(bs.tasmeenFemale)}</td><td class="fw-bold">${ar(bs.total)}</td></tr>`;}).join('')}
    <tr style="background:rgba(33,150,243,.05)"><td colspan="2" class="fw-bold blue-text">إجمالي الأغنام</td><td colspan="4"></td><td class="fw-bold blue-text">${ar(tS)}</td></tr>
    <tr style="background:rgba(255,193,7,.05)"><td colspan="6" class="fw-bold" style="color:var(--yellow)">الولدات</td><td class="fw-bold" style="color:var(--yellow)">${ar(gB.length+sB.length)}</td></tr>
    <tr style="background:rgba(255,107,53,.08)"><td colspan="6" class="accent-text fw-bold">الإجمالي الكلي</td><td class="accent-text fw-bold">${ar(tG+tS+gB.length+sB.length)}</td></tr>
    </tbody>
  </table></div></div>`;
}
window.delNote=async function(id){if(!confirm('حذف؟'))return;if(sb){await sb.from('notes').delete().eq('id',id);await loadData();}else toast('يتطلب Supabase','info');toast('تم الحذف');};

// ====================================================
// USERS
// ====================================================
function renderUsers(el){
  if(!can('users')){el.innerHTML=`<div class="empty-state animate-in"><i class="bi bi-shield-x"></i><p>غير مصرح</p></div>`;return;}
  const users=Users.all();
  el.innerHTML=`
  <div class="wonder-card mb-4 animate-in"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2"><div><h5 class="fw-bold mb-1"><i class="bi bi-people-fill accent-text"></i> إدارة المستخدمين</h5><small class="text-gray">${ar(users.length)} مستخدم</small></div><button class="action-btn primary" onclick="openAddUser()"><i class="bi bi-person-plus-fill"></i> إضافة مستخدم</button></div></div>
  <div class="row g-3">${users.map(u=>{const role=ROLES[u.role]||ROLES.worker;return`<div class="col-md-6 col-lg-4 animate-in"><div class="profile-card" onclick="navigate('users/${u.id}')"><div class="d-flex align-items-start gap-3"><div class="profile-avatar ${u.role}" style="${u.role==='admin'?'background:linear-gradient(135deg,var(--orange),#ff8a65)':u.role==='supervisor'?'background:linear-gradient(135deg,var(--blue),#1565c0)':u.role==='vet'?'background:linear-gradient(135deg,var(--green),#00c853)':'background:linear-gradient(135deg,var(--gray),#757575)'}">${u.name.slice(0,1)}</div><div class="flex-grow-1"><div class="fw-bold mb-1">${u.name}</div><div class="d-flex gap-2 mb-1"><span class="type-badge role-badge-${u.role}" style="font-size:.7rem"><i class="bi ${role.icon}" style="margin-left:3px"></i>${role.label}</span>${u.active?`<span class="type-badge badge-tarbiya" style="font-size:.62rem">نشط</span>`:`<span class="type-badge badge-gray" style="font-size:.62rem">غير نشط</span>`}</div><small class="text-gray">${u.created||'—'}</small></div><i class="bi bi-chevron-left text-gray"></i></div></div></div>`;}).join('')}</div>`;
}
function renderUserDetail(el,id){
  const u=Users.get(id);if(!u){el.innerHTML=`<div class="empty-state"><i class="bi bi-search"></i><p>المستخدم غير موجود</p></div>`;return;}
  const role=ROLES[u.role]||ROLES.worker;
  const permLabels={animals:'إدارة القطيع',health:'السجل الصحي',breeding:'التكاثر',inventory:'المخزن',finance:'المالية',reports:'التقارير',users:'إدارة المستخدمين'};
  const perms=u.role==='admin'?Object.keys(permLabels):Object.keys(permLabels).filter(p=>(ROLE_PERMS[u.role]||(()=>false))(p));
  el.innerHTML=`
  <div class="profile-header mb-4 animate-in"><div class="d-flex align-items-start gap-4 flex-wrap">
    <div class="profile-avatar ${u.role}" style="${u.role==='admin'?'background:linear-gradient(135deg,var(--orange),#ff8a65)':u.role==='supervisor'?'background:linear-gradient(135deg,var(--blue),#1565c0)':u.role==='vet'?'background:linear-gradient(135deg,var(--green),#00c853)':'background:linear-gradient(135deg,var(--gray),#757575)'}">${u.name.slice(0,1)}</div>
    <div class="flex-grow-1"><div class="d-flex align-items-center gap-2 mb-2 flex-wrap"><h4 class="fw-bold mb-0">${u.name}</h4><span class="type-badge role-badge-${u.role}"><i class="bi ${role.icon}" style="margin-left:4px"></i>${role.label}</span>${u.active?`<span class="type-badge badge-tarbiya">نشط</span>`:`<span class="type-badge badge-danger">غير نشط</span>`}</div><small class="text-gray">أُضيف ${u.created||'—'}</small></div>
    <div class="d-flex gap-2"><button class="action-btn sm" onclick="openEditUser('${id}')"><i class="bi bi-pencil-fill"></i> تعديل</button>${id!=='admin1'?`<button class="action-btn danger sm" onclick="if(confirm('حذف المستخدم؟'))Users.del('${id}'),toast('تم'),navigate('users')"><i class="bi bi-trash"></i></button>`:''}</div>
  </div></div>
  <div class="row g-3"><div class="col-md-6"><div class="wonder-card animate-in"><div class="section-title mb-3"><i class="bi bi-shield-fill accent-text"></i> الصلاحيات</div>${Object.entries(permLabels).map(([k,l])=>`<div class="info-row"><span class="info-label">${l}</span><span class="${perms.includes(k)?'green-text':'red-text'} fw-bold"><i class="bi bi-${perms.includes(k)?'check-circle-fill':'x-circle-fill'}"></i> ${perms.includes(k)?'مسموح':'محظور'}</span></div>`).join('')}</div></div>
  <div class="col-md-6"><div class="wonder-card animate-in"><div class="section-title mb-3"><i class="bi bi-person-fill accent-text"></i> بيانات الحساب</div>${[['الاسم',u.name],['الدور',role.label],['الحالة',u.active?'نشط':'غير نشط'],['تاريخ الإنشاء',u.created||'—']].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold">${v}</span></div>`).join('')}<div class="info-row"><span class="info-label">رمز PIN</span><span class="info-value">••••</span></div></div></div></div>`;
}

// ====================================================
// FARM PROFILE
// ====================================================
function renderFarmProfile(el){
  const s=getSettings();
  el.innerHTML=`
  <div class="profile-header mb-4 animate-in"><div class="d-flex align-items-start gap-4 flex-wrap">
    <div style="width:76px;height:76px;border-radius:18px;background:linear-gradient(135deg,var(--orange),#ff8a65);display:flex;align-items:center;justify-content:center;font-size:2.4rem;overflow:hidden;flex-shrink:0">${s.logoUrl?`<img src="${s.logoUrl}" style="width:100%;height:100%;object-fit:cover">`:'🐐'}</div>
    <div class="flex-grow-1"><h3 class="fw-bold mb-1">${s.farmName}</h3><div class="d-flex gap-3 flex-wrap text-gray" style="font-size:.83rem">${s.farmAddress?`<span><i class="bi bi-geo-alt-fill"></i> ${s.farmAddress}</span>`:''}<span><i class="bi bi-cash"></i> ${s.currency}</span><span><i class="bi bi-people-fill"></i> ${ar(Users.all().length)} مستخدم</span></div></div>
    ${can('admin')?`<button class="action-btn" onclick="navigate('settings')"><i class="bi bi-pencil-fill"></i> تعديل</button>`:''}
  </div></div>
  <div class="row g-3"><div class="col-md-6"><div class="wonder-card animate-in"><div class="section-title mb-3"><i class="bi bi-building accent-text"></i> بيانات المزرعة</div>
    ${[['الاسم',s.farmName],['المالك',s.ownerName],['العنوان',s.farmAddress||'—'],['العملة',s.currency],['أيام الحمل',`${s.pregnancyDays} يوم`],['تنبيه التحصين قبل',`${s.vaccinationAlertDays} يوم`],['أيام الفطام',`${s.weaningDays} يوم`]].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold">${v}</span></div>`).join('')}
  </div></div>
  <div class="col-md-6"><div class="wonder-card animate-in"><div class="section-title mb-3"><i class="bi bi-bar-chart-fill accent-text"></i> إحصائيات</div>
    ${[['إجمالي الحيوانات',ar(S.animals.length)],['الأحياء',ar(S.animals.filter(a=>a.status==='alive').length)],['سلالات الماعز',ar(getSettings().goatBreeds.length)],['سلالات الأغنام',ar(getSettings().sheepBreeds.length)],['المستخدمون',ar(Users.all().length)],['سجلات التحصين',ar(S.vaccinations.length)]].map(([k,v])=>`<div class="info-row"><span class="info-label">${k}</span><span class="info-value fw-bold green-text">${v}</span></div>`).join('')}
  </div></div></div>`;
}

// ====================================================
// SETTINGS
// ====================================================
function renderSettings(el){
  const s=getSettings();
  el.innerHTML=`
  <div class="d-flex justify-content-between align-items-center mb-4 animate-in"><div><h5 class="fw-bold mb-1"><i class="bi bi-gear-fill accent-text"></i> الإعدادات</h5><small class="text-gray">كل شيء قابل للتعديل والحفظ</small></div><button class="action-btn primary" onclick="saveSettingsForm()"><i class="bi bi-floppy-fill"></i> حفظ الكل</button></div>
  <div class="settings-section animate-in"><h6><i class="bi bi-building accent-text"></i> معلومات المزرعة</h6>
    <div class="row g-3">
      <div class="col-md-6"><label class="text-gray" style="font-size:.72rem;font-weight:600">اسم المزرعة</label><input class="field" id="set-farmName" value="${s.farmName}"></div>
      <div class="col-md-6"><label class="text-gray" style="font-size:.72rem;font-weight:600">اسم المدير</label><input class="field" id="set-ownerName" value="${s.ownerName}"></div>
      <div class="col-md-6"><label class="text-gray" style="font-size:.72rem;font-weight:600">عنوان المزرعة</label><input class="field" id="set-farmAddress" value="${s.farmAddress||''}"></div>
      <div class="col-md-6"><label class="text-gray" style="font-size:.72rem;font-weight:600">رابط شعار المزرعة</label><input class="field" id="set-logoUrl" value="${s.logoUrl||''}" placeholder="https://..." dir="ltr"></div>
      <div class="col-md-4"><label class="text-gray" style="font-size:.72rem;font-weight:600">العملة</label><select class="field" id="set-currency">${['ج.م','ر.س','د.إ','د.ك','د.ا','ل.ل','د.م'].map(c=>`<option value="${c}" ${s.currency===c?'selected':''}>${c}</option>`).join('')}</select></div>
    </div>
  </div>
  <div class="settings-section animate-in"><h6><i class="bi bi-tropical-storm accent-text"></i> سلالات الماعز</h6>
    <div id="goat-chips" class="mb-3">${s.goatBreeds.map(b=>`<span class="tag-chip">🐐 ${b}<button class="rm" onclick="removeBreed('goat','${b}')"><i class="bi bi-x-lg"></i></button></span>`).join('')}</div>
    <div class="d-flex gap-2"><input class="field" id="new-goat" placeholder="أضف سلالة ماعز..." style="flex:1"><button class="action-btn primary" onclick="addBreed('goat')"><i class="bi bi-plus-lg"></i></button></div>
  </div>
  <div class="settings-section animate-in"><h6><i class="bi bi-cloud-fill accent-text"></i> سلالات الأغنام</h6>
    <div id="sheep-chips" class="mb-3">${s.sheepBreeds.map(b=>`<span class="tag-chip" style="background:rgba(255,107,53,.09);border-color:rgba(255,107,53,.22);color:var(--orange)">🐑 ${b}<button class="rm" onclick="removeBreed('sheep','${b}')"><i class="bi bi-x-lg"></i></button></span>`).join('')}</div>
    <div class="d-flex gap-2"><input class="field" id="new-sheep" placeholder="أضف سلالة أغنام..." style="flex:1"><button class="action-btn primary" onclick="addBreed('sheep')"><i class="bi bi-plus-lg"></i></button></div>
  </div>
  <div class="settings-section animate-in"><h6><i class="bi bi-sliders accent-text"></i> المتغيرات</h6>
    <div class="row g-3">
      <div class="col-md-4"><label class="text-gray" style="font-size:.72rem;font-weight:600">أيام الحمل</label><input type="number" class="field" id="set-pregnancyDays" value="${s.pregnancyDays}" min="100" max="200"></div>
      <div class="col-md-4"><label class="text-gray" style="font-size:.72rem;font-weight:600">تنبيه التحصين قبل (أيام)</label><input type="number" class="field" id="set-vaccinationAlertDays" value="${s.vaccinationAlertDays}" min="1" max="30"></div>
      <div class="col-md-4"><label class="text-gray" style="font-size:.72rem;font-weight:600">أيام الفطام</label><input type="number" class="field" id="set-weaningDays" value="${s.weaningDays}" min="30" max="180"></div>
    </div>
  </div>
  <div class="settings-section animate-in" style="border-color:rgba(33,150,243,.22)"><h6><i class="bi bi-database-fill blue-text"></i> إعداد Supabase (قاعدة البيانات)</h6>
    <small class="text-gray d-block mb-3">أدخل بياناتك لتفعيل المزامنة مع السحابة</small>
    <label class="text-gray" style="font-size:.72rem;font-weight:600">Supabase URL</label><input class="field mb-3" id="set-supabaseUrl" value="${s.supabaseUrl||''}" placeholder="https://xxxx.supabase.co" dir="ltr">
    <label class="text-gray" style="font-size:.72rem;font-weight:600">Supabase Anon Key</label><input class="field" id="set-supabaseKey" value="${s.supabaseKey||''}" placeholder="eyJhbGciOi..." dir="ltr">
  </div>
  <div class="d-flex justify-content-end mt-3"><button class="action-btn primary" onclick="saveSettingsForm()" style="padding:10px 26px"><i class="bi bi-floppy-fill"></i> حفظ جميع الإعدادات</button></div>`;
}
window.saveSettingsForm=function(){
  const s=getSettings();
  s.farmName=document.getElementById('set-farmName').value.trim()||s.farmName;
  s.ownerName=document.getElementById('set-ownerName').value.trim()||s.ownerName;
  s.farmAddress=document.getElementById('set-farmAddress').value.trim();
  s.logoUrl=document.getElementById('set-logoUrl').value.trim();
  s.currency=document.getElementById('set-currency').value;
  s.pregnancyDays=parseInt(document.getElementById('set-pregnancyDays').value)||150;
  s.vaccinationAlertDays=parseInt(document.getElementById('set-vaccinationAlertDays').value)||7;
  s.weaningDays=parseInt(document.getElementById('set-weaningDays').value)||60;
  s.supabaseUrl=document.getElementById('set-supabaseUrl').value.trim();
  s.supabaseKey=document.getElementById('set-supabaseKey').value.trim();
  saveSettings(s);
  if(s.supabaseUrl&&s.supabaseKey){sb=null;initSB();loadData();}
  ['nav-farm-name','sb-farm-name','footer-name'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=s.farmName;});
  toast('تم حفظ الإعدادات');renderSettings(document.getElementById('page-content'));
};
window.addBreed=function(type){const inp=document.getElementById(`new-${type}`);const val=inp.value.trim();if(!val)return;const s=getSettings();const arr=type==='goat'?s.goatBreeds:s.sheepBreeds;if(arr.includes(val)){toast('موجودة','error');return;}arr.push(val);saveSettings(s);toast('تمت الإضافة');renderSettings(document.getElementById('page-content'));};
window.removeBreed=function(type,name){const s=getSettings();const arr=type==='goat'?s.goatBreeds:s.sheepBreeds;if(arr.length<=1){toast('يجب الإبقاء على سلالة','error');return;}arr.splice(arr.indexOf(name),1);saveSettings(s);toast('تم الحذف');renderSettings(document.getElementById('page-content'));};

// ====================================================
// LOGIN SYSTEM
// ====================================================
function showLogin(){
  const login=document.getElementById('login-screen');
  const main=document.getElementById('main-content');
  const nav=document.getElementById('main-navbar');
  login.style.display='block';main.style.display='none';nav.style.display='none';
  const s=getSettings();
  window.__lrole=window.__lrole||'admin';window.__lpin='';
  login.innerHTML=`<div class="login-screen"><div class="login-card">
    <div style="font-size:3.2rem;margin-bottom:14px">${s.logoUrl?`<img src="${s.logoUrl}" style="width:68px;height:68px;border-radius:14px;object-fit:cover">`:'🐐'}</div>
    <h3 class="fw-bold mb-1">${s.farmName}</h3>
    <p class="text-gray mb-4" style="font-size:.85rem">اختر دورك وأدخل رمز PIN</p>
    <div class="row g-2 mb-4">${Object.entries(ROLES).map(([role,info])=>`<div class="col-6"><button class="action-btn w-100 login-role-btn${window.__lrole===role?' primary':''}" style="justify-content:center;padding:9px" onclick="selectLoginRole('${role}')"><i class="bi ${info.icon}" style="color:${info.color}"></i> ${info.label}</button></div>`).join('')}</div>
    <div class="pin-display mb-3" id="pin-display">____</div>
    <div class="row g-2">${[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k=>`<div class="col-4"><button class="pin-btn" onclick="pinPress('${k}')">${k}</button></div>`).join('')}</div>
    <small class="text-gray d-block mt-3">رمز المدير الافتراضي: <strong>1234</strong></small>
  </div></div>`;
}
window.selectLoginRole=function(role){
  window.__lrole=role;window.__lpin='';
  document.querySelectorAll('.login-role-btn').forEach(b=>b.classList.remove('primary'));
  event.currentTarget.classList.add('primary');
  document.getElementById('pin-display').textContent='____';
};
window.pinPress=function(k){
  if(k==='⌫'){window.__lpin=(window.__lpin||'').slice(0,-1);}
  else if(k==='✓'){attemptLogin();return;}
  else{window.__lpin=(window.__lpin||'')+k;}
  const p=window.__lpin||'';
  document.getElementById('pin-display').textContent=p?'•'.repeat(p.length)+'_'.repeat(Math.max(0,4-p.length)):'____';
  if((window.__lpin||'').length>=4)attemptLogin();
};
async function attemptLogin(){
  const pin=window.__lpin||'';const role=window.__lrole||'admin';
  const users=Users.all();
  let user=users.find(u=>u.role===role&&u.pin===pin&&u.active);
  if(!user&&role==='admin'&&pin==='1234'){user=users.find(u=>u.role==='admin')||{id:'admin1',name:'مدير المزرعة',role:'admin',pin:'1234',active:true,created:todayStr()};}
  if(user){
    setUser(user);
    document.getElementById('login-screen').style.display='none';
    document.getElementById('main-content').style.display='block';
    document.getElementById('main-navbar').style.display='block';
    window.__lpin='';
    S.animalFilter={search:'',species:'all',purpose:'all',status:'alive'};
    // ننتظر supabase قبل تحميل البيانات
    await waitForSupabase();
    await loadData();
  }else{
    document.getElementById('pin-display').textContent='خطأ!';
    window.__lpin='';
    setTimeout(()=>{document.getElementById('pin-display').textContent='____';},1400);
  }
}

// ====================================================
// ALL MODALS
// ====================================================
// ADD ANIMAL
window.openAddAnimal=function(defaultSpecies){
  const s=getSettings();
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-plus-circle accent-text"></i> إضافة حيوان جديد</h4>
    <div class="row g-2">
      <div class="col-6"><label>النوع</label><select class="field" id="m-sp" onchange="updateMBreeds()"><option value="goat" ${defaultSpecies==='goat'?'selected':''}>ماعز</option><option value="sheep" ${defaultSpecies==='sheep'?'selected':''}>أغنام</option></select></div>
      <div class="col-6"><label>الغرض</label><select class="field" id="m-purpose" onchange="toggleMBreed()"><option value="tarbiya">تربية</option><option value="tasmeen">تسمين</option><option value="birth">مواليد</option></select></div>
    </div>
    <div id="m-brw"><label>السلالة</label><select class="field" id="m-breed">${(defaultSpecies==='sheep'?s.sheepBreeds:s.goatBreeds).map(b=>`<option value="${b}">${b}</option>`).join('')}</select></div>
    <div class="row g-2">
      <div class="col-6"><label>الجنس</label><select class="field" id="m-gender"><option value="female">أنثى</option><option value="male">ذكر</option></select></div>
      <div class="col-6"><label>تاريخ الميلاد</label><input type="date" class="field" id="m-bdate"></div>
    </div>
    <div class="row g-2">
      <div class="col-6"><label>رقم الترقيم</label><input class="field" id="m-tag" placeholder="A-123"></div>
      <div class="col-6"><label>الكمية</label><input type="number" class="field" id="m-qty" value="1" min="1" max="500"></div>
    </div>
    <label>ملاحظات</label><textarea class="field" id="m-notes" rows="2"></textarea>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" id="m-sub" onclick="submitAddAnimal()">حفظ</button></div>
  </div>`);
};
window.updateMBreeds=function(){const s=getSettings();const sp=document.getElementById('m-sp').value;document.getElementById('m-breed').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>`<option value="${b}">${b}</option>`).join('');};
window.toggleMBreed=function(){document.getElementById('m-brw').style.display=document.getElementById('m-purpose').value==='birth'?'none':'block';};
window.submitAddAnimal=async function(){
  const species=document.getElementById('m-sp').value;const purpose=document.getElementById('m-purpose').value;
  const breed=purpose==='birth'?'مواليد':document.getElementById('m-breed').value;
  const gender=document.getElementById('m-gender').value;const tag=document.getElementById('m-tag').value.trim();const bdate=document.getElementById('m-bdate').value||null;
  const notes=document.getElementById('m-notes').value.trim();const qty=parseInt(document.getElementById('m-qty').value)||1;
  const btn=document.getElementById('m-sub');if(btn)btn.disabled=true;
  if(sb){
    let ok=0;
    for(let i=0;i<qty;i++){
      const p={species,breed,gender,purpose,status:'alive',birth_date:bdate};
      if(tag)p.tag=qty===1?tag:`${tag}-${i+1}`;if(notes)p.notes=notes;
      try{await SB.insert('animals',p);ok++;}catch(e){console.error(e);}
    }
    if(ok>0){toast(`تمت إضافة ${ar(ok)} حيوان`);closeModal();await loadData();}else toast('فشل الحفظ','error');
  }else{
    const arr=[];for(let i=0;i<qty;i++)arr.push({id:genId(),species,breed,gender,purpose,status:'alive',birth_date:bdate,tag:qty===1?(tag||null):(tag?`${tag}-${i+1}`:null),notes:notes||null,created_at:new Date().toISOString()});
    const all=[...Animals.all(),...arr];Animals.save(all);S.animals=all;
    toast(`تمت إضافة ${ar(qty)} حيوان`);closeModal();renderPage();
  }
};

// MARK DEATH
window.openMarkDeath=function(defaultSpecies){
  const alive=S.animals.filter(a=>a.status==='alive'&&(!defaultSpecies||a.species===defaultSpecies));
  const breeds=[...new Set(alive.map(a=>a.breed))];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4 style="color:#ff8a8a"><i class="bi bi-exclamation-triangle"></i> تسجيل نفوق</h4>
    <label>السلالة</label><select class="field" id="d-breed" onchange="updateDeathList()"><option value="">— الكل —</option>${breeds.map(b=>`<option value="${b}">${b}</option>`).join('')}</select>
    <label>الحيوان (<span id="d-cnt">${ar(alive.length)}</span>)</label>
    <select class="field" id="d-animal"><option value="">— اختر —</option>${alive.slice(0,200).map(a=>`<option value="${a.id}">${a.breed} • ${a.gender==='male'?'ذكر':'أنثى'}${a.tag?` • #${a.tag}`:''}</option>`).join('')}</select>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn danger" onclick="submitDeath()">تأكيد النفوق</button></div>
  </div>`);
};
window.updateDeathList=function(){const breed=document.getElementById('d-breed').value;const cands=S.animals.filter(a=>a.status==='alive'&&(!breed||a.breed===breed));document.getElementById('d-cnt').textContent=ar(cands.length);document.getElementById('d-animal').innerHTML='<option value="">— اختر —</option>'+cands.slice(0,200).map(a=>`<option value="${a.id}">${a.breed} • ${a.gender==='male'?'ذكر':'أنثى'}${a.tag?` • #${a.tag}`:''}</option>`).join('');};
window.submitDeath=async function(){
  const id=document.getElementById('d-animal').value;if(!id){toast('يرجى اختيار حيوان','error');return;}
  if(sb){
    try{await SB.update('animals',id,{status:'dead',died_at:new Date().toISOString()});toast('تم تسجيل النفوق');closeModal();await loadData();}
    catch(e){toast('فشل: '+e.message,'error');}
  }
  else{const arr=Animals.all().map(a=>a.id===id?{...a,status:'dead',died_at:new Date().toISOString()}:a);Animals.save(arr);S.animals=arr;toast('تم');closeModal();renderPage();}
};

// VACCINATION
let editVaccId=null;
window.openAddVaccination=function(){editVaccId=null;_showVaccModal({});};
window.openEditVaccination=function(id){editVaccId=id;_showVaccModal(S.vaccinations.find(v=>v.id===id)||{});};
function _showVaccModal(v){showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-bandaid-fill accent-text"></i> ${editVaccId?'تعديل':'إضافة'} تحصين</h4>
  <label>الاسم *</label><input class="field" id="v-name" value="${v.name||''}">
  <label>القسم المستهدف *</label><input class="field" id="v-sec" value="${v.target_section||''}">
  <div class="row g-2"><div class="col-6"><label>العدد</label><input type="number" class="field" id="v-cnt" value="${v.count||0}"></div><div class="col-6"><label>الحالة</label><select class="field" id="v-stat"><option value="pending" ${v.status==='pending'?'selected':''}>انتظار</option><option value="done" ${v.status==='done'?'selected':''}>تم</option><option value="overdue" ${v.status==='overdue'?'selected':''}>متأخر</option></select></div></div>
  <div class="row g-2"><div class="col-6"><label>تاريخ الموعد</label><input type="date" class="field" id="v-sch" value="${v.scheduled_date||''}"></div><div class="col-6"><label>تاريخ التنفيذ</label><input type="date" class="field" id="v-done" value="${v.done_date||''}"></div></div>
  <label>نسبة الإنجاز</label><input type="range" class="field" id="v-prog" min="0" max="100" value="${v.progress||0}" oninput="document.getElementById('v-pct').textContent=this.value+'٪'">
  <small class="text-gray" id="v-pct">${ar(v.progress||0)}٪</small>
  <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitVaccination()">حفظ</button></div>
</div>`);}
window.submitVaccination=async function(){
  const name=document.getElementById('v-name').value.trim();const sec=document.getElementById('v-sec').value.trim();if(!name||!sec){toast('يرجى ملء الاسم والقسم','error');return;}
  const p={name,target_section:sec,count:parseInt(document.getElementById('v-cnt').value)||0,status:document.getElementById('v-stat').value,scheduled_date:document.getElementById('v-sch').value||null,done_date:document.getElementById('v-done').value||null,progress:parseInt(document.getElementById('v-prog').value)||0};
  if(!sb){toast('يتطلب Supabase','error');return;}
  try{
    if(editVaccId)await SB.update('vaccinations',editVaccId,p);else await SB.insert('vaccinations',p);
    toast(editVaccId?'تم التحديث':'تمت الإضافة');closeModal();await loadData();
  }catch(e){toast('خطأ: '+e.message,'error');}
};

// HEALTH MODAL
let editHealthId=null;
window.openAddHealth=function(){editHealthId=null;_showHealthModal({});};
window.openEditHealth=function(id){editHealthId=id;_showHealthModal(Health.all().find(r=>r.id===id)||{});};
function _showHealthModal(r){
  const s=getSettings();
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-height:92vh;overflow-y:auto"><h4><i class="bi bi-heart-pulse-fill accent-text"></i> ${editHealthId?'تعديل':'إضافة'} سجل صحي</h4>
    <div class="row g-2"><div class="col-6"><label>النوع</label><select class="field" id="h-sp" onchange="updateHBreeds()"><option value="goat" ${r.animal_species==='goat'?'selected':''}>ماعز</option><option value="sheep" ${r.animal_species==='sheep'?'selected':''}>أغنام</option></select></div><div class="col-6"><label>السلالة</label><select class="field" id="h-breed">${s.goatBreeds.map(b=>`<option value="${b}" ${r.animal_breed===b?'selected':''}>${b}</option>`).join('')}</select></div></div>
    <div class="row g-2"><div class="col-6"><label>رقم الترقيم</label><input class="field" id="h-tag" value="${r.animal_tag||''}"></div><div class="col-6"><label>التاريخ</label><input type="date" class="field" id="h-date" value="${r.date||todayStr()}"></div></div>
    <label>التشخيص *</label><input class="field" id="h-diag" value="${r.diagnosis||''}">
    <div class="row g-2"><div class="col-6"><label>الدواء *</label><input class="field" id="h-med" value="${r.medication||''}"></div><div class="col-6"><label>الجرعة</label><input class="field" id="h-dose" value="${r.dosage||''}"></div></div>
    <div class="row g-2"><div class="col-6"><label>نهاية العلاج</label><input type="date" class="field" id="h-tend" value="${r.treatment_end||''}" onchange="calcW()"></div><div class="col-6"><label>فترة السحب (أيام)</label><input type="number" class="field" id="h-wdays" value="${r.withdrawal_days||0}" min="0" onchange="calcW()"></div></div>
    <div id="h-ws" style="display:none;background:rgba(244,67,54,.05);border:1px solid rgba(244,67,54,.22);border-radius:10px;padding:8px 12px;margin-top:8px;font-size:.78rem;color:var(--red)">⚠️ لا يباع حتى: <span id="h-wd"></span></div>
    <label>الحالة</label><select class="field" id="h-stat"><option value="active" ${r.status==='active'?'selected':''}>نشط</option><option value="completed" ${r.status==='completed'?'selected':''}>مكتمل</option></select>
    <label>ملاحظات</label><textarea class="field" id="h-notes" rows="2">${r.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitHealth()">حفظ</button></div>
  </div>`);
}
window.updateHBreeds=function(){const s=getSettings();const sp=document.getElementById('h-sp').value;document.getElementById('h-breed').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>`<option value="${b}">${b}</option>`).join('');};
window.calcW=function(){const tend=document.getElementById('h-tend').value;const w=parseInt(document.getElementById('h-wdays').value)||0;if(tend&&w>0){const dt=new Date(tend);dt.setDate(dt.getDate()+w);document.getElementById('h-wd').textContent=dt.toISOString().slice(0,10);document.getElementById('h-ws').style.display='block';}else document.getElementById('h-ws').style.display='none';};
window.submitHealth=async function(){
  const diag=document.getElementById('h-diag').value.trim();const med=document.getElementById('h-med').value.trim();if(!diag||!med){toast('يرجى إدخال التشخيص والدواء','error');return;}
  const tend=document.getElementById('h-tend').value;const wdays=parseInt(document.getElementById('h-wdays').value)||0;let we='';if(tend&&wdays>0){const dt=new Date(tend);dt.setDate(dt.getDate()+wdays);we=dt.toISOString().slice(0,10);}
  const rec={id:editHealthId||genId(),animal_tag:document.getElementById('h-tag').value.trim(),animal_breed:document.getElementById('h-breed').value,animal_species:document.getElementById('h-sp').value,date:document.getElementById('h-date').value,diagnosis:diag,medication:med,dosage:document.getElementById('h-dose').value.trim(),withdrawal_days:wdays,treatment_end:tend,withdrawal_end:we,status:document.getElementById('h-stat').value,notes:document.getElementById('h-notes').value.trim()||null,created_at:editHealthId?Health.all().find(r=>r.id===editHealthId)?.created_at:new Date().toISOString()};
  closeModal();toast(editHealthId?'جاري التحديث...':'جاري الحفظ...','info');
  if(editHealthId)await Health.update(editHealthId,rec);else await Health.add(rec);
  toast(editHealthId?'تم التحديث':'تمت الإضافة');
};

// BREEDING MODAL
let editBreedingId=null;
window.openAddBreeding=function(){editBreedingId=null;_showBreedingModal({});};
window.openEditBreeding=function(id){editBreedingId=id;_showBreedingModal(Breeding.all().find(r=>r.id===id)||{});};
function _showBreedingModal(r){
  const s=getSettings();const allB=[...s.goatBreeds,...s.sheepBreeds];
  showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-height:92vh;overflow-y:auto"><h4><i class="bi bi-diagram-2-fill accent-text"></i> ${editBreedingId?'تعديل':'تسجيل'} تقريع</h4>
    <div class="row g-2"><div class="col-6"><label>نوع الأنثى</label><select class="field" id="b-sp" onchange="updateBBreeds()"><option value="goat" ${r.female_species==='goat'?'selected':''}>ماعز</option><option value="sheep" ${r.female_species==='sheep'?'selected':''}>أغنام</option></select></div><div class="col-6"><label>سلالة الأنثى</label><select class="field" id="b-fb">${s.goatBreeds.map(b=>`<option value="${b}" ${r.female_breed===b?'selected':''}>${b}</option>`).join('')}</select></div></div>
    <div class="row g-2"><div class="col-6"><label>ترقيم الأنثى *</label><input class="field" id="b-ft" value="${r.female_tag||''}"></div><div class="col-6"><label>ترقيم الفحل</label><input class="field" id="b-mt" value="${r.male_tag||''}"></div></div>
    <label>سلالة الفحل</label><select class="field" id="b-mb">${allB.map(b=>`<option value="${b}" ${r.male_breed===b?'selected':''}>${b}</option>`).join('')}</select>
    <div class="row g-2"><div class="col-6"><label>تاريخ التقريع *</label><input type="date" class="field" id="b-md" value="${r.mating_date||todayStr()}" onchange="calcEB()"></div><div class="col-6"><label>موعد الولادة</label><input type="date" class="field" id="b-ed" value="${r.expected_birth||''}"></div></div>
    <label>الحالة</label><select class="field" id="b-st" onchange="toggleBBorn()">${['pending','pregnant','born','failed'].map(st=>`<option value="${st}" ${r.status===st?'selected':''}>${{pending:'انتظار',pregnant:'حامل',born:'ولدت',failed:'فشل'}[st]}</option>`).join('')}</select>
    <div id="b-born" style="display:${r.status==='born'?'block':'none'}"><label>تاريخ الولادة الفعلي</label><input type="date" class="field" id="b-ad" value="${r.actual_birth||''}"><div class="row g-2"><div class="col-4"><label>الإجمالي</label><input type="number" class="field" min="0" id="b-tot" value="${r.offspring_count||''}"></div><div class="col-4"><label>ذكور</label><input type="number" class="field" min="0" id="b-mal" value="${r.male_offspring||''}"></div><div class="col-4"><label>إناث</label><input type="number" class="field" min="0" id="b-fem" value="${r.female_offspring||''}"></div></div></div>
    <label>ملاحظات</label><textarea class="field" id="b-notes" rows="2">${r.notes||''}</textarea>
    <div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitBreeding()">حفظ</button></div>
  </div>`);
}
window.updateBBreeds=function(){const s=getSettings();const sp=document.getElementById('b-sp').value;document.getElementById('b-fb').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>`<option value="${b}">${b}</option>`).join('');};
window.calcEB=function(){const d=document.getElementById('b-md').value;if(d){const dt=new Date(d);dt.setDate(dt.getDate()+getSettings().pregnancyDays);document.getElementById('b-ed').value=dt.toISOString().slice(0,10);}};
window.toggleBBorn=function(){document.getElementById('b-born').style.display=document.getElementById('b-st').value==='born'?'block':'none';};
window.submitBreeding=async function(){
  const ft=document.getElementById('b-ft').value.trim();if(!ft){toast('يرجى إدخال ترقيم الأنثى','error');return;}
  const status=document.getElementById('b-st').value;
  const rec={id:editBreedingId||genId(),female_tag:ft,female_breed:document.getElementById('b-fb').value,female_species:document.getElementById('b-sp').value,male_tag:document.getElementById('b-mt').value.trim(),male_breed:document.getElementById('b-mb').value,mating_date:document.getElementById('b-md').value,expected_birth:document.getElementById('b-ed').value,actual_birth:status==='born'?document.getElementById('b-ad').value:null,offspring_count:status==='born'?parseInt(document.getElementById('b-tot').value)||null:null,male_offspring:status==='born'?parseInt(document.getElementById('b-mal').value)||null:null,female_offspring:status==='born'?parseInt(document.getElementById('b-fem').value)||null:null,status,notes:document.getElementById('b-notes').value.trim()||null,created_at:editBreedingId?Breeding.all().find(r=>r.id===editBreedingId)?.created_at:new Date().toISOString()};
  closeModal();toast(editBreedingId?'جاري التحديث...':'جاري الحفظ...','info');
  if(editBreedingId)await Breeding.update(editBreedingId,rec);else await Breeding.add(rec);
  toast(editBreedingId?'تم التحديث':'تمت الإضافة');
};

// WEIGHT MODAL
window.openAddWeight=function(aid,tag){showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:380px"><h4><i class="bi bi-speedometer2 accent-text"></i> إضافة وزن</h4><label>التاريخ</label><input type="date" class="field" id="w-date" value="${todayStr()}"><label>الوزن (كجم) *</label><input type="number" class="field" id="w-kg" step="0.1" min="0" placeholder="مثال: 45.5"><label>ملاحظات</label><input class="field" id="w-notes"><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitWeight('${aid}','${tag}')">حفظ</button></div></div>`);};
window.submitWeight=async function(aid,tag){const kg=parseFloat(document.getElementById('w-kg').value);if(!kg){toast('يرجى إدخال الوزن','error');return;}closeModal();await Weights.add({id:genId(),animal_id:aid,animal_tag:tag,date:document.getElementById('w-date').value,weight:kg,notes:document.getElementById('w-notes').value.trim()||null});toast('تمت إضافة الوزن');};

// MILK MODAL
window.openAddMilk=function(aid,tag){showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:380px"><h4><i class="bi bi-droplet-fill blue-text"></i> إضافة إنتاج حليب</h4><label>التاريخ</label><input type="date" class="field" id="ml-date" value="${todayStr()}"><label>الكمية (لتر) *</label><input type="number" class="field" id="ml-liters" step="0.1" min="0" placeholder="مثال: 2.5"><label>ملاحظات</label><input class="field" id="ml-notes"><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitMilk('${aid}','${tag}')">حفظ</button></div></div>`);};
window.submitMilk=async function(aid,tag){const liters=parseFloat(document.getElementById('ml-liters').value);if(!liters){toast('يرجى إدخال الكمية','error');return;}closeModal();await Milk.add({id:genId(),animal_id:aid,animal_tag:tag,date:document.getElementById('ml-date').value,liters,notes:document.getElementById('ml-notes').value.trim()||null});toast('تمت الإضافة');};

// INVENTORY MODALS
window.openAddMed=function(id){const m=id?Inventory.meds().find(x=>x.id===id):{};showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-capsule accent-text"></i> ${id?'تعديل':'إضافة'} دواء</h4><label>الاسم *</label><input class="field" id="md-name" value="${m.name||''}"><div class="row g-2"><div class="col-6"><label>الكمية</label><input type="number" class="field" id="md-qty" value="${m.quantity||0}"></div><div class="col-6"><label>الوحدة</label><input class="field" id="md-unit" value="${m.unit||''}" placeholder="قرص، مل..."></div></div><div class="row g-2"><div class="col-6"><label>تاريخ الانتهاء</label><input type="date" class="field" id="md-exp" value="${m.expiry||''}"></div><div class="col-6"><label>الغرض</label><input class="field" id="md-purp" value="${m.purpose||''}"></div></div><label>ملاحظات</label><textarea class="field" id="md-notes" rows="2">${m.notes||''}</textarea><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitMed('${id||''}')">حفظ</button></div></div>`);};
window.openEditMed=function(id){openAddMed(id);};
window.submitMed=async function(id){const name=document.getElementById('md-name').value.trim();if(!name){toast('أدخل اسم الدواء','error');return;}const rec={id:id||genId(),name,quantity:parseFloat(document.getElementById('md-qty').value)||0,unit:document.getElementById('md-unit').value.trim(),expiry:document.getElementById('md-exp').value||null,purpose:document.getElementById('md-purp').value.trim(),notes:document.getElementById('md-notes').value.trim()||null};closeModal();if(id)await Inventory.updateMed(id,rec);else await Inventory.addMed(rec);toast(id?'تم التحديث':'تمت الإضافة');};

window.openAddFeed=function(id){const f=id?Inventory.feeds().find(x=>x.id===id):{};showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-bag-fill accent-text"></i> ${id?'تعديل':'إضافة'} علف</h4><label>الاسم *</label><input class="field" id="fd-name" value="${f.name||''}"><div class="row g-2"><div class="col-4"><label>الكمية</label><input type="number" class="field" id="fd-qty" value="${f.quantity||0}"></div><div class="col-4"><label>الوحدة</label><input class="field" id="fd-unit" value="${f.unit||''}" placeholder="كجم، طن..."></div><div class="col-4"><label>الحد الأدنى</label><input type="number" class="field" id="fd-min" value="${f.min_quantity||0}"></div></div><label>التكلفة للوحدة (${getSettings().currency})</label><input type="number" class="field" id="fd-cost" value="${f.cost_per_unit||''}" step="0.01"><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitFeed('${id||''}')">حفظ</button></div></div>`);};
window.openEditFeed=function(id){openAddFeed(id);};
window.submitFeed=async function(id){const name=document.getElementById('fd-name').value.trim();if(!name){toast('أدخل اسم العلف','error');return;}const rec={id:id||genId(),name,quantity:parseFloat(document.getElementById('fd-qty').value)||0,unit:document.getElementById('fd-unit').value.trim(),min_quantity:parseFloat(document.getElementById('fd-min').value)||0,cost_per_unit:parseFloat(document.getElementById('fd-cost').value)||null};closeModal();if(id)await Inventory.updateFeed(id,rec);else await Inventory.addFeed(rec);toast(id?'تم التحديث':'تمت الإضافة');};

window.openAddEquip=function(id){const e=id?Inventory.equipment().find(x=>x.id===id):{};showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-tools accent-text"></i> ${id?'تعديل':'إضافة'} معدة</h4><label>الاسم *</label><input class="field" id="eq-name" value="${e.name||''}"><div class="row g-2"><div class="col-6"><label>النوع</label><input class="field" id="eq-type" value="${e.type||''}" placeholder="آلة، مركبة..."></div><div class="col-6"><label>الحالة</label><select class="field" id="eq-status"><option value="working" ${e.status==='working'?'selected':''}>يعمل</option><option value="broken" ${e.status==='broken'?'selected':''}>معطل</option><option value="maintenance" ${e.status==='maintenance'?'selected':''}>صيانة</option></select></div></div><label>موعد الصيانة القادمة</label><input type="date" class="field" id="eq-maint" value="${e.next_maintenance||''}"><label>ملاحظات</label><textarea class="field" id="eq-notes" rows="2">${e.notes||''}</textarea><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitEquip('${id||''}')">حفظ</button></div></div>`);};
window.openEditEquip=function(id){openAddEquip(id);};
window.submitEquip=async function(id){const name=document.getElementById('eq-name').value.trim();if(!name){toast('أدخل اسم المعدة','error');return;}const rec={id:id||genId(),name,type:document.getElementById('eq-type').value.trim(),status:document.getElementById('eq-status').value,next_maintenance:document.getElementById('eq-maint').value||null,notes:document.getElementById('eq-notes').value.trim()||null};closeModal();if(id)await Inventory.updateEquip(id,rec);else await Inventory.addEquip(rec);toast(id?'تم التحديث':'تمت الإضافة');};

// FINANCE MODAL
window.openAddFinance=function(){const s=getSettings();showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-wallet2 accent-text"></i> إضافة معاملة مالية</h4><div class="row g-2"><div class="col-6"><label>التاريخ</label><input type="date" class="field" id="f-date" value="${todayStr()}"></div><div class="col-6"><label>النوع</label><select class="field" id="f-type" onchange="updateFCats()"><option value="income">إيراد</option><option value="expense">مصروف</option></select></div></div><label>الفئة *</label><select class="field" id="f-cat">${INCOME_CATS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><div class="row g-2"><div class="col-6"><label>المبلغ (${s.currency}) *</label><input type="number" class="field" id="f-amount" min="0" step="0.01"></div><div class="col-6"><label>الوصف</label><input class="field" id="f-desc"></div></div><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitFinance()">حفظ</button></div></div>`);};
window.updateFCats=function(){const t=document.getElementById('f-type').value;document.getElementById('f-cat').innerHTML=(t==='income'?INCOME_CATS:EXPENSE_CATS).map(c=>`<option value="${c}">${c}</option>`).join('');};
window.submitFinance=async function(){const amount=parseFloat(document.getElementById('f-amount').value);const cat=document.getElementById('f-cat').value;if(!amount||!cat){toast('يرجى إدخال المبلغ والفئة','error');return;}closeModal();toast('جاري الحفظ...','info');await Finance.add({id:genId(),date:document.getElementById('f-date').value,type:document.getElementById('f-type').value,category:cat,amount,description:document.getElementById('f-desc').value.trim(),created_at:new Date().toISOString()});toast('تمت الإضافة');};

// USER MODALS
window.openAddUser=function(){_showUserModal({});};
window.openEditUser=function(id){_showUserModal(Users.get(id)||{id});};
function _showUserModal(u){const isEdit=!!(u.id&&u.name);showModal(`<div class="farm-modal" onclick="event.stopPropagation()"><h4><i class="bi bi-person-plus-fill accent-text"></i> ${isEdit?'تعديل':'إضافة'} مستخدم</h4><label>الاسم الكامل *</label><input class="field" id="u-name" value="${u.name||''}"><label>الدور</label><select class="field" id="u-role">${Object.entries(ROLES).map(([k,v])=>`<option value="${k}" ${u.role===k?'selected':''}>${v.label}</option>`).join('')}</select><label>رمز PIN${isEdit?' (اتركه فارغاً للإبقاء)':' *'}</label><input type="password" class="field" id="u-pin" placeholder="••••" maxlength="8"><label>الحالة</label><select class="field" id="u-active"><option value="true" ${u.active!==false?'selected':''}>نشط</option><option value="false" ${u.active===false?'selected':''}>غير نشط</option></select><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitUser('${u.id||''}')">حفظ</button></div></div>`);}
window.submitUser=function(existingId){const name=document.getElementById('u-name').value.trim();if(!name){toast('يرجى إدخال الاسم','error');return;}const pin=document.getElementById('u-pin').value.trim();const role=document.getElementById('u-role').value;const active=document.getElementById('u-active').value==='true';if(!existingId&&!pin){toast('يرجى إدخال PIN','error');return;}if(pin&&pin.length<4){toast('PIN يجب أن يكون 4 أرقام','error');return;}if(existingId){const p={name,role,active};if(pin)p.pin=pin;Users.update(existingId,p);toast('تم التحديث');}else{Users.add({id:genId(),name,role,pin,active,created:todayStr()});toast('تمت الإضافة');}closeModal();navigate('users');};

// NOTE MODAL
window.openAddNote=function(){showModal(`<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:400px"><h4><i class="bi bi-plus-circle accent-text"></i> إضافة ملاحظة</h4><label>القسم</label><select class="field" id="n-cat"><option value="general">عامة</option><option value="goat">ماعز</option><option value="sheep">أغنام</option></select><label>الملاحظة *</label><textarea class="field" id="n-body" rows="3"></textarea><label>التصنيف</label><input class="field" id="n-tag"><div class="d-flex gap-2 justify-content-end mt-3"><button class="action-btn" onclick="closeModal()">إلغاء</button><button class="action-btn primary" onclick="submitNote()">حفظ</button></div></div>`);};
window.submitNote=async function(){const body=document.getElementById('n-body').value.trim();if(!body){toast('يرجى كتابة الملاحظة','error');return;}if(!sb){toast('يتطلب Supabase','error');return;}const{error}=await sb.from('notes').insert({category:document.getElementById('n-cat').value,body,tag:document.getElementById('n-tag').value.trim()||null});if(error)toast('خطأ: '+error.message,'error');else{toast('تمت الإضافة');closeModal();await loadData();}};

// EXCEL EXPORT
window.exportExcel=function(){
  if(typeof XLSX==='undefined'){toast('مكتبة Excel غير متاحة','error');return;}
  const s=getSettings();const wb=XLSX.utils.book_new();
  const sum=[['القسم','السلالة','ذكور تربية','إناث تربية','ذكور تسمين','إناث تسمين','الإجمالي'],...[...s.goatBreeds,...s.sheepBreeds].map(b=>{const bs=breedStats(b);return[s.goatBreeds.includes(b)?'الماعز':'الأغنام',b,bs.tarbiyaMale,bs.tarbiyaFemale,bs.tasmeenMale,bs.tasmeenFemale,bs.total];})];
  const ws1=XLSX.utils.aoa_to_sheet(sum);ws1['!cols']=Array(7).fill({wch:16});XLSX.utils.book_append_sheet(wb,ws1,'الملخص');
  const list=[['النوع','السلالة','الجنس','الغرض','الحالة','الترقيم','الإضافة'],...S.animals.map(a=>[a.species==='goat'?'ماعز':'أغنام',a.breed,a.gender==='male'?'ذكر':'أنثى',{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose,a.status==='alive'?'حي':'نافق',a.tag||'',(a.created_at||'').slice(0,10)])];
  const ws2=XLSX.utils.aoa_to_sheet(list);ws2['!cols']=Array(7).fill({wch:14});XLSX.utils.book_append_sheet(wb,ws2,'الحيوانات');
  if(can('finance')){const fin=[['التاريخ','النوع','الفئة','الوصف','المبلغ'],...Finance.all().map(r=>[r.date,r.type==='income'?'إيراد':'مصروف',r.category,r.description||'',r.amount])];const ws3=XLSX.utils.aoa_to_sheet(fin);ws3['!cols']=Array(5).fill({wch:16});XLSX.utils.book_append_sheet(wb,ws3,'المالية');}
  XLSX.writeFile(wb,`farm-${todayStr()}.xlsx`);toast('تم تصدير التقرير');
};


// ---- ASYNC HELPERS (كل الحذف والتعديل يمر من هنا) ----
window.delBreeding=async function(id){if(!confirm('حذف هذا السجل؟'))return;await Breeding.del(id);toast('تم الحذف');};
window.delHealth=async function(id){if(!confirm('حذف هذا السجل؟'))return;await Health.del(id);toast('تم الحذف');if(S.route.startsWith('health/'))navigate('health');};
window.completeHealth=async function(id){await Health.update(id,{status:'completed'});toast('تم إكمال العلاج');};
window.delFinance=async function(id){if(!confirm('حذف هذه المعاملة؟'))return;await Finance.del(id);toast('تم الحذف');};
window.delMed=async function(id){if(!confirm('حذف هذا الدواء؟'))return;await Inventory.delMed(id);toast('تم الحذف');};
window.delFeed=async function(id){if(!confirm('حذف هذا العلف؟'))return;await Inventory.delFeed(id);toast('تم الحذف');};
window.delEquip=async function(id){if(!confirm('حذف هذه المعدة؟'))return;await Inventory.delEquip(id);toast('تم الحذف');};
window.delWeight=async function(id){await Weights.del(id);toast('تم الحذف');};
window.delMilk=async function(id){await Milk.del(id);toast('تم الحذف');};

// ====================================================
// LOAD DATA
// ====================================================
async function loadData(){
  if(!initSB()){
    S.animals=Animals.all();
    S.breeding=ls('farm_breeding');S.health=ls('farm_health');
    S.finance=ls('farm_finance');S.meds=ls('farm_meds');
    S.feeds=ls('farm_feeds');S.equipment=ls('farm_equipment');
    S.weights=ls('farm_weights');S.milk=ls('farm_milk');
    generateNotifications();renderAll();return;
  }
  S.loading=true;renderPage();
  try{
    // كل الطلبات مباشرة بدون library
    const [a,v,n,br,hl,fi,md,fd,eq,wt,mk]=await Promise.all([
      SB.select('animals'),
      SB.select('vaccinations','order=scheduled_date.asc'),
      SB.select('notes','order=created_at.asc'),
      SB.select('breeding'),
      SB.select('health'),
      SB.select('finance'),
      SB.select('inventory_meds'),
      SB.select('inventory_feeds'),
      SB.select('inventory_equipment'),
      SB.select('weights','order=date.desc&limit=2000'),
      SB.select('milk','order=date.desc&limit=2000'),
    ]);
    if(a.data){S.animals=a.data;Animals.save(a.data);}
    if(v.data)S.vaccinations=v.data;
    if(n.data)S.notes=n.data;
    if(br.data)S.breeding=br.data;
    if(hl.data)S.health=hl.data;
    if(fi.data)S.finance=fi.data;
    if(md.data)S.meds=md.data;
    if(fd.data)S.feeds=fd.data;
    if(eq.data)S.equipment=eq.data;
    if(wt.data)S.weights=wt.data;
    if(mk.data)S.milk=mk.data;
    generateNotifications();
  }catch(e){
    console.error('loadData error:',e);
    toast('❌ خطأ: '+e.message,'error');
    S.animals=Animals.all();
  }
  S.loading=false;renderAll();
}

// ====================================================
// INIT
// ====================================================
async function waitForSupabase(maxMs=8000){
  // ننتظر حتى يتحمل مكتبة supabase (مهم على الموبايل)
  const start=Date.now();
  while(!window.supabase){
    if(Date.now()-start>maxMs)return false;
    await new Promise(r=>setTimeout(r,100));
  }
  return true;
}

async function startApp(){
  Users.init();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  const u=getUser();
  if(u){
    document.getElementById('main-content').style.display='block';
    document.getElementById('main-navbar').style.display='block';
    // ننتظر supabase قبل تحميل البيانات
    await waitForSupabase();
    await loadData();
  }else{
    document.getElementById('main-content').style.display='none';
    document.getElementById('main-navbar').style.display='none';
    showLogin();
  }
}

// نستخدم load بدل DOMContentLoaded لضمان تحميل كل السكريبتات
window.addEventListener('load', startApp);
