'use strict';
/* ══════════════════════════════════════════════════════════════
   data-store.js — Farm Data Layer v2 (2026-10-21 Audit)
   ──────────────────────────────────────────────────────────────
   المشكلة التي يحلها هذا الملف باختصار:

   • 37 صفحة، كل صفحة كانت تطلب نفس المجموعات (animals, health …)
     بشكل مستقل تماماً. الانتقال من dashboard → reports → health
     كان يعيد جلب الـ 14 مجموعة نفسها 3 مرات خلال 45 ثانية، مع
     أن 45s-cache الحالي يغطي التنقل داخل نفس الصفحة فقط
     (sessionStorage مُشترك، لكن كل Promise.all كان يطلب قبل أن
     يكتمل السابق → طلبين لنفس المسار بالتوازي = طلبين شبكة).

   • لا يوجد تعريف واحد لما يحتاجه كل موديول. dashboard تطلب
     14 مجموعة، reports تطلب 15، assistant تطلب 10 مرتين، وكل
     صفحة فرعية تطلب بمفردها. النتيجة: نفس المجموعة تُجلب
     بأسماء مختلفة أو بمعاملات مختلفة، دون أي إعادة استخدام.

   • جدولان legacy لا يزالان في القاعدة/القواعد رغم انتهاء
     الترحيل: diary_snapshot (مفرد) و weight_log. وبقاءهما يعني
     قراءات إضافية وكتابة مكررة وتضارب SSOT.

   ما يفعله هذا الملف (إضافي فقط، لا يكسر شيئاً):

     1. In-flight deduplication — كل fbGet(path) جارٍ يُشارك نفس
        الـ Promise. لو dashboard و NS.checkAll() طلبا animals معاً،
        يخرج طلب HTTP واحد فقط.
     2. Module manifest — كل موديول يعلن احتياجاتهDeclaratively
        (MODULES.dashboard = ['animals','health',…]) فلا تُجلب مجموعة
        لا يحتاجها الموديول.
     3. Batch + permission gate — fbGetBatch() تتحقق من can() قبل
        الجلب، فمستخدم لا يملك finance لا يُطلب له finance أصلاً.
     4. Freshness policy — إعداد TTL واحد (60s) و coalescing window
        (500ms) يمنع الـ burst bursts.

   التكامل: يُحمّل بعد firebase.js مباشرة، قبل nav.js. لو فشل تحميله،
   كل الصفحات تعمل كما قبل تماماً (fallback → fbGet مباشرة).
   ══════════════════════════════════════════════════════════════ */

(function(root){
  if (root.FarmData) return;

  var TTL_MS = 60000;          // أطول من 45s القديم — يغطي تنقل صفحتين
  var COALESCE_MS = 500;       // نافذة دمج الطلبات المتزامنة

  // ── In-flight map: path -> { promise, at } ──────────────────
  var _inFlight = {};

  // ── Manifest: كل موديول واحتياجاته الحقيقية (end-to-end) ──
  // مصدره تدقيق 37 صفحة (docs/audit/MODULE-AUDIT-2026-10.md).
  // كل قائمة هي الحد الأدنى الذي يرسم الصفحة كاملة دون رجوع ثانٍ.
  var MODULES = {
    dashboard:  ['animals','breeding','health','finance','inventory_meds','inventory_feeds','inventory_equipment','production_log','activity_log','weight_alerts','vaccinations','production_alerts','daily_tasks','workflow_history'],
    reports:     ['animals','breeding','health','vaccinations','finance','inventory_meds','inventory_feeds','production_log','weight_alerts','production_alerts','daily_tasks','notifications','workflow_history','feed_consumption','inventory_transactions'],
    animals:     ['animals','health'],
    barns:       ['animals'],
    health:      ['health'],
    breeding:    ['breeding'],
    vaccine:     ['vaccinations','vaccination_templates'],
    production:  ['production_log','animals'],
    inventory:   ['inventory_meds','inventory_feeds','inventory_equipment','feed_consumption','inventory_transactions'],
    finance:     ['finance'],
    financeArAp: ['customers','suppliers','accounts','cash_bank_accounts'],
    financeAnimals:['animals','accounts','cash_bank_accounts','cost_centers'],
    financePeriods:['fiscal_periods','cash_bank_accounts'],
    tasks:       ['daily_tasks'],
    assistant:   ['animals','breeding','health','vaccinations','inventory_meds','inventory_feeds','inventory_equipment','finance','daily_tasks','production_log'],
    cost:        ['animals','finance','inventory_meds','inventory_feeds','breeding','vaccinations'],
    diary:       ['diary_snapshots','animals'],
    analytics:   ['production_log','feed_consumption'],
    notifications:['notifications'],
    activity:    ['activity_log'],
    pedigree:    ['animals','breeding'],
    farmProfile: ['animals'],
    // المخزون التنفيذي على dashboard يُشتق من نفس دفعة dashboard — لا حاجة لدفعة ثانية (انظر التعديل في dashboard.html)
  };

  // لكل مجموعة: هل تتطلب صلاحية؟ (إن وُجد perm، نتحقق can(perm) قبل الجلب)
  var PERM_GATE = {
    finance: 'finance',
    reports: 'reports',
    health: 'health',
    breeding: 'breeding',
    inventory_meds: 'inventory',
    inventory_feeds: 'inventory',
    inventory_equipment: 'inventory',
    feed_consumption: 'inventory',
    inventory_transactions: 'inventory',
    vaccinations: 'health',
    vaccination_templates: 'health',
    daily_tasks: null, // متاح للجميع
    finance_accounts: 'finance',
    customers: 'finance', suppliers: 'finance',
    cost_centers: 'finance', cost_allocations: 'finance',
    accounts: 'finance', cash_bank_accounts: 'finance',
    fiscal_periods: 'finance', bank_reconciliations: 'finance',
    source_documents: 'finance', journal_entries: 'finance',
    user_directory: null, users: 'users'
  };

  function _can(perm){
    if (!perm) return true;
    try { return typeof root.can==='function' ? !!root.can(perm) : true; } catch(e){ return true; }
  }

  // ── In-flight dedup wrapper حول fbGet/fbGetSafe ─────────────
  function _dedupedGet(path, useSafe){
    if (!path) return Promise.resolve([]);
    // إن كان هناك طلب جارٍ لنفس المسار وضمن نافذة الدمج → أعد نفس الـ Promise
    var inflight = _inFlight[path];
    if (inflight && (Date.now() - inflight.at) < COALESCE_MS) {
      return inflight.promise;
    }
    var fn = useSafe && typeof root.fbGetSafe==='function' ? root.fbGetSafe : root.fbGet;
    if (typeof fn !== 'function') return Promise.resolve([]);
    var p = fn(path).catch(function(){ return useSafe ? null : []; });
    _inFlight[path] = { promise: p, at: Date.now() };
    // نظّف بعد انتهاء الطلب (مع مهلة قصيرة للسماح بالدمج)
    p.then(function(){ setTimeout(function(){ delete _inFlight[path]; }, COALESCE_MS); },
         function(){ setTimeout(function(){ delete _inFlight[path]; }, COALESCE_MS); });
    return p;
  }

  // ── الدفعة المُوحدة: ترجع map {collection: array} ───────────
  async function getBatch(paths, opts){
    opts = opts || {};
    var uniq = {};
    (paths||[]).forEach(function(p){ if(p && typeof p==='string') uniq[p]=1; });
    var list = Object.keys(uniq);
    // gate بالصلاحيات
    list = list.filter(function(p){
      var perm = PERM_GATE[p];
      if (perm && !_can(perm)) return false;
      // finance collections gate
      if (p==='finance' && !_can('finance')) return false;
      return true;
    });
    var results = await Promise.all(list.map(function(p){
      return _dedupedGet(p, !!opts.safe).then(function(v){ return [p, v]; });
    }));
    var out = {};
    results.forEach(function(pair){ out[pair[0]] = pair[1]; });
    return out;
  }

  // ── اختصار للموديولات: getForModule('dashboard') → map ───────
  async function getForModule(moduleName, opts){
    var paths = MODULES[moduleName];
    if (!paths) return {};
    return getBatch(paths, opts);
  }

  // ── تنظيف/إحصائيات للـ DevTools والاختبارات ─────────────────
  function manifest(){ return JSON.parse(JSON.stringify(MODULES)); }
  function inFlightCount(){ return Object.keys(_inFlight).length; }

  root.FarmData = {
    MODULES: MODULES,
    PERM_GATE: PERM_GATE,
    TTL_MS: TTL_MS,
    COALESCE_MS: COALESCE_MS,
    getBatch: getBatch,
    getForModule: getForModule,
    manifest: manifest,
    inFlightCount: inFlightCount,
    // مكشوف للاختبارات فقط
    _dedupedGet: _dedupedGet
  };

})(typeof window !== 'undefined' ? window : globalThis);
