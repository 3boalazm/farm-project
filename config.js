// ╔═══════════════════════════════════════════════════╗
// ║      إعدادات المزرعة — عدّل هنا فقط             ║
// ║  1. أنشئ مشروع Firebase                          ║
// ║  2. فعّل Realtime Database                       ║
// ║  3. انسخ بيانات الـ Config هنا                   ║
// ╚═══════════════════════════════════════════════════╝

const FARM_CONFIG = {
  // Firebase Config
  apiKey: "AIzaSyB22XrjduHzusLuNdBtlLvmdIEokFsnyfQ",
  authDomain: "farm-mz99.firebaseapp.com",
  databaseURL: "https://farm-mz99-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "farm-mz99",
  storageBucket: "farm-mz99.firebasestorage.app",
  messagingSenderId: "270083358979",
  appId: "1:270083358979:web:99fad8832b9883c6636936",
  measurementId: "G-CR0WTLFJZD",

  // معلومات المزرعة
  farmName: 'بيان المزرعة',
  ownerName: 'مدير المزرعة',
  currency: 'ج.م',

  // إعدادات الحيوانات
  goatBreeds: ['شامي', 'بور', 'بلدي'],
  sheepBreeds: ['برقي', 'دوربر', 'ميت ماستر'],

  // إعدادات النظام
  pregnancyDays: 150,
  vaccinationAlertDays: 7,
  weaningDays: 60,

  // ── Life Stage thresholds (in months) ──────────────────
  // Purely for computing an animal's current biological life stage from
  // its birth_date -- see getLifeStage() in shared.js. Independent of
  // production purpose (the existing tarbiya/tasmeen `purpose` field),
  // which stays manual and is never touched by age.
  // Thresholds must increase in sequence (newborn < weaning < adult) to
  // match the requested progression: Newborn -> Weaned -> Growing -> Adult.
  lifecycle: {
    newborn_months: 2,   // below this -> "newborn" (still nursing).
                         // Derived from the existing weaningDays (60 days
                         // = ~2 months): that setting represents when
                         // nursing/weaning happens, which is the END of
                         // the newborn phase, not a separate later stage.
    weaning_months: 3,   // below this -> "weaned" (just past nursing, still young)
    adult_months: 12     // below this -> "growing"; at/above -> "adult"
  },

  // مفتاح API للطقس (weatherapi.com / openweathermap.org)
  // نقطة الحقن الوحيدة لهذا المفتاح — عدّل هنا فقط عند التدوير في الإنتاج
  weatherApiKey: '2b08987a3d184056b13210204261205',

  // O-09 CLOSED (as a switch, not a silent flip). sw.js has always been
  // complete and correct, and sw-register.js has always existed — but no page
  // loaded the registrar, so the entire offline/PWA layer was dormant in
  // production. Every page now loads sw-register.js, and registration is
  // gated on this flag: flipping it to true activates the service worker on
  // the next page load, with no code change and no deploy of anything else.
  //   Default false, deliberately: turning on a cache layer for a live farm
  //   app is an operational decision (a stale app shell needs the recovery
  //   tools in settings.html → "التطبيق والعمل دون اتصال"), and it should be
  //   flipped by the person who owns the deployment, not by a refactor.
  //   The stale-cache recovery tools are wired and tested either way.
  enableServiceWorker: false,
};