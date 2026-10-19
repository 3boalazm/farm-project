// playwright.config.js
module.exports = {
  testDir: './tests',
  // FIX (2026-10 audit) — THE CI QUALITY GATE HAS BEEN RED ON EVERY RUN.
  // Playwright's default testMatch includes **/*.test.js, which picked up
  // tests/rules/accounting-rules.test.js. That file is NOT a Playwright spec:
  // it is a Node script for the Firebase RTDB emulator and it requires
  // '@firebase/rules-unit-testing' — a package that is not in package.json and
  // is not installed by the workflow (which installs only @playwright/test).
  // Result, reproduced locally: collection dies with
  //   Error: Cannot find module '@firebase/rules-unit-testing'
  //   Listing tests: Total: 0 tests in 0 files
  // so `npx playwright test` exited non-zero having run NOTHING — and the
  // gate reported failure for every commit (confirmed via `gh run list`:
  // 8/8 recent Quality Gate runs on main are `failure`). The file's own
  // header already says it must be run through
  // `firebase emulators:exec`, never through Playwright; this makes the
  // config agree with that documentation.
  testIgnore: ['**/rules/**', '**/unit/**'],
  timeout: 20000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:8080',
    headless: true,
  },
  webServer: {
    command: 'python3 -m http.server 8080',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 10000,
  },
};
