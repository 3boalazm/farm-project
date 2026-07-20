// ╔══════════════════════════════════════════════════════════════════╗
// ║   sync-to-excel.js — بيان المزرعة                              ║
// ║   افتح أي صفحة من التطبيق (مثلاً dashboard.html)               ║
// ║   ثم افتح DevTools → Console والصق هذا الكود كله مرة واحدة    ║
// ╚══════════════════════════════════════════════════════════════════╝

(async () => {
  // ── الهدف المطلوب (من بيان الإكسيل 2026/06/01) ─────────────────
  // breed للمواليد: عشوائي من سلالات كل نوع
  const GOAT_BREEDS  = ['شامي','بور','بلدي'];
  const SHEEP_BREEDS = ['برقي','دودبر','ميت ماستر'];

  // target[species][breed][purpose][gender] = العدد المطلوب
  const TARGET = {
    goat: {
      'بور':  { tarbiya:{male:11,female:15}, tasmeen:{male:4,female:0}, birth:{male:0,female:0} },
      'شامي': { tarbiya:{male:2, female:141},tasmeen:{male:0,female:0}, birth:{male:0,female:0} },
      'بلدي': { tarbiya:{male:1, female:26}, tasmeen:{male:0,female:0}, birth:{male:0,female:0} },
    },
    sheep: {
      'برقي':      { tarbiya:{male:2,female:68},tasmeen:{male:0,female:0},birth:{male:0,female:0} },
      'دودبر':     { tarbiya:{male:1,female:1}, tasmeen:{male:0,female:0},birth:{male:0,female:0} },
      'ميت ماستر':{ tarbiya:{male:1,female:0}, tasmeen:{male:0,female:0},birth:{male:0,female:0} },
    },
    // مواليد: مجمّع على مستوى النوع، breed عشوائي
    goat_births:  { birth:{male:50,female:51} },
    sheep_births: { birth:{male:19,female:17}, tasmeen:{male:0,female:12} },
  };

  // ── helpers ──────────────────────────────────────────────────────
  const DB  = FARM_CONFIG.databaseURL;
  const rnd = arr => arr[Math.floor(Math.random()*arr.length)];

  async function getAll(path) {
    const r = await fetch(`${DB}/${path}.json`);
    return r.ok ? (await r.json()) : null;
  }
  async function post(path, data) {
    const r = await fetch(`${DB}/${path}.json`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(data)
    });
    return r.ok;
  }
  async function del(path, id) {
    const r = await fetch(`${DB}/${path}/${id}.json`, { method:'DELETE' });
    return r.ok;
  }

  console.log('%c🐐 sync-to-excel — بدأ التزامن', 'color:#ffc107;font-size:14px;font-weight:bold');

  // ── 1. جلب كل الحيوانات الحية ────────────────────────────────────
  const raw = await getAll('animals');
  if (!raw) { console.error('❌ فشل جلب البيانات'); return; }

  const all = Object.entries(raw)
    .map(([id,a])=>({...a,_id:id}))
    .filter(a=>a.status==='alive');

  console.log(`📦 إجمالي الحيوانات الحية: ${all.length}`);

  // ── 2. بناء جرد الحالة الراهنة ───────────────────────────────────
  // current[species][breed][purpose][gender] = [id, id, ...]
  function buildIndex(animals) {
    const idx = {};
    for (const a of animals) {
      const sp = a.species, br = a.breed, pu = a.purpose||'tarbiya', ge = a.gender;
      if (!idx[sp]) idx[sp] = {};
      if (!idx[sp][br]) idx[sp][br] = {};
      if (!idx[sp][br][pu]) idx[sp][br][pu] = {male:[],female:[]};
      if (idx[sp][br][pu][ge]) idx[sp][br][pu][ge].push(a._id);
    }
    return idx;
  }

  let idx = buildIndex(all);

  // ── 3. دالة التعديل (إضافة أو حذف) ──────────────────────────────
  let added=0, deleted=0, errors=0;

  async function sync(species, breed, purpose, gender, targetCount, motherBreed) {
    const cur = idx[species]?.[breed]?.[purpose]?.[gender]?.length || 0;
    const diff = targetCount - cur;
    if (diff === 0) return;

    if (diff > 0) {
      // إضافة
      for (let i=0; i<diff; i++) {
        const rec = {
          species, gender, purpose, status:'alive',
          breed: motherBreed ? rnd(motherBreed==='goat'?GOAT_BREEDS:SHEEP_BREEDS) : breed,
          birth_date: '2026-06-01',
          tag: null, barn: null,
          notes: 'تزامن من بيان الإكسيل 2026-06-01'
        };
        if (purpose==='birth') {
          rec.mother_breed = rec.breed;
          rec.breed = rec.breed; // نفس السلالة الأم
        }
        const ok = await post('animals', rec);
        if (ok) added++; else errors++;
      }
    } else {
      // حذف
      const toDelete = (idx[species]?.[breed]?.[purpose]?.[gender] || []).slice(0, Math.abs(diff));
      for (const id of toDelete) {
        const ok = await del('animals', id);
        if (ok) deleted++; else errors++;
      }
    }
  }

  // ── 4. تطبيق الهدف على السلالات المحددة ──────────────────────────
  for (const [sp, breeds] of Object.entries({goat: TARGET.goat, sheep: TARGET.sheep})) {
    for (const [br, purposes] of Object.entries(breeds)) {
      for (const [pu, genders] of Object.entries(purposes)) {
        for (const [ge, cnt] of Object.entries(genders)) {
          await sync(sp, br, pu, ge, cnt, null);
        }
      }
    }
  }

  // ── 5. مواليد الماعز (breed عشوائي من goat breeds) ───────────────
  // أولاً: احسب إجمالي المواليد الحالية للماعز
  const goalBirthM = TARGET.goat_births.birth.male;
  const goalBirthF = TARGET.goat_births.birth.female;

  const curGoatBirths = all.filter(a=>a.species==='goat'&&(a.purpose==='birth'||a.breed==='مواليد'));
  const curGBM = curGoatBirths.filter(a=>a.gender==='male').length;
  const curGBF = curGoatBirths.filter(a=>a.gender==='female').length;

  console.log(`مواليد ماعز حالية: ذ=${curGBM} إ=${curGBF} | هدف: ذ=${goalBirthM} إ=${goalBirthF}`);

  // حذف الزيادة
  if (curGBM > goalBirthM) {
    const toRemove = curGoatBirths.filter(a=>a.gender==='male').slice(0, curGBM-goalBirthM);
    for (const a of toRemove) { const ok=await del('animals',a._id); if(ok)deleted++;else errors++; }
  }
  if (curGBF > goalBirthF) {
    const toRemove = curGoatBirths.filter(a=>a.gender==='female').slice(0, curGBF-goalBirthF);
    for (const a of toRemove) { const ok=await del('animals',a._id); if(ok)deleted++;else errors++; }
  }

  // إضافة الناقص
  for (let i=0; i<Math.max(0,goalBirthM-curGBM); i++) {
    const br=rnd(GOAT_BREEDS);
    await post('animals',{species:'goat',breed:br,gender:'male',purpose:'birth',status:'alive',birth_date:'2026-06-01',mother_breed:br,tag:null,barn:null,notes:'ولادة ماعز — إكسيل 2026-06-01'});
    added++;
  }
  for (let i=0; i<Math.max(0,goalBirthF-curGBF); i++) {
    const br=rnd(GOAT_BREEDS);
    await post('animals',{species:'goat',breed:br,gender:'female',purpose:'birth',status:'alive',birth_date:'2026-06-01',mother_breed:br,tag:null,barn:null,notes:'ولادة ماعز — إكسيل 2026-06-01'});
    added++;
  }

  // ── 6. مواليد الأغنام ────────────────────────────────────────────
  const goalSBM = TARGET.sheep_births.birth.male;       // 19
  const goalSBF = TARGET.sheep_births.birth.female;     // 17
  const goalSBTF = TARGET.sheep_births.tasmeen.female;  // 12 (مواليد تسمين إناث)

  const curSheepBirths = all.filter(a=>a.species==='sheep'&&(a.purpose==='birth'||a.breed==='مواليد'));
  const curSBM = curSheepBirths.filter(a=>a.gender==='male').length;
  const curSBF = curSheepBirths.filter(a=>a.gender==='female').length;

  // مواليد تسمين أغنام (إناث)
  const curSheepBirthTas = all.filter(a=>a.species==='sheep'&&a.purpose==='tasmeen'&&
    (a.mother_breed!=null||a.breed==='مواليد')).filter(a=>a.gender==='female');
  const curSBTF = curSheepBirthTas.length;

  console.log(`مواليد أغنام حالية: ذ=${curSBM} إ=${curSBF} تسمين_إ=${curSBTF} | هدف: ذ=${goalSBM} إ=${goalSBF} تسمين_إ=${goalSBTF}`);

  // حذف زيادة مواليد أغنام (birth)
  if (curSBM > goalSBM) {
    const rem=curSheepBirths.filter(a=>a.gender==='male').slice(0,curSBM-goalSBM);
    for (const a of rem){const ok=await del('animals',a._id);if(ok)deleted++;else errors++;}
  }
  if (curSBF > goalSBF) {
    const rem=curSheepBirths.filter(a=>a.gender==='female').slice(0,curSBF-goalSBF);
    for (const a of rem){const ok=await del('animals',a._id);if(ok)deleted++;else errors++;}
  }

  // إضافة ناقص مواليد أغنام (birth)
  for (let i=0;i<Math.max(0,goalSBM-curSBM);i++){
    const br=rnd(SHEEP_BREEDS);
    await post('animals',{species:'sheep',breed:br,gender:'male',purpose:'birth',status:'alive',birth_date:'2026-06-01',mother_breed:br,tag:null,barn:null,notes:'ولادة أغنام — إكسيل 2026-06-01'});
    added++;
  }
  for (let i=0;i<Math.max(0,goalSBF-curSBF);i++){
    const br=rnd(SHEEP_BREEDS);
    await post('animals',{species:'sheep',breed:br,gender:'female',purpose:'birth',status:'alive',birth_date:'2026-06-01',mother_breed:br,tag:null,barn:null,notes:'ولادة أغنام — إكسيل 2026-06-01'});
    added++;
  }

  // تسمين مواليد أغنام (إناث 12)
  if (curSBTF > goalSBTF) {
    const rem=curSheepBirthTas.slice(0,curSBTF-goalSBTF);
    for (const a of rem){const ok=await del('animals',a._id);if(ok)deleted++;else errors++;}
  }
  for (let i=0;i<Math.max(0,goalSBTF-curSBTF);i++){
    const br=rnd(SHEEP_BREEDS);
    await post('animals',{species:'sheep',breed:br,gender:'female',purpose:'tasmeen',status:'alive',birth_date:'2026-06-01',mother_breed:br,tag:null,barn:null,notes:'تسمين مواليد أغنام — إكسيل 2026-06-01'});
    added++;
  }

  // ── 7. تقرير نهائي ───────────────────────────────────────────────
  console.log('%c✅ انتهى التزامن', 'color:#4caf50;font-size:14px;font-weight:bold');
  console.log(`   تمت إضافة: ${added} سجل`);
  console.log(`   تم حذف:    ${deleted} سجل`);
  if (errors) console.warn(`   أخطاء:     ${errors}`);

  // تحقق من الإجمالي الجديد
  const raw2 = await getAll('animals');
  const all2 = Object.values(raw2).filter(a=>a.status==='alive');
  const gTotal = all2.filter(a=>a.species==='goat').length;
  const sTotal = all2.filter(a=>a.species==='sheep').length;
  console.log(`📊 إجمالي ما بعد التزامن: ماعز=${gTotal} (هدف=301) | أغنام=${sTotal} (هدف=121)`);
  if (gTotal===301 && sTotal===121)
    console.log('%c🎯 الأرقام مطابقة للإكسيل تماماً!', 'color:#ffc107;font-size:14px;font-weight:bold');
  else
    console.warn('⚠️ فيه فرق — شيك على الداتا يدوياً');

})();
