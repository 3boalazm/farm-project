'use strict';

// ── State ─────────────────────────────────────────────────────
var _animals = [];
var _charts  = {};

// ── Pattern generator — core of the visual distinction ────────
function makePattern(chartCtx, type, baseColor) {
  var c = document.createElement('canvas');
  c.width = 12; c.height = 12;
  var p = c.getContext('2d');
  p.clearRect(0, 0, 12, 12);
  p.strokeStyle = baseColor;
  p.fillStyle   = baseColor;
  p.lineWidth   = 1.8;

  switch (type) {
    case 'diagonal':   // Male newborns
      p.beginPath(); p.moveTo(0,12); p.lineTo(12,0); p.stroke();
      break;
    case 'diagonal2':  // Female newborns
      p.beginPath(); p.moveTo(0,0); p.lineTo(12,12); p.stroke();
      break;
    case 'cross':      // Mixed / totals
      p.beginPath(); p.moveTo(6,0); p.lineTo(6,12);
      p.moveTo(0,6); p.lineTo(12,6); p.stroke();
      break;
    case 'dots':       // Weaning stage
      p.beginPath(); p.arc(3,3,2,0,Math.PI*2); p.fill();
      p.beginPath(); p.arc(9,9,2,0,Math.PI*2); p.fill();
      break;
    case 'zigzag':     // Post-weaning
      p.beginPath();
      p.moveTo(0,8); p.lineTo(4,4); p.lineTo(8,8); p.lineTo(12,4);
      p.stroke();
      break;
    case 'wave':       // Monthly trend fill
      p.beginPath();
      p.moveTo(0,10);
      p.bezierCurveTo(3,4,9,4,12,10);
      p.stroke();
      break;
    case 'bricks':     // Breed totals
      p.strokeRect(0,0,6,6);
      p.strokeRect(6,6,6,6);
      break;
    default:
      p.beginPath(); p.moveTo(0,12); p.lineTo(12,0); p.stroke();
  }
  return chartCtx.createPattern(c, 'repeat');
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  if (!requireAuth()) return;
  var s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent = s.farmName;
  renderNavbar('births.html');
  renderPageHeader(
    '<i class="bi bi-stars" style="color:var(--yellow)"></i> المواليد',
    'إحصائيات ومتابعة حصرية للمواليد — منفصلة عن القطيع الكبير',
    can('animals') ?
      '<button class="action-btn primary" onclick="openUnifiedBirthModal(\'goat\')" aria-label="تسجيل مولود ماعز"><i class="bi bi-plus-lg"></i> مولود ماعز</button>' +
      '<button class="action-btn" onclick="openUnifiedBirthModal(\'sheep\')" style="background:rgba(33,150,243,.1);border-color:rgba(33,150,243,.3);color:var(--blue)" aria-label="تسجيل مولود أغنام"><i class="bi bi-plus-lg"></i> مولود أغنام</button>'
      : ''
  );
  addFAB('تسجيل مولود جديد', function() { openUnifiedBirthModal('goat'); }, 'bi-stars');

  try {
    _animals = await fbGet('animals');
  } catch(e) {
    document.getElementById('content').innerHTML =
      '<div class="empty-state"><i class="bi bi-wifi-off"></i><p>خطأ: ' + e.message + '</p></div>';
    return;
  }
  renderBirthsPage(s);
});

// ── Core filter — births ONLY ─────────────────────────────────
function getBirths(sp) {
  return _animals.filter(function(a) {
    return a.status === 'alive' && (sp ? a.species === sp : true) &&
           (a.purpose === 'birth' || (a.purpose === 'tarbiya' && a.mother_tag));
  });
}

function calcAgeDays(birthDate) {
  if (!birthDate) return null;
  return Math.floor((new Date() - new Date(birthDate)) / 86400000);
}

function ageGroup(days) {
  if (days === null) return 'unknown';
  if (days <= 30)  return 'newborn';   // 0-30: مولود جديد
  if (days <= 60)  return 'weaning';   // 31-60: فطام وشيك
  if (days <= 120) return 'juvenile';  // 61-120: صغير
  return 'ready';                       // 120+: جاهز للنقل للقطيع
}

// ══════════════════════════════════════════════════════════════
//  MAIN RENDER
// ══════════════════════════════════════════════════════════════
function renderBirthsPage(s) {
  var el = document.getElementById('content');

  var allBirths   = getBirths(null);
  var goatBirths  = getBirths('goat');
  var sheepBirths = getBirths('sheep');

  if (!allBirths.length) {
    el.innerHTML = '<div class="empty-state" role="status">' +
      '<i class="bi bi-stars" aria-hidden="true"></i>' +
      '<p>لا توجد مواليد مسجّلة حتى الآن</p>' +
      '<div class="d-flex gap-2 justify-content-center flex-wrap">' +
        '<button class="action-btn primary" onclick="openUnifiedBirthModal(\'goat\')"><i class="bi bi-plus-lg"></i> مولود ماعز</button>' +
        '<button class="action-btn" onclick="openUnifiedBirthModal(\'sheep\')"><i class="bi bi-plus-lg"></i> مولود أغنام</button>' +
      '</div></div>';
    return;
  }

  // ── Age grouping ──────────────────────────────────────────
  var withAge = allBirths.map(function(a) {
    var days = calcAgeDays(a.birth_date);
    return Object.assign({}, a, { ageDays: days, ageGrp: ageGroup(days) });
  });

  var newborns  = withAge.filter(function(a) { return a.ageGrp === 'newborn'; });
  var weaning   = withAge.filter(function(a) { return a.ageGrp === 'weaning'; });
  var juvenile  = withAge.filter(function(a) { return a.ageGrp === 'juvenile'; });
  var ready     = withAge.filter(function(a) { return a.ageGrp === 'ready'; });

  // ── Survival: any born this year ─────────────────────────
  var born = _animals.filter(function(a) {
    return (a.purpose === 'birth' || (a.mother_tag && a.purpose === 'tarbiya')) &&
           a.birth_date && a.birth_date >= new Date().getFullYear() + '-01-01';
  });
  var dead = _animals.filter(function(a) {
    return a.status === 'dead' && a.purpose === 'birth' &&
           a.birth_date && a.birth_date >= new Date().getFullYear() + '-01-01';
  });
  var survivalRate = born.length ? Math.round((born.length - dead.length) / born.length * 100) : 100;

  // ── Monthly births (last 6 months) ──────────────────────
  var monthly = {};
  var now = new Date();
  for (var mi = 5; mi >= 0; mi--) {
    var d = new Date(now.getFullYear(), now.getMonth() - mi, 1);
    monthly[d.toISOString().slice(0,7)] = { goat: 0, sheep: 0 };
  }
  allBirths.forEach(function(a) {
    var k = (a.birth_date||'').slice(0,7);
    if (monthly[k]) {
      monthly[k][a.species === 'goat' ? 'goat' : 'sheep']++;
    }
  });

  el.innerHTML =
    renderKPIs(allBirths, goatBirths, sheepBirths, newborns, weaning, survivalRate) +
    renderAgeGroups(newborns, weaning, juvenile, ready) +
    renderWeaningAlert(weaning) +
    '<div class="row g-4 mb-4">' +
      '<div class="col-md-5"><div class="wonder-card h-100">' +
        '<h6 class="fw-bold mb-3" id="breed-chart-title"><i class="bi bi-pie-chart-fill accent-text" aria-hidden="true"></i> توزيع المواليد بالسلالة <span class="type-badge badge-gray" style="font-size:.65rem">نمط مميز ≠ ألوان عادية</span></h6>' +
        '<div style="position:relative;height:260px"><canvas id="breed-chart" aria-labelledby="breed-chart-title" role="img"></canvas></div>' +
      '</div></div>' +
      '<div class="col-md-7"><div class="wonder-card h-100">' +
        '<h6 class="fw-bold mb-3" id="monthly-chart-title"><i class="bi bi-graph-up accent-text" aria-hidden="true"></i> المواليد الشهرية (6 أشهر)</h6>' +
        '<div style="position:relative;height:260px"><canvas id="monthly-chart" aria-labelledby="monthly-chart-title" role="img"></canvas></div>' +
      '</div></div>' +
    '</div>' +
    '<div class="row g-4 mb-4">' +
      '<div class="col-md-6"><div class="wonder-card h-100">' +
        '<h6 class="fw-bold mb-3" id="gender-chart-title"><i class="bi bi-gender-ambiguous accent-text" aria-hidden="true"></i> الذكور والإناث بالسلالة</h6>' +
        '<div style="position:relative;height:220px"><canvas id="gender-chart" aria-labelledby="gender-chart-title" role="img"></canvas></div>' +
      '</div></div>' +
      '<div class="col-md-6"><div class="wonder-card h-100">' +
        '<h6 class="fw-bold mb-3" id="age-chart-title"><i class="bi bi-bar-chart-steps accent-text" aria-hidden="true"></i> توزيع الفئات العمرية</h6>' +
        '<div style="position:relative;height:220px"><canvas id="age-chart" aria-labelledby="age-chart-title" role="img"></canvas></div>' +
      '</div></div>' +
    '</div>' +
    renderBreedCards(goatBirths, sheepBirths, s);

  // Draw charts after DOM is ready
  setTimeout(function() {
    drawCharts(allBirths, goatBirths, sheepBirths, monthly, newborns, weaning, juvenile, ready, s);
  }, 80);
}

// ── KPI Row — births-exclusive ────────────────────────────────
function renderKPIs(all, goat, sheep, newborns, weaning, survival) {
  var males   = all.filter(function(a) { return a.gender === 'male'; }).length;
  var females = all.filter(function(a) { return a.gender === 'female'; }).length;
  return '<div class="row g-3 mb-4" role="region" aria-label="إحصائيات المواليد">' +
    [
      { l:'إجمالي المواليد',    v: ar(all.length),     c:'var(--yellow)', i:'bi-stars' },
      { l:'مواليد الماعز 🐐',   v: ar(goat.length),    c:'var(--green)',  i:'bi-tropical-storm' },
      { l:'مواليد الأغنام 🐑',  v: ar(sheep.length),   c:'var(--blue)',   i:'bi-cloud-fill' },
      { l:'ذكور / إناث',        v: ar(males)+' ♂ / '+ar(females)+' ♀', c:'var(--orange)', i:'bi-gender-ambiguous' },
      { l:'مواليد جديدة (30 يوم)', v: ar(newborns.length), c:'var(--purple)', i:'bi-heart-fill' },
      { l:'فطام وشيك',          v: ar(weaning.length), c: weaning.length > 5 ? 'var(--red)' : 'var(--gray)', i:'bi-hourglass-split' },
      { l:'معدل البقاء',        v: ar(survival)+'٪',  c: survival >= 90 ? 'var(--green)' : 'var(--orange)', i:'bi-shield-fill' },
    ].map(function(k) {
      return '<div class="col-6 col-md-3 col-lg">' +
        '<div class="summary-card" role="region" aria-label="' + k.l + '">' +
          '<i class="bi ' + k.i + ' d-block mb-2" style="color:' + k.c + ';font-size:1.3rem" aria-hidden="true"></i>' +
          '<div style="font-size:.88rem;font-weight:700;color:' + k.c + '">' + k.v + '</div>' +
          '<small class="text-gray">' + k.l + '</small>' +
        '</div></div>';
    }).join('') +
  '</div>';
}

// ── Age Groups Cards ──────────────────────────────────────────
function renderAgeGroups(newborns, weaning, juvenile, ready) {
  var groups = [
    { label: '🍼 مواليد جديدة',   sub: '0 — 30 يوم',   list: newborns, c: 'var(--yellow)', border: 'rgba(255,193,7,.35)' },
    { label: '🔄 فطام وشيك',      sub: '31 — 60 يوم',  list: weaning,  c: 'var(--orange)', border: 'rgba(255,107,53,.35)' },
    { label: '🐾 صغار',           sub: '61 — 120 يوم', list: juvenile, c: 'var(--blue)',   border: 'rgba(33,150,243,.35)' },
    { label: '✅ جاهز للقطيع',    sub: '120+ يوم',      list: ready,    c: 'var(--green)',  border: 'rgba(0,230,118,.35)' },
  ];
  return '<div class="wonder-card mb-4" role="region" aria-label="التوزيع العمري للمواليد">' +
    '<h6 class="fw-bold mb-3"><i class="bi bi-diagram-3-fill accent-text" aria-hidden="true"></i> الفئات العمرية — مواليد فقط</h6>' +
    '<div class="row g-3">' +
    groups.map(function(g) {
      var pct = (g.list.length / (newborns.length + weaning.length + juvenile.length + ready.length || 1) * 100).toFixed(0);
      return '<div class="col-6 col-md-3">' +
        '<div class="wonder-card" style="border-color:' + g.border + ';background:' + g.border.replace('.35',',.04') + ';text-align:center;padding:14px">' +
          '<div style="font-size:1.1rem;font-weight:800;color:' + g.c + '">' + ar(g.list.length) + '</div>' +
          '<div class="fw-bold" style="font-size:.82rem">' + g.label + '</div>' +
          '<small class="text-gray">' + g.sub + '</small>' +
          '<div class="finance-bar mt-2" style="height:6px">' +
            '<div class="finance-bar-fill" style="width:' + pct + '%;background:' + g.c + '"></div>' +
          '</div>' +
        '</div></div>';
    }).join('') +
    '</div></div>';
}

// ── Weaning alert ─────────────────────────────────────────────
function renderWeaningAlert(weaning) {
  if (!weaning.length) return '';
  return '<div class="wonder-card mb-4" style="border-color:rgba(255,107,53,.4);background:rgba(255,107,53,.04)" role="alert" aria-live="polite">' +
    '<div class="d-flex justify-content-between align-items-center flex-wrap gap-2">' +
      '<h6 class="fw-bold mb-0" style="color:var(--orange)"><i class="bi bi-hourglass-split me-2" aria-hidden="true"></i>تنبيه فطام — ' + ar(weaning.length) + ' مولود يحتاج فطاماً قريباً</h6>' +
    '</div>' +
    '<div class="table-responsive mt-3">' +
      '<table class="tbl" style="font-size:.8rem" aria-label="قائمة المواليد التي تحتاج فطاماً">' +
        '<thead><tr><th>الترقيم</th><th>السلالة</th><th>النوع</th><th>الجنس</th><th>تاريخ الميلاد</th><th>العمر</th><th>الجمالون</th></tr></thead>' +
        '<tbody>' +
        weaning.slice(0,10).map(function(a) {
          return '<tr>' +
            '<td class="fw-bold">' + (a.tag ? '#'+a.tag : '—') + '</td>' +
            '<td>' + (a.breed||'—') + '</td>' +
            '<td>' + (a.species==='goat'?'🐐 ماعز':'🐑 أغنام') + '</td>' +
            '<td>' + (a.gender==='male'?'♂ ذكر':'♀ أنثى') + '</td>' +
            '<td class="text-gray">' + (a.birth_date||'—') + '</td>' +
            '<td style="color:var(--orange);font-weight:700">' + ar(a.ageDays||0) + ' يوم</td>' +
            '<td class="text-gray">' + (a.barn||'—') + '</td>' +
          '</tr>';
        }).join('') +
        '</tbody></table>' +
    '</div></div>';
}

// ── Breed cards ───────────────────────────────────────────────
function renderBreedCards(goat, sheep, s) {
  var html = '';
  if (goat.length) html += renderSpeciesBreedSection('goat', '🐐', 'مواليد الماعز', 'var(--green)', goat, s.goatBreeds);
  if (sheep.length) html += renderSpeciesBreedSection('sheep', '🐑', 'مواليد الأغنام', 'var(--blue)', sheep, s.sheepBreeds);
  return html;
}

function renderSpeciesBreedSection(sp, icon, title, color, births, breedList) {
  var breedSet = {};
  births.forEach(function(a) { var b = a.breed||'—'; if (!breedSet[b]) breedSet[b] = []; breedSet[b].push(a); });

  return '<div class="mb-4" role="region" aria-label="' + title + '">' +
    '<h5 class="fw-bold mb-3">' + icon + ' ' + title +
      '<span class="type-badge ms-2" style="background:' + color + '22;color:' + color + ';font-size:.75rem">' + ar(births.length) + ' رأس</span></h5>' +
    '<div class="row g-3">' +
    Object.entries(breedSet).map(function(entry) {
      var breed = entry[0], ba = entry[1];
      var m = ba.filter(function(a){return a.gender==='male';}).length;
      var f = ba.filter(function(a){return a.gender==='female';}).length;
      return '<div class="col-lg-4 col-md-6">' +
        '<div class="wonder-card" style="border-color:' + color + '33">' +
          '<div class="d-flex align-items-center gap-3 mb-3">' +
            '<span style="font-size:1.8rem">' + icon + '</span>' +
            '<div><div class="fw-bold">' + breed + '</div>' +
              '<small class="text-gray">' + ar(ba.length) + ' مولود</small></div>' +
          '</div>' +
          '<div class="row g-2">' +
            '<div class="col-6"><div class="gender-box" role="region" aria-label="ذكور">' +
              '<span class="gender-count" style="color:var(--blue)">' + ar(m) + ' ♂</span>' +
              '<small class="text-gray">ذكور</small></div></div>' +
            '<div class="col-6"><div class="gender-box" role="region" aria-label="إناث">' +
              '<span class="gender-count" style="color:var(--red)">' + ar(f) + ' ♀</span>' +
              '<small class="text-gray">إناث</small></div></div>' +
          '</div>' +
        '</div></div>';
    }).join('') +
    '</div></div>';
}

// ══════════════════════════════════════════════════════════════
//  PATTERN CHARTS
// ══════════════════════════════════════════════════════════════
function drawCharts(all, goat, sheep, monthly, newborns, weaning, juvenile, ready, s) {
  if (typeof Chart === 'undefined') return;

  // ── 1. Breed doughnut with PATTERNS ──────────────────────
  var breedCanvas = document.getElementById('breed-chart');
  if (breedCanvas) {
    var ctx1 = breedCanvas.getContext('2d');
    var breedCount = {};
    all.forEach(function(a) { var b = a.breed||'أخرى'; breedCount[b] = (breedCount[b]||0)+1; });

    var patternTypes = ['diagonal','diagonal2','cross','dots','zigzag','bricks','wave'];
    var patternColors = ['#00e676','#2196f3','#ff6b35','#ffc107','#e040fb','#26c6da','#ff7043'];
    var breedLabels = Object.keys(breedCount);
    var breedData   = Object.values(breedCount);
    var breedPatterns = breedLabels.map(function(_, i) {
      return makePattern(ctx1, patternTypes[i % patternTypes.length], patternColors[i % patternColors.length]);
    });

    if (_charts.breed) _charts.breed.destroy();
    _charts.breed = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: breedLabels,
        datasets: [{
          data: breedData,
          backgroundColor: breedPatterns,
          borderColor: patternColors.slice(0, breedLabels.length),
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color:'#b0b0b0', font:{family:'Cairo'}, boxWidth:18, padding:12 } },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                return ' ' + ctx.label + ': ' + ctx.raw + ' مولود (' + Math.round(ctx.raw/all.length*100) + '٪)';
              }
            }
          }
        },
      },
    });
  }

  // ── 2. Monthly bar chart with PATTERNS ────────────────────
  var monthCanvas = document.getElementById('monthly-chart');
  if (monthCanvas) {
    var ctx2 = monthCanvas.getContext('2d');
    var monthKeys   = Object.keys(monthly);
    var monthLabels = monthKeys.map(function(k) {
      var mo = parseInt(k.split('-')[1]);
      return ['','يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][mo];
    });
    var goatPat  = makePattern(ctx2, 'diagonal',  '#00e676');
    var sheepPat = makePattern(ctx2, 'diagonal2', '#2196f3');

    if (_charts.monthly) _charts.monthly.destroy();
    _charts.monthly = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: monthLabels,
        datasets: [
          { label:'🐐 ماعز', data: monthKeys.map(function(k){return monthly[k].goat;}),  backgroundColor: goatPat,  borderColor:'#00e676', borderWidth:1.5, borderRadius:4 },
          { label:'🐑 أغنام', data: monthKeys.map(function(k){return monthly[k].sheep;}), backgroundColor: sheepPat, borderColor:'#2196f3', borderWidth:1.5, borderRadius:4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#b0b0b0', font:{family:'Cairo'} } } },
        scales: {
          x: { ticks:{color:'#b0b0b0'}, grid:{display:false}, stacked:false },
          y: { ticks:{color:'#b0b0b0'}, grid:{color:'rgba(255,255,255,.06)'}, beginAtZero:true },
        },
      },
    });
  }

  // ── 3. Gender per breed — PATTERNS ───────────────────────
  var genderCanvas = document.getElementById('gender-chart');
  if (genderCanvas) {
    var ctx3 = genderCanvas.getContext('2d');
    var breeds = {};
    all.forEach(function(a) {
      var b = a.breed||'أخرى';
      if (!breeds[b]) breeds[b] = {m:0,f:0};
      if (a.gender==='male') breeds[b].m++; else breeds[b].f++;
    });
    var genderLabels = Object.keys(breeds);
    var malePat   = makePattern(ctx3, 'cross',    '#2196f3');
    var femalePat = makePattern(ctx3, 'dots',     '#e91e63');

    if (_charts.gender) _charts.gender.destroy();
    _charts.gender = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: genderLabels,
        datasets: [
          { label:'♂ ذكور', data: genderLabels.map(function(b){return breeds[b].m;}), backgroundColor: malePat,   borderColor:'#2196f3', borderWidth:1.5, borderRadius:4 },
          { label:'♀ إناث', data: genderLabels.map(function(b){return breeds[b].f;}), backgroundColor: femalePat, borderColor:'#e91e63', borderWidth:1.5, borderRadius:4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color:'#b0b0b0', font:{family:'Cairo'} } } },
        scales: {
          x: { ticks:{color:'#b0b0b0'}, grid:{display:false} },
          y: { ticks:{color:'#b0b0b0'}, grid:{color:'rgba(255,255,255,.06)'}, beginAtZero:true },
        },
      },
    });
  }

  // ── 4. Age groups horizontal bar — PATTERNS ───────────────
  var ageCanvas = document.getElementById('age-chart');
  if (ageCanvas) {
    var ctx4 = ageCanvas.getContext('2d');
    var agePats = [
      makePattern(ctx4, 'wave',    '#ffc107'),
      makePattern(ctx4, 'zigzag',  '#ff6b35'),
      makePattern(ctx4, 'diagonal','#2196f3'),
      makePattern(ctx4, 'cross',   '#00e676'),
    ];

    if (_charts.age) _charts.age.destroy();
    _charts.age = new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: ['🍼 جديد (0-30)', '🔄 فطام (31-60)', '🐾 صغير (61-120)', '✅ جاهز (120+)'],
        datasets: [{
          label: 'العدد',
          data: [newborns.length, weaning.length, juvenile.length, ready.length],
          backgroundColor: agePats,
          borderColor: ['#ffc107','#ff6b35','#2196f3','#00e676'],
          borderWidth: 2,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks:{color:'#b0b0b0'}, grid:{color:'rgba(255,255,255,.06)'}, beginAtZero:true },
          y: { ticks:{color:'#b0b0b0',font:{size:11}}, grid:{display:false} },
        },
      },
    });
  }
}
