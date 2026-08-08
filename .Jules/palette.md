## 2024-02-14 - Improve Disabled Button Accessibility

**Learning:** Using the native `disabled` attribute on buttons removes them from the keyboard tab order and prevents mouse events, meaning tooltips on disabled buttons won't trigger.
**Action:** For disabled buttons where a tooltip explanation is helpful, use `aria-disabled={true}` and conditionally handle `e.preventDefault()` and early returns in the `onClick` handler, and use `aria-disabled:` modifiers in Tailwind for styling.
