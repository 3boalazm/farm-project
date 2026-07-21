#!/usr/bin/env node
// scripts/sync-apk-www.js
//
// Confirmed this session: farm-apk/www is NOT generated build output.
// Capacitor's own `cap sync` command only syncs native plugins/dependencies
// -- it never copies web assets. Neither package.json (root or farm-apk/)
// has any copy step. That means farm-apk/www/ was manually copied into
// place once, then never re-synced -- which is exactly how it diverged
// (confirmed directly: it lacked the current_weight resync-on-delete logic
// the root app has, was missing recent pages, and even had a stray
// animal-detail.html.bak left over from a past manual edit).
//
// This script is the fix: a real, repeatable, automatic sync, so the two
// copies can never manually drift apart again. Run via `npm run sync` in
// farm-apk/ (wired below into that package.json), which runs this BEFORE
// Capacitor's own native sync.
//
// Scope: every real web asset the app actually uses (root-level
// html/js/css/json, plus pages/, media/, api/ recursively). Deliberately
// excludes dev/build/doc artifacts that have no place in a deployed app
// (package.json, tests/, docs/, *.md, database.rules.json, farm-apk.zip,
// farm-apk/ itself -- to avoid a self-referential copy loop, .git/).

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(ROOT, 'farm-apk', 'www');

const EXCLUDE_DIRS = new Set([
  'farm-apk', '.git', '.github', 'node_modules', 'docs', 'tests',
  'ui-audit', 'scripts', 'farm-dashboard', '.claude'
]);
const EXCLUDE_FILES = new Set([
  'package.json', 'package-lock.json', 'playwright.config.js',
  'vercel.json', 'database.rules.json', 'farm-apk.zip'
]);
const INCLUDE_DIR_NAMES = new Set(['pages', 'media', 'api']);

let copied = 0, removed = 0;

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}

function syncDir(srcDir, destDir, isTopLevel) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && entry.name !== '.') continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      if (isTopLevel) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        if (!INCLUDE_DIR_NAMES.has(entry.name)) continue; // top-level dirs: only known app dirs
      }
      syncDir(srcPath, destPath, false);
    } else {
      if (isTopLevel && EXCLUDE_FILES.has(entry.name)) continue;
      if (isTopLevel && !/\.(html|js|css|json)$/i.test(entry.name)) continue;
      // Only copy if missing or actually different -- avoids needless
      // writes / mtime churn on files that are already in sync.
      if (!fs.existsSync(destPath) || !filesEqual(srcPath, destPath)) {
        copyFile(srcPath, destPath);
      }
    }
  }
}

function filesEqual(a, b) {
  try {
    const ba = fs.readFileSync(a), bb = fs.readFileSync(b);
    return ba.equals(bb);
  } catch (e) { return false; }
}

// Remove stale files in www/ that no longer correspond to anything at
// root (e.g. the animal-detail.html.bak leftover found this session) --
// scoped to the same include rules, so intentional APK-only files (none
// currently exist, per this session's own check, but future ones remain
// possible) are not accidentally deleted by this loop.
function pruneStale(srcDir, destDir, isTopLevel) {
  if (!fs.existsSync(destDir)) return;
  const destEntries = fs.readdirSync(destDir, { withFileTypes: true });
  for (const entry of destEntries) {
    const destPath = path.join(destDir, entry.name);
    const srcPath = path.join(srcDir, entry.name);
    if (entry.isDirectory()) {
      if (isTopLevel && !INCLUDE_DIR_NAMES.has(entry.name)) continue;
      pruneStale(srcPath, destPath, false);
      continue;
    }
    // Deliberately NOT filtering by extension here (unlike syncDir's copy
    // step): pruning's whole job is catching anything that doesn't belong
    // in www/ at all, including files with an extension the copy step
    // would never have created in the first place -- e.g. the stray
    // animal-detail.html.bak this session found, which a .html-only
    // filter would silently skip right over.
    if (!fs.existsSync(srcPath)) {
      fs.unlinkSync(destPath);
      removed++;
      console.log('  removed stale:', path.relative(ROOT, destPath));
    }
  }
}

console.log('Syncing web assets: repo root -> farm-apk/www/ ...');
syncDir(ROOT, DEST, true);
pruneStale(ROOT, DEST, true);
console.log(`Done. ${copied} file(s) copied/updated, ${removed} stale file(s) removed.`);
