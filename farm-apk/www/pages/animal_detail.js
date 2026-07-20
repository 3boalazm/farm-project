'use strict';

// ── State ────────────────────────────────────────────────
let _animal   = null;
let _animalId = null;
let _health   = [];
let _breeding = [];
let _weights  = [];
let _editMode = null; // 'weight' | 'animal'

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  initFirebase();
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent = s.farmName;
  renderNavbar('animal-detail.html');

  const el = document.getElementById('content');
  renderLoading(el);

  const params = new URLSearchParams(window.location.search);
  _animalId = params.get('id');

  if (!_animalId) {
    el.innerHTML = emptyState('bi-question-circle', 'لم يتم تحديد حيوان',
      '<a href="animals.html" class="action-btn primary mt-3"><i class="bi bi-arrow-right me-1"></i> العودة للقطيع</a>');
    return;
  }

  try {
    await loadAll(el, s);
  } catch (e) {
    toast('خطأ في التحميل: ' + e.message, 'error');
    el.innerHTML = emptyState('bi-exclamation-triangle', e.message,
      '<a href="animals.html" class="action-btn primary mt-3">العودة</a>');
  }
});

// ── Load all data ────────────────────────────────────────
async function loadAll(el, s) {
  const [animals, healthAll, breedingAll, weightAll] = await Promise.all([
    fbGet('animals'),
    fbGet('health'),
    fbGet('breeding'),
    fbGet('weight_log').catch(() => []),
  ]);

  _animal = (animals || []).find(a => a._id === _animalId);

  if (!_animal) {
    el.innerHTML = emptyState('bi-search', 'الحيوان غير موجود',
      '<a href="animals.html" class="action-btn primary mt-3">العودة للقطيع</a>');
    return;
  }

  const tag = _animal.tag || '';

  _health = (healthAll || [])
    .filter(r => r.animal_tag === tag || r.animal_id === _animalId)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  _breeding = (breedingAll || [])
    .filter(r =>
      r.female_tag === tag || r.male_tag === tag ||
      r.mother_tag === tag || r.female_id === _animalId
    )
    .sort((a, b) => (b.mating_date || '').localeCompare(a.mating_date || ''));

  _weights = (weightAll || [])
    .filter(w => w.animal_id === _animalId || w.animal_tag === tag)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  renderAnimalDetail(el, s);
}

// ── Main Render ──────────────────────────────────────────
function renderAnimalDetail(el, s) {
  const a = _animal;
  const isFemale = a.gender === 'female';
  const isAlive  = a.status !== 'dead';
  const emoji    = a.species === 'sheep' ? '🐑' : '🐐';

  const purposeMap = { tarbiya: 'تربية', tasmeen: 'تسمين', birth: 'مواليد' };
  const purposeClass = { tarbiya: 'badge-tarbiya', tasmeen: 'badge-tasmeen', birth: 'badge-yellow' };
  const purposeLabel = purposeMap[a.purpose] || a.purpose || '—';
  const purposeC     = purposeClass[a.purpose] || 'badge-gray';

  const genderLabel  = isFemale ? '♀ أنثى' : '♂ ذكر';
  const genderColor  = isFemale ? 'var(--orange)' : 'var(--blue)';
  const speciesLabel = a.species === 'sheep' ? 'أغنام' : 'ماعز';

  const age = calcAge(a.birth_date);
  const lastWeight = _weights.length ? _weights[0].weight : (a.current_weight || a.weight || null);
  const lastWeightDate = _weights.length ? _weights[0].date : null;

  const activeHealth  = _health.filter(r => r.status === 'active');
  const inWithdrawal  = _health.filter(r => r.status === 'active' && r.withdrawal_end && r.withdrawal_end >= todayStr());

  // Set page header
  renderPageHeader(
    `${emoji} ${a.breed || '—'} ${a.tag ? '<span style="color:var(--text-gray);font-size:.85em">#' + a.tag + '</span>' : ''}`,
    `${speciesLabel} • ${purposeLabel} • ${genderLabel}`,
    `<a href="animals.html" class="action-btn sm"><i class="bi bi-arrow-right"></i> القطيع</a>
     ${can('animals') && isAlive ? `<button class="action-btn primary sm" onclick="openEditAnimal()"><i class="bi bi-pencil"></i> تعديل</button>` : ''}
     ${can('admin') && isAlive ? `<button class="action-btn danger sm" onclick="confirmMarkDead()"><i class="bi bi-x-octagon"></i> تسجيل نفوق</button>` : ''}`
  );

  // ── Withdrawal warning ───────────────────────────────
  const withdrawalBanner = inWithdrawal.length ? `
    <div class="withdrawal-alert mb-4">
      <div class="fw-bold red-text mb-1"><i class="bi bi-exclamation-triangle-fill me-2"></i>
        تحذير: هذا الحيوان في فترة تأثير علاج — يُمنع البيع أو الذبح أو استخدام المنتجات
      </div>
      ${inWithdrawal.map(r => {
        const dLeft = Math.max(0, Math.ceil((new Date(r.withdrawal_end) - new Date()) / 86400000));
        return `<div class="d-flex align-items-center gap-2 mt-1 flex-wrap">
          <small class="text-gray">${r.medication} — ينتهي ${r.withdrawal_end}
            <span style="color:var(--red)">(متبقي ${ar(dLeft)} يوم)</span>
          </small></div>`;
      }).join('')}
    </div>` : '';

  // ── Status banner if dead ────────────────────────────
  const deadBanner = !isAlive ? `
    <div class="wonder-card mb-4" style="border-color:rgba(244,67,54,.35);background:rgba(244,67,54,.04)!important">
      <div class="d-flex align-items-center gap-3">
        <i class="bi bi-x-octagon-fill" style="font-size:2rem;color:var(--red)"></i>
        <div>
          <div class="fw-bold red-text">هذا الحيوان مسجل كـ نافق</div>
          ${a.died_at ? `<small class="text-gray">تاريخ النفوق: ${a.died_at}</small>` : ''}
          ${a.death_cause ? `<small class="text-gray"> | السبب: ${a.death_cause}</small>` : ''}
        </div>
      </div>
    </div>` : '';

  // ── KPI Cards ─────────────────────────────────────────
  const kpiCards = [
    { i: 'bi-calendar3',        c: 'var(--blue)',   l: 'العمر',           v: age || '—' },
    { i: 'bi-speedometer2',     c: 'var(--orange)', l: 'الوزن الأخير',    v: lastWeight ? ar(+lastWeight) + ' كجم' : '—' },
    { i: 'bi-building',         c: 'var(--green)',  l: 'الجمالون/العنبر', v: a.barn || '—' },
    { i: 'bi-heart-pulse-fill', c: activeHealth.length ? 'var(--red)' : 'var(--green)',
      l: 'السجل الصحي', v: activeHealth.length ? ar(activeHealth.length) + ' نشط' : 'سليم' },
    { i: 'bi-diagram-2-fill',   c: 'var(--purple)', l: 'سجلات التكاثر',  v: ar(_breeding.length) },
    { i: 'bi-bar-chart-fill',   c: 'var(--yellow)', l: 'قياسات الوزن',   v: ar(_weights.length) },
  ].map(k => `
    <div class="col-6 col-md-4 col-lg-2">
      <div class="summary-card">
        <i class="bi ${k.i} d-block mb-2" style="color:${k.c};font-size:1.25rem"></i>
        <div style="font-size:.95rem;font-weight:700;color:${k.c};line-height:1.2">${k.v}</div>
        <small class="text-gray">${k.l}</small>
      </div>
    </div>`).join('');

  // ── Info Grid ─────────────────────────────────────────
  const infoRows = [
    ['رقم الترقيم',  a.tag || '—'],
    ['السلالة',      a.breed || '—'],
    ['النوع',        speciesLabel],
    ['الجنس',        genderLabel],
    ['الغرض',        purposeLabel],
    ['الجمالون',     a.barn || '—'],
    ['تاريخ الميلاد', a.birth_date ? a.birth_date + ` (${age})` : '—'],
    ['الوزن الحالي',  lastWeight ? ar(+lastWeight) + ' كجم' + (lastWeightDate ? ` — ${lastWeightDate}` : '') : '—'],
    ['تاريخ الإضافة', (a.created_at || a.imported_at || '—').slice(0, 10)],
    ['الحالة',       isAlive ? '✅ حي' : `💀 نافق${a.died_at ? ' — ' + a.died_at : ''}`],
  ].map(([k, v]) => `
    <div class="info-row">
      <div style="min-width:120px"><span class="info-label">${k}</span></div>
      <span class="info-value">${v}</span>
    </div>`).join('');

  // ── Weight History ────────────────────────────────────
  const weightSection = renderWeightSection();

  // ── Health Records ─────────────────────────────────────
  const healthSection = renderHealthSection(s);

  // ── Breeding Records ──────────────────────────────────
  const breedingSection = renderBreedingSection(a);

  // ── Assemble ──────────────────────────────────────────
  el.innerHTML = `
    ${withdrawalBanner}
    ${deadBanner}

    <!-- KPI Row -->
    <div class="row g-3 mb-4">${kpiCards}</div>

    <!-- Main Grid -->
    <div class="row g-3 mb-4">
      <!-- Left: Info card -->
      <div class="col-md-5">
        <div class="wonder-card h-100">
          <div class="d-flex align-items-center gap-3 mb-4 pb-3" style="border-bottom:1px solid var(--border)">
            <div style="width:60px;height:60px;border-radius:16px;background:var(--bg-hover);display:flex;align-items:center;justify-content:center;font-size:2rem;flex-shrink:0">${emoji}</div>
            <div>
              <div class="fw-bold" style="font-size:1.05rem">${a.breed || '—'} ${a.tag ? '<span class="text-gray" style="font-size:.85em">#' + a.tag + '</span>' : ''}</div>
              <div class="d-flex gap-2 mt-1 flex-wrap">
                <span class="type-badge ${purposeC}">${purposeLabel}</span>
                <span class="type-badge badge-gray" style="color:${genderColor}">${genderLabel}</span>
                ${!isAlive ? '<span class="type-badge badge-danger">نافق</span>' : ''}
              </div>
            </div>
          </div>
          ${infoRows}
        </div>
      </div>

      <!-- Right: Weight chart -->
      <div class="col-md-7">
        ${weightSection}
      </div>
    </div>

    <!-- Health Records -->
    ${healthSection}

    <!-- Breeding Records (show only if female or has records) -->
    ${(isFemale || _breeding.length > 0) ? breedingSection : ''}

    <!-- Bottom spacer -->
    <div style="height:40px"></div>
  `;
}

// ── Weight Section ────────────────────────────────────────
function renderWeightSection() {
  const canEdit = can('animals');
  const hasData = _weights.length > 0;

  // Simple inline SVG bar chart (no library needed)
  let chartHtml = '';
  if (hasData) {
    const maxW = Math.max(..._weights.map(w => +w.weight || 0));
    const show  = _weights.slice(0, 8).reverse(); // last 8, oldest first
    chartHtml = `
      <div style="display:flex;align-items:flex-end;gap:6px;height:80px;margin:12px 0 6px;padding:0 4px">
        ${show.map(w => {
          const pct = maxW > 0 ? Math.round(((+w.weight || 0) / maxW) * 100) : 0;
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:.62rem;color:var(--text-gray)">${ar(+w.weight)}</div>
            <div style="width:100%;height:${Math.max(6, pct * 0.7)}px;background:linear-gradient(180deg,var(--orange),#ff8a65);border-radius:4px 4px 0 0;transition:height .5s"></div>
            <div style="font-size:.58rem;color:var(--text-muted);writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap">${(w.date || '').slice(5)}</div>
          </div>`;
        }).join('')}
      </div>
      <div class="d-flex justify-content-between" style="font-size:.72rem;color:var(--text-gray);margin-bottom:4px">
        <span>أقدم</span><span>أحدث</span>
      </div>`;
  }

  const rows = _weights.slice(0, 6).map((w, i) => `
    <div class="d-flex justify-content-between align-items-center py-2" style="border-bottom:1px solid var(--border-3)">
      <div>
        <span class="fw-bold">${ar(+w.weight)} كجم</span>
        ${i === 0 && _weights.length > 1 ? (() => {
          const diff = (+_weights[0].weight) - (+_weights[1].weight);
          const col  = diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--gray)';
          const ico  = diff > 0 ? '↑' : diff < 0 ? '↓' : '=';
          return `<small style="color:${col};margin-right:6px">${ico} ${ar(Math.abs(diff).toFixed(1))} كجم</small>`;
        })() : ''}
        ${w.notes ? `<small class="text-gray d-block">${w.notes}</small>` : ''}
      </div>
      <div class="d-flex align-items-center gap-2">
        <small class="text-gray">${w.date || '—'}</small>
        ${canEdit ? `<button class="icon-btn del" onclick="deleteWeight('${w._id}')" title="حذف"><i class="bi bi-trash"></i></button>` : ''}
      </div>
    </div>`).join('');

  return `
    <div class="wonder-card h-100">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold mb-0"><i class="bi bi-speedometer2 accent-text me-2"></i>سجل الأوزان</h6>
        ${canEdit && _animal.status !== 'dead' ? `<button class="action-btn primary sm" onclick="openWeightModal()"><i class="bi bi-plus-lg"></i> قياس جديد</button>` : ''}
      </div>
      ${hasData ? chartHtml : ''}
      ${hasData
        ? rows + (_weights.length > 6 ? `<div class="text-center mt-2"><small class="text-gray">و ${ar(_weights.length - 6)} قياسات أقدم</small></div>` : '')
        : `<div class="empty-state" style="padding:24px 0"><i class="bi bi-speedometer2"></i><p>لا توجد قياسات مسجلة</p>${canEdit ? '<button class="action-btn primary" onclick="openWeightModal()"><i class="bi bi-plus-lg"></i> إضافة أول قياس</button>' : ''}</div>`
      }
    </div>`;
}

// ── Health Section ────────────────────────────────────────
function renderHealthSection(s) {
  const canEdit  = can('health');
  const tag      = _animal.tag || '';
  const isAlive  = _animal.status !== 'dead';
  const today    = todayStr();

  const rows = _health.slice(0, 5).map(r => {
    const inW   = r.withdrawal_end && r.withdrawal_end >= today;
    const dLeft = inW ? Math.max(0, Math.ceil((new Date(r.withdrawal_end) - new Date()) / 86400000)) : 0;
    return `
      <div class="record-card" style="cursor:pointer" onclick="showHealthDetail('${r._id}')">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div class="flex-grow-1">
            <div class="d-flex gap-2 flex-wrap mb-1">
              <span class="type-badge ${r.status === 'active' ? 'badge-tasmeen' : 'badge-tarbiya'}">
                ${r.status === 'active' ? 'قيد العلاج' : 'مكتمل'}
              </span>
              ${inW ? `<span class="type-badge badge-danger"><i class="bi bi-exclamation-triangle-fill me-1"></i>سحب ${ar(dLeft)} يوم</span>` : ''}
            </div>
            <div style="font-size:.85rem">
              <span class="text-gray">التشخيص: </span><strong>${r.diagnosis || '—'}</strong>
              <span class="text-gray mx-2">|</span>
              <span class="text-gray">الدواء: </span><strong>${r.medication || '—'}</strong>
            </div>
            <small class="text-gray">${r.date || '—'}${r.vet_name ? ' | د. ' + r.vet_name : ''}</small>
          </div>
          <div class="d-flex gap-1 flex-shrink-0">
            ${r.status === 'active' && canEdit
              ? `<button class="action-btn primary sm" onclick="event.stopPropagation();completeHealthRecord('${r._id}')"><i class="bi bi-check-lg"></i></button>`
              : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="wonder-card mb-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold mb-0"><i class="bi bi-heart-pulse-fill accent-text me-2"></i>السجل الصحي
          <span class="text-gray" style="font-size:.8em">(${ar(_health.length)})</span>
        </h6>
        <div class="d-flex gap-2">
          ${canEdit && isAlive ? `<button class="action-btn primary sm" onclick="openAddHealth()"><i class="bi bi-plus-lg"></i> سجل جديد</button>` : ''}
          ${_health.length ? `<a href="health.html" class="action-btn sm"><i class="bi bi-arrow-left"></i> كل السجلات</a>` : ''}
        </div>
      </div>
      ${_health.length
        ? rows + (_health.length > 5 ? `<div class="text-center mt-2"><small class="text-gray">و ${ar(_health.length - 5)} سجل أقدم — <a href="health.html" style="color:var(--orange)">عرض الكل</a></small></div>` : '')
        : `<div class="empty-state" style="padding:20px 0"><i class="bi bi-heart-pulse"></i><p>لا توجد سجلات صحية</p>${canEdit && isAlive ? `<button class="action-btn primary" onclick="openAddHealth()"><i class="bi bi-plus-lg"></i> إضافة سجل</button>` : ''}</div>`
      }
    </div>`;
}

// ── Breeding Section ──────────────────────────────────────
function renderBreedingSection(a) {
  const isFemale = a.gender === 'female';
  const isAlive  = a.status !== 'dead';

  const statusCfg = {
    pregnant: { c: 'var(--blue)',   l: 'حامل',          cls: 'badge-blue'   },
    born:     { c: 'var(--green)',  l: 'ولدت',          cls: 'badge-tarbiya' },
    failed:   { c: 'var(--red)',    l: 'فشل / إجهاض',  cls: 'badge-danger'  },
    pending:  { c: 'var(--orange)', l: 'انتظار',        cls: 'badge-yellow'  },
  };

  const rows = _breeding.slice(0, 5).map(r => {
    const sc  = statusCfg[r.status] || statusCfg.pending;
    const d   = r.expected_birth ? Math.ceil((new Date(r.expected_birth) - new Date()) / 86400000) : null;
    const role = isFemale ? `الفحل: <strong>${r.male_tag || r.male_breed || '—'}</strong>` : `الأم: <strong>${r.female_tag || r.female_breed || '—'}</strong>`;
    return `
      <div class="record-card">
        <div class="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div class="flex-grow-1">
            <div class="d-flex gap-2 flex-wrap mb-1">
              <span class="type-badge ${sc.cls}">${sc.l}</span>
              ${r.offspring_count >= 2 ? '<span class="type-badge badge-purple">توائم</span>' : ''}
            </div>
            <div style="font-size:.85rem;color:var(--text-sub)">${role}</div>
            <small class="text-gray">
              التقريع: ${r.mating_date || '—'}
              ${r.expected_birth ? ` | الولادة المتوقعة: ${r.expected_birth}` +
                (r.status === 'pregnant' && d !== null
                  ? ` <span style="color:${d <= 0 ? 'var(--red)' : d <= 7 ? 'var(--orange)' : 'var(--gray)'}">
                      (${d === 0 ? 'اليوم!' : d < 0 ? 'تأخرت!' : 'بعد ' + ar(d) + ' يوم'})
                    </span>` : '')
                : ''}
              ${r.status === 'born' && r.offspring_count ? ` | المواليد: ${ar(r.offspring_count)}` : ''}
            </small>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="wonder-card mb-3">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="fw-bold mb-0"><i class="bi bi-diagram-2-fill accent-text me-2"></i>سجلات التكاثر
          <span class="text-gray" style="font-size:.8em">(${ar(_breeding.length)})</span>
        </h6>
        <a href="breeding.html" class="action-btn sm"><i class="bi bi-arrow-left"></i> التكاثر</a>
      </div>
      ${_breeding.length
        ? rows + (_breeding.length > 5 ? `<div class="text-center mt-2"><small class="text-gray">و ${ar(_breeding.length - 5)} سجل أقدم</small></div>` : '')
        : `<div class="empty-state" style="padding:20px 0"><i class="bi bi-diagram-2"></i><p>لا توجد سجلات تكاثر</p></div>`
      }
    </div>`;
}

// ── Weight Modal ──────────────────────────────────────────
window.openWeightModal = function (id) {
  const existing = id ? _weights.find(w => w._id === id) : null;
  showModal(`
    <div class="farm-modal" onclick="event.stopPropagation()">
      <h4><i class="bi bi-speedometer2 accent-text"></i> ${existing ? 'تعديل' : 'تسجيل'} وزن جديد</h4>
      <div class="row g-2">
        <div class="col-6">
          <label>الوزن (كجم) *</label>
          <input type="number" class="field" id="w-weight" step="0.1" min="0.5" max="500"
            value="${existing ? existing.weight : ''}" placeholder="45.5">
        </div>
        <div class="col-6">
          <label>التاريخ *</label>
          <input type="date" class="field" id="w-date" value="${existing ? existing.date : todayStr()}">
        </div>
      </div>
      <label>ملاحظات</label>
      <input class="field" id="w-notes" value="${existing ? (existing.notes || '') : ''}" placeholder="اختياري">
      <div class="d-flex gap-2 justify-content-end mt-3">
        <button class="action-btn" onclick="closeModal()">إلغاء</button>
        <button class="action-btn primary" onclick="submitWeight('${id || ''}')">
          <i class="bi bi-check-lg"></i> حفظ
        </button>
      </div>
    </div>`);
};

window.submitWeight = async function (editId) {
  const w = parseFloat(document.getElementById('w-weight').value);
  const d = document.getElementById('w-date').value;
  if (!w || w <= 0 || w > 500) { toast('يرجى إدخال وزن صحيح', 'error'); return; }
  if (!d) { toast('يرجى تحديد التاريخ', 'error'); return; }

  const u = getUser();
  const data = {
    animal_id:    _animalId,
    animal_tag:   _animal.tag || '',
    animal_breed: _animal.breed || '',
    weight:       w,
    date:         d,
    notes:        document.getElementById('w-notes').value.trim() || null,
    recorded_by:  u ? (u.name || u.email) : '—',
  };

  closeModal();
  toast('جاري الحفظ...', 'info');

  try {
    if (editId) {
      await fbPatch('weight_log', editId, data);
    } else {
      await fbPost('weight_log', data);
      // Also update the animal's current weight
      await fbPatch('animals', _animalId, { current_weight: w, weight_updated: d });
    }
    await logActivity('add', 'weight_log', `تسجيل وزن ${ar(w)} كجم للحيوان ${_animal.tag || _animal.breed}`);
    toast('تم الحفظ');
    fbCacheInvalidate('weight_log');
    fbCacheInvalidate('animals');
    const [animals, weightAll] = await Promise.all([fbGet('animals', true), fbGet('weight_log', true).catch(() => [])]);
    _animal = (animals || []).find(a => a._id === _animalId);
    const tag = _animal.tag || '';
    _weights = (weightAll || []).filter(w => w.animal_id === _animalId || w.animal_tag === tag)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    renderAnimalDetail(document.getElementById('content'), getSettings());
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

window.deleteWeight = async function (id) {
  if (!confirm('حذف هذا القياس؟')) return;
  try {
    await fbDelete('weight_log', id);
    toast('تم الحذف');
    _weights = _weights.filter(w => w._id !== id);
    renderAnimalDetail(document.getElementById('content'), getSettings());
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

// ── Health quick-add ──────────────────────────────────────
window.openAddHealth = function () {
  const s    = getSettings();
  const barns = ['', 'ج١ع١', 'ج١ع٢', 'ج٢ع١', 'ج٢ع٢', 'ج٣ع١', 'ج٣ع٢', 'ج٤ع١', 'ج٤ع٢', 'ج٥ع١', 'ج٥ع٢'];
  const a    = _animal;

  showModal(`
    <div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px">
      <h4><i class="bi bi-heart-pulse-fill accent-text"></i> إضافة سجل صحي</h4>
      <div class="mb-2 p-2" style="background:var(--bg-hover);border-radius:8px;font-size:.82rem">
        <i class="bi bi-info-circle me-1 blue-text"></i>
        الحيوان: <strong>${a.breed} ${a.tag ? '#' + a.tag : ''}</strong>
      </div>
      <div class="row g-2">
        <div class="col-6">
          <label>تاريخ العلاج *</label>
          <input type="date" class="field" id="qh-date" value="${todayStr()}">
        </div>
        <div class="col-6">
          <label>الجمالون/العنبر</label>
          <select class="field" id="qh-barn">
            ${barns.map(b => `<option value="${b}" ${a.barn === b ? 'selected' : ''}>${b || '— غير محدد —'}</option>`).join('')}
          </select>
        </div>
      </div>
      <label>التشخيص *</label>
      <input class="field" id="qh-diag" placeholder="التشخيص أو الحالة">
      <div class="row g-2">
        <div class="col-6">
          <label>الدواء *</label>
          <input class="field" id="qh-med" placeholder="اسم الدواء">
        </div>
        <div class="col-6">
          <label>الجرعة</label>
          <input class="field" id="qh-dose" placeholder="5 مل">
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6">
          <label>نهاية العلاج</label>
          <input type="date" class="field" id="qh-tend" onchange="qhCalcWithdrawal()">
        </div>
        <div class="col-6">
          <label>أيام تأثير العلاج</label>
          <input type="number" class="field" id="qh-wdays" value="0" min="0" onchange="qhCalcWithdrawal()">
        </div>
      </div>
      <div id="qh-wshow" style="display:none;background:rgba(244,67,54,.06);border:1px solid rgba(244,67,54,.25);border-radius:8px;padding:8px 12px;margin-top:4px;font-size:.8rem;color:var(--red)">
        ⚠️ لا يجوز البيع أو الذبح قبل: <strong id="qh-wdate"></strong>
      </div>
      <label>اسم الطبيب</label>
      <input class="field" id="qh-vet" placeholder="د. اسم الطبيب">
      <label>ملاحظات</label>
      <textarea class="field" id="qh-notes" rows="2" placeholder="ملاحظات إضافية"></textarea>
      <div class="d-flex gap-2 justify-content-end mt-3">
        <button class="action-btn" onclick="closeModal()">إلغاء</button>
        <button class="action-btn primary" onclick="submitHealthRecord()"><i class="bi bi-check-lg"></i> حفظ</button>
      </div>
    </div>`);
};

window.qhCalcWithdrawal = function () {
  const tend  = document.getElementById('qh-tend').value;
  const wdays = +document.getElementById('qh-wdays').value || 0;
  if (tend && wdays > 0) {
    const dt = new Date(tend); dt.setDate(dt.getDate() + wdays);
    const we = dt.toISOString().slice(0, 10);
    document.getElementById('qh-wdate').textContent = we;
    document.getElementById('qh-wshow').style.display = 'block';
  } else {
    document.getElementById('qh-wshow').style.display = 'none';
  }
};

window.submitHealthRecord = async function () {
  const diag = document.getElementById('qh-diag').value.trim();
  const med  = document.getElementById('qh-med').value.trim();
  if (!diag || !med) { toast('يرجى إدخال التشخيص والدواء', 'error'); return; }

  const tend  = document.getElementById('qh-tend').value;
  const wdays = +document.getElementById('qh-wdays').value || 0;
  let withdrawal_end = '';
  if (tend && wdays > 0) {
    const dt = new Date(tend); dt.setDate(dt.getDate() + wdays);
    withdrawal_end = dt.toISOString().slice(0, 10);
  }

  const a = _animal;
  const data = {
    animal_id:      _animalId,
    animal_tag:     a.tag || '',
    animal_breed:   a.breed || '',
    animal_species: a.species || 'goat',
    barn:           document.getElementById('qh-barn').value,
    date:           document.getElementById('qh-date').value,
    vet_name:       document.getElementById('qh-vet').value.trim() || null,
    diagnosis:      diag,
    medication:     med,
    dosage:         document.getElementById('qh-dose').value.trim(),
    withdrawal_days: wdays,
    treatment_end:  tend || null,
    withdrawal_end: withdrawal_end || null,
    status:         'active',
    notes:          document.getElementById('qh-notes').value.trim() || null,
  };

  closeModal();
  toast('جاري الحفظ...', 'info');
  try {
    await fbPost('health', data);
    await logActivity('add', 'health', `سجل صحي: ${diag} | ${med} للحيوان ${a.tag || a.breed}`);
    toast('تم الحفظ');
    fbCacheInvalidate('health');
    _health = (await fbGet('health', true) || [])
      .filter(r => r.animal_tag === (a.tag || '') || r.animal_id === _animalId)
      .sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    renderAnimalDetail(document.getElementById('content'), getSettings());
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

window.showHealthDetail = function (id) {
  const r = _health.find(x => x._id === id); if (!r) return;
  const today = todayStr();
  const inW   = r.withdrawal_end && r.withdrawal_end >= today;
  const dLeft = inW ? Math.max(0, Math.ceil((new Date(r.withdrawal_end) - new Date()) / 86400000)) : 0;
  showModal(`
    <div class="farm-modal" onclick="event.stopPropagation()" style="max-width:500px">
      <h4><i class="bi bi-heart-pulse-fill accent-text"></i> تفاصيل السجل الصحي</h4>
      <div class="d-flex gap-2 mb-3 flex-wrap">
        <span class="type-badge ${r.status === 'active' ? 'badge-tasmeen' : 'badge-tarbiya'}">
          ${r.status === 'active' ? 'قيد العلاج' : 'مكتمل'}
        </span>
        ${inW ? `<span class="type-badge badge-danger">فترة تأثير علاج — متبقي ${ar(dLeft)} يوم</span>` : ''}
      </div>
      ${[
        ['التشخيص', r.diagnosis || '—'],
        ['الدواء',  r.medication || '—'],
        ['الجرعة',  r.dosage || '—'],
        ['تاريخ العلاج', r.date || '—'],
        ['نهاية العلاج', r.treatment_end || '—'],
        ['أيام التأثير', r.withdrawal_days ? ar(r.withdrawal_days) + ' يوم' : '—'],
        ['انتهاء التأثير', r.withdrawal_end || '—'],
        ['الطبيب', r.vet_name || '—'],
        ['ملاحظات', r.notes || '—'],
      ].map(([k, v]) => `<div class="info-row"><div style="min-width:110px"><span class="info-label">${k}</span></div><span class="info-value">${v}</span></div>`).join('')}
      ${inW ? `<div class="mt-3 p-3 text-center" style="background:rgba(244,67,54,.07);border-radius:10px;border:1px solid rgba(244,67,54,.25)">
        <div style="font-size:1.8rem;font-weight:800;color:var(--red)">${ar(dLeft)}</div>
        <small class="text-gray">يوم متبقي حتى انتهاء التأثير (${r.withdrawal_end})</small>
      </div>` : ''}
      <div class="d-flex gap-2 justify-content-end mt-3">
        <button class="action-btn" onclick="closeModal()">إغلاق</button>
        ${r.status === 'active' && can('health')
          ? `<button class="action-btn primary" onclick="closeModal();completeHealthRecord('${r._id}')"><i class="bi bi-check-lg"></i> إكمال العلاج</button>`
          : ''}
      </div>
    </div>`);
};

window.completeHealthRecord = async function (id) {
  try {
    await fbPatch('health', id, { status: 'completed' });
    await logActivity('edit', 'health', 'إكمال علاج');
    toast('تم إكمال العلاج');
    fbCacheInvalidate('health');
    const a = _animal;
    _health = (await fbGet('health', true) || [])
      .filter(r => r.animal_tag === (a.tag || '') || r.animal_id === _animalId)
      .sort((x, y) => (y.date || '').localeCompare(x.date || ''));
    renderAnimalDetail(document.getElementById('content'), getSettings());
  } catch (e) {
    toast('فشل: ' + e.message, 'error');
  }
};

// ── Edit Animal ───────────────────────────────────────────
window.openEditAnimal = function () {
  const s     = getSettings();
  const a     = _animal;
  const barns = ['', 'ج١ع١', 'ج١ع٢', 'ج٢ع١', 'ج٢ع٢', 'ج٣ع١', 'ج٣ع٢', 'ج٤ع١', 'ج٤ع٢', 'ج٥ع١', 'ج٥ع٢'];
  const breeds = a.species === 'sheep' ? s.sheepBreeds : s.goatBreeds;

  showModal(`
    <div class="farm-modal" onclick="event.stopPropagation()" style="max-width:480px">
      <h4><i class="bi bi-pencil-fill accent-text"></i> تعديل بيانات الحيوان</h4>
      <div class="row g-2">
        <div class="col-6">
          <label>رقم الترقيم</label>
          <input class="field" id="ea-tag" value="${a.tag || ''}" placeholder="A-001">
        </div>
        <div class="col-6">
          <label>السلالة</label>
          <select class="field" id="ea-breed">
            ${breeds.map(b => `<option value="${b}" ${a.breed === b ? 'selected' : ''}>${b}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6">
          <label>الغرض</label>
          <select class="field" id="ea-purpose">
            <option value="tarbiya" ${a.purpose === 'tarbiya' ? 'selected' : ''}>تربية</option>
            <option value="tasmeen" ${a.purpose === 'tasmeen' ? 'selected' : ''}>تسمين</option>
            <option value="birth" ${a.purpose === 'birth' ? 'selected' : ''}>مواليد</option>
          </select>
        </div>
        <div class="col-6">
          <label>الجمالون / العنبر</label>
          <select class="field" id="ea-barn">
            ${barns.map(b => `<option value="${b}" ${a.barn === b ? 'selected' : ''}>${b || '— غير محدد —'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="row g-2">
        <div class="col-6">
          <label>تاريخ الميلاد</label>
          <input type="date" class="field" id="ea-birth" value="${a.birth_date || ''}">
        </div>
        <div class="col-6">
          <label>الوزن الحالي (كجم)</label>
          <input type="number" class="field" id="ea-weight" step="0.1" min="0"
            value="${a.current_weight || a.weight || ''}" placeholder="45.0">
        </div>
      </div>
      <label>ملاحظات</label>
      <textarea class="field" id="ea-notes" rows="2">${a.notes || ''}</textarea>
      <div class="d-flex gap-2 justify-content-end mt-3">
        <button class="action-btn" onclick="closeModal()">إلغاء</button>
        <button class="action-btn primary" onclick="submitEditAnimal()"><i class="bi bi-check-lg"></i> حفظ التعديلات</button>
      </div>
    </div>`);
};

window.submitEditAnimal = async function () {
  const patch = {
    tag:            document.getElementById('ea-tag').value.trim(),
    breed:          document.getElementById('ea-breed').value,
    purpose:        document.getElementById('ea-purpose').value,
    barn:           document.getElementById('ea-barn').value,
    birth_date:     document.getElementById('ea-birth').value || null,
    current_weight: parseFloat(document.getElementById('ea-weight').value) || null,
    notes:          document.getElementById('ea-notes').value.trim() || null,
    updated_at:     todayStr(),
  };

  closeModal();
  toast('جاري الحفظ...', 'info');
  try {
    await fbPatch('animals', _animalId, patch);
    await logActivity('edit', 'animals', `تعديل بيانات الحيوان ${patch.tag || _animal.breed}`);
    toast('تم الحفظ');
    fbCacheInvalidate('animals');
    const animals = await fbGet('animals', true);
    _animal = (animals || []).find(a => a._id === _animalId);
    renderAnimalDetail(document.getElementById('content'), getSettings());
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

// ── Mark Dead ─────────────────────────────────────────────
window.confirmMarkDead = function () {
  const a = _animal;
  showModal(`
    <div class="farm-modal" onclick="event.stopPropagation()" style="max-width:400px;border-color:rgba(244,67,54,.4)">
      <h4 class="red-text"><i class="bi bi-x-octagon-fill me-2"></i>تسجيل نفوق</h4>
      <div class="mb-3 text-gray" style="font-size:.88rem">
        الحيوان: <strong style="color:var(--text)">${a.breed} ${a.tag ? '#' + a.tag : ''}</strong>
      </div>
      <label>تاريخ النفوق *</label>
      <input type="date" class="field" id="dd-date" value="${todayStr()}">
      <label>السبب</label>
      <input class="field" id="dd-cause" placeholder="سبب النفوق (مرض، حادثة...)">
      <label>ملاحظات</label>
      <textarea class="field" id="dd-notes" rows="2"></textarea>
      <div class="d-flex gap-2 justify-content-end mt-3">
        <button class="action-btn" onclick="closeModal()">إلغاء</button>
        <button class="action-btn danger" onclick="submitMarkDead()"><i class="bi bi-x-octagon"></i> تأكيد النفوق</button>
      </div>
    </div>`);
};

window.submitMarkDead = async function () {
  const dDate = document.getElementById('dd-date').value;
  if (!dDate) { toast('يرجى تحديد تاريخ النفوق', 'error'); return; }

  const patch = {
    status:      'dead',
    died_at:     dDate,
    death_cause: document.getElementById('dd-cause').value.trim() || null,
    death_notes: document.getElementById('dd-notes').value.trim() || null,
  };

  closeModal();
  toast('جاري الحفظ...', 'info');
  try {
    await fbPatch('animals', _animalId, patch);
    await logActivity('edit', 'animals', `تسجيل نفوق: ${_animal.breed} ${_animal.tag || ''}`);
    toast('تم تسجيل النفوق');
    fbCacheInvalidate('animals');
    const animals = await fbGet('animals', true);
    _animal = (animals || []).find(a => a._id === _animalId);
    renderAnimalDetail(document.getElementById('content'), getSettings());
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

// ── Helpers ───────────────────────────────────────────────
function calcAge(birthDate) {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  const now   = new Date();
  const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (months < 1)  return 'أقل من شهر';
  if (months < 12) return ar(months) + ' شهر';
  const years = Math.floor(months / 12);
  const rem   = months % 12;
  return ar(years) + ' سنة' + (rem > 0 ? ' و' + ar(rem) + ' شهر' : '');
}

function emptyState(icon, msg, actions = '') {
  return `<div class="empty-state"><i class="bi ${icon}"></i><p>${msg}</p>${actions}</div>`;
}
