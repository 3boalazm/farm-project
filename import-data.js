// ══════════════════════════════════════════════════════
//  FARM DATA IMPORT — المزرعة النموذجية بالعامرية
//  Run this ONCE from the browser console or import page
//  Animal data as per the daily report 2026/04/04
// ══════════════════════════════════════════════════════

const FARM_ANIMALS = [
  // ═══ GOATS — ماعز ═══
  // بور — تربية
  ...Array.from({length:10},(_,i)=>({species:'goat',breed:'بور',gender:'male',purpose:'tarbiya',status:'alive',tag:'بور-ذ-ت-'+(i+1)})),
  ...Array.from({length:15},(_,i)=>({species:'goat',breed:'بور',gender:'female',purpose:'tarbiya',status:'alive',tag:'بور-ث-ت-'+(i+1)})),
  // بور — تسمين
  ...Array.from({length:4},(_,i)=>({species:'goat',breed:'بور',gender:'male',purpose:'tasmeen',status:'alive',tag:'بور-ذ-س-'+(i+1)})),
  // شامي — تربية
  ...Array.from({length:1},(_,i)=>({species:'goat',breed:'شامي',gender:'male',purpose:'tarbiya',status:'alive',tag:'شامي-ذ-ت-'+(i+1)})),
  ...Array.from({length:141},(_,i)=>({species:'goat',breed:'شامي',gender:'female',purpose:'tarbiya',status:'alive',tag:'شامي-ث-ت-'+(i+1)})),
  // شامي — تسمين
  ...Array.from({length:4},(_,i)=>({species:'goat',breed:'شامي',gender:'male',purpose:'tasmeen',status:'alive',tag:'شامي-ذ-س-'+(i+1)})),
  // بلدي — تربية
  ...Array.from({length:1},(_,i)=>({species:'goat',breed:'بلدي',gender:'male',purpose:'tarbiya',status:'alive',tag:'بلدي-ذ-ت-'+(i+1)})),
  ...Array.from({length:26},(_,i)=>({species:'goat',breed:'بلدي',gender:'female',purpose:'tarbiya',status:'alive',tag:'بلدي-ث-ت-'+(i+1)})),
  // بلدي — تسمين
  ...Array.from({length:6},(_,i)=>({species:'goat',breed:'بلدي',gender:'male',purpose:'tasmeen',status:'alive',tag:'بلدي-ذ-س-'+(i+1)})),
  // مواليد ماعز
  ...Array.from({length:42},(_,i)=>({species:'goat',breed:'مواليد',gender:'male',purpose:'birth',status:'alive',tag:'ماعز-م-ذ-'+(i+1)})),
  ...Array.from({length:58},(_,i)=>({species:'goat',breed:'مواليد',gender:'female',purpose:'birth',status:'alive',tag:'ماعز-م-ث-'+(i+1)})),

  // ═══ SHEEP — أغنام ═══
  // برقي — تربية
  ...Array.from({length:2},(_,i)=>({species:'sheep',breed:'برقي',gender:'male',purpose:'tarbiya',status:'alive',tag:'برقي-ذ-ت-'+(i+1)})),
  ...Array.from({length:68},(_,i)=>({species:'sheep',breed:'برقي',gender:'female',purpose:'tarbiya',status:'alive',tag:'برقي-ث-ت-'+(i+1)})),
  // برقي — تسمين
  ...Array.from({length:15},(_,i)=>({species:'sheep',breed:'برقي',gender:'male',purpose:'tasmeen',status:'alive',tag:'برقي-ذ-س-'+(i+1)})),
  // دودبر — تربية
  ...Array.from({length:1},(_,i)=>({species:'sheep',breed:'دودبر',gender:'male',purpose:'tarbiya',status:'alive',tag:'دودبر-ذ-ت-'+(i+1)})),
  ...Array.from({length:1},(_,i)=>({species:'sheep',breed:'دودبر',gender:'female',purpose:'tarbiya',status:'alive',tag:'دودبر-ث-ت-'+(i+1)})),
  // ميت ماستر — تربية
  ...Array.from({length:1},(_,i)=>({species:'sheep',breed:'ميت ماستر',gender:'male',purpose:'tarbiya',status:'alive',tag:'ميت-ذ-ت-'+(i+1)})),
  // مواليد أغنام — تربية
  ...Array.from({length:17},(_,i)=>({species:'sheep',breed:'مواليد',gender:'male',purpose:'birth',status:'alive',tag:'أغنام-م-ذ-'+(i+1)})),
  ...Array.from({length:23},(_,i)=>({species:'sheep',breed:'مواليد',gender:'female',purpose:'birth',status:'alive',tag:'أغنام-م-ث-'+(i+1)})),
  // مواليد أغنام — تسمين
  ...Array.from({length:12},(_,i)=>({species:'sheep',breed:'مواليد',gender:'female',purpose:'tasmeen',status:'alive',tag:'أغنام-م-ث-س-'+(i+1)})),
];

async function importFarmData(){
  console.log('Starting import of '+FARM_ANIMALS.length+' animals...');
  let ok=0, failed=0;
  for(let i=0;i<FARM_ANIMALS.length;i++){
    const a={...FARM_ANIMALS[i],birth_date:null,barn:null,created_at:new Date().toISOString()};
    try{await fbPost('animals',a);ok++;if(ok%50===0)console.log('Imported: '+ok);}
    catch(e){failed++;console.error('Failed:',a.tag,e);}
  }
  console.log('Done! Imported: '+ok+', Failed: '+failed);
  alert('تم استيراد '+ok+' حيوان بنجاح!\nالفاشل: '+failed);
}

console.log('Farm data ready. Call importFarmData() to import '+FARM_ANIMALS.length+' animals');
