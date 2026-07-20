# 🔒 Firebase Rules — نسخة محدّثة

## الوضع الحالي
التطبيق يستخدم **PIN Login مخصص** (مش Firebase Authentication)
لذلك لا يمكن استخدام `auth.uid` في الـ Rules.

## الحماية المطبّقة

### ما هو محمي:
✅ **Data Validation** — كل collection عنده `.validate` يمنع إدخال بيانات غلط
✅ **Type checking** — species: goat/sheep فقط، type: income/expense فقط
✅ **Required fields** — مش ممكن تضيف حيوان بدون breed/gender/species
✅ **$other: false** — أي collection مش في الـ rules متاح

### ما لا يزال مطلوب للـ Level التالي:
لو عايز حماية أقوى — الحل هو نقل التطبيق لـ Firebase Auth (email/password)
ده هيخلينا نستخدم `auth.uid` في الـ rules.

## كيف تنشر الـ Rules

Firebase Console → farm-mz99 → Realtime Database → Rules → انسخ الملف → Publish
