# Existing Clippfy UI audit

## Scope
Reviewed all 11 HTML entry points, their stylesheet load order and inline bundled rules, plus the Studio's Home, Create, Projects, Clips, Plans, Settings and Scripts views. Browser routing checks cover 17 destinations at desktop and 390px mobile widths. Authentication/provider responses in those checks are mocked; this is not a live provider test.

## Existing patterns, not a new visual direction

| Area | Existing source | Pattern to preserve |
|---|---|---|
| Landing | index.html; 2_landing.css; 3_landing-v4.css; inline overrides | Large centered Montserrat promotional headline, selective lime highlight, supporting Geist copy, raised lime CTA, tonal workflow/review cards. |
| Pricing | pricing.html; 4_pricing.css | Bordered graphite plan cards, clear price hierarchy, short feature lists, raised action buttons. Not every title uses the landing hero scale. |
| Privacy, terms, refunds | privacy.html, terms.html, refund.html; 18_legal.css | Shared public shell, document title, tabs, sticky contents on desktop, readable narrow article column. |
| Studio | app.html; 9_app.css | Persistent sidebar and title bar. The original CSS explicitly hides redundant page headings. Flat graphite panels, fine borders, muted secondary text. No marketing hero inside each tool. |
| Create | app.html; 9_app.css; 10_create-style.css | Focused form surface, raised input controls, restrained separators, one primary next/generate action. Existing sliders, step states and caption controls remain unchanged. |
| Projects / Clips | app.html; 9_app.css | Search/filter toolbar followed by content grids and functional empty states. |
| Settings | app.html; 9_app.css | Grouped form panels with clear section spacing, field labels, save feedback and secondary/destructive actions. |
| Admin | admin.html; admin.css | Same Studio navigation, dense operational cards/tables, status colors, compact-mode controls. |
| Editor / recovery / status / preview information | editor.html, reset.html, status.html, preview-info.html; workspace.css | Shared logo, dark tonal panels, labels, status feedback and existing functional controls. These are newer utility extensions, not the reference for changing original Studio navigation. |

## Cascade matters
The early shared stylesheet still contains legacy light/glass rules. Later inline dark-theme bundles, Studio overrides and clippfy-ui.css determine the rendered design. A comment or an early token declaration alone is not evidence of the actual UI. Original protected assets remain untouched.

## Script writer correction
- Reuse the existing Studio title bar; remove the second 78px promotional heading entirely. The display scale remains available for marketing contexts in the supplied Neon Performance specification.
- Keep graphite cards, faint borders and the existing raised lime button treatment.
- Preserve specified 17px labels, 15px field text, 54px actions, 16px fields and 22px cards rather than invent another type scale.
- Use the existing raised --s2 input hierarchy inside --s1 panels.
- Remove badges, slogans, simulated paper preview, numbered onboarding decoration and decorative footer copy.
- Show a short neutral empty state; after generation, show the actual editable output and copy/download controls.
- Keep privacy/provider limits accessible in a disclosure rather than putting long prose above the task.
- Keep generation, account isolation, character counting, examples, errors, loading, editing and downloads intact.

## Verification
58 automated tests pass; production build passes. Browser checks pass all 17 destinations at 1440px and 390px with no page runtime errors or horizontal overflow. Script generation serialization, editable draft and download checked against a mocked provider response. Desktop script-writer screenshot inspected against the existing landing/Create/admin screenshots. No claim of live Groq generation or production deployment is made by these checks.
