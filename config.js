// ╔═══════════════════════════════════════════════════╗
// ║      إعدادات المزرعة — عدّل هنا فقط             ║
// ║  1. أنشئ مشروع على console.firebase.google.com   ║
// ║  2. فعّل Realtime Database وانسخ الـ URL         ║
// ║  3. ارفع الملفات — كل الأجهزة تعمل تلقائياً     ║
// ╚═══════════════════════════════════════════════════╝

const FARM_CONFIG = {
  // Firebase Realtime Database URL
  // مثال: 'https://my-farm-12345-default-rtdb.firebaseio.com'
  firebaseUrl: '',

  // Firebase Database Secret (اختياري — للأمان)
  // console.firebase.google.com → Project Settings → Service Accounts → Database Secrets
  firebaseSecret: '',

  // معلومات المزرعة
  farmName:  'بيان المزرعة',
  ownerName: 'مدير المزرعة',
  currency:  'ج.م',

  // إعدادات
  goatBreeds:           ['شامي', 'بور', 'بلدي'],
  sheepBreeds:          ['برقي', 'دوربر', 'ميت ماستر'],
  pregnancyDays:        150,
  vaccinationAlertDays: 7,
  weaningDays:          60,
};
