'use strict';

// ── State ────────────────────────────────────────────────
var _allAnimals  = [];
var _allBreeding = [];
var _currentId   = null;

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent = s.farmName;
  renderNavbarV2('pedigree.html');
  renderPageHeader(
    '<i class="bi bi-diagram-3-fill accent-text"></i> شجرة النسب',
    'تتبع نسب الحيوانات — الأجداد والأبناء',
    ''
  );

  await loadData();

  // Check URL param for direct animal lookup
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (id) {
    const animal = _allAnimals.find(a => a._id === id);
    if (animal) _currentId = id;
  }

  render();
});

async function loadData() {
  const el = document.getElementById('content');
  renderLoading(el);
  try {
    const [animals, breeding] = await Promise.all([
      fbGet('animals'),
      fbGet('breeding').catch(() => []),
    ]);
    _allAnimals  = animals || [];
    _allBreeding = breeding || [];
  } catch (e) {
    toast('خطأ في التحميل: ' + e.message, 'error');
  }
}

// ══════════════════════════════════════════
//  Main Render
// ══════════════════════════════════════════
function render() {
  const el = document.getElementById('content');
  const current = _currentId ? _allAnimals.find(a => a._id === _currentId) : null;

  el.innerHTML = `
  <!-- Search Card -->
  <div class="ped-search-card">
    <div class="d-flex align-items-center gap-3 mb-3 flex-wrap">
      <h6 class="fw-bold mb-0"><i class="bi bi-search accent-text me-2" aria-hidden="true"></i>اختر حيواناً لعرض نسبه</h6>
      <div class="ms-md-auto text-gray" style="font-size:.8rem">${ar(_allAnimals.length)} حيوان في القاعدة</div>
    </div>

    <div class="row g-2">
      <div class="col-md-8">
        <label for="ped-search" class="text-gray" style="font-size:.78rem">ابحث بالترقيم أو السلالة</label>
        <input class="field" id="ped-search" placeholder="اكتب رقم الترقيم أو السلالة..." oninput="filterPedSearch(this.value)" autocomplete="off" aria-label="بحث عن حيوان">
      </div>
      <div class="col-md-4">
        <label for="ped-select" class="text-gray" style="font-size:.78rem">أو اختر من القائمة</label>
        <select class="field" id="ped-select" onchange="selectAnimal(this.value)" aria-label="قائمة الحيوانات">
          <option value="">— اختر حيواناً —</option>
          ${_allAnimals
            .filter(a => a.tag || a.breed)
            .slice(0, 250)
            .map(a => `<option value="${a._id}"${a._id === _currentId ? ' selected' : ''}>${a.tag ? '#' + a.tag + ' • ' : ''}${a.breed || '—'} ${a.gender === 'female' ? '♀' : '♂'}</option>`)
            .join('')}
        </select>
      </div>
    </div>

    <div id="ped-search-results" style="margin-top:10px"></div>
  </div>

  <!-- Tree -->
  ${current ? renderTree(current) : renderEmpty()}`;
}

function renderEmpty() {
  return `
  <div class="ped-tree">
    <div class="empty-tree" role="status">
      <i class="bi bi-diagram-3-fill" style="font-size:3rem;opacity:.2;display:block;margin-bottom:14px" aria-hidden="true"></i>
      <h6>اختر حيواناً من القائمة أعلاه</h6>
      <p style="font-size:.85rem">ستظهر شجرة نسبه: الأجداد، الوالدين، الأشقاء، والمواليد</p>
    </div>
  </div>`;
}

// ══════════════════════════════════════════
//  Tree Renderer
// ══════════════════════════════════════════
function renderTree(animal) {
  // Find parents
  const mother = findAnimalByTag(animal.mother_tag);
  const father = findAnimalByTag(animal.father_tag);

  // Find grandparents
  const motherMom = mother ? findAnimalByTag(mother.mother_tag) : null;
  const motherDad = mother ? findAnimalByTag(mother.father_tag) : null;
  const fatherMom = father ? findAnimalByTag(father.mother_tag) : null;
  const fatherDad = father ? findAnimalByTag(father.father_tag) : null;

  // Find siblings (same mother or father, exclude self)
  const siblings = animal.mother_tag
    ? _allAnimals.filter(a =>
        a._id !== animal._id &&
        a.mother_tag === animal.mother_tag &&
        a.status !== 'dead'
      ).slice(0, 6)
    : [];

  // Find offspring (animals where this animal is the parent)
  const offspring = _allAnimals.filter(a =>
    (animal.tag && (a.mother_tag === animal.tag || a.father_tag === animal.tag))
  );

  // Find grand-offspring
  const grandOffspring = [];
  offspring.forEach(o => {
    if (o.tag) {
      _allAnimals.filter(a => a.mother_tag === o.tag || a.father_tag === o.tag).forEach(g => {
        if (!grandOffspring.find(x => x._id === g._id)) grandOffspring.push(g);
      });
    }
  });

  return `
  <div class="ped-tree" role="region" aria-label="شجرة نسب الحيوان">
    <div class="ped-canvas">

      <!-- Generation 3: Grandparents -->
      ${(motherMom || motherDad || fatherMom || fatherDad) ? `
        <div class="text-center mb-2"><span class="ped-label">الجيل الثالث — الأجداد</span></div>
        <div class="ped-row">
          ${renderNode(fatherDad, 'جد للأب', 'male')}
          ${renderNode(fatherMom, 'جدة للأب', 'female')}
          ${renderNode(motherDad, 'جد للأم', 'male')}
          ${renderNode(motherMom, 'جدة للأم', 'female')}
        </div>
        <div class="ped-connector"><div class="ped-line"></div></div>
      ` : ''}

      <!-- Generation 2: Parents -->
      <div class="text-center mb-2"><span class="ped-label">الجيل الثاني — الوالدين</span></div>
      <div class="ped-row">
        ${renderNode(father, 'الأب', 'male')}
        ${renderNode(mother, 'الأم', 'female')}
      </div>
      <div class="ped-connector"><div class="ped-line"></div></div>

      <!-- Generation 1: The animal itself -->
      <div class="text-center mb-2"><span class="ped-label" style="background:var(--orange);color:#fff">الحيوان</span></div>
      <div class="ped-row">
        ${renderCenterNode(animal)}
      </div>

      <!-- Siblings -->
      ${siblings.length ? `
        <div class="ped-connector"><div class="ped-line"></div></div>
        <div class="text-center mb-2"><span class="ped-label">الأشقاء (نفس الأم)</span></div>
        <div class="ped-row">
          ${siblings.map(s => renderNode(s, s.purpose === 'birth' ? 'مولود' : '', s.gender)).join('')}
        </div>
      ` : ''}

      <!-- Offspring -->
      ${offspring.length ? `
        <div class="ped-connector"><div class="ped-line"></div></div>
        <div class="text-center mb-2"><span class="ped-label">المواليد (${ar(offspring.length)})</span></div>
        <div class="ped-row">
          ${offspring.slice(0, 8).map(o => renderNode(o, '', o.gender)).join('')}
          ${offspring.length > 8 ? `<div class="ped-node empty" aria-hidden="true"><div class="ped-icon">⋯</div><div class="ped-name">+${ar(offspring.length - 8)}</div></div>` : ''}
        </div>
        ${grandOffspring.length ? `
          <div class="ped-connector"><div class="ped-line"></div></div>
          <div class="text-center mb-2"><span class="ped-label">الأحفاد (${ar(grandOffspring.length)})</span></div>
          <div class="ped-row">
            ${grandOffspring.slice(0, 8).map(g => renderNode(g, '', g.gender)).join('')}
            ${grandOffspring.length > 8 ? `<div class="ped-node empty" aria-hidden="true"><div class="ped-icon">⋯</div><div class="ped-name">+${ar(grandOffspring.length - 8)}</div></div>` : ''}
          </div>
        ` : ''}
      ` : ''}

      ${!offspring.length && !mother && !father ? `
        <div class="empty-tree" style="padding:30px 0">
          <i class="bi bi-info-circle" style="font-size:2rem;opacity:.3" aria-hidden="true"></i>
          <p>لا توجد بيانات نسب لهذا الحيوان</p>
          <small class="text-gray">سجّل ولادات وحدد رقم الأم والأب لبناء الشجرة</small>
        </div>
      ` : ''}

    </div>
  </div>

  <!-- Stats Below -->
  ${animal ? renderStats(animal, offspring, grandOffspring, siblings, mother, father) : ''}`;
}

// ── Single node ──────────────────────────────────────────
function renderNode(animal, role, gender) {
  if (!animal) {
    return `<div class="ped-node empty" aria-label="${role||'—'} غير محدد">
      <div class="ped-icon" aria-hidden="true">${gender === 'female' ? '♀' : gender === 'male' ? '♂' : '?'}</div>
      <div class="ped-name">${role || '—'}</div>
      <div class="ped-meta">غير محدد</div>
    </div>`;
  }
  const cls = animal.gender === 'female' ? 'female' : 'male';
  const icon = animal.species === 'goat' ? '🐐' : '🐑';
  const ageStr = animal.birth_date ? calcAge(animal.birth_date) : '';
  return `<a href="pedigree.html?id=${animal._id}" class="ped-node ${cls}" aria-label="${animal.breed || ''} ${animal.tag || ''}">
    <div class="ped-icon" aria-hidden="true">${icon}</div>
    <div class="ped-name">${animal.tag ? '#' + animal.tag : (animal.breed || '—')}</div>
    <div class="ped-meta">${animal.breed || ''} ${animal.gender === 'female' ? '♀' : '♂'}</div>
    ${ageStr ? `<div class="ped-meta">${ageStr}</div>` : ''}
    ${role ? `<div class="ped-meta" style="color:var(--orange);font-weight:600">${role}</div>` : ''}
  </a>`;
}

function renderCenterNode(animal) {
  const icon = animal.species === 'goat' ? '🐐' : '🐑';
  const ageStr = animal.birth_date ? calcAge(animal.birth_date) : '';
  const statusBadgeHtml = (typeof statusBadge === 'function') ? statusBadge(animal.status || 'alive') : '';
  return `<div class="ped-node center" role="region" aria-label="الحيوان المحدد: ${animal.breed} ${animal.tag||''}">
    <div class="ped-icon" aria-hidden="true">${icon}</div>
    <div class="ped-name">${animal.tag ? '#' + animal.tag : (animal.breed || '—')}</div>
    <div class="ped-meta">${animal.breed || ''} ${animal.gender === 'female' ? '♀' : '♂'}</div>
    ${ageStr ? `<div class="ped-meta">${ageStr}</div>` : ''}
    <div style="margin-top:6px">${statusBadgeHtml}</div>
    <a href="animal-detail.html?id=${animal._id}" class="action-btn sm primary" style="margin-top:6px;padding:3px 10px;font-size:.72rem" aria-label="عرض البروفايل الكامل"><i class="bi bi-eye-fill" aria-hidden="true"></i> البروفايل</a>
  </div>`;
}

// ── Stats footer ─────────────────────────────────────────
function renderStats(animal, offspring, grandOffspring, siblings, mother, father) {
  return `
  <div class="row g-3 mt-4">
    ${[
      { l: 'الوالدين',  v: (mother ? 1 : 0) + (father ? 1 : 0), c: 'var(--orange)', i: 'bi-people-fill' },
      { l: 'الأشقاء',   v: siblings.length, c: 'var(--blue)',   i: 'bi-people-fill' },
      { l: 'المواليد',  v: offspring.length, c: 'var(--green)',  i: 'bi-heart-fill' },
      { l: 'الأحفاد',   v: grandOffspring.length, c: 'var(--purple)', i: 'bi-diagram-3-fill' },
    ].map(k => `
      <div class="col-6 col-md-3">
        <div class="summary-card" role="region" aria-label="${k.l}: ${k.v}">
          <i class="bi ${k.i} d-block mb-2" style="color:${k.c};font-size:1.3rem" aria-hidden="true"></i>
          <div class="summary-number" style="color:${k.c}">${ar(k.v)}</div>
          <small class="text-gray">${k.l}</small>
        </div>
      </div>`).join('')}
  </div>`;
}

// ── Helpers ──────────────────────────────────────────────
function findAnimalByTag(tag) {
  if (!tag) return null;
  return _allAnimals.find(a => a.tag === tag) || null;
}

function calcAge(birthDate) {
  if (!birthDate) return '';
  const days = Math.floor((new Date() - new Date(birthDate)) / 86400000);
  if (days < 30)  return ar(days) + ' يوم';
  if (days < 365) return ar(Math.round(days / 30)) + ' شهر';
  return ar(Math.round(days / 365)) + ' سنة';
}

// ── Search & Select ──────────────────────────────────────
window.selectAnimal = function(id) {
  if (!id) { _currentId = null; render(); return; }
  _currentId = id;
  history.replaceState(null, '', 'pedigree.html?id=' + id);
  render();
};

window.filterPedSearch = function(q) {
  const resEl = document.getElementById('ped-search-results');
  if (!resEl) return;
  q = q.trim().toLowerCase();
  if (q.length < 2) { resEl.innerHTML = ''; return; }
  const matches = _allAnimals.filter(a =>
    (a.tag || '').toLowerCase().includes(q) ||
    (a.breed || '').includes(q)
  ).slice(0, 8);
  if (!matches.length) {
    resEl.innerHTML = '<small class="text-gray">لا توجد نتائج</small>';
    return;
  }
  resEl.innerHTML = '<div class="d-flex flex-wrap gap-2">' +
    matches.map(a => `<button class="action-btn sm" onclick="selectAnimal('${a._id}')" style="font-size:.78rem" aria-label="اختيار ${a.breed} ${a.tag||''}">
      ${a.species === 'goat' ? '🐐' : '🐑'} ${a.tag ? '#'+a.tag+' • ' : ''}${a.breed||'—'} ${a.gender === 'female' ? '♀' : '♂'}
    </button>`).join('') +
  '</div>';
};
