# SMART-OPERATIONS.md

## What Changed for the Person Actually Using This App
Before this sprint: recording a birth, completing a vaccination, or finishing a course of medication left a stale reminder sitting on the task list -- someone eventually had to notice it and close it by hand. Selling or recording the death of an animal left every one of its pending reminders behind entirely, forever, with no automation touching them at all. Both were confirmed, not assumed, by reading the actual write paths (docs/features/WORKFLOW-DISCOVERY.md).

After this sprint: the same 8 actions each finish with one extra, automatic step -- the reminder that started the whole chain closes itself, and where there's something genuinely useful to say next, a short suggestion appears as a toast. Nothing about the underlying record, the intelligence scoring, or the notification system changed.

## The 8 Smart Operations

| You do... | What automatically happens now |
|---|---|
| Record a birth | The "birth expected soon" reminder for that pregnancy closes. Suggestion: record the newborn's initial weight and schedule its first vaccination. |
| Mark a vaccination done | Its own reminder closes. If another vaccination is still pending for the same section, you're told which one. |
| Complete a course of medication | Its follow-up reminder closes. If the animal's health risk is still elevated, you're told so, with the real score. |
| Record a weight | (Weight Intelligence already handled its own alert lifecycle.) If there's still an active weight concern, you're reminded; if not, nothing extra is shown. |
| Record milk/wool production | (Production Intelligence already handled its own alert lifecycle.) Same pattern -- only speaks up if there's something ongoing. |
| Add a new health record | If the animal's current risk is high or critical, you're told, with the score. |
| Sell an animal | Every reminder still open for that animal closes -- it's no longer part of the active herd. |
| Record a death | Same as sale. |

## Why It Never Nags
Every "everything is normal" outcome is marked internally as not worth interrupting you for (actionable:false) -- confirmed by a dedicated test that these cases never produce a toast. You only hear from this system when there's something to actually decide or notice.

## Where to See the Full Record
reports.html's "سجل العمليات" (Operational History) tab -- every workflow that ran, when, by whom, how long it took, how many reminders it closed, what it suggested, and whether it succeeded. Read-only, nothing there can be edited or deleted from that view.

## What This Sprint Deliberately Did Not Change
No scoring formula, no notification trigger, no task-creation rule from any prior sprint was modified. This sprint's entire contribution is: closing reminders that used to go stale, and surfacing one honest, evidence-cited suggestion per action where one exists. docs/features/WORKFLOW-ARCHITECTURE.md and WORKFLOW-ENGINE.md document exactly how that stays true in the code, not just in this description.
