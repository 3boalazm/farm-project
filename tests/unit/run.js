#!/usr/bin/env node
// tests/unit/run.js — runs every *.suite.js module test in order.
//
//   node tests/unit/run.js            # all modules
//   node tests/unit/run.js 07         # only modules whose name contains "07"
//
// These are UNIT tests over the real application scripts, executed in
// jsdom against an in-memory Firebase (see ./harness.js). They are the
// layer beneath the Playwright browser suites in tests/smoke, tests/ssot,
// tests/permissions and tests/data-integrity, and unlike those they need
// no downloaded browser binary.
// Run the whole unit layer in the farm's REAL timezone, not the sandbox's
// UTC default. This matters: the 2026-10 audit's biggest find was a class of
// ~35 sites deriving local calendar keys from toISOString() (UTC), which is
// silently correct at TZ=UTC and silently WRONG for UTC+3 -- e.g.
// `new Date(2026,9,1).toISOString().slice(0,7)` is '2026-09' in Cairo.
// Override with FARM_TZ=UTC node tests/unit/run.js to see the other side.
process.env.TZ = process.env.FARM_TZ || 'Africa/Cairo';

const fs = require('fs');
const path = require('path');
const { runSuites } = require('./harness');

const filter = process.argv[2] || '';
const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => /^\d+.*\.suite\.js$/.test(f)).sort();

(async () => {
  const suites = [];
  for (const f of files) {
    try {
      suites.push(require(path.join(dir, f)));
    } catch (e) {
      console.error(`Failed to load ${f}: ${e.message}`);
      process.exitCode = 1;
    }
  }
  const { fail } = await runSuites(suites, { filter });
  process.exit(fail ? 1 : 0);
})();
