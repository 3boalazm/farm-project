# Data Flow — Certified Paths

**Only the certified subsystems' flows are documented here as authoritative. For anything else, trace the live code directly.**

## Weight (any of 4 entry points)
```
UI action (Add Weight form / Production weight-type entry / AI add_weight / Birth event)
  -> validate
  -> fbPost('animals/{animalId}/weights', {weight, date, notes})
  -> logActivity
  -> current_weight/weight_updated patched to newest remaining record (Wave A Commit 4)
  -> re-render
```

## Birth (3 of 4 entry points — `_ubSubmit`, `submitBreeding`/markBorn, AI `add_birth`)
```
UI action
  -> fbPost('breeding', {...})
  -> loop per offspring: createOffspringAnimal({species, breed, gender, ..., motherTag, weight, ...})
       -> fbPost('animals', rec)
       -> if weight given: fbPost('animals/{id}/weights', {...})
  -> logActivity
  -> refresh
```
**`submitBirthDirect()` (4th entry point) follows a similar but independently-implemented shape — does not call `createOffspringAnimal()`, missing `birth_weight`/`notes`.**

## Sale
```
submitSold() / performBulkSell() / submitRemoveAnimal()'s sale branch
  -> fbPatch('animals', id, {status:'sold', sold_date, sold_price, sold_to})
  -> fbPost('finance', {...}) [conditional, price>0]
  -> logActivity -> refresh
```

## Transfer
```
submitTransfer() (barns.html, canonical) / performBulkTransfer() (animals.html, converged)
  -> fbPatch('animals', id, {barn})
  -> logActivity -> refresh
```

## Modal Lifecycle Invariant (applies to every certified write path above)
**Every modal-driven write reads its own form fields before calling `closeModal()`.** This was the root cause of three independent, now-fixed defects (BL-01, BL-02, BL-03) and one newly-found instance during Wave E (`submitReset`, `_ddSubmit`). See `docs/certification/MODAL_LIFECYCLE.md`.
