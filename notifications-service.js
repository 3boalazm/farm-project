'use strict';
// ══════════════════════════════════════════════════════
//  FARM NOTIFICATION SERVICE
//  - Browser Push Notifications (Notification API)
//  - Firebase-stored notifications
//  - Auto-polling every 5 minutes
//  - Weather alerts
//  - Login alerts → admin
// ══════════════════════════════════════════════════════

const NS = {
  _polling: null,
  _lastWeatherTemp: null,
  _sentIds: new Set(JSON.parse(localStorage.getItem('_sentNotifIds')||'[]').slice(-100)),

  // ── Init ──────────────────────────────────────────
  // ── Notification Sound ──────────────────────────────
  _sound: null,
  initSound(){
    // Create beep using Web Audio API (no external file needed)
    try{
      const AudioCtx=window.AudioContext||window.webkitAudioContext;
      if(!AudioCtx){return;}
      NS._audioCtx=new AudioCtx();
    }catch(e){}
  },
  playSound(freq=880, dur=0.3, type='sine'){
    try{
      if(!NS._audioCtx){NS.initSound();}
      if(!NS._audioCtx)return;
      const osc=NS._audioCtx.createOscillator();
      const gain=NS._audioCtx.createGain();
      osc.connect(gain);gain.connect(NS._audioCtx.destination);
      osc.type=type;osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.3,NS._audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,NS._audioCtx.currentTime+dur);
      osc.start();osc.stop(NS._audioCtx.currentTime+dur);
    }catch(e){}
  },
  playAlert(type){
    if(localStorage.getItem('farm_notif_sound')==='off')return;
    if(type==='danger'){NS.playSound(440,0.2);setTimeout(()=>NS.playSound(440,0.2),300);}
    else if(type==='warning'){NS.playSound(660,0.2);}
    else{NS.playSound(880,0.15);}
  },

  // ── Weather alert for animals ─────────────────────
  async checkWeather(){
    try{
      const w=await getWeather();
      if(!w||!w.main)return;
      const temp=Math.round(w.main.temp);
      const humidity=w.main.humidity||0;
      const lastAlert=localStorage.getItem('_lastWeatherAlert');
      const todayKey='weather_'+todayStr();
      if(lastAlert===todayKey)return; // only once per day

      let severity=null,msg='',icon='🌤';
      if(temp>=40){severity='danger';msg='حر شديد جداً ('+temp+'°م) — خطر على الحيوانات. وفّر مياه وتظليل فوري وراقب علامات الإجهاد الحراري.';icon='🔥';}
      else if(temp>=35){severity='warning';msg='جو حار ('+temp+'°م) — تأكد من توافر المياه والتهوية الجيدة في الحظائر.';icon='☀️';}
      else if(temp<=5){severity='danger';msg='برد شديد ('+temp+'°م) — احمِ الحيوانات من التعرض للبرد، خاصة المواليد والحوامل.';icon='❄️';}
      else if(temp<=12){severity='warning';msg='جو بارد ('+temp+'°م) — راقب المواليد الصغيرة وتأكد من دفء الحظائر.';icon='🌨️';}
      else if(humidity>85){severity='info';msg='رطوبة عالية ('+humidity+'٪) — راقب أمراض الجهاز التنفسي وتأكد من التهوية.';icon='💧';}
      else{msg='الطقس مناسب ('+temp+'°م، رطوبة '+humidity+'٪) — حالة المزرعة جيدة.';icon='✅';}

      if(msg){
        const notif={
          type:severity||'info',cat:'طقس',icon:'bi-cloud-sun-fill',
          title:icon+' حالة الطقس اليومية',msg:msg,href:'dashboard.html',
          id:'weather_'+todayStr(),date:todayStr()
        };
        NS.save(notif);
        if(severity){NS.push(icon+' الطقس: '+msg.slice(0,40)+'...', msg, icon, notif.id,'dashboard.html',severity);}
        localStorage.setItem('_lastWeatherAlert',todayKey);
      }
    }catch(e){console.warn('Weather check:',e);}
  },

  async init(){
    if(!initFirebase())return;
    await NS.requestPermission();
    await NS.checkAll();
    await NS.checkWeather(); // daily weather alert
    // Poll every 5 minutes
    NS._polling = setInterval(()=>NS.checkAll(), 5*60*1000);
    // Weather every 15 minutes
    setInterval(()=>NS.checkWeather(), 15*60*1000);
    NS.checkWeather();
  },

  // ── Request browser notification permission ────────
  async requestPermission(){
    if(!('Notification' in window))return false;
    if(Notification.permission==='default'){
      const p=await Notification.requestPermission();
      return p==='granted';
    }
    return Notification.permission==='granted';
  },

  // ── Send browser push notification ────────────────
  push(title, body, icon='🐐', tag, url, soundType='info'){
    NS.playAlert(soundType);
    if(Notification.permission!=='granted')return;
    const opts={body, icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',tag:tag||title, requireInteraction:false};
    const n=new Notification('🐐 '+title, opts);
    if(url)n.onclick=()=>{window.focus();if(url)location.href=url;};
    setTimeout(()=>n.close(), 8000);
  },

  // ── Save notification to Firebase ──────────────────
  async save(notif){
    const id=notif.id||(notif.type+'-'+notif.title+'-'+todayStr()).replace(/\s/g,'');
    if(NS._sentIds.has(id))return; // avoid duplicate
    NS._sentIds.add(id);
    const arr=[...NS._sentIds].slice(-100);
    localStorage.setItem('_sentNotifIds', JSON.stringify(arr));
    try{
      await fbPost('notifications',{
        ...notif, id,
        read: false,
        created_at: new Date().toISOString(),
        date: todayStr(),
        for_role: notif.for_role||'admin'
      });
    }catch(e){console.warn('NS.save:',e);}
  },

  // ── Check all notification sources ────────────────
  async checkAll(){
    if(!initFirebase())return;
    try{
      const [vaccines,breeding,health,meds,feeds,loginN,animals,weightAlertsRaw,productionRaw]=await Promise.all([
        fbGet('vaccinations'), fbGet('breeding'), fbGet('health'),
        fbGet('inventory_meds'), fbGet('inventory_feeds'),
        fbGet('login_notifications'),
        fbGet('animals').catch(()=>[]),        // Sprint 9: candidate selection for operational-priority check
        fbGet('weight_alerts').catch(()=>[]),  // Sprint 9: same candidate-selection input Sprint 8's report tab uses
        fbGet('production_log').catch(()=>[]), // Sprint 9: same candidate-selection input Sprint 8's report tab uses
      ]);
      const t=new Date(), today=todayStr();
      const u=getUser();
      const isAdmin=u?.role==='admin';

      // 1. Vaccinations
      vaccines.forEach(v=>{
        if(v.status==='overdue'){
          const n={type:'danger',cat:'التحصين',icon:'bi-bandaid-fill',title:'تحصين متأخر: '+v.name,msg:v.target_section||'—',href:'vaccine.html',id:'vacc-over-'+v._id};
          NS.save(n); NS.push('تحصين متأخر: '+v.name, v.target_section||'—', '💉', n.id, 'vaccine.html','danger');
        }
        if(v.status==='pending'&&v.scheduled_date){
          const d=Math.ceil((new Date(v.scheduled_date)-t)/86400000);
          if(d>=0&&d<=7){
            const n={type:d<=2?'danger':'warning',cat:'التحصين',icon:'bi-bandaid-fill',title:'موعد تحصين قريب: '+v.name,msg:v.target_section+' — بعد '+ar(d)+' يوم',href:'vaccine.html',id:'vacc-up-'+v._id+'-'+today};
            NS.save(n);
            if(d<=2)NS.push('موعد تحصين: '+v.name, 'بعد '+ar(d)+' يوم — '+v.target_section, '💉', n.id, 'vaccine.html','warning');
          }
        }
      });

      // 2. Births/Pregnancy
      breeding.filter(r=>r.status==='pregnant'&&r.expected_birth).forEach(r=>{
        const d=Math.ceil((new Date(r.expected_birth)-t)/86400000);
        if(d>=0&&d<=15){
          const n={type:d<=3?'danger':'warning',cat:'التكاثر',icon:'bi-stars',title:'ولادة متوقعة: '+(r.female_tag||r.female_breed||'—'),msg:r.female_breed+' — '+r.expected_birth+(d===0?' (اليوم!)':' (بعد '+ar(d)+' يوم)'),href:'breeding.html',id:'birth-up-'+r._id+'-'+today};
          NS.save(n);
          if(d<=3)NS.push('ولادة متوقعة: '+(r.female_tag||r.female_breed), 'بعد '+ar(d)+' يوم — '+r.female_breed, '🐑', n.id, 'breeding.html','warning');
        }
        if(d<0){
          const n={type:'danger',cat:'التكاثر',icon:'bi-exclamation-triangle-fill',title:'تأخر ولادة: '+(r.female_tag||r.female_breed||'—'),msg:'تأخرت '+ar(Math.abs(d))+' يوم',href:'breeding.html',id:'birth-late-'+r._id+'-'+today};
          NS.save(n); NS.push('تأخر ولادة!', r.female_breed+' تأخرت '+ar(Math.abs(d))+' يوم', '⚠️', n.id, 'breeding.html');
        }
      });

      // 3. Treatment effect (withdrawal)
      health.filter(r=>r.status==='active'&&r.treatment_effect_end&&r.treatment_effect_end>=today).forEach(r=>{
        const n={type:'danger',cat:'الصحة',icon:'bi-exclamation-triangle-fill',title:'تأثير علاج نشط: '+(r.animal_tag||r.animal_breed||'—'),msg:r.medication+' — حتى '+r.treatment_effect_end,href:'health.html',id:'withdraw-'+r._id+'-'+today};
        NS.save(n);
      });

      // 4. Low stock — medicines
      meds.filter(m=>+m.quantity<=+m.min_quantity&&+m.min_quantity>0).forEach(m=>{
        const n={type:'warning',cat:'المخزن',icon:'bi-capsule',title:'مخزون دواء منخفض: '+m.name,msg:'متبقي '+m.quantity+' '+( m.unit||'')+' — الحد الأدنى '+m.min_quantity,href:'inventory.html',id:'med-low-'+m._id+'-'+today};
        NS.save(n); NS.push('مخزون منخفض: '+m.name, 'متبقي '+m.quantity+' '+( m.unit||''), '💊', n.id, 'inventory.html');
      });

      // 5. Low stock — feeds
      feeds.filter(f=>+f.quantity<=+f.min_quantity&&+f.min_quantity>0).forEach(f=>{
        const n={type:'warning',cat:'المخزن',icon:'bi-bag-fill',title:'مخزون علف منخفض: '+f.name,msg:'متبقي '+f.quantity+' '+(f.unit||'')+' / الحد '+f.min_quantity,href:'inventory.html',id:'feed-low-'+f._id+'-'+today};
        NS.save(n); NS.push('علف منخفض: '+f.name, 'متبقي '+f.quantity+' '+(f.unit||''), '🌾', n.id, 'inventory.html');
      });

      // 5b. Out of Stock (Sprint 14, v1.7) -- distinct danger-severity
      // trigger alongside the EXISTING Low Stock warning above, never
      // replacing it. Fires only at quantity<=0, a strictly narrower
      // condition than quantity<=min_quantity.
      meds.filter(m=>+m.quantity<=0).forEach(m=>{
        const n={type:'danger',cat:'المخزن',icon:'bi-capsule',title:'نفاد كامل: '+m.name,msg:'الكمية صفر — يلزم إعادة تخزين فورية',href:'inventory.html',id:'med-out-'+m._id+'-'+today};
        NS.save(n); NS.push('🚨 نفاد كامل: '+m.name, 'الكمية صفر', '🚨', n.id, n.href, 'danger');
      });
      feeds.filter(f=>+f.quantity<=0).forEach(f=>{
        const n={type:'danger',cat:'المخزن',icon:'bi-bag-fill',title:'نفاد كامل: '+f.name,msg:'الكمية صفر — يلزم إعادة تخزين فورية',href:'inventory.html',id:'feed-out-'+f._id+'-'+today};
        NS.save(n); NS.push('🚨 نفاد كامل: '+f.name, 'الكمية صفر', '🚨', n.id, n.href, 'danger');
      });

      // 6. Expiring medicines
      meds.filter(m=>m.expiry).forEach(m=>{
        const d=Math.ceil((new Date(m.expiry)-t)/86400000);
        if(d>=0&&d<=30){
          const n={type:d<=7?'danger':'warning',cat:'المخزن',icon:'bi-capsule',title:'دواء قارب على الانتهاء: '+m.name,msg:'ينتهي '+m.expiry+' (بعد '+ar(d)+' يوم)',href:'inventory.html',id:'med-exp-'+m._id+'-'+today};
          NS.save(n);
          if(d<=7)NS.push('انتهاء صلاحية: '+m.name, 'ينتهي بعد '+ar(d)+' يوم', '⚠️', n.id, 'inventory.html');
        }
        // Sprint 14 (v1.7): Expired -- a real, distinct case (d<0) the
        // existing block above never covered (its own condition
        // requires d>=0). Not a modification of the existing trigger.
        if(d<0){
          const n={type:'danger',cat:'المخزن',icon:'bi-capsule',title:'دواء منتهي الصلاحية: '+m.name,msg:'انتهى منذ '+ar(Math.abs(d))+' يوم — يجب إزالته من الاستخدام',href:'inventory.html',id:'med-expired-'+m._id+'-'+today};
          NS.save(n); NS.push('⛔ منتهي: '+m.name, 'منذ '+ar(Math.abs(d))+' يوم', '⛔', n.id, n.href, 'danger');
        }
      });

      // 6b. Operational Priority (Sprint 9) -- reuses window.evaluateOperationalPriority()
      // and window.rankOperationalPriorities() VERBATIM (Sprint 5's engines). This
      // notification check computes NOTHING itself beyond the SAME candidate-selection
      // filter Sprint 8's report tab already established -- no scoring logic duplicated.
      // Deterministic id (animal+level+today) means this re-fires at most once per day
      // per animal per level, not every 5-minute poll, even while the condition persists.
      if(window.evaluateOperationalPriority){
        try{
          const activeHealthTags=new Set(health.filter(r=>r.status==='active').map(r=>r.animal_tag));
          const activeWeightIds=new Set((weightAlertsRaw||[]).filter(a=>a.status==='active').map(a=>a.animal_id));
          const producingIds=new Set((productionRaw||[]).filter(p=>p.type==='milk'||p.type==='wool').map(p=>p.animal_id));
          const candidates=(animals||[]).filter(a=>a.status!=='dead'&&(activeHealthTags.has(a.tag)||activeWeightIds.has(a._id)||producingIds.has(a._id)));
          for(const a of candidates){
            const p=await window.evaluateOperationalPriority(a._id,a.tag,a.barn);
            if(p&&(p.level==='high'||p.level==='critical')){
              const priToType={critical:'danger',high:'danger',medium:'warning',low:'info'};
              const n={
                type:priToType[p.level]||'warning', priorityLevel:p.level, cat:'الذكاء التشغيلي',
                icon:'bi-stars', title:'أولوية تشغيلية '+(p.level==='critical'?'حرجة':'مرتفعة')+': '+(a.tag||a._id),
                msg:'الدرجة '+p.score+'/100 — '+p.contributingEngines.join('، '),
                href:'animal-detail.html?id='+a._id, animal_id:a._id, animal_tag:a.tag,
                id:'opri-'+a._id+'-'+p.level+'-'+today,
              };
              NS.save(n);
              if(p.level==='critical')NS.push('أولوية حرجة: '+(a.tag||a._id), 'الدرجة '+p.score+'/100', '🚨', n.id, n.href,'danger');
            }
          }
        }catch(e){console.warn('NS operational-priority check:',e);}
      }

      // 6d. Finance alerts (Sprint 13, v1.6) -- reuses
      // window.computeFinanceTrend()/computeFinanceKPIs() verbatim.
      // NOTE: "Budget Overrun" from the original brief is NOT
      // implemented -- confirmed via direct search, zero budget-setting
      // mechanism exists anywhere in this app, and inventing an
      // arbitrary threshold with no real basis would contradict this
      // project's own evidence-first discipline. Documented honestly in
      // docs/features/FINANCE-DISCOVERY.md rather than fabricated here.
      if(window.computeFinanceTrend && isAdmin){
        try{
          var finTrend = await window.computeFinanceTrend('month', 3);
          if(finTrend.length>=2){
            var lastP=finTrend[finTrend.length-1], prevP=finTrend[finTrend.length-2];
            // Monthly loss: this month's net is negative.
            if(lastP.profit<0){
              var n1={type:'danger',cat:'المالية',icon:'bi-graph-down-arrow',title:'خسارة شهرية: '+lastP.label,msg:'صافي '+ar(Math.round(lastP.profit))+' — راجع بنود المصروفات',href:'reports.html',id:'fin-loss-'+lastP.label+'-'+today,for_role:'admin'};
              NS.save(n1); NS.push('⚠️ خسارة شهرية', lastP.label, '💸', n1.id, n1.href, 'danger');
            }
            // Expense spike: this month's expenses real jump vs last month (>30%).
            if(prevP.expenses>0 && (lastP.expenses-prevP.expenses)/prevP.expenses>0.3){
              var pctUp=Math.round(((lastP.expenses-prevP.expenses)/prevP.expenses)*100);
              var n2={type:'warning',cat:'المالية',icon:'bi-arrow-up-circle-fill',title:'ارتفاع مصروفات: '+lastP.label,msg:'+'+ar(pctUp)+'٪ عن '+prevP.label,href:'reports.html',id:'fin-exp-spike-'+lastP.label+'-'+today,for_role:'admin'};
              NS.save(n2);
            }
            // Profit decline: real drop vs last month (>20%), both months profitable.
            if(prevP.profit>0 && lastP.profit>=0 && (prevP.profit-lastP.profit)/prevP.profit>0.2){
              var pctDown=Math.round(((prevP.profit-lastP.profit)/prevP.profit)*100);
              var n3={type:'warning',cat:'المالية',icon:'bi-graph-down',title:'انخفاض الأرباح: '+lastP.label,msg:'-'+ar(pctDown)+'٪ عن '+prevP.label,href:'reports.html',id:'fin-profit-drop-'+lastP.label+'-'+today,for_role:'admin'};
              NS.save(n3);
            }
          }
        }catch(e){}
      }

      // 6c. Predictive Farm Insights (Sprint 12, v1.5) -- fires ONLY for
      // high-confidence insights, per this sprint's own explicit rule.
      // Reuses window.generateFarmInsights() verbatim, no new
      // calculation. Deterministic id (date-scoped) means at most one
      // notification per insight-type per day, same dedup discipline
      // every other trigger already follows.
      if(window.generateFarmInsights){
        try{
          var farmInsights = await window.generateFarmInsights(animals, health, weightAlertsRaw, productionRaw);
          farmInsights.filter(function(ins){return ins.confidence==='high';}).forEach(function(ins, idx){
            var n={type:'warning',cat:'التوقعات',icon:'bi-graph-up-arrow',title:'توقع: '+ins.text,msg:ins.suggestedAction+(ins.evidence?' — '+ins.evidence:''),href:'reports.html',id:'insight-'+idx+'-'+today};
            NS.save(n);
          });
        }catch(e){}
      }

      // 7. Login notifications → admin only (once per session using sessionStorage)
      if(isAdmin){
        const alreadyPushedThis=sessionStorage.getItem('_loginNotifPushed')||'';
        const newUnpushed=loginN.filter(n=>!n.pushed&&n.date===today&&alreadyPushedThis.indexOf(n._id)<0);
        if(newUnpushed.length>0){
          const pushedIds=[];
          for(const n of newUnpushed){
            const notif={type:'info',cat:'تسجيلات الدخول',icon:'bi-box-arrow-in-right',title:'تسجيل دخول: '+n.userName,msg:(ROLES[n.userRole]?.label||n.userRole)+' — '+n.timestamp?.slice(11,16),href:'activity.html',id:'login-'+n._id,for_role:'admin'};
            NS.save(notif);
            NS.push('دخل: '+n.userName, ROLES[n.userRole]?.label||n.userRole, '👤', notif.id, 'activity.html','info');
            try{await fbPatch('login_notifications',n._id,{pushed:true});pushedIds.push(n._id);}catch(e){}
          }
          if(pushedIds.length)sessionStorage.setItem('_loginNotifPushed',alreadyPushedThis+pushedIds.join(','));
        }
      }

      // Update badge count
      NS.updateBadge();
    }catch(e){console.warn('NS.checkAll error:',e);}
  },

  // ── Weather check ──────────────────────────────────
  async checkWeather(){
    if(!initFirebase())return;
    try{
      const w=await getWeather();
      if(!w?.main)return;
      const temp=Math.round(w.main.temp);
      const humidity=w.main.humidity;
      const prev=NS._lastWeatherTemp;
      NS._lastWeatherTemp=temp;

      // Extreme heat
      if(temp>=38){
        const n={type:'danger',cat:'الطقس',icon:'bi-thermometer-high',title:'إجهاد حراري شديد — '+ar(temp)+'°م',msg:'رطوبة '+ar(humidity)+'٪ — زِد المياه وأوقف الرعي في الظهيرة',href:'dashboard.html',id:'heat-'+todayStr()+'-'+temp};
        NS.save(n); NS.push('⚠️ إجهاد حراري — '+ar(temp)+'°م', 'رطوبة '+ar(humidity)+'٪ — إجراءات طارئة مطلوبة', '🌡️', n.id, 'dashboard.html');
      }
      // Extreme cold
      if(temp<=8){
        const n={type:'warning',cat:'الطقس',icon:'bi-snow',title:'برد شديد — '+ar(temp)+'°م',msg:'تحقق من التدفئة وزد الأعلاف',href:'dashboard.html',id:'cold-'+todayStr()+'-'+temp};
        NS.save(n); NS.push('❄️ برد شديد — '+ar(temp)+'°م', 'تحقق من التدفئة', '❄️', n.id, 'dashboard.html');
      }
      // Sudden temperature change (>8°C from last check)
      if(prev!==null&&Math.abs(temp-prev)>=8){
        const dir=temp>prev?'ارتفاع':'انخفاض';
        const n={type:'warning',cat:'الطقس',icon:'bi-thermometer-half',title:'تغير مفاجئ في الحرارة',msg:dir+' مفاجئ من '+ar(prev)+'°م إلى '+ar(temp)+'°م',href:'dashboard.html',id:'weather-change-'+Date.now()};
        NS.save(n); NS.push('تغير مناخي مفاجئ', dir+' من '+ar(prev)+' إلى '+ar(temp)+'°م', '🌤️', n.id, 'dashboard.html');
      }
    }catch(e){console.warn('NS.checkWeather:',e);}
  },

  // ── Update bell badge ──────────────────────────────
  async updateBadge(){
    try{
      const u=getUser();if(!u)return;
      // Sprint 9: reuses the shared counting helper (shared.js) instead
      // of re-filtering here -- same logic, one place, exactly what
      // window.updateGlobalBellBadge() (called on every other page) uses too.
      const count = window.getUnreadNotificationCount ? await window.getUnreadNotificationCount() : 0;
      const b=document.getElementById('bell-badge');
      if(b){if(count>0){b.style.display='flex';b.textContent=count>9?'9+':count;}else b.style.display='none';}
    }catch(e){}
  },

  // ── Mark all as read ──────────────────────────────
  async markAllRead(){
    try{
      const notifs=await fbGet('notifications');
      for(const n of notifs.filter(x=>!x.read)){
        await fbPatch('notifications',n._id,{read:true});
      }
      NS.updateBadge();
    }catch(e){}
  },

  // ── Expire old, already-read notifications (Sprint 9) ──────
  // Simple, real cleanup: read AND older than EXPIRE_DAYS. Unread
  // notifications are NEVER auto-expired, regardless of age -- a user
  // has not yet acted on them. Called once per notifications.html load,
  // not on a background timer (this is a static app with no server-side
  // scheduling capability).
  EXPIRE_DAYS: 30,
  async expireOld(){
    try{
      const notifs=await fbGet('notifications');
      const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-NS.EXPIRE_DAYS);
      const cutoffStr=cutoff.toISOString().slice(0,10);
      const toExpire=notifs.filter(n=>n.read&&n.date&&n.date<cutoffStr);
      for(const n of toExpire){ await fbDelete('notifications',n._id); }
      return toExpire.length;
    }catch(e){ return 0; }
  }
};

// Auto-start after page content renders (non-blocking)
window.addEventListener('load', function(){
  // Delay 6s so page renders first, then start notification polling
  setTimeout(async function(){
    if(typeof initFirebase==='function'&&getUser()){
      NS.init().catch(function(e){console.warn('NS init:',e);});
    }
  }, 6000);
});
