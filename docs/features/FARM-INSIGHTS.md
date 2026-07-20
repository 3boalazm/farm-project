# FARM-INSIGHTS.md

## What a Person Actually Sees

Dashboard: the existing "توقعات المزرعة" panel now leads with one status indicator -- green (مستقر), yellow (عبء متوقع أعلى من المعتاد), or red (يتطلب انتباهًا) -- followed by the same 4 numbers it already showed, followed by any structured insights, each with its own suggested action.

Reports ("التوقعات" tab): a new "الذروات القادمة" section, showing vaccination and task-load pressure against real 8-week historical averages.

Animal Detail: the existing forecast section gains a breeding-window card for females with a predictable next window within 30 days, based on her own birth history.

Analytics: the production chart now ends with one dashed, projected point, connected to the last real bar.

Notifications: a new, sparse trigger -- fires only when an insight reaches confidence:'high', never for a routine or uncertain projection.

## Every Insight's Structure, By Example
```
{
  text: "الأسبوع القادم يحتوي ضغط تحصينات مرتفعًا (٦ مقابل متوسط ٠.٩)",
  evidence: "مقارنة بمتوسط ٨ أسابيع سابقة (computeFarmAnalytics)",
  confidence: "high",
  impactedAnimals: [],
  suggestedAction: "التأكد من توفر جرعات كافية وتنسيق الطاقم مسبقًا"
}
```
Every number in text is the exact number computed by the underlying predict*/forecast* call -- never rounded differently, never re-derived for display.

## Why This Sprint Built Far Less New Code Than It Might Look Like
The single most important thing this sprint did was discover, before writing anything, that a complete predictive layer (forecastWeight, forecastProduction, forecastHealthRisk, forecastTaskWorkload, forecastFarmSummary) already existed from an earlier cycle. Three of the six requested predict*() functions are one-line aliases to that layer -- not because the naming didn't matter, but because building a second implementation under a new name would have been exactly the duplicated engine this sprint's own rules explicitly forbid. docs/features/PREDICTIVE-DISCOVERY.md is the record of that check.

## Confidence, Grounded Not Assumed
'high' only when a real, named threshold is clearly crossed (pressure ratio >= 100% above the historical average, or 2+ independent risk signals agreeing, matching Sprint 5's own precedent for what "high confidence" means in this codebase). 'medium' for a real but less extreme signal. 'low' -- or no insight at all -- when the data genuinely doesn't support more.
