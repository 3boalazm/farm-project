'use strict';

var _allNotifs = [];
var _activeFilter = 'all';
var _showRead = false;

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent  = s.farmName;
  renderNavbar('notifications.html');
  const el = document.getElementById('content');
  renderLoading(el);

  const [animals, vaccines, breeding, health, meds, feeds, storedNotifs, loginNotifs] = await Promise.all([
    fbGet('animals'), fbGet('vaccinations'), fbGet('breeding'),
    fbGet('health'), fbGet('inventory_meds'), fbGet('inventory_feeds'),
    fbGet('notifications').catch(function() { return []; }),
    getUser()?.role === 'admin' ? fbGet('login_notifications').catch(function(){return[];}) : Promise.resolve([]),
  ]);

  // ── Generate live notifications ─────────────────────
  const liveNotifs = generateNotifs({ animals, vaccines, breeding, health, meds, feeds });

  // ── Merge live + stored (deduplicate by id) ─────────
  const storedIds = new Set((storedNotifs || []).map(n => n.id || n._id));
  const merged = [
    ...liveNotifs.map(n => ({ ...n, _src: 'live', read: false })),
    ...(storedNotifs || [])
      .filter(n => n.date >= twoWeeksAgo())
      .map(n => ({ ...n, _src: 'stored' })),
  ];

  // Deduplicate: if stored has same category+title skip live duplicate
  const seen = new Set();
  _allNotifs = merged.filter(n => {
    const key = n.cat + '||' + n.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort: danger > warning > info, then by date desc
  const order = { danger: 0, warning: 1, info: 2 };
  _allNotifs.sort((a, b) => {
    const tp = (order[a.type] || 2) - (order[b.type] || 2);
    if (tp !== 0) return tp;
    return (b.date || '').localeCompare(a.date || '');
  });

  renderNotifPage(el);

  // Mark stored as read on page open
  const user = getUser();
  const unreadStored = (storedNotifs || []).filter(n => !n.read && (!n.for_role || n.for_role === user?.role || user?.role === 'admin'));
  if (unreadStored.length) {
    unreadStored.forEach(n => fbPatch('notifications', n._id, { read: true }).catch(() => {}));
    if (typeof NS !== 'undefined') NS.updateBadge();
  }
});

// ── Page Render ───────────────────────────────────────────
function renderNotifPage(el) {
  const danger  = _allNotifs.filter(n => n.type === 'danger');
  const warning = _allNotifs.filter(n => n.type === 'warning');
  const info    = _allNotifs.filter(n => n.type === 'info');
  const unread  = _allNotifs.filter(n => !n.read).length;

  const cats = [...new Set(_allNotifs.map(n => n.cat))];

  renderPageHeader(
    '<i class="bi bi-bell-fill accent-text"></i> الإشعارات الذكية',
    `${ar(_allNotifs.length)} تنبيه — ${ar(unread)} غير مقروء`,
    `<div class="d-flex gap-2 flex-wrap">
       ${unread ? '<button class="action-btn sm" onclick="markAllRead()"><i class="bi bi-check-all"></i> قراءة الكل</button>' : ''}
       <button class="action-btn sm" onclick="toggleRead()"><i class="bi bi-eye${_showRead ? '-slash' : ''}-fill"></i> ${_showRead ? 'إخفاء المقروء' : 'عرض المقروء'}</button>
       <button class="action-btn sm danger" onclick="clearAllNotifs()"><i class="bi bi-trash"></i> مسح الكل</button>
     </div>`
  );

  el.innerHTML = [
    // ── Summary Cards ──────────────────────────────────
    '<div class="row g-3 mb-4">',
    [
      { l: 'عاجل',    v: danger.length,  c: 'var(--red)',    i: 'bi-exclamation-octagon-fill' },
      { l: 'تنبيه',   v: warning.length, c: 'var(--orange)', i: 'bi-exclamation-triangle-fill' },
      { l: 'معلومة',  v: info.length,    c: 'var(--blue)',   i: 'bi-info-circle-fill' },
      { l: 'الإجمالي',v: _allNotifs.length, c: 'var(--gray)', i: 'bi-bell-fill' },
    ].map(k => `
      <div class="col-6 col-md-3">
        <div class="summary-card" onclick="filterBy('${k.l}')" style="cursor:pointer">
          <i class="bi ${k.i} d-block mb-2" style="color:${k.c};font-size:1.3rem"></i>
          <div class="summary-number" style="color:${k.c}">${ar(k.v)}</div>
          <small class="text-gray">${k.l}</small>
        </div>
      </div>`).join(''),
    '</div>',

    // ── Category Filters ────────────────────────────────
    '<div class="d-flex gap-2 flex-wrap mb-4">',
    `<button class="filter-btn${_activeFilter === 'all' ? ' active' : ''}" onclick="filterBy('all')">
       <i class="bi bi-grid-fill me-1"></i>الكل <span class="badge-count">${ar(_allNotifs.length)}</span>
     </button>`,
    cats.map(cat => {
      const cnt = _allNotifs.filter(n => n.cat === cat).length;
      const icon = catIcon(cat);
      return `<button class="filter-btn${_activeFilter === cat ? ' active' : ''}" onclick="filterBy('${cat}')">
        <i class="bi ${icon} me-1"></i>${cat} <span style="font-size:.7rem;opacity:.7">(${ar(cnt)})</span>
      </button>`;
    }).join(''),
    '</div>',

    // ── Notification List ───────────────────────────────
    '<div id="notif-list">',
    renderList(),
    '</div>',
  ].join('');
}

function renderList() {
  let list = _activeFilter === 'all'
    ? _allNotifs
    : _allNotifs.filter(n => n.cat === _activeFilter || n.type === (_activeFilter === 'عاجل' ? 'danger' : _activeFilter === 'تنبيه' ? 'warning' : _activeFilter === 'معلومة' ? 'info' : null));

  if (!_showRead) list = list.filter(n => !n.read);

  if (!list.length) {
    return `<div class="empty-state">
      <i class="bi bi-bell-slash"></i>
      <p>${_allNotifs.length && !_showRead ? 'كل الإشعارات مقروءة 🎉' : 'لا توجد تنبيهات الآن 🎉'}</p>
      <small class="text-gray">ستظهر هنا تنبيهات الولادات والتحصينات والمخزون وفترات السحب تلقائياً</small>
      ${!_showRead && _allNotifs.length ? '<button class="action-btn mt-3" onclick="toggleRead()"><i class="bi bi-eye"></i> عرض المقروء</button>' : ''}
    </div>`;
  }

  // Group by category
  const cats = [...new Set(list.map(n => n.cat))];
  const typeCfg = {
    danger:  { c: 'var(--red)',    label: 'عاجل',   bg: 'rgba(244,67,54,.07)',  border: 'rgba(244,67,54,.2)'  },
    warning: { c: 'var(--orange)', label: 'تنبيه',  bg: 'rgba(255,107,53,.07)', border: 'rgba(255,107,53,.2)' },
    info:    { c: 'var(--blue)',   label: 'معلومة', bg: 'rgba(33,150,243,.07)', border: 'rgba(33,150,243,.2)'  },
  };

  return cats.map(cat => {
    const catItems = list.filter(n => n.cat === cat);
    return `
      <div class="mb-4">
        <div class="d-flex align-items-center gap-2 mb-3">
          <i class="bi ${catIcon(cat)} accent-text"></i>
          <h6 class="fw-bold mb-0">${cat}</h6>
          <span class="type-badge badge-gray" style="font-size:.68rem">${ar(catItems.length)}</span>
        </div>
        ${catItems.map((n, idx) => {
          const cfg = typeCfg[n.type] || typeCfg.info;
          const href = n.href || linkFor(n.cat);
          return `
            <div class="notif-card" style="
              background:${cfg.bg};border:1px solid ${cfg.border};
              border-radius:14px;padding:14px 16px;margin-bottom:8px;
              cursor:pointer;transition:.2s;opacity:${n.read ? '.6' : '1'}"
              onclick="goTo('${href}')" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='${n.read ? '.6' : '1'}'">
              <div class="d-flex gap-3 align-items-start">
                <div style="width:36px;height:36px;border-radius:50%;background:${cfg.c}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">
                  <i class="bi ${n.icon || 'bi-bell-fill'}" style="color:${cfg.c}"></i>
                </div>
                <div class="flex-grow-1 min-w-0">
                  <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                    <div class="fw-bold" style="font-size:.87rem;color:${cfg.c}">${n.title}</div>
                    <span class="type-badge flex-shrink-0" style="background:${cfg.c}22;color:${cfg.c};border:1px solid ${cfg.c}44;font-size:.65rem">
                      ${cfg.label}
                    </span>
                  </div>
                  <div class="text-gray" style="font-size:.81rem;margin-top:3px;line-height:1.5">${n.msg || ''}</div>
                  <div class="d-flex align-items-center gap-3 mt-2 flex-wrap">
                    <small class="text-gray">${n.date || ''}</small>
                    ${n._src === 'stored' && !n.read
                      ? '<span style="width:7px;height:7px;border-radius:50%;background:var(--orange);display:inline-block"></span>'
                      : ''}
                    <a href="${href}" class="action-btn sm" style="padding:2px 8px;font-size:.7rem" onclick="event.stopPropagation()">
                      <i class="bi bi-arrow-left"></i> عرض
                    </a>
                    ${(n._src === 'stored' || n._src === 'login') && !n.read ? `<button class="action-btn sm" style="padding:2px 8px;font-size:.7rem" onclick="event.stopPropagation();markOneRead('${n._id}')" aria-label="تعليم كمقروء"><i class="bi bi-check"></i></button>` : ''}
                    ${n._src === 'stored' || n._src === 'login' ? `<button class="action-btn sm danger" style="padding:2px 8px;font-size:.7rem" onclick="event.stopPropagation();deleteOneNotif('${n._id}')" aria-label="حذف"><i class="bi bi-trash"></i></button>` : ''}
                  </div>
                </div>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }).join('');
}

// ── Controls ──────────────────────────────────────────────
window.filterBy = function(f) {
  _activeFilter = f;
  // Update buttons
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active',
      b.textContent.trim().startsWith(f) ||
      (f === 'all' && b.textContent.trim().startsWith('الكل'))
    );
  });
  const el = document.getElementById('notif-list');
  if (el) el.innerHTML = renderList();
};

window.toggleRead = function() {
  _showRead = !_showRead;
  const el = document.getElementById('content');
  renderNotifPage(el);
};

window.markAllRead = async function() {
  try {
    const stored = await fbGet('notifications');
    const unread = (stored || []).filter(n => !n.read);
    await Promise.all(unread.map(n => fbPatch('notifications', n._id, { read: true }).catch(() => {})));
    _allNotifs.forEach(n => { n.read = true; });
    toast('تم تعليم كل الإشعارات كمقروءة');
    if (typeof NS !== 'undefined') NS.updateBadge();
    const el = document.getElementById('content');
    renderNotifPage(el);
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
};

window.goTo = function(href) {
  if (href) window.location.href = href;
};

window.clearAllNotifs = async function() {
  if (!confirm('هل تريد حذف كل الإشعارات المخزنة؟ (الإشعارات الحية لن تُحذف)')) return;
  try {
    const stored = await fbGet('notifications');
    const loginN = await fbGet('login_notifications').catch(function(){return[];});
    await Promise.all([
      ...(stored||[]).map(function(n){ return fbDelete('notifications', n._id).catch(function(){}); }),
      ...(loginN||[]).map(function(n){ return fbDelete('login_notifications', n._id).catch(function(){}); }),
    ]);
    _allNotifs = _allNotifs.filter(function(n){ return n._src === 'live'; });
    toast('تم حذف الإشعارات المخزنة');
    const el = document.getElementById('content');
    renderNotifPage(el);
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
};

window.markOneRead = async function(id) {
  const n = _allNotifs.find(function(x){ return x._id === id || x.id === id; });
  if (!n) return;
  n.read = true;
  if (n._src === 'stored' && n._id) {
    await fbPatch('notifications', n._id, { read: true }).catch(function(){});
  }
  const el = document.getElementById('content');
  renderNotifPage(el);
};

window.deleteOneNotif = async function(id) {
  const idx = _allNotifs.findIndex(function(x){ return x._id === id || x.id === id; });
  if (idx < 0) return;
  const n = _allNotifs[idx];
  _allNotifs.splice(idx, 1);
  if (n._src === 'stored' && n._id) {
    await fbDelete('notifications', n._id).catch(function(){});
  }
  const el = document.getElementById('content');
  renderNotifPage(el);
};

window.filterBy = function(cat) {
  _activeFilter = cat;
  const el = document.getElementById('content');
  renderNotifPage(el);
};



// ── Generate live notifications ───────────────────────────
function generateNotifs({ animals, vaccines, breeding, health, meds, feeds }) {
  const notifs = [];
  const t = new Date();
  const today = todayStr();

  // 1. Late births
  (breeding || []).filter(r => r.status === 'pregnant' && r.expected_birth && r.expected_birth < today).forEach(r => {
    const d = Math.abs(Math.ceil((new Date(r.expected_birth) - t) / 86400000));
    notifs.push({ type: 'danger', cat: 'التكاثر', icon: 'bi-exclamation-triangle-fill', title: 'تأخر ولادة: ' + (r.female_tag || r.female_breed || '—'), msg: 'كان موعدها ' + r.expected_birth + ' — تأخرت ' + ar(d) + ' يوم', date: r.expected_birth, href: 'breeding.html', id: 'birth-late-' + r._id });
  });

  // 2. Upcoming births (≤15 days)
  (breeding || []).filter(r => r.status === 'pregnant' && r.expected_birth && r.expected_birth >= today).forEach(r => {
    const d = Math.ceil((new Date(r.expected_birth) - t) / 86400000);
    if (d <= 15) notifs.push({ type: d <= 3 ? 'danger' : 'warning', cat: 'التكاثر', icon: 'bi-stars', title: 'ولادة متوقعة: ' + (r.female_tag || r.female_breed || '—'), msg: r.female_breed + ' — ' + r.expected_birth + (d === 0 ? ' (اليوم!)' : ' (بعد ' + ar(d) + ' يوم)'), date: r.expected_birth, href: 'breeding.html', id: 'birth-up-' + r._id });
  });

  // 3. Return to heat (failed, 18-25 days ago)
  (breeding || []).filter(r => r.status === 'failed' && r.mating_date).forEach(r => {
    const d = Math.floor((t - new Date(r.mating_date)) / 86400000);
    if (d >= 18 && d <= 25) notifs.push({ type: 'warning', cat: 'التكاثر', icon: 'bi-arrow-repeat', title: 'رجوع شياع: ' + (r.female_tag || r.female_breed || '—'), msg: 'آخر تقريع ' + r.mating_date + ' — ' + ar(d) + ' يوم (موعد الشياع)', date: r.mating_date, href: 'breeding.html', id: 'heat-' + r._id });
  });

  // 4. Overdue vaccines
  (vaccines || []).filter(v => v.status === 'overdue').forEach(v => {
    notifs.push({ type: 'danger', cat: 'التحصين', icon: 'bi-bandaid-fill', title: 'تحصين متأخر: ' + v.name, msg: (v.target_section || '—') + ' — ' + ar(+v.count || 0) + ' رأس', date: today, href: 'vaccine.html', id: 'vacc-over-' + v._id });
  });

  // 5. Upcoming vaccines (≤7 days)
  (vaccines || []).filter(v => v.status === 'pending' && v.scheduled_date && v.scheduled_date >= today).forEach(v => {
    const d = Math.ceil((new Date(v.scheduled_date) - t) / 86400000);
    if (d <= 7) notifs.push({ type: d <= 2 ? 'danger' : 'warning', cat: 'التحصين', icon: 'bi-bandaid-fill', title: 'موعد تحصين قريب: ' + v.name, msg: (v.target_section || '—') + ' — ' + v.scheduled_date + ' (بعد ' + ar(d) + ' يوم)', date: v.scheduled_date, href: 'vaccine.html', id: 'vacc-up-' + v._id });
  });

  // 6. Active withdrawal
  (health || []).filter(r => r.status === 'active' && r.withdrawal_end && r.withdrawal_end >= today).forEach(r => {
    const d = Math.max(0, Math.ceil((new Date(r.withdrawal_end) - t) / 86400000));
    notifs.push({ type: 'danger', cat: 'الصحة', icon: 'bi-exclamation-triangle-fill', title: 'فترة سحب: ' + (r.animal_tag || r.animal_breed || '—'), msg: r.medication + ' — يُمنع البيع أو الذبح حتى ' + r.withdrawal_end + ' (متبقي ' + ar(d) + ' يوم)', date: r.withdrawal_end, href: 'health.html', id: 'withdraw-' + r._id });
  });

  // 7. Active treatments (without withdrawal — just inform)
  const nonWithdrawal = (health || []).filter(r => r.status === 'active' && !(r.withdrawal_end && r.withdrawal_end >= today));
  if (nonWithdrawal.length) notifs.push({ type: 'warning', cat: 'الصحة', icon: 'bi-heart-pulse-fill', title: ar(nonWithdrawal.length) + ' حيوان قيد العلاج', msg: nonWithdrawal.slice(0, 3).map(r => (r.animal_tag || r.animal_breed || '—') + ': ' + (r.diagnosis || '—')).join(' | '), date: today, href: 'health.html', id: 'active-health-' + today });

  // 8. Expiring meds (≤30 days)
  (meds || []).filter(m => m.expiry).forEach(m => {
    const d = Math.ceil((new Date(m.expiry) - t) / 86400000);
    if (d >= 0 && d <= 30) notifs.push({ type: d <= 7 ? 'danger' : 'warning', cat: 'المخزن', icon: 'bi-capsule', title: 'دواء قارب الانتهاء: ' + m.name, msg: 'ينتهي ' + m.expiry + ' (بعد ' + ar(d) + ' يوم) — متبقي: ' + m.quantity + ' ' + (m.unit || ''), date: m.expiry, href: 'inventory.html', id: 'med-exp-' + m._id });
  });

  // 9. Low stock meds
  (meds || []).filter(m => +m.quantity <= +m.min_quantity && +m.min_quantity > 0).forEach(m => {
    notifs.push({ type: 'warning', cat: 'المخزن', icon: 'bi-capsule', title: 'مخزون دواء منخفض: ' + m.name, msg: 'متبقي ' + m.quantity + ' ' + (m.unit || '') + ' — الحد الأدنى ' + m.min_quantity, date: today, href: 'inventory.html', id: 'med-low-' + m._id });
  });

  // 10. Low stock feeds
  (feeds || []).filter(f => +f.quantity <= +f.min_quantity && +f.min_quantity > 0).forEach(f => {
    notifs.push({ type: 'warning', cat: 'المخزن', icon: 'bi-bag-fill', title: 'مخزون علف منخفض: ' + f.name, msg: 'متبقي ' + f.quantity + ' ' + (f.unit || '') + ' — الحد الأدنى ' + f.min_quantity, date: today, href: 'inventory.html', id: 'feed-low-' + f._id });
  });

  // 11. Recently dead (3 days)
  const recentDead = (animals || []).filter(a => a.status === 'dead' && a.died_at && Math.floor((t - new Date(a.died_at)) / 86400000) <= 3);
  if (recentDead.length) notifs.push({ type: 'info', cat: 'القطيع', icon: 'bi-x-octagon-fill', title: 'نفق ' + ar(recentDead.length) + ' رأس مؤخراً', msg: recentDead.slice(0, 4).map(a => a.breed + (a.tag ? ' #' + a.tag : '')).join('، '), date: today, href: 'dead.html', id: 'recent-dead-' + today });

  return notifs;
}

// ── Helpers ───────────────────────────────────────────────
function catIcon(cat) {
  const map = { 'التكاثر': 'bi-diagram-2-fill', 'التحصين': 'bi-bandaid-fill', 'الصحة': 'bi-heart-pulse-fill', 'المخزن': 'bi-box-seam-fill', 'الطقس': 'bi-cloud-sun-fill', 'تسجيلات الدخول': 'bi-person-fill', 'القطيع': 'bi-bar-chart-fill' };
  return map[cat] || 'bi-tag-fill';
}

function linkFor(cat) {
  const map = { 'التكاثر': 'breeding.html', 'التحصين': 'vaccine.html', 'الصحة': 'health.html', 'المخزن': 'inventory.html', 'الطقس': 'dashboard.html', 'تسجيلات الدخول': 'activity.html', 'القطيع': 'animals.html' };
  return map[cat] || 'dashboard.html';
}

function twoWeeksAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}
