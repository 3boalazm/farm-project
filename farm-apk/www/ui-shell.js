/* ══════════════════════════════════════════════════════════════════════
   ui-shell.js — the application shell (Design System v2 companion)
   ──────────────────────────────────────────────────────────────────────
   One file owns everything that is the SAME on all 37 pages, so a page
   only has to render its own content:

     • APPBAR        fixed, blurred: breadcrumbs · page title · search
                     trigger · quick-add · notifications · theme · user menu
     • COMMAND ⌘K    fuzzy palette over pages, actions, quick-add and the
                     herd — the keyboard-first way through the product
     • NOTIF CENTER  the bell, as a panel: grouped, unread-barred, deep-linked
     • BOTTOM NAV    five thumb-reach destinations below 992px
     • TOASTS v2     titled, actionable (UNDO), timed, aria-live, deduped
     • PREFS         theme (dark/light/auto) · density · contrast · motion,
                     persisted and applied before first paint
     • TABLES        client-side sorting (Arabic-Indic aware), sticky heads,
                     filter binding, result counts
     • BUSY BAR      a 2px indeterminate line while Firebase requests fly

   Integration contract (nothing here is required by a page):
     • shared.js calls UIShell.mount({activePage}) at the end of
       renderNavbarV2(). If ui-shell.js is absent, the app renders exactly
       as it did before — the shell is strictly additive.
     • window.toast is REPLACED by an enhanced version with the same
       (msg, type) signature, so all ~140 existing call sites upgrade at
       once and keep working unchanged.
     • Preferences are read by the inline head script on every page before
       first paint (no flash of the wrong theme/density).
   ══════════════════════════════════════════════════════════════════════ */
'use strict';
(function (root) {
  if (root.UIShell) return;                     // idempotent: one shell only

  var VERSION = '2.0.0';

  /* ── Tiny helpers ─────────────────────────────────────────────────── */
  var doc = function () { return document; };
  function $(sel, scope) { return (scope || document).querySelector(sel); }
  function $$(sel, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(sel)); }
  function el(tag, attrs, html) {
    var n = doc().createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    });
    if (html !== undefined && html !== null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s === null || s === undefined ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safe(fn, fallback) { try { return fn(); } catch (e) { return fallback; } }
  function store(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { /* private mode / quota: preferences are a luxury, not a need */ }
    return null;
  }
  function json(key, fallback) { return safe(function () { return JSON.parse(store(key)) || fallback; }, fallback); }
  function num(v) {
    // Arabic-Indic and extended Arabic-Indic digits → ASCII, so "١٢٫٥" sorts
    // as 12.5 and every table column in this product sorts correctly.
    if (typeof v === 'number') return v;
    var s = String(v === null || v === undefined ? '' : v)
      .replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x0660; })
      .replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 0x06f0; })
      .replace(/[٫،]/g, '.').replace(/[^\d.\-]/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function can(perm) { try { return root.can ? !!root.can(perm) : true; } catch (e) { return true; } }
  function getUser() { return safe(function () { return root.getUser ? root.getUser() : null; }, null); }
  function navFlat() {
    var out = [];
    (root.FARM_NAV || []).forEach(function (sec) {
      (sec.items || []).forEach(function (it) { out.push({ section: sec.section, item: it }); });
    });
    return out;
  }


  /* ── O-02 · archived pages are labelled wherever the shell renders nav ──
     bayan.html is a static snapshot dated ٢٠٢٦/٠٤/٢٤ that the main navigation
     used to present as a live view. FARM_NAV now carries `archive:true` for
     it, and this stamps every link to that page — rail, bottom nav, legacy
     sidebar, breadcrumbs — with a pill and a tooltip. One place, no markup
     edits in 34 pages. */
  function markArchivedNav() {
    var notes = {};
    navFlat().forEach(function (x) {
      if (x.item && x.item.archive) notes[x.item.href] = x.item.archiveNote || 'أرشيف — بيانات ثابتة';
    });
    Object.keys(notes).forEach(function (href) {
      var links = doc().querySelectorAll('a[href="' + href + '"]');
      Array.prototype.forEach.call(links, function (a) {
        a.setAttribute('title', notes[href]);
        if (a.querySelector('.nav-archive-pill')) return;
        var pill = doc().createElement('span');
        pill.className = 'nav-archive-pill';
        pill.textContent = 'أرشيف';
        pill.setAttribute('aria-label', notes[href]);
        a.appendChild(pill);
      });
    });
  }

  /* ══════════════════════════════════════════════════════════════════
     1 · PREFERENCES — theme, density, contrast, motion
     Written to <html> as attributes so CSS (§3/§4 of ui.css) does the rest.
     The class `light-mode` is kept in sync because 700 lines of styles.css
     and 37 pages already key off it.
     ══════════════════════════════════════════════════════════════════ */
  var PREF_KEYS = { theme: 'farm_theme', density: 'farm_density', contrast: 'farm_contrast', motion: 'farm_motion' };
  var THEMES = ['dark', 'light', 'auto'];
  var DENSITIES = [
    { id: 'compact', label: 'مضغوط', icon: 'bi-list-nested', hint: 'صفوف أكثر على الشاشة — مناسب للموبايل والعمل الميداني' },
    { id: 'cozy', label: 'متوسط', icon: 'bi-distribute-vertical', hint: 'التوازن الافتراضي بين الكثافة والوضوح' },
    { id: 'comfortable', label: 'مريح', icon: 'bi-arrows-expand', hint: 'مسافات أوسع — مناسب لشاشة المكتب والقراءة الطويلة' }
  ];
  var mq = null;
  try { mq = root.matchMedia ? root.matchMedia('(prefers-color-scheme: light)') : null; } catch (e) { mq = null; }

  var Prefs = {
    get: function (k) {
      if (k === 'theme') {
        var t = store(PREF_KEYS.theme);
        // Legacy semantics, preserved exactly: the head script and initTheme()
        // only ever stored 'light' or 'dark' and treated ANY other value
        // (including a corrupt one) as dark. 'auto' is the new third option and
        // is opt-in from the palette / preferences dialog.
        return (t === 'light' || t === 'auto') ? t : 'dark';
      }
      if (k === 'density') return store(PREF_KEYS.density) || 'cozy';
      if (k === 'contrast') return store(PREF_KEYS.contrast) || 'normal';
      if (k === 'motion') return store(PREF_KEYS.motion) || 'on';
      return null;
    },
    resolvedTheme: function () {
      var t = Prefs.get('theme');
      if (t !== 'auto') return t;
      return (mq && mq.matches) ? 'light' : 'dark';
    },
    apply: function () {
      var h = doc().documentElement;
      var theme = Prefs.get('theme'), resolved = Prefs.resolvedTheme();
      h.setAttribute('data-theme', resolved);
      // legacy class kept in lockstep: styles.css and page <style> blocks use it
      h.classList.toggle('light-mode', resolved === 'light');
      if (doc().body) doc().body.classList.toggle('light-mode', resolved === 'light');
      // The CHOICE (including 'auto') is recorded separately from the resolved
      // theme, so the UI can say "تلقائي" while the CSS applies dark.
      h.setAttribute('data-theme-choice', theme);
      h.setAttribute('data-density', Prefs.get('density'));
      var c = Prefs.get('contrast');
      if (c === 'high') h.setAttribute('data-contrast', 'high'); else h.removeAttribute('data-contrast');
      var m = Prefs.get('motion');
      if (m === 'off') h.setAttribute('data-motion', 'off'); else h.removeAttribute('data-motion');
      // <meta name="theme-color"> so the browser chrome matches the app
      $$('meta[name="theme-color"]').forEach(function (meta) {
        var light = /light/.test(meta.getAttribute('media') || '');
        meta.setAttribute('content', (light === (resolved === 'light')) ? (resolved === 'light' ? '#f4f6fb' : '#04081a') : meta.getAttribute('content'));
      });
      Prefs._paintIcon();
    },
    set: function (k, v) {
      store(PREF_KEYS[k], v);
      Prefs.apply();
      try { root.dispatchEvent(new CustomEvent('ui:pref', { detail: { key: k, value: v } })); } catch (e) {}
    },
    cycleTheme: function () {
      var i = THEMES.indexOf(Prefs.get('theme'));
      var next = THEMES[(i + 1) % THEMES.length];
      Prefs.set('theme', next);
      var label = next === 'dark' ? 'الوضع الداكن' : next === 'light' ? 'الوضع الفاتح' : 'مظهر النظام';
      Toast.push('المظهر: ' + label, 'info', { duration: 1800, icon: 'bi-circle-half' });
      return next;
    },
    toggleTheme: function () {                 // keeps the legacy 2-state toggle
      Prefs.set('theme', Prefs.resolvedTheme() === 'light' ? 'dark' : 'light');
    },
    _paintIcon: function () {
      var resolved = Prefs.resolvedTheme(), theme = Prefs.get('theme');
      var glyph = theme === 'auto' ? 'bi-circle-half' : (resolved === 'light' ? 'bi-sun-fill' : 'bi-moon-stars-fill');
      $$('#theme-icon,[data-theme-icon]').forEach(function (ic) { ic.className = 'bi ' + glyph; });
      var btn = $('#uiThemeBtn');
      if (btn) btn.setAttribute('aria-label', 'المظهر: ' + (theme === 'auto' ? 'تلقائي حسب النظام' : resolved === 'light' ? 'فاتح' : 'داكن'));
    }
  };
  // The legacy global keeps working (it is called from 37 pages of markup).
  root.toggleTheme = function () { Prefs.toggleTheme(); if (root.updateThemeIcon) safe(root.updateThemeIcon); };
  if (mq && mq.addEventListener) { try { mq.addEventListener('change', function () { if (Prefs.get('theme') === 'auto') Prefs.apply(); }); } catch (e) {} }

  /* ══════════════════════════════════════════════════════════════════
     2 · TOASTS v2
     Replaces window.toast. Same 2-arg signature, plus an options object:
       Toast.push(msg, type, {title, duration, icon, action:{label,onClick}, id})
     Deduped by `id`, max 4 on screen, aria-live polite, and an UNDO action
     that finally gives the dead Undo feature (F-06) a visible home.
     ══════════════════════════════════════════════════════════════════ */
  var ICONS = {
    success: 'bi-check-circle-fill', error: 'bi-x-octagon-fill', danger: 'bi-x-octagon-fill',
    warning: 'bi-exclamation-triangle-fill', info: 'bi-info-circle-fill',
    loading: 'bi-arrow-repeat', undo: 'bi-arrow-counterclockwise'
  };
  var Toast = {
    MAX: 4,
    wrap: function () {
      var w = $('#toast-wrap');
      if (!w) { w = el('div', { id: 'toast-wrap', class: 'toast-wrap', role: 'region', 'aria-label': 'التنبيهات' }); doc().body.appendChild(w); }
      if (!w.getAttribute('aria-live')) { w.setAttribute('aria-live', 'polite'); w.setAttribute('aria-atomic', 'false'); }
      return w;
    },
    push: function (msg, type, opts) {
      type = type || 'success';
      opts = opts || {};
      var wrap = Toast.wrap();
      if (opts.id) {
        // Same id twice = replace, never stack: a page polling a write shows
        // one evolving toast instead of four identical ones.
        var dup = wrap.querySelector('[data-toast-id="' + String(opts.id).replace(/"/g, '') + '"]');
        if (dup) dup.remove();
      }
      while (wrap.children.length >= Toast.MAX) wrap.firstElementChild.remove();

      var t = el('div', {
        class: 'toast toast--' + type + (opts.className ? ' ' + opts.className : ''),
        role: type === 'error' || type === 'danger' ? 'alert' : 'status',
        'data-toast-id': opts.id || null
      });
      var icon = opts.icon || ICONS[type] || ICONS.info;
      var dur = opts.duration === undefined ? (type === 'error' || type === 'danger' ? 6500 : 3800) : opts.duration;

      t.innerHTML =
        '<i class="bi ' + esc(icon) + ' toast__icon"></i>' +
        '<div class="toast__body">' +
        (opts.title ? '<div class="toast__title">' + esc(opts.title) + '</div>' : '') +
        '<div class="toast__msg">' + esc(msg) + '</div>' +
        '</div>' +
        (opts.action && opts.action.label ? '<button type="button" class="toast__action">' + esc(opts.action.label) + '</button>' : '') +
        '<button type="button" class="toast__close" aria-label="إغلاق التنبيه"><i class="bi bi-x-lg"></i></button>' +
        (dur > 0 ? '<span class="toast__timer" style="animation-duration:' + dur + 'ms"></span>' : '');

      var timer = null;
      function dismiss() {
        if (t.classList.contains('is-leaving')) return;
        t.classList.add('is-leaving');
        clearTimeout(timer);
        setTimeout(function () { t.remove(); }, 220);
      }
      var closeBtn = $('.toast__close', t);
      if (closeBtn) closeBtn.addEventListener('click', dismiss);
      var actBtn = $('.toast__action', t);
      if (actBtn) actBtn.addEventListener('click', function () { safe(function () { opts.action.onClick && opts.action.onClick(); }); dismiss(); });
      if (dur > 0) timer = setTimeout(dismiss, dur);
      // Hovering pauses the countdown — a toast you are reading must not vanish.
      t.addEventListener('mouseenter', function () { clearTimeout(timer); var tb = $('.toast__timer', t); if (tb) tb.style.animationPlayState = 'paused'; });
      t.addEventListener('mouseleave', function () {
        if (dur > 0) { timer = setTimeout(dismiss, Math.max(900, dur / 2)); var tb = $('.toast__timer', t); if (tb) tb.style.animationPlayState = 'running'; }
      });
      wrap.appendChild(t);
      if (opts.onMount) safe(function () { opts.onMount(t); });
      return { el: t, dismiss: dismiss };
    },
    undo: function (msg, onUndo, opts) {
      opts = opts || {};
      opts.action = { label: 'تراجع', onClick: onUndo };
      opts.icon = opts.icon || ICONS.undo;
      return Toast.push(msg, opts.type || 'success', opts);
    }
  };
  // The app-wide toast() now routes here. Signature-compatible with the old
  // toast(msg, type) — and it still escapes, so no call site can inject HTML.
  root.toast = function (msg, type, opts) { return Toast.push(msg, type || 'success', opts || {}); };

  /* ══════════════════════════════════════════════════════════════════
     3 · FOCUS UTILITIES (shared by palette, menus, dialogs)
     ══════════════════════════════════════════════════════════════════ */
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  function trap(container, e) {
    if (e.key !== 'Tab') return;
    var f = $$(FOCUSABLE, container).filter(function (n) { return n.offsetParent !== null || n === doc().activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc().activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc().activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function closeOnOutside(node, close, e) {
    if (!node.contains(e.target)) close();
  }

  /* ══════════════════════════════════════════════════════════════════
     4 · COMMAND PALETTE (⌘K)
     Sources are pluggable: Palette.register() lets any page add its own
     commands without touching this file (pages/*.js already do this for
     "افتح حيوان", "سجّل وزن"…).
     ══════════════════════════════════════════════════════════════════ */
  var ARABIC_FOLD = /[\u064B-\u0652\u0670\u0640]/g;   // harakat, superscript alef, tatweel
  function fold(s) {
    return String(s || '').replace(ARABIC_FOLD, '')
      .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي').replace(/ة/g, 'ه').toLowerCase().trim();
  }
  // Subsequence fuzzy match: returns {score, ranges} or null.
  // Consecutive hits and hits at word starts score far higher, which is what
  // makes "مول" surface "المواليد" first and "حس" surface "حاسبة التكاليف".
  function fuzzy(query, text) {
    var q = fold(query), t = fold(text);
    if (!q) return { score: 0, ranges: [] };
    if (t === q) return { score: 1000, ranges: [[0, t.length]] };
    var idx = t.indexOf(q);
    if (idx === 0) return { score: 800 - Math.min(t.length, 40), ranges: [[0, q.length]] };
    if (idx > 0) return { score: 620 - idx - Math.min(t.length, 40) * 0.2, ranges: [[idx, idx + q.length]] };
    var qi = 0, ranges = [], start = -1, score = 0, prevHit = -2, firstHit = -1;
    for (var ti = 0; ti < t.length && qi < q.length; ti++) {
      if (t[ti] === q[qi]) {
        if (start < 0) start = ti;
        if (firstHit < 0) firstHit = ti;
        score += (ti === prevHit + 1) ? 14 : 6;              // consecutive hits are worth more
        if (ti === 0 || /[\s\-_/.]/.test(t[ti - 1])) score += 12;  // word-initial hits too
        prevHit = ti; qi++;
      } else if (start >= 0) { ranges.push([start, prevHit + 1]); start = -1; }
    }
    if (qi < q.length) return null;
    if (start >= 0) ranges.push([start, prevHit + 1]);
    // Gap penalty: the characters SKIPPED between the first and last hit.
    // Without it, "مولد" matched "العملاء والموردون" (م…و…ل…د spread over 16
    // letters) ahead of "المواليد", where the same letters sit inside 6.
    var span = prevHit - firstHit + 1;
    var gaps = Math.max(0, span - q.length);
    var total = score - gaps * 3.2 - t.length * 0.15;
    // A match that had to skip more letters than it consumed is noise, not a
    // result: drop it rather than show it at rank 12 where nobody reads.
    return total < 8 ? null : { score: total, ranges: ranges };
  }
  function highlight(text, ranges) {
    if (!ranges || !ranges.length) return esc(text);
    var out = '', last = 0;
    ranges.forEach(function (r) {
      out += esc(String(text).slice(last, r[0])) + '<mark>' + esc(String(text).slice(r[0], r[1])) + '</mark>';
      last = r[1];
    });
    return out + esc(String(text).slice(last));
  }

  var RECENT_KEY = 'farm_ui_recent';
  var Palette = {
    open: false, selected: 0, results: [], sources: [], node: null, lastFocus: null,
    register: function (src) {
      // src = {group, priority, items(): [{id,title,sub,icon,keywords,run,href,side}]}
      if (!src || !src.items) return;
      Palette.sources.push(src);
      Palette.sources.sort(function (a, b) { return (b.priority || 0) - (a.priority || 0); });
    },
    recent: function () { return json(RECENT_KEY, []); },
    remember: function (item) {
      if (!item || !item.id) return;
      var list = Palette.recent().filter(function (r) { return r.id !== item.id; });
      list.unshift({ id: item.id, title: item.title, sub: item.sub || '', icon: item.icon || 'bi-arrow-return-left', href: item.href || null, group: item.group || '' });
      store(RECENT_KEY, JSON.stringify(list.slice(0, 7)));
    },
    allItems: function () {
      var out = [];
      Palette.sources.forEach(function (s) {
        var items = safe(function () { return s.items() || []; }, []);
        items.forEach(function (it) {
          if (it.hidden) return;
          if (it.perm && !can(it.perm)) return;
          it = Object.assign({ group: s.group, priority: s.priority || 0 }, it);
          out.push(it);
        });
      });
      return out;
    },
    search: function (q) {
      var items = Palette.allItems();
      if (!q || !q.trim()) {
        var recent = Palette.recent();
        var byId = {};
        items.forEach(function (i) { byId[i.id] = i; });
        var r = recent.map(function (rec) { return byId[rec.id] ? Object.assign({}, byId[rec.id], { title: rec.title, sub: rec.sub, icon: rec.icon, group: 'الأخيرة' }) : null; })
          .filter(Boolean);
        var rest = items.filter(function (i) { return r.every(function (x) { return x.id !== i.id; }); })
          .sort(function (a, b) { return (b.priority || 0) - (a.priority || 0) || String(a.title).localeCompare(String(b.title), 'ar'); });
        return r.concat(rest).slice(0, 40).map(function (i) { return { item: i, ranges: [] }; });
      }
      var scored = [];
      items.forEach(function (i) {
        var best = fuzzy(q, i.title);
        var kw = (i.keywords || []).concat(i.sub ? [i.sub] : []);
        kw.forEach(function (k) {
          var m = fuzzy(q, k);
          if (!m) return;
          var scaled = m.score * 0.72;               // a keyword hit ranks below a title hit
          if (!best || scaled > best.score) best = { score: scaled, ranges: [] };
        });
        if (best && best.score > 0) {
          // Priority is a tie-breaker, not a trump card: a page whose TITLE
          // matches must outrank an action whose description happens to
          // contain the word (that is what makes ⌘K feel like navigation
          // rather than a lucky dip).
          scored.push({ item: i, score: best.score + (i.priority || 0) * 0.15, ranges: best.ranges });
        }
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      return scored.slice(0, 40);
    },
    mount: function () {
      if (Palette.node) return Palette.node;
      var n = el('div', { class: 'palette', id: 'uiPalette', role: 'presentation' });
      n.innerHTML =
        '<div class="palette__panel" role="dialog" aria-modal="true" aria-label="لوحة الأوامر">' +
        '  <div class="palette__input-row">' +
        '    <i class="bi bi-search"></i>' +
        '    <input class="palette__input" id="uiPaletteInput" type="text" autocomplete="off" spellcheck="false"' +
        '           placeholder="ابحث عن صفحة أو إجراء أو حيوان…" aria-controls="uiPaletteList" aria-autocomplete="list"' +
        '           role="combobox" aria-expanded="true">' +
        '    <kbd class="kbd-hint">ESC</kbd>' +
        '  </div>' +
        '  <div class="palette__list" id="uiPaletteList" role="listbox" aria-label="النتائج"></div>' +
        '  <div class="palette__foot">' +
        '    <span class="palette__foot-hint"><kbd>↑</kbd><kbd>↓</kbd> تنقّل</span>' +
        '    <span class="palette__foot-hint"><kbd>Enter</kbd> تنفيذ</span>' +
        '    <span class="palette__foot-hint"><kbd>?</kbd> كل الاختصارات</span>' +
        '    <span class="palette__scope" id="uiPaletteCount"></span>' +
        '  </div>' +
        '</div>';
      n.addEventListener('mousedown', function (e) { if (e.target === n) Palette.close(); });
      doc().body.appendChild(n);
      Palette.node = n;
      var input = $('#uiPaletteInput', n);
      input.addEventListener('input', function () { Palette.render(input.value); });
      input.addEventListener('keydown', Palette.onKey);
      n.addEventListener('keydown', function (e) { trap($('.palette__panel', n), e); });
      return n;
    },
    show: function (prefill) {
      var n = Palette.mount();
      Palette.lastFocus = doc().activeElement;
      Palette.open = true;
      n.classList.add('is-open');
      doc().documentElement.setAttribute('data-palette', 'open');
      var input = $('#uiPaletteInput', n);
      input.value = prefill || '';
      Palette.render(input.value);
      setTimeout(function () { input.focus(); input.select(); }, 10);
    },
    close: function () {
      if (!Palette.node) return;
      Palette.open = false;
      Palette.node.classList.remove('is-open');
      doc().documentElement.removeAttribute('data-palette');
      if (Palette.lastFocus && Palette.lastFocus.focus) safe(function () { Palette.lastFocus.focus(); });
    },
    toggle: function (prefill) { Palette.open ? Palette.close() : Palette.show(prefill); },
    render: function (q) {
      var list = $('#uiPaletteList', Palette.node);
      if (!list) return;
      Palette.results = Palette.search(q);
      Palette.selected = 0;
      if (!Palette.results.length) {
        list.innerHTML = '<div class="palette__empty"><i class="bi bi-search"></i>' +
          '<div>لا نتائج لـ «' + esc(q) + '»</div>' +
          '<div class="t-2xs t-muted">جرّب اسم صفحة، أو رقم حيوان، أو كلمة مثل «وزن» أو «تحصين»</div></div>';
        var cnt = $('#uiPaletteCount', Palette.node); if (cnt) cnt.textContent = '';
        return;
      }
      var html = '', lastGroup = null;
      Palette.results.forEach(function (r, i) {
        var it = r.item;
        if (it.group !== lastGroup) {
          html += '<div class="palette__group" role="presentation">' + esc(it.group || '') + '</div>';
          lastGroup = it.group;
        }
        html += '<button type="button" class="palette__item" role="option" data-i="' + i + '" id="uiPalOpt' + i + '"' +
          ' aria-selected="' + (i === 0 ? 'true' : 'false') + '">' +
          '<i class="bi ' + esc(it.icon || 'bi-arrow-left-short') + ' palette__item-icon"></i>' +
          '<span class="palette__item-text">' +
          '<span class="palette__item-title">' + highlight(it.title, r.ranges) + '</span>' +
          (it.sub ? '<span class="palette__item-sub">' + esc(it.sub) + '</span>' : '') +
          '</span>' +
          (it.side ? '<span class="palette__item-side">' + esc(it.side) + '</span>' : '') +
          '</button>';
      });
      list.innerHTML = html;
      $$('.palette__item', list).forEach(function (b) {
        b.addEventListener('click', function () { Palette.run(parseInt(b.getAttribute('data-i'), 10)); });
        b.addEventListener('mousemove', function () { Palette.select(parseInt(b.getAttribute('data-i'), 10), true); });
      });
      var c = $('#uiPaletteCount', Palette.node);
      if (c) c.textContent = Palette.results.length + (Palette.results.length === 40 ? '+' : '') + ' نتيجة';
      var inp = $('#uiPaletteInput', Palette.node);
      if (inp) inp.setAttribute('aria-activedescendant', 'uiPalOpt0');
    },
    select: function (i, fromMouse) {
      if (!Palette.results.length) return;
      Palette.selected = (i + Palette.results.length) % Palette.results.length;
      $$('.palette__item', Palette.node).forEach(function (b, bi) {
        var on = bi === Palette.selected;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on && !fromMouse) safe(function () { b.scrollIntoView({ block: 'nearest' }); });
      });
      var inp = $('#uiPaletteInput', Palette.node);
      if (inp) inp.setAttribute('aria-activedescendant', 'uiPalOpt' + Palette.selected);
    },
    onKey: function (e) {
      if (e.key === 'Escape') { e.preventDefault(); Palette.close(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); Palette.select(Palette.selected + 1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); Palette.select(Palette.selected - 1); return; }
      if (e.key === 'PageDown') { e.preventDefault(); Palette.select(Palette.selected + 6); return; }
      if (e.key === 'PageUp') { e.preventDefault(); Palette.select(Palette.selected - 6); return; }
      if (e.key === 'Home') { e.preventDefault(); Palette.select(0); return; }
      if (e.key === 'End') { e.preventDefault(); Palette.select(Palette.results.length - 1); return; }
      if (e.key === 'Enter') { e.preventDefault(); Palette.run(Palette.selected); return; }
      if (e.key === '?' ) { e.preventDefault(); Palette.close(); Shortcuts.show(); }
    },
    run: function (i) {
      var r = Palette.results[i];
      if (!r) return;
      var it = r.item;
      Palette.remember(it);
      Palette.close();
      if (typeof it.run === 'function') { safe(function () { it.run(it); }); return; }
      if (it.href) { root.location.href = it.href; return; }
    }
  };
  root.UIShellPalette = Palette;

  /* ══════════════════════════════════════════════════════════════════
     5 · BUILT-IN PALETTE SOURCES
     ══════════════════════════════════════════════════════════════════ */
  function pageIcon(href) {
    var m = navFlat().filter(function (x) { return x.item.href === href; })[0];
    return m ? (m.item.icon || 'bi-file-earmark') : 'bi-file-earmark';
  }
  Palette.register({
    group: 'الصفحات', priority: 100,
    items: function () {
      return navFlat().map(function (x) {
        return {
          // O-02: an archived page says so in the palette too, not just in
          // the rail — the ⌘K result is often the only text a user reads.
          id: 'page:' + x.item.href, title: x.item.label,
          sub: x.item.archive ? (x.section + ' · أرشيف (بيان ثابت)') : x.section,
          icon: x.item.icon || 'bi-file-earmark', href: x.item.href,
          keywords: [x.section, x.item.href.replace('.html', ''), 'صفحة', 'page'],
          perm: x.item.perm
        };
      });
    }
  });
  Palette.register({
    group: 'إجراءات', priority: 80,
    items: function () {
      var out = [
        { id: 'act:theme', title: 'تبديل المظهر', sub: 'داكن / فاتح / تلقائي حسب النظام', icon: 'bi-circle-half', keywords: ['theme', 'dark', 'light', 'مظهر', 'ثيم', 'ليلي', 'نهاري'], run: function () { Prefs.cycleTheme(); } },
        { id: 'act:density', title: 'تغيير كثافة العرض', sub: 'مضغوط · متوسط · مريح', icon: 'bi-distribute-vertical', keywords: ['density', 'كثافة', 'مضغوط', 'zoom'], run: function () { PrefsDialog.open(); } },
        { id: 'act:notif', title: 'فتح مركز الإشعارات', sub: 'التنبيهات المؤجلة والطارئة', icon: 'bi-bell-fill', keywords: ['notifications', 'اشعارات', 'تنبيهات'], run: function () { Notifs.toggle(); } },
        { id: 'act:shortcuts', title: 'اختصارات لوحة المفاتيح', sub: 'كل الاختصارات في شاشة واحدة', icon: 'bi-keyboard-fill', keywords: ['shortcuts', 'keyboard', 'اختصارات'], run: function () { Shortcuts.show(); } },
        { id: 'act:print', title: 'طباعة هذه الصفحة', sub: 'تنسيق مخصص للتقارير', icon: 'bi-printer-fill', keywords: ['print', 'طباعة', 'تقرير'], run: function () { root.print(); } },
        { id: 'act:undo', title: 'تراجع عن آخر عملية', sub: 'آخر كتابة أو حذف على هذه الجلسة', icon: 'bi-arrow-counterclockwise', keywords: ['undo', 'تراجع', 'رجوع'], run: function () { if (root.undoLast) root.undoLast(); else Toast.push('لا توجد عملية للتراجع عنها في هذه الصفحة', 'warning'); } },
        { id: 'act:contrast', title: 'وضع التباين العالي', sub: 'حدود أوضح ونص أقوى', icon: 'bi-brightness-high-fill', keywords: ['contrast', 'تباين', 'accessibility', 'اتاحة'], run: function () { Prefs.set('contrast', Prefs.get('contrast') === 'high' ? 'normal' : 'high'); Toast.push(Prefs.get('contrast') === 'high' ? 'التباين العالي مفعّل' : 'التباين العالي متوقف', 'info', { duration: 2200 }); } },
        { id: 'act:home', title: 'العودة إلى الرئيسية', sub: 'لوحة المتابعة اليومية', icon: 'bi-house-door-fill', keywords: ['home', 'dashboard', 'رئيسية'], href: 'dashboard.html' },
        { id: 'act:settings', title: 'الإعدادات', sub: 'اسم المزرعة والعملة والشعار', icon: 'bi-gear-fill', keywords: ['settings', 'اعدادات'], href: 'settings.html' },
        { id: 'act:logout', title: 'تسجيل الخروج', sub: 'إنهاء الجلسة الحالية', icon: 'bi-box-arrow-right', keywords: ['logout', 'خروج'], run: function () { Confirm.open({ title: 'تسجيل الخروج؟', body: 'سيتم إنهاء الجلسة على هذا الجهاز.', confirmLabel: 'خروج', danger: true, onConfirm: function () { if (root.logout) root.logout(); } }); } }
      ];
      return out;
    }
  });
  Palette.register({
    group: 'إضافة سريعة', priority: 90,
    items: function () {
      // Each entry prefers the in-page modal when the current page has it
      // (no reload, no lost filters) and falls back to navigating.
      function act(fnName, href, title, sub, icon, keywords, perm) {
        return {
          id: 'add:' + fnName + ':' + href, title: title, sub: sub, icon: icon, keywords: keywords, perm: perm,
          run: function () {
            if (typeof root[fnName] === 'function') { safe(function () { root[fnName](); }); return; }
            root.location.href = href + (href.indexOf('?') >= 0 ? '&' : '?') + 'quick=' + fnName;
          }
        };
      }
      return [
        act('openAddWeight', 'animals.html', 'تسجيل وزن', 'إضافة وزن لحيوان في القطيع', 'bi-speedometer2', ['وزن', 'weight', 'ميزان', 'تسمين'], 'animals'),
        act('openBirthModal', 'births.html', 'تسجيل ميلاد', 'مولود جديد مع الوزن والأم', 'bi-stars', ['ميلاد', 'مواليد', 'birth', 'ولادة'], 'animals'),
        act('submitBirthDirect', 'births.html', 'تسجيل ولادة سريعة', 'من سجل التكاثر مباشرة', 'bi-lightning-charge-fill', ['ولادة', 'birth'], 'breeding'),
        act('openFinanceModal', 'finance-entry.html', 'إدخال حركة مالية', 'إيراد أو مصروف بمستند', 'bi-cash-coin', ['مالية', 'finance', 'مصروف', 'ايراد', 'فاتورة'], 'finance'),
        act('openAddTask', 'tasks.html', 'مهمة جديدة', 'مهمة يومية لعامل أو مشرف', 'bi-check2-square', ['مهمة', 'task', 'مهام'], null),
        act('openAddVaccination', 'vaccine.html', 'تسجيل تحصين', 'جرعة تحصين لقطيع أو عنبر', 'bi-bandaid-fill', ['تحصين', 'vaccine', 'تطعيم'], 'health'),
        act('openAddMedication', 'health.html', 'تسجيل علاج', 'علاج مع فترة السحب', 'bi-capsule', ['علاج', 'دواء', 'health', 'medicine'], 'health'),
        act('openDeadModal', 'dead.html', 'تسجيل حالة نافق', 'مع السبب والتاريخ', 'bi-x-octagon', ['نافق', 'وفاة', 'dead', 'mortality'], 'animals'),
        act('openStockModal', 'inventory.html', 'حركة مخزون', 'شراء أو صرف علف وأدوية', 'bi-boxes', ['مخزون', 'علف', 'inventory', 'شراء'], 'inventory')
      ];
    }
  });
  Palette.register({
    group: 'القطيع', priority: 70,
    items: function () {
      // Uses whatever herd data is already in memory on this page — the
      // palette never triggers a network fetch of its own, so opening it is
      // instant even on a farm connection.
      var animals = root._uiHerdCache || safe(function () { return root._lastAnimalsCache || null; }, null);
      if (!animals || !animals.length) return [];
      return animals.slice(0, 400).map(function (a) {
        var id = a.id || a._id || a.tag;
        return {
          id: 'animal:' + id, title: a.tag || '—',
          sub: [a.breed, a.gender === 'male' ? 'ذكر' : a.gender === 'female' ? 'أنثى' : '', a.status === 'dead' ? 'نافق' : a.status === 'sold' ? 'مُباع' : ''].filter(Boolean).join(' · '),
          icon: a.species === 'sheep' ? 'bi-cloud-fill' : 'bi-tropical-storm',
          href: 'animal-detail.html?id=' + encodeURIComponent(id),
          keywords: [a.breed, a.name, a.tag, a.barn, a.mother_tag, a.father_tag].filter(Boolean).concat(['حيوان', 'animal'])
        };
      });
    }
  });

  /* ══════════════════════════════════════════════════════════════════
     6 · CONFIRM dialog — replaces window.confirm(), which cannot be styled,
     is blocking, and reads "example.com says" in Arabic UIs.
     ══════════════════════════════════════════════════════════════════ */
  /* One confirmation for the whole app.
     ────────────────────────────────────────────────────────────────────
     It returns Promise<boolean> AND still honours an onConfirm callback,
     because callers use both: users.html writes
     `const ok = await UIShell.confirm({...}); if(!ok) return;` while the
     logout actions in this file pass `onConfirm`. Until 2026-10-20 open()
     returned undefined, so every `await`-style caller saw a falsy answer and
     cancelled silently — deleting a user did nothing at all, with no error
     anywhere. It also read only `o.body` while callers passed `message`, so
     the dialog showed a title and no explanation.

     Three levels, because this app runs in a browser AND inside a Capacitor
     WebView where window.confirm()/window.prompt() are not bridged and
     quietly return false/null:
       1. the shell dialog (shared.js showModal) — styled, focus-trapped;
       2. window.confirm — a plain browser without the shell;
       3. an inline panel appended to <body> — a WebView with neither.
     A destructive action must never be cancelled by a missing browser
     feature, and it must never hang waiting for one. */
  var Confirm = {
    open: function (o) {
      o = o || {};
      var bodyText = o.body || o.message || '';
      var typeTo = o.typeToConfirm || null;
      var resolvePromise, settled = false, observer = null;
      var promise = new Promise(function (res) { resolvePromise = res; });
      function finish(v) {
        if (settled) return;
        settled = true;
        if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
        resolvePromise(v);
      }
      function yes() { finish(true); safe(function () { o.onConfirm && o.onConfirm(); }); }
      function no() { finish(false); safe(function () { o.onCancel && o.onCancel(); }); }

      if (root.showModal) {
        root.showModal(
          '<div class="dialog dialog--sm" role="alertdialog" aria-modal="true" aria-labelledby="uiConfirmTitle">' +
          '<div class="dialog__head">' +
          '<span class="dialog__icon' + (o.danger ? ' dialog__icon--danger' : '') + '"><i class="bi ' + esc(o.icon || (o.danger ? 'bi-exclamation-triangle-fill' : 'bi-question-circle-fill')) + '"></i></span>' +
          '<div><h2 class="dialog__title" id="uiConfirmTitle">' + esc(o.title || 'تأكيد') + '</h2>' +
          (bodyText ? '<div class="dialog__subtitle">' + esc(bodyText) + '</div>' : '') + '</div>' +
          '<button type="button" class="dialog__close" id="uiConfirmX" aria-label="إغلاق"><i class="bi bi-x-lg"></i></button>' +
          '</div>' +
          (typeTo
            ? '<div class="dialog__body"><label class="dialog__label" for="uiConfirmType">اكتب <b>' + esc(typeTo) + '</b> للتأكيد</label>' +
              '<input type="text" class="input" id="uiConfirmType" autocomplete="off" autocapitalize="off" spellcheck="false" dir="rtl"></div>'
            : '') +
          '<div class="dialog__foot">' +
          '<button type="button" class="btn btn--secondary" id="uiConfirmCancel">' + esc(o.cancelLabel || 'إلغاء') + '</button>' +
          '<button type="button" class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" id="uiConfirmOk"' + (typeTo ? ' disabled' : '') + '>' + esc(o.confirmLabel || 'تأكيد') + '</button>' +
          '</div></div>'
        );
        var close = function () { root.closeModal && root.closeModal(); };
        var okBtn = $('#uiConfirmOk'), cancelBtn = $('#uiConfirmCancel'), xBtn = $('#uiConfirmX');
        if (okBtn) okBtn.addEventListener('click', function () { close(); yes(); });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { close(); no(); });
        if (xBtn) xBtn.addEventListener('click', function () { close(); no(); });
        if (typeTo) {
          var inp = $('#uiConfirmType');
          if (inp) {
            var sync = function () { if (okBtn) okBtn.disabled = (inp.value.trim() !== String(typeTo)); };
            inp.addEventListener('input', sync);
            inp.addEventListener('keydown', function (e) {
              if (e.key === 'Enter' && okBtn && !okBtn.disabled) { e.preventDefault(); close(); yes(); }
            });
            sync();
            setTimeout(function () { try { inp.focus(); } catch (e) {} }, 40);
          }
        }
        // Escape and a backdrop click close the modal inside shared.js without
        // touching these buttons, so watch for the dialog disappearing —
        // otherwise the promise would hang and the caller would await forever.
        var mr = document.getElementById('modal-root');
        if (mr && typeof MutationObserver === 'function') {
          observer = new MutationObserver(function () {
            if (!document.getElementById('uiConfirmOk')) no();
          });
          try { observer.observe(mr, { childList: true, subtree: true }); } catch (e) { observer = null; }
        }
        return promise;
      }

      if (typeof root.confirm === 'function') {
        var v = false;
        try { v = !!root.confirm((o.title || 'تأكيد') + (bodyText ? '\n' + bodyText : '')); } catch (e) { v = false; }
        if (v) yes(); else no();
        return promise;
      }

      var host = document.createElement('div');
      host.className = 'farm-confirm-fallback';
      host.setAttribute('role', 'alertdialog');
      host.innerHTML =
        '<div class="farm-confirm-fallback__box">' +
        '<strong>' + esc(o.title || 'تأكيد') + '</strong>' +
        (bodyText ? '<p>' + esc(bodyText) + '</p>' : '') +
        (typeTo ? '<p>اكتب <b>' + esc(typeTo) + '</b> للتأكيد</p>' : '') +
        (typeTo ? '<input type="text" id="uiConfirmType" dir="rtl" autocomplete="off">' : '') +
        '<div class="farm-confirm-fallback__foot">' +
        '<button type="button" class="btn btn--secondary" id="uiConfirmCancel">' + esc(o.cancelLabel || 'إلغاء') + '</button>' +
        '<button type="button" class="btn ' + (o.danger ? 'btn--danger' : 'btn--primary') + '" id="uiConfirmOk">' + esc(o.confirmLabel || 'تأكيد') + '</button>' +
        '</div></div>';
      document.body.appendChild(host);
      var drop = function () { if (host.parentNode) host.parentNode.removeChild(host); };
      var okF = host.querySelector('#uiConfirmOk'), cancelF = host.querySelector('#uiConfirmCancel');
      if (okF) okF.addEventListener('click', function () { drop(); yes(); });
      if (cancelF) cancelF.addEventListener('click', function () { drop(); no(); });
      if (typeTo) {
        var inpF = host.querySelector('#uiConfirmType');
        if (inpF) inpF.addEventListener('input', function () { if (okF) okF.disabled = (inpF.value.trim() !== String(typeTo)); });
        if (inpF && okF) okF.disabled = true;
      }
      return promise;
    }
  };

  /* The app-wide entry point: farmConfirm('رسالة') or farmConfirm({…}).
     Always a Promise<boolean>, whatever the environment supports. */
  function farmConfirm(a, b) {
    var o = (typeof a === 'string') ? Object.assign({ message: a }, b || {}) : Object.assign({}, a || {});
    if (!o.title) o.title = o.danger ? 'تأكيد إجراء' : 'تأكيد';
    try { return Confirm.open(o); }
    catch (e) {
      // A confirm that throws would strand the caller mid-action; answer
      // "no" instead, so the safe branch is always the one taken.
      return Promise.resolve(false);
    }
  }
  root.farmConfirm = farmConfirm;

  /* The app-wide text prompt: Promise<string | null>.
     window.prompt() is not bridged in the Capacitor WebView — it returns
     null — which made "سبب إعادة الفتح" impossible to fill in on a phone and
     silently cancelled the full wipe in animals.html. Same three tiers as
     farmConfirm, and `required` keeps the OK button honest about an empty
     answer instead of resolving with a blank string. */
  var Prompt = {
    open: function (o) {
      o = o || {};
      var label = o.label || o.message || '';
      var resolvePromise, settled = false, observer = null;
      var promise = new Promise(function (res) { resolvePromise = res; });
      function finish(v) {
        if (settled) return;
        settled = true;
        if (observer) { try { observer.disconnect(); } catch (e) {} observer = null; }
        resolvePromise(v);
      }
      function readValue() { var i = document.getElementById('uiPromptInput'); return i ? i.value.trim() : ''; }
      // The value is captured BEFORE the dialog closes: closeModal() empties
      // #modal-root, so reading it afterwards resolved every prompt with null.
      function yes(captured) {
        var v = (captured === undefined) ? readValue() : captured;
        if (o.required && !v) {
          var inp = document.getElementById('uiPromptInput');
          if (inp) { try { inp.focus(); } catch (e) {} }
          return;                                    // an empty required answer is not an answer
        }
        finish(v || null);
        safe(function () { o.onConfirm && o.onConfirm(v); });
      }
      function no() { finish(null); safe(function () { o.onCancel && o.onCancel(); }); }

      if (root.showModal) {
        root.showModal(
          '<div class="dialog dialog--sm" role="dialog" aria-modal="true" aria-labelledby="uiPromptTitle">' +
          '<div class="dialog__head">' +
          '<span class="dialog__icon"><i class="bi ' + esc(o.icon || 'bi-input-cursor-text') + '"></i></span>' +
          '<div><h2 class="dialog__title" id="uiPromptTitle">' + esc(o.title || 'إدخال') + '</h2>' +
          (label ? '<div class="dialog__subtitle">' + esc(label) + '</div>' : '') + '</div>' +
          '<button type="button" class="dialog__close" id="uiPromptX" aria-label="إغلاق"><i class="bi bi-x-lg"></i></button>' +
          '</div>' +
          '<div class="dialog__body"><input type="text" class="input" id="uiPromptInput" dir="auto" autocomplete="off"' +
          (o.placeholder ? ' placeholder="' + esc(o.placeholder) + '"' : '') + '></div>' +
          '<div class="dialog__foot">' +
          '<button type="button" class="btn btn--secondary" id="uiPromptCancel">' + esc(o.cancelLabel || 'إلغاء') + '</button>' +
          '<button type="button" class="btn btn--primary" id="uiPromptOk">' + esc(o.confirmLabel || 'حفظ') + '</button>' +
          '</div></div>'
        );
        var close = function () { root.closeModal && root.closeModal(); };
        var okBtn = $('#uiPromptOk'), cancelBtn = $('#uiPromptCancel'), xBtn = $('#uiPromptX'), inp = $('#uiPromptInput');
        if (okBtn) okBtn.addEventListener('click', function () { var v = readValue(); if (o.required && !v) { if (inp) { try { inp.focus(); } catch (e) {} } return; } close(); yes(v); });
        if (cancelBtn) cancelBtn.addEventListener('click', function () { close(); no(); });
        if (xBtn) xBtn.addEventListener('click', function () { close(); no(); });
        if (inp) {
          inp.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); var v = readValue(); if (o.required && !v) return; close(); yes(v); }
          });
          setTimeout(function () { try { inp.focus(); } catch (e) {} }, 40);
        }
        var mr = document.getElementById('modal-root');
        if (mr && typeof MutationObserver === 'function') {
          observer = new MutationObserver(function () { if (!document.getElementById('uiPromptOk')) no(); });
          try { observer.observe(mr, { childList: true, subtree: true }); } catch (e) { observer = null; }
        }
        return promise;
      }

      if (typeof root.prompt === 'function') {
        var v = null;
        try { v = root.prompt((o.title || 'إدخال') + (label ? '\n' + label : '')); } catch (e) { v = null; }
        if (v === null) no();
        else if (o.required && !String(v).trim()) no();
        else finish(String(v).trim());
        return promise;
      }

      var host = document.createElement('div');
      host.className = 'farm-confirm-fallback';
      host.setAttribute('role', 'dialog');
      host.innerHTML =
        '<div class="farm-confirm-fallback__box">' +
        '<strong>' + esc(o.title || 'إدخال') + '</strong>' +
        (label ? '<p>' + esc(label) + '</p>' : '') +
        '<input type="text" id="uiPromptInput" dir="auto" autocomplete="off">' +
        '<div class="farm-confirm-fallback__foot">' +
        '<button type="button" class="btn btn--secondary" id="uiPromptCancel">' + esc(o.cancelLabel || 'إلغاء') + '</button>' +
        '<button type="button" class="btn btn--primary" id="uiPromptOk">' + esc(o.confirmLabel || 'حفظ') + '</button>' +
        '</div></div>';
      document.body.appendChild(host);
      var drop = function () { if (host.parentNode) host.parentNode.removeChild(host); };
      var okF = host.querySelector('#uiPromptOk'), cancelF = host.querySelector('#uiPromptCancel'), inpF = host.querySelector('#uiPromptInput');
      if (okF) okF.addEventListener('click', function () { var v = inpF ? inpF.value.trim() : ''; if (o.required && !v) { if (inpF) inpF.focus(); return; } drop(); finish(v || null); safe(function () { o.onConfirm && o.onConfirm(v); }); });
      if (cancelF) cancelF.addEventListener('click', function () { drop(); no(); });
      if (inpF) inpF.addEventListener('keydown', function (e) { if (e.key === 'Enter' && okF) okF.click(); });
      return promise;
    }
  };

  function farmPrompt(a, b) {
    var o = (typeof a === 'string') ? Object.assign({ label: a }, b || {}) : Object.assign({}, a || {});
    if (!o.title) o.title = 'إدخال';
    try { return Prompt.open(o); }
    catch (e) { return Promise.resolve(null); }
  }
  root.farmPrompt = farmPrompt;

  /* ══════════════════════════════════════════════════════════════════
     7 · PREFERENCES dialog (density, contrast, motion, theme)
     ══════════════════════════════════════════════════════════════════ */
  var PrefsDialog = {
    open: function () {
      if (!root.showModal) { Prefs.cycleTheme(); return; }
      var theme = Prefs.get('theme'), density = Prefs.get('density');
      var seg = function (name, opts, current) {
        return '<div class="segmented" role="group" aria-label="' + esc(name) + '">' + opts.map(function (o) {
          return '<button type="button" class="segmented__btn' + (o.id === current ? ' active' : '') + '" data-pref="' + esc(name) + '" data-val="' + esc(o.id) + '" aria-pressed="' + (o.id === current) + '">' +
            (o.icon ? '<i class="bi ' + esc(o.icon) + '"></i> ' : '') + esc(o.label) + '</button>';
        }).join('') + '</div>';
      };
      root.showModal(
        '<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="uiPrefsTitle">' +
        '<div class="dialog__head"><span class="dialog__icon"><i class="bi bi-sliders"></i></span>' +
        '<div><h2 class="dialog__title" id="uiPrefsTitle">تفضيلات العرض</h2>' +
        '<div class="dialog__subtitle">تُحفظ على هذا الجهاز وتُطبَّق قبل ظهور الصفحة</div></div>' +
        '<button type="button" class="dialog__close" onclick="closeModal()" aria-label="إغلاق"><i class="bi bi-x-lg"></i></button></div>' +
        '<div class="dialog__body">' +
        '<div class="field"><span class="field__label">المظهر</span>' +
        seg('theme', [{ id: 'dark', label: 'داكن', icon: 'bi-moon-stars-fill' }, { id: 'light', label: 'فاتح', icon: 'bi-sun-fill' }, { id: 'auto', label: 'تلقائي', icon: 'bi-circle-half' }], theme) +
        '<p class="field__hint">«تلقائي» يتبع إعداد النظام ويتحدث فورًا عند تغييره.</p></div>' +
        '<div class="field"><span class="field__label">كثافة العرض</span>' +
        seg('density', DENSITIES, density) +
        '<p class="field__hint">' + esc((DENSITIES.filter(function (d) { return d.id === density; })[0] || {}).hint || '') + '</p></div>' +
        '<div class="field"><span class="field__label">إتاحة</span>' +
        '<label class="switch"><input type="checkbox" id="uiPrefContrast"' + (Prefs.get('contrast') === 'high' ? ' checked' : '') + '><span class="switch__track"></span><span class="switch__label">تباين عالٍ (حدود ونصوص أقوى)</span></label>' +
        '<label class="switch"><input type="checkbox" id="uiPrefMotion"' + (Prefs.get('motion') === 'off' ? ' checked' : '') + '><span class="switch__track"></span><span class="switch__label">إيقاف الحركة والانتقالات</span></label>' +
        '</div></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--primary" onclick="closeModal()">تم</button></div></div>'
      );
      $$('[data-pref]').forEach(function (b) {
        b.addEventListener('click', function () {
          Prefs.set(b.getAttribute('data-pref'), b.getAttribute('data-val'));
          $$('[data-pref="' + b.getAttribute('data-pref') + '"]').forEach(function (x) {
            var on = x === b; x.classList.toggle('active', on); x.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          var hint = $('.field__hint', b.closest('.field'));
          if (hint && b.getAttribute('data-pref') === 'density') {
            var d = DENSITIES.filter(function (x) { return x.id === b.getAttribute('data-val'); })[0];
            if (d) hint.textContent = d.hint;
          }
        });
      });
      var c = $('#uiPrefContrast'); if (c) c.addEventListener('change', function () { Prefs.set('contrast', c.checked ? 'high' : 'normal'); });
      var m = $('#uiPrefMotion'); if (m) m.addEventListener('change', function () { Prefs.set('motion', m.checked ? 'off' : 'on'); });
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     8 · SHORTCUTS overlay (?)
     ══════════════════════════════════════════════════════════════════ */
  var SHORTCUTS = [
    { group: 'عام', rows: [
      { keys: ['Ctrl', 'K'], label: 'لوحة الأوامر (بحث وتنفيذ)' },
      { keys: ['/'], label: 'فتح البحث مباشرة' },
      { keys: ['?'], label: 'هذه الشاشة' },
      { keys: ['Esc'], label: 'إغلاق أي نافذة أو قائمة' }
    ]},
    { group: 'تنقّل سريع (اضغط g ثم الحرف)', rows: [
      { keys: ['g', 'd'], label: 'الرئيسية' }, { keys: ['g', 'a'], label: 'إدارة القطيع' },
      { keys: ['g', 'b'], label: 'المواليد' }, { keys: ['g', 'h'], label: 'الصحة' },
      { keys: ['g', 'v'], label: 'التحصين' }, { keys: ['g', 'f'], label: 'المالية' },
      { keys: ['g', 't'], label: 'المهام' }, { keys: ['g', 'n'], label: 'الإشعارات' },
      { keys: ['g', 's'], label: 'الإعدادات' }
    ]},
    { group: 'عرض', rows: [
      { keys: ['Ctrl', 'J'], label: 'تبديل المظهر' },
      { keys: ['Ctrl', 'P'], label: 'طباعة الصفحة / التقرير' }
    ]}
  ];
  var Shortcuts = {
    show: function () {
      if (!root.showModal) return;
      root.showModal(
        '<div class="dialog dialog--lg" role="dialog" aria-modal="true" aria-labelledby="uiScTitle">' +
        '<div class="dialog__head"><span class="dialog__icon"><i class="bi bi-keyboard-fill"></i></span>' +
        '<div><h2 class="dialog__title" id="uiScTitle">اختصارات لوحة المفاتيح</h2>' +
        '<div class="dialog__subtitle">كل شيء في البرنامج يمكن الوصول إليه بدون فأرة</div></div>' +
        '<button type="button" class="dialog__close" onclick="closeModal()" aria-label="إغلاق"><i class="bi bi-x-lg"></i></button></div>' +
        '<div class="dialog__body"><div class="shortcuts">' +
        SHORTCUTS.map(function (g) {
          return '<div><div class="shortcuts__group-title">' + esc(g.group) + '</div>' + g.rows.map(function (r) {
            return '<div class="shortcuts__row"><span>' + esc(r.label) + '</span><span class="kbd-row">' +
              r.keys.map(function (k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('<span class="t-muted">+</span>') +
              '</span></div>';
          }).join('') + '</div>';
        }).join('') +
        '</div></div>' +
        '<div class="dialog__foot"><button type="button" class="btn btn--primary" onclick="closeModal()">فهمت</button></div></div>'
      );
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     9 · NOTIFICATION CENTER
     Reuses the derivation that already exists in shared.js so there is ONE
     definition of "what needs attention" (extracted there as
     computeInboxNotifications()). Falls back to its own scan if an older
     shared.js is cached.
     ══════════════════════════════════════════════════════════════════ */
  var Notifs = {
    open: false, items: null, danger: 0, node: null, timer: null,
    mount: function () {
      if (Notifs.node) return Notifs.node;
      var n = el('section', {
        class: 'notif-center', id: 'uiNotifCenter', 'aria-label': 'مركز الإشعارات', role: 'dialog'
      });
      n.innerHTML =
        '<div class="notif-center__head">' +
        '  <span class="notif-center__title"><i class="bi bi-bell-fill t-brand"></i> الإشعارات</span>' +
        '  <button type="button" class="btn btn--quiet btn--sm" id="uiNotifRefresh" title="تحديث"><i class="bi bi-arrow-clockwise"></i></button>' +
        '  <button type="button" class="btn btn--quiet btn--sm" id="uiNotifClose" aria-label="إغلاق"><i class="bi bi-x-lg"></i></button>' +
        '</div>' +
        '<div class="notif-center__list" id="uiNotifList"></div>' +
        '<div class="notif-center__foot"><a href="notifications.html">عرض كل الإشعارات <i class="bi bi-arrow-left-short"></i></a></div>';
      doc().body.appendChild(n);
      Notifs.node = n;
      $('#uiNotifClose', n).addEventListener('click', function () { Notifs.close(); });
      $('#uiNotifRefresh', n).addEventListener('click', function () { Notifs.load(true); });
      return n;
    },
    toggle: function () { Notifs.open ? Notifs.close() : Notifs.show(); },
    show: function () {
      var n = Notifs.mount();
      Notifs.open = true;
      n.classList.add('is-open');
      n.setAttribute('aria-modal', 'false');
      var bell = $('#uiBellBtn'); if (bell) bell.setAttribute('aria-expanded', 'true');
      Notifs.load(false);
      setTimeout(function () {
        doc().addEventListener('click', Notifs._outside);
        var f = $('#uiNotifList', n); if (f) f.focus && f.focus();
      }, 0);
    },
    close: function () {
      if (!Notifs.node) return;
      Notifs.open = false;
      Notifs.node.classList.remove('is-open');
      var bell = $('#uiBellBtn'); if (bell) bell.setAttribute('aria-expanded', 'false');
      doc().removeEventListener('click', Notifs._outside);
    },
    _outside: function (e) {
      var n = Notifs.node, bell = $('#uiBellBtn');
      if (n && !n.contains(e.target) && (!bell || !bell.contains(e.target))) Notifs.close();
    },
    groupLabel: function (t) {
      if (!t) return 'أخرى';
      return t;
    },
    load: async function (force) {
      var list = $('#uiNotifList', Notifs.mount());
      if (!list) return;
      if (!force && Notifs.items) { Notifs.paint(); return; }
      list.innerHTML = '<div class="state"><div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div><div class="skeleton skeleton--row"></div></div>';
      var items = [];
      try {
        if (typeof root.computeInboxNotifications === 'function') {
          var r = await root.computeInboxNotifications();
          items = (r && r.items) || [];
        } else if (typeof root.loadNotifDropdown === 'function') {
          items = [];                                 // older shared.js: nothing to reuse safely
        }
      } catch (e) { items = []; }
      Notifs.items = items;
      Notifs.danger = items.filter(function (i) { return i.type === 'danger'; }).length;
      Notifs.paint();
      Shell.syncBadges();
    },
    paint: function () {
      var list = $('#uiNotifList', Notifs.node);
      if (!list) return;
      var items = Notifs.items || [];
      if (!items.length) {
        list.innerHTML = '<div class="state state--brand"><div class="state__icon"><i class="bi bi-check2-circle"></i></div>' +
          '<div class="state__title">لا توجد تنبيهات</div>' +
          '<div class="state__body">القطيع والمخزون والتحصينات كلها في الوضع الطبيعي حاليًا.</div></div>';
        return;
      }
      var order = { danger: 0, warning: 1, info: 2, success: 3 };
      var sorted = items.slice().sort(function (a, b) { return (order[a.type] || 9) - (order[b.type] || 9); });
      var groups = [], last = null;
      sorted.forEach(function (n) {
        var g = n.type === 'danger' ? 'يحتاج إجراء الآن' : n.type === 'warning' ? 'قريبًا / متابعة' : n.type === 'success' ? 'مكتمل' : 'معلومات';
        if (g !== last) { groups.push({ label: g, items: [] }); last = g; }
        groups[groups.length - 1].items.push(n);
      });
      list.innerHTML = groups.map(function (g) {
        return '<div class="notif-center__group">' + esc(g.label) + ' <span class="counter">' + g.items.length + '</span></div>' +
          g.items.slice(0, 12).map(function (n) {
            return '<a class="notif notif--' + esc(n.type || 'info') + '" href="' + esc(n.href || '#') + '">' +
              '<span class="notif__icon"><i class="bi ' + esc(n.icon || 'bi-bell') + '"></i></span>' +
              '<span class="notif__body">' +
              '<span class="notif__title">' + esc(n.title || '') + '</span>' +
              (n.msg ? '<span class="notif__msg">' + esc(n.msg) + '</span>' : '') +
              (n.time ? '<span class="notif__time"><i class="bi bi-clock"></i> ' + esc(n.time) + '</span>' : '') +
              '</span></a>';
          }).join('');
      }).join('');
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     10 · SHELL — appbar, bottom nav, badges, busy bar, scroll state
     ══════════════════════════════════════════════════════════════════ */
  var Shell = {
    mounted: false, activePage: '', appbar: null, busyCount: 0,
    pageTitle: function () {
      var h = $('.page-header__title') || $('#page-header h1') || $('#page-header h2');
      if (h && h.textContent.trim()) return h.textContent.trim();
      var t = (doc().title || '').split('—')[0].split('|')[0].trim();
      return t || 'بيان المزرعة';
    },
    crumbSection: function () {
      var m = navFlat().filter(function (x) { return x.item.href === Shell.activePage; })[0];
      return m ? m.section : '';
    },
    crumbLabel: function () {
      var m = navFlat().filter(function (x) { return x.item.href === Shell.activePage; })[0];
      return m ? m.item.label : Shell.pageTitle();
    },
    buildAppbar: function () {
      var u = getUser() || {};
      var section = Shell.crumbSection();
      var bar = el('header', { class: 'appbar', id: 'uiAppbar', role: 'banner' });
      bar.innerHTML =
        '<div class="appbar__start">' +
        '  <button type="button" class="appbar-btn ui-only-mobile" id="uiMenuBtn" aria-label="القائمة" data-hint="القائمة"><i class="bi bi-list"></i></button>' +
        '  <div class="appbar__titles">' +
        '    <nav class="crumbs" aria-label="مسار التنقل">' +
        (section ? '<span class="crumbs__item"><i class="bi bi-grid-1x2"></i>' + esc(section) + '</span><span class="crumbs__sep"><i class="bi bi-chevron-left"></i></span>' : '') +
        '      <span class="crumbs__current" id="uiCrumbCurrent">' + esc(Shell.crumbLabel()) + '</span>' +
        '    </nav>' +
        '    <h1 class="appbar__title" id="uiAppbarTitle">' + esc(Shell.pageTitle()) + '</h1>' +
        '  </div>' +
        '</div>' +
        '<div class="appbar__center">' +
        '  <button type="button" class="search-trigger" id="uiSearchTrigger" aria-label="بحث وتنفيذ الأوامر" aria-keyshortcuts="Control+K">' +
        '    <i class="bi bi-search"></i><span class="search-trigger__label">ابحث أو نفّذ أمرًا…</span>' +
        '    <span class="kbd-hint" id="uiKbdHint">Ctrl K</span>' +
        '  </button>' +
        '</div>' +
        '<div class="appbar__end">' +
        '  <div class="quickadd" id="uiQuickAdd">' +
        '    <button type="button" class="quickadd__btn" id="uiQuickAddBtn" aria-expanded="false" aria-haspopup="menu" aria-label="إضافة سريعة">' +
        '      <i class="bi bi-plus-lg"></i><span class="ui-only-desktop">إضافة</span></button>' +
        '    <div class="menu quickadd__menu" id="uiQuickAddMenu" role="menu" aria-label="إضافة سريعة"></div>' +
        '  </div>' +
        '  <button type="button" class="appbar-btn" id="uiBellBtn" aria-expanded="false" aria-haspopup="dialog" aria-label="الإشعارات" data-hint="الإشعارات">' +
        '    <i class="bi bi-bell-fill"></i><span class="count-dot" id="uiBellCount" data-count="0"></span></button>' +
        '  <button type="button" class="appbar-btn" id="uiThemeBtn" aria-label="تبديل المظهر" data-hint="المظهر"><i class="bi bi-circle-half" id="theme-icon"></i></button>' +
        '  <button type="button" class="appbar__avatar" id="uiUserBtn" aria-expanded="false" aria-haspopup="menu" aria-label="حساب المستخدم">' +
        '    <span class="avatar-chip">' + esc((u.name || 'م').trim().charAt(0)) + '</span>' +
        '    <span class="appbar__avatar-name ui-only-desktop">' + esc(u.name || 'مدير') + '</span>' +
        '    <i class="bi bi-chevron-down ui-only-desktop t-muted" style="font-size:.6rem"></i>' +
        '  </button>' +
        '  <div class="menu" id="uiUserMenu" role="menu" aria-label="قائمة المستخدم"></div>' +
        '</div>' +
        '<div class="loadbar" id="uiLoadbar"></div>';
      return bar;
    },
    buildBottomNav: function () {
      var wanted = ['dashboard.html', 'animals.html', 'births.html', 'health.html', 'tasks.html'];
      var flat = navFlat();
      var items = wanted.map(function (href) {
        return flat.filter(function (x) { return x.item.href === href; })[0];
      }).filter(function (x) { return x && (!x.item.perm || can(x.item.perm)); });
      var nav = el('nav', { class: 'bottomnav', id: 'uiBottomNav', 'aria-label': 'التنقل السريع' });
      nav.innerHTML = items.map(function (x) {
        var active = x.item.href === Shell.activePage;
        return '<a class="bottomnav__item' + (active ? ' active' : '') + '" href="' + esc(x.item.href) + '"' +
          (active ? ' aria-current="page"' : '') + '>' +
          '<i class="bi ' + esc(x.item.icon || 'bi-circle') + '"></i><span>' + esc(x.item.label) + '</span></a>';
      }).join('') +
        '<button type="button" class="bottomnav__item" id="uiBottomMore" aria-label="بقية الأقسام">' +
        '<i class="bi bi-grid-3x3-gap-fill"></i><span>المزيد</span></button>';
      return nav;
    },
    quickAddItems: function () {
      var all = Palette.allItems().filter(function (i) { return String(i.id).indexOf('add:') === 0; });
      return all.slice(0, 6);
    },
    paintMenus: function () {
      var qa = $('#uiQuickAddMenu');
      if (qa) {
        qa.innerHTML = '<div class="menu__label">سجّل بسرعة</div>' + Shell.quickAddItems().map(function (i) {
          return '<button type="button" class="menu__item" role="menuitem" data-pal="' + esc(i.id) + '">' +
            '<i class="bi ' + esc(i.icon) + '"></i><span class="menu__item-text"><span>' + esc(i.title) + '</span>' +
            '<span class="menu__item-sub">' + esc(i.sub || '') + '</span></span></button>';
        }).join('') + '<div class="menu__sep"></div>' +
          '<button type="button" class="menu__item" role="menuitem" data-pal="act:shortcuts"><i class="bi bi-keyboard-fill"></i> اختصارات لوحة المفاتيح<span class="menu__shortcut">?</span></button>';
        $$('[data-pal]', qa).forEach(function (b) {
          b.addEventListener('click', function () {
            Menus.closeAll();
            var id = b.getAttribute('data-pal');
            var item = Palette.allItems().filter(function (i) { return i.id === id; })[0];
            if (item) { Palette.remember(item); if (item.run) safe(function () { item.run(item); }); else if (item.href) root.location.href = item.href; }
          });
        });
      }
      var um = $('#uiUserMenu');
      if (um) {
        var u = getUser() || {};
        var roleLabel = safe(function () { return (root.ROLES && root.ROLES[u.role] && root.ROLES[u.role].label) || u.role || '—'; }, '—');
        var settings = safe(function () { return root.getSettings ? root.getSettings() : {}; }, {});
        um.innerHTML =
          '<div class="menu__label">مسجّل الدخول</div>' +
          '<div class="row" style="padding:6px 10px 10px;gap:10px">' +
          '  <span class="avatar">' + esc((u.name || 'م').trim().charAt(0)) + '</span>' +
          '  <span class="menu__item-text"><span style="font-weight:700;color:var(--text-primary)">' + esc(u.name || 'مدير') + '</span>' +
          '  <span class="menu__item-sub">' + esc(roleLabel) + ' · ' + esc(settings.farmName || '') + '</span></span>' +
          '</div>' +
          '<div class="menu__sep"></div>' +
          '<button type="button" class="menu__item" role="menuitem" id="uiMenuPrefs"><i class="bi bi-sliders"></i> تفضيلات العرض</button>' +
          '<button type="button" class="menu__item" role="menuitem" id="uiMenuNotif"><i class="bi bi-bell-fill"></i> مركز الإشعارات</button>' +
          '<a class="menu__item" role="menuitem" href="activity.html"><i class="bi bi-clock-history"></i> سجل النشاط</a>' +
          '<a class="menu__item" role="menuitem" href="settings.html"><i class="bi bi-gear-fill"></i> الإعدادات</a>' +
          '<div class="menu__sep"></div>' +
          '<button type="button" class="menu__item menu__item--danger" role="menuitem" id="uiMenuLogout"><i class="bi bi-box-arrow-right"></i> تسجيل الخروج</button>' +
          '<div class="menu__label" style="margin-top:6px">Farm OS shell v' + VERSION + '</div>';
        $('#uiMenuPrefs', um).addEventListener('click', function () { Menus.closeAll(); PrefsDialog.open(); });
        $('#uiMenuNotif', um).addEventListener('click', function () { Menus.closeAll(); Notifs.show(); });
        $('#uiMenuLogout', um).addEventListener('click', function () {
          Menus.closeAll();
          Confirm.open({ title: 'تسجيل الخروج؟', body: 'سيتم إنهاء الجلسة على هذا الجهاز فقط.', confirmLabel: 'خروج', danger: true, onConfirm: function () { if (root.logout) root.logout(); } });
        });
      }
    },
    syncBadges: function () {
      var n = Notifs.danger || 0;
      var dot = $('#uiBellCount');
      if (dot) {
        dot.textContent = n > 9 ? '9+' : (n > 0 ? String(n) : '');
        dot.setAttribute('data-count', String(n));
        dot.style.display = n > 0 ? '' : 'none';
      }
      var bell = $('#uiBellBtn');
      if (bell) bell.classList.toggle('has-unread', n > 0);
      // keep the legacy rail/panel badges consistent with the new center
      ['bell-badge', 'railTreeBellBadge'].forEach(function (id) {
        var b = doc().getElementById(id);
        if (!b) return;
        b.textContent = n > 9 ? '9+' : String(n);
        b.style.display = n > 0 ? '' : 'none';
      });
      var bn = $('#uiBottomNav');
      if (bn) {
        var existing = $('.bottomnav__item .count-dot', bn);
        if (n > 0 && !existing) {
          var more = $('#uiBottomMore', bn);
          if (more) more.insertAdjacentHTML('beforeend', '<span class="count-dot">' + (n > 9 ? '9+' : n) + '</span>');
        } else if (n === 0 && existing) existing.remove();
      }
    },
    busy: function (on) {
      Shell.busyCount = Math.max(0, Shell.busyCount + (on ? 1 : -1));
      var b = $('#uiLoadbar');
      if (b) b.classList.toggle('is-active', Shell.busyCount > 0);
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     11 · MENUS (quick-add, user) — one open at a time, Esc + outside close
     ══════════════════════════════════════════════════════════════════ */
  var Menus = {
    open: function (btnSel, menuSel) {
      var b = $(btnSel), m = $(menuSel);
      if (!b || !m) return;
      var wasOpen = m.classList.contains('is-open');
      Menus.closeAll();
      if (wasOpen) return;
      m.classList.add('is-open');
      b.setAttribute('aria-expanded', 'true');
      setTimeout(function () {
        var first = $(FOCUSABLE, m); if (first) first.focus();
        doc().addEventListener('click', Menus._outside);
      }, 0);
      Menus._current = { b: b, m: m };
    },
    closeAll: function () {
      $$('.menu.is-open').forEach(function (m) { m.classList.remove('is-open'); });
      ['#uiQuickAddBtn', '#uiUserBtn'].forEach(function (s) { var b = $(s); if (b) b.setAttribute('aria-expanded', 'false'); });
      doc().removeEventListener('click', Menus._outside);
      Menus._current = null;
    },
    _outside: function (e) {
      if (!Menus._current) return;
      var c = Menus._current;
      if (!c.m.contains(e.target) && !c.b.contains(e.target)) Menus.closeAll();
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     12 · TABLES — sortable, sticky, filterable, counted
     Opt in per table with:  <table class="table" data-ui-table>
     Columns opt in with:    <th data-sort="numeric|text|date">
     (a <th> with no data-sort is still sortable as text unless
      data-sort="none").
     ══════════════════════════════════════════════════════════════════ */
  var Tables = {
    enhance: function (scope) {
      $$('table[data-ui-table]', scope || doc()).forEach(function (t) { Tables.setup(t); });
    },
    setup: function (t) {
      if (t.getAttribute('data-ui-ready') === '1') return;
      t.setAttribute('data-ui-ready', '1');
      var wrap = t.closest('.table-wrap');
      if (wrap) { wrap.setAttribute('tabindex', '0'); wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'جدول قابل للتمرير'); }
      var heads = $$('thead th', t);
      heads.forEach(function (th, i) {
        var mode = th.getAttribute('data-sort');
        if (mode === 'none') return;
        if (!th.hasAttribute('aria-sort')) th.setAttribute('aria-sort', 'none');
        th.setAttribute('tabindex', '0');
        th.setAttribute('role', 'columnheader');
        if (!th.querySelector('.sort-ind')) th.insertAdjacentHTML('beforeend', '<i class="bi bi-arrow-down-up sort-ind"></i>');
        var act = function () { Tables.sort(t, i, mode || 'auto'); };
        th.addEventListener('click', act);
        th.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); }
        });
      });
      var filterSel = t.getAttribute('data-ui-filter');
      if (filterSel) {
        var input = $(filterSel);
        if (input) {
          var run = function () { Tables.filter(t, input.value); };
          input.addEventListener('input', run);
          input.setAttribute('aria-controls', t.id || '');
        }
      }
    },
    sort: function (t, colIndex, mode) {
      var body = t.tBodies[0]; if (!body) return;
      var th = $$('thead th', t)[colIndex]; if (!th) return;
      var cur = th.getAttribute('aria-sort');
      var dir = cur === 'ascending' ? 'descending' : 'ascending';
      $$('thead th', t).forEach(function (h) { h.setAttribute('aria-sort', 'none'); });
      th.setAttribute('aria-sort', dir);
      var rows = Array.prototype.slice.call(body.rows);
      var kind = mode;
      if (kind === 'auto') {
        var sample = rows.slice(0, 8).map(function (r) { return (r.cells[colIndex] || {}).textContent; });
        kind = sample.every(function (v) { return v !== undefined && num(v) !== null && String(v).trim() !== ''; }) && sample.length > 1 ? 'numeric' : 'text';
      }
      rows.sort(function (a, b) {
        var av = (a.cells[colIndex] || {}), bv = (b.cells[colIndex] || {});
        var at = (av.getAttribute && av.getAttribute('data-sort-value')) || av.textContent || '';
        var bt = (bv.getAttribute && bv.getAttribute('data-sort-value')) || bv.textContent || '';
        var r;
        if (kind === 'numeric') {
          var an = num(at), bn = num(bt);
          r = (an === null ? -Infinity : an) - (bn === null ? -Infinity : bn);
        } else if (kind === 'date') {
          var ad = Date.parse(at), bd = Date.parse(bt);
          r = (isNaN(ad) ? -Infinity : ad) - (isNaN(bd) ? -Infinity : bd);
        } else {
          r = String(at).trim().localeCompare(String(bt).trim(), 'ar');
        }
        return dir === 'ascending' ? r : -r;
      });
      rows.forEach(function (r) { body.appendChild(r); });
      Tables.announce(t);
    },
    filter: function (t, q) {
      var body = t.tBodies[0]; if (!body) return;
      var needle = fold(q);
      var shown = 0;
      Array.prototype.slice.call(body.rows).forEach(function (r) {
        var hit = !needle || fold(r.textContent).indexOf(needle) >= 0;
        r.hidden = !hit;
        r.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      t.setAttribute('data-ui-visible', String(shown));
      Tables.announce(t);
    },
    announce: function (t) {
      var body = t.tBodies[0]; if (!body) return;
      var total = body.rows.length;
      var shown = Array.prototype.slice.call(body.rows).filter(function (r) { return r.style.display !== 'none'; }).length;
      var out = $('[data-ui-count-for="' + (t.id || '') + '"]') || $('.table-foot__range', t.closest('.card,.wonder-card,.table-wrap') || doc());
      if (out) out.textContent = shown === total ? ('‏' + total + ' سجل') : ('‏' + shown + ' من ' + total + ' سجل');
    }
  };

  /* ══════════════════════════════════════════════════════════════════
     13 · KEYBOARD
     ══════════════════════════════════════════════════════════════════ */
  var GOTO = { d: 'dashboard.html', a: 'animals.html', b: 'births.html', h: 'health.html', v: 'vaccine.html', f: 'finance.html', t: 'tasks.html', n: 'notifications.html', s: 'settings.html', r: 'reports.html', i: 'inventory.html', p: 'production.html' };
  var gPending = false, gTimer = null;
  function inField(e) {
    var t = e.target;
    if (!t) return false;
    var tag = (t.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || t.isContentEditable === true;
  }
  function onKeydown(e) {
    var mod = e.ctrlKey || e.metaKey;
    // ⌘K / Ctrl+K — palette (works everywhere, including inside fields)
    if (mod && (e.key === 'k' || e.key === 'K' || e.key === 'ن')) { e.preventDefault(); Palette.toggle(); return; }
    if (mod && (e.key === 'j' || e.key === 'J')) { e.preventDefault(); Prefs.cycleTheme(); return; }
    if (e.key === 'Escape') {
      // Handled before the palette's own input listener so that Esc also works
      // when focus sits on a RESULT row (mouse users) rather than the field.
      if (Palette.open) { e.preventDefault(); Palette.close(); return; }
      if (Notifs.open) { Notifs.close(); return; }
      if ($('.menu.is-open')) { Menus.closeAll(); return; }
    }
    if (Palette.open) return;                                  // palette owns the rest of the keyboard
    if (inField(e)) return;
    if (e.key === '/') { e.preventDefault(); Palette.show(); return; }
    if (e.key === '?') { e.preventDefault(); Shortcuts.show(); return; }
    if (e.key === 'g' || e.key === 'G') {
      gPending = true; clearTimeout(gTimer);
      gTimer = setTimeout(function () { gPending = false; }, 1400);
      return;
    }
    if (gPending) {
      var href = GOTO[e.key.toLowerCase()];
      gPending = false; clearTimeout(gTimer);
      if (href) {
        var m = navFlat().filter(function (x) { return x.item.href === href; })[0];
        if (m && m.item.perm && !can(m.item.perm)) { Toast.push('ليس لديك صلاحية فتح «' + m.item.label + '»', 'warning'); return; }
        e.preventDefault(); root.location.href = href;
      }
    }
  }

  /* ══════════════════════════════════════════════════════════════════
     14 · NETWORK BUSY BAR — a pass-through fetch counter scoped to the
     Firebase REST host, so the appbar shows work without any page opting in.
     ══════════════════════════════════════════════════════════════════ */
  function hookFetch() {
    if (!root.fetch || root.fetch.__uiHooked) return;
    var orig = root.fetch.bind(root);
    var wrapped = function (input, init) {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var watch = /firebasedatabase\.app|googleapis\.com/.test(url);
      if (watch) Shell.busy(true);
      var p = orig(input, init);
      if (!watch) return p;
      return p.then(function (r) { Shell.busy(false); return r; }, function (e) { Shell.busy(false); throw e; });
    };
    wrapped.__uiHooked = true;
    root.fetch = wrapped;
  }

  /* ══════════════════════════════════════════════════════════════════
     15 · MOUNT
     ══════════════════════════════════════════════════════════════════ */
  function onScroll() {
    var bar = Shell.appbar;
    if (!bar) return;
    var y = root.pageYOffset || doc().documentElement.scrollTop || 0;
    bar.classList.toggle('is-stuck', y > 8);
  }

  var Shell2 = {
    version: VERSION,
    mount: function (opts) {
      opts = opts || {};
      Shell.activePage = opts.activePage || Shell.activePage ||
        safe(function () { return (root.location.pathname.split('/').pop() || 'index.html'); }, 'index.html');
      Prefs.apply();
      doc().documentElement.setAttribute('data-shell', 'v2');

      if (!Shell.mounted) {
        var bar = Shell.buildAppbar();
        doc().body.insertBefore(bar, doc().body.firstChild);
        Shell.appbar = bar;
        doc().body.appendChild(Shell.buildBottomNav());

        // Skip link: the first focusable thing on every page.
        var skip = el('a', { class: 'skip-link', href: '#main-content', text: 'تخطَّ إلى المحتوى' });
        doc().body.insertBefore(skip, doc().body.firstChild);
        var pw = $('.page-wrap');
        if (pw && !pw.id) { pw.id = 'main-content'; pw.setAttribute('tabindex', '-1'); }

        $('#uiSearchTrigger').addEventListener('click', function () { Palette.show(); });
        $('#uiBellBtn').addEventListener('click', function (e) { e.stopPropagation(); Notifs.toggle(); });
        $('#uiThemeBtn').addEventListener('click', function () { Prefs.cycleTheme(); });
        $('#uiQuickAddBtn').addEventListener('click', function (e) { e.stopPropagation(); Menus.open('#uiQuickAddBtn', '#uiQuickAddMenu'); });
        $('#uiUserBtn').addEventListener('click', function (e) { e.stopPropagation(); Menus.open('#uiUserBtn', '#uiUserMenu'); });
        var mb = $('#uiMenuBtn');
        if (mb) mb.addEventListener('click', function () {
          if (root.toggleRailDrawerMobile) root.toggleRailDrawerMobile();
          else if (root.openSidebar) root.openSidebar();
        });
        var bm = $('#uiBottomMore');
        if (bm) bm.addEventListener('click', function () {
          if (root.toggleRailDrawerMobile) root.toggleRailDrawerMobile();
          else if (root.openSidebar) root.openSidebar();
        });

        doc().addEventListener('keydown', onKeydown);
        root.addEventListener('scroll', onScroll, { passive: true });
        hookFetch();
        markArchivedNav();
        Shell.mounted = true;

        // Mac users see ⌘ instead of Ctrl in the hint.
        var isMac = /Mac|iPod|iPhone|iPad/.test(root.navigator && root.navigator.platform || '');
        var kh = $('#uiKbdHint'); if (kh && isMac) kh.textContent = '⌘K';

        // The page title may be rendered after the shell (async data), so
        // keep the appbar in sync with whatever the page header settles on.
        var ph = doc().getElementById('page-header');
        if (ph && root.MutationObserver) {
          try {
            new MutationObserver(function () {
              var t = $('#uiAppbarTitle'), c = $('#uiCrumbCurrent');
              if (t) t.textContent = Shell.pageTitle();
              if (c) c.textContent = Shell.crumbLabel();
            }).observe(ph, { childList: true, subtree: true, characterData: true });
          } catch (e) {}
        }
      }

      Shell.paintMenus();
      Prefs._paintIcon();
      onScroll();
      Tables.enhance();

      // Notifications: load once, then keep the badge fresh every 2 minutes
      // (the same cadence the existing bell used, without a second timer).
      Notifs.load(false);
      if (!Shell2._notifTimer) {
        Shell2._notifTimer = setInterval(function () { if (doc().visibilityState === 'visible') Notifs.load(true); }, 120000);
      }

      // Deep link: ?quick=openAddWeight runs a quick-add action on arrival,
      // which is what the palette does when the target page is not loaded.
      var quick = safe(function () { return new URLSearchParams(root.location.search).get('quick'); }, null);
      if (quick) {
        safe(function () {
          var hist = root.history && root.history.replaceState;
          if (hist) root.history.replaceState({}, '', root.location.pathname);
        });
        setTimeout(function () {
          if (typeof root[quick] === 'function') { safe(function () { root[quick](); }); }
          else { Palette.show(); Toast.push('اختر الإجراء من لوحة الأوامر', 'info', { duration: 3000 }); }
        }, 450);
      }
    },
    // public surface
    toast: Toast.push, prefs: Prefs, palette: Palette, notifs: Notifs,
    tables: Tables, confirm: Confirm.open, farmConfirm: farmConfirm, prompt: Prompt.open, farmPrompt: farmPrompt,
    shortcuts: Shortcuts.show,
    busy: Shell.busy, shell: Shell, menus: Menus, applyPrefs: function () { Prefs.apply(); },
    // Exposed for tests and for any page that wants the SAME matching and
    // number-folding the shell uses (a page that invents its own sort ends up
    // ordering ٤٥ alphabetically after ١٢٠).
    fuzzy: fuzzy, fold: fold, foldNumber: num, highlight: highlight,
    markArchivedNav: markArchivedNav,
  };

  root.UIShell = Shell2;

  // Auto-mount when the page has a rail but shared.js did not call us
  // (older cached shared.js, or a page that renders its own markup).
  function autoMount() {
    if (Shell.mounted) return;
    // Only pages that actually render a shell get one. login.html, index.html
    // and the printable bayan reports load this file for the preferences and
    // the palette but must not grow an appbar.
    if (!$('.rail-v2') && !$('.navbar-wonder') && !$('.sidebar-menu')) return;
    var active = '';
    var cur = $('.rail-v2__child.active, .sidebar-item.active');
    if (cur) active = cur.getAttribute('href') || '';
    Shell2.mount({ activePage: active });
  }
  // Preferences apply immediately (not on DOMContentLoaded): the inline head
  // script on every page has already set data-theme, and this adds density /
  // contrast / motion without waiting for the body to exist.
  safe(function () { Prefs.apply(); });

  if (doc().readyState === 'loading') doc().addEventListener('DOMContentLoaded', function () { setTimeout(autoMount, 0); });
  else setTimeout(autoMount, 0);

})(typeof window !== 'undefined' ? window : globalThis);
