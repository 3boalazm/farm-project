# FIREBASE-SETUP.md

## Current State
This project talks to Firebase Realtime Database **directly over REST** -- no Firebase SDK, no `npm install firebase`. The client config (`apiKey`, `authDomain`, `databaseURL`, `projectId`) is already committed in both `config.js` and `firebase.js`, pointing at the project's existing production Firebase instance. This is standard, expected practice for a Firebase web app -- these values are not secrets (Firebase's own security model relies on database rules, not key secrecy).

## This Project's Specific Security Model
Authentication is a **custom PIN system**, not Firebase Auth. `database.rules.json` therefore enforces **data validation only** (types, required fields), not per-user access control -- access control lives entirely client-side via `can()` (see `ARCHITECTURE-REFERENCE.md`). The practical consequence: **the database URL should be treated as sensitive**, even though it isn't a traditional secret -- this project's security relies on it not being widely known, not on Firebase-side authorization.

## Setting Up Your Own Firebase Project (If Needed)
If you need an independent instance (e.g., a staging environment, or forking this project for a different farm):
1. Create a new Firebase project at the Firebase Console.
2. Enable **Realtime Database** (not Firestore -- this project uses RTDB specifically).
3. Apply this repository's `database.rules.json` to the new project.
4. Replace the `apiKey`/`authDomain`/`databaseURL`/`projectId` values in both `config.js` and `firebase.js` with your new project's values -- **keep them in sync with each other**, both files must match.
5. If you want the PIN-hashing + Firebase Auth fail-safe bridge (`hashPin()`, `signInWithFirebaseAuth()` in `firebase.js`) to work fully, enable **Email/Password** sign-in in your new project's Authentication settings. The app works correctly even without this -- it's a fail-safe layer, not a hard dependency (see `ARCHITECTURE-REFERENCE.md`).

## No Environment Variables Needed for Firebase
Unlike a typical Firebase Admin SDK setup, this project's REST-based, client-side-only approach means there is no server-side Firebase credential to manage as an environment variable. The only environment variable this project uses anywhere is `ANTHROPIC_API_KEY`, unrelated to Firebase (see `docs/deployment/DEPLOY.md`).
