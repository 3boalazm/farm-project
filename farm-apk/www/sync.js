'use strict';
var _syncLive=null,_syncCached=null;
var SYNC_CATS=[
  {id:'goat',   label:'الماعز (الكل)',           filter:function(a){return a.species==='goat';}},
  {id:'sheep',  label:'الأغنام (الكل)',           filter:function(a){return a.species==='sheep';}},
  {id:'goatB',  label:'مواليد الماعز',            filter:function(a){return a.species==='goat'&&(a.purpose==='birth'||a.breed==='مواليد');}},
  {id:'sheepB', label:'مواليد الأغنام',           filter:function(a){return a.species==='sheep'&&(a.purpose==='birth'||a.breed==='مواليد');}},
  {id:'dead',   label:'النافق',                   filter:function(a){return a.status==='dead';}},
];
function countCat(animals,cat){
  var src=cat.id==='dead'?animals:animals.filter(function(a){return a.status==='alive';});
  return src.filter(cat.filter).length;
}
async function checkSync(){
  var w=document.getElementById('sync-widget');
  if(!w)return;
  w.innerHTML='<div style="display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--text-gray)"><div class="spinner" style="width:12px;height:12px;border-width:2px"></div>فحص التزامن...</div>';
  try{
    _syncCached=await fbGet('animals',false);
    _syncLive=await fbGet('animals',true);
    renderSync(w);
  }catch(e){
    w.innerHTML='<small class="text-gray"><i class="bi bi-wifi-off me-1"></i>تعذر الفحص</small>';
  }
}
function renderSync(w){
  var conflicts=[],synced=[];
  SYNC_CATS.forEach(function(cat){
    var c=countCat(_syncCached,cat),l=countCat(_syncLive,cat);
    if(c!==l)conflicts.push({cat:cat,cached:c,live:l,diff:l-c});
    else synced.push({cat:cat,n:l});
  });
  if(!conflicts.length){
    w.innerHTML='<div style="display:flex;align-items:center;gap:8px;font-size:.8rem">'+
      '<i class="bi bi-check-circle-fill" style="color:var(--green)"></i>'+
      '<span style="color:var(--green);font-weight:600">متزامن مع اليومية ✓</span>'+
      '<span class="text-gray" style="font-size:.72rem">— البيانات محدّثة ('+ar(_syncLive.filter(function(a){return a.status==='alive';}).length)+' حيوان حي)</span>'+
      '<button onclick="checkSync()" class="action-btn sm" style="padding:2px 8px;font-size:.7rem;margin-right:auto" aria-label="تحديث" title="تحديث"><i class="bi bi-arrow-repeat"></i></button>'+
    '</div>';
    return;
  }
  var rows=conflicts.map(function(c){
    var dc=c.diff>0?'var(--green)':'var(--red)';
    return '<tr style="border-top:1px solid var(--border-3)">'+
      '<td style="padding:6px 10px;font-weight:600">'+c.cat.label+'</td>'+
      '<td style="padding:6px 10px;text-align:center;color:var(--blue)">'+ar(c.cached)+'</td>'+
      '<td style="padding:6px 10px;text-align:center;color:var(--green);font-weight:700">'+ar(c.live)+'</td>'+
      '<td style="padding:6px 10px;text-align:center;color:'+dc+';font-weight:700">'+(c.diff>0?'+':'')+ar(Math.abs(c.diff))+(c.diff>0?'↑':'↓')+'</td>'+
    '</tr>';
  }).join('');
  w.innerHTML='<div>'+
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">'+
      '<i class="bi bi-exclamation-triangle-fill" style="color:var(--yellow)"></i>'+
      '<span style="color:var(--yellow);font-weight:700;font-size:.85rem">تعارض في البيانات ('+ar(conflicts.length)+' فئة)</span>'+
    '</div>'+
    '<div class="table-responsive mb-2"><table style="width:100%;font-size:.78rem;border-collapse:collapse">'+
      '<tr style="background:var(--bg-3)">'+
        '<th style="padding:6px 10px;text-align:right">الفئة</th>'+
        '<th style="padding:6px 10px;text-align:center;color:var(--blue)">📊 الداشبورد</th>'+
        '<th style="padding:6px 10px;text-align:center;color:var(--green)">📋 اليومية (مباشر)</th>'+
        '<th style="padding:6px 10px;text-align:center">الفرق</th>'+
      '</tr>'+rows+
    '</table></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'+
      '<span class="text-gray" style="font-size:.78rem">تطبيق من:</span>'+
      '<button class="action-btn primary sm" onclick="applyLive()">'+
        '<i class="bi bi-journal-text me-1"></i>اليومية ('+ar(_syncLive.filter(function(a){return a.status==='alive';}).length)+' حيوان)</button>'+
      '<button class="action-btn sm" style="background:rgba(33,150,243,.1);border-color:rgba(33,150,243,.3);color:var(--blue)" onclick="keepCached()">'+
        '<i class="bi bi-grid-1x2-fill me-1"></i>الداشبورد ('+ar(_syncCached.filter(function(a){return a.status==='alive';}).length)+' حيوان)</button>'+
      '<button class="action-btn sm" onclick="checkSync()" style="margin-right:auto" aria-label="تحديث" title="تحديث"><i class="bi bi-arrow-repeat"></i></button>'+
    '</div></div>';
}
window.applyLive=function(){
  fbCacheInvalidate('animals');
  toast('تم تطبيق بيانات اليومية — جاري التحديث...','info');
  setTimeout(function(){location.reload();},800);
};
window.keepCached=function(){
  var w=document.getElementById('sync-widget');
  if(w)w.innerHTML='<div style="display:flex;align-items:center;gap:8px;font-size:.8rem">'+
    '<i class="bi bi-grid-1x2-fill" style="color:var(--blue)"></i>'+
    '<span style="color:var(--blue)">متزامن مع الداشبورد</span>'+
    '<button onclick="checkSync()" class="action-btn sm" style="padding:2px 8px;font-size:.7rem;margin-right:auto" aria-label="تحديث" title="تحديث"><i class="bi bi-arrow-repeat"></i></button>'+
  '</div>';
  toast('يتم استخدام بيانات الداشبورد الحالية','info');
};
window._initSync=function(){
  if(document.getElementById('sync-widget'))checkSync();
};
