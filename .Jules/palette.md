## 2024-08-04 - Accessibility in Custom Slider Components
**Learning:** Found that custom range sliders paired with text spans lacked proper label association, hindering screen reader usability.
**Action:** Always wrap informational text associated with inputs in `<label>` tags using `htmlFor` to link to the input `id`.
