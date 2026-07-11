# RetailCraft Design System

**Premium minimalist hospitality identity** — calm, white-dominant, forest-green-accented.
This document is the single source of truth for UI decisions in `apps/web`.

---

## 1. Design Philosophy

Every screen and component must answer:

- Can this be simplified?
- Can more whitespace be introduced?
- Is this element necessary?
- Is the hierarchy clear?
- Does this feel premium and reduce cognitive load?

**Core rule: white is the dominant color. Green is earned, not sprayed.**
Green appears only on: primary actions, active navigation states, key highlights, and the most important metrics.

---

## 2. Color System

Defined in [tailwind.config.js](tailwind.config.js) and as CSS variables in [globals.css](src/app/globals.css).

### Brand accent (`brand-*`)

| Token | Hex | Use |
|---|---|---|
| `brand-50` | `#EEF6F4` | Soft green backgrounds, hover tints, icon chips |
| `brand-100` | `#D9EDE8` | Selected-state backgrounds |
| `brand-200` | `#B0DDD2` | Subtle fills, chart gridlines on brand surfaces |
| `brand-300` | `#7BCCB7` | Light accents, disabled-state tints |
| `brand-400` | `#39AC8F` | Secondary accents |
| `brand-500` | `#235347` | **Primary actions, active nav, key metrics** |
| `brand-600` | `#1C4339` | Hover state for primary actions, links |
| `brand-700` | `#15342C` | Active/pressed state, link hover |
| `brand-800` | `#102621` | Deep accents, dark chips |
| `brand-900` | `#0B1B17` | Green-on-green text |

`primary` is aliased to `#235347` for legacy class usage.

### Neutrals

| Token | Hex | Use |
|---|---|---|
| `canvas` | `#FAFAFA` | App/page background |
| `surface` | `#FFFFFF` | Cards, panels, nav |
| `surface-muted` | `#F3F3F3` | Subtle fills, skeletons, neutral icon chips |
| `cool-grey` | `#DCE3E3` | Borders, dividers, scrollbar thumbs |
| `mid-grey` | `#A9B0B0` | Secondary text, labels, placeholders |
| `charcoal` | `#4A4A4A` | Body text, secondary headings |

### Semantic colors (use sparingly)

- **Red** (`red-500`/`red-50`): destructive actions, refunds, errors only.
- **Green/amber**: status badges only — never decoration.
- Rainbow icon chips are retired; metrics use `brand-50`/`surface-muted` chips.

### CSS variables

`--rc-brand`, `--rc-brand-strong`, `--rc-brand-soft`, `--rc-canvas`, `--rc-surface`, `--rc-surface-muted`, `--rc-border`, `--rc-cool-grey`, `--rc-text`, `--rc-text-secondary`, `--rc-text-muted`, `--rc-ease`, `--rc-duration` — for charts, inline styles, and non-Tailwind contexts. Recharts accent stroke/gradient: `#235347`; comparison series: `#cbd5e1` dashed.

### Chart palette (multi-series)

Single-series charts (revenue trend) use `brand-500`. Charts with multiple categories (payment mix, category breakdown, staff leaderboard) use a small supporting set so series don't collapse into shades of one green:

| Token | Hex | Use |
|---|---|---|
| Green (brand) | `#235347` | Primary/first series |
| Gold | `#B8843A` | Second series |
| Clay | `#B3574A` | Third series |
| Slate blue | `#3F5C8A` | Fourth series |
| Sage | `#7BA396` | Fifth series / muted comparison |

---

## 3. Typography

**Font:** Inter (loaded via `next/font` in `layout.tsx`), with system-UI fallbacks. `font-sans` and `font-display` both resolve to Inter.

| Role | Classes |
|---|---|
| Page title | `text-3xl lg:text-4xl font-semibold tracking-tight text-gray-900` |
| Section heading | `text-xl font-semibold tracking-tight text-gray-900` |
| Card label / eyebrow | `text-[11px] font-semibold text-mid-grey uppercase tracking-widest` |
| KPI value | `text-2xl–3xl font-semibold tracking-tight text-gray-900` |
| Body | `text-sm text-charcoal` |
| Secondary / meta | `text-xs font-medium text-mid-grey` |

**Rules:** prefer `font-semibold` over `font-bold`/`font-extrabold` (light-to-medium weights read as premium); large confident headings; generous line-height; no dense text blocks; max 2–3 type sizes per screen.

---

## 4. Layout Principles

- **Whitespace first**: page shells use `p-8 lg:p-12`; section gaps `mb-10`–`mb-12`; card padding `p-6`–`p-8`.
- **Grid-based**: 12-col responsive grids (`grid-cols-1 md:grid-cols-2 lg:grid-cols-5` for KPI rows, `xl:grid-cols-3` for content).
- **Max content width**: `max-w-[1600px] mx-auto` on dashboards.
- **Eliminate noise**: no harsh borders — use `border-gray-100/80` + soft shadow, or nothing.

## 5. Elevation

| Token | Use |
|---|---|
| `shadow-soft` | Buttons, nav, small elements |
| `shadow-card` | Cards, panels (default elevation) |
| `shadow-lifted` | Hover state of interactive cards, popovers, modals |

Never use Tailwind's default `shadow-lg`/`shadow-xl` on new surfaces.

---

## 6. Component Library

Reusable classes live in `@layer components` in [globals.css](src/app/globals.css):

| Class | Purpose |
|---|---|
| `.btn-primary` | Green key action — one per view ideally. Large click area, `rounded-xl`. |
| `.btn-secondary` | Quiet neutral bordered button. |
| `.btn-ghost` | Tertiary text button with green hover tint. |
| `.card` | White surface, `rounded-2xl`, `shadow-card`, hairline border, `p-6`. |
| `.input-field` | Spacious input (`px-4 py-3`), `rounded-xl`, green focus ring. |
| `.skeleton` | Shimmer loading placeholder. |

### Patterns

- **Buttons**: `rounded-xl`, `px-5 py-2.5`, `font-semibold text-sm`, visible hover state. Green = primary only.
- **Cards**: KPI cards put the uppercase label top-left, icon chip top-right (`w-10 h-10 rounded-xl bg-brand-50` with `text-brand-600` icon), large value below, muted subtext last.
- **Forms**: one column where possible, labels above fields, focus = green border + `ring-brand-500/20`.
- **Tables**: generous row padding (`py-4`), hairline `divide-gray-100` separators only, uppercase `mid-grey` column headers, no zebra striping; collapse to cards on mobile.

---

## 7. Navigation

- **Sidebar** (`Sidebar.tsx`): white, hairline right border + `shadow-soft`; collapsed-to-72 expand on hover/pin. Active item = solid `brand-500` pill with white text; inactive = `gray-500` with `brand-50` hover tint.
- **Top header** (`TopHeader.tsx`): borderless except hairline bottom, no drop shadow, `px-8`.
- Group functions, keep menu short, consistent `lucide-react` icons at `size={20}`.

## 8. Microinteractions

- Global 220ms ease transitions on buttons, links, and inputs (see `--rc-duration`).
- Card hover: `shadow-card → shadow-lifted` (no translate jumps).
- `animate-fade-in-up` for entering content; `.skeleton` for loading.
- `:focus-visible` = 2px green outline, offset 2px (accessibility built in).
- Animations communicate quality, never draw attention. Nothing above 300ms.

## 9. Responsive Rules

- KPI grids: 1 col mobile → 2 col `md` → 5 col `lg`.
- Tables become card lists below `md`.
- Touch targets ≥ 44px (buttons are `py-2.5`+ with `rounded-xl`).
- Page padding steps `p-8 → lg:p-12`.

---

## 10. Before → After Rationale

| Before | After | Why |
|---|---|---|
| Indigo `#5048e5` accent used heavily everywhere (407 usages) | Single forest-green `brand` scale (`#235347`), reserved for actions/active/metrics | One calm accent reads as premium hospitality; reduces visual noise |
| Rainbow KPI chips (yellow, rose, blue, orange, purple) | Green chips for key metrics, neutral grey for secondary, red only for refunds | Restrained palette; color now carries meaning instead of decoration |
| Horizontal icon-beside-number stat cards, `font-extrabold` | Vertical KPI cards: label → large number → trend/subtext | Executive-friendly hierarchy; the number is the hero |
| Gradient body background + dark-scheme overrides | Flat `#FAFAFA` canvas, white surfaces | Visually calm, consistent across screens |
| Mixed heavy shadows (`shadow-xl`, ad-hoc rgba shadows) | 3-step soft elevation system (`soft`/`card`/`lifted`) | Predictable depth, softer premium feel |
| Heavy bolding (`font-bold`/`extrabold`) throughout | `font-semibold` + tracking-tight headings, medium weights for body | Lighter weights with strong size hierarchy feel modern and breathe |
| Default browser scrollbars and focus outlines | 6px rounded grey scrollbars; green `:focus-visible` rings | Detail-level polish, accessible by default |
| No shared component vocabulary | `.btn-primary`, `.card`, `.input-field`, `.skeleton` + documented tokens | Consistency and faster future UI work |

---

## 11. Implementation Notes

- All former `indigo-*` utility classes were migrated to `brand-*` (mechanical class rename — **zero logic changed**).
- Thermal-receipt print styles in `globals.css` are intentionally untouched.
- When building new screens: start from `.card` + token classes above; do not introduce new hex values — extend the config instead.
