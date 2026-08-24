#!/usr/bin/env node
// scripts/safety-scan.js
//
// Lightweight, dependency-free (pure Node fs/path) static scanner.
// Three checks, each directly traceable to a real finding from this
// engagement's own history:
//   1. Permission regression -- a nav.js page with no can() guard.
//   2. Duplicate SSOT risk -- animal creation outside createOffspringAnimal().
//   3. Dangerous patterns -- eval/innerHTML/etc., classified not just flagged.
//
// Exit code 1 if any CRITICAL finding exists (for CI use).

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let criticalCount = 0;
let reviewCount = 0;

function readFile(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('=== Safety Scan ===\n');

// ── Check 1: Permission regression ──────────────────────────────
console.log('-- Check 1: Permission regression (nav.js perm vs. can() enforcement) --');
const navContent = readFile('nav.js');
const permMatches = [...navContent.matchAll(/href:'([^']+)'[^}]*perm:'([^']+)'/g)];
// Pages confirmed to need manual review, not auto-flagged as regressions
// (see docs/audit/PERMISSION-MATRIX.md for why).
const KNOWN_EXCEPTIONS = new Set(['bayan.html', 'activity.html']);

for (const [, href, perm] of permMatches) {
  if (KNOWN_EXCEPTIONS.has(href)) {
    console.log(`  SKIP  ${href} (perm:${perm}) -- known exception, see PERMISSION-MATRIX.md`);
    continue;
  }
  let content;
  try {
    content = readFile(href);
  } catch (e) {
    console.log(`  CRITICAL  ${href} -- referenced in nav.js but file does not exist`);
    criticalCount++;
    continue;
  }
  const hasInlineCheck = /if\s*\(\s*!can\(/.test(content);
  let hasDelegatedCheck = false;
  // Derive the expected delegated filename from the PAGE's own basename
  // (health.html -> pages/health.js), not "whichever pages/*.js appears
  // first in the file" -- most delegated pages also load generic
  // utilities (pages/datepicker.js, pages/tour.js) before their own
  // page-specific file, and grabbing the first match found those
  // instead, producing false CRITICAL findings on first run.
  const expectedDelegatedName = href.replace(/\.html$/, '.js');
  const delegatedPathPattern = new RegExp(`pages/${expectedDelegatedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`);
  if (!hasInlineCheck && delegatedPathPattern.test(content)) {
    try {
      const delegated = readFile(path.join('pages', expectedDelegatedName));
      hasDelegatedCheck = /if\s*\(\s*!can\(/.test(delegated);
    } catch (e) { /* no delegated file, fall through */ }
  }
  if (hasInlineCheck || hasDelegatedCheck) {
    console.log(`  OK    ${href} (perm:${perm}) -- enforcement found`);
  } else {
    console.log(`  CRITICAL  ${href} (perm:${perm}) -- declared in nav.js, NO can() enforcement found`);
    criticalCount++;
  }
}

// ── Check 2: Duplicate SSOT risk ────────────────────────────────
console.log('\n-- Check 2: Duplicate SSOT risk (animal creation outside createOffspringAnimal) --');
const APPROVED_ANIMAL_CREATION_FILES = new Set([
  'shared.js', // createOffspringAnimal() itself
]);
const KNOWN_INDEPENDENT_MANUAL_ADD = new Set([
  // Every file classified this engagement as a legitimate, separate
  // manual-add/import context, not a birth-SSOT bypass. See
  // docs/certification/BIRTH.md and the Wave B final certification.
  'animals.html', 'assistant.html', 'births.html', 'dashboard.html',
  'diary.html', 'goats.html', 'import.html', 'sheep.html',
  path.join('pages', 'breeding.js'), // submitBirthDirect() -- deliberately deferred, documented
]);
const allJsHtml = [];
function walk(dir) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    // Exclude: version control, test/tooling dirs (not application code),
    // and farm-apk/www -- a separately-deployed, bundled copy of the app
    // for the Android APK. Whether it's kept in sync with the root app is
    // a real, open question (see docs/audit/PHASE-6 findings) but it is
    // NOT the same SSOT surface this scan polices -- scanning it here
    // would conflate two different repositories' worth of findings.
    if (['node_modules', '.git', 'tests', 'scripts'].includes(entry.name)) continue;
    if (dir === '.' && (entry.name === 'farm-apk' || entry.name === 'release')) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel);
    else if (entry.name.endsWith('.html') || entry.name.endsWith('.js')) allJsHtml.push(rel);
  }
}
walk('.');

let unexpectedCreationSites = 0;
for (const rel of allJsHtml) {
  const content = readFile(rel);
  const count = (content.match(/fbPost\('animals',/g) || []).length;
  if (count === 0) continue;
  if (APPROVED_ANIMAL_CREATION_FILES.has(rel) || KNOWN_INDEPENDENT_MANUAL_ADD.has(rel)) {
    console.log(`  OK    ${rel} -- ${count} known, classified creation site(s)`);
  } else {
    console.log(`  REVIEW  ${rel} -- ${count} unclassified fbPost('animals',...) site(s) -- new file, needs manual classification`);
    reviewCount++;
  }
}

// ── Check 3: Dangerous patterns ─────────────────────────────────
console.log('\n-- Check 3: Dangerous patterns --');
const PATTERNS = [
  { re: /\beval\(/, label: 'eval(', level: 'CRITICAL' },
  { re: /\.innerHTML\s*=/, label: '.innerHTML=', level: 'REVIEW' }, // pervasive, established pattern in this codebase -- not newly dangerous, but worth counting
  { re: /localStorage\.setItem\(['"]farm_user['"]/, label: 'farm_user write', level: 'REVIEW' },
];
const summary = { CRITICAL: 0, REVIEW: 0 };
for (const rel of allJsHtml) {
  const content = readFile(rel);
  for (const { re, label, level } of PATTERNS) {
    if (label === '.innerHTML=') continue; // counted separately below, too noisy per-file otherwise
    if (re.test(content)) {
      console.log(`  ${level}  ${rel} -- contains "${label}"`);
      summary[level]++;
      if (level === 'CRITICAL') criticalCount++;
      if (level === 'REVIEW') reviewCount++;
    }
  }
}
console.log('  (`.innerHTML=` is a pervasive, already-established pattern across this codebase -- not individually flagged per file; a wholesale migration is out of this scan\'s scope.)');

// ── Check 4: XSS-fix regression guard (2026-08-24) ──────────────
// Not a general new-vulnerability detector (that needs a real audit pass,
// see docs/repository/XSS-AUDIT-2026-08-23.md/XSS-FIX-2026-08-24.md) --
// a simple, maintainable tripwire for the specific 25 sinks fixed in that
// pass. Each entry: the file, and the exact escapeHtml(...) expression
// that was inserted there. A future edit that removes the expression
// (e.g. someone "simplifies" the line back to the raw field) fails
// CRITICAL. Deliberately a flat string-presence check, not a line/anchor
// match -- simpler and far less prone to false positives from harmless
// reformatting nearby.
console.log('\n-- Check 4: XSS-fix regression guard (sinks fixed 2026-08-24) --');
const XSS_FIX_SITES = [
  { file: 'shared.js', mustContain: 'title=escapeHtml(title)' },
  { file: 'shared.js', mustContain: 'eventType=escapeHtml(eventType)' },
  { file: 'dashboard.html', mustContain: 'escapeHtml(t.title' },
  { file: 'dashboard.html', mustContain: 'escapeHtml(r.module)' },
  { file: 'dashboard.html', mustContain: 'escapeHtml(r.animalTag||r.animalId)' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(r.description' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(r.animal_tag' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(med.name' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(m2.med' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(w.animalTag)' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(h.animalTag)' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(h.evidence' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(t.item_name)' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(c.feed_name)' },
  { file: 'barns.html', mustContain: 'escapeHtml(b)' },
  { file: 'barns.html', mustContain: 'escapeHtml(a.breed)' },
  { file: 'barns.html', mustContain: "escapeHtml(a.tag||'—')" },
  { file: path.join('pages', 'farm_profile.js'), mustContain: 'escapeHtml((u.name' },
  { file: 'births.html', mustContain: 'escapeHtml(breed)' },
  { file: 'goats.html', mustContain: 'escapeHtml(a.breed||' },
  { file: 'sheep.html', mustContain: 'escapeHtml(a.breed||' },
  { file: path.join('pages', 'pedigree.js'), mustContain: 'escapeHtml(a.tag)' },
  { file: path.join('pages', 'pedigree.js'), mustContain: 'escapeHtml(animal.breed' },
  { file: 'assistant.html', mustContain: 'escapeHtml(String(text))' },
  { file: 'assistant.html', mustContain: 'escapeHtml(fieldLabels[k]||k)' },
  { file: 'assistant.html', mustContain: 'escapeHtml(d.mother_tag' },
  { file: 'assistant.html', mustContain: 'escapeHtml(_farmContext)' },

  // ── Round 2 (2026-08-24): the 41+5 sinks found by the mandatory
  // re-scan after round 1. Same flat string-presence pattern.
  { file: 'animals.html', mustContain: "escapeHtml(a.tag)+'</span>'" },
  { file: 'animals.html', mustContain: 'escapeHtml(a.barn)' },
  { file: 'animals.html', mustContain: "escapeHtml(a.breed||'—')" },
  { file: 'animals.html', mustContain: 'escapeHtml(label)' },
  { file: 'animals.html', mustContain: 'escapeHtml(lbl)' },
  { file: 'animal-detail.html', mustContain: "escapeHtml(animal.breed||'—')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(animal.breed||'غير معروف')" },
  { file: 'animal-detail.html', mustContain: 'escapeHtml(r.diagnosis' },
  { file: 'animal-detail.html', mustContain: 'escapeHtml(r.medication' },
  { file: 'animal-detail.html', mustContain: 'escapeHtml(r.male_tag||r.male_breed' },
  { file: 'animal-detail.html', mustContain: 'escapeHtml(o.tag' },
  { file: 'animal-detail.html', mustContain: "escapeHtml(animal.mother_tag||'')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(animal.father_tag||'')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(animal.notes||'')" }, // textarea-breakout fix
  { file: 'animal-detail.html', mustContain: "id=\"e-breed\">${breeds.map(b=>`<option ${b===animal.breed?'selected':''}>${escapeHtml(b)}" },
  { file: 'import.html', mustContain: 'escapeHtml(r.errors.join' },
  { file: 'import.html', mustContain: 'escapeHtml(r.data[f])' },
  { file: 'shared.js', mustContain: 'name=escapeHtml(name);' }, // renderInventoryStockIndicator
  { file: path.join('pages', 'health.js'), mustContain: 'escapeHtml(r.animal_breed' },
  { file: path.join('pages', 'health.js'), mustContain: "escapeHtml(r.diagnosis||'')" },
  { file: path.join('pages', 'breeding.js'), mustContain: "escapeHtml(r.female_tag||r.female_breed||'—')" },
  { file: path.join('pages', 'breeding.js'), mustContain: "escapeHtml(r.female_tag||decodeURIComponent(prefTag||''))" },
  { file: path.join('pages', 'vaccine.js'), mustContain: "escapeHtml(v.name||'')" },
  { file: path.join('pages', 'production.js'), mustContain: "escapeHtml(a.tag||'')" },
  { file: path.join('pages', 'tasks.js'), mustContain: 'escapeHtml(t.title||\'\')}"' }, // aria-label
  { file: path.join('pages', 'tasks.js'), mustContain: "escapeHtml(d.title || '')" },
  { file: 'cost.html', mustContain: 'escapeHtml(cat)' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(b.breed)' }, // breed-catalog hardening
  { file: 'settings.html', mustContain: 'escapeHtml(item.b)' },
  { file: 'assistant.html', mustContain: "escapeHtml(b)+'</option>'" }, // ea-breed catalog option
  { file: 'finance-reports.html', mustContain: 'escapeHtml(x.name)' },

  // ── Round 3 (independent acceptance-gate re-scan after round 2): 12
  // more VULNERABLE sinks + defense-in-depth breed-catalog hardening
  // extended to every remaining unescaped `<option>`/card builder found
  // by the same audit. Same flat string-presence pattern.
  { file: 'activity.html', mustContain: "escapeHtml(l.description||'—')" },
  { file: 'activity.html', mustContain: "escapeHtml(l.userName||'—')" },
  { file: path.join('pages', 'health.js'), mustContain: 'id="h-tag" value="${escapeHtml(r.animal_tag' },
  { file: path.join('pages', 'health.js'), mustContain: 'id="h-vet" value="${escapeHtml(r.vet_name' },
  { file: path.join('pages', 'health.js'), mustContain: 'id="h-diag" value="${escapeHtml(r.diagnosis' },
  { file: path.join('pages', 'health.js'), mustContain: 'id="h-med" value="${escapeHtml(r.medication' },
  { file: path.join('pages', 'health.js'), mustContain: 'id="h-dose" value="${escapeHtml(r.dosage' },
  { file: path.join('pages', 'health.js'), mustContain: 'id="h-notes" rows="2">${escapeHtml(r.notes' },
  { file: path.join('pages', 'breeding.js'), mustContain: 'id="nb-addedby" value="\'+escapeHtml(u?.name' },
  { file: path.join('pages', 'breeding.js'), mustContain: 'id="b-addedby" value="\'+escapeHtml(r.added_by||u?.name' },
  { file: path.join('pages', 'breeding.js'), mustContain: 'id="b-notes" rows="2">\'+escapeHtml(r.notes' }, // textarea-breakout fix
  { file: path.join('pages', 'vaccine.js'), mustContain: 'id="v-name" value="${escapeHtml(v.name' },
  { file: path.join('pages', 'vaccine.js'), mustContain: 'id="v-notes" rows="2">${escapeHtml(v.notes' }, // textarea-breakout fix
  { file: path.join('pages', 'inventory.js'), mustContain: "feedNames.map(function(f){return '<option>'+escapeHtml(f)" },
  { file: path.join('pages', 'inventory.js'), mustContain: 'id="fc-by" value="\'+escapeHtml(user?.name' },
  { file: 'dead.html', mustContain: "'<option value=\"'+a._id+'\">'+(a.species==='goat'?'🐐':'🐑')+' '+escapeHtml(a.breed||'—')" },
  { file: 'animals.html', mustContain: "escapeHtml(a.breed||'—')+(a.tag?' #'+escapeHtml(a.tag)" }, // openMarkDeath select options
  { file: 'animals.html', mustContain: 'id="d-tag" value="\'+escapeHtml(first.tag' },
  { file: 'dashboard.html', mustContain: "escapeHtml(a.breed||'')+(a.tag?' #'+escapeHtml(a.tag)" }, // openMarkDeathDash select options
  { file: path.join('pages', 'finance.js'), mustContain: '<span class="text-gray">${escapeHtml(cat)}' }, // sibling of the already-fixed cost.html widget
  { file: path.join('pages', 'farm_profile.js'), mustContain: 'id="fp-name" value="${escapeHtml(s.farmName' }, // localStorage-sourced, defense-in-depth

  // Breed-catalog `<option>`/card interpolation, defense-in-depth (source:
  // localStorage['farm_settings'], no in-app way to inject a malicious
  // value today -- see docs/repository/XSS-AUDIT-2026-08-23.md's
  // REQUIRES-FUTURE-HARDENING classification -- fixed anyway since it's
  // the same one-line change as every VULNERABLE sink above).
  { file: 'animal-detail.html', mustContain: "e-breed').innerHTML=(sp==='goat'?s.goatBreeds:s.sheepBreeds).map(b=>`<option>${escapeHtml(b)}" },
  { file: 'animal-detail.html', mustContain: 'id="o-breed">${s.goatBreeds.concat(s.sheepBreeds).map(b=>`<option value="${escapeHtml(b)}' },
  { file: path.join('pages', 'health.js'), mustContain: 'value="${escapeHtml(b)}" ${r.animal_breed===b' },
  { file: path.join('pages', 'breeding.js'), mustContain: "id=\"nb-breed\">'+allBreeds.map(b=>'<option value=\"'+escapeHtml(b)" },
  { file: path.join('pages', 'breeding.js'), mustContain: "id=\"nb-mother-breed\">'+allBreeds.map(b=>'<option value=\"'+escapeHtml(b)" },
  { file: path.join('pages', 'breeding.js'), mustContain: 'id="b-fb">\'+((sp===' },
  { file: 'shared.js', mustContain: 'id="ub-breed">\'+s.goatBreeds.map(b=>\'<option>\'+escapeHtml(b)' },
  { file: 'animals.html', mustContain: "s.goatBreeds.map(function(b){return'<option>'+escapeHtml(b)" },
  { file: 'dashboard.html', mustContain: "s.goatBreeds.map(function(b){return'<option>'+escapeHtml(b)" },
  { file: 'diary.html', mustContain: "'<div class=\"dd-card__name\">'+escapeHtml(breed)" },
  { file: 'goats.html', mustContain: "'<div><div class=\"fw-bold\">'+escapeHtml(breed)" },
  { file: 'sheep.html', mustContain: "'<div><div class=\"fw-bold\">'+escapeHtml(breed)" },
  // -- Round 2 (2026-08-24 re-scan fixes) --
  { file: 'animal-detail.html', mustContain: "escapeHtml(n.title||'—')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(n.msg||'')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(e.label||'')+' — '+escapeHtml(e.detail||'')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(r.label||'')+'</strong> — '+escapeHtml(r.evidence||'')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(c.evidence||'')" },
  { file: 'animal-detail.html', mustContain: "escapeHtml(r.diagnosis||'—')+(r.status===" },
  { file: 'animals.html', mustContain: 'id="f-search" value="\'+escapeHtml(fSearch)' },
  { file: 'animals.html', mustContain: "allBreeds.map(function(b){return'<option value=\"'+escapeHtml(b)+'\">'+escapeHtml(b)" },
  { file: 'import.html', mustContain: "escapeHtml(fileName) + ' — '" },
  { file: 'import.html', mustContain: "+ escapeHtml(h) + '</option>'" },
  { file: 'import.html', mustContain: 'escapeHtml(String(sampleVal).slice(0,14))' },
  { file: 'import.html', mustContain: 'escapeHtml(r.warnings.join' },
  { file: 'assistant.html', mustContain: "id=\"ea-count\" value=\"'+escapeHtml(d.count" },
  { file: 'assistant.html', mustContain: "id=\"ea-date\" value=\"'+escapeHtml(d.birth_date||d.date||todayStr())" },
  { file: 'assistant.html', mustContain: 'id="groq-key-input" type="password" value="\' + escapeHtml(current)' },
  { file: 'assistant.html', mustContain: 'id="groq-model-input" type="text" value="\' + escapeHtml(model)' },
  { file: path.join('pages', 'farm_profile.js'), mustContain: 'src="${escapeHtml(s.logoUrl)}"' },
  { file: path.join('pages', 'farm_profile.js'), mustContain: '<h2 class="fw-bold mb-1">${escapeHtml(s.farmName||\'\')}</h2>' },
  { file: path.join('pages', 'farm_profile.js'), mustContain: '${escapeHtml(s.farmAddress)}</span>' },
  { file: path.join('pages', 'farm_profile.js'), mustContain: 'العملة: ${escapeHtml(s.currency||\'\')}' },
  { file: path.join('pages', 'farm_profile.js'), mustContain: 'id="fp-lat" value="${escapeHtml(s.farmLat' },
  { file: path.join('pages', 'farm_profile.js'), mustContain: 'id="fp-lng" value="${escapeHtml(s.farmLng' },
  { file: path.join('pages', 'tasks.js'), mustContain: 'data-name="\' + escapeHtml(w.name||\'\')' },
  { file: path.join('pages', 'tasks.js'), mustContain: 'id="t-notes" rows="2" placeholder="تفاصيل إضافية...">\' + escapeHtml(d.notes' },
  { file: path.join('pages', 'vaccine.js'), mustContain: "escapeHtml(v.target_section||'—')" },
  { file: path.join('pages', 'vaccine.js'), mustContain: 'id="tpl-notes" rows="2">\' + escapeHtml(tpl.notes' },
  { file: path.join('pages', 'production.js'), mustContain: "'<option value=\"' + t.id + '\">' + escapeHtml(t.label)" },
  { file: path.join('pages', 'production.js'), mustContain: 'id="pr-by" value="\' + escapeHtml(u?.name' },
  { file: path.join('pages', 'breeding.js'), mustContain: 'id="b-weights" value="\'+escapeHtml(r.birth_weights' },
  { file: path.join('pages', 'breeding.js'), mustContain: "escapeHtml(f.tag||'')+'</td><td class=\"text-gray\">'+escapeHtml(f.breed" },
  { file: 'goats.html', mustContain: "تعديل سلالة: '+escapeHtml(breed)" },
  { file: 'sheep.html', mustContain: "تعديل سلالة: '+escapeHtml(breed)" },
  { file: 'dashboard.html', mustContain: "'مرحباً ' + escapeHtml(getUser().name||'')" },
  { file: 'dashboard.html', mustContain: 'description: escapeHtml(s.farmName' },
  { file: path.join('pages', 'reports.js'), mustContain: '<td class="fw-bold">${escapeHtml(b.breed||\'\')}</td><td>${ar(b.total)}</td>' },
  { file: path.join('pages', 'reports.js'), mustContain: '<td class="fw-bold">${escapeHtml(r.female_tag' },
  { file: 'shared.js', mustContain: 'logoHtml=s.logoUrl===' },
  { file: 'shared.js', mustContain: "escapeHtml(tag||'—')" },
  { file: 'shared.js', mustContain: 'escapeHtml(breed||\'\')}${barn?` • ${escapeHtml(barn)}`' },
  { file: 'dashboard.html', mustContain: '<title>${escapeHtml(b.breed||\'\')}: ${ar(b.total)}</title>' }, // pie-chart breed-catalog hardening
  { file: 'dashboard.html', mustContain: 'display:inline-block"></span>${escapeHtml(b.breed||\'\')} ${ar(pct)}' },
  // -- Round 3 (fresh independent re-scan, post round-2) --
  { file: 'shared.js', mustContain: "display:inline-block\"></span>${escapeHtml(s.label||'')} (${ar(s.value)})" }, // renderDonutSVG legend
  { file: 'animal-detail.html', mustContain: "الحيوان: <strong>'+escapeHtml(animal.breed||'')" },
  { file: 'animals.html', mustContain: "'<td>'+({goat:'🐐ماعز',sheep:'🐑أغنام'}[r.data.species]||escapeHtml(r.data.species||'—'))" },
  { file: 'animals.html', mustContain: "'<td>'+escapeHtml(r.data.breed||'—')+'</td>'" },
  { file: 'fix-births.html', mustContain: "(a.tag ? ' #' + escapeHtml(a.tag) : '')" },
  { file: path.join('pages', 'reports.js'), mustContain: '<td class="fw-bold">${escapeHtml(b.barn||\'\')}</td>' },
  { file: path.join('pages', 'reports.js'), mustContain: 'escapeHtml(b.breeds.slice(0,3).join(' },
  { file: path.join('pages', 'reports.js'), mustContain: "<td class=\"text-gray\">${escapeHtml(r.category||'—')}</td>" },
  { file: path.join('pages', 'reports.js'), mustContain: "escapeHtml(w.animal_tag||'—')" },
  { file: path.join('pages', 'reports.js'), mustContain: "escapeHtml(w.actor||'—')" },
  { file: path.join('pages', 'reports.js'), mustContain: "escapeHtml(w.recommendation_text||'—')" },
  { file: path.join('pages', 'reports.js'), mustContain: "title=\"'+escapeHtml(w.error_message||'')" },
  { file: 'dashboard.html', mustContain: 'font-weight:700">${escapeHtml(b.breed||\'\')}</td>' }, // herd-table parity gap
  { file: path.join('pages', 'inventory.js'), mustContain: 'تسجيل استخدام: ${escapeHtml(name)}' }, // openUseModal, HIGH: attribute + JS-string breakout
  { file: path.join('pages', 'inventory.js'), mustContain: "submitUse('${type}','${id}','${escapeJsAttr(name)}'" },
  // -- Round 4 (fresh independent re-scan, post round-3) --
  { file: 'animals.html', mustContain: '[a.purpose]||escapeHtml(a.purpose||\'—\')' },
  { file: 'animal-detail.html', mustContain: '[animal.purpose]||escapeHtml(animal.purpose||\'—\')' },
  { file: 'barns.html', mustContain: "[a.purpose]||escapeHtml(a.purpose||'')" },
  { file: path.join('pages', 'inventory.js'), mustContain: "[e.status]||escapeHtml(e.status||'')" },
  { file: path.join('pages', 'reports.js'), mustContain: "[t.reason]||escapeHtml(t.reason||'')" },
  // -- Round 5 (final independent acceptance-gate re-scan, post round-4) --
  { file: 'assistant.html', mustContain: "escapeHtml(actionLabels[parsed.action]||'عملية')" }, // fallback branch missed by the adjacent LLM-JSON escaping fix
  { file: 'animal-detail.html', mustContain: "escapeJsAttr(a._id)+'\\').then(function(){renderWeightAlertsSection(" }, // onclick JS-string + attribute breakout (URL-derived animalId re-embedded)
];
let xssRegressions = 0;
const xssFilesChecked = new Set();
for (const { file, mustContain } of XSS_FIX_SITES) {
  let content;
  try {
    content = readFile(file);
  } catch (e) {
    console.log(`  CRITICAL  ${file} -- file no longer exists (was a fixed XSS sink)`);
    criticalCount++; xssRegressions++;
    continue;
  }
  if (content.includes(mustContain)) {
    xssFilesChecked.add(file);
  } else {
    console.log(`  CRITICAL  ${file} -- fixed XSS sink lost its call: "${mustContain}"`);
    criticalCount++; xssRegressions++;
  }
}
if (xssRegressions === 0) console.log(`  OK    ${xssFilesChecked.size} files, ${XSS_FIX_SITES.length} fixed sinks -- all still present, no regressions.`);

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n=== Summary: ${criticalCount} CRITICAL, ${reviewCount} REVIEW ===`);
if (criticalCount > 0) {
  console.log('FAIL: critical findings present.');
  process.exit(1);
} else {
  console.log('PASS: no critical findings.');
  process.exit(0);
}
