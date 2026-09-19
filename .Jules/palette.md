## 2026-08-10 - Using aria-disabled for disabled buttons with tooltips
 **Learning:** Native `disabled` attributes prevent hover events, meaning users couldn't see a tooltip (`title` attribute) explaining why an option was disabled. Screen readers also wouldn't read the `title` attribute on disabled elements properly in all cases, or standard browser features wouldn't work.
 **Action:** Instead of `disabled`, use `aria-disabled={true}` and manually prevent action in the `onClick` handler by calling `e.preventDefault()` and returning early. Also, use Tailwind's `aria-disabled:` variant to style it.
## 2026-08-11 - Custom Selection Buttons using aria-pressed and Tailwind
 **Learning:** When creating custom radio-button-like or toggle buttons (e.g. preset selection grids), template string conditionals for styling cause bulky code and do not semantically reflect their state to screen readers by default.
 **Action:** Always include `aria-pressed={isActive}` (or `aria-current`) on such selection buttons, and use Tailwind's `aria-pressed:` variants instead of conditional JS strings to style the active state.
## 2024-10-24 - Accessibility for form submit buttons
**Learning:** When changing a disabled form submit button from a native `disabled` attribute to `aria-disabled` (to keep it focusable and show a tooltip), the button will still fire a submit event. You cannot just use `aria-disabled`; you must explicitly attach an `onClick` handler that calls `e.preventDefault()` if the invalid state condition is met.
**Action:** Always verify form interaction flow when converting `disabled` buttons inside forms. Add `e.preventDefault()` checks for any elements mimicking native disabled behavior via ARIA attributes.
