'use strict';
document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('reports.html');
  renderRelatedLinks('reports.js');
  renderPageHeader('<i class="bi bi-graph-up accent-text"></i> التقارير والإحصائيات','','<button class="action-btn" onclick="exportAllExcel()"><i class="bi bi-file-earmark-excel-fill" style="color:#4caf50"></i> تصدير Excel</button>');
  const el=document.getElementById('content');
  renderLoading(el);

  const [animals,breeding,health,vaccines,finance,meds,feeds]=await Promise.all([
    fbGet('animals'),fbGet('breeding'),fbGet('health'),fbGet('vaccinations'),fbGet('finance'),fbGet('inventory_meds'),fbGet('inventory_feeds')
  ]);

  const alive=animals.filter(a=>a.status==='alive');
  const dead=animals.filter(a=>a.status==='dead');
  const goats=alive.filter(a=>a.species==='goat'&&a.purpose!=='birth');
  const sheep=alive.filter(a=>a.species==='sheep'&&a.purpose!=='birth');
  const births=alive.filter(a=>a.purpose==='birth');
  const s2=getSettings();
  const curr=s2.currency;

  const deathRate=animals.length?((dead.length/animals.length)*100).toFixed(1):0;
  const bornRecs=breeding.filter(r=>r.status==='born');
  const totalBirthRecs=breeding.filter(r=>r.status!=='pending').length||1;
  const fertilityRate=((bornRecs.length/totalBirthRecs)*100).toFixed(1);
  const twinRate=bornRecs.length?((bornRecs.filter(r=>r.offspring_count>=2).length/bornRecs.length)*100).toFixed(1):0;
  const totalIncome=finance.filter(r=>r.type==='income').reduce((t,r)=>t+(+r.amount||0),0);
  const totalExpense=finance.filter(r=>r.type==='expense').reduce((t,r)=>t+(+r.amount||0),0);

  // Breed distribution
  const allBreeds=[...s2.goatBreeds,...s2.sheepBreeds];
  const breedDist=allBreeds.map(b=>({breed:b,count:alive.filter(a=>a.breed===b).length})).filter(b=>b.count>0).sort((a,b)=>b.count-a.count);

  // Barn distribution
  const barns=['ج١ع١','ج١ع٢','ج٢ع١','ج٢ع٢','ج٣ع١','ج٣ع٢','ج٤ع١','ج٤ع٢','ج٥ع١','ج٥ع٢'];
  const barnDist=barns.map(b=>({barn:b,count:alive.filter(a=>a.barn===b).length,breeds:[...new Set(alive.filter(a=>a.barn===b).map(a=>a.breed))]}));

  el.innerHTML=`
  <!-- KPI Cards -->
  <div class="row g-3 mb-4">
    ${[{l:'إجمالي القطيع',v:ar(goats.length+sheep.length+births.length),c:'var(--orange)',i:'bi-bar-chart-fill'},{l:'معدل النفوق',v:ar(+deathRate)+'٪',c:+deathRate>5?'var(--red)':'var(--green)',i:'bi-graph-down'},{l:'معدل الخصوبة',v:ar(+fertilityRate)+'٪',c:+fertilityRate>70?'var(--green)':'var(--orange)',i:'bi-diagram-2-fill'},{l:'معدل التوائم',v:ar(+twinRate)+'٪',c:'var(--purple)',i:'bi-people-fill'},{l:'الإيرادات',v:totalIncome.toLocaleString('ar-EG')+' '+curr,c:'var(--green)',i:'bi-wallet2'},{l:'صافي الربح',v:(totalIncome-totalExpense>=0?'+':'')+(totalIncome-totalExpense).toLocaleString('ar-EG')+' '+curr,c:totalIncome-totalExpense>=0?'var(--green)':'var(--red)',i:'bi-graph-up-arrow'}].map(s=>`<div class="col-6 col-md-4 col-lg-2"><div class="summary-card"><i class="bi ${s.i} d-block mb-2" style="color:${s.c};font-size:1.3rem"></i><div style="font-size:1rem;font-weight:700;color:${s.c};line-height:1.2">${s.v}</div><small class="text-gray">${s.l}</small></div></div>`).join('')}
  </div>

  <div class="row g-3 mb-4">
    <!-- Breed distribution chart -->
    <div class="col-md-6">
      <div class="wonder-card">
        <h6 class="fw-bold mb-3"><i class="bi bi-pie-chart-fill accent-text"></i> توزيع السلالات</h6>
        ${breedDist.length===0?'<div class="text-gray text-center py-3">لا توجد بيانات</div>':breedDist.map((b,i)=>{
          const pct=alive.length?Math.round(b.count/alive.length*100):0;
          const colors=['var(--green)','var(--blue)','var(--orange)','var(--purple)','var(--yellow)','var(--red)'];
          return`<div class="finance-bar-wrap"><div class="lb"><span>${b.breed}</span><span class="fw-bold" style="color:${colors[i%colors.length]}">${ar(b.count)} رأس (${pct}٪)</span></div><div class="finance-bar"><div class="finance-bar-fill" style="width:${pct}%;background:${colors[i%colors.length]}"></div></div></div>`;
        }).join('')}
      </div>
    </div>
    <!-- Animal type breakdown -->
    <div class="col-md-6">
      <div class="wonder-card">
        <h6 class="fw-bold mb-3"><i class="bi bi-grid-3x3-gap-fill accent-text"></i> تفصيل القطيع</h6>
        <table class="tbl"><thead><tr><th>الفئة</th><th>العدد</th><th>الذكور</th><th>الإناث</th></tr></thead><tbody>
          ${[{l:'ماعز (تربية وتسمين)',a:goats.filter(a=>a.species==='goat')},{l:'أغنام (تربية وتسمين)',a:sheep.filter(a=>a.species==='sheep')},{l:'المواليد',a:births},{l:'النافق',a:dead}].map(row=>`<tr><td>${row.l}</td><td class="fw-bold">${ar(row.a.length)}</td><td>${ar(row.a.filter(a=>a.gender==='male').length)}</td><td>${ar(row.a.filter(a=>a.gender==='female').length)}</td></tr>`).join('')}
        </tbody></table>
      </div>
    </div>
  </div>

  <!-- Barn distribution table -->
  <div class="wonder-card mb-4">
    <h6 class="fw-bold mb-3"><i class="bi bi-building accent-text"></i> توزيع القطيع حسب الجمالون والعنبر</h6>
    <div class="table-responsive"><table class="tbl">
      <thead><tr><th>الجمالون/العنبر</th><th>عدد الرؤوس</th><th>السلالات</th><th>نسبة الإشغال</th></tr></thead>
      <tbody>
        ${barns.map(b=>{
          const d=barnDist.find(x=>x.barn===b)||{count:0,breeds:[]};
          const maxCap=200;const pct=Math.min(100,Math.round(d.count/maxCap*100));
          return`<tr><td class="fw-bold">${b}</td><td>${ar(d.count)}</td><td class="text-gray" style="font-size:.78rem">${d.breeds.slice(0,3).join('، ')||'—'}</td><td style="min-width:120px"><div class="d-flex align-items-center gap-2"><div class="finance-bar flex-grow-1" style="height:8px"><div class="finance-bar-fill" style="width:${pct}%;background:${pct>80?'var(--red)':pct>60?'var(--orange)':'var(--green)'}"></div></div><small style="color:${pct>80?'var(--red)':pct>60?'var(--orange)':'var(--green)'};min-width:35px">${pct}٪</small></div></td></tr>`;
        }).join('')}
        <tr style="background:rgba(255,255,255,.03)"><td class="fw-bold accent-text">الإجمالي</td><td class="fw-bold">${ar(alive.length)}</td><td colspan="2"></td></tr>
      </tbody>
    </table></div>
  </div>

  <!-- Vaccination summary -->
  <div class="row g-3 mb-4">
    <div class="col-md-6">
      <div class="wonder-card">
        <h6 class="fw-bold mb-3"><i class="bi bi-bandaid-fill accent-text"></i> ملخص التحصين</h6>
        ${[{l:'تم التنفيذ',v:vaccines.filter(v=>v.status==='done').reduce((t,v)=>t+(+v.count||0),0),c:'var(--green)'},{l:'قيد الانتظار',v:vaccines.filter(v=>v.status==='pending').reduce((t,v)=>t+(+v.count||0),0),c:'var(--orange)'},{l:'متأخر',v:vaccines.filter(v=>v.status==='overdue').reduce((t,v)=>t+(+v.count||0),0),c:'var(--red)'}].map(x=>`<div class="d-flex justify-content-between py-2" style="border-bottom:1px solid #1e1e1e"><span class="text-gray">${x.l}</span><span class="fw-bold" style="color:${x.c}">${ar(x.v)}</span></div>`).join('')}
      </div>
    </div>
    <div class="col-md-6">
      <div class="wonder-card">
        <h6 class="fw-bold mb-3"><i class="bi bi-capsule accent-text"></i> ملخص المخزون</h6>
        ${[{l:'أصناف الأدوية',v:meds.length,c:'var(--red)'},{l:'أدوية قاربت على الانتهاء',v:meds.filter(m=>m.expiry&&Math.ceil((new Date(m.expiry)-new Date())/86400000)<=30&&Math.ceil((new Date(m.expiry)-new Date())/86400000)>=0).length,c:'var(--orange)'},{l:'أصناف الأعلاف',v:feeds.length,c:'var(--orange)'},{l:'أعلاف عند الحد الأدنى',v:feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0).length,c:'var(--red)'}].map(x=>`<div class="d-flex justify-content-between py-2" style="border-bottom:1px solid #1e1e1e"><span class="text-gray">${x.l}</span><span class="fw-bold" style="color:${x.c}">${ar(x.v)}</span></div>`).join('')}
      </div>
    </div>
  </div>`;

  // Attach export function
  window._reportData={animals,breeding,health,vaccines,finance};
});

window.exportAllExcel=async function(){
  const data=window._reportData;if(!data)return;
  if(typeof XLSX==='undefined'){toast('مكتبة Excel غير متاحة','error');return;}
  const s=getSettings();const wb=XLSX.utils.book_new();
  // Animals sheet
  const animRows=[['النوع','السلالة','الجنس','الغرض','الحالة','الترقيم','الجمالون','تاريخ الإضافة'],...(data.animals||[]).map(a=>[a.species==='goat'?'ماعز':'أغنام',a.breed,a.gender==='male'?'ذكر':'أنثى',{tarbiya:'تربية',tasmeen:'تسمين',birth:'مواليد'}[a.purpose]||a.purpose,a.status==='alive'?'حي':'نافق',a.tag||'',a.barn||'',(a.created_at||'').slice(0,10)])];
  const ws1=XLSX.utils.aoa_to_sheet(animRows);ws1['!cols']=Array(8).fill({wch:14});XLSX.utils.book_append_sheet(wb,ws1,'القطيع');
  // Finance sheet
  if(can('finance')){const finRows=[['التاريخ','النوع','الفئة','الوصف','المبلغ'],...(data.finance||[]).map(r=>[r.date||'',r.type==='income'?'إيراد':'مصروف',r.category||'',r.description||'',r.amount||0])];const ws2=XLSX.utils.aoa_to_sheet(finRows);XLSX.utils.book_append_sheet(wb,ws2,'المالية');}
  // Vaccine sheet
  const vacRows=[['التحصين','القسم','العدد','الحالة','تاريخ الموعد','الإنجاز'],...(data.vaccines||[]).map(v=>[v.name,v.target_section||'',v.count||0,{done:'تم',pending:'انتظار',overdue:'متأخر'}[v.status]||v.status,v.scheduled_date||'',v.progress||0])];
  const ws3=XLSX.utils.aoa_to_sheet(vacRows);XLSX.utils.book_append_sheet(wb,ws3,'التحصين');
  XLSX.writeFile(wb,`farm-report-${todayStr()}.xlsx`);
  toast('تم تصدير التقرير');
  await logActivity('export','reports','تصدير تقرير Excel شامل');
};
