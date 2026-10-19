# FULL-AUDIT-2026-10.md — Comprehensive module-by-module audit

**Date:** 2026-10-19/20 · **Scope:** the whole deployed web app (36 HTML pages, `firebase.js`, `shared.js`, `nav.js`, `config.js`, `pages/*.js`, `notifications-service.js`, `offline-sync.js`, `sw.js`/`sw-register.js`, `sync*.js`, `database.rules.json`, `api/*.js`, CI) · **Method:** static reading of every module + a new unit-test layer that boots the **real** application scripts in jsdom against an in-memory Firebase RTDB, one suite per module.

---

## ملخص تنفيذي (Arabic executive summary)

اتعمل أوديت شامل على البرنامج كله، موديول موديول. النتيجة:

- **٢٧ باج حقيقي** اتلقوا واتصلحوا، منهم **٣ حرجين** (أمن/بيانات) و **٦ عاليين**.
- أخطر حاجة: **أي انقطاع شبكة كان بيرجّع باسورد المدير الافتراضي ١٢٣٤** على قاعدة بيانات شغالة، و**صفحة الدخول كانت بتقبل admin/1234 وقت انقطاع الشبكة**.
- تاني أخطر حاجة: **كل الأزرار "للمدير فقط" (٢٠ مكان) كانت مفتوحة لدور المشرف**، و**دور الزائر (للقراءة فقط) كان يقدر يسجّل وزن، ينفّق حيوان، يبيعه، ويسجل مواليد**.
- **٣٦ مكان في الكود كانوا بيحسبوا التاريخ بتوقيت UTC بدل المحلي** → كل الرسوم البيانية الشهرية (المالية/الإنتاج/الصحة/التقارير) كانت بتعرض **بيانات الشهر اللي فات تحت اسم الشهر الحالي**، والشهر الحالي كان بيضيع خالص.
- **زر "تراجع" كان ميت من الأساس** — الدالة `_pushUndo` كانت معرّفة بس **محدش بيناديها في المشروع كله**.
- **الـ CI Quality Gate كان فايل في كل مرة (٨/٨) وبيشغّل صفر تيستات**.
- **ذمم الموردين والعملاء كانت مش مطابقة للأستاذ العام**: أي شراء آجل (علف/حيوانات/معدات) كان بيظهر في الميزانية لكن **مش بيظهر في صفحة العملاء والموردين ولا في تقرير الأعمار**.
- اتبنى **طبقة تيستات جديدة: ٣٦١ تيست على ٢٢ موديول** (`npm run test:unit`) — بتشتغل من غير متصفح، وبتشتغل بتوقيت المزرعة الحقيقي (Africa/Cairo).
- **حالة الـ CI بعد الإصلاح (تشغيل رقم 39336169004 على البرانش ده):** أول مرة البوابة تشتغل فيها أصلًا — الفحص اللغوي ✓، الفحص الأمني ✓، **طبقة التيستات الجديدة ✓ (٣٦١/٣٦١)**، تثبيت المتصفح ✓، و**طبقة تيستات المتصفح ✗** (٤٢٥ تيست عمّالين يشتغلوا لأول مرة في تاريخ المشروع — كانوا قبل كده بيموتوا في مرحلة الجمع). تفاصيل سبب الاحمرار في O-19، وما ادّعيناش إنها اتحلّت.
- ⛔ **بند حرج لسه مفتوح ومحتاج قرار منك — O-18:** `config.js` مربوط بمشروع Firebase **حقيقي** (`farm-mz99`) والريبو **public**، وقواعد البيانات بتدي `.read: "auth != null"` لجدول `users` (و٢٥ جدول تاني) — و`firebase.js` بيعمل جلسة **Anonymous Auth** تلقائيًا لأي زائر، يعني أي حد في العالم يقدر **يحمّل جدول المستخدمين بالكامل** وفيه `pin_hash`. والـ`pin_hash` هو `SHA-256('bayan-farm-pin-salt:' + userId + ':' + pin)` — الـsalt **مكتوب حرفيًا في الريبو العام** والـPIN **٤ أرقام (١٠٠٠٠ احتمال)** → فك كل الباسوردات (بما فيها باسورد المدير) بيتعمل **أوفلاين في أجزاء من الثانية** من غير أي طلب للسيرفر ومن غير ما أي rate limiting يحس بيه. كمان `login.html` لسه بيقبل حقل `pin` **نص صريح** لأي مستخدم لسه ما اترحش. الإصلاح الصحيح مش تعديل في القواعد (لأن `login.html` **لازم** يقرا `users` قبل ما يتحقق — تقفيل القراءة يكسر الدخول على الكل)، دي نقلة معمارية للتحقق عن طريق Firebase Auth + نشر القواعد بـ`firebase deploy` — ودي محتاجة قرار منك ووصول للـConsole. فيه ٥ تخفيفات مؤقتة مترتبة في O-18.

Everything below is evidence-linked: each finding names the file, the mechanism, the fix, and the test that now proves it.

---

## 1. How this audit was executed

| Layer | What it is | Status |
|---|---|---|
| Static reading | Every module read end-to-end; greps for bug *classes* (UTC date keys, unguarded sorts, duplicate object keys, empty-collection bootstraps, `can()` vs role names, unescaped sinks) | done |
| `scripts/safety-scan.js` | The repo's own permission/SSOT/XSS tripwire | **PASS, 0 critical** |
| **NEW** unit layer `tests/unit/` | 22 suites / **361 assertions-passing tests** that boot `config.js → firebase.js → nav.js → shared.js` (+ `notifications-service.js`) inside jsdom, with an in-memory Firebase that implements the real REST contract incl. `orderBy`/`equalTo`/`limitToLast` queries and injectable failure modes (offline, 401, 403, 500) | **361 passed, 0 failed** |
| Playwright browser suites | `tests/smoke`, `tests/ssot`, `tests/permissions`, `tests/data-integrity`, `tests/regression`, `tests/security` | **collection fixed: 425 tests in 55 files** (was: collection crash, 0 tests). Not executed here — this sandbox cannot download browser binaries. |
| `tests/rules/*.test.js` | Emulator-only rules tests | still never executed (needs Java + Firebase CLI) — see O-12 |

Run the unit layer with:

```bash
npm run test:unit            # all 22 modules (~5s, no browser needed)
node tests/unit/run.js 12    # one module
FARM_TZ=UTC npm run test:unit   # the same suite from the other side of the date bug
```

The suite list is the module list: `01` core utilities · `02` auth & permissions · `03` data layer · `04` undo · `05` local-calendar dates · `06` livestock lifecycle · `07` weight SSOT · `08` animal status service · `09` birth SSOT & tags · `10` finance service & KPIs · `11` accounting core · `12` source documents / AR / AP / cash-bank · `13` inventory ledger & costing · `14` fiscal periods, close & integrity · `15` analytics · `16` alerts, tasks & forecasting · `17` notifications · `18` render helpers & XSS · `19` navigation, theme & page bootstrap · `20` genealogy, integrity tools & diary · `21` costing, assets, loans & equity · `22` repository invariants.

---

## 2. Findings fixed in this pass

Severity: **CRITICAL** = security or silent data corruption on a live farm · **HIGH** = a real feature/report provably wrong · **MEDIUM** = wrong in a reachable edge case, or a dead/duplicated implementation · **LOW** = robustness, a11y, markup, hygiene.

### CRITICAL

#### F-01 · A failed read reset the administrator's PIN to the factory `1234`
`firebase.js` — `Users.init()` ran on **every page load** through `initApp()`:

```js
const users = await fbGet('users');
if(!users.length){ await fbPut('users','admin1',{ … pin_hash: await hashPin('1234','admin1') … }); }
```

`fbGet()` swallows every error and returns `[]` (correct for display code). So one dropped request — offline, DNS blip, 5xx, expired token — was indistinguishable from "brand-new farm", and the bootstrap **PUT over `users/admin1`**, replacing the real admin's `pin_hash`, name and creation date with the factory credential. On a database with a real herd and real money.

**Fix:** new additive `fbGetSafe(path)` in `firebase.js` returns `[]` for a genuinely empty node and `null` for a failed read; `fbGet()`'s contract is untouched (≈200 display call sites depend on it). `Users.init()` now aborts on `null`, and the bootstrap write is wrapped so `initApp()` can no longer produce an unhandled rejection on every page (**F-27**).
**Proof:** `tests/unit/02` — "does NOT resurrect a default admin when the read fails" (asserts no `PUT users/admin1` was even attempted while offline), "still bootstraps admin1 on a genuinely empty database", "is idempotent (never overwrites an existing roster)".

#### F-02 · `login.html` accepted `admin / 1234` during a network outage
Same root cause on the login path, and the file's own comment admitted it ("*could still be reached during a network outage — a pre-existing limitation … not redesigned here*"): `attemptLogin()` used `Users.all()` (= `fbGet`), and the first-run fallback is gated on `users.length===0`. During an outage, **anyone** typing role=مدير + PIN 1234 got a full admin session on a live farm.

**Fix:** the login read goes through `fbGetSafe()`; a failed read now stops the attempt and shows `لا يوجد اتصال` on the PIN pad instead of falling through to the bootstrap. The legitimate first-run bootstrap (truly empty database) is unchanged.
**Proof:** `tests/unit/22` asserts `login.html` contains `fbGetSafe(`; `tests/unit/02` covers the helper's three-way contract (data / empty / failure).

#### F-03 · `can('admin')` returned **true** for supervisors — 20 admin-only guards were open
`can(page)` takes a **permission key**, but 20 call sites pass the **role name** `'admin'` to mean "administrators only". `'admin'` is in no role's permission list, so the call fell through to the role predicate — and `ROLE_PERMS.supervisor = p => !['users','finance','activity'].includes(p)` returns **true** for it. Measured effect for a مشرف before the fix:

| Guard | File |
|---|---|
| wipe the whole mortality register (تصفير سجلات النافق) | `dead.html:402` (+ its button, `:61`) |
| bulk reset / bulk delete paths (3 separate guards) | `animals.html:827,1147,1183` (+ buttons `:193,304`) |
| delete a health record | `pages/health.js:167` (+ button `:122`) |
| delete a vaccination | `pages/vaccine.js:132` (+ button `:98`) |
| delete a task | `pages/tasks.js:383` (+ button `:321`) |
| edit the farm profile | `pages/farm_profile.js:20` |
| the birth-page admin block | `births.html:187`, `goats.html:118`, `sheep.html:132` |
| herd-wide genealogy rewrite | `shared.js` `repairGenealogy()` |
| **the audit log itself** — `activity.html:60`, whose own on-screen message says `هذه الصفحة للمدير فقط`, and whose permission `ROLE_PERMS.supervisor` explicitly excludes (`'activity'`) — the page checks `can('admin')`, never `can('activity')`, so the exclusion was bypassed entirely | `activity.html` |

**Fix:** one line in `can()`, ahead of the `custom_perms` branch, so no grant can ever mint an admin:

```js
if(page==='admin')return false;   // (after the u.role==='admin' short-circuit)
```

Twenty holes closed, zero call sites touched, and `custom_perms` still works for every real page permission.
**Proof:** `tests/unit/02` — "can('admin') is an ADMIN-ONLY guard for every non-admin role" (all four roles) and "custom_perms can never mint an admin"; `tests/unit/20` asserts `repairGenealogy()` refuses a supervisor.

### HIGH

#### F-04 · The read-only **visitor** role could write to the herd
`ROLE_PERMS.visitor = ['dash','animals','bayan']` — correctly, so a guest can *look* at the herd. But every mutating animal service authorised itself with that same `can('animals')`, so a زائر could: record and delete weights, mark animals dead, **sell** them (which also posts a real finance income record), quarantine/restore, "correct" counts, rename tags, re-parent offspring, and register births (`_ubSubmit` had no guard at all; `births.html` shows the birth buttons to any `can('animals')` role). Verified live before the fix: `recordAnimalWeight()` returned `{ok:true}` for a visitor.

**Fix:** additive `canWrite(perm)` in `firebase.js` — identical to `can()` for every non-read-only role, and for a read-only role it still honours an explicit per-user `custom_perms` grant (the mechanism `users.html` already persists). Applied to the authoritative write path: `recordAnimalWeight`, `deleteAnimalWeight`, `_writeAnimalStatus` (the shared core of dead/sold/quarantine/restore/correction/purpose), `renameTag`, `linkParents`, plus new guards at the top of `_ubSubmit()` and `pages/breeding.js:submitBirthDirect()`.
Pages still use `can()` for *visibility*, so nothing disappears from anyone's menu.
**Proof:** `tests/unit/07` (visitor refused, **worker still allowed** — the fix must not block real data-entry roles), `08` (all six status operations refused for a visitor, nothing written), `09` (`_ubSubmit` writes no breeding record and no animals for a visitor).

#### F-05 · ~36 sites derived **local** calendar keys from `toISOString()` (UTC)
Every record in this app stores plain local strings (`YYYY-MM-DD`, written by `todayStr()` and native `<input type=date>`), but trend code built its bucket keys in UTC. For a farm at UTC+3 the consequences are not theoretical:

* `new Date(y, m, 1).toISOString().slice(0,7)` is local midnight = 21:00 UTC on the **last day of the previous month** → the key is the *previous* month, **always**. `dashboard.html`'s Revenue-vs-Expense chart, `pages/finance.js`, `pages/health.js`, `pages/production.js` (3 sites), `pages/reports.js` `buildMonthlyFin`/`buildMonthlyBreeding` all plotted the previous month's numbers under the current month's label — and the current month's own records matched **no bucket at all**, so they vanished from the report.
* `new Date().toISOString().slice(0,10)` is *yesterday* for any local time before 03:00 → the dashboard's 14-day production trend (label local, data UTC), `pages/inventory.js`'s 7-day consumption window, `notifications-service.js`'s expiry cutoff, `_autoTaskDaysFromToday()`'s due dates, and `loadNotifDropdown`/`openNotificationsPopup`'s "today" comparisons were all off by a day overnight.
* Date arithmetic (`setDate(+n)` then `.toISOString()`) moved **pregnancy due dates, drug withdrawal windows and vaccination schedules** by a day: `assistant.html`, `pages/breeding.js`, `animal-detail.html` (×2), `pages/health.js` (×2), `pages/vaccine.js`, `shared.js`'s breeding-window prediction.

**Fix:** five local-calendar helpers in `firebase.js` (loaded before every other script, so available to pages too) — `toLocalDateStr()`, `toLocalMonthKey()`, `shiftDateLocal()`, `monthStartLocal()`, `monthEndLocal()` — and 36 call sites converted across 15 files. `shared.js`'s `_dayAfter()` was deliberately left alone: it parses with an explicit `T00:00:00Z` and steps with `setUTCDate`, which is correct.
**Proof:** `tests/unit/05` (15 tests) runs the whole suite in `TZ=Africa/Cairo` (set in `tests/unit/run.js`), asserts the helpers round-trip every day of every month, and includes an end-to-end check that a record dated today now lands in the current month's bucket while the old UTC key matched nothing. `tests/unit/22` statically bans the pattern repo-wide so it cannot come back.

#### F-06 · The Undo feature was dead code — `_pushUndo()` was never called from anywhere
`firebase.js` defines a 5-deep undo stack, `undoLast()` implements all three reversal paths, and the rail panel renders a `تراجع` button wired to it on **every page**. `_pushUndo()` — the only way anything enters that stack — had **zero call sites in the entire repository** (root and the `farm-apk/www` copy alike). The button always rendered at 40 % opacity and every click answered `لا توجد عمليات للتراجع عنها`. Worse, `fbDelete()` performed an extra `GET` on every delete purely to capture the record "for undo" and then threw the result away.

**Fix:** capture wired into `fbPost` (new key), `fbPatch` (pre-image of *exactly* the patched keys, so undo restores them and removes keys that did not exist before) and `fbDelete` (the record it already fetched). Capture is **filtered**, because an unfiltered stack would be worse than none: background engines write through the same functions, and a machine write landing on top of the 5-deep stack would silently replace what the user meant to undo. Excluded: `activity_log`, `notifications`, `login_notifications`, `weight_alerts`, `production_alerts`, `workflow_history`, `inventory_transactions`, `financial_audit_log`, `diary_snapshots`, `uid_lookup`, plus any record carrying `auto_generated` or `synced_at`. `journal_entries` and `source_documents` are excluded on principle — the accounting engine is immutable by design and by `database.rules.json`; corrections there go through `reverseJournalEntry()`. Also fixed `_updateUndoBtn()`, which retried every 500 ms **forever** on any page without the button.
**Proof:** `tests/unit/04` (11 tests): create→undo deletes, patch→undo restores exactly (and nulls a newly-added key), delete→undo restores under the same id, cap at 5, machine collections excluded, accounting records excluded, auto-tasks excluded but human tasks not, offline replays excluded, button state + bounded retries.

#### F-07 · The AR/AP sub-ledger disagreed with the general ledger
`_isOpenReceivable`/`_isOpenPayable` selected documents **by type** (`sales_invoice` / `purchase_invoice`). But four other document types post against the same AR/AP accounts whenever they are settled on credit:

| Document | Posting | Function |
|---|---|---|
| `animal_purchase` | Credit AP 2100 | `postAnimalPurchase(…paymentMode:'credit')` |
| `inventory_purchase` | Credit AP 2100 | `postInventoryPurchase(…)` |
| `asset_purchase` | Credit AP 2100 | `postAssetPurchase(…)` |
| `animal_sale` | Debit AR 1300 | `postAnimalSale(…paymentMode:'credit')` |

So feed, livestock and equipment bought on credit — the ordinary case on a real farm — created a liability that the trial balance and balance sheet carried, while `getSupplierBalance()`, `getSupplierStatement()`, `getAPAging()` (and the AR mirrors, i.e. `finance-ar-ap.html`) reported **zero**. The two books contradicted each other and the sub-ledger was the wrong one.

**Fix:** selection is now **evidence-based**: `_entryIdsTouching(accountId, side)` finds the journal entries that really debited AR / credited AP, and `_receivableDocs()/_payableDocs()/_openReceivableDocs()/_openPayableDocs()` select on that (OR'd with the legacy type check, so an unposted legacy invoice is still listed). Self-maintaining: a future credit document type is picked up automatically, and things that must **not** appear (a cash purchase, a loan against 2300, a payroll accrual against 2210) stay out. `refreshOverdueInvoiceStatuses()` now sweeps the same scope.
**Proof:** `tests/unit/12` — three regression tests: a credit livestock purchase shows in the supplier balance *and* the AP aging *and* agrees with the AP row of the trial balance; a credit animal sale shows as a receivable; a cash purchase creates no payable; a payroll accrual never leaks into trade AP.

#### F-08 · The CI Quality Gate was red on every run and executed **zero** tests
`gh run list` on `main`: **8 / 8 recent Quality Gate runs = `failure`** (going back to 2026-08-23). Cause, reproduced locally: Playwright's default `testMatch` includes `**/*.test.js`, which collected `tests/rules/accounting-rules.test.js` — a Node script for the Firebase **RTDB emulator** whose `@firebase/rules-unit-testing` dependency is not in `package.json` and is not installed by the workflow. Collection died with `Cannot find module '@firebase/rules-unit-testing'` and reported `Total: 0 tests in 0 files`, so the gate failed having proven nothing — while the file's own header already says it must be run via `firebase emulators:exec`, never through Playwright.

**Fix:** `playwright.config.js` gains `testIgnore: ['**/rules/**','**/unit/**']`; the workflow drops the hand-rolled `python3 -m http.server &` + `npx wait-on` pair (the config's own `webServer` block already does both, and `wait-on` was being fetched on the fly), and gains the unit layer **before** the browser layer (4 s, no browser download).
**Proof:** `npx playwright test --list` → **425 tests in 55 files** (was 0); `npm run test:unit` → 361/361; `tests/unit/22` asserts both the npm script and the CI wiring exist.

**CI evidence — run [39336169004](https://github.com/3boalazm/farm-project/actions/runs/39336169004) on this branch:** `Set up Node ✓ · Install test dependencies ✓ · Syntax check (all JS) ✓ · Static safety scan ✓ · **Unit layer ✓ (360 passed / 0 failed)** · Install Playwright browser ✓ · Run browser regression suite ✗`. That is the first Quality Gate run in the repository's recent history to execute *anything*: before this fix every run died during collection. The browser layer is now visibly red for the first time — 425 tests that have never run in CI, and whose per-test output could not be retrieved from the audit sandbox (`results-receiver.actions.githubusercontent.com` is unreachable there) nor from an artifact, because the report folder the workflow uploads was never written (O-20, fixed here). Why the suite is not hermetic: O-19. Closing the browser layer is its own piece of work and is deliberately **not** claimed as done by this pass.

#### F-09 · A birth weight broke the certified Weight-SSOT invariant
`createOffspringAnimal()` posted `animals/{newId}/weights/{…}` directly and never touched `current_weight` — so every newborn registered with a birth weight had a weight history and a **blank** `current_weight`, violating the exact invariant `docs/certification/WEIGHT.md` exists for (`current_weight == newest weight record`) and showing `—` on the dashboard, reports and detail page for an animal that demonstrably has a weight. It also wrote `p.weight` with **no validation**, so a mistyped `-5` or `9999` landed in the SSOT even though `recordAnimalWeight()` rejects both.

**Fix:** validate against the same `0 < w ≤ 500` bounds, then recalculate through `_resyncCurrentWeight()` — the one canonical place that invariant is maintained.
**Proof:** `tests/unit/09` — "keeps the weight invariant" (`current_weight === 3.5`, `weight_updated === today`) and "refuses an impossible birth weight instead of poisoning the weight SSOT" (for `-3`, `0`, `9999`: no `birth_weight`, no history row, no `current_weight`).

### MEDIUM

#### F-10 · Unbounded birth quantity: `-5` wrote a corrupt breeding record, `50000` started a 50 000-write loop
`_ubSubmit()` and `pages/breeding.js:submitBirthDirect()` read `parseInt(qty)||1` / `+qty||1`. The field's `min="1" max="10"` is advisory only — there is no `<form>` submission, so nothing enforced it. A typed `-5` wrote `offspring_count:-5` and `male_offspring:-5` (the animals loop never ran) and then toasted `✅ تم تسجيل الولادة و-٥ مولود`; a typed `50000` began an unbounded write loop against Firebase.
**Fix:** both paths validate 1..10 and report `عدد المواليد يجب أن يكون بين ١ و ١٠` **before** closing the modal or writing anything. (`submitBirthDirect` also gained the `canWrite('animals')` guard from F-04; it remains the deliberately-deferred fourth birth implementation per `docs/certification/BIRTH.md` — these guards are additive and change nothing about the record it writes.)
**Proof:** `tests/unit/09` — `0`, `-5`, `11`, `50000`, `abc` each write **no** breeding record and **no** animals and produce a user-visible error; `qty=3` still yields exactly 1 breeding record + 3 offspring with distinct tags.

#### F-11 · Credit documents silently lost their `dueDate`
`postAnimalPurchase`, `postAnimalSale`, `postAssetPurchase` and `postLaborAccrual` accepted `opts.dueDate` from their callers but never forwarded it to `createSourceDocument()` — unlike `postInventoryPurchase`, `createSalesInvoice` and `createPurchaseBill`, which all do. A credit document with no `dueDate` can never be flagged `OVERDUE` and sits in the aging report's `noDueDate` bucket forever, so money owed on livestock and equipment aged with no due date and no alert.
**Fix:** forward `dueDate` (credit mode only, matching `postInventoryPurchase`'s existing shape); the payroll accrual forwards it unconditionally.
**Proof:** `tests/unit/12` — "a credit-mode document carries its dueDate, so it can actually go overdue": the document holds `2026-02-01`, aging puts 50 000 in `d1_30` and **0** in `noDueDate`, and the overdue sweep flags it.

#### F-12 · `renameTag()` orphaned every child's cached parent tag
`mother_tag`/`father_tag` are documented in `shared.js` itself as a **cached projection** of the canonical `mother_id`/`father_id`, and eleven call sites display parents by tag. Renaming an animal updated only that animal, so every recorded offspring kept pointing at a tag that no longer existed: the pedigree showed a phantom mother, `repairGenealogy()` could no longer resolve those children (their old `mother_tag` matched nothing → "unresolved"), and a **new** animal could then be given the freed tag — silently re-parenting the old offspring in every tag-based view.
**Fix:** after a successful rename, propagate to every animal whose `mother_tag`/`father_tag` equals the old tag (and refresh `mother_breed`), best-effort per child, logged as its own activity entry, and reported back as `{propagated, propagateFailed}`. The canonical IDs are never touched.
**Proof:** `tests/unit/20` — two children updated, an unrelated child untouched, `mother_id` unchanged, and `father_tag` propagated by a father rename.

#### F-13 · `notifications-service.js` defined `checkWeather()` **twice** — the richer one was dead code
Two `async checkWeather(){…}` keys in the same `NS` object literal (lines 48 and 333). In JavaScript the last duplicate key wins and the earlier one is discarded at parse time, so a 33-line implementation **never ran, in any browser, on any page**. Silently unreachable: the once-per-day throttle (`localStorage['_lastWeatherAlert']`), the 40/35/5/12 °C severity bands, the `humidity>85` respiratory warning, and the "الطقس مناسب" all-clear. The implementation that actually runs is the other one (≥38 °C heat stress, ≤8 °C cold, ≥8 °C sudden change).
**Fix:** the dead twin removed with a comment recording exactly which behaviour was unreachable; **runtime behaviour is byte-identical** (merging them would start emitting notifications nobody has ever seen in production — that is a product decision, logged as O-16, not taken silently). The removed code is preserved in git history.
**Proof:** `tests/unit/17` pins the *live* thresholds and the dedup, and a second test asserts `checkWeather` is defined exactly once so a duplicate key can never shadow it again; `tests/unit/22` generalises that into a repo-wide duplicate-object-key tripwire (verified against a synthetic fixture: it reports `FIXTURE.alpha defined again at line 4`).

#### F-14 · `genId()` had ~46 000 outcomes while serving as the **financial idempotency key**
`Date.now().toString(36) + Math.random().toString(36).slice(2,5)` — three base-36 random characters. `genId()` is not display-only: it is the `operationId` for every financial posting (`finance-entry.html`, `finance-ar-ap.html`, `finance-animals.html`, `finance-periods.html`), the suffix of every `documentNumber`, and the user id in `users.html`. Measured before the fix: **3 duplicates in 500 same-millisecond calls**. A collision on an `operationId` makes `createSourceDocument()` / `recordPaymentAgainstDocument()` return `{ok:true, idempotent:true}` for a *different* transaction — a real invoice or payment silently dropped while the UI reports success.
**Fix:** 8 base-36 characters from `crypto.getRandomValues` (≈2.8×10¹² outcomes) with a `Math.random` fallback; same shape, same length class, no API change, no format assumption anywhere depends on it.
**Proof:** `tests/unit/01` — 5 000 same-millisecond calls, zero collisions.

#### F-15 · The app's only server-side query ran **unindexed**
`shared.js:_tagExistsInFirebase()` fetches `animals.json?orderBy="tag"&equalTo="GT-000123"` on every animal creation (`generateAnimalTag()`, inside its retry loop) and every tag-uniqueness check (`isTagTaken()`). `database.rules.json` had no `.indexOn` anywhere, so RTDB logs "index not defined" and downloads the **entire** `animals` node to filter it client-side — once per candidate tag.
**Fix:** `".indexOn": ["tag"]` on `animals` (changes no access rule). Requires `firebase deploy --only database` to take effect — committing the file alone changes nothing server-side (O-11).
**Proof:** the rules file still parses as valid JSONC (checked in `tests/unit/22`'s collection-coverage test, which also asserts every collection the app touches is declared in the rules — the bug class that produced the documented `inventory_equipment`/`weight_alerts`/`production_alerts`/`workflow_history` 401s).

#### F-16 · `getSettings()` threw on corrupt `localStorage`, blanking every page
`JSON.parse(localStorage.getItem('farm_settings')||'{}')` with no guard — and `getSettings()` is called from `renderNavbarV2()` on every page. One bad character in localStorage blanked the sidebar, the header and the content at once. `getUser()` directly above already guarded its own parse.
**Fix:** try/catch, falling back to `config.js` defaults.
**Proof:** `tests/unit/01` (field-by-field merge, round-trip) and `tests/unit/19` (a corrupt `farm_theme` falls back to dark instead of throwing).

#### F-17 · Two forecast functions shadowed the global `todayStr()` **function** with a local string
`forecastHealthRisk()` and `forecastTaskWorkload()` each began `var today = new Date(); var todayStr = today.toISOString().slice(0,10);` — a local variable named exactly like the global helper, so any call to `todayStr()` inside those bodies would have thrown `todayStr is not a function`, and the string they did produce was UTC-derived (F-05).
**Fix:** renamed to `todayKey`, taken from `todayStr()`; the `Date` used for day-distance math is kept and named.
**Proof:** `tests/unit/05` — a static check that no `var|let|const todayStr =` exists in `shared.js` (comments stripped), plus a live `forecastTaskWorkload(7)` call.

#### F-18 · Every login wrote the same audit row **twice**
`login.html` posted `activity_log` once in its own block and again at the end of the throttled-notification block — two identical rows per login, doubling the growth rate of the collection that `activity.html` counts directly (`إجمالي العمليات`).
**Fix:** one write (keeping the more descriptive message); the 5-minute `login_notifications` throttle is unchanged.

### LOW

| # | Finding | Fix | Proof |
|---|---|---|---|
| F-19 | **Unescaped data sinks in the render-helper family**: `renderKPICard`'s `unit` (which receives `getSettings().currency`, an admin-editable free-text field) and `comparisonPeriod`; `renderLineChartSVG`/`renderGroupedBarSVG` labels (`renderDonutSVG` already escaped); `renderSectionContainer`/`renderPageHeaderV2` `description`; breadcrumb labels; `renderTimelineItem`'s `time` (the one parameter the 2026-08 pass left out); `renderProductionWidget` `type`/`unit`/`period` | all escaped, and the **trusted-markup vs. data contract is now written down** above the Phase-2 helpers in `shared.js` (which slots carry deliberate icon/anchor markup and must never be escaped — e.g. `dashboard.html`'s KPI label *is* an `<a>` — and which carry record/Settings text) | `tests/unit/18` (20 tests) asserts both halves: payloads are escaped in data slots, trusted markup still renders |
| F-20 | Null-unsafe sorts: `evaluateWeightAlert`, `forecastWeight` and three sorts in `animal-detail.html` did `b.date.localeCompare(a.date)`; one weight record without a `date` threw a `TypeError` that the surrounding `catch` swallowed into `return []` — silently disabling **every** weight alert for that animal, with no console trace | `(x.date||'')` form, matching `_resyncCurrentWeight()` in the same file | `tests/unit/07` — "a weight record with NO date cannot break alert evaluation" |
| F-21 | `NS.push()` read `Notification.permission` with no feature check → `ReferenceError` in any browser without the Notification API (older Android WebView = the Capacitor APK shell), aborting the calling check | `'Notification' in window` guard, matching `requestPermission()` | `tests/unit/17` — deletes `window.Notification` and calls `push()` |
| F-22 | `settings.html` never closed `<div class="page-wrap rail-v2-content">`; the browser auto-closed it at `</body>`, so the trailing inline `<script>` blocks parsed as children of the layout wrapper | balanced; every one of the 36 pages now checked | `tests/unit/22` tag-balance check across all pages |
| F-23 | `login.html`: the keyboard hint sat *after* `.login-screen`'s closing tag followed by one stray unmatched `</div>` (silently dropped by the parser, but invalid) | restructured inside the container | `tests/unit/22` |
| F-24 | `renderMiniSparkline([5])` divided by `data.length-1 === 0` and emitted `points="NaN,14.0"` — invalid SVG | needs ≥2 points, otherwise renders nothing | `tests/unit/18` |
| F-25 | `renderNavbarV2()` emitted `aria-current="page"` on **both** the collapsed icon link and the expanded tree link → two elements claiming to be the current page inside one `<nav>`, announced twice by screen readers | one `aria-current`, on the labelled tree link; the icon link keeps its `active` class and `aria-label` | `tests/unit/19` |
| F-26 | `farm-apk/www` had drifted **again** (`firebase.js`, `shared.js`, `nav.js` all differed; five finance pages were missing from the APK entirely) — the exact failure `scripts/sync-apk-www.js` was written to prevent | ran the sync (39 files copied, 5 pages added) and made drift a test failure | `tests/unit/22` — "the Capacitor APK copy has not drifted from the root app" |
| F-27 | `initApp()` (fired at load on every page) could produce an unhandled promise rejection whenever the bootstrap write failed | wrapped; `Users.init()` also wraps its own write | `tests/unit/02` boots with `failMode:'network'` — previously crashed the test process outright |

---

## 3. Modules audited and their verified state

| Module | Suite | Result | Notes |
|---|---|---|---|
| Core utilities (`ar`, `pad2`, `todayStr`, `genId`, `escapeHtml`, `escapeJsAttr`, `getSettings`) | 01 | 20/20 | F-14, F-16 |
| Auth & permissions (`can`, `canWrite`, `ROLE_PERMS`, `hashPin`, `Users`) | 02 | 22/22 | F-01, F-03, F-04, F-27 |
| Data layer (`fbGet/Put/Patch/Post/Delete`, cache TTL & invalidation, `fbGetSafe`, `logActivity`, 401 handling) | 03 | 19/19 | F-01; one user-visible auth toast per batch of failures |
| Undo history | 04 | 11/11 | F-06 |
| Local-calendar dates | 05 | 15/15 | F-05, F-17 |
| Livestock lifecycle (age, life stage, purpose, mortality-correction markers, breed aliases) | 06 | 12/12 | clean |
| Weight service (SSOT) | 07 | 13/13 | F-04, F-20 |
| Animal status service (state machine, bulk ops, finance side-effects) | 08 | 19/19 | F-04; `dead`/`sold`/`removed` terminality verified |
| Birth SSOT & tag generation | 09 | 14/14 | F-09, F-10 |
| Finance service & KPIs | 10 | 14/14 | `type:'loss'` invisibility pinned as a known gap (O-06) |
| Accounting core (chart, journal, trial balance, P&L, balance sheet, ledger) | 11 | 17/17 | A = L + E verified end-to-end; immutability & reversal verified |
| Source documents, AR/AP, cash & bank | 12 | 24/24 | F-07, F-11; reconciliation semantics (statement vs **cleared**) pinned |
| Inventory ledger & costing | 13 | 20/20 | clamping is reported, never silent; weighted-average cost verified |
| Fiscal periods, month-end close, audit trail, integrity, data quality, cash flow, budgets, forecasts, legacy migration | 14 | 17/17 | LOCKED is a one-way door; migration is idempotent |
| Analytics engine | 15 | 10/10 | strictly read-only (asserted: zero writes); no NaN in any report |
| Alerts, tasks & forecasting | 16 | 19/19 | dedup, auto-resolve, evidence-carrying scores |
| Notifications (bell, dropdown, popup, service) | 17 | 16/16 | F-13, F-21; unread notifications are never auto-expired |
| Render helpers & XSS | 18 | 20/20 | F-19, F-24 |
| Navigation, theme & page bootstrap | 19 | 15/15 | F-25; rail duplication documented as a caller contract |
| Genealogy, integrity tools & diary | 20 | 12/12 | F-12; `checkGenealogyIntegrity()` proven read-only |
| Costing, assets, loans & equity | 21 | 19/19 | a full mixed farm month stays balanced |
| Repository invariants | 22 | 17/17 | F-05, F-08, F-13, F-22, F-26 + rules coverage, dead links, secrets, `eval` ban |

---

## 4. Open items — found, documented, deliberately **not** silently changed

### ⛔ O-18 · CRITICAL, and it cannot be fixed from inside this repository

**The `users` collection is readable by any anonymous session, and `pin_hash` is offline-crackable in milliseconds — i.e. every PIN, including the administrator's, is recoverable without sending a single request to Firebase.**

Four links, each verified in this repository:

1. **`config.js` binds a live project and the repository is public.** `projectId: "farm-mz99"`, `databaseURL: "https://farm-mz99-default-rtdb.europe-west1.firebasedatabase.app"`, plus the Firebase web `apiKey` (`AIzaSy…`). A Firebase *web config* is public by design — it ships to every browser — so the whole security model rests on the Realtime Database rules. (This report's first draft wrongly stated "no project is bound anywhere in this repo"; corrected here and in O-11.)
2. **`database.rules.json` gates `users` *writes* behind `role === 'admin'` but leaves its `.read` a bare `auth != null`** — as it does for 25 other collections (`animals`, `health`, `breeding`, `production_log`, `inventory_*`, `activity_log`, `settings`, …). The file's own header already acknowledges this: *"most pre-existing collections still use bare `auth != null` for read, which is a known, separate, PRE-EXISTING characteristic of this app's security model."* The hardened `uid_lookup → users → role` chain protects the 17 accounting collections only.
3. **`auth != null` is satisfied by every visitor, automatically.** `firebase.js:_getValidAuthToken()` signs each browser into an Anonymous Auth session on its first request with zero interaction and no PIN — the rules file says so explicitly. An attacker does not even need to load the app: with the public `apiKey` they can mint such a token themselves and call the REST API directly.
4. **The verifier itself is reproducible offline.** `hashPin(pin, userId)` is `SHA-256('bayan-farm-pin-salt:' + userId + ':' + pin)` — the salt is a **hardcoded literal in the public repo**, `userId` is the record's own id (present in the same download, e.g. `admin1`), and the PIN space is **4 digits = 10 000 candidates**. One `GET /users.json` therefore yields every PIN in milliseconds, locally, with no failed-login traffic for Firebase's rate limiting to see. `login.html` additionally still accepts a **plaintext `pin`** field for any not-yet-migrated user — no cracking needed at all for those.

*Consequence:* full administrator access to the live herd and finance data, from a public repo, with no brute-force loop and no server-visible signal. Note this is a **different hole** from F-01/F-02/F-03 (those were logic bugs inside the app; this one is the data exposure that makes any PIN guessable) and it survives all 27 fixes in this pass.

**Why it stays open:** the fix is not a rules edit. `login.html` must read `users` *before* it can authenticate (it downloads candidates and compares hashes), so tightening `.read` to a real-user chain breaks login for every user — which is exactly the kind of silent, app-wide breakage this audit refuses to ship. Closing it properly means moving verification server-side: the Firebase Auth email/password bridge already present in `firebase.js` (`signInWithFirebaseAuth`, synthetic `u_{appUserId}@bayan-farm.internal` addresses) is the intended path — authenticate against Firebase Auth, then read only `users/{appUserId}` through `uid_lookup`. That is an architecture change with a migration plan, and it only takes effect once the rules are **deployed** (`firebase deploy --only database`), which no code change in this repository can do. Owner decision + Firebase Console access required.

**Interim mitigations, highest value first (none require the architecture change):**
1. Check the **deployed** rules in the Firebase Console and, if login must keep reading `users`, set `users/$uid/pin_hash` (and `users/$uid/pin`) `.read: false` — the login flow compares hashes *client-side*, so this specific mitigation needs a verification redesign too; the immediately safe step is (2).
2. **Lengthen the PIN** (4 → 6+ digits): 10 000 candidates becomes 10⁶+, which turns offline cracking from milliseconds into impractical even if the collection leaks. Requires a user-facing migration.
3. **Drop the plaintext `pin` fallback** in `login.html` once every record carries a `pin_hash`.
4. **Restrict the Firebase API key by HTTP referrer** in Google Cloud Console (drive-by abuse only; a determined attacker can still call the REST API, so this is hygiene, not a fix).
5. **Rotate `weatherApiKey`** (`2b08987a…`, `config.js:52`): a paid third-party secret committed to a public repo. Already a *known* state — `docs/security/CONFIGURATION-SECURITY-REVIEW.md` records moving it out of `firebase.js` into `config.js` as the "quick win", with the server-side proxy still listed as future work. `api/groq.js` by contrast accepts a client-supplied `x-user-key` (documented BYO-key model) and `api/claude.js` correctly uses `process.env` only.

**Caveat on evidence:** the audit sandbox has no network path to `firebasedatabase.app`, so the *deployed* rules could not be queried; every statement above is read from committed sources, and step 2 must be confirmed against the Firebase Console. That the production login flow works at all is strong indirect evidence that `users` really is readable pre-authentication.

| # | Item | Why it stays open |
|---|---|---|
| O-01 | Permissions are client-trusted (`localStorage['farm_user']`); anyone with DevTools can claim any role | Structural, documented since `THREAT-MODEL.md`. Fixing it means a real server-side auth layer — an architecture change, not an audit fix. `canWrite()`/`can('admin')` close the *authorisation logic* holes; they cannot close client-side trust. |
| O-02 | **`bayan.html` is a static snapshot** (hardcoded Excel numbers dated ٢٠٢٦/٠٤/٢٤, total 440 head), linked from the main navigation as if live, loading neither `firebase.js` nor `requireAuth()` — so it is readable by anyone with the URL and shows months-old counts as current | It does display its own date (`بيان عن يوم: ٢٠٢٦/٠٤/٢٤`), and rewiring a formal printable deliverable to live data is feature work with its own layout/print consequences. Needs a product decision: wire it to Firebase, or move it out of the main nav into an "archived reports" section. |
| O-03 | **Documentation is stale about `activity.html`**: `PERMISSION-MATRIX.md`, `FAILURE-MODES.md` and `THREAT-MODEL.md` all state it is "a genuine 0-byte empty file" and that the audit trail has "no working viewer". It is in fact a complete 140-line admin page that reads `activity_log`, filters by action/role and escapes its output. The repudiation gap those docs describe no longer exists | Corrected here rather than editing three archived audit documents in place; they are historical records of their own sessions. |
| O-04 | `operationId: genId()` is minted **inside** the submit handlers of the four finance pages, so every click produces a fresh key and the engine's create-or-return-existing dedup can never fire for a double-click — the idempotency machinery is effectively bypassed at the UI layer | The correct fix is per-page: mint the token when the modal **opens**, clear it after success. Four pages, each with its own modal lifecycle; a real UX change, pinned by a test (`tests/unit/12`) so it cannot be forgotten. |
| O-05 | `_recordFinancialAudit()` is fire-and-forget (deliberately: an audit write must never fail a posting), so an audit row can be lost if the page navigates immediately after | Trade-off is documented in the function itself; making it awaited changes posting latency everywhere. |
| O-06 | `type:'loss'` finance records are invisible to `computeFinanceKPIs()` and `pages/finance.js` bucketing (income/expense only) | Pre-existing, flagged in `shared.js` by its own author. Whether a loss counts as an expense in the farm's P&L is a business decision. Pinned by a test so it cannot change silently. |
| O-07 | Inventory named operations (`purchaseFeed`, `consumeFeed`, `expireStock`, `returnStock`, `stockAdjustment`, `inventoryCorrection`, `transferStock`) carry no permission guard, while `initialStock()` does | No live hole: `visitor`/`worker` are not granted `inventory`, so `inventory.html` refuses them at page level. Inconsistent defence-in-depth only. |
| O-08 | `pages/breeding.js:submitBreeding()` (mating records) has no write guard | Same reasoning: `breeding` is not granted to the read-only role. |
| O-09 | `sw-register.js` is still not loaded by any page — the entire service-worker/PWA layer (`sw.js`, correct and complete) remains dormant | Documented as a deliberate state in `SYSTEM-MODEL.md`; activating it is its own risk decision (stale-cache recovery tools exist but are unexercised in production). |
| O-10 | `renderProductionWidget()` has **zero callers** in the app | Kept (it is part of the documented Phase-2 component set in `COMPONENTS.md`) and hardened anyway; flagged rather than deleted. |
| O-11 | `database.rules.json` changes (F-15's index) only take effect after `firebase deploy --only database` | Deployment is a human step by design. **Correction to this report's first draft:** a project *is* bound in this repo — `config.js` carries live credentials for `farm-mz99` (`databaseURL: https://farm-mz99-default-rtdb.europe-west1.firebasedatabase.app`), and the repository is **public**. The committed rules file is therefore describing the production database, and until it is deployed the index in F-15 does not exist server-side. See O-19. |
| O-12 | `tests/rules/accounting-rules.test.js` has still never been executed (needs Java + the RTDB emulator) | Now correctly excluded from Playwright collection (F-08) instead of silently breaking the gate; its own header documents the command to run it. |
| O-13 | Weight/missing-weight alert `detail` strings interpolate **ASCII** digits while almost every other user-visible number goes through `ar()` | Cosmetic inconsistency; changing alert text affects tests and user habits, so it is flagged, not touched. |
| O-14 | No retry logic on any failed write (`fbPost`/`fbPatch`/`fbDelete`) — a failed write simply fails behind a generic toast | Pre-existing, documented in `FAILURE-MODES.md`. `offline-sync.js` queues writes only when it is explicitly used. |
| O-15 | The `weights` top-level collection in `database.rules.json` is almost certainly always empty (the certified SSOT is the nested `animals/{id}/weights`); `settings.html`'s reset button still targets it | Noted by the rules file's own comment; removing either side is a separate decision. |
| O-16 | The dead weather implementation removed in F-13 contained behaviour nobody has ever seen in production (daily all-clear, humidity warning, once-per-day throttle). Restoring any of it is a product choice | Recorded here with the exact semantics; the code is in git history. |
| O-17 | Scalability and observability remain the two weakest dimensions from `PRODUCTION-READINESS-SCORE.md` (5/10 and 4/10): no multi-tenancy, and errors still only reach a developer console | Out of scope for a bug audit; unchanged by this pass. |
| O-19 | **The browser suite is not hermetic — it runs against the live production database.** All 55 Playwright specs load the real pages, so `initApp()` executes against `farm-mz99` (real Anonymous-Auth minting, real reads of `users`/`settings`) and only *afterwards* do the specs monkey-patch `window.fbGet/fbPost/fbPut/fbPatch` inside `page.evaluate()`. **Zero** specs intercept the network (`page.route`): 0 of 55. | Making it hermetic means either one shared fixture that intercepts `*.firebasedatabase.app` in every spec, or pointing CI at the RTDB emulator (which also needs Java, see O-12). Both are a project of their own. Doing it silently here would also have buried the more important fact — that these 425 tests had never executed at all. Recorded with the CI evidence in F-08. |
| O-20 | **CI's failure artifact never existed:** `.github/workflows/quality.yml` has always uploaded `playwright-report/` on failure, but the reporter was `list`-only, so every red run logged *"No files were found with the provided path: playwright-report/"* | **Fixed in this pass** — `reporter: [['list'], ['html', { open: 'never' }]]`. Kept in this table because it explains why the browser-layer failures could not be inspected while writing this report; the next red run will produce a downloadable report. |
| O-21 | `api/groq.js` accepts a client-supplied `x-user-key` header as a fallback when `GROQ_API_KEY` is unset | Deliberate BYO-key model, documented in the file's own header; `api/claude.js` uses `process.env` only. Flagged so the choice stays conscious rather than inherited. |

---

## 5. Files changed

```
firebase.js               +309   canWrite(), can('admin') fix, fbGetSafe(), local-date
                                 helpers, genId() entropy, undo capture wiring,
                                 Users.init()/initApp()/getSettings() hardening
shared.js                 +332   seedDefaultChartOfAccounts() safe read, weight-service
                                 null-safety, createOffspringAnimal() weight invariant,
                                 _ubSubmit() guard + qty bounds, forecast todayKey rename,
                                 AR/AP ledger-derived scope, dueDate forwarding,
                                 renameTag() propagation, escaping in 6 render helpers,
                                 escaping-contract documentation, aria-current fix
login.html                 +83   fbGetSafe() gate, single audit write, markup fix
notifications-service.js   +59   duplicate checkWeather removed, Notification feature check,
                                 local expiry cutoff
database.rules.json        +14   .indexOn ["tag"] for animals
playwright.config.js       +16   testIgnore (un-breaks the gate) + html
                                 reporter (so the workflow's existing
                                 failure-artifact upload finally has a
                                 folder to upload — O-20)
.github/workflows/quality.yml +40  unit layer, jsdom, simplified server steps
settings.html, animal-detail.html, animals.html, assistant.html, dashboard.html,
import.html, pages/{breeding,datepicker,finance,health,inventory,production,reports,
tasks,vaccine}.js               local-calendar conversions + null-safe sorts
farm-apk/www/**                 re-synced via scripts/sync-apk-www.js (39 files, +5 pages)
tests/unit/**  (new)            harness + 22 module suites + runner (361 tests)
package.json / package-lock.json  jsdom devDependency, test:unit / test:all scripts
```

**Reproduce:** `npm install && npm run test:unit` (≈5 s, no browser) · `npm run scan` · `npx playwright test --list`.
