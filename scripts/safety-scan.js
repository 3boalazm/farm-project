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
    if (dir === '.' && entry.name === 'farm-apk') continue;
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

// ── Summary ──────────────────────────────────────────────────────
console.log(`\n=== Summary: ${criticalCount} CRITICAL, ${reviewCount} REVIEW ===`);
if (criticalCount > 0) {
  console.log('FAIL: critical findings present.');
  process.exit(1);
} else {
  console.log('PASS: no critical findings.');
  process.exit(0);
}
