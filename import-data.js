// ══════════════════════════════════════════════════════
//  FARM DATA — المزرعة النموذجية بالعامرية
//  بيان الماعز والأغنام — ٢٠٢٦/٠٤/٠٤
//  Total: 462 animals
// ══════════════════════════════════════════════════════

var FARM_ANIMALS = [];

// Helper
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

// ═══════════════════════════════
//  أغنام — SHEEP (140 total)
// ═══════════════════════════════

// برقي — تربية (2♂ + 68♀ = 70)
addAnimals('sheep', 'برقي', 'male',   'tarbiya', 2);
addAnimals('sheep', 'برقي', 'female', 'tarbiya', 68);

// برقي — تسمين (15♂ = 15)
addAnimals('sheep', 'برقي', 'male',   'tasmeen', 15);

// دودبر — تربية (1♂ + 1♀ = 2)
addAnimals('sheep', 'دودبر', 'male',   'tarbiya', 1);
addAnimals('sheep', 'دودبر', 'female', 'tarbiya', 1);

// ميت ماستر — تربية (1♂ = 1)
addAnimals('sheep', 'ميت ماستر', 'male', 'tarbiya', 1);

// ولدات أغنام — تربية (17♂ + 23♀ = 40)
addAnimals('sheep', 'مواليد', 'male',   'birth', 17);
addAnimals('sheep', 'مواليد', 'female', 'birth', 23);

// ولدات أغنام — تسمين (0♂ + 12♀ = 12)
addAnimals('sheep', 'مواليد', 'female', 'tasmeen', 12);

// ═══════════════════════════════
//  ماعز — GOATS (322 total)
// ═══════════════════════════════

// بور — تربية (10♂ + 15♀ = 25)
addAnimals('goat', 'بور', 'male',   'tarbiya', 10);
addAnimals('goat', 'بور', 'female', 'tarbiya', 15);

// بور — تسمين (4♂ = 4)
addAnimals('goat', 'بور', 'male', 'tasmeen', 4);

// شامي — تربية (1♂ + 141♀ = 142)
addAnimals('goat', 'شامي', 'male',   'tarbiya', 1);
addAnimals('goat', 'شامي', 'female', 'tarbiya', 141);

// شامي — تسمين (4♂ = 4)
addAnimals('goat', 'شامي', 'male', 'tasmeen', 4);

// بلدي — تربية (1♂ + 26♀ = 27)
addAnimals('goat', 'بلدي', 'male',   'tarbiya', 1);
addAnimals('goat', 'بلدي', 'female', 'tarbiya', 26);

// بلدي — تسمين (6♂ = 6)
addAnimals('goat', 'بلدي', 'male', 'tasmeen', 6);

// ولدات ماعز — تربية (42♂ + 58♀ = 100)
addAnimals('goat', 'مواليد', 'male',   'birth', 42);
addAnimals('goat', 'مواليد', 'female', 'birth', 58);

// ولدات ماعز — تسمين (14♂ = 14)
addAnimals('goat', 'مواليد', 'male', 'tasmeen', 14);

// Verify
var counts = {total: FARM_ANIMALS.length, goat: 0, sheep: 0};
FARM_ANIMALS.forEach(function(a) { counts[a.species]++; });
console.log && console.log('Data loaded: goat=' + counts.goat + ' sheep=' + counts.sheep + ' total=' + counts.total);
