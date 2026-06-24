# 🚀 GitHub Actions — بناء APK تلقائي

## الخطوات

### 1. أنشئ Repository على GitHub
```bash
git init
git add .
git commit -m "🐐 بيان المزرعة — Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/bayan-farm.git
git push -u origin main
```

### 2. بعد أول push — GitHub Actions هيشتغل تلقائياً

اتبع: **Actions tab → Build Android APK → Download artifact**

```
GitHub Repository
├── Actions ← هنا بتلاقي الـ runs
│   └── Build Android APK
│       └── bayan-farm-apk (artifact للتنزيل)
└── Releases ← هنا لو عملت tag
```

### 3. تنزيل الـ APK

**من Artifacts (كل push):**
- GitHub → Actions → آخر run → Artifacts → `bayan-farm-apk`

**من Releases (عند إصدار version):**
```bash
git tag v1.0.0
git push origin v1.0.0
```
GitHub هينشئ Release تلقائياً مع الـ APK

---

## إعداد Signed APK (للنشر على Google Play)

### أنشئ Keystore
```bash
keytool -genkey -v \
  -keystore bayan-farm.keystore \
  -alias bayan-farm \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -storepass YOUR_STORE_PASS \
  -keypass YOUR_KEY_PASS \
  -dname "CN=Bayan Farm, OU=Farm, O=Bayan, C=EG"
```

### أضف Secrets في GitHub
```
GitHub Repository → Settings → Secrets → Actions → New secret:

KEYSTORE_BASE64  = base64 -w 0 bayan-farm.keystore
KEYSTORE_PASSWORD = YOUR_STORE_PASS
KEY_ALIAS        = bayan-farm
KEY_PASSWORD     = YOUR_KEY_PASS
```

### تحويل Keystore لـ base64
```bash
# Linux/Mac:
base64 -w 0 bayan-farm.keystore

# Windows:
certutil -encode bayan-farm.keystore keystore_b64.txt
```

---

## Build Time المتوقع
- أول build: ~8-12 دقيقة (تنزيل Android SDK)
- بعد كده: ~4-6 دقائق (cached dependencies)
