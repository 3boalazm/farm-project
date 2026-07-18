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

  // مفتاح API للطقس (weatherapi.com / openweathermap.org)
  // نقطة الحقن الوحيدة لهذا المفتاح — عدّل هنا فقط عند التدوير في الإنتاج
  weatherApiKey: '2b08987a3d184056b13210204261205',
};