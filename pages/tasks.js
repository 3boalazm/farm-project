'use strict';

// ── State ────────────────────────────────────────────────
var _tasks   = [];
var _users   = [];
var _filter  = 'today'; // all | today | week | overdue | done | by-me
var _statusFilter = 'all';   // all | pending | in_progress | done
var _barnFilter = 'all';
var _catFilter = 'all';

// ── Categories ───────────────────────────────────────────
var TASK_CATEGORIES = {
  cleaning:    { label: 'تنظيف',     icon: '🧹', color: 'var(--blue)'   },
  feeding:     { label: 'إطعام',     icon: '🥫', color: 'var(--green)'  },
  medical:     { label: 'طبي/تحصين',icon: '💉', color: 'var(--red)'    },
  spraying:    { label: 'رش',        icon: '🚿', color: 'var(--purple)' },
  inspection:  { label: 'فحص',       icon: '🔍', color: 'var(--orange)' },
  maintenance: { label: 'صيانة',    icon: '🔧', color: 'var(--yellow)' },
  breeding:    { label: 'تكاثر',     icon: '🐣', color: 'var(--purple)' },
  other:       { label: 'أخرى',      icon: '📝', color: 'var(--gray)'   },
};

var PRIORITY_LABELS = {
  high:   { label: 'عالية',  color: 'var(--red)' },
  medium: { label: 'متوسطة', color: 'var(--orange)' },
  low:    { label: 'منخفضة', color: 'var(--gray)' },
};

// ── Default task templates ───────────────────────────────
var TASK_TEMPLATES = [
  { title: 'تنظيف الجمالون اليومي', category: 'cleaning',    priority: 'medium', recurring: true,  recurring_days: 1 },
  { title: 'توزيع العلف الصباحي',   category: 'feeding',     priority: 'high',   recurring: true,  recurring_days: 1 },
  { title: 'توزيع العلف المسائي',   category: 'feeding',     priority: 'high',   recurring: true,  recurring_days: 1 },
  { title: 'فحص بصري للقطيع',       category: 'inspection',  priority: 'medium', recurring: true,  recurring_days: 1 },
  { title: 'رش مبيد القراد',         category: 'spraying',    priority: 'high',   recurring: true,  recurring_days: 14 },
  { title: 'تغيير ماء الشرب',        category: 'cleaning',    priority: 'high',   recurring: true,  recurring_days: 1 },
  { title: 'فحص الحوامل',           category: 'inspection',  priority: 'high',   recurring: true,  recurring_days: 3 },
  { title: 'صيانة المعالف',         category: 'maintenance', priority: 'medium', recurring: true,  recurring_days: 7 },
];

// ── Boot ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth()) return;
  const s = getSettings();
  document.getElementById('footer-year').textContent = ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent = s.farmName;
  renderNavbar('tasks.html');
  renderPageHeader(
    '<i class="bi bi-list-check accent-text"></i> المهام اليومية',
    'إدارة وتعيين المهام للعاملين',
    can('animals') ? `<div class="d-flex gap-2">
      <button class="action-btn" onclick="openTemplatesPanel()" aria-label="القوالب الجاهزة"><i class="bi bi-bookmark-fill"></i> القوالب</button>
      <button class="action-btn primary" onclick="openTaskModal()" aria-label="إضافة مهمة جديدة"><i class="bi bi-plus-lg"></i> مهمة جديدة</button>
    </div>` : ''
  );
  await loadData();
  render();
});

async function loadData() {
  const el = document.getElementById('content');
  renderLoading(el);
  try {
    const [tasks, users] = await Promise.all([
      fbGet('daily_tasks').catch(() => []),
      fbGet('users').catch(() => []),
    ]);
    _tasks = tasks || [];
    _users = users || [];
    // Auto-generate recurring tasks for today
    await generateRecurringTasks();
  } catch(e) {
    toast('خطأ في التحميل: ' + e.message, 'error');
  }
}

// ── Auto-generate recurring tasks ────────────────────────
async function generateRecurringTasks() {
  const today = todayStr();
  const recurringTemplates = _tasks.filter(t => t.is_template && t.recurring);
  if (!recurringTemplates.length) return;

  for (const tpl of recurringTemplates) {
    // Check if instance for today already exists
    const exists = _tasks.find(t =>
      t.template_id === tpl._id && t.date === today
    );
    if (exists) continue;

    // Check if should generate today based on recurring_days
    const lastDate = tpl.last_generated || tpl.created_at?.slice(0,10) || today;
    const daysSinceLast = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
    if (daysSinceLast < (tpl.recurring_days || 1)) continue;

    try {
      const newTask = {
        title: tpl.title,
        category: tpl.category,
        priority: tpl.priority,
        assigned_to: tpl.assigned_to,
        assigned_to_name: tpl.assigned_to_name,
        barn: tpl.barn,
        date: today,
        status: 'pending',
        notes: tpl.notes,
        template_id: tpl._id,
        recurring: false,
        created_at: new Date().toISOString(),
      };
      await fbPost('daily_tasks', newTask);
      await fbPatch('daily_tasks', tpl._id, { last_generated: today });
    } catch(e) { console.warn('Recurring gen failed:', e); }
  }
  // Reload tasks
  _tasks = await fbGet('daily_tasks', true);
}

// ══════════════════════════════════════════
//  Main Render
// ══════════════════════════════════════════
function render() {
  const el = document.getElementById('content');
  const today = todayStr();

  // Filtered tasks
  const filtered = filterTasks();

  // Stats for today
  const todayTasks = _tasks.filter(t => !t.is_template && t.date === today);
  const stats = {
    today:    todayTasks.length,
    done:     todayTasks.filter(t => t.status === 'done').length,
    inProg:   todayTasks.filter(t => t.status === 'in_progress').length,
    pending:  todayTasks.filter(t => t.status === 'pending').length,
    overdue:  _tasks.filter(t => !t.is_template && t.status !== 'done' && t.date < today).length,
    completion: todayTasks.length ? Math.round(todayTasks.filter(t => t.status === 'done').length / todayTasks.length * 100) : 0,
  };

  el.innerHTML = `
  <!-- KPI Row -->
  <div class="row g-3 mb-4">
    ${[
      { l:'مهام اليوم',    v:ar(stats.today),    c:'var(--orange)', i:'bi-calendar-day-fill' },
      { l:'منجزة',         v:ar(stats.done),     c:'var(--green)',  i:'bi-check-circle-fill' },
      { l:'قيد التنفيذ',   v:ar(stats.inProg),   c:'var(--yellow)', i:'bi-hourglass-split' },
      { l:'في الانتظار',   v:ar(stats.pending),  c:'var(--blue)',   i:'bi-clock' },
      { l:'متأخرة',        v:ar(stats.overdue),  c:stats.overdue?'var(--red)':'var(--gray)', i:'bi-exclamation-triangle-fill' },
      { l:'نسبة الإنجاز',  v:ar(stats.completion)+'٪', c:stats.completion>=70?'var(--green)':stats.completion>=40?'var(--orange)':'var(--red)', i:'bi-graph-up' },
    ].map(k => `
      <div class="col-6 col-md-4 col-lg-2">
        <div class="summary-card" role="region" aria-label="${k.l}">
          <i class="bi ${k.i} d-block mb-2" style="color:${k.c};font-size:1.3rem" aria-hidden="true"></i>
          <div style="font-size:.95rem;font-weight:700;color:${k.c}">${k.v}</div>
          <small class="text-gray">${k.l}</small>
        </div>
      </div>`).join('')}
  </div>

  <!-- Completion Progress -->
  <div class="wonder-card mb-4">
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="fw-bold mb-0"><i class="bi bi-bar-chart-fill accent-text me-2" aria-hidden="true"></i>تقدم اليوم</h6>
      <span class="fw-bold" style="color:${stats.completion>=70?'var(--green)':stats.completion>=40?'var(--orange)':'var(--red)'}">${ar(stats.completion)}٪</span>
    </div>
    <div class="finance-bar" role="progressbar" aria-valuenow="${stats.completion}" aria-valuemin="0" aria-valuemax="100" aria-label="نسبة إنجاز مهام اليوم" style="height:12px">
      <div class="finance-bar-fill" style="width:${stats.completion}%;background:${stats.completion>=70?'var(--green)':stats.completion>=40?'var(--orange)':'var(--red)'};transition:width .5s"></div>
    </div>
    <div class="d-flex justify-content-between mt-2 text-gray" style="font-size:.78rem">
      <span><i class="bi bi-check-circle-fill me-1" style="color:var(--green)"></i>${ar(stats.done)} من ${ar(stats.today)}</span>
      ${stats.overdue ? `<span class="red-text"><i class="bi bi-exclamation-triangle-fill me-1"></i>${ar(stats.overdue)} متأخرة</span>` : ''}
    </div>
  </div>

  <!-- Quick Filters -->
  <div class="d-flex gap-2 flex-wrap mb-3" role="tablist" aria-label="فلاتر المهام">
    ${[
      ['today',   'bi-calendar-day-fill', 'اليوم',          _tasks.filter(t=>!t.is_template&&t.date===today).length],
      ['week',    'bi-calendar-week',     'هذا الأسبوع',    _tasks.filter(t=>!t.is_template&&t.date>=weekAgoStr()).length],
      ['overdue', 'bi-exclamation-triangle-fill', 'المتأخرة',  stats.overdue],
      ['by-me',   'bi-person-fill',       'مهامي',           _tasks.filter(t=>!t.is_template&&t.assigned_to===(getUser()?.id)).length],
      ['all',     'bi-list-ul',           'الكل',           _tasks.filter(t=>!t.is_template).length],
    ].map(([k, i, l, n]) => `
      <button class="filter-btn${_filter===k?' active':''}" onclick="setFilter('${k}')" role="tab" aria-selected="${_filter===k}">
        <i class="bi ${i} me-1" aria-hidden="true"></i>${l} <span style="opacity:.7;font-size:.7rem">(${ar(n)})</span>
      </button>`).join('')}
  </div>

  <!-- Secondary Filters -->
  <div class="d-flex gap-2 flex-wrap mb-4 align-items-center" style="font-size:.82rem">
    <label class="text-gray" for="cat-filter">الفئة:</label>
    <select id="cat-filter" class="field" style="width:auto;padding:4px 28px 4px 8px;font-size:.8rem;margin:0" onchange="_catFilter=this.value;render()" aria-label="فلتر الفئة">
      <option value="all">كل الفئات</option>
      ${Object.entries(TASK_CATEGORIES).map(([k, c]) => `<option value="${k}"${_catFilter===k?' selected':''}>${c.icon} ${c.label}</option>`).join('')}
    </select>
    <label class="text-gray ms-2" for="st-filter">الحالة:</label>
    <select id="st-filter" class="field" style="width:auto;padding:4px 28px 4px 8px;font-size:.8rem;margin:0" onchange="_statusFilter=this.value;render()" aria-label="فلتر الحالة">
      <option value="all">كل الحالات</option>
      <option value="pending"${_statusFilter==='pending'?' selected':''}>في الانتظار</option>
      <option value="in_progress"${_statusFilter==='in_progress'?' selected':''}>قيد التنفيذ</option>
      <option value="done"${_statusFilter==='done'?' selected':''}>منجزة</option>
    </select>
    <label class="text-gray ms-2" for="barn-filter">الجمالون:</label>
    <select id="barn-filter" class="field" style="width:auto;padding:4px 28px 4px 8px;font-size:.8rem;margin:0" onchange="_barnFilter=this.value;render()" aria-label="فلتر الجمالون">
      <option value="all">كل الجمالونات</option>
      ${['ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'].map(b => `<option value="${b}"${_barnFilter===b?' selected':''}>${b}</option>`).join('')}
    </select>
    <div class="ms-auto text-gray" style="font-size:.78rem">يُعرض ${ar(filtered.length)} مهمة</div>
  </div>

  <!-- Tasks List -->
  <div id="task-list">
    ${filtered.length ? renderTasksList(filtered) : renderEmpty()}
  </div>`;
}

function filterTasks() {
  let list = _tasks.filter(t => !t.is_template);
  const today = todayStr();
  const user = getUser();

  // Time filter
  if (_filter === 'today')        list = list.filter(t => t.date === today);
  else if (_filter === 'week')    list = list.filter(t => t.date >= weekAgoStr());
  else if (_filter === 'overdue') list = list.filter(t => t.status !== 'done' && t.date < today);
  else if (_filter === 'by-me')   list = list.filter(t => t.assigned_to === user?.id);

  // Status / Category / Barn filters
  if (_statusFilter !== 'all') list = list.filter(t => t.status === _statusFilter);
  if (_catFilter !== 'all')    list = list.filter(t => t.category === _catFilter);
  if (_barnFilter !== 'all')   list = list.filter(t => t.barn === _barnFilter);

  // Sort: priority high > medium > low, then by date
  const pOrder = { high: 0, medium: 1, low: 2 };
  list.sort((a, b) => {
    const pa = pOrder[a.priority] ?? 1;
    const pb = pOrder[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.date || '').localeCompare(b.date || '');
  });

  return list;
}

function renderTasksList(list) {
  const today = todayStr();
  // Group by date
  const byDate = {};
  list.forEach(t => {
    const d = t.date || 'بدون تاريخ';
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  });

  return Object.entries(byDate).map(([date, tasks]) => {
    const isPast = date < today;
    const isToday = date === today;
    const dateLabel = isToday ? 'اليوم' : (isPast ? '⚠️ متأخر — ' + date : date);
    return `
    <div class="mb-3">
      <div class="d-flex justify-content-between align-items-center mb-2">
        <h6 class="fw-bold mb-0" style="font-size:.88rem;${isPast?'color:var(--red)':''}">
          <i class="bi bi-calendar3 me-2" aria-hidden="true"></i>${dateLabel}
        </h6>
        <small class="text-gray">${ar(tasks.length)} مهمة</small>
      </div>
      ${tasks.map(t => renderTaskCard(t, today)).join('')}
    </div>`;
  }).join('');
}

function renderTaskCard(t, today) {
  const cat = TASK_CATEGORIES[t.category] || TASK_CATEGORIES.other;
  const pri = PRIORITY_LABELS[t.priority] || PRIORITY_LABELS.medium;
  const isOverdue = t.status !== 'done' && t.date < today;
  const statusClass = t.status === 'done' ? 'done' : isOverdue ? 'overdue' : t.status === 'in_progress' ? 'in-progress' : '';

  const statusIcon = t.status === 'done' ? '<i class="bi bi-check2"></i>' : '';
  const statusLabel = { pending: 'في الانتظار', in_progress: 'قيد التنفيذ', done: 'منجزة' }[t.status] || t.status;
  const statusColor = { pending: 'var(--blue)', in_progress: 'var(--yellow)', done: 'var(--green)' }[t.status];

  return `
  <div class="task-card ${statusClass}" role="article" aria-label="مهمة: ${t.title}">
    <div class="d-flex align-items-start gap-3">
      <button class="task-checkbox ${t.status === 'done' ? 'checked' : ''}" onclick="toggleTaskDone('${t._id}')"
        aria-label="${t.status === 'done' ? 'إلغاء إنجاز المهمة' : 'تعليم كمنجزة'}" title="${t.status === 'done' ? 'تم الإنجاز' : 'انقر للإنجاز'}">
        ${statusIcon}
      </button>

      <div class="flex-grow-1 min-w-0">
        <div class="d-flex justify-content-between align-items-start gap-2 flex-wrap">
          <div class="fw-bold ${t.status === 'done' ? 'text-gray' : ''}" style="font-size:.92rem;${t.status === 'done' ? 'text-decoration:line-through;' : ''}">
            ${t.title}
          </div>
          <div class="d-flex gap-1 align-items-center flex-shrink-0">
            <span class="priority-dot" style="background:${pri.color}" title="أولوية ${pri.label}" aria-label="أولوية ${pri.label}"></span>
            <span class="task-cat" style="background:${cat.color}22;color:${cat.color}">
              ${cat.icon} ${cat.label}
            </span>
          </div>
        </div>

        <div class="d-flex gap-3 mt-2 flex-wrap text-gray" style="font-size:.78rem">
          ${t.barn ? `<span><i class="bi bi-building me-1" aria-hidden="true"></i>${t.barn}</span>` : ''}
          ${t.assigned_to_name ? `<span><i class="bi bi-person-fill me-1" aria-hidden="true"></i>${t.assigned_to_name}</span>` : ''}
          ${t.notes ? `<span><i class="bi bi-chat-left-text me-1" aria-hidden="true"></i>${t.notes}</span>` : ''}
        </div>

        <div class="d-flex gap-2 mt-2 align-items-center">
          <span class="type-badge" style="background:${statusColor}22;color:${statusColor};border:1px solid ${statusColor}44;font-size:.65rem">${statusLabel}</span>
          ${t.status === 'pending' && can('animals') ? `<button class="action-btn sm" onclick="setTaskStatus('${t._id}','in_progress')" aria-label="بدء التنفيذ" style="padding:2px 8px;font-size:.7rem"><i class="bi bi-play-fill"></i> بدء</button>` : ''}
          ${can('animals') ? `<button class="action-btn sm" onclick="openEditTask('${t._id}')" aria-label="تعديل المهمة" style="padding:2px 8px;font-size:.7rem"><i class="bi bi-pencil"></i></button>` : ''}
          ${can('admin') ? `<button class="action-btn sm danger" onclick="delTask('${t._id}')" aria-label="حذف المهمة" style="padding:2px 8px;font-size:.7rem"><i class="bi bi-trash"></i></button>` : ''}
          ${t.completed_at ? `<small class="text-gray ms-auto"><i class="bi bi-check-circle-fill me-1" style="color:var(--green)"></i>أُنجزت ${t.completed_at.slice(11,16)}</small>` : ''}
        </div>
      </div>
    </div>
  </div>`;
}

function renderEmpty() {
  return `
  <div class="empty-state" role="status">
    <i class="bi bi-list-check" aria-hidden="true"></i>
    <p>لا توجد مهام تطابق هذه الفلاتر</p>
    ${can('animals') ? `<button class="action-btn primary mt-2" onclick="openTaskModal()" aria-label="إضافة مهمة جديدة"><i class="bi bi-plus-lg"></i> إضافة مهمة</button>` : ''}
  </div>`;
}

// ── Helpers ──────────────────────────────────────────────
function weekAgoStr() {
  const d = new Date(); d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

window.setFilter = function(f) {
  _filter = f;
  render();
};

// ── Task actions ─────────────────────────────────────────
window.toggleTaskDone = async function(id) {
  const t = _tasks.find(x => x._id === id);
  if (!t) return;
  const newStatus = t.status === 'done' ? 'pending' : 'done';
  const user = getUser();
  try {
    await fbPatch('daily_tasks', id, {
      status: newStatus,
      completed_at: newStatus === 'done' ? new Date().toISOString() : null,
      completed_by: newStatus === 'done' ? (user?.name || user?.email || '—') : null,
    });
    await logActivity(newStatus === 'done' ? 'edit' : 'edit', 'daily_tasks', (newStatus === 'done' ? 'إنجاز مهمة: ' : 'إلغاء إنجاز: ') + t.title);
    t.status = newStatus;
    if (newStatus === 'done') {
      t.completed_at = new Date().toISOString();
      t.completed_by = user?.name || user?.email;
    }
    render();
    if (newStatus === 'done') toast('✅ تم إنجاز: ' + t.title);
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
};

window.setTaskStatus = async function(id, status) {
  try {
    await fbPatch('daily_tasks', id, { status: status });
    const t = _tasks.find(x => x._id === id);
    if (t) t.status = status;
    render();
    toast(status === 'in_progress' ? '⏱️ تم بدء التنفيذ' : '✅ تم التحديث');
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
};

window.delTask = async function(id) {
  if (!id || !confirm('حذف هذه المهمة نهائياً؟')) return;
  try {
    await fbDelete('daily_tasks', id);
    _tasks = _tasks.filter(t => t._id !== id);
    toast('تم الحذف');
    render();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
};

// ══════════════════════════════════════════
//  Task Modal (Add/Edit)
// ══════════════════════════════════════════
window.openTaskModal = function(presetData) {
  const d = presetData || {};
  const workers = _users.filter(u => ['worker', 'supervisor', 'vet'].includes(u.role));
  const u = getUser();

  showModal(
    '<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:520px">' +
      '<h4><i class="bi bi-plus-circle accent-text" aria-hidden="true"></i> ' + (d._id ? 'تعديل مهمة' : 'مهمة جديدة') + '</h4>' +

      '<label for="t-title">عنوان المهمة *</label>' +
      '<input class="field" id="t-title" value="' + (d.title || '') + '" placeholder="مثال: تنظيف جمالون ج١ع١" aria-required="true">' +

      '<div class="row g-2">' +
        '<div class="col-6">' +
          '<label for="t-cat">الفئة *</label>' +
          '<select class="field" id="t-cat" aria-required="true">' +
            Object.entries(TASK_CATEGORIES).map(([k, c]) =>
              '<option value="' + k + '"' + ((d.category||'cleaning') === k ? ' selected' : '') + '>' + c.icon + ' ' + c.label + '</option>'
            ).join('') +
          '</select>' +
        '</div>' +
        '<div class="col-6">' +
          '<label for="t-pri">الأولوية</label>' +
          '<select class="field" id="t-pri">' +
            '<option value="high"' +   (d.priority === 'high'   ? ' selected' : '') + '>🔴 عالية</option>' +
            '<option value="medium"' + ((d.priority||'medium') === 'medium' ? ' selected' : '') + '>🟡 متوسطة</option>' +
            '<option value="low"' +    (d.priority === 'low'    ? ' selected' : '') + '>⚪ منخفضة</option>' +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="row g-2">' +
        '<div class="col-6">' +
          '<label for="t-assign">المُكلَّف</label>' +
          '<select class="field" id="t-assign" aria-label="الشخص المُكلَّف">' +
            '<option value="">— غير محدد —</option>' +
            workers.map(w => '<option value="' + w._id + '" data-name="' + (w.name||'') + '"' + (d.assigned_to === w._id ? ' selected' : '') + '>' + (w.name || w.email) + ' (' + (ROLES[w.role]?.label || w.role) + ')</option>').join('') +
          '</select>' +
        '</div>' +
        '<div class="col-6">' +
          '<label for="t-barn">الجمالون</label>' +
          '<select class="field" id="t-barn">' +
            '<option value="">— غير محدد —</option>' +
            ['ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'].map(b => '<option value="' + b + '"' + (d.barn === b ? ' selected' : '') + '>' + b + '</option>').join('') +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="row g-2">' +
        '<div class="col-6">' +
          '<label for="t-date">التاريخ *</label>' +
          '<input type="date" class="field" id="t-date" value="' + (d.date || todayStr()) + '" aria-required="true">' +
        '</div>' +
        '<div class="col-6 d-flex align-items-center" style="padding-top:22px">' +
          '<label class="d-flex align-items-center gap-2" style="cursor:pointer">' +
            '<input type="checkbox" id="t-recurring"' + (d.recurring ? ' checked' : '') + ' style="width:18px;height:18px;accent-color:var(--orange)" onchange="document.getElementById(\'recur-row\').style.display=this.checked?\'block\':\'none\'">' +
            '<span class="fw-bold">مهمة متكررة</span>' +
          '</label>' +
        '</div>' +
      '</div>' +

      '<div id="recur-row" style="display:' + (d.recurring ? 'block' : 'none') + ';background:rgba(255,193,7,.06);border:1px solid rgba(255,193,7,.2);border-radius:10px;padding:10px 12px;margin-top:8px">' +
        '<label for="t-recur-days" style="font-size:.78rem">تكرار كل (أيام)</label>' +
        '<input type="number" class="field" id="t-recur-days" value="' + (d.recurring_days || 1) + '" min="1" max="90" style="margin:0">' +
      '</div>' +

      '<label for="t-notes">ملاحظات</label>' +
      '<textarea class="field" id="t-notes" rows="2" placeholder="تفاصيل إضافية...">' + (d.notes || '') + '</textarea>' +

      '<div class="d-flex gap-2 justify-content-end mt-3">' +
        '<button class="action-btn" onclick="closeModal()" aria-label="إلغاء">إلغاء</button>' +
        '<button class="action-btn primary" onclick="submitTask(' + (d._id ? '\'' + d._id + '\'' : 'null') + ')" aria-label="حفظ المهمة"><i class="bi bi-check-lg" aria-hidden="true"></i> ' + (d._id ? 'حفظ التعديلات' : 'إضافة المهمة') + '</button>' +
      '</div>' +
    '</div>'
  );
};

window.openEditTask = function(id) {
  const t = _tasks.find(x => x._id === id);
  if (t) openTaskModal(t);
};

window.submitTask = async function(editId) {
  const title    = document.getElementById('t-title').value.trim();
  const cat      = document.getElementById('t-cat').value;
  const pri      = document.getElementById('t-pri').value;
  const date     = document.getElementById('t-date').value;
  const assignedTo = document.getElementById('t-assign').value;
  const barn     = document.getElementById('t-barn').value;
  const recurring = document.getElementById('t-recurring').checked;
  const recurDays = parseInt(document.getElementById('t-recur-days')?.value) || 1;
  const notes    = document.getElementById('t-notes').value.trim();

  if (!title || !date || !cat) { toast('يرجى تعبئة الحقول الإلزامية', 'error'); return; }

  const assignedName = assignedTo ? (_users.find(u => u._id === assignedTo)?.name || '') : '';
  const data = {
    title: title, category: cat, priority: pri, date: date,
    assigned_to: assignedTo || null, assigned_to_name: assignedName,
    barn: barn || null, notes: notes || null,
    recurring: recurring, recurring_days: recurring ? recurDays : null,
    is_template: recurring,  // recurring tasks act as templates
    status: editId ? undefined : 'pending',
  };

  closeModal();
  try {
    if (editId) {
      await fbPatch('daily_tasks', editId, data);
      await logActivity('edit', 'daily_tasks', 'تعديل مهمة: ' + title);
      toast('✅ تم التحديث');
    } else {
      data.created_at = new Date().toISOString();
      data.created_by = getUser()?.name || getUser()?.email || '—';
      await fbPost('daily_tasks', data);
      await logActivity('add', 'daily_tasks', 'إضافة مهمة: ' + title + (recurring ? ' (متكررة)' : ''));
      toast('✅ تمت الإضافة' + (recurring ? ' كمهمة متكررة' : ''));
    }
    await loadData();
    render();
  } catch(e) { toast('خطأ: ' + e.message, 'error'); }
};

// ══════════════════════════════════════════
//  Templates Panel
// ══════════════════════════════════════════
window.openTemplatesPanel = function() {
  showModal(
    '<div class="farm-modal" onclick="event.stopPropagation()" style="max-width:560px;max-height:88vh;overflow-y:auto">' +
      '<h4><i class="bi bi-bookmark-fill accent-text" aria-hidden="true"></i> القوالب الجاهزة</h4>' +
      '<p class="text-gray mb-3" style="font-size:.82rem">اختر قالباً لإنشاء مهمة بسرعة — يمكنك تعديل التفاصيل بعد ذلك</p>' +
      TASK_TEMPLATES.map((tpl, i) => {
        const cat = TASK_CATEGORIES[tpl.category] || TASK_CATEGORIES.other;
        const pri = PRIORITY_LABELS[tpl.priority];
        return '<div class="task-card" role="button" tabindex="0" onclick="useTemplate(' + i + ')" onkeydown="if(event.key===\'Enter\')useTemplate(' + i + ')" style="cursor:pointer" aria-label="استخدام قالب: ' + tpl.title + '">' +
          '<div class="d-flex justify-content-between align-items-center gap-2">' +
            '<div>' +
              '<div class="fw-bold">' + cat.icon + ' ' + tpl.title + '</div>' +
              '<small class="text-gray">أولوية ' + pri.label + ' | كل ' + tpl.recurring_days + ' يوم</small>' +
            '</div>' +
            '<span class="task-cat" style="background:' + cat.color + '22;color:' + cat.color + '">' + cat.label + '</span>' +
          '</div>' +
        '</div>';
      }).join('') +
      '<div class="d-flex justify-content-end mt-3">' +
        '<button class="action-btn" onclick="closeModal()" aria-label="إغلاق">إغلاق</button>' +
      '</div>' +
    '</div>'
  );
};

window.useTemplate = function(idx) {
  const tpl = TASK_TEMPLATES[idx];
  if (!tpl) return;
  closeModal();
  openTaskModal({
    title: tpl.title, category: tpl.category, priority: tpl.priority,
    recurring: tpl.recurring, recurring_days: tpl.recurring_days, date: todayStr(),
  });
};
