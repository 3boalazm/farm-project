# PRODUCT-BACKLOG.md

**Structured Epic → Feature → Story → Task. Covering the 3 highest-value items from `PRODUCT-GAP-ANALYSIS.md` in full depth, rather than every item shallowly.**

---

## EPIC 1: Automated Task Generation From Domain Events
**Business value:** Turns 3 already-built modules (Health, Breeding, Tasks) into one connected workflow instead of three islands. Directly reduces the risk of a missed vaccination or breeding window — the single most concrete, farm-owner-visible improvement available without new infrastructure.
**Engineering complexity:** Medium — no new SSOT, no schema redesign; adds event-triggered task creation on top of existing writers.
**Dependencies:** None blocking — `createOffspringAnimal()`, the health writer, and `tasks.html`'s existing data model are all stable.
**Priority:** Critical
**Estimate:** 1 sprint (2 weeks)

### Feature 1.1: Auto-generate a task on vaccination due date
- **Story:** As a vet/admin, when a vaccination record is added with a next-due date, a corresponding task should appear automatically, so I don't have to remember to re-enter it manually.
  - Task: Add a task-creation call inside the existing vaccination writer (`pages/vaccine.js`), following the established "additive, don't modify working code" convention.
  - Task: Add a `source_type`/`source_id` field to created tasks so they can be traced back to the vaccination record (avoids a new duplicate-truth source — the task references the record, it doesn't copy its data).
  - Task: Regression test confirming one task is created per due-date vaccination, and zero for vaccinations without one.
  - **Business value:** High | **Complexity:** Low | **Estimate:** 3 days

### Feature 1.2: Auto-generate a task on breeding-window prediction
- **Story:** As a breeding manager, when a female's breeding record enters `pregnant` status, a task should appear near the expected birth window.
  - Task: Determine expected birth window (species-appropriate gestation length — goat vs. sheep differ).
  - Task: Hook into the existing `submitBreeding()` status-transition point, following the same pattern as 1.1.
  - **Business value:** High | **Complexity:** Medium (gestation-length lookup needed) | **Estimate:** 4 days

---

## EPIC 2: Weight-Trend Alerting
**Business value:** Surfaces a health/growth problem before it becomes a crisis, using data the app already certified as reliable (Weight SSOT) — the highest ratio of business value to new engineering risk in the entire backlog, since it touches zero write paths, only reads.
**Engineering complexity:** Low — read-only analysis over existing `animals/{id}/weights`.
**Dependencies:** None.
**Priority:** Critical
**Estimate:** 1 sprint (2 weeks)

### Feature 2.1: Flag animals with no weight gain in N days
- **Story:** As a farm manager, I want the dashboard to flag any animal whose weight hasn't increased in the last 30 days, so I can investigate before it becomes serious.
  - Task: Add a read-only computed check (no new collection, no new write path) comparing the two most recent weight records per animal.
  - Task: Surface as a dashboard KPI card, following the existing `renderPageHeaderV2`/component conventions.
  - Task: Configurable threshold (default 30 days) via Farm Settings, not hardcoded.
  - **Business value:** High | **Complexity:** Low | **Estimate:** 5 days

---

## EPIC 3: Genetic/Pedigree Analytics
**Business value:** Directly supports the farm's own active fertility-research workstream (per project history) — this is not speculative, it's a documented, real, in-progress need.
**Engineering complexity:** High — requires real pedigree-graph traversal logic, not a simple query.
**Dependencies:** Requires the Research module's own open architectural questions (Farm-as-entity, Research-Outcomes-vs-Breeding relationship) to be resolved first — explicitly blocking, not a scheduling choice.
**Priority:** High (blocked pending a decision, not blocked pending engineering capacity)
**Estimate:** 2-3 sprints once unblocked

### Feature 3.1: Inbreeding coefficient calculation
- **Story:** As a breeding manager, I want to see a warning if a proposed pairing has a high inbreeding coefficient, so I can avoid it.
  - Task: Pedigree-graph traversal using existing `mother_tag`/`father_tag` string references (no schema change).
  - Task: Surface as a non-blocking warning in the breeding UI, not a hard restriction (farm staff retain final judgment).
  - **Business value:** High | **Complexity:** High | **Estimate:** 1.5 sprints

---

## Backlog Discipline
Every story above routes through existing certified writers (`createOffspringAnimal()`, the vaccination/breeding writers) — none introduces a second source of truth. This is intentional: the backlog was shaped by `docs/development/ENGINEERING-RULES.md` (this phase's own Phase 5 output), not the other way around.
