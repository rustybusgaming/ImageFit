## 2024-05-17 - Added native disabled fallback for aria-disabled buttons
 **Learning:** When replacing native `disabled` with `aria-disabled` on interactive elements like buttons to retain tab indexing, we need to explicitly intercept `onClick` events inside the React handler (e.g. `if (disabled) return;`) since `aria-disabled` alone does not block interaction like native `disabled` does.
 **Action:** We implemented `onClick={(e) => { if (disabledState) { e.preventDefault(); return; } handler(); }}` in `ImageSquisher.tsx` and `VideoSquisher.tsx`.
