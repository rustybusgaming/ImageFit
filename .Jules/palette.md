## 2026-08-10 - Using aria-disabled for disabled buttons with tooltips
 **Learning:** Native `disabled` attributes prevent hover events, meaning users couldn't see a tooltip (`title` attribute) explaining why an option was disabled. Screen readers also wouldn't read the `title` attribute on disabled elements properly in all cases, or standard browser features wouldn't work.
 **Action:** Instead of `disabled`, use `aria-disabled={true}` and manually prevent action in the `onClick` handler by calling `e.preventDefault()` and returning early. Also, use Tailwind's `aria-disabled:` variant to style it.
## 2026-08-11 - Accessible Toggle Buttons
 **Learning:** Custom buttons acting as toggle or radio group options lack state context for screen readers when they rely only on visual styling for selection.
 **Action:** Always add `aria-pressed={isActive}` to custom button-based toggles.
