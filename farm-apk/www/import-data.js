// ══════════════════════════════════════════════════════
//  FARM DATA — المزرعة النموذجية بالعامرية
//  بيان الماعز والأغنام — ٢٠٢٦/٠٤/٢٤
//  الإجمالي: 440 رأس | أغنام: 121 | ماعز: 319
//  مواليد أغنام: 36 | مواليد ماعز: 75 (إجمالي 111)
//  ملاحظة: المواليد في البيان إجمالي، فوُزّعت على السلالات
//  (ماعز: البور أعلى ثم البلدي ثم الشامي |
//   أغنام: البرقي أعلى ثم الدودبر ثم الميت ماستر)
//  المواليد تُسجَّل بسلالتها الحقيقية + purpose='birth' + mother_breed
//  حتى تُحسب كمواليد (مش ضمن إجمالي السلالة) وتظهر موزّعة.
// ══════════════════════════════════════════════════════

var FARM_ANIMALS = [];

// Helper — حيوانات السلالات (تربية/تسمين)
function addAnimals(species, breed, gender, purpose, count) {
  for (var i = 1; i <= count; i++) {
    var tag = breed + (gender === 'male' ? '-ذ' : '-إ') + '-' + purpose.slice(0,2) + '-' + i;
    FARM_ANIMALS.push({
      species: species,
      breed: breed,
      gender: gender,
      purpose: purpose,
      status: 'alive',
      tag: tag,
      barn: null,
      birth_date: null
    });
  }
}

// Helper — المواليد (بسلالتها الحقيقية + purpose='birth' + mother_breed)
function addBirths(species, breed, gender, count) {
  for (var i = 1; i <= count; i++) {
    var tag = breed + (gender === 'male' ? '-ذ' : '-إ') + '-مو-' + i;
    FARM_ANIMALS.push({
      species: species,
      breed: breed,
      gender: gender,
      purpose: 'birth',
      mother_breed: breed,
      status: 'alive',
      tag: tag,
      barn: null,
      birth_date: null
    });
  }
}

// ═══════════════════════════════
//  أغنام — SHEEP (إجمالي 121)
// ═══════════════════════════════

// برقي — تربية (2♂ + 68♀)  +  تسمين (12♀)   = 82
addAnimals('sheep', 'برقي', 'male',   'tarbiya', 2);
addAnimals('sheep', 'برقي', 'female', 'tarbiya', 68);
addAnimals('sheep', 'برقي', 'female', 'tasmeen', 12);

// دودبر — تربية (1♂ + 1♀)   = 2
addAnimals('sheep', 'دودبر', 'male',   'tarbiya', 1);
addAnimals('sheep', 'دودبر', 'female', 'tarbiya', 1);

// ميت ماستر — تربية (1♂)    = 1
addAnimals('sheep', 'ميت ماستر', 'male', 'tarbiya', 1);

// مواليد أغنام — إجمالي 36 (19♂ + 17♀) موزّعة: برقي > دودبر > ميت ماستر
addBirths('sheep', 'برقي',       'male',   13);
addBirths('sheep', 'برقي',       'female', 12);
addBirths('sheep', 'دودبر',      'male',   4);
addBirths('sheep', 'دودبر',      'female', 4);
addBirths('sheep', 'ميت ماستر',  'male',   2);
addBirths('sheep', 'ميت ماستر',  'female', 1);

// ═══════════════════════════════
//  ماعز — GOATS (إجمالي 319)
// ═══════════════════════════════

// بور — تربية (10♂ + 15♀)  +  تسمين (26♂ + 17♀)  = 68
addAnimals('goat', 'بور', 'male',   'tarbiya', 10);
addAnimals('goat', 'بور', 'female', 'tarbiya', 15);
addAnimals('goat', 'بور', 'male',   'tasmeen', 26);
addAnimals('goat', 'بور', 'female', 'tasmeen', 17);

// شامي — تربية (1♂ + 140♀)  +  تسمين (6♂)  = 147
addAnimals('goat', 'شامي', 'male',   'tarbiya', 1);
addAnimals('goat', 'شامي', 'female', 'tarbiya', 140);
addAnimals('goat', 'شامي', 'male',   'tasmeen', 6);

// بلدي — تربية (1♂ + 26♀)  +  تسمين (2♂)  = 29
addAnimals('goat', 'بلدي', 'male',   'tarbiya', 1);
addAnimals('goat', 'بلدي', 'female', 'tarbiya', 26);
addAnimals('goat', 'بلدي', 'male',   'tasmeen', 2);

// مواليد ماعز — إجمالي 75 (34♂ + 41♀) موزّعة: بور > بلدي > شامي
addBirths('goat', 'بور',  'male',   17);
addBirths('goat', 'بور',  'female', 20);
addBirths('goat', 'بلدي', 'male',   11);
addBirths('goat', 'بلدي', 'female', 13);
addBirths('goat', 'شامي', 'male',   6);
addBirths('goat', 'شامي', 'female', 8);

// Verify
var counts = {total: FARM_ANIMALS.length, goat: 0, sheep: 0, births: 0};
FARM_ANIMALS.forEach(function(a) {
  counts[a.species]++;
  if (a.purpose === 'birth' || a.breed === 'مواليد') counts.births++;
});
console.log && console.log('Data loaded: goat=' + counts.goat + ' sheep=' + counts.sheep +
  ' total=' + counts.total + ' births=' + counts.births);
