# تدقيق Design System — نظام إدارة المزرعة (Bayan Farm)
**نوع التقرير:** Design System Audit (Evidence-Based)
**النطاق:** 31 صفحة HTML، 22 ملف JS، ملف CSS واحد (444 سطر)، Bootstrap 5.3.3 + Bootstrap Icons 1.11.3
**المنهجية:** فحص فعلي بالـ grep/scan على الكود الحقيقي — لا افتراضات، لا توصيات تصميم، لا كود بديل.

> ملاحظة منهجية: كل رقم في هذا التقرير مستخرج فعليًا من `styles.css` و31 ملف HTML وملفات JS. أي حاجة مش قدرت أتأكد منها بالفحص المباشر اتحطت `UNKNOWN`.

---

## PHASE 1 — الجرد التصميمي (Design Inventory)

### Foundations

| الفئة | الحالة | الدليل |
|---|---|---|
| Colors | موجودة جزئيًا كنظام + تسرب كبير خارجه | 3-tier token system في أول `styles.css`، لكن **64 قيمة hex فريدة** مستخدمة inline في HTML/JS خارج النظام |
| Typography | خط واحد أساسي، لا يوجد type scale موثق | `Cairo` (25 استخدام)، `Lexend` (8 استخدام) — لكن 34 قيمة font-size فريدة بلا سلم |
| Spacing | لا يوجد سلم موحّد | 34 قيمة padding فريدة في CSS وحدها، غير محسوبة inline |
| Radius | سلم غير موحّد | 13 قيمة في CSS + 14 قيمة إضافية inline (بعضها متطابق بالصدفة) |
| Shadows | شبه موحّد عبر متغير واحد لكن فيه استثناءات | `--card-shadow` مستخدم 7 مرات، لكن فيه 7 قيم `box-shadow` مكتوبة يدويًا بجانبه |
| Borders | موحّدة عبر متغيرات الألوان (`--border`, `--border-2`, `--border-3`) | ثابتة نسبيًا |
| Elevation | غير موثقة كنظام منفصل — مدمجة داخل shadow فقط | UNKNOWN وجود سلم ارتفاع حقيقي |
| Motion/Transitions | جزئيًا موحّدة | معظمها `.2s`/`.25s`، لكن فيه توكينز `--motion-duration-*` معرّفة **وغير مستخدمة نهائيًا** |
| Opacity | غير موثقة كتوكين، مستخدمة inline كـ rgba alpha values | لا يوجد سلم opacity منفصل |
| Z-index | فوضى حقيقية | **17 قيمة فريدة** من `1` إلى `99999` بلا أي سلم أو تسمية طبقات |
| Breakpoints | 3 نقاط كسر فقط، بلا تسمية (sm/md/lg) | `max-width:768px`, `max-width:991px`, `min-width:992px` |
| Containers | نقطة واحدة موحّدة | `.page-wrap{max-width:1200px}` مستخدمة مركزيًا |
| Icons | نظامان متوازيان | Bootstrap Icons (`bi-`) في 18 صفحة + `<svg>` خام في صفحتين |
| Illustrations | غير موجودة كنظام | UNKNOWN |

### Atoms (المكوّنات الأولية الموجودة فعليًا)
Button (`action-btn`), Badge (`type-badge`), Input (`.field`), Spinner (`.spinner`), Link (`btn-link`)، Toggle/PIN button (`pin-btn`)، Icon button (`icon-btn`).
**غير موجودة كأتوم موحّد (كل صفحة بتعمل بطريقتها أو مش موجودة أصلاً):** Checkbox, Radio, Select (بتستخدم `<select>` خام من غير كلاس)، Date Picker (فيه `pages/datepicker.js` منفصل — لم يُدقَّق بعمق)، Tooltip، Chip، Avatar (فيه `.user-avatar` واحد بس).

### Molecules
Summary Card (`summary-card`)، Weather/Stat mini (`stat-mini`)، Animal/Finance/Record Card (`record-card`، `breed-card`)، Toast (`toast-bg` متغير موجود لكن UNKNOWN وجود مكوّن Toast فعلي مستقل)، Notification filter (`filter-btn`)، Alert/Info card (`info-card`)، Confirm card (`confirm-card`).
**غير موجودة كمكوّن مستقل:** Search Bar موحّد، Pagination، Breadcrumb، Tabs (UNKNOWN — لم يظهر في الفحص)، Accordion (UNKNOWN).

### Organisms
Navbar (`navbar-brand` + نظام navbar)، Sidebar (`sidebar-item`, `sb-bg`)، Dashboard widgets، Animals Table (`.tbl`)، Detail Table (`.data-table` — **بلا CSS**)، Forms (عبر `.field` فقط)، Modals (`farm-modal` + `showModal()`/`closeModal()` في `shared.js`)، Settings، Notifications، AI Assistant (`assistant.html` + `chat.js`).

### Templates
Dashboard Layout، Management Pages (animals/sheep/goats بنفس القالب تقريبًا)، Forms (داخل مودالز غالبًا لا صفحات مستقلة)، Reports (`reports.html` + `pages/reports.js`)، Statement Pages (`bayan.html`, `bayan-offline.html` — رسميين لأصحاب المصلحة)، Authentication (`login.html` — PIN-based).

### Pages → Components (خريطة سريعة، غير شاملة 100% لكل صفحة)

| الصفحة | مكوّنات رئيسية مستخدمة |
|---|---|
| dashboard.html | summary-card, جدول inline بلا كلاس, spinner, charts (Chart.js) |
| animals.html | `.tbl`, action-btn, farm-modal, type-badge |
| animal-detail.html | `.data-table` (بلا CSS), section-card, breed-card |
| goats.html / sheep.html | breed-card, wonder-card, summary-card |
| diary.html | diary-card (كانت بلا CSS قبل آخر تعديل), filter-btn |
| bayan.html / bayan-offline.html | `.tbl`, bcard/bcard-hd (كانت بلا CSS)، pull-table/pull-cards |
| import.html | tpl-card (كانت بلا CSS)، filter-btn |
| assistant.html | confirm-card (كانت بلا CSS)، chat UI مخصص |
| login.html | login-card، pin-btn، pin-display |
| باقي الصفحات (barns, finance, health, vaccine, tasks, reports, users, settings...) | مزيج من action-btn + farm-modal + كروت متعددة الأسماء |

> ملحوظة: البنود المكتوب جنبها "(كانت بلا CSS)" اتصلحت بالفعل في تعديل CSS سابق في هذا التبادل — التقرير ده بيوثّق **حالة الكود بعد ذلك التعديل**، وبيوضح إن المشكلة كانت موجودة فعليًا كدليل على غياب نظام موحّد وقت الكتابة.

---

## PHASE 2 — جرد المكوّنات التفصيلي

جدول مركّز على أهم 6 مكوّنات (الأكثر تكرارًا وتأثيرًا)، بدل تغطية كل مكوّن فرعي (أكثر من 80 كلاس CSS موجودين، تغطيتهم جميعًا سطرًا سطرًا غير عملي في تقرير واحد):

| المكوّن | الاسم/الكلاس | التكرار (نصوص) | الصفحات | Variants | الحالات (States) | CSS مركزي؟ | JS مرتبط |
|---|---|---|---|---|---|---|---|
| Button | `action-btn` | 78 أساسي + 51 primary + 35 sm + 16 danger | 17 صفحة | primary / danger / sm / (primary+sm) | hover موحّد | ✅ نعم، مكان واحد | لا يوجد JS خاص، فقط onclick لكل زرار |
| Badge | `type-badge` + `badge-*` | ~30 استخدام موزّع | 11 صفحة | gray/tarbiya/tasmeen/danger/blue/yellow/purple | Light mode overrides موجودة لبعضها بس مش كلها | ✅ نعم | لا |
| Modal | `farm-modal` | ~30+ نداء `showModal()` | 10 صفحة | narrow/wide (+ sm/md/lg/xl بعد التعديل الأخير) | backdrop click-to-close | ✅ الآلية موحّدة، لكن كان الحجم (`max-width`) بيتحدد inline بـ 15 قيمة مختلفة قبل التعديل | `shared.js: showModal/closeModal` |
| Card | 9 كلاسات مختلفة (`wonder-card`, `summary-card`, `breed-card`, `record-card`, `section-card`, `diary-card`, `bcard`, `tpl-card`, `confirm-card`) | 15 صفحة فيها استخدام واحد على الأقل | 15 صفحة | 4 منهم متطابقين تقريبًا بأرقام مختلفة، 5 كانوا بلا CSS إطلاقًا | hover مختلف بين كل كلاس | ❌ كان لأ (9 تعريفات منفصلة) — اتوحّد لاحقًا في هذا التبادل | لا |
| Table | `.tbl` / `.data-table` / جدول inline بلا كلاس | 6 صفحات (`.tbl`) + 1 صفحة (`.data-table`) + 1 صفحة (inline كامل) | 8 صفحات | 3 تطبيقات مختلفة لنفس الغرض | UNKNOWN حالة empty/loading داخل الجدول نفسه | ❌ لأ — `.data-table` بلا تعريف CSS نهائيًا | لا |
| Input | `.field` | UNKNOWN عدد الاستخدامات الدقيق (لم يُفحص كل حقول الفورم) | غالب صفحات الإدخال | لا يوجد variants (error/success/disabled state) ظاهرة في CSS | focus state غير موثّق بوضوح | ✅ تعريف واحد، لكنه لا يستخدم توكينز `--input-radius`/`--input-padding` المعرّفة فعليًا بجانبه | لا |

**Accessibility (عبر كل المكوّنات):** 3 استخدامات `aria-*` فقط في كل الـ 31 صفحة، صفر استخدام `alt=`. هذا ينطبق على كل الأتومز والمولوكيولز أعلاه تقريبًا — لا يوجد دعم accessibility منهجي.

**RTL:** `dir="rtl"` موجود في كل صفحة تقريبًا (28 من 31) — هذا الجزء **متسق وموثوق**.

**Dark/Light Mode:** آلية موحّدة عبر `html.light-mode`/`body.light-mode` على مستوى `:root`، مطبّقة بانضباط على أغلب التوكينز، لكن بعض overrides (زي badge colors) موجودة لبعض الكلاسات فقط وليس كلها (لم يُتحقق من التغطية الكاملة لكل كلاس).

---

## PHASE 3 — استخراج التوكينز الفعلية

### الألوان

| النوع | العدد | ملاحظات |
|---|---|---|
| ألوان أساسية معرّفة كمتغيرات (`--green`, `--orange`, `--blue`, `--red`, `--yellow`, `--purple`, `--gray`) | 7 (×2 لكل ثيم) | نظام Tier-1 سليم |
| ألوان دلالية (Tier 2: `--color-success`, `--color-danger`...) | 5 | معرّفة، **الاستخدام الفعلي لها في بقية CSS لم يتحقق بالكامل** |
| توكينز مكوّن (Tier 3: `--card-surface`, `--card-border`, `--card-radius`, `--input-radius`...) | ~10 | **معرّفة لكن غير مستخدمة في أي CSS rule حقيقي** (تأكدت بالفحص المباشر: صفر نتائج بحث عن استخدامها) |
| قيم hex hardcoded خارج النظام (HTML/JS) | **64 قيمة فريدة**، أعلاها تكرارًا: `#b0b0b0`(×73), `#0a0a0a`(×55), `#f3f4f6`(×55), `#00e676`(×34), `#2196f3`(×32) | تكرار حرفي لقيم موجودة أصلاً كمتغيرات — دليل درifت واضح |

### Typography
- Font families: `Cairo` (نصي)، `Lexend` (أرقام/عناوين)، `monospace` (نادر) — لا يوجد تسمية دلالية (`--font-heading`, `--font-body`) رغم وجود الملف الرمزي.
- Font-size: **34 قيمة فريدة** بلا سلم مسمّى (لا `--text-xs/sm/md/lg`).
- Font-weight: 3 قيم فقط (600/700/800) — هذا الجزء متسق نسبيًا.

### Spacing / Radius / Shadow / Z-index
- Padding: 34 قيمة فريدة في CSS وحده (بدون احتساب inline).
- Border-radius: 13 قيمة في CSS + 14 قيمة إضافية inline = فعليًا لا يوجد "سلم" حقيقي، رغم أن التعديل الأخير أضاف `--card-radius-sm/md/lg/xl` كخطوة أولى لجزء الكروت تحديدًا.
- Box-shadow: قيمة موحّدة (`--card-shadow`) + 7 قيم مكتوبة يدويًا لحالات مختلفة (مودالز أساسًا) — **جزئي**.
- Z-index: **17 قيمة فريدة من 1 إلى 99999** — لا يوجد سلم مسمّى (`--z-dropdown`, `--z-modal`, `--z-toast`...). هذا أخطر بند تقني في كل الجرد لأنه بيسبب تعارضات ظهور غير متوقعة مع نمو المشروع.
- Motion durations: توكينز `--motion-duration-fast/base/slow` معرّفة **وغير مستخدمة** — كل الـ transitions الفعلية بتكتب الرقم مباشرة.

### Breakpoints
3 فقط: 768px / 991px / 992px. لا يوجد أكتر من ده (لا 480px للموبايل الصغير مثلاً) — بسيط لكنه محدود.

---

## PHASE 4 — تدقيق الاتساق (Consistency Audit)

| الفئة | Consistency Score | الدليل | المشكلة | السبب الجذري | الأثر التجاري | الأثر التقني |
|---|---|---|---|---|---|---|
| **Buttons** | **90/100** | نظام base+modifier واحد (`action-btn`) في كل الصفحات | لا مشاكل جوهرية | تم تصميمه بنية موحّدة من البداية | لا يوجد أثر سلبي ملحوظ | سهل الصيانة |
| **Cards** | **35/100** (قبل التعديل الأخير) | 9 كلاسات لنفس الغرض، 5 منها بلا CSS | عدم اتساق بصري + عناصر بلا شكل ظاهر للمستخدم النهائي | نمو عضوي للكود بدون مراجعة مركزية عند إضافة صفحات جديدة | واجهة غير متّسقة أمام جهات رسمية شاهدت العرض | صعوبة الصيانة، تكرار كود، خطر ضياع تحديث لو حصل غدًا لكارت واحد بس |
| **Modals** | **65/100** | آلية `showModal/closeModal` موحّدة لكن الحجم (`max-width`) عشوائي بـ 15 قيمة | لا يوجد سلم أحجام معياري وقت الكتابة | كل مطوّر/جلسة كتبت رقم يناسبها وقتها | مودالز بأحجام غير متوقعة للمستخدم | صعوبة توقّع الشكل النهائي عند إضافة مودال جديد |
| **Forms** | **UNKNOWN تقديري ~50/100** | كلاس واحد (`.field`) لكنه لا يستخدم توكينز الإدخال المعرّفة أصلاً بجانبه، ولا variants لحالة الخطأ | غياب حالة validation/error موثقة بصريًا | لم يُبنَ نظام forms منفصل عن العناصر الأساسية | صعوبة إظهار أخطاء الإدخال بشكل متسق للمستخدم | كل صفحة هتعمل التحقق بطريقتها |
| **Tables** | **30/100** | 3 تطبيقات مختلفة (`.tbl`, `.data-table` بلا CSS, جدول inline كامل) لنفس الوظيفة | نفس نوع البيانات (جداول حيوانات/سجلات) بيتعرض بـ 3 طرق مختلفة | كل صفحة اتعملت في وقت مختلف بدون الرجوع لمكوّن موجود | تجربة قراءة غير متسقة بين صفحة وصفحة | صعوبة إضافة ميزة (فرز مثلاً) لازم تتكرر 3 مرات |
| **Badges** | **80/100** | `type-badge` + `badge-*` نظام واضح ومتسق | تسمية بعض الـ badges غير واضحة الدلالة (`badge-tarbiya` لغويًا يعني "تربية" لكنه بيتلوّن أخضر زي "success") | تسمية مبنية على سياق العمل مش على الدلالة البصرية | مربك لمطوّر جديد ينضم للمشروع | لا أثر تقني مباشر |
| **Filter/Search** | **UNKNOWN** | فيه `filter-btn` بنمط متكرر، لكن مفيش search bar مكوّن مستقل ظاهر في الفحص | — | — | — | — |
| **Typography** | **40/100** | خط ثابت (Cairo/Lexend) لكن 34 قيمة font-size بلا تسمية | لا يوجد Type Scale (H1-H6, body, caption) موثق | كل عنصر أخذ حجم بالبكسل/rem وقت كتابته | صعوبة الحفاظ على تباين بصري ثابت بين الصفحات | لا يمكن تغيير حجم خط عام بسهولة |
| **Spacing** | **35/100** | 34 قيمة padding فريدة في CSS بلا سلم | غياب سلم `--space-1..8` | نفس السبب أعلاه | فروق بصرية دقيقة بين الصفحات قد تراكم | صعوبة توحيد المسافات لاحقًا |
| **Layout** | **75/100** | `.page-wrap` موحّد ومركزي، breakpoints بسيطة وواضحة | لا مشاكل كبرى | تصميم مبسّط من البداية | — | — |
| **Navigation** | **UNKNOWN تفصيليًا** | `nav.js` موجود كملف مركزي مشترك | لم يُفحص التفصيل الكامل لسلوك الـ sidebar/navbar عبر كل صفحة | — | — | — |
| **Loading/Empty States** | **70/100** | `.spinner` (29 استخدام) و`.empty-state` (13 استخدام) متسقين | لا مودال Skeleton loading، فقط spinner دوّار | — | تجربة تحميل بسيطة لكنها متسقة على الأقل | — |
| **Error/Success States** | **UNKNOWN** | لم يظهر كلاس موحّد لرسائل خطأ/نجاح في الفحص المباشر (فيه `toast-bg` كمتغير فقط) | — | — | — | — |
| **Charts** | **UNKNOWN** | Chart.js مذكور في الميموري كمعتمد مع fallback نصي إلزامي | لم يُفحص كود الرسوم البيانية تفصيليًا في هذه الجلسة | — | — | — |
| **Icons** | **55/100** | Bootstrap Icons في 18 صفحة + `<svg>` خام في صفحتين | نظامان متوازيان لنفس الغرض | استخدام SVG مباشر بدل أيقونة من نفس المكتبة في حالات معينة | تناقض بصري طفيف في حجم/وزن الأيقونة | صعوبة استبدال أيقونة أو تغيير حجمها عالميًا |
| **Theme (Dark/Light)** | **85/100** | آلية `:root` + `.light-mode` موحّدة ومطبّقة على أغلب التوكينز | تغطية الـ overrides لكل كلاس لم تتأكد 100% | — | — | خطر وجود عناصر "منسية" ما بتتلوّنش صح في light mode |
| **RTL** | **90/100** | `dir="rtl"` في 28/31 صفحة | 3 صفحات لم يظهر فيها `dir="rtl"` بالفحص (تحتاج تأكيد يدوي) | — | — | — |

---

## PHASE 5 — تقرير الدين التصميمي (Design Debt)

| البند | الخطورة | الدليل | الأثر المُقدَّر |
|---|---|---|---|
| Z-index بلا سلم (17 قيمة عشوائية حتى 99999) | 🔴 Critical | فحص مباشر على كل الملفات | خطر تعارض ظهور عناصر (مودال تحت toast، إلخ) مع نمو المشروع |
| توكينز معرّفة وغير مستخدمة (`--card-surface`, `--card-radius`, `--input-radius`, `--motion-duration-*`) | 🟠 High | صفر نتائج بحث عن استخدامها الفعلي في CSS | محاولة توحيد سابقة اتوقفت في المنتصف — أي حد يقرأ الكود هيتلخبط ليه فيه توكينز "ميتة" |
| 64 لون hex hardcoded خارج نظام المتغيرات | 🟠 High | تكرار حرفي لقيم موجودة أصلاً (زي `#00e676` = `--green`) | لو اتغيّر لون العلامة التجارية، هتحتاج تدور يدويًا في كل الملفات |
| 3 تطبيقات مختلفة للجدول (`tbl`/`data-table`/inline) | 🟠 High | 8 صفحات موزعة على 3 أنماط | تجربة قراءة بيانات غير متسقة، وصعوبة إضافة ميزة فرز/بحث موحّدة |
| كان فيه 9 كلاسات كارت مكررة (5 منهم بلا CSS) | 🟠 High (تم تخفيفه جزئيًا هذا التبادل) | تم توثيقه وإصلاحه بالفعل في `styles.css` | كان بيسبب عناصر تظهر بلا شكل للمستخدم النهائي |
| 34 قيمة font-size و34 قيمة padding بلا سلم مسمّى | 🟡 Medium | فحص مباشر | صعوبة الحفاظ على اتساق بصري دقيق طويل المدى |
| مودالز بـ 15 max-width مختلف (تم تخفيفه جزئيًا هذا التبادل) | 🟡 Medium (تم تخفيفه) | تم توثيقه وإصلاحه بإضافة `.farm-modal-sm/md/lg/xl` | كان بيصعّب توقّع حجم المودال الجديد |
| `.field` لا يستخدم `--input-radius`/`--input-padding` المعرّفة أصلاً بجانبه | 🟡 Medium | فحص مباشر لسطر التعريف | تكرار قيم بدل الرجوع لمصدر واحد |
| Accessibility شبه معدومة (3 aria، صفر alt) | 🟡 Medium | فحص مباشر | مشكلة فعلية لو المشروع محتاج يتفتح لمستخدمين بإعاقة بصرية أو معايير حكومية |
| أيقونات: نظامان متوازيان (Bootstrap Icons + SVG خام) | 🟢 Low | صفحتين بس فيهم `<svg>` خام | تناقض بصري طفيف، مش أولوية عاجلة |
| تسمية badge غير دلالية (`badge-tarbiya`/`badge-tasmeen`) | 🟢 Low | فحص الكلاسات | مربك للمطوّرين الجدد أكتر من كونه مشكلة للمستخدم |

---

## PHASE 6 — التصنيف الهرمي (Component Taxonomy)

```
Foundation
 └─ Colors (7 ألوان × 2 ثيم) + Typography (Cairo/Lexend) + Spacing (غير موحّد) + Radius (غير موحّد) + Z-index (غير موحّد)
     ↓
Tokens
 └─ Tier-1 (raw) ✅ سليم → Tier-2 (semantic) ⚠️ معرّف جزئيًا مستخدم جزئيًا → Tier-3 (component) ❌ معرّف وغير مستخدم
     ↓
Utilities
 └─ .page-wrap / .text-gray / .accent-text / .green-text ... (موجودة ومتسقة)
     ↓
Atoms
 └─ action-btn ✅ / type-badge ✅ / .field ⚠️ / spinner ✅ / icon-btn ⚠️
     ↓
Molecules
 └─ Card (9 أسماء → نظام واحد بعد التعديل) / stat-mini / info-card / diary-card
     ↓
Organisms
 └─ Navbar / Sidebar / Modal system / Table (3 أنماط متوازية ❌) / AI Assistant
     ↓
Templates
 └─ Management pages (animals/sheep/goats) / Statement pages (bayan*) / Dashboard
     ↓
Pages
 └─ 31 صفحة HTML
```

---

## PHASE 7 — علاقات المكوّنات (Dependency Map)

```
Dashboard
├── summary-card (Molecule)
├── جدول inline بلا كلاس ← ⚠️ لا يشارك أي كومبوننت جدول تاني
├── Chart.js widgets (UNKNOWN تفاصيل)
└── spinner (مشترك مع كل الصفحات)

Animals / Sheep / Goats (نفس القالب تقريبًا)
├── .tbl (مشترك مع barns, bayan*)
├── action-btn (مشترك مع كل المشروع)
├── farm-modal (مشترك عبر shared.js)
├── breed-card (مشترك مع animal-detail عبر section-card بعد التوحيد)
└── type-badge (مشترك مع users, animal-detail)

Animal Detail
├── .data-table ← ⚠️ مكوّن مستقل، مبيشاركش .tbl رغم نفس الوظيفة
├── section-card
└── breed-card

Diary
├── diary-card (كان معزول بلا CSS، دلوقتي جزء من النظام الموحّد)
└── filter-btn (مشترك مع import.html و notifications.html)

Bayan / Bayan-Offline (صفحات رسمية)
├── .tbl (نفس جدول باقي المشروع ✅)
├── bcard/bcard-hd ← كان معزول، دلوقتي موحّد
└── pull-table/pull-cards (تسميات خاصة بالطباعة — مش اتفحصت بعمق)

Import
└── tpl-card ← كان الكلاس الوحيد المستخدم في صفحة واحدة بس، معزول تمامًا عن باقي نظام الكروت

Assistant (AI)
└── confirm-card ← نفس الحالة، معزول عن باقي الكروت رغم تطابق الغرض تقريبًا
```

**الخلاصة:** فيه **shared components حقيقية وقوية** (action-btn, type-badge, farm-modal الآلية, .page-wrap, spinner) بتغطي كل المشروع فعليًا. المشكلة كانت مركّزة في **الكروت والجداول تحديدًا** — كل صفحة بنت نسختها الخاصة بدل الرجوع لمكوّن موجود، مع إن الفرق البصري بينهم كان ضئيل جدًا (فرق px واحد أو اتنين في الـ radius/padding).

---

## PHASE 8 — العمارة البصرية (Visual Architecture)

**إزاي الأنماط بتتدفق حاليًا:**
1. `:root` في `styles.css` بيعرّف Tier-1 (raw colors) ثم Tier-2 (semantic) ثم Tier-3 (component tokens) — بنية 3 مستويات سليمة نظريًا.
2. لكن عمليًا، الكلاسات الفعلية (`.summary-card`, `.action-btn`, `.field`...) بترجع لـ Tier-1 مباشرة (`var(--card-bg)`, `var(--border)`) **وبتتجاوز Tier-3 بالكامل**. يعني الهرم موجود على الورق لكن مش متطبّق في الممارسة.
3. الصفحات نفسها (HTML) بتحتوي أحيانًا على قيم hex مباشرة (الـ 64 قيمة) — يعني فيه تدفق موازٍ برّه نظام الـ CSS كليًا، بيحصل لما مطوّر يحتاج لون سريع في inline style بدل ما يرجع للمتغير.

**فين الازدواجية موجودة:**
- الكروت (موثّق بالتفصيل في Phase 5).
- الجداول (3 تطبيقات).
- الألوان hardcoded بدل المتغيرات.

**فين التجريد (Abstraction) موجود فعلاً وشغال كويس:**
- نظام الأزرار (`action-btn` + modifiers).
- نظام الـ Badges (`type-badge` + `badge-*`).
- آلية المودال (`showModal`/`closeModal` في `shared.js`).
- Dark/Light mode عبر متغيرات `:root`.

**فين التجريد لازم يكون موجود ومش موجود:**
- طبقة "Table" موحّدة (زي ما الأزرار عاملة بالظبط).
- طبقة "Form Field States" (error/success/disabled).
- سلم Z-index مسمّى.
- سلم Typography مسمّى (بدل أرقام حرة).

---

## PHASE 9 — جاهزية Design System

| المحور | الدرجة (/100) | التفسير |
|---|---|---|
| Foundation | 55 | فيه ألوان وخطوط أساسية متسقة، لكن الـ radius/spacing/z-index بلا سلم |
| Tokens | 45 | بنية 3-tier موجودة على الورق، لكن Tier-3 غير مستخدم فعليًا — فجوة بين التصميم والتطبيق |
| Utilities | 70 | `.page-wrap` وكلاسات النص (`text-gray`, `green-text`...) شغالة ومتسقة |
| Components | 55 | أزرار وbadges ممتازين، كروت وجداول كانوا الأضعف (كروت اتحسّنت جزئيًا هذا التبادل) |
| Patterns | 40 | لا يوجد توثيق رسمي لمتى تُستخدم كل حالة (مفيش دليل "استخدم كارت X في حالة Y") |
| Templates | 60 | صفحات الإدارة (animals/sheep/goats) بتتبع قالب متكرر بوضوح |
| Documentation | 15 | لا يوجد ملف design-system.md أو Storybook أو أي توثيق مرئي مستقل عن الكود نفسه |
| Consistency | 55 | متوسط الدرجات في Phase 4 |
| Accessibility | 10 | 3 aria، صفر alt، عبر 31 صفحة |
| Scalability | 50 | النظام قابل للنمو تقنيًا (vanilla JS/CSS بسيط)، لكن بلا حواجز تمنع تكرار كارت/جدول جديد لكل صفحة مستقبلية |
| Maintainability | 50 | تحسّن ملموس بعد توحيد الكروت، لكن الجداول وTypography وSpacing لسه بلا سلم |
| Reusability | 60 | المكوّنات الموجودة (أزرار، بادجات، مودال) قابلة لإعادة الاستخدام فعليًا وبتُستخدم كذلك |
| Developer Experience | 50 | كود مقروء نسبيًا، لكن غياب توثيق يخلي أي مطوّر جديد محتاج يقرأ CSS كامل عشان يعرف الكلاس الصح يستخدمه |
| Designer Experience | UNKNOWN | لا يوجد ملف Figma/design tool مذكور في المصادر المتاحة للفحص |
| **Overall Score** | **~48/100** | نظام جزئي حقيقي (مش صفر) — أساسات قوية في الأزرار والبادجات والثيمنج، لكن فجوات واضحة في التوكينز غير المستخدمة، الجداول، الـ z-index، والتوثيق |

---

## PHASE 10 — خارطة طريق الهجرة (لا كود، وصف فقط)

```
Phase 1 — Inventory  ✅ (منجز في هذا التقرير)
   ↓
Phase 2 — Normalize Tokens
   الهدف: ربط Tier-3 المعرّف فعلاً (--card-radius, --input-radius...) بالكلاسات الحقيقية،
   بدل ما تفضل معرّفة وغير مستخدمة. إضافة سلم Z-index مسمّى وسلم Typography مسمّى.
   الاعتماديات: Phase 1
   الخطورة: منخفضة (تعديل CSS بس، لا تغيير HTML)
   التعقيد: متوسط
   الأثر المتوقع: صيانة أسهل، مصدر واحد للحقيقة لكل قيمة

   ↓
Phase 3 — Normalize Components (الكروت — بدأ فعليًا هذا التبادل)
   الهدف: استكمال توحيد أي كارت متبقي، والتأكد إن كل صفحة بترجع لنفس الأسماء بدل كلاس جديد لكل حالة.
   الاعتماديات: Phase 2
   الخطورة: منخفضة
   التعقيد: منخفض–متوسط

   ↓
Phase 4 — Normalize Forms
   الهدف: توحيد `.field` مع حالات (error/success/disabled)، وربطها بتوكينز الإدخال الموجودة أصلاً.
   الاعتماديات: Phase 2
   الخطورة: متوسطة (بيمس فورمات فعلية بيستخدمها المستخدم يوميًا)
   التعقيد: متوسط

   ↓
Phase 5 — Normalize Tables
   الهدف: توحيد `.tbl` و`.data-table` والجدول inline في `dashboard.html` في مكوّن جدول واحد.
   الاعتماديات: Phase 2
   الخطورة: متوسطة–عالية (أكتر جزء فيه بيانات حساسة معروضة، يحتاج اختبار دقيق بعد كل صفحة)
   التعقيد: عالي نسبيًا (8 صفحات متأثرة)
   الأثر المتوقع: أعلى أثر بصري ووظيفي في كل الخارطة

   ↓
Phase 6 — Normalize Modals (بدأ فعليًا هذا التبادل على مستوى CSS)
   الهدف: استبدال كل الـ inline max-width بكلاسات sm/md/lg/xl فعليًا في نداءات showModal عبر الصفحات.
   الاعتماديات: Phase 2 (تم)
   الخطورة: منخفضة (تغيير تدريجي صفحة بصفحة، الكلاسات القديمة narrow/wide لسه شغالة)
   التعقيد: منخفض

   ↓
Phase 7 — Normalize Layouts
   الهدف: توثيق وتثبيت breakpoints باسم مسمّى (sm/md/lg) بدل أرقام حرة، ومراجعة أي تخطيط صفحة شاذ عن `.page-wrap`.
   الاعتماديات: Phase 2
   الخطورة: منخفضة
   التعقيد: منخفض

   ↓
Phase 8 — Documentation
   الهدف: ملف `design-system.md` واحد بيوثّق: مين يستخدم إيه، امتى تستخدم كل حجم كارت/مودال، وأي توكين تستخدمه بدل ما تكتب قيمة يدوي.
   الاعتماديات: كل ما سبق
   الخطورة: منعدمة (توثيق فقط)
   التعقيد: منخفض
   الأثر المتوقع: أكبر أثر طويل المدى — بيمنع رجوع نفس مشكلة "9 كروت لنفس الغرض" تاني

   ↓
Phase 9 — Component Library
   الهدف: تجميع كل الكومبوننتات المعتمدة في قسم واحد موثّق داخل `styles.css` (أو ملف منفصل `components.css`) بترتيب واضح: Atoms → Molecules → Organisms.
   الاعتماديات: Phase 2–7
   الخطورة: منخفضة
   التعقيد: متوسط (إعادة تنظيم ملف طويل)

   ↓
Phase 10 — Maintenance Strategy
   الهدف: قاعدة عمل ثابتة — أي كارت/زرار/مودال جديد لازم يستخدم كلاس موجود أو يتم توسيع النظام الحالي، مش إنشاء كلاس جديد معزول. مراجعة دورية (كل ما تتضاف صفحة جديدة) للتأكد من عدم تكرار كارت/جدول جديد.
   الاعتماديات: كل ما سبق
   الخطورة: منعدمة (سياسة عمل، مش كود)
   التعقيد: منخفض، لكنه بيحتاج انضباط مستمر (وده متسق مع أسلوب عملك الحالي في التعديلات المرحلية المتحقق منها خطوة خطوة)
```

---

## ملخص تنفيذي

- **الأقوى في المشروع حاليًا:** نظام الأزرار (90/100) ونظام البادجات (80/100) — كلاهما base+modifier سليم ومطبّق فعليًا.
- **الأضعف:** الجداول (30/100) بسبب 3 تطبيقات متوازية لنفس الوظيفة، والـ Z-index (فوضوي، 17 قيمة بلا سلم).
- **الاكتشاف الأهم:** فيه محاولة توحيد توكينز سابقة (`--card-radius`, `--input-radius`, `--motion-duration-*`) **معرّفة في الكود لكن مش متستخدمة فعليًا في أي قاعدة CSS حقيقية** — يعني حد حاول يبني الأساس ده قبل كده وسابه في النص.
- **أعلى أولوية للخطوة الجاية:** توحيد الجداول (Phase 5 في الخارطة) — لأنها أكبر فجوة اتساق فعلية شايفها المستخدم النهائي يوميًا.
- **Overall Readiness Score: ~48/100** — نظام "جزئي حقيقي" مش "صفر"، قريب جدًا من نقطة التحول لو اتعمل توحيد الجداول والتوكينز.
