---
version: alpha
name: Clippfy Neon Performance
description: A high-contrast dark marketing system with aggressive neon accents and creator-first conversion energy.
colors:
  primary: "#d1fe17"
  secondary: "#f1f2ec"
  tertiary: "#f5b400"
  neutral: "#0c0c0d"
  surface: "#141416"
  on-surface: "#f1f2ec"
  muted: "#8d8f87"
  border: "#ffffff12"
  success: "#31e07a"
  info: "#6ea8ff"
  accent-strong: "#b7e600"
typography:
  headline-display: { fontFamily: Montserrat, fontSize: 78px, fontWeight: 600, lineHeight: 82.68px, letterSpacing: -2.73px }
  headline-lg: { fontFamily: Montserrat, fontSize: 54px, fontWeight: 600, lineHeight: 65px, letterSpacing: -1.32px }
  headline-md: { fontFamily: Montserrat, fontSize: 37px, fontWeight: 600, lineHeight: 44px, letterSpacing: -0.36px }
  headline-sm: { fontFamily: Geist, fontSize: 26px, fontWeight: 600, lineHeight: 31px, letterSpacing: 0px }
  body-lg: { fontFamily: Geist, fontSize: 18px, fontWeight: 400, lineHeight: 27.9px, letterSpacing: 0px }
  body-md: { fontFamily: Geist, fontSize: 17px, fontWeight: 500, lineHeight: 1.45, letterSpacing: 0px }
  body-sm: { fontFamily: Geist, fontSize: 15px, fontWeight: 400, lineHeight: 1.45, letterSpacing: 0px }
  label-lg: { fontFamily: Geist, fontSize: 17px, fontWeight: 500, lineHeight: 1.2, letterSpacing: 0px }
  label-md: { fontFamily: Geist, fontSize: 15px, fontWeight: 400, lineHeight: 1.2, letterSpacing: 0px }
  label-sm: { fontFamily: Geist, fontSize: 12px, fontWeight: 500, lineHeight: 1.1, letterSpacing: 0px }
rounded: { none: 0px, sm: 4px, md: 8px, lg: 16px, xl: 22px, full: 9999px }
spacing: { xs: 2px, sm: 10px, md: 18px, lg: 22px, xl: 34px }
components:
  button-primary: { backgroundColor: "{colors.primary}", textColor: "{colors.neutral}", typography: "{typography.label-lg}", rounded: "{rounded.lg}", padding: "19px 28px", height: 54px }
  button-primary-hover: { backgroundColor: "{colors.accent-strong}", textColor: "{colors.neutral}", rounded: "{rounded.lg}" }
  button-secondary: { backgroundColor: "{colors.neutral}", textColor: "{colors.secondary}", typography: "{typography.label-lg}", rounded: "{rounded.lg}", padding: "19px 28px", height: 54px }
  button-tertiary: { backgroundColor: transparent, textColor: "{colors.tertiary}", typography: "{typography.body-sm}", rounded: "{rounded.none}", padding: 0px }
  card: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", rounded: "{rounded.xl}", padding: "22px 24px" }
  input: { backgroundColor: "{colors.surface}", textColor: "{colors.on-surface}", rounded: "{rounded.lg}", padding: "16px 18px" }
  chip: { backgroundColor: "{colors.primary}", textColor: "{colors.neutral}", typography: "{typography.label-sm}", rounded: "{rounded.full}", padding: "6px 10px" }
---

# Clippfy Neon Performance

User-supplied design specification; this is the source of truth for new tools.
The structured component definitions above resolve the prose's inverted button names: primary is neon, secondary is dark.

## Implementation rules
- Montserrat for 78/54/37px hero/headline levels, Geist for 26px section titles and 18/17/15px body/UI text. Metadata uses 12px, not 8–10px microtype.
- Centered, fixed-max-width hero; strong scale, horizontal alignment and the 2/10/18/22/34px rhythm. Display steps down to 54px on tablets and 37px on phones.
- Near-black canvas, charcoal cards, near-white foreground, restrained neon conversion emphasis; supporting gold links, success and info only when semantically appropriate.
- Buttons are 54px tall with 16px corners; cards have 22px corners and 22px 24px padding. Inputs use 16px corners and 16px 18px padding. Chips are neon and fully rounded.
- Sentence case, rather than tracked uppercase, for ordinary headlines, labels and section markers. Promo treatments can remain uppercase.
- Tonal depth and faint borders. No pastel palette, gradients, glossy panels, decorative rotated paper stacks or exaggerated shadows.
- Preserve existing marketing-page content/layout and protected original asset hashes. Extend via `assets/clippfy-ui.css`, `assets/script-studio.css` and `assets/workspace.css`.
- Desktop computed styles are asserted in browser checks, not only inferred from CSS declarations. Generation, edit, copy/download, errors and reduced motion remain functional.
