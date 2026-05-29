'use strict';
// ══════════════════════════════════════════════════════════════
//  FARM TOUR ENGINE — Role-based onboarding for new users
//  Inspired by Ant Design's Tour component
//  Usage: FarmTour.start(role) | FarmTour.startPage('health')
// ══════════════════════════════════════════════════════════════
var FarmTour = (function() {

  var _steps   = [];
  var _current = 0;
  var _overlay = null;
  var _spotlight = null;
  var _tooltip  = null;
  var _onDone  = null;

  // ── Tour definitions per role ────────────────────────────────
  var TOURS = {

    admin: [
      { title: '👋 مرحباً بك في نظام بيان المزرعة!',
        body: 'هذا النظام مصمم لإدارة قطيعك بالكامل — من تسجيل الحيوانات إلى التقارير المالية. سنأخذك في جولة سريعة.',
        target: null, position: 'center' },
      { title: '📊 لوحة التحكم',
        body: 'من هنا ترى ملخصاً يومياً: التنبيهات، المواعيد القادمة، والإحصائيات الرئيسية للمزرعة.',
        target: 'a[href="dashboard.html"]', position: 'left' },
      { title: '🐐 إدارة القطيع',
        body: 'سجّل كل حيوان، تابع حالته الصحية، وصدّر البيانات لـ Excel. يمكنك أيضاً الإضافة بالجملة.',
        target: 'a[href="animals.html"]', position: 'left' },
      { title: '💉 التحصين والصحة',
        body: 'جدول التحصينات يُذكّرك قبل المواعيد. السجل الصحي يتابع كل علاج مع حساب فترة الانسحاب.',
        target: 'a[href="vaccine.html"]', position: 'left' },
      { title: '📈 التقارير',
        body: 'تقارير متكاملة: القطيع، المالية، الصحة، التكاثر. مع تصدير Excel ومشاركة WhatsApp.',
        target: 'a[href="reports.html"]', position: 'left' },
      { title: '🤖 المساعد الذكي',
        body: 'المساعد يقرأ بيانات مزرعتك الحقيقية ويجيب على أسئلتك بالعربي. يمكنه إضافة سجلات بأوامر نصية.',
        target: 'a[href="assistant.html"]', position: 'left' },
      { title: '⚙️ الإعدادات',
        body: 'من هنا تضبط أسماء السلالات، حدود التنبيهات، سعة الجمالونات، وكل تفضيلات النظام.',
        target: 'a[href="settings.html"]', position: 'left' },
      { title: '✅ الجولة مكتملة!',
        body: 'أنت الآن جاهز. يمكنك إعادة هذه الجولة في أي وقت من صفحة الإعدادات. حظاً موفقاً!',
        target: null, position: 'center' },
    ],

    vet: [
      { title: '👨‍⚕️ مرحباً دكتور!',
        body: 'هذا قسم خاص بك كطبيب بيطري. ستعمل أساساً على السجل الصحي والتحصينات. سنريك أين كل شيء.',
        target: null, position: 'center' },
      { title: '❤️ السجل الصحي',
        body: 'هنا تسجّل الحالات: التشخيص، الدواء، الجرعة، وتاريخ انتهاء فترة الانسحاب. النظام يحسبها تلقائياً.',
        target: 'a[href="health.html"]', position: 'left' },
      { title: '💉 التحصين',
        body: 'جدول التحصينات مع قوالب جاهزة للأمراض الشائعة. يمكنك جدولة الجرعات القادمة.',
        target: 'a[href="vaccine.html"]', position: 'left' },
      { title: '🐐 القطيع',
        body: 'يمكنك الاطلاع على حالة كل حيوان ومتابعة الحالات الصحية النشطة مباشرة من هنا.',
        target: 'a[href="animals.html"]', position: 'left' },
      { title: '🔔 التنبيهات',
        body: 'النظام يرسل تنبيهات تلقائية: انتهاء التحصين، انتهاء فترة الانسحاب، حالات تحتاج متابعة.',
        target: 'a[href="notifications.html"]', position: 'left' },
      { title: '🐣 الإنتاج',
        body: 'يمكنك تسجيل إنتاج الحليب والوزن مباشرة من هنا لمتابعة صحة الحيوان غير المباشرة.',
        target: 'a[href="production.html"]', position: 'left' },
      { title: '✅ أنت جاهز دكتور!',
        body: 'كل ما تحتاجه متاح. أي سؤال؟ المساعد الذكي جاهز للمساعدة.',
        target: null, position: 'center' },
    ],

    supervisor: [
      { title: '👷 مرحباً بك مشرف!',
        body: 'دورك الأساسي هو متابعة العمليات اليومية والتأكد من تنفيذ المهام.',
        target: null, position: 'center' },
      { title: '📋 المهام اليومية',
        body: 'من هنا تتابع وتوزّع المهام على العمال: تنظيف، إطعام، رش، فحص. تابع نسبة الإنجاز.',
        target: 'a[href="tasks.html"]', position: 'left' },
      { title: '🐐 إدارة القطيع',
        body: 'متابعة القطيع وتسجيل الملاحظات. يمكنك إضافة حيوانات وتتبع توزيعها على الجمالونات.',
        target: 'a[href="animals.html"]', position: 'left' },
      { title: '🌾 المخزن',
        body: 'متابعة مخزون الأعلاف والأدوية. سجّل الاستهلاك اليومي لكل جمالون.',
        target: 'a[href="inventory.html"]', position: 'left' },
      { title: '🔔 التنبيهات',
        body: 'تنبيهات المخزون المنخفض، المهام المتأخرة، ومواعيد التحصين — كلها هنا.',
        target: 'a[href="notifications.html"]', position: 'left' },
      { title: '✅ جاهز!',
        body: 'ابدأ بصفحة المهام اليومية لمتابعة فريقك.',
        target: null, position: 'center' },
    ],

    worker: [
      { title: '👋 مرحباً!',
        body: 'سنريك الأجزاء الأساسية التي ستستخدمها في عملك اليومي.',
        target: null, position: 'center' },
      { title: '✅ مهامك اليومية',
        body: 'هنا تشوف المهام المُكلَّفة ليك. اضغط "بدء" لما تشتغل، واضغط الدائرة لما تخلّص.',
        target: 'a[href="tasks.html"]', position: 'left' },
      { title: '🐐 القطيع',
        body: 'إذا كنت بتسجّل بيانات، ابحث عن الحيوان هنا. يمكنك الاطلاع على بروفايل كل حيوان.',
        target: 'a[href="animals.html"]', position: 'left' },
      { title: '🔔 الإشعارات',
        body: 'تحقق من التنبيهات بانتظام — قد يكون فيها مواعيد مهمة.',
        target: 'a[href="notifications.html"]', position: 'left' },
      { title: '✅ خلاص!',
        body: 'ابدأ بمهامك. لو في سؤال، اسأل مشرفك.',
        target: null, position: 'center' },
    ],
  };

  // ── Page-specific mini tours ──────────────────────────────────
  var PAGE_TOURS = {
    health: [
      { title: '💊 السجل الصحي', body: 'هذه الصفحة لتسجيل الحالات الصحية لكل حيوان.',
        target: '#page-header', position: 'bottom' },
      { title: '➕ إضافة سجل', body: 'اضغط هذا الزر لتسجيل حالة صحية جديدة.',
        target: '.action-btn.primary', position: 'bottom' },
      { title: '🔍 البحث والفلترة', body: 'يمكنك فلترة السجلات بالحيوان أو الحالة (نشط / منتهي).',
        target: '.filter-btn', position: 'bottom' },
    ],
    animals: [
      { title: '🐐 إدارة القطيع', body: 'قائمة كاملة بكل حيوانات المزرعة.',
        target: '#page-header', position: 'bottom' },
      { title: '🔍 بحث ذكي', body: 'ابحث بالترقيم، السلالة، أو الجمالون.',
        target: '#gs-overlay', position: 'bottom' },
      { title: '📊 بيانات متكاملة', body: 'زرار "بيانات" يفتح قائمة للاستيراد والتصدير.',
        target: '#data-menu-wrap', position: 'bottom' },
    ],
  };

  // ── Core: start tour ─────────────────────────────────────────
  function start(role, onDone) {
    var steps = TOURS[role] || TOURS.admin;
    _steps   = steps;
    _current = 0;
    _onDone  = onDone || null;
    injectStyles();
    buildOverlay();
    showStep(0);
  }

  function startPage(pageKey, onDone) {
    var steps = PAGE_TOURS[pageKey];
    if (!steps) return;
    _steps   = steps;
    _current = 0;
    _onDone  = onDone || null;
    injectStyles();
    buildOverlay();
    showStep(0);
  }

  // ── Auto-start for first-time users ──────────────────────────
  function autoStart() {
    var u = typeof getUser === 'function' ? getUser() : null;
    if (!u) return;
    var key = 'farm_tour_done_' + (u.role || 'admin');
    if (localStorage.getItem(key)) return;
    // Delay to let page render
    setTimeout(function() {
      start(u.role || 'admin', function() {
        localStorage.setItem(key, '1');
      });
    }, 800);
  }

  // ── DOM building ─────────────────────────────────────────────
  function buildOverlay() {
    if (_overlay) _overlay.remove();

    _overlay = document.createElement('div');
    _overlay.id = 'farm-tour-overlay';
    _overlay.style.cssText = [
      'position:fixed','inset:0','z-index:9999',
      'pointer-events:none', // clicks pass through except on tooltip/buttons
    ].join(';');

    // Backdrop
    var backdrop = document.createElement('div');
    backdrop.id = 'farm-tour-backdrop';
    backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:1';

    // Spotlight (transparent hole in backdrop)
    _spotlight = document.createElement('div');
    _spotlight.id = 'farm-tour-spotlight';
    _spotlight.style.cssText = [
      'position:fixed','z-index:2','border-radius:12px',
      'box-shadow:0 0 0 9999px rgba(0,0,0,.65)',
      'transition:all var(--motion-duration-base) var(--motion-easing-standard)',
      'pointer-events:none',
    ].join(';');

    // Tooltip
    _tooltip = document.createElement('div');
    _tooltip.id = 'farm-tour-tooltip';
    _tooltip.setAttribute('role', 'dialog');
    _tooltip.setAttribute('aria-live', 'polite');
    _tooltip.style.cssText = [
      'position:fixed','z-index:3','max-width:360px','width:90vw',
      'background:var(--surface-raised)','border:1px solid var(--border-strong)',
      'border-radius:18px','padding:20px',
      'box-shadow:0 16px 48px rgba(0,0,0,.5)',
      'font-family:Cairo,sans-serif','pointer-events:all',
      'transition:all var(--motion-duration-base) var(--motion-easing-decel)',
    ].join(';');

    _overlay.appendChild(backdrop);
    _overlay.appendChild(_spotlight);
    _overlay.appendChild(_tooltip);
    document.body.appendChild(_overlay);
  }

  function showStep(idx) {
    if (idx >= _steps.length) { done(); return; }
    _current = idx;
    var step = _steps[idx];
    var total = _steps.length;

    // Highlight target
    var targetEl = step.target ? document.querySelector(step.target) : null;
    if (targetEl) {
      var rect = targetEl.getBoundingClientRect();
      var pad  = 8;
      _spotlight.style.left   = (rect.left - pad) + 'px';
      _spotlight.style.top    = (rect.top  - pad) + 'px';
      _spotlight.style.width  = (rect.width  + pad*2) + 'px';
      _spotlight.style.height = (rect.height + pad*2) + 'px';
      _spotlight.style.display = 'block';
    } else {
      _spotlight.style.display = 'none';
    }

    // Build tooltip content
    var stepDots = '';
    for (var i = 0; i < total; i++) {
      stepDots += '<span style="display:inline-block;width:' + (i === idx ? '18px' : '8px') + ';height:8px;border-radius:4px;' +
        'background:' + (i === idx ? 'var(--color-interactive)' : 'var(--border-strong)') + ';' +
        'transition:.3s;margin-left:4px;vertical-align:middle"></span>';
    }

    _tooltip.innerHTML = [
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">',
        '<div style="font-size:.7rem;font-weight:700;color:var(--color-text-disabled)">' +
          'الخطوة ' + (idx+1) + ' من ' + total +
        '</div>',
        '<button onclick="FarmTour.skip()" style="background:transparent;border:none;',
          'color:var(--color-text-disabled);cursor:pointer;font-size:1.1rem;padding:2px 6px;',
          'border-radius:6px;transition:.2s;font-family:Cairo,sans-serif;" aria-label="تخطي الجولة">✕</button>',
      '</div>',
      '<h4 style="font-size:1.05rem;font-weight:800;color:var(--color-text-primary);margin-bottom:10px">' + step.title + '</h4>',
      '<p style="font-size:.85rem;color:var(--color-text-secondary);line-height:1.7;margin-bottom:18px">' + step.body + '</p>',
      '<div style="text-align:center;margin-bottom:14px">' + stepDots + '</div>',
      '<div style="display:flex;gap:8px;justify-content:space-between">',
        (idx > 0 ? '<button onclick="FarmTour.prev()" style="background:var(--surface-overlay);border:1px solid var(--border-default);' +
          'color:var(--color-text-secondary);border-radius:10px;padding:9px 18px;cursor:pointer;font-family:Cairo,sans-serif;" aria-label="الخطوة السابقة"><i class="bi bi-arrow-right me-1"></i>السابق</button>'
          : '<div></div>'),
        '<button onclick="FarmTour.next()" style="background:var(--btn-primary-bg);border:none;color:#fff;' +
          'border-radius:10px;padding:9px 24px;cursor:pointer;font-family:Cairo,sans-serif;font-weight:700;' +
          'box-shadow:0 4px 14px rgba(255,107,53,.4);" aria-label="' + (idx === total-1 ? 'إنهاء الجولة' : 'الخطوة التالية') + '">' +
          (idx === total-1 ? 'إنهاء ✓' : 'التالي <i class="bi bi-arrow-left ms-1"></i>') +
        '</button>',
      '</div>',
    ].join('');

    // Position tooltip
    positionTooltip(targetEl, step.position);

    // Keyboard
    document.addEventListener('keydown', onKey);
  }

  function positionTooltip(targetEl, position) {
    var tt = _tooltip;
    var vw = window.innerWidth, vh = window.innerHeight;

    if (!targetEl || position === 'center') {
      tt.style.top    = '50%';
      tt.style.left   = '50%';
      tt.style.transform = 'translate(-50%, -50%)';
      return;
    }

    tt.style.transform = '';
    var rect = targetEl.getBoundingClientRect();
    var ttH  = 280; // estimated
    var ttW  = Math.min(360, vw * 0.9);

    // Try below first
    if (rect.bottom + ttH + 16 < vh) {
      tt.style.top  = (rect.bottom + 16) + 'px';
      tt.style.left = Math.max(16, Math.min(rect.left, vw - ttW - 16)) + 'px';
    } else if (rect.top - ttH - 16 > 0) {
      tt.style.top  = (rect.top - ttH - 16) + 'px';
      tt.style.left = Math.max(16, Math.min(rect.left, vw - ttW - 16)) + 'px';
    } else {
      // Center fallback
      tt.style.top  = '50%';
      tt.style.left = '50%';
      tt.style.transform = 'translate(-50%,-50%)';
    }
  }

  function onKey(e) {
    if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    if (e.key === 'ArrowLeft')  prev();
    if (e.key === 'Escape')     skip();
  }

  function done() {
    cleanup();
    if (_onDone) _onDone();
    toast('✅ اكتملت الجولة التعريفية');
  }

  function cleanup() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
    document.removeEventListener('keydown', onKey);
  }

  function injectStyles() {
    if (document.getElementById('farm-tour-styles')) return;
    var s = document.createElement('style');
    s.id = 'farm-tour-styles';
    s.textContent = '#farm-tour-tooltip button:hover{opacity:.85!important;}';
    document.head.appendChild(s);
  }

  // Public API
  return {
    start:     start,
    startPage: startPage,
    autoStart: autoStart,
    next:  function() { showStep(_current + 1); document.removeEventListener('keydown', onKey); },
    prev:  function() { showStep(_current - 1); document.removeEventListener('keydown', onKey); },
    skip:  function() { done(); },
    resetAll: function() {
      ['admin','supervisor','vet','worker','visitor'].forEach(function(r) {
        localStorage.removeItem('farm_tour_done_' + r);
      });
      toast('تم إعادة ضبط الجولات — ستبدأ عند الدخول التالي');
    },
  };
})();
