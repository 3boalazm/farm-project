# DEPLOYMENT-CHECKLIST-v1.7.0.md

## Before Deploying
- [x] Full regression: 189/189 passing (confirmed this session).
- [x] Safety scanner: 0 CRITICAL (confirmed this session).
- [x] Syntax check: every modified file (node --check across all .js and extracted script blocks) -- confirmed.
- [x] UI/UX sweep: 116/116 clean across 29 pages x 2 viewports x 2 themes (confirmed this session).
- [x] No Firebase rules change to deploy -- database.rules.json untouched.
- [x] No new environment variable required.
- [x] No new external dependency introduced (Chart.js CDN reference already in use since Sprint 8).

## Deployment Steps (Vercel, per this project's established deployment target)
1. Merge/deploy this exact commit (see VERSION-MARKER.md).
2. No build step -- this is a static, vanilla-JS application; Vercel serves the files directly.
3. Confirm the deployed firebase.js still points at the correct, existing Firebase Realtime Database URL (unchanged by this release).
4. Smoke-test immediately after deploy (see Post-Deployment Verification below).

## Post-Deployment Verification
- [ ] login.html loads, PIN login succeeds.
- [ ] dashboard.html loads, shows today's summary.
- [ ] Sidebar shows "الإنتاج" and "المهام" links (new in this release) and both navigate correctly.
- [ ] analytics.html loads and renders its 7 charts.
- [ ] reports.html shows all 8 tabs, including the new "المخزون" tab.
- [ ] inventory.html still functions exactly as before (unchanged page).
- [ ] import.html loads without a JavaScript error (the fix in this release).
- [ ] Selling an animal from its own detail page (animal-detail.html) with a price now creates a visible finance record.
- [ ] Recording a treatment or completing a vaccination visibly changes the relevant medicine's stock quantity in inventory.html.
- [ ] Notification bell badge shows a real count on at least one non-notifications page.

## APK (Capacitor) Note
Per this project's own established architecture, website updates reflect in the Android APK wrapper without a separate rebuild (bayan-farm-apk repo wraps the live PWA). No APK-specific action is required for this release.

## Who to Notify
Per this project's own established practice, no automated notification mechanism exists for a deploy itself -- this checklist is the record of what to manually confirm.
