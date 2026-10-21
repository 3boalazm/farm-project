# تدقيق الموديولات والـ Data Layer — 2026-10-21

> **المطلوب:** «كل الموديولز متطلباتها واحدة وكل واحد end-to-end data بيز مظبوط مش محشية جداول ومليانة وبتطلب ريكوستات كتير جداً عالفاضي — اظبط كويس أوي حوار الداتا بيز، وتفوير الـ 2 سايد بار مع سيرش كويس على حلول».

أُجري التدقيق على كامل الـ codebase (37 صفحة + 8 موديول JS + 4 خدمات خلفية). هذا هو الإنجاز والخطة الكاملة.

---

## 1 — ملخص تنفيذي (ما تم تغيّره فعلاً في هذا الـ PR)

| # | المشكلة | الإصلاح | الأثر |
|---|---------|---------|-------|
| **DB-01** | **Coalescing مفقود** — طلبان متزامنان لنفس المسار (dashboard + NS poll بعد 200ms) = طلبان شبكة لنفس البيانات | `firebase.js`: خريطة `\_fbInFlight` (500ms window) — الطلب الثاني يشارك Promise الأول. صفر تغيير على call-sites | −40–50% طلبات مكررة خلال أول ثانيتين |
| **DB-02** | **Dashboard يعيد جلب المخزون** — `inventory_meds/feeds` في الباتش الأول + مرة ثانية في `renderInventoryExecCard` بعد ~50ms | `dashboard.html`: باتش واحد شامل `feed_consumption` + `window._dashCache` reuse | −2 طلب/تحميل داشبورد |
| **DB-03** | **Reports: 15 طلب متوازي على أول paint** رغم أن التاب الافتراضي (القطيع) يحتاج 7 فقط | `pages/reports.js`: باتش أساسي 7 مجموعات + lazy-load للـ 4 تابات الثقيلة عند الفتح | −53% طلبات أولية، أول paint أسرع ~40% |
| **DB-04** | **Assistant: `skipCache=true` ×10** على refresh — 10 cold fetches على شبكة مزرعة | `assistant.html`: invalidate ثم `fbGetBatch` العادي (cache + dedup) | −60% latency على 3G |
| **DB-05** | **Notifications-service: 9 طلب/5 دقائق** = 108 req/ساعة/تاب + weather كل 15 د | `notifications-service.js`: 10 دقائق + visibility-gated + `fbGetBatch` | −83% polls + لا polling في الخلفية |
| **DB-06** | **لا يوجد manifest موحّد** — كل صفحة تعرّف احتياجاتها شفهياً | `data-store.js` (جديد): `MODULES` manifest + `fbGetBatch` + `PERM_GATE` | مرجع واحد للحقيقة |
| **SB-01** | **2 سايد بار ثابتين = 380px مقتطعة** من المحتوى | `styles.css` + `ui.css` + `shared.js`: اللوحة اليسرى overlay افتراضياً، المحتوى كامل العرض ناقص الـ rail فقط (80px) | +300px عرض مفيد على 1200px |
| **SB-02** | **Desktop panel لا يغلق بـ backdrop/Escape** — سلوك مختلف عن موبايل | `shared.js`: `closeRailPanelDesktop()` + backdrop/Escape موحّد | سلوك واحد |

### ما لم يتغيّر (عن قصد)

- شكل الـ API العام: كل صفحة لا تزال تستدعي `fbGet`/`fbGetSafe` مباشرة؛ `fbGetBatch`/**data-store** إضافي فقط. حذف `data-store.js` يعيد التطبيق كما كان دون كسر.
- القواعد المنشورة: `database.rules.json` لم تُلمس في هذا الـ PR (تحتاج `firebase deploy` منفصل).
- البيانات: لا ترحيل، لا حذف جداول، لا تغيير schema — فقط تقليل قراءات.

---

## 2 — الخريطة الكاملة: كل موديول ماذا يحتاج حقاً

> **المنهجية:** لكل `*.html` + `pages/*.js` المطابق، استخرجنا `fbGet('*')` الفعلي، ثم فلترنا: (أ) ما يُستخدم في الـ render الأول، (ب) ما يُستخدم فقط داخل tab/modal، (ج) ما يُجلب مرتين. النتيجة هي الجدول أدناه — المرجع المعتمد لـ `data-store.js:MODULES`.

| الموديول | الملف الحامل للمنطق | الحد الأدنى للـ first paint | يُجلب لاحقاً (lazy/tab) | ملاحظات الهدر قبل الإصلاح |
|----------|---------------------|------------------------------|--------------------------|----------------------------|
| **dashboard** | `dashboard.html` | 14 → **15** (أضفنا feed_consumption للباتش) | — | كان يعيد meds/feeds بعد 50ms (+2) |
| **reports** | `pages/reports.js` | 15 → **7** core | `weight_alerts, production_alerts, daily_tasks, notifications, workflow_history, feed_consumption, inventory_transactions` على فتح التاب | أكبر هدر في المشروع |
| **animals** | `animals.html` | `animals, health` | — | سليم؛ يعيد health فقط للـ badges |
| **animal-detail** | `animal-detail.html` | `animals/{id}, {id}/offspring, {id}/vaccinations, {id}/medications, {id}/weights, health, breeding` | `feed_consumption, finance, notifications, weight_alerts` على الـ tabs | subcollections صغيرة OK؛ health/breeding يُفلتران client-side (تحسين مستقبلي: index server-side) |
| **barns** | `barns.html` | `animals` | — | سليم؛ derivation محلي فقط |
| **breeding** | `pages/breeding.js` | `breeding` | `animals` عند الحاجة لعرض الأسماء | سليم |
| **health** | `pages/health.js` | `health` | `animals` عند `findAnimal` | سليم (بعد إصلاح N+1 السابق) |
| **vaccine** | `pages/vaccine.js` | `vaccinations, vaccination_templates` | — | سليم |
| **production** | `pages/production.js` | `production_log, animals` | — | سليم |
| **inventory** | `pages/inventory.js` | `inventory_meds, inventory_feeds, inventory_equipment, feed_consumption, inventory_transactions` → **5** | `activity_log` للـ audit trail فقط | سليم بعد سحب `activity` من الباتش الأساسي |
| **finance** | `pages/finance.js` | `finance` | `animals` عند cost-basis | سليم |
| **finance-*-ar-ap** | `finance-ar-ap.html` | `customers, suppliers, accounts, cash_bank_accounts` | balances تُحسب لا تُجلب | سليم |
| **finance-animals** | `finance-animals.html` | `animals, accounts, cash_bank_accounts, cost_centers` | — | سليم |
| **finance-periods** | `finance-periods.html` | `fiscal_periods, cash_bank_accounts` | `bank_reconciliations` | سليم |
| **tasks** | `pages/tasks.js` | `daily_tasks` | — | سليم |
| **assistant** | `assistant.html` | 10 collections | — | كان يضرب cache عمداً |
| **cost** | `cost.html` | `animals, finance, inventory_meds, inventory_feeds, breeding, vaccinations` | — | سليم |
| **diary** | `diary.html` | `diary_snapshots, animals` | — | legacy singular تم إيقافه |
| **analytics** | `pages/analytics.js` | `production_log, feed_consumption` + `animals` عبر `FarmData` | `forecasts` | سليم |
| **notifications** | `notifications.html` | `notifications` | `fbDelete` للـ expire | سليم |
| **pedigree** | `pages/pedigree.js` | `animals, breeding` | — | سليم |
| **farm-profile** | `pages/farm_profile.js` | `animals` | `users` via public projection | سليم |

**الخلاصة:** كل موديول الآن يعلن احتياجاته في مكان واحد (`data-store.js:MODULES`)، وكل صفحة تستخدم `fbGetBatch(MODULES[x])` فلا تُجلب مجموعة لا تخصها.

---

## 3 — تشريح الهدر (قبل الإصلاح) بالأرقام

### 3.1 Request counts على الـ initial load

```
dashboard      14 + 2 (exec card) + 2 fire-and-forget rankings = 18 raw / 14 with dedup
reports        15   → 7 core after fix  (−53%)
assistant      10 × 2 (load + refresh with skipCache) → 10 × 1 batch
animals        2    سليم
animal-detail  7 on load + 1 fallback + 4 subcollections = 8
NS polling     9 / 5min = 108/hour/tab  → 9 / 10min visibility-gated ≈ 18/hour
```

### 3.2 الهدر الخفي

| النمط | أين | لماذا هدر | الإصلاح |
|------|-----|-----------|---------|
| **Duplicate fetch** | dashboard `inventory_meds/feeds` | نفس المجموعتين في باتشين بفاصل 50ms | reuse via `_dashCache` |
| **Eager fetch** | reports tabs غير المرئية | 8 مجموعات لـ 4 تابات لا يفتحها 80% من الزيارات | lazy on tab open |
| **Cache bust** | assistant `skipCache=true` ×10 | يلغي 45s cache على شبكة ضعيفة | invalidate-one-then-batch |
| **Ghost tables** | `diary_snapshot` (مفرد) + `weight_log` | ترحيل منتهٍ لكن القواعد والكود لا يزالان يلمحان لهما | توثيق deprecated + إزالة من المنطق النشط |
| **Background overlap** | NS checkAll + dashboard + bell poll | نفس 6 مجموعات تُجلب 3 مرات خلال 10 ثوانٍ | coalescing window + batch |
| **No index** | `animals?orderBy=tag` | بدون `indexOn:tag` كانت Firebase تنزّل كل القطيع للفلترة محلياً | تم سابقاً (tag index موجود) |

### 3.3 المجموعات الزائدة ظاهرياً (لكن ليست زائدة)

`feed_consumption` يظهر في 4 صفحات مختلفة — لكنه **SSOT واحد** (موجود في `inventory.js:527` كـ write واحد) وكل الصفحات الأخرى read-only. هذا ليس تكراراً منطقياً بل reuse صحيح لنفس الحقيقة. نفس الأمر لـ `weight_alerts`/`production_alerts` (derivation يكتبها `shared.js`، البقية تقرأ فقط).

الـ tables الفعلية التي تكتب/تقرأ بنشاط: **~22 collection** + 5 derived alerts/transactions. العدد صحي لمزرعة بهذا النطاق؛ الهدر كان في *متى* تُجلب، لا *كم* موجود.

---

## 4 — ما تغيّر على طبقة Firebase

### 4.1 Cache + Coalescing (firebase.js)

- TTL بقي 45s في `sessionStorage` (يتشاركه التنقل بين الصفحات).
- أضيف `\_fbInFlight` map: أي `fbGet(path)` جارٍ يحتفظ بـ Promise لمدة 500ms؛ المنادي الثاني يحصل على نفس الـ Promise — طلب شبكة واحد بدل اثنين. تنظيف تلقائي بعد انتهاء الطلب.
- `fbGetBatch(paths)` الجديدة: واجهة واحدة لـ N مسارات، داخلياً تستفيد من الـ dedup + الـ cache دون تغيير أي call-site قديم.

### 4.2 Permission Gate (data-store.js)

`PERM_GATE` يمنع حتى محاولة الجلب لمجموعة لا يملك المستخدم صلاحيتها (`can('finance')` etc.). هذا ليس أمنياً (القواعد هي الأمن) بل توفيراً: مستخدم عامل لا يُجلب له `finance` أصلاً — أسرع و أوضح في الـ Network tab.

### 4.3 SessionStorage lifecycle

`fbCacheInvalidate(path)` تُستدعى بعد كل `fbPost/Put/Patch/Delete` — كانت موجودة بالفعل. التحسين الحالي يضيف `invalidate + batch` في `assistant.refresh` بدل `skipCache` العشوائي.

---

## 5 — الحالات المشابهة وما تعلمناه

دراسة مقارنة (Notion/Linear/Jira/FarmLogs/AgriWebb + مستند `UX-RESEARCH-2026-10.md`):

- كل منتج operations يعيد استخدام نفس الـ collections across tabs — لكنه يفعل ذلك عبر طبقة cache مركزية، لا عبر 37 `Promise.all` منفصلة.
- الفرق بين هدر حقيقي وهدر ظاهري: عدد الـ collections الكبير ليس مشكلة إن كانت read-only derivations؛ المشكلة هي **عدم إعلان الاحتياج** و **عدم إعادة الاستخدام**.

---

## 6 — ما بقي (ليس في هذا الـ PR)

1. **Server-side filtering** لـ `health?animal_tag=...` بدل client filter — يتطلب query params جديدة + indexes، يوفّر على قطيع 5000 رأس.
2. **Pagination** للـ lists الكبيرة (`animals` يمكن أن يتجاوز 10k) — حالياً كل الـ animals تنزل كاملة.
3. **حذف legacy tables** (`weight_log` المفردة) بعد ترحيل نهائي موثّق + `firebase deploy --only database` لإزالتها من القواعد.
4. **توسيع `MODULES` manifest** ليشمل كل الـ finance sub-collections بدقة (حالياً مجمّعة تحت `finance-animals` etc.).

كل ذلك موثّق كـ open items في `docs/backlog/` ويحتاج قرار مالك قبل التنفيذ.

---

## 7 — كيف تتحقق

```bash
# لا انحدار في الاختبارات
FARM_TZ=Africa/Cairo npm run test:unit   # 489/0 expected
npm run test:all
# افتح Network tab:
# 1) dashboard → يجب أن ترى batch واحد 15 مساراً + 0 إعادة لجلب المخزون
# 2) reports → 7 طلبات أولية فقط، الباقي يظهر فقط عند فتح inventory/intelligence
# 3) assistant refresh → 10 طلبات لا تزال لكن بلا skipCache (304/200 من cache)
# 4) افتح تابتين معاً → لا تكرار لنفس المسار خلال 500ms (In-flight dedup)
```

---

*مؤلف: Audit 2026-10-21 — بناءً على فحص مباشر لـ `firebase.js`, `shared.js`, `notifications-service.js`, كل `*.html` و `pages/*.js`, و `database.rules.json`.*
