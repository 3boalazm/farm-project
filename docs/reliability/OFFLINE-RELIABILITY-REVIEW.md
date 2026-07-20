# OFFLINE-RELIABILITY-REVIEW.md

| Scenario | Classification | Evidence / Reasoning |
|---|---|---|
| Offline creation (e.g., adding an animal while offline) | **NEEDS HARDENING** | `offline-sync.js`'s `FarmOfflineSync` IndexedDB write queue is real and independently confirmed functional (prior sessions this engagement) — but the Service Worker that would let the *page itself* load while offline is confirmed not registered anywhere (`docs/audit/PWA-RELIABILITY.md`, Phase 6). A user already on a loaded page while going offline can likely queue a write; a user opening the app fresh while offline cannot, since there's no cached shell to load |
| Offline editing | Same as above | Same mechanism, same caveat |
| Network loss mid-save | **NEEDS HARDENING** | No confirmed retry logic exists in `fbPost`/`fbPatch` (`firebase.js`) — a write that fails mid-flight due to network loss simply fails; whether `offline-sync.js` catches this specific failure mode (vs. only pre-emptively queuing known-offline writes) was not re-verified this session and should not be assumed either way |
| Browser restart with pending offline writes | **RISKY**, unverified | IndexedDB persistence across restarts is a real browser guarantee in principle, but whether `FarmOfflineSync`'s queue-replay logic correctly resumes after a full browser restart (not just a tab reload) has never been tested in any environment used across this project's history — genuinely unknown, not assumed safe |
| Old cached version served after a deploy | **SAFE**, by virtue of being moot | Since `sw.js` is confirmed not registered anywhere, there is currently no cache to go stale — every page load fetches fresh. This is an accidental safety, not a designed one; it would need real cache-versioning logic if the SW is ever activated |

## Overall Classification: **NEEDS HARDENING**

Not RISKY overall — the write-queue mechanism (`offline-sync.js`) is real, distinct from the dormant SW, and has been independently verified to exist and be architecturally sound in prior sessions. But "NEEDS HARDENING" is the honest label: several of the scenarios above are genuinely untested, not confirmed-safe, and this review should not round that uncertainty away in either direction.

## The One Structural Recommendation
Before any future offline-reliability work, the standing question from `docs/repository/RISK_REGISTER.md`'s lineage — whether to formally activate `sw.js`/`sw-register.js` — needs its own deliberate decision. Right now the app is "offline-safe" only in the narrow sense that a loaded page can queue writes; it is not "offline-capable" in the sense a user would expect from a PWA (opening the app fresh with no connection). Closing that gap is a feature decision, correctly out of this audit's scope, but the current NEEDS HARDENING status will not resolve itself without it.
