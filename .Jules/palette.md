## 2026-08-10 - Using aria-disabled for disabled buttons with tooltips
 **Learning:** Native `disabled` attributes prevent hover events, meaning users couldn't see a tooltip (`title` attribute) explaining why an option was disabled. Screen readers also wouldn't read the `title` attribute on disabled elements properly in all cases, or standard browser features wouldn't work.
 **Action:** Instead of `disabled`, use `aria-disabled={true}` and manually prevent action in the `onClick` handler by calling `e.preventDefault()` and returning early. Also, use Tailwind's `aria-disabled:` variant to style it.
## 2026-08-11 - Custom Selection Buttons using aria-pressed and Tailwind
 **Learning:** When creating custom radio-button-like or toggle buttons (e.g. preset selection grids), template string conditionals for styling cause bulky code and do not semantically reflect their state to screen readers by default.
 **Action:** Always include `aria-pressed={isActive}` (or `aria-current`) on such selection buttons, and use Tailwind's `aria-pressed:` variants instead of conditional JS strings to style the active state.
## 2026-08-30 - Grouping custom selection buttons for accessibility
 **Learning:** When building custom radio-style preset selection buttons (e.g., Output resolution, Audio mode), they lack inherent grouping semantically. Without grouping, screen reader users might not understand that the buttons are a mutually exclusive choice or belong to a unified setting.
 **Action:** Wrap the set of custom selection buttons in a container with `role="group"` and provide a descriptive `aria-label` (like "Output resolution"). This ensures assistive technologies properly announce the group context and boundaries when users navigate to them.
