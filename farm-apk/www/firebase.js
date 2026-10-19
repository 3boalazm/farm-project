'use strict';

// ── Firebase Config ──────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyB22XrjduHzusLuNdBtlLvmdIEokFsnyfQ",
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
const todayStr=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};

// ── LOCAL-CALENDAR DATE HELPERS (2026-10 audit) ────────────
// Every record in this app stores plain local calendar strings
// ('YYYY-MM-DD' / 'YYYY-MM') written by todayStr() and by native
// <input type="date">. ~35 places then compared those against keys built
// with `someDate.toISOString().slice(0,7|10)` -- which is UTC. For any
// timezone east of Greenwich (this farm is UTC+2/+3) that shifts the key
// BACKWARDS:
//   • `new Date(y, m, 1).toISOString().slice(0,7)` is local midnight, i.e.
//     21:00-22:00 UTC on the LAST day of the PREVIOUS month -> every
//     6-month finance/production/health trend chart silently plotted the
//     previous month's numbers under the current month's label, and the
//     current month's own records matched no bucket at all.
//   • `new Date().toISOString().slice(0,10)` is "yesterday" for any local
//     time before 02:00-03:00 -> daily production trends, notification
//     cutoffs and auto-task due dates were off by one day overnight.
// These four helpers are the single correct way to derive a local
// calendar key from a Date; firebase.js loads before every other script,
// so they are available app-wide (pages/*.js included).
const _p2=n=>String(n).padStart(2,'0');

// 'YYYY-MM-DD' in LOCAL time. Accepts a Date or anything Date-parses;
// a plain 'YYYY-MM-DD' string is parsed as local midnight (never UTC),
// so round-tripping a stored date is always identity. Returns '' for an
// unparseable/missing value instead of 'NaN-aN-aN'.
function toLocalDateStr(d){
  if(d==null||d==='')return '';
  let x;
  if(d instanceof Date) x=d;
  else if(typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) x=new Date(d+'T00:00:00');
  else x=new Date(d);
  if(isNaN(x.getTime()))return '';
  return x.getFullYear()+'-'+_p2(x.getMonth()+1)+'-'+_p2(x.getDate());
}

// 'YYYY-MM' in LOCAL time -- the correct key to match a record's
// `date.startsWith(monthKey)` against.
function toLocalMonthKey(d){
  const s=toLocalDateStr(d);
  return s?s.slice(0,7):'';
}

// Date arithmetic that stays on the local calendar: returns
// 'YYYY-MM-DD' for base +/- days. Replaces the widespread
// `var dt=new Date(x);dt.setDate(dt.getDate()+n);dt.toISOString().slice(0,10)`
// pattern, whose UTC final step moved pregnancy due dates, drug
// withdrawal windows and vaccination schedules by a day.
function shiftDateLocal(base,days){
  const s=toLocalDateStr(base);
  if(!s)return '';
  const x=new Date(s+'T00:00:00');
  x.setDate(x.getDate()+(+days||0));
  return toLocalDateStr(x);
}

// First day of the month `offsetMonths` away from the current one
// (negative = past), as a real LOCAL Date -- for building trend buckets.
function monthStartLocal(offsetMonths){
  const n=new Date();
  return new Date(n.getFullYear(), n.getMonth()+(+offsetMonths||0), 1);
}

// Last day of the month containing `d`, as 'YYYY-MM-DD' (local).
function monthEndLocal(d){
  const s=toLocalDateStr(d);
  if(!s)return '';
  const x=new Date(s+'T00:00:00');
  return toLocalDateStr(new Date(x.getFullYear(), x.getMonth()+1, 0));
}
// FIX (2026-10 audit): this used to be `Date.now().toString(36) +
// Math.random().toString(36).slice(2,5)` — only THREE base-36 random
// characters (~46k outcomes). genId() is not a display-only helper: it is
// the `operationId` idempotency key for every financial posting
// (finance-entry/ar-ap/animals/periods) and the suffix of every
// source-document number, and users.html uses it as a user id. Two
// submissions inside the same millisecond therefore had a ~1/46656 chance
// of colliding — and a collision on an operationId makes
// createSourceDocument()/recordPaymentAgainstDocument() return
// `{ok:true, idempotent:true}` for a DIFFERENT transaction, i.e. a real
// invoice or payment is silently dropped while the UI reports success.
// Measured in tests/unit/01: 3 duplicates in 500 same-millisecond calls.
// Now 8 base-36 characters from crypto.getRandomValues when available
// (~2.8e12 outcomes), same shape and length class, no API change.
function genId(){
  var rand;
  try{
    var c=(typeof crypto!=='undefined'&&crypto.getRandomValues)?crypto:(typeof window!=='undefined'&&window.crypto);
    if(c&&c.getRandomValues){
      var b=new Uint32Array(2);
      c.getRandomValues(b);
      rand=b[0].toString(36).padStart(7,'0').slice(-5)+b[1].toString(36).padStart(7,'0').slice(-3);
    }
  }catch(e){ /* fall through to Math.random */ }
  if(!rand) rand=Math.random().toString(36).slice(2,7)+Math.random().toString(36).slice(2,5);
  return Date.now().toString(36)+rand;
}

// ── HTML Escaping ──────────────────────────────────────────
// No escaping helper existed anywhere in this codebase before this pass
// (confirmed by direct grep of shared.js/firebase.js) -- free-text fields
// (notes, names, descriptions, reasons, diagnoses...) were concatenated
// straight into `.innerHTML=` template strings across the app, a
// confirmed, live-proven stored-XSS vector (see
// docs/repository/RISK_REGISTER.md). This is the first, additive step:
// a safe, dependency-free escaper every page already has access to
// (firebase.js loads before every other script). Use it on any
// user-editable text value interpolated into an HTML string -- never on
// values that are already trusted HTML you're deliberately building
// (icon markup, badges assembled from fixed config objects, etc.).
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// For the common onclick="fn('${value}')" pattern -- a value that's both
// a single-quoted JS string literal AND sits inside a double-quoted HTML
// attribute. escapeHtml() alone is NOT enough here: the browser decodes
// HTML entities (turning an escaped &#39; back into a literal ') BEFORE
// handing the attribute's text to the JS parser on click, so an
// HTML-only escape doesn't stop a value containing a quote from breaking
// out of the JS string once the handler actually runs. This escapes for
// the JS-string context first (backslash, then single-quote), then for
// the HTML-attribute context, so both layers hold.
function escapeJsAttr(s){
  return escapeHtml(String(s??'').replace(/\\/g,'\\\\').replace(/'/g,"\\'"));
}

// ── PIN Hashing (Security Migration) ──────────────────────
// Replaces plaintext PIN storage. Uses the browser's built-in Web
// Crypto API (SHA-256) — no new library/dependency added. Salted with
// the user's own id so two people with the same PIN don't produce the
// same hash. Real improvement over plaintext, but not a complete fix
// on its own: a 4-digit PIN only has 10,000 possible values, fast to
// brute-force offline even hashed, if an attacker can already read the
// users collection at all (a Firebase rules problem, tracked
// separately — see database.rules.secure.json, not deployed).
async function hashPin(pin, userId){
  const enc=new TextEncoder().encode('bayan-farm-pin-salt:'+userId+':'+pin);
  const digest=await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── Firebase Authentication bridge ─────────────────────────
// Gives each app user a REAL, persistent Firebase Auth UID without
// changing the PIN-pad UI. Uses Firebase's email/password provider
// underneath: each app user's own id becomes a synthetic,
// never-emailed address (u_{appUserId}@bayan-farm.internal), and
// their PIN becomes a Firebase-valid password (padded to meet the
// 6-char minimum). The real security value isn't the password's raw
// entropy (still ultimately a 4-digit PIN) — it's that verification
// now happens on Firebase's own servers, which rate-limit repeated
// failed attempts, unlike client-side comparison.
//
// Deliberately best-effort and fail-safe: every call is wrapped so
// that if email/password sign-in isn't enabled yet in the Firebase
// Console, these calls fail quietly and the app continues exactly as
// it does today on the PIN-hash system alone. Activates automatically
// the moment that one Console setting is flipped — no further deploy
// needed.
function _authEmailFor(appUserId){ return 'u_'+appUserId+'@bayan-farm.internal'; }
function _authPasswordFor(pin){ return 'bfarm-pin-'+pin+'-v1'; }

let _authIdToken=null, _authTokenExpiry=0, _authUid=null;

function _authStore(d){
  _authIdToken=d.idToken; _authUid=d.localId||d.uid||_authUid;
  _authTokenExpiry=Date.now()+(Number(d.expiresIn||d.expires_in||3600)*1000-60000);
  try{localStorage.setItem('_farm_auth_refresh',JSON.stringify({refreshToken:d.refreshToken||d.refresh_token, uid:_authUid}));}catch(e){}
}

async function _authRefresh(){
  try{
    const stored=JSON.parse(localStorage.getItem('_farm_auth_refresh')||'null');
    if(!stored||!stored.refreshToken)return null;
    const r=await fetch('https://securetoken.googleapis.com/v1/token?key='+FIREBASE_CONFIG.apiKey,{
      method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:'grant_type=refresh_token&refresh_token='+stored.refreshToken
    });
    if(!r.ok)return null;
    const d=await r.json();
    _authIdToken=d.id_token; _authUid=d.user_id||stored.uid;
    _authTokenExpiry=Date.now()+(Number(d.expires_in)*1000-60000);
    localStorage.setItem('_farm_auth_refresh',JSON.stringify({refreshToken:d.refresh_token, uid:_authUid}));
    return _authIdToken;
  }catch(e){return null;}
}

// Called once, right after a successful PIN login (see login.html).
// Tries signing in to the bridged account; creates it if this is the
// first time (lazy migration, same pattern as the pin_hash migration).
async function signInWithFirebaseAuth(appUserId, pin){
  const email=_authEmailFor(appUserId), password=_authPasswordFor(pin);
  const base='https://identitytoolkit.googleapis.com/v1/accounts:';
  try{
    let r=await fetch(base+'signInWithPassword?key='+FIREBASE_CONFIG.apiKey,{
      method:'POST', headers:JSON_HEADERS,
      body:JSON.stringify({email,password,returnSecureToken:true})
    });
    if(!r.ok){
      r=await fetch(base+'signUp?key='+FIREBASE_CONFIG.apiKey,{
        method:'POST', headers:JSON_HEADERS,
        body:JSON.stringify({email,password,returnSecureToken:true})
      });
    }
    if(!r.ok)return null; // Firebase Auth not enabled yet, or a real failure — best-effort
    _authStore(await r.json());
    // Maintain uid_lookup/{firebaseUid} -> appUserId so database rules
    // can later resolve "who is this Firebase UID, in app terms" to
    // check their role (needed since auth.uid is a random string
    // Firebase assigns, unrelated to this app's own user ids).
    try{ await fbPut('uid_lookup', _authUid, {appUserId}); }catch(e){ /* best-effort */ }
    return _authUid;
  }catch(e){
    console.warn('Firebase Auth bridge unavailable (non-fatal, app continues on PIN-hash auth):',e.message);
    return null;
  }
}

// ── Anonymous Auth safety net ────────────────────────────
// Firebase Anonymous Auth is now enabled in the Console (Authentication
// > Sign-in method). This guarantees some Firebase-authenticated identity
// always exists -- independent of, and before, this app's own PIN login
// -- so a future rules change to "auth != null" never sees a null-auth
// request, regardless of which page loads first or whether PIN login has
// happened yet. This does NOT replace signInWithFirebaseAuth() (the
// existing per-user email/password bridge, called from login.html right
// after a successful PIN check): both write through the same
// _authStore(), so the per-user identity simply takes over the moment a
// real login succeeds -- no separate "upgrade" step needed. The user
// never sees any of this; it only ever affects the ?auth= query param
// firebase.js already attaches to every REST call.
//
// Uses accounts:signUp with no email/password (returnSecureToken:true
// only) -- this IS the real Identity Toolkit anonymous-auth endpoint.
// There is no separate "accounts:signInAnonymously" REST endpoint; that
// name only exists as a client-SDK method, which itself calls this same
// accounts:signUp endpoint underneath.
async function _signInAnonymouslyRestOnce(){
  const r=await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key='+FIREBASE_CONFIG.apiKey,{
    method:'POST', headers:JSON_HEADERS,
    body:JSON.stringify({returnSecureToken:true})
  });
  if(!r.ok) throw new Error('Anonymous sign-in failed: HTTP '+r.status);
  _authStore(await r.json());
  return _authIdToken;
}

// Serializes concurrent callers (e.g. Promise.all([fbGet('animals'),
// fbGet('breeding'), ...]) on page load) onto ONE in-flight sign-in/
// refresh instead of firing one per caller -- this is what prevents
// duplicate sign-ins, not a synchronous currentUser check, since REST
// auth state here is only ever known asynchronously.
let _authInFlight=null;
let _authBackgroundRetryScheduled=false;

// Schedules up to 2 retries in the BACKGROUND (never awaited by any
// caller) so a transient failure still self-heals without a page
// reload. Deliberately NOT awaited from _getValidAuthToken(): under
// today's still-permissive rules, making every fbGet/fbPost/etc. wait
// out a multi-second retry sequence before its FIRST attempt even
// starts would be a real, avoidable slowdown for something that has
// zero functional consequence yet. If a retry succeeds, _authStore()
// populates _authIdToken so the NEXT call (often just moments later)
// picks it up for free.
function _scheduleAuthBackgroundRetry(){
  if(_authBackgroundRetryScheduled)return;
  _authBackgroundRetryScheduled=true;
  const delays=[800,2500];
  (async()=>{
    for(const d of delays){
      await new Promise(res=>setTimeout(res,d));
      if(_authIdToken)break; // some other call already succeeded meanwhile
      try{ await _signInAnonymouslyRestOnce(); break; }
      catch(e){ /* try the next delay, or give up silently after the last one */ }
    }
    _authBackgroundRetryScheduled=false;
  })();
}

async function _getValidAuthToken(){
  if(_authIdToken && Date.now()<_authTokenExpiry)return _authIdToken;
  if(_authInFlight)return _authInFlight;
  _authInFlight=(async()=>{
    try{
      if(_authIdToken||localStorage.getItem('_farm_auth_refresh')){
        const t=await _authRefresh();
        if(t)return t;
      }
      // Truly first-ever call on this browser: no token, no refresh
      // token. ONE quick attempt -- not a blocking multi-retry loop, so
      // this caller's actual data request is never held up waiting on
      // it. A background retry is scheduled on failure (below) so a
      // later call still self-heals.
      return await _signInAnonymouslyRestOnce();
    }catch(e){
      // Under TODAY's rules (still .read/.write:true) a failed sign-in
      // has zero visible consequence, so no error is shown here --
      // flagging one now, before rules ever require auth, would be a
      // false alarm the user can't act on. What DOES need to surface a
      // real message is a 401 actually coming back from a data call
      // once rules require auth -- see _reportAuthFailure() below,
      // invoked from fbGet/fbPost/fbPatch/fbPut/fbGetOne/fbDelete's
      // existing !r.ok checks.
      console.warn('Firebase Auth unavailable (non-fatal under current rules, retrying in background):',e.message);
      _scheduleAuthBackgroundRetry();
      return null;
    }finally{
      _authInFlight=null;
    }
  })();
  return _authInFlight;
}

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
  localStorage.removeItem('_farm_auth_refresh');
  _authIdToken=null; _authUid=null; _authTokenExpiry=0;
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
  vet:        p=>['health','breeding','dash','notifications','bayan'].includes(p),
  worker:     p=>['dash','animals','notifications','bayan'].includes(p),
  visitor:    p=>['dash','animals','bayan'].includes(p),
};

function can(page){
  const u=getUser();
  if(!u)return false;
  if(u.role==='admin')return true;
  // FIX (2026-10 audit) — ELEVATION OF PRIVILEGE, found by unit-testing the
  // permission model role by role.
  //
  // Twenty call sites across this app use can('admin') as an ADMIN-ONLY
  // guard — but 'admin' is a ROLE name, not a permission key, and it appears
  // in no role's permission list. Every one of those guards therefore fell
  // through to the role predicate, and ROLE_PERMS.supervisor is
  // "everything except users/finance/activity" — which returns TRUE for
  // 'admin'. Measured effect before this fix: a مشرف (supervisor) could
  //   • wipe the whole mortality register (dead.html's تصفير سجلات النافق),
  //   • run animals.html's bulk reset/delete paths (3 separate guards),
  //   • delete health records, vaccinations and tasks,
  //   • edit the farm profile, and
  //   • open activity.html — the audit log whose own on-screen message says
  //     "هذه الصفحة للمدير فقط" and whose permission ROLE_PERMS explicitly
  //     excludes for supervisors (the page checks can('admin'), never
  //     can('activity'), so the exclusion was bypassed entirely),
  //   • and run shared.js's repairGenealogy() herd-wide rewrite.
  //
  // 'admin' is now resolved as what every caller means by it: the admin ROLE.
  // It is checked before custom_perms on purpose — users.html's permission
  // editor can grant page permissions to any user, and that mechanism must
  // never be able to mint an admin. One line closes all twenty holes; no
  // call site needed to change.
  if(page==='admin')return false;
  // Check custom permissions first
  if(u.custom_perms&&Array.isArray(u.custom_perms)){
    return u.custom_perms.includes(page);
  }
  return(ROLE_PERMS[u.role]||(()=>false))(page);
}

// ── canWrite(page) — the write-side companion to can() ──────
// FIX (2026-10 audit) — ELEVATION OF PRIVILEGE, found by unit-testing the
// services with each role in turn.
//
// can() answers "may this user SEE this area?", and ROLE_PERMS grants
// 'animals' to worker AND to visitor -- correctly: a guest should be able to
// look at the herd. But every mutating service in shared.js authorised
// itself with that same can('animals'): recordAnimalWeight(),
// deleteAnimalWeight(), _writeAnimalStatus() (markAnimalDead / sellAnimal /
// quarantine / restore / correctAnimalCount), renameTag(), linkParents().
// Net effect before this fix: a user logged in as زائر (visitor) — the one
// role whose entire purpose is read-only — could record weights, mark
// animals dead, SELL them (which also posts a real finance income record),
// rename tags and re-parent offspring. Verified live by
// tests/unit/07 before the fix (recordAnimalWeight returned ok:true for a
// visitor).
//
// canWrite() is additive and deliberately narrow: identical to can() for
// every role that isn't read-only, and for a read-only role it still allows
// an explicit, per-user grant via custom_perms (the mechanism users.html
// already persists), so no legitimate access is lost. Pages keep using can()
// for visibility; the services — the authoritative write path, and the one
// every page funnels through — use canWrite().
const READ_ONLY_ROLES={visitor:true};

function canWrite(page){
  const u=getUser();
  if(!u)return false;
  if(!can(page))return false;              // no read access → certainly no write access
  if(READ_ONLY_ROLES[u.role]){
    return Array.isArray(u.custom_perms) && u.custom_perms.indexOf(page)!==-1;
  }
  return true;
}

// ── ANIMAL STATUS CONFIG ─────────────────────────────────
const ANIMAL_STATUS = {
  alive:            { label: 'حي / سليم',     color: 'var(--green)',  icon: 'bi-check-circle-fill', short: 'سليم' },
  healthy:          { label: 'سليم',          color: 'var(--green)',  icon: 'bi-check-circle-fill', short: 'سليم' },
  under_treatment:  { label: 'قيد العلاج',    color: 'var(--orange)', icon: 'bi-bandaid-fill',      short: 'علاج' },
  quarantine:       { label: 'في الحجر',      color: 'var(--yellow)', icon: 'bi-shield-fill-exclamation', short: 'حجر' },
  sold:             { label: 'مُباع',         color: 'var(--blue)',   icon: 'bi-cash-coin',         short: 'مباع' },
  dead:             { label: 'نافق',          color: 'var(--red)',    icon: 'bi-x-octagon-fill',    short: 'نافق' },
};

// Get effective animal status — derives under_treatment from active health records
function getAnimalStatus(animal, healthRecords) {
  if (!animal) return 'alive';
  if (['dead','sold','quarantine'].includes(animal.status)) return animal.status;
  // Auto-derive treatment status
  if (Array.isArray(healthRecords)) {
    const today = todayStr();
    const active = healthRecords.find(h =>
      h.animal_tag === animal.tag && h.status === 'active' &&
      (!h.withdrawal_end || h.withdrawal_end >= today)
    );
    if (active) return 'under_treatment';
  }
  return animal.status === 'alive' ? 'healthy' : (animal.status || 'alive');
}

// Render status badge inline
function statusBadge(status) {
  const cfg = ANIMAL_STATUS[status] || ANIMAL_STATUS.alive;
  return '<span class="type-badge" style="background:'+cfg.color+'22;color:'+cfg.color+';border:1px solid '+cfg.color+'44;font-size:.7rem;font-weight:600">'+
    '<i class="bi '+cfg.icon+' me-1" style="font-size:.7rem"></i>'+cfg.short+'</span>';
}

// ── FIREBASE REST ────────────────────────────────────────
let FB_URL='';

function initFirebase(){
  FB_URL=(FIREBASE_CONFIG.databaseURL||'').replace(/\/$/,'');

  console.log('Firebase Connected:',FB_URL);

  return !!FB_URL;
}

// ── Auth-required-but-missing detection ──────────────────
// A 401 from ANY Firebase REST call means the current rules require
// auth and this request didn't have a valid one -- whether because
// anonymous sign-in failed even after retries, the token expired
// mid-session, or the rules changed underneath the app. Shows ONE
// clear, user-visible message (not one per failed call, even if
// several fail at once) instead of the app silently doing nothing
// with no explanation -- this is what actually addresses "fail-open
// alone isn't enough once rules require auth != null", not the retry
// logic above on its own.
let _authFailureShown=false;
function _reportAuthFailure(){
  if(_authFailureShown)return;
  _authFailureShown=true;
  if(typeof toast==='function'){
    toast('تعذر التحقق من الهوية مع الخادم. تحقق من الإنترنت وأعد تحميل الصفحة.','error');
  }
  // Let a later genuine recovery (connectivity returns, token refresh
  // succeeds) report again instead of staying silenced for the rest of
  // this page's lifetime.
  setTimeout(()=>{_authFailureShown=false;},30000);
}

async function fbUrl(path,id=''){
  const base=`${FB_URL}/${path}${id?'/'+id:''}.json`;
  const token=await _getValidAuthToken();
  return token ? `${base}?auth=${token}` : base;
}

// SessionStorage cache for fbGet (TTL: 45s, persists across page navigations)
const _fbCacheTTL=45000;
function _fbCacheKey(p){return '_fbc_'+p;}
function _fbCacheGet(p){
  try{
    const raw=sessionStorage.getItem(_fbCacheKey(p));
    if(!raw)return null;
    const e=JSON.parse(raw);
    if(Date.now()-e.ts>_fbCacheTTL){sessionStorage.removeItem(_fbCacheKey(p));return null;}
    return e.data;
  }catch(e){return null;}
}
function _fbCacheSet(p,data){
  try{sessionStorage.setItem(_fbCacheKey(p),JSON.stringify({data:data,ts:Date.now()}));}
  catch(e){/* quota exceeded - ignore */}
}
function fbCacheInvalidate(p){
  try{
    if(p){sessionStorage.removeItem(_fbCacheKey(p));}
    else{Object.keys(sessionStorage).filter(k=>k.startsWith('_fbc_')).forEach(k=>sessionStorage.removeItem(k));}
  }catch(e){}
}

// ══════════════════════════════════════════════════════
//  UNDO HISTORY — Persisted in sessionStorage (survives page navigation)
// ══════════════════════════════════════════════════════
var _UNDO_MAX=5;
var _UNDO_KEY='_farm_undo_stack';

function _getUndoStack(){
  try{var s=sessionStorage.getItem(_UNDO_KEY);return s?JSON.parse(s):[];}catch(e){return[];}
}
function _saveUndoStack(stack){
  try{sessionStorage.setItem(_UNDO_KEY,JSON.stringify(stack));}catch(e){}
}

// FIX (2026-10 audit) — THE UNDO FEATURE WAS DEAD CODE.
// _pushUndo() was defined and undoLast()/the sidebar "تراجع" button were
// fully wired, but NOTHING in the entire repository ever called
// _pushUndo() (verified by grep across every .js/.html file, root and the
// farm-apk copy alike). The button therefore always rendered at 40%
// opacity and every click answered "لا توجد عمليات للتراجع عنها" — a
// visible, advertised feature that could never do anything. fbDelete()
// even performed an extra GET purely to capture the deleted record "for
// undo" and then discarded it, so every delete paid for a round-trip
// whose result was thrown away.
//
// The three writers below now capture their operation. Capture is
// deliberately FILTERED, because an unfiltered stack would be worse than
// no stack: background engines (notification service, weight/production
// alert evaluators, workflow engine, activity log) write through the very
// same fbPost/fbPatch, and a machine write landing on top of the 5-deep
// stack would silently replace what the user actually meant to undo.
// Journal entries and source documents are excluded on purpose too — the
// accounting engine's immutability guarantee (and database.rules.json's
// POSTED-write block) means "undo" must never attempt to reverse one;
// corrections there go through reverseJournalEntry().
var _UNDO_SKIP_ROOTS={
  activity_log:1, login_notifications:1, notifications:1,
  weight_alerts:1, production_alerts:1, workflow_history:1,
  inventory_transactions:1, financial_audit_log:1,
  journal_entries:1, source_documents:1, uid_lookup:1,
  diary_snapshots:1
};

function _undoCapturable(path,data){
  var root=String(path||'').split('/')[0];
  if(_UNDO_SKIP_ROOTS[root]) return false;
  if(data && (data.auto_generated || data.synced_at)) return false; // machine-written
  return true;
}

function _pushUndo(op){
  var stack=_getUndoStack();
  stack.push(op);
  if(stack.length>_UNDO_MAX)stack.shift();
  _saveUndoStack(stack);
  _updateUndoBtn();
}

var _undoBtnRetries=0;
function _updateUndoBtn(){
  var stack=_getUndoStack();
  var count=stack.length;
  var btn=document.getElementById('undo-btn');
  if(!btn){
    // FIX (2026-10 audit): this retried EVERY 500ms FOREVER on any page
    // where the rail panel hasn't rendered (login.html, bayan.html, or
    // simply before renderNavbarV2() ran) — an unbounded background timer
    // per page load, for a button that would never appear. Bounded now.
    if(_undoBtnRetries++<6) setTimeout(_updateUndoBtn,500);
    return;
  }
  _undoBtnRetries=0;
  if(count>0){
    btn.style.background='rgba(255,193,7,.12)';
    btn.style.borderColor='rgba(255,193,7,.4)';
    btn.style.color='var(--yellow)';
    btn.style.opacity='1';
    var lastOp=stack[stack.length-1];
    var opLabel={post:'إضافة',patch:'تعديل',delete:'حذف'}[lastOp.type]||'عملية';
    btn.title='تراجع عن آخر '+opLabel+' في '+lastOp.table+' ('+count+' عملية)';
    btn.innerHTML='<i class="bi bi-arrow-counterclockwise"></i><span style="font-weight:700;font-size:.75rem;margin-right:2px">'+count+'</span>';
  } else {
    btn.style.background='rgba(255,255,255,.06)';
    btn.style.borderColor='var(--border)';
    btn.style.color='var(--text-muted)';
    btn.style.opacity='0.4';
    btn.title='لا توجد عمليات للتراجع عنها';
    btn.innerHTML='<i class="bi bi-arrow-counterclockwise"></i>';
  }
}

async function undoLast(){
  var stack=_getUndoStack();
  if(!stack.length){toast('لا توجد عمليات للتراجع عنها','info');return;}
  var op=stack.pop();
  _saveUndoStack(stack);
  _updateUndoBtn();
  toast('جاري التراجع...','info');
  try{
    if(op.type==='post'){
      // Undo add: delete the created record
      if(op.id){await fetch(await fbUrl(op.table,op.id),{method:'DELETE'});}
      fbCacheInvalidate(op.table);
      toast('تم التراجع عن إضافة سجل في '+op.table);
    } else if(op.type==='patch'){
      // Undo edit: restore previous values
      if(op.prev&&op.id){
        var r=await fetch(await fbUrl(op.table,op.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(op.prev)});
      }
      fbCacheInvalidate(op.table);
      toast('تم التراجع عن تعديل سجل في '+op.table);
    } else if(op.type==='delete'){
      // Undo delete: re-create the record
      if(op.prev){
        // BUG FIX: this previously built the URL as
        // fbUrl(op.table) + '/' + op.id + '.json', but fbUrl() already
        // appends '.json' when called with no id — a malformed
        // double-.json URL that would have always failed. Now calls
        // fbUrl(op.table, op.id) directly, matching every other call
        // site in this file.
        await fetch(await fbUrl(op.table,op.id),{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(op.prev)});
      }
      fbCacheInvalidate(op.table);
      toast('تم استعادة السجل المحذوف في '+op.table);
    }
    // Reload page data
    if(typeof loadPageData==='function')loadPageData();
    else if(typeof renderPage==='function')renderPage();
    else if(typeof renderAnimals==='function'){fbGet('animals').then(function(a){window.animals=a||[];renderFilters&&renderFilters();renderAnimals&&renderAnimals();});}
    else setTimeout(function(){location.reload();},800);
  }catch(e){
    toast('فشل التراجع: '+e.message,'error');
  }
}

async function fbGet(path, skipCache){
  if(!skipCache){const cached=_fbCacheGet(path);if(cached)return cached;}
  try{
    const r=await fetch(await fbUrl(path));

    if(r.status===404||r.status===204){
      _fbCacheSet(path,[]);
      return [];
    }

    if(!r.ok){
      if(r.status===401)_reportAuthFailure();
      throw new Error('Firebase GET '+path+': '+r.status);
    }

    const data=await r.json();

    if(!data || typeof data!=='object'){
      _fbCacheSet(path,[]);
      return [];
    }

    const result=Object.entries(data).map(([id,v])=>({
      ...v,
      _id:id
    }));
    _fbCacheSet(path,result);
    return result;

  }catch(e){
    console.error('fbGet Error:',e);
    return [];
  }
}

// ── fbGetSafe(path) ───────────────────────────────────────
// Same read as fbGet(), but distinguishes "the collection really is
// empty" (returns []) from "the read FAILED" (returns null). fbGet()
// deliberately swallows every error and returns [] so pages can render
// an empty state instead of crashing -- the right contract for display
// code, and the wrong one for any decision of the form
// `if(collection is empty) then create the default record`.
//
// Why this exists (found by the 2026-10 module audit): Users.init() ran
// that exact empty-check on EVERY page load, so a single dropped request
// (offline, DNS blip, 5xx, expired token) looked like a brand-new farm
// and re-PUT users/admin1 with the factory PIN 1234 -- silently
// resetting the real administrator's credentials on a live database.
// seedDefaultChartOfAccounts() had the identical shape. Both now read
// through this helper and refuse to bootstrap when the read failed.
// fbGet() itself is untouched: ~200 display call sites keep their
// never-throws, always-an-array contract.
async function fbGetSafe(path){
  try{
    const r=await fetch(await fbUrl(path));
    if(r.status===404||r.status===204) return [];
    if(!r.ok){
      if(r.status===401)_reportAuthFailure();
      return null;
    }
    const data=await r.json();
    if(!data || typeof data!=='object') return [];
    return Object.entries(data).map(([id,v])=>({...v,_id:id}));
  }catch(e){
    console.error('fbGetSafe Error:',e);
    return null;
  }
}

async function fbGetOne(path,id){
  const r=await fetch(await fbUrl(path,id));

  if(!r.ok){
    if(r.status===401)_reportAuthFailure();
    throw new Error(`Firebase GET ${path}/${id}: ${r.status}`);
  }

  const data=await r.json();

  return data?{...data,_id:id}:null;
}
// جلب عنصر واحد مباشرة (لا يحوّله لقائمة)
async function fbGetSingle(path){
  try{
    const r=await fetch(await fbUrl(path));
    if(r.status===404||r.status===204)return null;
    if(!r.ok){
      if(r.status===401)_reportAuthFailure();
      throw new Error(`Firebase GET ${path}: ${r.status}`);
    }
    const data=await r.json();
    return data||null;
  }catch(e){
    console.error('fbGetSingle Error:',e);
    return null;
  }
}

// جلب الطقس
const WEATHER_API_KEY=FARM_CONFIG.weatherApiKey;
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
  // Will capture the new ID after creation for undo

  const body=JSON.stringify({
    ...data,
    created_at:new Date().toISOString()
  });

  const r=await fetch(await fbUrl(path),{
    method:'POST',
    headers:JSON_HEADERS,
    body
  });

  // BUG FIX: cache invalidation used to happen ONLY inside the failure
  // branch below. On a successful POST, the 45-second cache still held
  // pre-create data, so a page re-fetching this same path right after
  // saving could show stale data missing the record it just created.
  // Invalidating unconditionally (matching fbDelete's existing
  // behavior) fixes this for both outcomes.
  fbCacheInvalidate(path);

  if(!r.ok){
    if(r.status===401)_reportAuthFailure();
  const t=await r.text();
    throw new Error(`POST ${path}: ${r.status} ${t}`);
  }

  const res=await r.json();

  // Undo capture (see _UNDO_SKIP_ROOTS above): a create is undone by
  // deleting the id Firebase just returned. Machine-written collections are
  // filtered out so a background engine's write can never displace the
  // user's own last action from the 5-deep stack.
  if(res && res.name && _undoCapturable(path,data)){
    _pushUndo({type:'post', table:path, id:res.name, when:Date.now()});
  }

  return res.name;
}

async function fbPut(path,id,data){
  const body=JSON.stringify({
    ...data,
    updated_at:new Date().toISOString()
  });

  const r=await fetch(await fbUrl(path,id),{
    method:'PUT',
    headers:JSON_HEADERS,
    body
  });

  // Same fix as fbPost above — invalidate unconditionally, not just on failure.
  fbCacheInvalidate(path);

  if(!r.ok){
    if(r.status===401)_reportAuthFailure();
  const t=await r.text();
    throw new Error(`PUT ${path}/${id}: ${r.status} ${t}`);
  }
}

async function fbPatch(path,id,patch){
  // Undo capture: read the CURRENT value of exactly the keys about to be
  // overwritten, so undo can restore them (a key that didn't exist before
  // is restored as null, which removes it again). Skipped entirely for the
  // machine-written collections listed in _UNDO_SKIP_ROOTS, so those pay
  // no extra round-trip. Best-effort: if the pre-read fails, nothing is
  // pushed — an undo entry that cannot actually restore anything would be
  // worse than none, because undoLast() reports success unconditionally.
  var _prev=null;
  if(_undoCapturable(path,patch)){
    try{
      var _pr=await fetch(await fbUrl(path,id));
      if(_pr.ok){
        var _cur=(await _pr.json())||{};
        _prev={};
        for(var _k in patch){ if(Object.prototype.hasOwnProperty.call(patch,_k)) _prev[_k]=Object.prototype.hasOwnProperty.call(_cur,_k)?_cur[_k]:null; }
      }
    }catch(e){ _prev=null; }
  }

  const body=JSON.stringify({
    ...patch,
    updated_at:new Date().toISOString()
  });

  const r=await fetch(await fbUrl(path,id),{
    method:'PATCH',
    headers:JSON_HEADERS,
    body
  });

  if(r.ok && _prev) _pushUndo({type:'patch', table:path, id:id, prev:_prev, when:Date.now()});

  // Same fix as fbPost above — invalidate unconditionally, not just on failure.
  fbCacheInvalidate(path);

  if(!r.ok){
    if(r.status===401)_reportAuthFailure();
  const t=await r.text();
    throw new Error(`PATCH ${path}/${id}: ${r.status} ${t}`);
  }
}

async function fbDelete(path,id){fbCacheInvalidate(path);
  // Capture data before deletion for undo
  var _delData=null;
  try{
    var _dr=await fetch(await fbUrl(path,id));
    if(_dr.ok)_delData=await _dr.json();
  }catch(e){}
  const r=await fetch(await fbUrl(path,id),{
    method:'DELETE'
  });

  if(!r.ok){
    if(r.status===401)_reportAuthFailure();
    fbCacheInvalidate(path);
  const t=await r.text();
    throw new Error(`DELETE ${path}/${id}: ${r.status} ${t}`);
  }

  // Undo capture: the pre-read above already paid for the deleted record's
  // full contents — until now it was read and then discarded on every
  // single delete in the app.
  if(_delData && _undoCapturable(path,null)){
    _pushUndo({type:'delete', table:path, id:id, prev:_delData, when:Date.now()});
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
    // SECURITY/DATA-INTEGRITY FIX (2026-10 audit): this bootstrap runs on
    // EVERY page load. It used fbGet(), which returns [] both for a truly
    // empty collection AND for any failed request -- so one dropped read
    // on a live farm looked like "fresh install" and re-created users/admin1
    // with the factory PIN 1234, overwriting the real admin's pin_hash and
    // name. fbGetSafe() returns null on failure, and a failed read now
    // aborts the bootstrap instead of guessing. The write itself is also
    // wrapped: initApp() fires this on every page, and an unhandled
    // rejection here used to surface as a raw console error on load.
    const users = await fbGetSafe('users');
    if(users===null) return;      // read failed — never bootstrap on a network error
    if(users.length) return;      // a real roster already exists — leave it alone
    try{
      await fbPut('users','admin1',{
        id:'admin1',
        name:'مدير المزرعة',
        role:'admin',
        pin_hash:await hashPin('1234','admin1'),
        active:true,
        created:todayStr()
      });
    }catch(e){
      console.warn('Users.init bootstrap skipped:',e.message);
    }
  }
};

// ── SETTINGS ─────────────────────────────────────────────
function getSettings(){
  const cfg=window.FARM_CONFIG||{};
  // ROBUSTNESS FIX (2026-10 audit): this bare JSON.parse threw on a
  // corrupt/partial farm_settings value, and getSettings() is called from
  // renderNavbarV2() on EVERY page -- one bad character in localStorage
  // blanked the sidebar, the header and the page body at once. getUser()
  // right above already guards its own parse the same way; this now does
  // too, falling back to config.js defaults instead of taking the page down.
  let saved={};
  try{ saved=JSON.parse(localStorage.getItem('farm_settings')||'{}')||{}; }
  catch(e){ saved={}; }

  return{
    farmName:             cfg.farmName||saved.farmName||'بيان المزرعة',
    ownerName:            cfg.ownerName||saved.ownerName||'مدير المزرعة',
    currency:             cfg.currency||saved.currency||'ج.م',

    goatBreeds:           cfg.goatBreeds||saved.goatBreeds||['شامي','بور','بلدي'],
    sheepBreeds:          cfg.sheepBreeds||saved.sheepBreeds||['برقي','دوربر','ميت ماستر'],

    pregnancyDays:        cfg.pregnancyDays||saved.pregnancyDays||150,
    vaccinationAlertDays: cfg.vaccinationAlertDays||saved.vaccinationAlertDays||7,
    weaningDays:          cfg.weaningDays||saved.weaningDays||60,

    // Field-by-field merge (not whole-object) so a farm can override just
    // ONE threshold from Settings later while the other two still fall
    // back to config.js's defaults.
    lifecycle: {
      newborn_months: (cfg.lifecycle&&cfg.lifecycle.newborn_months)||(saved.lifecycle&&saved.lifecycle.newborn_months)||2,
      weaning_months: (cfg.lifecycle&&cfg.lifecycle.weaning_months)||(saved.lifecycle&&saved.lifecycle.weaning_months)||3,
      adult_months:   (cfg.lifecycle&&cfg.lifecycle.adult_months)||(saved.lifecycle&&saved.lifecycle.adult_months)||12,
    },

    logoUrl:              saved.logoUrl||'media/logo-icon.svg',
    farmAddress:          saved.farmAddress||'',
  };
}

function saveSettings(s){
  localStorage.setItem('farm_settings',JSON.stringify(s));
}

// ── INIT ─────────────────────────────────────────────────
async function initApp(){
  initFirebase();
  // Never let the boot-time bootstrap become an unhandled rejection on
  // every page (it fires before any page code runs, so nothing downstream
  // could catch it). Users.init() is best-effort by nature: a farm that
  // already has users needs nothing from it, and a farm that can't reach
  // the database right now must simply carry on rendering.
  try{ await Users.init(); }
  catch(e){ console.warn('initApp: Users.init skipped —', e && e.message); }
}
initApp();