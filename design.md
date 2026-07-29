# PayFix Global UI Design Guidelines & Theme System

## 1. Global Button & Control Standards

- **Standard Button Dimensions**:
  - **Height**: `h-[38px]` (38px uniform height across all primary/secondary/action buttons)
  - **Border Radius**: `rounded-[12px]` (12px rounded corners for a modern, sleek SaaS feel)
  - **Typography**: `text-sm font-semibold` (14px semi-bold for high legibility)
- **Primary Action Button (+ Add Tenant, Main CTAs)**:
  - Background: `#635BFF`, Hover: `#5249ea`, Text: `#FFFFFF`
  - Shadow: `shadow-xs hover:shadow-md`
- **Superadmin Save Button (`btn-save-superadmin`)**:
  - ☀️ **Light Mode**:
    - Background (Idle): `#02A88E` (Sophisticated Emerald Teal)
    - Background (Hover): `#02907A` (Darker teal for solid press feedback)
    - Text & Icon: `#FFFFFF` (Pure White)
    - Shadow: `rgba(2, 168, 142, 0.20)` (Soft teal shadow)
  - 🌙 **Dark Mode**:
    - Background (Idle): `#0BDBB9` (Electric Mint / Cyan-Teal)
    - Background (Hover): `#00F5D4` (Bright Neon Mint)
    - Text & Icon: `#0A1118` (Deep Slate Black for 100% contrast ratio)
    - Shadow: `rgba(11, 219, 185, 0.25)` (Glowing cyan aura)
- **Cancel / Secondary Button**:
  - Light: Background `bg-rose-50`, Hover `bg-rose-100`, Border `border-rose-200/80`, Text `text-rose-600`
  - Dark: Background `bg-rose-950/40`, Hover `bg-rose-900/60`, Border `border-rose-900/60`, Text `text-rose-400`
- **Neutral / Outline Button**:
  - Light: Background `bg-white`, Border `border-slate-200`, Text `text-slate-700`, Hover `bg-slate-50`
  - Dark: Background `bg-slate-900/60`, Border `border-slate-700`, Text `text-slate-200`, Hover `bg-slate-800`

---

## 2. Form Input Controls & Validation Standards

- **Input Control Dimensions**:
  - **Height**: `h-[38px]`, Padding: `px-3`, Border Radius: `rounded-[12px]`
- **Labels**:
  - Positioned above input control
  - Typography: `text-xs font-semibold text-slate-600 dark:text-slate-400` (12px semi-bold, matching non-edit mode display)
- **Inputs**:
  - Light: Background `#FFFFFF`, Border `#E5E7EB`, Focus Ring `focus:ring-[3px] focus:ring-indigo-500/10 focus:border-[#635BFF]`
  - Dark: Background `#0B131A`, Border `rgba(255, 255, 255, 0.12)`, Focus Ring `focus:ring-[3px] focus:ring-indigo-500/10 focus:border-[#635BFF]`
- **Inline Validation Errors**:
  - Red border on error: `border-rose-400`
  - Inline error message below input: `text-[11px] font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1`

---

## 3. Full-UX Light & Dark Theme Architecture

### ☀️ Light Mode (Clean, Saturated & Professional)
- **Page Background**: `#FAFAFA` (Soft neutral off-white)
- **Cards & Containers**: `#FFFFFF` with border `#E5E7EB` and `shadow-2xs`
- **Active Navigation Pill**: `#E0E1FF` background, `#111827` (bold) text, `#5B5CEB` icon
- **Hover Menu Item**: `#F3F4F6`

### 🌙 Dark Mode (Deep Obsidian & Glowing Neon Accents)
- **Page Background**: `#0B131A` (Deep Slate Obsidian - anti-eyestrain)
- **Cards & Containers**: `#141E28` / `rgba(15, 23, 42, 0.70)` with translucent glass border `rgba(255, 255, 255, 0.08)` and shadow `shadow-black/40`
- **Active Navigation Pill**: `rgba(91, 92, 235, 0.25)` background, `#F9FAFB` (bold) text, `#0BDBB9` mint icon
- **Hover Menu Item**: `rgba(255, 255, 255, 0.06)`

---

## 4. Workspace Directory Design Rules

- Display workspaces as premium selectable cards instead of plain rows.
- Each card includes: Logo, Name, Domain, Plan Badge, Status Badge, User Count, Storage, Last Updated, Overflow Menu.
- Hover: background #F9FAFB, border #E5E7EB, subtle lift (translateY(-1px)), soft shadow.
- Selected: background #EEF2FF, 4px left accent border (#5B5CEB), border #C7D2FE, stronger shadow, workspace name color #3730A3 and font-weight 700.
- Animate all hover and selection states in 200ms using ease-out.
- Pagination uses rounded square buttons (36×36px), active page with brand color #5B5CEB and white text.
- Use Inter Variable typography with consistent spacing (16px internal padding, 24px section gaps).
