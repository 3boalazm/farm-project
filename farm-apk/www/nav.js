// ══════════════════════════════════════════════════════
//  NAV.JS — Navigation Configuration
//  Edit this file to change menu order/items
// ══════════════════════════════════════════════════════
'use strict';

// ── MAIN SIDEBAR NAVIGATION ──────────────────────────
// Sections rendered in order with dividers
var FARM_NAV = [
  // ── القسم الرئيسي ──
  {section: 'القطيع', items: [
    {href:'dashboard.html', icon:'bi-grid-1x2-fill',      label:'الرئيسية',              perm:'dash'},
    {href:'animals.html',   icon:'bi-list-ul',             label:'إدارة القطيع',          perm:'animals'},
    {href:'goats.html',     icon:'bi-tropical-storm',      label:'الماعز',                perm:'animals'},
    {href:'sheep.html',     icon:'bi-cloud-fill',          label:'الأغنام',               perm:'animals'},
    {href:'births.html',    icon:'bi-stars',               label:'المواليد',              perm:'animals'},
    {href:'dead.html',      icon:'bi-x-octagon-fill',      label:'النافق',                perm:'animals'},
    {href:'barns.html',     icon:'bi-grid-3x3-gap-fill',   label:'الجمالونات والعنابر',   perm:'animals'},
    {href:'diary.html',     icon:'bi-journal-text',        label:'يومية المزرعة',         perm:'dash'},
  ]},
  // ── الصحة والإنتاج ──
  {section: 'الصحة والإنتاج', items: [
    {href:'health.html',     icon:'bi-heart-pulse-fill',    label:'الصحة',                 perm:'health'},
    {href:'vaccine.html',    icon:'bi-bandaid-fill',        label:'التحصين',               perm:'health'},
    {href:'breeding.html',   icon:'bi-diagram-2-fill',      label:'التكاثر',               perm:'breeding'},
    {href:'production.html', icon:'bi-droplet-fill',        label:'الإنتاج',               perm:'animals'},
    {href:'tasks.html',      icon:'bi-list-check',          label:'المهام اليومية',        perm:'animals'},
    {href:'pedigree.html',   icon:'bi-diagram-3-fill',      label:'شجرة النسب',            perm:'animals'},
    {href:'inventory.html',  icon:'bi-boxes',               label:'المخزن',                perm:'inventory'},
  ]},
  // ── المالية والتقارير ──
  {section: 'المالية', items: [
    {href:'finance.html',   icon:'bi-wallet2',             label:'المالية',               perm:'finance'},
    {href:'cost.html',      icon:'bi-calculator-fill',     label:'حاسبة التكاليف',        perm:'finance'},
    {href:'reports.html',   icon:'bi-graph-up',            label:'التقارير',              perm:'reports'},
  ]},
  // ── النظام ──
  {section: 'النظام', items: [
    {href:'notifications.html', icon:'bi-bell-fill',        label:'الإشعارات'},
    {href:'assistant.html',     icon:'bi-robot',             label:'المساعد الذكي'},
    {href:'activity.html',      icon:'bi-clock-history',    label:'سجل الأنشطة',         perm:'admin'},
    {href:'users.html',         icon:'bi-people-fill',      label:'المستخدمون',           perm:'users'},
    {href:'settings.html',      icon:'bi-gear-fill',        label:'الإعدادات'},
    {href:'farm-profile.html',  icon:'bi-building',         label:'ملف المزرعة'},
  ]},
];

// ── Build flat arrays for compatibility ──────────────
var NAV_PAGES = [];
var SIDEBAR_EXTRA = [];
FARM_NAV.forEach(function(section){
  section.items.forEach(function(item){ NAV_PAGES.push(item); });
});
// (SIDEBAR_EXTRA kept empty - all items in NAV_PAGES now)

// ── Build sidebar HTML ──────────────────────────────
function buildSidebarNav(activePage){
  var html = '';
  FARM_NAV.forEach(function(section){
    var visible = section.items.filter(function(p){ return !p.perm || can(p.perm); });
    if(!visible.length) return;
    html += '<div class="sidebar-section-label">'+section.section+'</div>';
    visible.forEach(function(p){
      var isActive = activePage === p.href;
      html += '<a href="'+p.href+'" class="sidebar-item'+(isActive?' active':'')+'">'+
        '<i class="bi '+p.icon+'"></i> '+p.label+'</a>';
    });
    html += '<div class="sidebar-divider"></div>';
  });
  return html;
}
