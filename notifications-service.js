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

  async init(){
    if(!initFirebase())return;
    await NS.requestPermission();
    await NS.checkAll();
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
      const [vaccines,breeding,health,meds,feeds,loginN]=await Promise.all([
        fbGet('vaccinations'), fbGet('breeding'), fbGet('health'),
        fbGet('inventory_meds'), fbGet('inventory_feeds'),
        fbGet('login_notifications')
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

      // 6. Expiring medicines
      meds.filter(m=>m.expiry).forEach(m=>{
        const d=Math.ceil((new Date(m.expiry)-t)/86400000);
        if(d>=0&&d<=30){
          const n={type:d<=7?'danger':'warning',cat:'المخزن',icon:'bi-capsule',title:'دواء قارب على الانتهاء: '+m.name,msg:'ينتهي '+m.expiry+' (بعد '+ar(d)+' يوم)',href:'inventory.html',id:'med-exp-'+m._id+'-'+today};
          NS.save(n);
          if(d<=7)NS.push('انتهاء صلاحية: '+m.name, 'ينتهي بعد '+ar(d)+' يوم', '⚠️', n.id, 'inventory.html');
        }
      });

      // 7. Login notifications → admin only
      if(isAdmin){
        loginN.filter(n=>!n.pushed&&n.date===today).forEach(async n=>{
          const notif={type:'info',cat:'تسجيلات الدخول',icon:'bi-box-arrow-in-right',title:'تسجيل دخول: '+n.userName,msg:(ROLES[n.userRole]?.label||n.userRole)+' — '+n.timestamp?.slice(11,16),href:'activity.html',id:'login-'+n._id,for_role:'admin'};
          NS.save(notif);
          NS.push('دخل: '+n.userName, ROLES[n.userRole]?.label||n.userRole, '👤', notif.id, 'activity.html');
          // Mark as pushed
          try{await fbPatch('login_notifications',n._id,{pushed:true});}catch(e){}
        });
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
      const notifs=await fbGet('notifications');
      const unread=notifs.filter(n=>!n.read&&(!n.for_role||n.for_role===u.role||u.role==='admin')).length;
      const b=document.getElementById('bell-badge');
      if(b){if(unread>0){b.style.display='flex';b.textContent=unread>9?'9+':unread;}else b.style.display='none';}
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
  }
};

// Auto-start when Firebase is ready
window.addEventListener('load', async()=>{
  await new Promise(r=>setTimeout(r,2000)); // wait for firebase.js init
  if(typeof initFirebase==='function'&&getUser()){
    NS.init().catch(e=>console.warn('NS init:',e));
  }
});
