// tests/data-integrity/no-bypass.spec.js
// Static-style check, run as a test so it fails the suite: confirms
// createOffspringAnimal() has exactly the 3 known, approved callers
// (docs/certification/BIRTH.md). If someone adds a 4th independent
// fbPost('animals', ...) call inside a birth-context flow without
// going through the shared helper, this catches the count drifting.

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

test.describe('createOffspringAnimal() has no bypass', () => {
  test('exactly 3 files call createOffspringAnimal(', () => {
    const candidates = [
      'shared.js',
      path.join('pages', 'breeding.js'),
      'assistant.html',
    ];
    let callSites = 0;
    for (const f of candidates) {
      const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const matches = content.match(/window\.createOffspringAnimal\(/g) || [];
      callSites += matches.length;
    }
    // 1 in shared.js (_ubSubmit), 2 in breeding.js (male/female loops), 1 in assistant.html
    expect(callSites, 'expected call-site count drifted -- verify against docs/certification/BIRTH.md before changing this number').toBe(4);
  });

  test('createOffspringAnimal is defined exactly once', () => {
    const content = fs.readFileSync(path.join(ROOT, 'shared.js'), 'utf8');
    const defs = content.match(/^window\.createOffspringAnimal=async function/gm) || [];
    expect(defs.length, 'must have exactly one canonical definition').toBe(1);
  });
});
