---
name: Apex Enterprise
colors:
  surface: '#f9f9ff'
  surface-dim: '#d3daea'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eefe'
  surface-container-high: '#e2e8f8'
  surface-container-highest: '#dce2f3'
  on-surface: '#151c27'
  on-surface-variant: '#464555'
  inverse-surface: '#2a313d'
  inverse-on-surface: '#ebf1ff'
  outline: '#767586'
  outline-variant: '#c7c4d7'
  surface-tint: '#4949d9'
  primary: '#4140d1'
  on-primary: '#ffffff'
  primary-container: '#5b5ceb'
  on-primary-container: '#f5f2ff'
  inverse-primary: '#c1c1ff'
  secondary: '#544fc0'
  on-secondary: '#ffffff'
  secondary-container: '#8f8bff'
  on-secondary-container: '#231791'
  tertiary: '#525761'
  on-tertiary: '#ffffff'
  tertiary-container: '#6a6f7a'
  on-tertiary-container: '#f0f3ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e1dfff'
  primary-fixed-dim: '#c1c1ff'
  on-primary-fixed: '#08006c'
  on-primary-fixed-variant: '#2f2bc1'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3b35a7'
  tertiary-fixed: '#dee2ef'
  tertiary-fixed-dim: '#c2c6d3'
  on-tertiary-fixed: '#171c25'
  on-tertiary-fixed-variant: '#424751'
  background: '#f9f9ff'
  on-background: '#151c27'
  surface-variant: '#dce2f3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-gap: 24px
  item-padding: 16px
  gutter: 16px
  stack-sm: 8px
  stack-md: 12px
---

## Brand & Style

This design system is engineered for premium SaaS and enterprise environments where clarity, speed, and high-density information management are paramount. The brand personality is professional, reliable, and sophisticated, avoiding unnecessary flourish in favor of functional elegance.

The visual style follows a **Corporate Modern** approach. It utilizes a structured layout with subtle depth cues—such as refined borders and intentional use of whitespace—to establish a clear hierarchy. The aesthetic is clean and high-contrast, ensuring that complex data remains accessible and the user interface feels responsive and dependable.

## Colors

The palette is anchored by a vibrant, technical blue (#5B5CEB) that drives primary actions. Supporting this is a deep indigo for high-emphasis text and a range of functional grays to manage background surfaces and borders.

- **Primary:** Used for brand presence, primary buttons, and active indicators.
- **Secondary/Accent:** Reserved for selected states and high-contrast typography in active items.
- **Surface Tones:** A progression from pure white backgrounds to subtle light-gray hovers (#F9FAFB) and soft indigo selections (#EEF2FF).
- **Feedback:** Semantic colors for success, warning, and error are used sparingly to highlight system status without overwhelming the workspace.

## Typography

This design system uses **Inter Variable** exclusively to maintain a systematic, utilitarian feel. The hierarchy is established through weight and scale rather than decorative shifts.

For enterprise dashboards, typography must remain legible at small sizes. Use `body-md` for standard data entry and `body-sm` for secondary metadata. Headlines should remain compact to allow for maximum content density. In the "Selected" state for items, the weight is increased to 700 to provide a distinct visual anchor.

## Layout & Spacing

The layout utilizes a **fluid grid** with fixed sidebars for primary navigation. 

- **Section Gaps:** A consistent 24px gap is used to separate major layout blocks (e.g., the directory list from the detail view).
- **Internal Padding:** Cards and workspace items use a 16px internal padding to ensure content is breathable but dense enough for power users.
- **Breakpoints:** 
  - **Desktop:** 12-column grid, fluid content area.
  - **Tablet:** 8-column grid, sidebars collapse into a drawer.
  - **Mobile:** 4-column grid, vertical stacking of all workspace components.

## Elevation & Depth

Hierarchy is achieved through a combination of **low-contrast outlines** and **ambient shadows**. 

- **Level 0 (Base):** Default background surface.
- **Level 1 (Surface):** Cards and workspace items use a 1px #E5E7EB border with no shadow.
- **Level 2 (Hover):** When hovered, elements translate -1px on the Y-axis and gain a soft, diffused shadow to indicate interactivity.
- **Level 3 (Selected/Active):** Elements receive a stronger, multi-layered shadow and a 4px left-aligned primary accent border to firmly establish focus.

## Shapes

The design system employs a **Rounded** (0.5rem base) shape language to soften the industrial nature of data-heavy interfaces. 

- **Workspace Cards:** Use `rounded-xl` (1.5rem / 24px) to create distinct visual containers.
- **Buttons & Inputs:** Follow the standard `rounded-lg` (1rem / 16px) or `rounded` (0.5rem / 8px) depending on the context.
- **Pagination:** Uses a strict 36x36px square with slightly rounded corners (4px) to optimize click-target precision.

## Components

### Buttons & Navigation
- **Primary Button:** Solid #5B5CEB background, white text.
- **Pagination:** 36x36px squares. Active state: #5B5CEB / White text. Inactive state: White / #6B7280 text / #E5E7EB border.
- **Tabs:** Underlined style for main views, with the active tab using the primary color and a 2px bottom border.

### Cards & Workspace Items
- **Standard Card:** White background, 1px #E5E7EB border, 16px padding.
- **Hover State:** #F9FAFB background, 200ms `translateY(-1px)` transition, soft shadow.
- **Selected State:** #EEF2FF background, #C7D2FE border, 4px left accent #5B5CEB, weight 700 text in #3730A3.

### Inputs & Status
- **Input Fields:** 1px #E5E7EB border, 8px roundedness, 14px text. Focus state uses a 2px #5B5CEB ring.
- **Status Chips:** Light tinted backgrounds with dark text (e.g., Light Red for "Suspended", Light Green for "Active").
- **Transitions:** All state changes (hover, active, focus) must use a **200ms ease-out** animation for a fluid, premium feel.