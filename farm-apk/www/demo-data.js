/* ══════════════════════════════════════════════════════════════════════
   demo-data.js — وضع العرض ببيانات تجريبية (Demo Mode) · 2026-10-20

   لماذا هذا الملف موجود
   ─────────────────────
   كل صفحة في التطبيق تقرأ وتكتب من خلال عنق زجاجة واحد: دوال `fb*` في
   `firebase.js`، وكلها تنتهي إلى `fetch()` على نطاق RTDB أو على نطاقات
   مصادقة Google. فبدل أن نستبدل تلك الدوال (ونجازف باختلاف أشكال الإرجاع
   عن الحقيقة)، نعترض **النقل نفسه**: أي طلب إلى
   `firebasedatabase.app|firebaseio.com|googleapis.com` يُخدم من مخزن
   تجريبي داخل الصفحة، وكل شيء آخر (الطقس، `/api/groq`، `/api/claude`،
   الأصول المحلية) يمر كما هو.

   النتيجة: المحللات الحقيقية في `firebase.js` هي التي تبني أشكال الإرجاع،
   فالكاش والإعادة والتراجع (undo) وسجل النشاط وكل الأقسام تشتغل كما في
   الحقيقة، مع **صفر بايتات إلى قاعدة البيانات الحية**. وهذا هو نفس المبدأ
   الذي يجعل الاختبارات الهرمية (`tests/fixtures/farm-test.js`) تعترض نفس
   النطاقات — الفرق أن هنا الاعتراض داخل المتصفح ولصالح المستخدم.

   كيف تبقى البيانات بعد التنقّل (التطبيق متعدد الصفحات)
   ─────────────────────────────────────────────────────
   القاعدة الأساسية **مولّدة حتميًّا** من بذرة (mulberry32) في كل تحميل
   صفحة — نفس الأرقام في كل مرة، فلا تتغير التقارير بين الصفحات ولا بين
   لقطات الشاشة. وما يكتبه المستخدم أثناء العرض يُحفظ **كطبقة عمليات**
   (ops) صغيرة في `localStorage` وتُعاد فوق القاعدة. هكذا نتجنّب تخزين
   عشرات الآلاف من السجلات في `localStorage` (حدّه ~٥ ميجابايت) وفي نفس
   الوقت لا يضيع ما أضفته أو عدّلته أو حذفته وأنت تتنقل بين الصفحات.

   ما لا يفعله هذا الملف
   ─────────────────────
   لا يكتب في `farm-mz99` إطلاقًا، ولا يلمس `pin_vault` الحقيقي (مسار
   الدخول التجريبي يقارن الرمز محليًّا)، ولا يغيّر أي سلوك حين يكون الوضع
   مقفولًا — في تلك الحالة لا يُثبَّت المعترض من الأساس.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var FLAG = 'farm_demo';
  var SIZE_KEY = 'farm_demo_size';
  var SEED_KEY = 'farm_demo_seed';
  var OPS_KEY = 'farm_demo_ops';
  var USER_KEY = 'farm_user';

  var BASE_SEED = 20261020;
  var MAX_OPS = 400;                     // keep the overlay far below the quota
  var BACKEND = /(firebasedatabase\.app|firebaseio\.com|googleapis\.com)/;

  var SIZES = {
    small:  { label: 'صغير',  animals: 20,  days: 30,  finPerDay: 2 },
    medium: { label: 'متوسط', animals: 120, days: 90,  finPerDay: 3 },
    large:  { label: 'كبير',  animals: 300, days: 180, finPerDay: 4 }
  };

  /* ── حالة الوضع ─────────────────────────────────────────────────── */
  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  function isEnabled() { return ls(FLAG) === '1'; }
  function size() { var s = ls(SIZE_KEY); return SIZES[s] ? s : 'medium'; }
  function conf() { return SIZES[size()]; }
  function seedOffset() { return parseInt(ls(SEED_KEY) || '0', 10) || 0; }

  /* ── مولّد عشوائي حتمي ──────────────────────────────────────────── */
  var _state = BASE_SEED;
  function reseed() { _state = (BASE_SEED + seedOffset() * 7919) >>> 0; }
  function rnd() {                       // mulberry32
    _state = (_state + 0x6D2B79F5) >>> 0;
    var t = _state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function int(min, max) { return min + Math.floor(rnd() * (max - min + 1)); }
  function pick(a) { return a[Math.floor(rnd() * a.length)]; }
  function chance(p) { return rnd() < p; }
  function money(min, max) { return Math.round((min + rnd() * (max - min)) * 100) / 100; }
  function round1(n) { return Math.round(n * 10) / 10; }

  /* التواريخ تُبنى بأرقام لاتينية — `pad2()` في shared.js للعرض فقط
     (يحوّل إلى أرقام عربية) ولو استُخدم هنا لأنتج مفاتيح مثل ٢٠٢٦-١٠-٢٠. */
  function p2(n) { return n < 10 ? '0' + n : '' + n; }
  function day(offset) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + offset);
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  }
  function iso(offsetDays, hour) {
    var d = new Date(); d.setDate(d.getDate() + (offsetDays || 0));
    if (hour != null) d.setHours(hour, int(0, 59), 0, 0);
    return d.toISOString();
  }
  function today() { return day(0); }
  function periodKey(offsetMonths) {
    var d = new Date(); d.setHours(12, 0, 0, 0); d.setMonth(d.getMonth() - (offsetMonths || 0));
    return d.getFullYear() + '-' + p2(d.getMonth() + 1);
  }
  function periodRange(key) {
    var p = key.split('-'), y = +p[0], m = +p[1];
    var last = new Date(y, m, 0).getDate();
    return { start: y + '-' + p2(m) + '-01', end: y + '-' + p2(m) + '-' + p2(last) };
  }

  /* ── مفردات المزرعة ─────────────────────────────────────────────── */
  var CFG = (typeof FARM_CONFIG !== 'undefined' && FARM_CONFIG) || {};
  var GOAT_BREEDS = CFG.goatBreeds && CFG.goatBreeds.length ? CFG.goatBreeds : ['شامي', 'بور', 'بلدي'];
  var SHEEP_BREEDS = CFG.sheepBreeds && CFG.sheepBreeds.length ? CFG.sheepBreeds : ['برقي', 'دوربر', 'ميت ماستر'];
  var BARNS = ['عنبر ١', 'عنبر ٢', 'حظيرة الألبان', 'حظيرة التسمين'];
  var PURPOSES = ['birth', 'tarbiya', 'production', 'sale'];
  var DIAGNOSES = ['التهاب ضرع', 'إسهال', 'نفخة', 'عرج', 'التهاب رئوي', 'جرح سطحي', 'ضعف عام'];
  var MEDS = ['أوكسي تتراسيكلين', 'بنسلين ستربتوميسين', 'إيفرمكتين', 'كالسيوم بور جلوكونات', 'محلول معالجة الجفاف'];
  var VACCINES = ['الحمى القلاعية', 'الجلد العقدي', 'التسمم الدموي', 'الجدري', 'الالتهاب الرئوي البلوري', 'البروسيلا'];
  var TASKS = [
    { title: 'حلب الصباح', category: 'production', priority: 'high' },
    { title: 'حلب المساء', category: 'production', priority: 'high' },
    { title: 'تقديم العليقة', category: 'feeding', priority: 'high' },
    { title: 'تنظيف العنبر', category: 'hygiene', priority: 'medium' },
    { title: 'فحص الضرع', category: 'health', priority: 'medium' },
    { title: 'تسجيل الأوزان', category: 'data', priority: 'low' },
    { title: 'فحص مياه الشرب', category: 'hygiene', priority: 'medium' }
  ];
  var FIN_INCOME = [['حليب', 900, 5200], ['بيع حيوانات', 3000, 26000], ['بيع سماد', 400, 2200], ['بيع صوف', 300, 1500]];
  var FIN_EXPENSE = [['أعلاف', 1200, 9000], ['أدوية وتحصين', 250, 2600], ['عمالة', 1500, 6000],
    ['صيانة ومعدات', 200, 2400], ['مياه وكهرباء', 400, 1800], ['نقل', 150, 900]];

  /* شجرة حسابات مصغّرة تُستخدم فقط إذا لم تكن القاعدة مزروعة بعد —
     التطبيق يزرع شجرته الرسمية بنفسه (seedDefaultChartOfAccounts) حين
     يقرأ `accounts` فارغة، ونحن نتركها فارغة له ثم نقتبس معرفاته. */
  var MINI_CHART = [
    ['1100', 'الصندوق', 'asset', null, true],
    ['1200', 'البنك', 'asset', null, true],
    ['1300', 'الذمم المدينة', 'asset', null, false],
    ['1500', 'المخزون', 'asset', null, false],
    ['1600', 'الأصول الثابتة', 'asset', null, false],
    ['1690', 'مجمع الإهلاك', 'asset', null, false],
    ['2100', 'الذمم الدائنة', 'liability', null, false],
    ['3100', 'رأس المال', 'equity', null, false],
    ['3200', 'الأرباح المحتجزة', 'equity', null, false],
    ['4100', 'إيرادات التشغيل', 'revenue', null, true],
    ['5100', 'مصروفات التشغيل', 'expense', null, true]
  ];

  /* ── المستخدمون التجريبيون ──────────────────────────────────────── */
  /* أسماء الأدوار فقط — لا أسماء أشخاص (بلاغ المالك 2026-10-20). */
  var DEMO_USERS = [
    { id: 'demo-admin', name: 'مدير العرض', role: 'admin', pin: '1234' },
    { id: 'demo-supervisor', name: 'مشرف العرض', role: 'supervisor', pin: '1234' },
    { id: 'demo-worker', name: 'عامل العرض', role: 'worker', pin: '1234' }
  ];
  function demoUser(id) {
    var u = DEMO_USERS.filter(function (x) { return x.id === (id || 'demo-admin'); })[0] || DEMO_USERS[0];
    return { id: u.id, name: u.name, role: u.role, active: true, email: u.id + '@demo.local', demo: true };
  }

  /* ── المولّدات ──────────────────────────────────────────────────── */
  /* كل مولّد يرجع «خريطة» بالصيغة التي يخزنها Firebase فعليًا
     ({id: record}) لأن محللات fbGet في firebase.js تفترضها. */
  var GEN = {};

  GEN.settings = function () {
    return {
      single: {
        farmName: 'مزرعة العرض التجريبية', ownerName: 'وضع العرض', currency: CFG.currency || 'ج.م',
        fiscalYearStartMonth: 1, demo: true, updated_at: iso(0)
      }
    };
  };

  GEN.users = function () {
    var out = {};
    DEMO_USERS.forEach(function (u) {
      out[u.id] = {
        id: u.id, name: u.name, role: u.role, active: true, email: u.id + '@demo.local',
        phone: '010' + int(10000000, 99999999), created_at: iso(-120), last_login: iso(0, 7),
        demo: true, demo_pin: u.pin
      };
    });
    return out;
  };

  GEN.user_directory = function () {
    var out = {};
    DEMO_USERS.forEach(function (u) {
      out[u.id] = { id: u.id, name: u.name, role: u.role, active: true, has_pin: true, photo: '', demo: true };
    });
    return out;
  };

  /* خزنة رموز وهمية صريحة: لا هاش حقيقي ولا قراءة من القاعدة الحية. */
  GEN.pin_vault = function () {
    var out = {};
    DEMO_USERS.forEach(function (u) {
      out[u.id] = { pin_hash_v2: 'demo-' + u.id, algo: 'demo', salt: 'demo', created_at: iso(-120), demo: true };
    });
    return out;
  };

  GEN.uid_lookup = function () {
    return { 'uid-demo-admin': 'demo-admin', 'uid-demo-supervisor': 'demo-supervisor', 'uid-demo-worker': 'demo-worker' };
  };

  /* القطيع — العمود الفقري: أغلب الصفحات تقرأه أو تقرأ ما يرتبط به. */
  var _herd = null;
  function herd() {
    if (_herd) return _herd;
    var n = conf().animals, out = {}, tags = [];
    var i, sp, breed, gender, purpose, status, birthOffset, weight, tag, barn, rec;
    for (i = 0; i < n; i++) {
      sp = chance(0.55) ? 'goat' : 'sheep';
      breed = sp === 'goat' ? pick(GOAT_BREEDS) : pick(SHEEP_BREEDS);
      gender = chance(0.72) ? 'female' : 'male';
      purpose = pick(PURPOSES);
      status = chance(0.9) ? 'alive' : (chance(0.55) ? 'dead' : 'sold');
      birthOffset = -int(30, 1500);
      weight = sp === 'goat' ? money(18, 62) : money(25, 78);
      tag = (sp === 'goat' ? 'GT-' : 'SH-') + p2(Math.floor(i / 100)) + p2(i % 100) + '' + int(1, 9);
      barn = pick(BARNS);
      rec = {
        tag: tag, species: sp, breed: breed, gender: gender, purpose: purpose, status: status,
        birth_date: day(birthOffset), barn: barn,
        current_weight: status === 'alive' ? round1(weight) : null,
        weight_updated: status === 'alive' ? day(-int(0, 12)) : null,
        pregnancy_status: (gender === 'female' && status === 'alive') ? pick(['empty', 'pregnant', 'lactating']) : 'empty',
        mother_tag: chance(0.5) && tags.length ? pick(tags) : null,
        father_tag: chance(0.3) && tags.length ? pick(tags) : null,
        notes: null, created_at: iso(birthOffset), weights: {}
      };
      if (status === 'dead') { rec.death_date = day(-int(1, 60)); rec.death_cause = pick(DIAGNOSES); rec.death_id = 'D' + day(-int(1, 60)).replace(/-/g, '') + '-' + int(10, 99); }
      if (status === 'sold') { rec.sale_date = day(-int(1, 90)); rec.sale_price = money(2500, 18000); }
      /* سجل الأوزان داخل سجل الحيوان — هذا هو مصدر الحقيقة (O-15). */
      if (status === 'alive') {
        var w = weight * 0.86, k;
        for (k = 0; k < 8; k++) {
          w = w * (1 + (rnd() * 0.05 - 0.012));
          rec.weights['w' + (k + 1)] = { date: day(-(8 - k) * Math.max(3, Math.floor(conf().days / 8))), weight: round1(w) };
        }
        rec.current_weight = round1(w);
      }
      out['a' + (i + 1)] = rec;
      tags.push(tag);
    }
    _herd = out;
    return out;
  }
  GEN.animals = herd;

  /* سلسلة يومية للإنتاج (حليب أساسًا + صوف للأغنام). */
  GEN.production_log = function () {
    var h = herd(), days = conf().days, out = {}, c = 0, id, a, d, lact, q;
    for (id in h) {
      a = h[id];
      if (a.status !== 'alive') continue;
      lact = (a.gender === 'female' && a.pregnancy_status !== 'empty');
      if (!lact && a.species !== 'sheep') continue;
      for (d = 0; d < days; d++) {
        if (!lact && !chance(0.03)) continue;              // wool: a few events only
        q = lact ? round1(money(0.8, 3.6)) : round1(money(0.4, 1.6));
        out['p' + (++c)] = {
          type: lact ? 'milk' : 'wool', date: day(-d), animal_id: id, animal_tag: a.tag,
          animal_breed: a.breed, animal_species: a.species, animal_gender: a.gender,
          quantity: q, unit: lact ? 'لتر' : 'كجم', barn: a.barn, session: lact ? (chance(0.5) ? 'صباح' : 'مساء') : null,
          created_at: iso(-d, lact ? 6 : 11)
        };
      }
    }
    return out;
  };

  GEN.feed_consumption = function () {
    var days = conf().days, out = {}, c = 0, d;
    for (d = 0; d < days; d++) {
      BARNS.forEach(function (b) {
        if (!chance(0.85)) return;
        out['f' + (++c)] = {
          date: day(-d), barn: b, feed_name: pick(['علف مركز', 'برسيم', 'تبن', 'ذرة صفراء', 'كسب فول صويا']),
          quantity_kg: int(20, 240), recorded_by: pick(['مشرف العرض', 'عامل العرض']), notes: null, created_at: iso(-d, 8)
        };
      });
    }
    return out;
  };

  GEN.health = function () {
    var h = herd(), ids = Object.keys(h), out = {}, c = 0, n = Math.max(6, Math.round(ids.length * 0.22)), i, id, a, off;
    for (i = 0; i < n; i++) {
      id = ids[int(0, ids.length - 1)]; a = h[id]; off = -int(0, conf().days);
      out['h' + (++c)] = {
        animal_tag: a.tag, animal_id: id, animal_breed: a.breed, animal_species: a.species, barn: a.barn,
        date: day(off), vet_name: 'د. بيطري', diagnosis: pick(DIAGNOSES), medication: pick(MEDS),
        dosage: pick(['5 مل', '10 مل', '2 مل/كجم', 'عبوة واحدة']), withdrawal_days: int(3, 14),
        treatment_end: day(off + int(3, 10)), withdrawal_end: chance(0.6) ? day(off + int(5, 20)) : null,
        bcs: chance(0.5) ? String(int(2, 4)) : null,
        status: pick(['under_treatment', 'treated', 'recovered']), notes: null, created_at: iso(off, 10)
      };
    }
    return out;
  };

  GEN.vaccinations = function () {
    var out = {}, c = 0, i, off, done;
    for (i = 0; i < Math.max(8, Math.round(conf().animals / 8)); i++) {
      off = -int(-30, conf().days);                        // includes upcoming schedules
      done = off <= 0 && chance(0.7);
      out['v' + (++c)] = {
        name: pick(VACCINES), target_section: pick(BARNS.concat(['كل القطيع'])),
        count: int(5, conf().animals), status: done ? 'done' : (off > 0 ? 'scheduled' : 'pending'),
        scheduled_date: day(off), done_date: done ? day(off) : null,
        progress: done ? 100 : int(0, 60), repeat: pick(['6 أشهر', '12 شهرًا', null]),
        notes: null, created_at: iso(off, 9)
      };
    }
    return out;
  };

  GEN.vaccination_templates = function () {
    var out = {};
    VACCINES.forEach(function (v, i) {
      out['t' + (i + 1)] = {
        name: v, target: i % 2 ? 'كل القطيع' : pick(BARNS), interval_months: pick([6, 12]),
        vaccine_type: v, notes: null, custom: false, created_at: iso(-200)
      };
    });
    return out;
  };

  GEN.breeding = function () {
    var h = herd(), females = Object.keys(h).filter(function (k) { return h[k].gender === 'female' && h[k].status === 'alive'; });
    var males = Object.keys(h).filter(function (k) { return h[k].gender === 'male' && h[k].status === 'alive'; });
    var out = {}, c = 0, n = Math.max(6, Math.round(females.length * 0.35)), i, f, m, mate, state;
    for (i = 0; i < n; i++) {
      f = females[int(0, females.length - 1)]; m = males.length ? males[int(0, males.length - 1)] : null;
      mate = -int(10, conf().days + 60); state = mate < -150 ? 'born' : (chance(0.6) ? 'pregnant' : 'open');
      out['b' + (++c)] = {
        female_tag: h[f].tag, mother_tag: h[f].tag, female_breed: h[f].breed, mother_breed: h[f].breed,
        female_species: h[f].species, male_tag: m ? h[m].tag : null,
        mating_date: day(mate), expected_birth: day(mate + (CFG.pregnancyDays || 150)),
        actual_birth: state === 'born' ? day(mate + (CFG.pregnancyDays || 150) + int(-5, 5)) : null,
        status: state, offspring_count: state === 'born' ? int(1, 3) : null,
        male_offspring: state === 'born' ? int(0, 2) : null,
        female_offspring: state === 'born' ? int(0, 2) : null,
        notes: null, created_at: iso(mate, 12)
      };
    }
    return out;
  };

  GEN.inventory_meds = function () {
    var out = {};
    MEDS.concat(['مطهر', 'فيتامين أ د هـ', 'مضاد طفيليات']).forEach(function (name, i) {
      out['m' + (i + 1)] = {
        name: name, unit: pick(['عبوة', 'زجاجة', 'أمبول']), quantity: int(0, 40), min_quantity: int(3, 10),
        expiry: day(int(-20, 400)), barn: pick(BARNS), purpose: 'علاجي', notes: null,
        supplier: pick(['شركة الأدوية البيطرية', 'مستودع المدينة', 'الموزع المحلي']),
        reorder_quantity: int(5, 15), active: true
      };
    });
    return out;
  };

  GEN.inventory_feeds = function () {
    var out = {};
    ['علف مركز', 'برسيم', 'تبن', 'ذرة صفراء', 'كسب فول صويا', 'نخالة'].forEach(function (name, i) {
      out['fd' + (i + 1)] = {
        name: name, unit: pick(['شيكارة', 'كجم', 'قنطار']), unit_weight: pick([25, 50]),
        quantity: int(5, 320), min_quantity: int(20, 60), cost_per_unit: money(180, 900),
        barn: pick(BARNS), purpose: 'تغذية'
      };
    });
    return out;
  };

  GEN.inventory_equipment = function () {
    var out = {};
    ['ماكينة حلب', 'جرار', 'خلاط علف', 'مقص صوف', 'ثلاجة أدوية', 'مولد كهرباء'].forEach(function (name, i) {
      out['e' + (i + 1)] = {
        name: name, type: pick(['معدات حلب', 'معدات مزرعة', 'تجهيزات']), status: chance(0.8) ? 'working' : 'maintenance',
        next_maintenance: day(int(5, 180)), asset_number: 'AST-' + (1000 + i), notes: null
      };
    });
    return out;
  };

  GEN.inventory_transactions = function () {
    var out = {}, c = 0, i, tbl, item, qty;
    for (i = 0; i < Math.max(10, conf().days / 2); i++) {
      tbl = pick(['inventory_meds', 'inventory_feeds']);
      item = tbl === 'inventory_meds' ? pick(MEDS) : pick(['علف مركز', 'برسيم', 'تبن']);
      qty = int(1, 40);
      out['it' + (++c)] = {
        table: tbl, item_name: item, type: chance(0.55) ? 'out' : 'in', quantity: qty,
        before: int(10, 120), after: int(10, 120), date: day(-int(0, conf().days)),
        reason: pick(['استهلاك يومي', 'توريد', 'جرد وتصحيح', 'إعدام منتهي الصلاحية']),
        by: pick(['مشرف العرض', 'عامل العرض']), created_at: iso(-int(0, conf().days), 10)
      };
    }
    return out;
  };

  GEN.finance = function () {
    var days = conf().days, per = conf().finPerDay, out = {}, c = 0, d, k, cat, amt, isIncome;
    for (d = 0; d < days; d++) {
      for (k = 0; k < per; k++) {
        isIncome = chance(0.48);
        var row = isIncome ? pick(FIN_INCOME) : pick(FIN_EXPENSE);
        cat = row[0]; amt = money(row[1], row[2]);
        out['fin' + (++c)] = {
          type: isIncome ? 'income' : 'expense', category: cat, amount: amt, date: day(-d),
          description: cat + ' — ' + pick(BARNS), source: 'demo', reference: 'DEM-' + (1000 + c),
          operator: 'مدير العرض', reason: null, related_animal: null, related_inventory_item: null,
          related_module: isIncome ? 'production' : 'inventory', added_by: 'مدير العرض',
          barn: pick(BARNS), created_at: iso(-d, 14)
        };
      }
    }
    return out;
  };

  /* شجرة الحسابات: نتركها للتطبيق يزرع شجرته الرسمية، فإن وُجدت اقتبسنا
     معرفاتها الحقيقية للقيود، وإلا زرعنا شجرة مصغّرة متسقة داخليًا. */
  GEN.accounts = function () {
    return null;                       // deliberately empty → app self-seeds
  };
  function ensureAccounts() {
    ensureGen('accounts');
    var codes = Object.keys(data.accounts || {});
    if (!codes.length) {
      var chart = {};
      MINI_CHART.forEach(function (a) {
        chart[a[0]] = {
          code: a[0], name_ar: a[1], name_en: null, type: a[2], parentId: a[3],
          postable: a[4], normalBalance: (a[2] === 'revenue' || a[2] === 'equity' || a[2] === 'liability') ? 'credit' : 'debit',
          active: true, systemAccount: false, demo: true, created_at: iso(-200)
        };
      });
      data.accounts = chart;
      codes = Object.keys(chart);
    }
    var byType = {};
    codes.forEach(function (c) {
      var rec = data.accounts[c]; if (!rec) return;
      var t = rec.type || 'expense';
      (byType[t] = byType[t] || []).push(c);
    });
    return byType;
  }

  GEN.journal_entries = function () {
    var byType = ensureAccounts();
    var cash = (byType.asset && byType.asset[0]) || '1100';
    var rev = (byType.revenue && byType.revenue[0]) || '4100';
    var exp = (byType.expense && byType.expense[0]) || '5100';
    var ap = (byType.liability && byType.liability[0]) || '2100';
    var fin = ensureGen('finance') || {}, out = {}, c = 0, id, r, amt, lines;
    for (id in fin) {
      r = fin[id];
      if (!chance(0.55)) continue;                    // a realistic subset, not every receipt
      amt = Math.round((r.amount || 0) * 100) / 100;
      if (r.type === 'income') {
        lines = [{ accountId: cash, debit: amt, credit: 0 }, { accountId: rev, debit: 0, credit: amt }];
      } else {
        lines = [{ accountId: exp, debit: amt, credit: 0 }, { accountId: ap, debit: 0, credit: amt }];
      }
      out['je' + (++c)] = {
        date: r.date, description: (r.type === 'income' ? 'إيراد' : 'مصروف') + ': ' + r.category,
        sourceType: r.type === 'income' ? 'sale' : 'purchase', sourceId: id, status: 'POSTED',
        lines: lines, totalDebit: amt, totalCredit: amt, reversesJournalEntryId: null,
        createdBy: 'مدير العرض', createdAt: iso(0, 15), postedBy: 'مدير العرض', postedAt: iso(0, 15),
        demo: true
      };
    }
    return out;
  };

  GEN.fiscal_periods = function () {
    var out = {}, i, key, range, status;
    for (i = 0; i < 5; i++) {
      key = periodKey(i); range = periodRange(key);
      status = i === 0 ? 'OPEN' : (i === 1 ? 'LOCKED' : 'CLOSED');
      out[key] = {
        periodKey: key, startDate: range.start, endDate: range.end, status: status,
        createdBy: 'مدير العرض', createdAt: iso(-30 * i),
        lockedAt: status === 'OPEN' ? null : iso(-30 * (i - 1)), lockedBy: status === 'OPEN' ? null : 'مدير العرض'
      };
    }
    return out;
  };

  GEN.cash_bank_accounts = function () {
    return {
      cb1: { name: 'الصندوق الرئيسي', type: 'cash', bank_name: null, account_number: null, opening_balance: 15000, current_balance: 24350.5, currency: CFG.currency || 'ج.م', linked_account_id: '1100', active: true, created_at: iso(-200) },
      cb2: { name: 'حساب البنك الزراعي', type: 'bank', bank_name: 'البنك الزراعي المصري', account_number: '12' + int(100000, 999999), opening_balance: 60000, current_balance: 81240.75, currency: CFG.currency || 'ج.م', linked_account_id: '1200', active: true, created_at: iso(-200) }
    };
  };

  GEN.customers = function () {
    var out = {}, names = ['مجمع الألبان', 'تاجر ماشية', 'محل أعلاف', 'جمعية زراعية', 'مطعم البلد'];
    names.forEach(function (n, i) {
      out['c' + (i + 1)] = {
        name: n, phone: '01' + int(0, 2) + int(10000000, 99999999), address: pick(['القليوبية', 'الشرقية', 'البحيرة', 'الجيزة']),
        opening_balance: money(0, 5000), balance: money(-2000, 12000), credit_limit: money(10000, 60000),
        notes: null, active: true, created_at: iso(-160)
      };
    });
    return out;
  };

  GEN.suppliers = function () {
    var out = {}, names = ['مصنع الأعلاف', 'شركة الأدوية البيطرية', 'مورد التبن', 'مستودع المدينة'];
    names.forEach(function (n, i) {
      out['s' + (i + 1)] = {
        name: n, phone: '01' + int(0, 2) + int(10000000, 99999999), address: pick(['القليوبية', 'المنوفية', 'الدقهلية']),
        opening_balance: 0, balance: money(0, 18000), payment_terms: pick(['نقدًا', 'آجل ٣٠ يوم', 'آجل ٦٠ يوم']),
        notes: null, active: true, created_at: iso(-160)
      };
    }  );
    return out;
  };

  GEN.budgets = function () {
    var byType = ensureAccounts(), exp = (byType.expense || ['5100']), out = {}, c = 0, i, key;
    for (i = 0; i < 4; i++) {
      key = periodKey(i);
      exp.forEach(function (acc, j) {
        if (j > 2) return;
        out['bg' + (++c)] = {
          periodKey: key, accountId: acc, costCenterId: null, amount: money(5000, 45000),
          notes: null, status: i === 0 ? 'DRAFT' : 'APPROVED', createdBy: 'مدير العرض',
          createdAt: iso(-30 * i), approvedBy: i === 0 ? null : 'مدير العرض', approvedAt: i === 0 ? null : iso(-30 * i)
        };
      });
    }
    return out;
  };

  GEN.cost_centers = function () {
    var out = {};
    BARNS.forEach(function (b, i) {
      out['cc' + (i + 1)] = { name: b, code: 'CC-' + (100 + i), type: 'production', manager: 'مشرف العرض', active: true, created_at: iso(-200) };
    });
    return out;
  };

  GEN.animal_cost_ledger = function () {
    var h = herd(), ids = Object.keys(h).slice(0, Math.min(40, conf().animals)), out = {}, key = periodKey(0);
    ids.forEach(function (id, i) {
      var feed = money(200, 1400), health = money(0, 380), other = money(0, 220);
      out['acl' + (i + 1)] = {
        animal_id: id, animal_tag: h[id].tag, periodKey: key, feed_cost: feed, health_cost: health,
        other_cost: other, total_cost: Math.round((feed + health + other) * 100) / 100, created_at: iso(-5)
      };
    });
    return out;
  };

  GEN.bank_reconciliations = function () {
    var key = periodKey(1);
    return {
      br1: {
        periodKey: key, account_id: 'cb2', statement_balance: 81240.75, cleared_balance: 81240.75,
        difference: 0, status: 'RECONCILED', reconciledAt: iso(-20), reconciledBy: 'مدير العرض', items: []
      }
    };
  };

  GEN.fixed_assets = function () {
    return {
      fa1: { name: 'ماكينة حلب', cost: 42000, purchase_date: day(-420), useful_life_years: 8, depreciation_method: 'straight_line', accumulated_depreciation: 8400, net_book_value: 33600, account_id: '1600', active: true },
      fa2: { name: 'جرار زراعي', cost: 180000, purchase_date: day(-700), useful_life_years: 12, depreciation_method: 'straight_line', accumulated_depreciation: 37500, net_book_value: 142500, account_id: '1600', active: true }
    };
  };

  GEN.loans = function () {
    return {
      ln1: { lender: 'البنك الزراعي المصري', principal: 120000, interest_rate: 9.5, start_date: day(-300), end_date: day(430), monthly_payment: 2510, remaining_balance: 78600, status: 'active', account_id: '2100' }
    };
  };

  GEN.daily_tasks = function () {
    var out = {}, c = 0, d, i, done;
    for (d = 0; d < Math.min(conf().days, 21); d++) {
      for (i = 0; i < TASKS.length; i++) {
        if (!chance(0.75)) continue;
        done = d > 0 ? chance(0.85) : chance(0.4);
        out['tk' + (++c)] = {
          title: TASKS[i].title, category: TASKS[i].category, priority: TASKS[i].priority,
          assigned_to: chance(0.5) ? 'demo-worker' : 'demo-supervisor',
          assigned_to_name: chance(0.5) ? 'عامل العرض' : 'مشرف العرض',
          barn: pick(BARNS), date: day(-d), status: done ? 'done' : 'pending',
          notes: null, template_id: null, recurring: true,
          completed_at: done ? iso(-d, 16) : null, completed_by: done ? 'عامل العرض' : null
        };
      }
    }
    return out;
  };

  GEN.task_templates = function () {
    var out = {};
    TASKS.forEach(function (t, i) {
      out['tt' + (i + 1)] = {
        title: t.title, category: t.category, priority: t.priority, assigned_to: 'demo-worker',
        assigned_to_name: 'عامل العرض', barn: pick(BARNS), notes: null, recurrence: 'daily',
        active: true, last_generated: day(-1)
      };
    });
    return out;
  };

  GEN.diary_snapshots = function () {
    var h = herd(), ids = Object.keys(h), days = Math.min(conf().days, 45), out = {}, d;
    var alive = ids.filter(function (k) { return h[k].status === 'alive'; });
    for (d = 0; d < days; d++) {
      var key = day(-d);
      out[key] = {
        id: key, date: key, total: alive.length,
        goats: alive.filter(function (k) { return h[k].species === 'goat'; }).length,
        sheep: alive.filter(function (k) { return h[k].species === 'sheep'; }).length,
        births: int(0, 3), deaths: int(0, 2), sick: int(0, 6),
        milk: round1(money(40, 260)), feed_kg: int(120, 620),
        created_at: iso(-d, 20), updated_at: iso(-d, 20), user: 'مدير العرض', notes: null
      };
    }
    return out;
  };

  GEN.notifications = function () {
    var out = {}, i, sev;
    var rows = [
      ['danger', 'تحصين متأخر', 'الحمى القلاعية — عنبر ١ تجاوز موعده', 'vaccine.html'],
      ['danger', 'حيوان تحت العلاج', 'حالة التهاب ضرع لم تُغلق بعد فترة السحب', 'health.html'],
      ['warning', 'مخزون منخفض', 'علف مركز وصل إلى حد إعادة الطلب', 'inventory.html'],
      ['warning', 'انخفاض إنتاج', 'انخفاض ملحوظ في حليب عنبر ٢ خلال ٣ أيام', 'production.html'],
      ['info', 'فترة مالية مفتوحة', 'الفترة الحالية ما زالت مفتوحة — راجع القيود', 'finance-periods.html'],
      ['info', 'مهام اليوم', '٤ مهام لم تُنجز بعد', 'tasks.html']
    ];
    for (i = 0; i < rows.length; i++) {
      sev = rows[i][0];
      out['n' + (i + 1)] = {
        id: 'demo-n' + (i + 1), type: sev, severity: sev, title: rows[i][1], body: rows[i][2], message: rows[i][2],
        href: rows[i][3], read: i > 3, read_at: i > 3 ? iso(-1, 9) : null,
        created_at: iso(-i, 8), date: day(-i), for_role: 'admin', demo: true
      };
    }
    return out;
  };

  GEN.login_notifications = function () {
    var out = {}, i;
    for (i = 0; i < 6; i++) {
      out['ln' + (i + 1)] = {
        userName: i % 2 ? 'مشرف العرض' : 'مدير العرض', userRole: i % 2 ? 'supervisor' : 'admin',
        roleLabel: i % 2 ? 'مشرف' : 'مدير', timestamp: iso(-i, 7), date: day(-i), pushed: i > 1
      };
    }
    return out;
  };

  GEN.activity_log = function () {
    var out = {}, c = 0, d, acts = [
      ['add', 'animals', 'إضافة: شامي أنثى'], ['edit', 'health', 'تعديل سجل: التهاب ضرع'],
      ['add', 'production_log', 'تسجيل إنتاج: ٢٤ لتر حليب'], ['add', 'finance', 'إيراد: حليب'],
      ['delete', 'inventory_feeds', 'حذف صنف منتهي'], ['login', 'system', 'تسجيل دخول — مدير العرض']
    ];
    for (d = 0; d < Math.min(conf().days, 30); d++) {
      acts.forEach(function (a, i) {
        if (!chance(0.6)) return;
        out['act' + (++c)] = {
          userId: 'demo-admin', userName: 'مدير العرض', userRole: 'admin',
          action: a[0], resource: a[1], description: a[2], date: day(-d), timestamp: iso(-d, 8 + i)
        };
      });
    }
    return out;
  };

  GEN.weight_alerts = function () {
    var h = herd(), ids = Object.keys(h).filter(function (k) { return h[k].status === 'alive'; }).slice(0, 3), out = {};
    ids.forEach(function (id, i) {
      out['wa' + (i + 1)] = {
        animal_id: id, animal_tag: h[id].tag, barn: h[id].barn, rule_type: 'weight_drop',
        severity: i === 0 ? 'danger' : 'warning', action: 'فحص بيطري', current_weight: h[id].current_weight,
        previous_weight: round1((h[id].current_weight || 30) * 1.08), detail: 'فقدان وزن يتجاوز ٧٪ خلال ١٤ يومًا',
        status: i === 0 ? 'active' : 'resolved', detected_at: iso(-i - 1), resolved_at: i === 0 ? null : iso(0)
      };
    });
    return out;
  };

  GEN.production_alerts = function () {
    var h = herd(), ids = Object.keys(h).filter(function (k) { return h[k].gender === 'female' && h[k].status === 'alive'; }).slice(0, 3), out = {};
    ids.forEach(function (id, i) {
      out['pa' + (i + 1)] = {
        animal_id: id, animal_tag: h[id].tag, production_type: 'milk', barn: h[id].barn,
        status: i === 0 ? 'active' : 'resolved', drop_pct: round1(money(12, 32)),
        recent_average: round1(money(0.8, 1.6)), baseline_average: round1(money(2.0, 3.2)),
        average_at_detection: round1(money(1.0, 1.8)), detected_at: iso(-i - 1),
        resolved_at: i === 0 ? null : iso(0), recovered: i === 0 ? null : false
      };
    });
    return out;
  };

  GEN.forecasts = function () {
    var byType = ensureAccounts(), rev = (byType.revenue && byType.revenue[0]) || '4100';
    return {
      fc1: {
        targetPeriodKey: periodKey(-1), accountId: rev, costCenterId: null,
        method: 'AVERAGE_PRIOR_PERIODS', sourcePeriods: [periodKey(1), periodKey(2)],
        forecastValue: money(40000, 90000),
        assumptions: 'متوسط بسيط للفترات المصدر المذكورة — بيانات تجريبية',
        operationId: 'demo-fc1', createdBy: 'مدير العرض', createdAt: iso(-3)
      }
    };
  };

  GEN.source_documents = function () {
    var out = {}, i;
    for (i = 0; i < 5; i++) {
      out['sd' + (i + 1)] = {
        title: pick(['فاتورة أعلاف', 'إيصال بيع حليب', 'روشتة بيطرية', 'كشف حساب بنك']),
        type: 'invoice', ref: 'DOC-' + (2000 + i), date: day(-int(1, 60)), amount: money(300, 9000),
        status: 'attached', uploaded_by: 'مدير العرض', periodKey: periodKey(0)
      };
    }
    return out;
  };

  /* مجموعات يولّدها التطبيق نفسه (سجل التدقيق، تاريخ سير العمل، الموظفون):
     نتركها فارغة فلا يظهر قسم فاضي بسببنا، بل لأن لا شيء حدث فيها بعد. */

  /* ── المخزن: قاعدة مولّدة + طبقة عمليات ────────────────────────── */
  var data = {};
  var ops = [];
  var stats = { reads: 0, writes: 0, blocked: 0 };

  function deep(obj, parts) {
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null) return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }
  function ensure(obj, parts) {
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    return cur;
  }
  function parseUrl(url) {
    var u = new URL(url, location.href);
    var parts = u.pathname.replace(/^\/+|\/+$/g, '').replace(/\.json$/, '').split('/').filter(Boolean);
    return { parts: parts, query: u.searchParams };
  }

  function loadOps() {
    try { ops = JSON.parse(ls(OPS_KEY) || '[]') || []; } catch (e) { ops = []; }
    if (!Array.isArray(ops)) ops = [];
  }
  function saveOps() {
    if (ops.length > MAX_OPS) ops = ops.slice(ops.length - MAX_OPS);
    lsSet(OPS_KEY, JSON.stringify(ops));
  }

  function applyOp(op) {
    var parts = String(op.p || '').split('/').filter(Boolean);
    if (!parts.length) return;
    if (op.m === 'POST') { ensure(data, parts.slice(0, -1))[parts[parts.length - 1]] = op.b; return; }
    if (op.m === 'PUT') { ensure(data, parts.slice(0, -1))[parts[parts.length - 1]] = op.b; return; }
    if (op.m === 'PATCH') {
      var parent = ensure(data, parts.slice(0, -1)), key = parts[parts.length - 1];
      parent[key] = Object.assign({}, parent[key] || {}, op.b || {});
      return;
    }
    if (op.m === 'DELETE') {
      var p2 = deep(data, parts.slice(0, -1));
      if (p2) delete p2[parts[parts.length - 1]];
      else if (parts.length === 1) delete data[parts[0]];
    }
  }

  function ensureGen(name) {
    if (!name) return null;
    if (!Object.prototype.hasOwnProperty.call(data, name)) {
      var gen = GEN[name];
      data[name] = gen ? gen() : null;
      /* أعد طبقة عمليات هذه المجموعة فوق القاعدة المولّدة */
      ops.forEach(function (op) {
        if (String(op.p || '').split('/')[0] === name) applyOp(op);
      });
    }
    return data[name];
  }

  function record(m, parts, body) {
    ops.push({ m: m, p: parts.join('/'), b: body === undefined ? null : body });
    saveOps();
  }

  var _counter = 0;
  function newKey() {
    _counter++;
    return 'dk' + _counter + Date.now().toString(36).slice(-4);
  }

  function json(v, status) {
    return new Response(v === undefined ? 'null' : JSON.stringify(v), {
      status: status || 200, headers: { 'Content-Type': 'application/json' }
    });
  }

  /* ── محاكي REST — نفس دلالات `createFakeDb` في tests/unit/harness.js
        حتى لا يختلف ما تراه الاختبارات عما يراه المستخدم في وضع العرض. ── */
  function serve(url, opts) {
    opts = opts || {};
    var method = (opts.method || 'GET').toUpperCase();

    /* مصادقة Google: رمز وهمي، فلا bootstrap مجهول ولا شبكة. */
    if (/googleapis\.com/.test(url)) {
      stats.blocked++;
      return json({
        idToken: 'demo-id-token', refreshToken: 'demo-refresh-token', localId: 'uid-demo-admin',
        expiresIn: '3600', access_token: 'demo-id-token', user: { localId: 'uid-demo-admin' }
      });
    }
    if (!BACKEND.test(url)) return null;                  // not ours → real fetch
    stats.blocked++;

    var parsed = parseUrl(url), parts = parsed.parts, q = parsed.query, body = null;
    if (opts.body) { try { body = JSON.parse(opts.body); } catch (e) { body = null; } }

    if (!parts.length) return json(data);                  // whole-database read
    ensureGen(parts[0]);

    if (method === 'GET') {
      stats.reads++;
      var v = deep(data, parts);
      if (v === undefined || v === null) return json(null);
      if (!q.has('orderBy') && !q.has('startAt') && !q.has('endAt') && !q.has('equalTo')
        && !q.has('limitToLast') && !q.has('limitToFirst')) return json(v);

      /* دعم استعلامات RTDB — التطبيق يعتمد عليها (generateAnimalTag,
         isTagTaken, قارئات يومية المزرعة بـorderBy="$key"). */
      var out = Object.assign({}, v);
      var orderRaw = q.get('orderBy');
      var orderField = orderRaw ? orderRaw.replace(/^"|"$/g, '') : null;
      function valOf(key, node) {
        if (orderField === '$key') return key;
        if (orderField === '$value') return node;
        return node && node[orderField];
      }
      var keys = Object.keys(out);
      if (orderField) {
        keys.sort(function (a, b) {
          var va = valOf(a, out[a]), vb = valOf(b, out[b]);
          if (va === vb) return a < b ? -1 : 1;
          if (va === undefined || va === null) return -1;
          if (vb === undefined || vb === null) return 1;
          return va < vb ? -1 : 1;
        });
      }
      if (q.has('equalTo')) {
        var want = JSON.parse(q.get('equalTo'));
        keys = keys.filter(function (k) { return valOf(k, out[k]) === want; });
      }
      if (q.has('startAt')) {
        var from = JSON.parse(q.get('startAt'));
        keys = keys.filter(function (k) { var x = valOf(k, out[k]); return x !== undefined && x !== null && x >= from; });
      }
      if (q.has('endAt')) {
        var to = JSON.parse(q.get('endAt'));
        keys = keys.filter(function (k) { var x = valOf(k, out[k]); return x !== undefined && x !== null && x <= to; });
      }
      if (q.has('limitToLast')) keys = keys.slice(-parseInt(q.get('limitToLast'), 10));
      if (q.has('limitToFirst')) keys = keys.slice(0, parseInt(q.get('limitToFirst'), 10));
      var filtered = {};
      keys.forEach(function (k) { filtered[k] = out[k]; });
      return json(Object.keys(filtered).length ? filtered : null);
    }

    stats.writes++;
    if (method === 'POST') {
      var parent = ensure(data, parts), key = newKey();
      parent[key] = body;
      record('POST', parts.concat([key]), body);
      return json({ name: key });
    }
    if (method === 'PUT') {
      var pp = ensure(data, parts.slice(0, -1));
      pp[parts[parts.length - 1]] = body;
      record('PUT', parts, body);
      return json(pp[parts[parts.length - 1]]);
    }
    if (method === 'PATCH') {
      var pc = ensure(data, parts.slice(0, -1)), pk = parts[parts.length - 1];
      pc[pk] = Object.assign({}, pc[pk] || {}, body || {});
      record('PATCH', parts, body);
      return json(pc[pk]);
    }
    if (method === 'DELETE') {
      var pd = deep(data, parts.slice(0, -1));
      if (pd) delete pd[parts[parts.length - 1]];
      else if (parts.length === 1) data[parts[0]] = null;
      record('DELETE', parts, null);
      return json(null);
    }
    return json(null, 405);
  }

  /* ── تثبيت المعترض ─────────────────────────────────────────────── */
  var attached = false;
  function attach() {
    if (attached || !isEnabled()) return false;
    var real = window.fetch ? window.fetch.bind(window) : null;
    loadOps();
    window.fetch = function (input, init) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      if (BACKEND.test(url)) {
        var method = (init && init.method) || (input && input.method) || 'GET';
        var body = init && init.body;
        var r = serve(url, { method: method, body: body });
        if (r) return Promise.resolve(r);
      }
      return real ? real(input, init) : Promise.reject(new TypeError('Failed to fetch'));
    };
    attached = true;
    return true;
  }

  /* ── شريط الوضع (ظاهر دائمًا أثناء العرض، ومخفي في الطباعة) ───── */
  function renderBar() {
    if (!isEnabled() || typeof document === 'undefined') return;
    if (document.getElementById('farm-demo-bar')) return;
    function ready(fn) {
      if (document.body) fn();
      else document.addEventListener('DOMContentLoaded', fn);
    }
    ready(function () {
      var bar = document.createElement('div');
      bar.id = 'farm-demo-bar';
      bar.className = 'demo-bar';
      bar.setAttribute('dir', 'rtl');
      bar.setAttribute('role', 'status');
      bar.innerHTML =
        '<span class="demo-bar__dot" aria-hidden="true"></span>' +
        '<span class="demo-bar__text">وضع العرض — بيانات تجريبية على هذا الجهاز فقط، لا تُحفظ في قاعدة البيانات</span>' +
        '<label class="demo-bar__label" for="farm-demo-size">الحجم</label>' +
        '<select class="demo-bar__select" id="farm-demo-size">' +
        Object.keys(SIZES).map(function (k) {
          return '<option value="' + k + '"' + (k === size() ? ' selected' : '') + '>' + SIZES[k].label + '</option>';
        }).join('') +
        '</select>' +
        '<button type="button" class="demo-bar__btn" id="farm-demo-regen">توليد جديد</button>' +
        '<button type="button" class="demo-bar__btn demo-bar__btn--exit" id="farm-demo-exit">إنهاء العرض</button>';
      (document.body || document.documentElement).appendChild(bar);
      if (document.body) document.body.classList.add('demo-mode');   // ui.css §16: padding-bottom
      var sel = document.getElementById('farm-demo-size');
      if (sel) sel.addEventListener('change', function () { setSize(sel.value); });
      var rg = document.getElementById('farm-demo-regen');
      if (rg) rg.addEventListener('click', function () { regenerate(); });
      var ex = document.getElementById('farm-demo-exit');
      if (ex) ex.addEventListener('click', function () { exit(); });
    });
  }

  /* ── الواجهة العامة ─────────────────────────────────────────────── */
  function enable(sz) {
    lsSet(FLAG, '1');
    if (sz && SIZES[sz]) lsSet(SIZE_KEY, sz);
    else if (!ls(SIZE_KEY)) lsSet(SIZE_KEY, 'medium');
    return true;
  }
  function setSize(sz) {
    if (!SIZES[sz]) return false;
    lsSet(SIZE_KEY, sz);
    reset();                                  // حجم جديد = قاعدة جديدة
    reload();
    return true;
  }
  function regenerate() {
    lsSet(SEED_KEY, String(seedOffset() + 1));
    reset();
    reload();
  }
  function reset() {
    ops = []; data = {}; _herd = null; _counter = 0;
    reseed();      // without this a second generation in the same page drifts
    lsDel(OPS_KEY);
    try {
      Object.keys(sessionStorage).filter(function (k) { return k.indexOf('_fbc_') === 0; })
        .forEach(function (k) { sessionStorage.removeItem(k); });
    } catch (e) {}
  }
  function disable() {
    lsDel(FLAG); lsDel(SIZE_KEY); lsDel(SEED_KEY); lsDel(OPS_KEY);
    reset();
  }
  function exit() {
    disable();
    lsDel(USER_KEY);
    location.href = 'login.html';
  }
  function reload() {
    try { fbCacheInvalidate(); } catch (e) {}
    location.reload();
  }
  /* الدخول التجريبي من شاشة الدخول: لا رمز حقيقي ولا خزنة ولا شبكة. */
  function enter(userId) {
    enable(ls(SIZE_KEY) || 'medium');
    reset();
    attach();
    lsSet(USER_KEY, JSON.stringify(demoUser(userId)));
    location.href = 'dashboard.html';
  }

  /* ما يحدث عند تحميل صفحة: قاعدة جديدة مولّدة من البذرة + إعادة طبقة
     العمليات المحفوظة. مكشوفة لأن jsdom لا يستطيع التنقّل فعلًا، فالاختبار
     يحاكي الانتقال بين الصفحات بها (نفس مسار الكود، لا مسار بديل). */
  function reloadStore() { data = {}; _herd = null; _counter = 0; loadOps(); }

  var FarmDemo = {
    isEnabled: isEnabled, enable: enable, disable: disable, exit: exit, enter: enter,
    reloadStore: reloadStore,
    size: size, setSize: setSize, regenerate: regenerate, reset: reset,
    sizes: SIZES, users: DEMO_USERS, demoUser: demoUser,
    stats: function () { return { reads: stats.reads, writes: stats.writes, blocked: stats.blocked, size: size(), ops: ops.length }; },
    /* للاختبارات: قراءة مجموعة من المخزن مباشرة (بلا fetch). */
    collection: function (name) { ensureGen(name); var v = data[name]; return v ? Object.keys(v).map(function (k) { return Object.assign({ _id: k }, v[k]); }) : []; },
    generators: GEN,
    attach: attach, renderBar: renderBar
  };
  window.FarmDemo = FarmDemo;

  reseed();
  if (isEnabled()) { attach(); renderBar(); }
})();
