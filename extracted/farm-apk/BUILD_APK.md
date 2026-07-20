# 📱 بناء APK — نظام بيان المزرعة

## المتطلبات
- Android Studio (أحدث إصدار) — تنزيل: https://developer.android.com/studio
- JDK 17 أو أحدث
- Node.js 18+

## خطوات البناء

### الخطوة 1: تثبيت الـ Dependencies
```bash
cd farm-apk
npm install
```

### الخطوة 2: فتح المشروع في Android Studio
```bash
npx cap open android
```
أو افتح مجلد `android/` مباشرة من Android Studio

### الخطوة 3: بناء الـ APK
**من Android Studio:**
- Build → Build Bundle(s) / APK(s) → Build APK(s)
- الـ APK هتكون في: `android/app/build/outputs/apk/debug/`

**أو من الـ Terminal:**
```bash
cd android
./gradlew assembleDebug
```

### الخطوة 4: تثبيت على الجهاز
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## إعداد للنشر على Google Play (Release APK)

### إنشاء Keystore
```bash
keytool -genkey -v -keystore bayan-farm.keystore \
  -alias bayan-farm \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

### بناء Release
```bash
cd android
./gradlew assembleRelease
```

### توقيع الـ APK
```bash
jarsigner -verbose \
  -keystore bayan-farm.keystore \
  -storepass YOUR_STORE_PASS \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  bayan-farm

zipalign -v 4 \
  android/app/build/outputs/apk/release/app-release-unsigned.apk \
  bayan-farm-v1.0.apk
```

---

## هيكل المشروع
```
farm-apk/
├── www/                    ← كود الويب (HTML/JS/CSS)
├── android/                ← مشروع Android
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/bayan/farm/MainActivity.java
│   │   │   ├── res/
│   │   │   └── AndroidManifest.xml
│   │   └── build.gradle
│   └── build.gradle
├── capacitor.config.json   ← إعدادات Capacitor
└── package.json
```
