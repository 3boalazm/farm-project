#!/usr/bin/env node
// scripts/report-playwright-failures.js
//
// CI cannot hand us its logs: GitHub Actions log/artifact downloads are not
// reachable from every environment that has to debug a red run (confirmed
// repeatedly while writing the 2026-10 audit — `gh run view --log-failed` and
// `gh run download` both fail with EOF). What IS readable without the log
// endpoint is a job's **annotations**, and a step can create those itself with
// the `::error::` workflow command.
//
// So this script turns Playwright's JSON reporter output into annotations:
// one per failing test, with file:line and the first lines of the error, plus a
// human-readable job summary. That makes "the browser suite is red" actionable
// from the API alone, instead of a 400-test mystery.
//
//   node scripts/report-playwright-failures.js [results.json]
//
// Exit code is always 0 — it reports a failure, it is not the gate.
'use strict';

const fs = require('fs');
const path = require('path');

const RESULTS = process.argv[2] || 'test-results/results.json';
const MAX_ANNOTATIONS = 30;          // GitHub truncates beyond ~a few dozen anyway

function read(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; }
}

/** Walk Playwright's JSON report tree into a flat list of test results. */
function flatten(report) {
  const out = [];
  const walk = (suites, fileTitle, rootFile) => {
    for (const s of suites || []) {
      const title = fileTitle || s.title;
      const file = rootFile || s.file || title;
      for (const spec of s.specs || []) {
        for (const t of spec.tests || []) {
          for (const r of t.results || []) {
            out.push({
              file: spec.file || file,
              line: spec.line || 0,
              title: spec.title,
              suite: title,
              status: r.status,
              duration: r.duration,
              errors: (r.errors || []).map((e) => e.message || String(e)).concat(
                r.error ? [r.error.message || ''] : []),
            });
          }
        }
      }
      walk(s.suites, title, file);
    }
  };
  walk(report.suites, null, null);
  return out;
}

const clean = (s) => String(s || '')
  .replace(/\u001b\[[0-9;]*m/g, '')      // strip ANSI colours
  .replace(/\r/g, '')
  .replace(/%/g, '%25').replace(/\n/g, '%0A').replace(/\r/g, '%0D');

function main() {
  const report = read(RESULTS);
  if (!report) {
    console.log(`::error title=Playwright report missing::${RESULTS} not found — the suite probably died during collection (see playwright.config.js testIgnore). No per-test detail is available.`);
    return;
  }
  const all = flatten(report);
  const failed = all.filter((t) => t.status === 'failed' || t.status === 'timedOut');
  const flaky = all.filter((t) => t.status === 'flaky');
  const passed = all.filter((t) => t.status === 'passed');

  const head = `browser suite: ${passed.length} passed, ${failed.length} failed, ${flaky.length} flaky (of ${all.length} results)`;
  console.log(head);

  if (!failed.length) {
    console.log('::notice title=Browser suite::' + clean(head));
    writeSummary(head, [], flaky);
    return;
  }

  // One annotation per failure — this is the part that is readable from
  // `gh run view` / the check-runs API without the log endpoint.
  for (const t of failed.slice(0, MAX_ANNOTATIONS)) {
    const msg = (t.errors.find((e) => e && e.trim()) || 'no error message captured').split('\n').filter(Boolean).slice(0, 6).join(' · ').slice(0, 900);
    console.log(`::error title=${clean(t.title)}::${clean(t.file)}:${t.line} — ${clean(msg)}`);
  }
  if (failed.length > MAX_ANNOTATIONS) {
    console.log(`::error title=and ${failed.length - MAX_ANNOTATIONS} more failures::annotations are capped at ${MAX_ANNOTATIONS}; the full list is in the job summary and in test-results/results.json`);
  }

  writeSummary(head, failed, flaky);
}

function writeSummary(head, failed, flaky) {
  const out = process.env.GITHUB_STEP_SUMMARY;
  if (!out) return;
  const byFile = new Map();
  for (const f of failed) byFile.set(f.file, (byFile.get(f.file) || 0) + 1);
  const lines = [
    '### Browser suite',
    '',
    '`' + head + '`',
    '',
  ];
  if (byFile.size) {
    lines.push('| File | Failures |', '|---|---|');
    for (const [file, n] of [...byFile].sort((a, b) => b[1] - a[1])) lines.push(`| \`${file}\` | ${n} |`);
    lines.push('', '<details><summary>Every failing test</summary>', '');
    for (const f of failed) lines.push(`- \`${f.file}:${f.line}\` — ${f.title}`);
    lines.push('', '</details>');
  }
  if (flaky.length) {
    lines.push('', '<details><summary>Flaky (passed on retry)</summary>', '');
    for (const f of flaky) lines.push(`- \`${f.file}:${f.line}\` — ${f.title}`);
    lines.push('', '</details>');
  }
  try { fs.appendFileSync(out, lines.join('\n') + '\n'); } catch (e) { /* summary is a bonus */ }
}

main();
process.exit(0);
