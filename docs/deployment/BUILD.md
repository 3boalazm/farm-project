# BUILD.md

## There Is No Build Step
This is a deliberate architectural choice, not an oversight -- see `ARCHITECTURE-REFERENCE.md`. The main web application ships exactly as authored: plain HTML files loading plain `.js` files via `<script src>` tags, no bundler, no transpiler, no minification step. "Building" for the web app means nothing beyond having the files present.

## What `npm install` Actually Installs
Only `@playwright/test`, used exclusively by the test suite (`tests/`) and never loaded by any page a user visits. Confirmed via `docs/deployment/DEPENDENCY-MAP.md`.

## The One Exception: `farm-react.js`
A pre-bundled, already-minified React build, loaded lazily by only `reports.html`/`settings.html` for advanced charts. It is committed as a finished artifact -- there is no source-to-rebuild-it-from in this repository; treat it as a vendored, do-not-edit file (see `ARCHITECTURE-REFERENCE.md`).

## Android APK ("Building" the One Thing That Does Build)
The Capacitor Android wrapper (`farm-apk/`) is a **separate project** with its own build process:
```
cd farm-apk
npm run sync    # syncs the latest web app into the Capacitor project
npm run build   # or npm run open for Android Studio
```
This is entirely independent of the main web application's release cycle -- updating the web app does not require rebuilding the APK unless you specifically want the APK's bundled copy refreshed.
