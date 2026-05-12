'use strict';
// ── Firebase REST API (بدون أي library) ──────────────────
const AR=['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
const ar=n=>String(n??'').replace(/\d/g,d=>AR[+d]);
const todayStr=()=>new Date().toISOString().slice(0,10);
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}

// ── AUTH ─────────────────────────────────────────────────
function getUser(){try{return JSON.parse(localStorage.getItem('farm_user')||'null');}catch{return null;}}
function setUser(u){localStorage.setItem('farm_user',JSON.stringify(u));}
function logout(){localStorage.removeItem('farm_user');window.location.href='login.html';}
function requireAuth(){if(!getUser()){window.location.href='login.html';return false;}return true;}

const ROLES={
  admin:      {label:'مدير',      icon:'bi-shield-fill',      color:'var(--orange)'},
  supervisor: {label:'مشرف',      icon:'bi-person-badge-fill', color:'var(--blue)'},
  vet:        {label:'طبيب بيطري',icon:'bi-heart-pulse-fill',  color:'var(--green)'},
  worker:     {label:'عامل',      icon:'bi-person-fill',       color:'var(--gray)'},
};
const ROLE_PERMS={
  admin:      ()=>true,
  supervisor: p=>!['users','finance','activity'].includes(p),
  vet:        p=>['health','vaccine','breeding','dash','notifications'].includes(p),
  worker:     p=>['dash','animals','notifications'].includes(p),
};
function can(page){
  const u=getUser();if(!u)return false;
  if(u.role==='admin')return true;
  return (ROLE_PERMS[u.role]||(()=>false))(page);
}

// ── FIREBASE REST ─────────────────────────────────────────
let FB_URL='', FB_SECRET='';
function initFirebase(){
  const cfg=window.FARM_CONFIG||{};
  FB_URL=(cfg.firebaseUrl||'').replace(/\/$/,'');
  FB_SECRET=cfg.firebaseSecret||'';
  return !!FB_URL;
}

function fbUrl(path,id=''){
  const base=`${FB_URL}/${path}${id?'/'+id:''}.json`;
  return FB_SECRET?`${base}?auth=${FB_SECRET}`:base;
}

async function fbGet(path){
  const r=await fetch(fbUrl(path));
  // 404 أو null = لا توجد بيانات بعد — ده طبيعي
  if(r.status===404||r.status===204)return[];
  if(!r.ok)throw new Error(`Firebase GET ${path}: ${r.status}`);
  const data=await r.json();
  if(!data||typeof data!=='object'||Array.isArray(data))return[];
  return Object.entries(data).map(([id,v])=>({...v,_id:id}));
}

async function fbGetOne(path,id){
  const r=await fetch(fbUrl(path,id));
  if(!r.ok)throw new Error(`Firebase GET ${path}/${id}: ${r.status}`);
  const data=await r.json();
  return data?{...data,_id:id}:null;
}

async function fbPost(path,data){
  const r=await fetch(fbUrl(path),{method:'POST',body:JSON.stringify({...data,created_at:new Date().toISOString()})});
  if(!r.ok)throw new Error(`Firebase POST ${path}: ${r.status}`);
  const res=await r.json();
  return res.name; // Firebase auto-generated ID
}

async function fbPut(path,id,data){
  const r=await fetch(fbUrl(path,id),{method:'PUT',body:JSON.stringify({...data,updated_at:new Date().toISOString()})});
  if(!r.ok)throw new Error(`Firebase PUT ${path}/${id}: ${r.status}`);
}

async function fbPatch(path,id,patch){
  const r=await fetch(fbUrl(path,id),{method:'PATCH',body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
  if(!r.ok)throw new Error(`Firebase PATCH ${path}/${id}: ${r.status}`);
}

async function fbDelete(path,id){
  const r=await fetch(fbUrl(path,id),{method:'DELETE'});
  if(!r.ok)throw new Error(`Firebase DELETE ${path}/${id}: ${r.status}`);
}

// ── ACTIVITY LOG ─────────────────────────────────────────
async function logActivity(action, resource, description, extra={}){
  const u=getUser();
  if(!u||!FB_URL)return;
  try{
    await fbPost('activity_log',{
      userId:   u.id,
      userName: u.name,
      userRole: u.role,
      action,        // 'add' | 'edit' | 'delete' | 'login' | 'logout' | 'view'
      resource,      // 'animals' | 'health' | 'vaccine' | 'breeding' | 'finance' | 'inventory' | 'settings' | 'users'
      description,   // نص عربي: 'أضاف حيوان شامي ذكر تربية'
      date: todayStr(),
      timestamp: new Date().toISOString(),
      ...extra
    });
  }catch(e){console.warn('logActivity failed:',e);}
}

// ── LOCAL STORES (مستخدمين فقط — البيانات في Firebase) ──
const Users={
  all:()=>{try{return JSON.parse(localStorage.getItem('farm_users')||'[]');}catch{return[];}},
  get:id=>Users.all().find(u=>u.id===id),
  add(u){localStorage.setItem('farm_users',JSON.stringify([...Users.all(),u]));},
  update(id,p){localStorage.setItem('farm_users',JSON.stringify(Users.all().map(u=>u.id===id?{...u,...p}:u)));},
  del(id){localStorage.setItem('farm_users',JSON.stringify(Users.all().filter(u=>u.id!==id)));},
  init(){
    if(!Users.all().length){
      localStorage.setItem('farm_users',JSON.stringify([
        {id:'admin1',name:'مدير المزرعة',role:'admin',pin:'1234',active:true,created:todayStr()}
      ]));
    }
  }
};

// ── SETTINGS ─────────────────────────────────────────────
function getSettings(){
  const cfg=window.FARM_CONFIG||{};
  const saved=JSON.parse(localStorage.getItem('farm_settings')||'{}');
  return{
    farmName:             cfg.farmName||saved.farmName||'بيان المزرعة',
    ownerName:            cfg.ownerName||saved.ownerName||'مدير المزرعة',
    currency:             cfg.currency||saved.currency||'ج.م',
    goatBreeds:           cfg.goatBreeds||saved.goatBreeds||['شامي','بور','بلدي'],
    sheepBreeds:          cfg.sheepBreeds||saved.sheepBreeds||['برقي','دوربر','ميت ماستر'],
    pregnancyDays:        cfg.pregnancyDays||saved.pregnancyDays||150,
    vaccinationAlertDays: cfg.vaccinationAlertDays||saved.vaccinationAlertDays||7,
    weaningDays:          cfg.weaningDays||saved.weaningDays||60,
    logoUrl:              saved.logoUrl||'',
    farmAddress:          saved.farmAddress||'',
  };
}
function saveSettings(s){localStorage.setItem('farm_settings',JSON.stringify(s));}