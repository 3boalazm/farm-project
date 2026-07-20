'use strict';
// ══════════════════════════════════════════════════════════════
//  FARM ARABIC DATE PICKER — RTL, Dark/Light, Keyboard nav
//  Usage: FarmDatePicker.open(inputEl, options)
//  Options: { minDate, maxDate, highlightDates:[], onSelect }
// ══════════════════════════════════════════════════════════════
var FarmDatePicker = (function() {

  var _input     = null;   // target input element
  var _opts      = {};     // options
  var _viewYear  = null;   // currently displayed year
  var _viewMonth = null;   // currently displayed month (0-11)
  var _selected  = null;   // selected Date
  var _overlay   = null;   // the DOM overlay

  var MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                   'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var DAYS_AR   = ['أح','إث','ثل','أر','خم','جم','سب'];

  // ── Public: open ───────────────────────────────────────────
  function open(inputEl, opts) {
    _input = inputEl;
    _opts  = opts || {};

    var initVal = _input.value;
    if (initVal) {
      var d = new Date(initVal);
      if (!isNaN(d)) {
        _selected  = d;
        _viewYear  = d.getFullYear();
        _viewMonth = d.getMonth();
      }
    }
    if (!_viewYear) {
      var now = new Date();
      _viewYear  = now.getFullYear();
      _viewMonth = now.getMonth();
    }

    // Remove existing overlay
    if (_overlay) _overlay.remove();

    _overlay = document.createElement('div');
    _overlay.id = 'farm-dp-overlay';
    _overlay.setAttribute('role', 'dialog');
    _overlay.setAttribute('aria-label', 'منتقي التاريخ');
    _overlay.setAttribute('aria-modal', 'true');
    _overlay.style.cssText = [
      'position:fixed','inset:0','z-index:9500','display:flex',
      'align-items:flex-start','justify-content:center','padding-top:80px',
      'background:rgba(0,0,0,.55)','backdrop-filter:blur(3px)',
    ].join(';');
    _overlay.addEventListener('click', function(e) {
      if (e.target === _overlay) close();
    });
    _overlay.innerHTML = buildCalendarHTML();
    document.body.appendChild(_overlay);
    bindEvents();

    // Position near input if possible
    if (_input) {
      var rect = _input.getBoundingClientRect();
      var cal  = _overlay.querySelector('#farm-dp-cal');
      if (cal && rect.bottom + 360 < window.innerHeight) {
        _overlay.style.paddingTop = (rect.bottom + 4) + 'px';
        _overlay.style.alignItems = 'flex-start';
      }
    }

    // Focus first button
    setTimeout(function() {
      var first = _overlay.querySelector('button');
      if (first) first.focus();
    }, 60);
  }

  // ── Build HTML ──────────────────────────────────────────────
  function buildCalendarHTML() {
    var today     = new Date();
    var firstDay  = new Date(_viewYear, _viewMonth, 1);
    var lastDay   = new Date(_viewYear, _viewMonth + 1, 0);
    var startDow  = (firstDay.getDay() + 1) % 7; // RTL: Sat start = 6 → 0
    // In Arabic calendar Sunday = first, Saturday = last
    var startPad  = firstDay.getDay(); // 0=Sun ... 6=Sat

    // Quick presets
    var presets = [
      { label: 'اليوم',       offset: 0  },
      { label: 'أمس',         offset: -1 },
      { label: 'قبل أسبوع',   offset: -7 },
      { label: 'قبل شهر',     offset: -30 },
    ];

    var presetHTML = presets.map(function(p) {
      var d = new Date(today);
      d.setDate(d.getDate() + p.offset);
      var ds = d.toISOString().slice(0,10);
      var disabled = isDisabled(d) ? ' disabled style="opacity:.4"' : '';
      return '<button class="dp-preset" data-date="' + ds + '"' + disabled + '>' + p.label + '</button>';
    }).join('');

    // Calendar grid
    var cells = '';
    // Header: day names
    cells += '<tr>' + DAYS_AR.map(function(d) {
      return '<th class="dp-dayname">' + d + '</th>';
    }).join('') + '</tr><tr>';

    // Padding cells
    for (var p = 0; p < startPad; p++) {
      cells += '<td class="dp-empty"></td>';
    }

    var col = startPad;
    for (var day = 1; day <= lastDay.getDate(); day++) {
      var dt      = new Date(_viewYear, _viewMonth, day);
      var ds      = dt.toISOString().slice(0,10);
      var isToday = sameDay(dt, today);
      var isSel   = _selected && sameDay(dt, _selected);
      var isHigh  = isHighlighted(dt);
      var isDis   = isDisabled(dt);
      var cls     = 'dp-day' +
        (isToday ? ' dp-today' : '') +
        (isSel   ? ' dp-selected' : '') +
        (isHigh  ? ' dp-highlighted' : '') +
        (isDis   ? ' dp-disabled' : '');
      cells += '<td><button class="' + cls + '"' +
        (isDis ? ' disabled' : '') +
        ' data-date="' + ds + '"' +
        ' aria-label="' + day + ' ' + MONTHS_AR[_viewMonth] + ' ' + _viewYear + '"' +
        (isSel ? ' aria-selected="true"' : '') +
        '>' + day + '</button></td>';

      col++;
      if (col % 7 === 0 && day < lastDay.getDate()) {
        cells += '</tr><tr>';
      }
    }

    // Fill remaining cells
    while (col % 7 !== 0) {
      cells += '<td class="dp-empty"></td>';
      col++;
    }
    cells += '</tr>';

    return '<div id="farm-dp-cal" role="dialog" style="' +
      'background:var(--surface-raised);' +
      'border:1px solid var(--border-strong);' +
      'border-radius:18px;padding:0;width:320px;max-width:95vw;' +
      'box-shadow:0 24px 64px rgba(0,0,0,.5);' +
      'font-family:Cairo,sans-serif;overflow:hidden;' +
    '">' +

      // ── Header ────────────────────────────────────────────
      '<div style="display:flex;align-items:center;justify-content:space-between;' +
        'padding:14px 16px;border-bottom:1px solid var(--border-default);">' +
        '<button id="dp-prev" aria-label="الشهر السابق" style="' +
          'background:var(--surface-overlay);border:1px solid var(--border-default);' +
          'border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--color-text-primary);' +
          'display:flex;align-items:center;justify-content:center;font-size:1rem;transition:.2s;' +
        '"><i class="bi bi-chevron-right"></i></button>' +

        '<div style="text-align:center">' +
          '<div style="font-weight:800;font-size:1rem;color:var(--color-text-primary)">' +
            MONTHS_AR[_viewMonth] + ' ' + _viewYear +
          '</div>' +
        '</div>' +

        '<button id="dp-next" aria-label="الشهر التالي" style="' +
          'background:var(--surface-overlay);border:1px solid var(--border-default);' +
          'border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--color-text-primary);' +
          'display:flex;align-items:center;justify-content:center;font-size:1rem;transition:.2s;' +
        '"><i class="bi bi-chevron-left"></i></button>' +
      '</div>' +

      // ── Presets ────────────────────────────────────────────
      '<div style="display:flex;gap:6px;padding:10px 14px;flex-wrap:wrap;border-bottom:1px solid var(--border-subtle)">' +
        presetHTML +
      '</div>' +

      // ── Calendar grid ──────────────────────────────────────
      '<div style="padding:10px 14px">' +
        '<table style="width:100%;border-collapse:separate;border-spacing:3px" role="grid" aria-label="التقويم">' +
          cells +
        '</table>' +
      '</div>' +

      // ── Actions ────────────────────────────────────────────
      '<div style="display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--border-subtle);justify-content:flex-end">' +
        '<button id="dp-clear" style="background:transparent;border:1px solid var(--border-default);' +
          'color:var(--color-text-tertiary);border-radius:10px;padding:7px 16px;cursor:pointer;' +
          'font-family:Cairo,sans-serif;transition:.2s;" aria-label="مسح التاريخ">مسح</button>' +
        '<button id="dp-close" style="background:var(--btn-primary-bg);border:none;color:#fff;' +
          'border-radius:10px;padding:7px 20px;cursor:pointer;font-family:Cairo,sans-serif;' +
          'font-weight:700;transition:.2s;" aria-label="تأكيد">تأكيد</button>' +
      '</div>' +
    '</div>';
  }

  // ── Styles (injected once) ──────────────────────────────────
  function injectStyles() {
    if (document.getElementById('farm-dp-styles')) return;
    var s = document.createElement('style');
    s.id  = 'farm-dp-styles';
    s.textContent = [
      '.dp-dayname{text-align:center;font-size:.65rem;font-weight:700;color:var(--color-text-disabled);padding:4px 0}',
      '.dp-day{width:36px;height:36px;border-radius:50%;border:none;background:transparent;',
        'color:var(--color-text-primary);cursor:pointer;font-family:Cairo,sans-serif;',
        'font-size:.82rem;transition:background var(--motion-duration-fast) var(--motion-easing-standard);',
        'display:flex;align-items:center;justify-content:center;margin:0 auto;}',
      '.dp-day:hover:not(:disabled){background:var(--surface-overlay);}',
      '.dp-today{color:var(--color-interactive);font-weight:800;}',
      '.dp-today::after{content:"";display:block;width:4px;height:4px;border-radius:50%;',
        'background:var(--color-interactive);margin:-2px auto 0;}',
      '.dp-selected{background:var(--btn-primary-bg)!important;color:#fff!important;font-weight:700;}',
      '.dp-highlighted{background:var(--badge-warning-bg);color:var(--color-warning);}',
      '.dp-disabled{opacity:.3;cursor:not-allowed;}',
      '.dp-empty{pointer-events:none;}',
      '.dp-preset{background:var(--surface-overlay);border:1px solid var(--border-default);',
        'color:var(--color-text-secondary);border-radius:20px;padding:4px 10px;cursor:pointer;',
        'font-family:Cairo,sans-serif;font-size:.72rem;transition:.2s;}',
      '.dp-preset:hover{background:var(--badge-info-bg);color:var(--color-info);border-color:var(--color-info);}',
    ].join('');
    document.head.appendChild(s);
  }

  // ── Bind events ─────────────────────────────────────────────
  function bindEvents() {
    _overlay.querySelector('#dp-prev').addEventListener('click', function() {
      _viewMonth--;
      if (_viewMonth < 0) { _viewMonth = 11; _viewYear--; }
      refresh();
    });
    _overlay.querySelector('#dp-next').addEventListener('click', function() {
      _viewMonth++;
      if (_viewMonth > 11) { _viewMonth = 0; _viewYear++; }
      refresh();
    });
    _overlay.querySelector('#dp-clear').addEventListener('click', function() {
      if (_input) _input.value = '';
      _selected = null;
      if (_opts.onSelect) _opts.onSelect('');
      close();
    });
    _overlay.querySelector('#dp-close').addEventListener('click', close);

    // Day clicks
    _overlay.querySelectorAll('.dp-day:not(:disabled)').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var ds = this.dataset.date;
        if (_input) _input.value = ds;
        _selected = new Date(ds);
        if (_opts.onSelect) _opts.onSelect(ds);
        close();
      });
    });

    // Preset clicks
    _overlay.querySelectorAll('.dp-preset:not(:disabled)').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var ds = this.dataset.date;
        if (_input) _input.value = ds;
        _selected = new Date(ds);
        if (_opts.onSelect) _opts.onSelect(ds);
        close();
      });
    });

    // Keyboard navigation
    document.addEventListener('keydown', onKeydown);
  }

  function onKeydown(e) {
    if (!_overlay) return;
    if (e.key === 'Escape') { close(); return; }
  }

  function refresh() {
    if (_overlay) {
      _overlay.innerHTML = buildCalendarHTML();
      bindEvents();
    }
  }

  function close() {
    if (_overlay) { _overlay.remove(); _overlay = null; }
    document.removeEventListener('keydown', onKeydown);
  }

  // ── Helpers ─────────────────────────────────────────────────
  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth()    === b.getMonth() &&
           a.getDate()     === b.getDate();
  }

  function isDisabled(dt) {
    if (_opts.minDate && dt < new Date(_opts.minDate)) return true;
    if (_opts.maxDate && dt > new Date(_opts.maxDate)) return true;
    return false;
  }

  function isHighlighted(dt) {
    if (!_opts.highlightDates || !_opts.highlightDates.length) return false;
    return _opts.highlightDates.some(function(d) { return sameDay(new Date(d), dt); });
  }

  // ── Auto-init on all date inputs ─────────────────────────────
  function initAll() {
    injectStyles();
    document.addEventListener('click', function(e) {
      var el = e.target;
      if (el.tagName === 'INPUT' && el.type === 'date') {
        e.preventDefault();
        open(el, {});
        return false;
      }
    });
  }

  // Public API
  return { open: open, close: close, initAll: initAll, injectStyles: injectStyles };

})();

// Auto-init when DOM ready
document.addEventListener('DOMContentLoaded', function() {
  FarmDatePicker.initAll();
});
