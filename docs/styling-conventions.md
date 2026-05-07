# Frontend Styling Conventions

This project uses a hybrid styling model:
- Global stylesheet for app-wide tokens and base rules only
- CSS Modules for component and page-level styling
- Utility-first Tailwind classes where they improve clarity

## Non-Negotiable Rules

1. Keep `src/index.css` minimal.
- Allowed: Tailwind imports, theme tokens, dark mode variables, base element resets.
- Not allowed: page layouts, component-specific selectors, feature-specific overrides.

2. Use CSS Modules for scoped styles.
- Component styles must live next to the component as `ComponentName.module.css`.
- Page styles must live next to the page as `PageName.module.css`.
- Do not import plain `.css` files into component or page TypeScript files.

3. Prefer local classes over global selectors.
- Do not use global IDs for styling.
- Avoid deep descendant selectors that couple unrelated markup.

4. Use Tailwind for simple, local utility styling.
- Spacing, alignment, typography utility classes can stay inline in JSX.
- Move repeated or complex visual rules into CSS Modules.

5. Theme with tokens, not hardcoded colors.
- Use semantic CSS variables defined in `src/index.css`.
- Light and dark values are defined together and consumed by utilities and modules.

6. Keep spacing on a compact scale.
- Base compact rhythm: 4, 8, 12, 16, 20, 24, 32.
- Prefer tokenized spacing patterns over ad hoc pixel values.

## PR Checklist

- [ ] No new global style rules were added outside `src/index.css`.
- [ ] New components and pages use `*.module.css` when custom styles are needed.
- [ ] No TypeScript file imports plain `.css` except `src/main.tsx`.
- [ ] Styling follows semantic tokens and supports dark mode.
- [ ] Mobile layout is verified first, then desktop.
