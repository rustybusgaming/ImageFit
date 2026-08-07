## 2024-05-18 - Missing ARIA state on custom toggle buttons
**Learning:** Custom selection buttons that behave like toggles or radio groups change their visual appearance but fail to convey their selected state to screen readers without `aria-pressed` or `aria-current`.
**Action:** Always verify that components mimicking toggle/selection behavior include `aria-pressed={isActive}` to ensure keyboard and screen reader accessibility aligns with visual feedback.
