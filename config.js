// ╔═══════════════════════════════════════════════════╗
// ║      إعدادات المزرعة — عدّل هنا فقط             ║
// ║  1. أنشئ مشروع Firebase                          ║
// ║  2. فعّل Realtime Database                       ║
// ║  3. انسخ بيانات الـ Config هنا                   ║
// ╚═══════════════════════════════════════════════════╝

const FARM_CONFIG = {
  // Firebase Config
  apiKey: "AIzaSyB22XrjduHzusLuNdBtLLvmdIEokFsnyfQ",
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
};