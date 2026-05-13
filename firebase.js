'use strict';

// ── Firebase Config ──────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB22XrjduHzusLuNdBtLLvmdIEokFsnyfQ",
  authDomain: "farm-mz99.firebaseapp.com",
  databaseURL: "https://farm-mz99-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "farm-mz99",
  storageBucket: "farm-mz99.firebasestorage.app",
  messagingSenderId: "270083358979",
  appId: "1:270083358979:web:99fad8832b9883c6636936",
  measurementId: "G-CR0WTLFJZD"
};

// ── Firebase REST API (بدون أي library) ──────────────────
const AR=['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
const ar=n=>String(n??'').replace(/\d/g,d=>AR[+d]);
const todayStr=()=>new Date().toISOString().slice(0,10);
function genId(){return Date.now().toString(36)+Math.random().toString(36).slice(2,5);}

// ── AUTH ─────────────────────────────────────────────────
function getUser(){
  try{
    return JSON.parse(localStorage.getItem('farm_user')||'null');
  }catch{
    return null;
  }
}

function setUser(u){
  localStorage.setItem('farm_user',JSON.stringify(u));
}

function logout(){
  localStorage.removeItem('farm_user');
  window.location.href='login.html';
}

function requireAuth(){
  if(!getUser()){
    window.location.href='login.html';
    return false;
  }
  return true;
}

// ── ROLES ────────────────────────────────────────────────
const ROLES={
  admin:      {label:'مدير',       icon:'bi-shield-fill',       color:'var(--orange)'},
  supervisor: {label:'مشرف',       icon:'bi-person-badge-fill', color:'var(--blue)'},
  vet:        {label:'طبيب بيطري', icon:'bi-heart-pulse-fill',  color:'var(--green)'},
  worker:     {label:'عامل',       icon:'bi-person-fill',       color:'var(--gray)'},
  visitor:    {label:'زائر',       icon:'bi-eye-fill',          color:'#90a4ae'},
};

const ROLE_PERMS={
  admin:      ()=>true,
  supervisor: p=>!['users','finance','activity'].includes(p),
  vet:        p=>['health','vaccine','breeding','dash','notifications'].includes(p),
  worker:     p=>['dash','animals','notifications'].includes(p),
  visitor:    p=>['dash','animals','goats','sheep'].includes(p),
};

function can(page){
  const u=getUser();
  if(!u)return false;
  if(u.role==='admin')return true;
  // Check custom permissions first
  if(u.custom_perms&&Array.isArray(u.custom_perms)){
    return u.custom_perms.includes(page);
  }
  return(ROLE_PERMS[u.role]||(()=>false))(page);
}

// ── FIREBASE REST ────────────────────────────────────────
let FB_URL='';

function initFirebase(){
  FB_URL=(FIREBASE_CONFIG.databaseURL||'').replace(/\/$/,'');

  console.log('Firebase Connected:',FB_URL);

  return !!FB_URL;
}

function fbUrl(path,id=''){
  return `${FB_URL}/${path}${id?'/'+id:''}.json`;
}

async function fbGet(path){
  try{
    const r=await fetch(fbUrl(path));

    if(r.status===404||r.status===204){
      return [];
    }

    if(!r.ok){
      throw new Error(`Firebase GET ${path}: ${r.status}`);
    }

    const data=await r.json();

    if(!data || typeof data!=='object'){
      return [];
    }

    return Object.entries(data).map(([id,v])=>({
      ...v,
      _id:id
    }));

  }catch(e){
    console.error('fbGet Error:',e);
    return [];
  }
}

async function fbGetOne(path,id){
  const r=await fetch(fbUrl(path,id));

  if(!r.ok){
    throw new Error(`Firebase GET ${path}/${id}: ${r.status}`);
  }

  const data=await r.json();

  return data?{...data,_id:id}:null;
}
// جلب عنصر واحد مباشرة (لا يحوّله لقائمة)
async function fbGetSingle(path){
  try{
    const r=await fetch(fbUrl(path));
    if(r.status===404||r.status===204)return null;
    if(!r.ok)throw new Error(`Firebase GET ${path}: ${r.status}`);
    const data=await r.json();
    return data||null;
  }catch(e){
    console.error('fbGetSingle Error:',e);
    return null;
  }
}

// جلب الطقس
const WEATHER_API_KEY='2b08987a3d184056b13210204261205';
const FARM_LAT=30.95, FARM_LON=29.797;

async function getWeather(){
  // Try WeatherAPI.com first (مفتاح المستخدم)
  const urls=[
    'https://api.weatherapi.com/v1/current.json?key='+WEATHER_API_KEY+'&q='+FARM_LAT+','+FARM_LON+'&lang=ar',
    'https://api.openweathermap.org/data/2.5/weather?lat='+FARM_LAT+'&lon='+FARM_LON+'&appid='+WEATHER_API_KEY+'&units=metric&lang=ar',
    'https://wttr.in/'+FARM_LAT+','+FARM_LON+'?format=j1'
  ];
  for(var i=0;i<urls.length;i++){
    try{
      const r=await fetch(urls[i],{signal:AbortSignal.timeout(5000)});
      if(!r.ok)continue;
      const data=await r.json();
      // Normalize WeatherAPI.com response
      if(data.current&&data.current.temp_c!==undefined){
        return{main:{temp:data.current.temp_c,feels_like:data.current.feelslike_c,humidity:data.current.humidity},weather:[{description:data.current.condition.text,icon:data.current.condition.icon}],_source:'weatherapi'};
      }
      // OpenWeatherMap response
      if(data.main)return data;
      // wttr.in response
      if(data.current_condition&&data.current_condition[0]){
        const c=data.current_condition[0];
        return{main:{temp:+c.temp_C,feels_like:+c.FeelsLikeC,humidity:+c.humidity},weather:[{description:c.weatherDesc[0].value}],_source:'wttr'};
      }
    }catch(e){continue;}
  }
  return null;
}


const JSON_HEADERS={
  'Content-Type':'application/json'
};

async function fbPost(path,data){
  const body=JSON.stringify({
    ...data,
    created_at:new Date().toISOString()
  });

  const r=await fetch(fbUrl(path),{
    method:'POST',
    headers:JSON_HEADERS,
    body
  });

  if(!r.ok){
    const t=await r.text();
    throw new Error(`POST ${path}: ${r.status} ${t}`);
  }

  const res=await r.json();

  return res.name;
}

async function fbPut(path,id,data){
  const body=JSON.stringify({
    ...data,
    updated_at:new Date().toISOString()
  });

  const r=await fetch(fbUrl(path,id),{
    method:'PUT',
    headers:JSON_HEADERS,
    body
  });

  if(!r.ok){
    const t=await r.text();
    throw new Error(`PUT ${path}/${id}: ${r.status} ${t}`);
  }
}

async function fbPatch(path,id,patch){
  const body=JSON.stringify({
    ...patch,
    updated_at:new Date().toISOString()
  });

  const r=await fetch(fbUrl(path,id),{
    method:'PATCH',
    headers:JSON_HEADERS,
    body
  });

  if(!r.ok){
    const t=await r.text();
    throw new Error(`PATCH ${path}/${id}: ${r.status} ${t}`);
  }
}

async function fbDelete(path,id){
  const r=await fetch(fbUrl(path,id),{
    method:'DELETE'
  });

  if(!r.ok){
    const t=await r.text();
    throw new Error(`DELETE ${path}/${id}: ${r.status} ${t}`);
  }
}

// ── ACTIVITY LOG ─────────────────────────────────────────
async function logActivity(action, resource, description, extra={}){
  const u=getUser();

  if(!u || !FB_URL) return;

  try{
    await fbPost('activity_log',{
      userId:   u.id,
      userName: u.name,
      userRole: u.role,
      action,
      resource,
      description,
      date: todayStr(),
      timestamp: new Date().toISOString(),
      ...extra
    });

  }catch(e){
    console.warn('logActivity failed:',e);
  }
}

// ── LOCAL USERS ──────────────────────────────────────────
const Users={
  async all(){
    return await fbGet('users');
  },

  async get(id){
    const direct=await fbGetOne('users', id);
    if(direct) return direct;
    const users=await fbGet('users');
    return users.find(u=>u.id===id)||null;
  },

  async add(user){
    return await fbPut('users', user.id, {
      ...user,
      created: todayStr()
    });
  },

  async update(id,patch){
    return await fbPatch('users', id, patch);
  },

  async del(id){
    return await fbDelete('users', id);
  },

  async init(){
    const users = await fbGet('users');
    if(!users.length){
      await fbPut('users','admin1',{
        id:'admin1',
        name:'مدير المزرعة',
        role:'admin',
        pin:'1234',
        active:true,
        created:todayStr()
      });
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

function saveSettings(s){
  localStorage.setItem('farm_settings',JSON.stringify(s));
}

// ── INIT ─────────────────────────────────────────────────
async function initApp(){
  initFirebase();
  await Users.init();
}
initApp();