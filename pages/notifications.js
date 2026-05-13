'use strict';
document.addEventListener('DOMContentLoaded', async ()=>{
  if(!requireAuth())return;
  const s=getSettings();
  document.getElementById('footer-year').textContent=ar(new Date().getFullYear());
  document.getElementById('footer-farm').textContent=s.farmName;
  renderNavbar('notifications.html');
  const el=document.getElementById('content');
  renderLoading(el);

  // Load all data to generate smart notifications
  const [animals,vaccines,breeding,health,meds,feeds]=await Promise.all([
    fbGet('animals'),fbGet('vaccinations'),fbGet('breeding'),fbGet('health'),fbGet('inventory_meds'),fbGet('inventory_feeds')
  ]);

  const t=new Date();const today=t.toISOString().slice(0,10);
  const notifs=[];

  // 1. Upcoming births (≤15 days)
  breeding.filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{
    const d=Math.ceil((new Date(r.expected_birth)-t)/86400000);
    if(d>=0&&d<=15)notifs.push({type:d<=3?'danger':'warning',cat:'التكاثر',icon:'bi-diagram-2-fill',title:`ولادة متوقعة: ${r.female_tag||r.female_breed}`,msg:`${r.female_breed} — موعد الولادة ${r.expected_birth} ${d===0?'(اليوم!)':`(بعد ${ar(d)} يوم)`}`,date:r.expected_birth});
    if(d<0)notifs.push({type:'danger',cat:'التكاثر',icon:'bi-exclamation-triangle-fill',title:`تأخر في الولادة: ${r.female_tag||r.female_breed}`,msg:`كان موعدها ${r.expected_birth} — تأخرت ${ar(Math.abs(d))} يوم`,date:r.expected_birth});
  });

  // 2. Return to heat (failed, 18-21 days ago)
  breeding.filter(r=>r.status==='failed'&&r.mating_date).forEach(r=>{
    const d=Math.floor((t-new Date(r.mating_date))/86400000);
    if(d>=18&&d<=25)notifs.push({type:'warning',cat:'التكاثر',icon:'bi-arrow-repeat',title:`رجوع شياع: ${r.female_tag||r.female_breed}`,msg:`آخر تقريع ${r.mating_date} — ${ar(d)} يوم (موعد الشياع)`,date:r.mating_date});
  });

  // 3. Overdue vaccinations
  vaccines.filter(v=>v.status==='overdue').forEach(v=>{
    notifs.push({type:'danger',cat:'التحصين',icon:'bi-bandaid-fill',title:`تحصين متأخر: ${v.name}`,msg:`${v.target_section||'—'} — ${ar(+v.count||0)} رأس`,date:today});
  });

  // 4. Upcoming vaccinations (≤7 days)
  vaccines.filter(v=>v.status==='pending'&&v.scheduled_date).forEach(v=>{
    const d=Math.ceil((new Date(v.scheduled_date)-t)/86400000);
    if(d>=0&&d<=7)notifs.push({type:d<=2?'danger':'warning',cat:'التحصين',icon:'bi-bandaid-fill',title:`موعد تحصين قريب: ${v.name}`,msg:`${v.target_section||'—'} — ${v.scheduled_date} (بعد ${ar(d)} يوم)`,date:v.scheduled_date});
  });

  // 5. Active withdrawal periods
  health.filter(r=>r.status==='active'&&r.withdrawal_end&&r.withdrawal_end>=today).forEach(r=>{
    const d=Math.ceil((new Date(r.withdrawal_end)-t)/86400000);
    notifs.push({type:'danger',cat:'الصحة',icon:'bi-exclamation-triangle-fill',title:`فترة تأثير علاج نشط: ${r.animal_tag||r.animal_breed}`,msg:`${r.medication} — لا يُنصح بالبيع حتى انتهاء تأثير العلاج في ${r.withdrawal_end} (متبقي ${ar(d)} يوم)`,date:r.withdrawal_end});
  });

  // 6. Expiring medicines
  meds.filter(m=>m.expiry).forEach(m=>{
    const d=Math.ceil((new Date(m.expiry)-t)/86400000);
    if(d>=0&&d<=30)notifs.push({type:d<=7?'danger':'warning',cat:'المخزن',icon:'bi-capsule',title:`دواء قارب على الانتهاء: ${m.name}`,msg:`ينتهي ${m.expiry} (بعد ${ar(d)} يوم) — المتبقي: ${m.quantity} ${m.unit||''}`,date:m.expiry});
  });

  // 7. Low stock feeds
  feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0).forEach(f=>{
    notifs.push({type:'warning',cat:'المخزن',icon:'bi-bag-fill',title:`مخزون منخفض: ${f.name}`,msg:`المتبقي ${f.quantity} ${f.unit||''} — الحد الأدنى ${f.min_quantity} ${f.unit||''} ${f.barn?'| '+f.barn:''}`,date:today});
  });

  // 8. Low stock meds
  meds.filter(m=>+m.quantity<=+m.min_quantity&&+m.min_quantity>0).forEach(m=>{
    notifs.push({type:'warning',cat:'المخزن',icon:'bi-capsule',title:`مخزون دواء منخفض: ${m.name}`,msg:`المتبقي ${m.quantity} ${m.unit||''} — الحد الأدنى ${m.min_quantity}`,date:today});
  });

  // 9. Dead animals without cause (recently died)
  const recentDead=animals.filter(a=>a.status==='dead'&&a.died_at&&Math.floor((t-new Date(a.died_at))/86400000)<=3);
  if(recentDead.length>0)notifs.push({type:'info',cat:'القطيع',icon:'bi-x-octagon-fill',title:`نفق ${ar(recentDead.length)} ${recentDead.length===1?'رأس':'رؤوس'} مؤخراً`,msg:recentDead.map(a=>a.breed+(a.tag?` #${a.tag}`:'')).join('، '),date:today});

  // Sort by priority
  const order={danger:0,warning:1,info:2};
  notifs.sort((a,b)=>order[a.type]-order[b.type]);

  renderPageHeader('<i class="bi bi-bell-fill accent-text"></i> الإشعارات الذكية',
    `${ar(notifs.length)} تنبيه نشط`,''
  );

  const catCfg={danger:{c:'var(--red)',label:'عاجل'},warning:{c:'var(--orange)',label:'تنبيه'},info:{c:'var(--blue)',label:'معلومة'}};
  const cats=[...new Set(notifs.map(n=>n.cat))];

  el.innerHTML=notifs.length===0?`<div class="empty-state"><i class="bi bi-bell-slash"></i><p>لا توجد تنبيهات الآن 🎉</p><small class="text-gray">ستظهر هنا تنبيهات الولادات والتحصينات والمخزون وفترات السحب تلقائياً</small></div>`:
  cats.map(cat=>{
    const catNotifs=notifs.filter(n=>n.cat===cat);
    return`<div class="mb-4">
      <h6 class="fw-bold mb-3"><i class="bi bi-tag-fill accent-text me-2"></i>${cat} <span class="type-badge badge-gray" style="font-size:.7rem">${ar(catNotifs.length)}</span></h6>
      ${catNotifs.map(n=>{const cfg=catCfg[n.type];return`<div class="notif-item n-${n.type}">
        <div class="d-flex gap-3 align-items-start">
          <div style="width:36px;height:36px;border-radius:50%;background:${cfg.c}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
            <i class="bi ${n.icon}" style="color:${cfg.c}"></i>
          </div>
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div class="fw-bold" style="font-size:.88rem;color:${cfg.c}">${n.title}</div>
              <span class="type-badge" style="background:${cfg.c}22;color:${cfg.c};border:1px solid ${cfg.c}44;font-size:.65rem;flex-shrink:0;margin-right:8px">${cfg.label}</span>
            </div>
            <div class="text-gray" style="font-size:.82rem;margin-top:2px">${n.msg}</div>
          </div>
        </div>
      </div>`;}).join('')}
    </div>`;
  }).join('');
});
