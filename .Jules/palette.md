## 2026-08-05 - Added missing aria-pressed states and tooltip to ExportPanel
**Learning:** The ExportPanel buttons for compression, background and effects were missing `aria-pressed` states, hindering screen reader navigation. A missing tooltip left users wondering why "Transparent" background was disabled on JPEGs.
**Action:** Add `aria-pressed` on all selectable button groups, and tooltips where elements are conditionally disabled.
