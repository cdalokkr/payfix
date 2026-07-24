# PayFix Global Theme & UX Design System

This document is the authoritative standard for all user interface components, controls, color palettes, dark/light theme switching, and UX interactions across the entire PayFix codebase.

All existing and future components must strictly conform to these rules.

---

## 1. Dual-Mode Color Palette Architecture

The application supports seamless toggling between **Light Mode** and **Dark Mode** via `next-themes` (`attribute="class"`).

| UI Element | Light Mode Theme | Dark Mode Theme |
| :--- | :--- | :--- |
| **Dashboard / Page Background** | `#F8FAFC` (Slate-50) | `#0B131A` (Deep Slate Black) |
| **Card / Surface Container** | `#FFFFFF` (Pure White) | `#121B22` / `#0B131A/60` |
| **Outer Borders** | `border-slate-200/90` | `border-slate-800/80` |
| **Primary Headings (`h1`, `h2`)** | `#0F172A` (Slate-900) | `#F8FAFC` / `text-slate-100` |
| **Body / Description Text** | `#475569` (Slate-600) | `#94A3B8` / `text-slate-400` |
| **Subtle Dividers** | `border-slate-100` | `border-slate-800` |

---

## 2. Save & Action Buttons Design System

### Save / Submit Buttons Concept (`.btn-save-superadmin`)
Primary Save and Provision buttons across superadmin and admin pages follow this exact high-visibility contrast specification:

#### Light Mode:
- **Idle Background:** `#02A88E` (Sophisticated Emerald Teal)
- **Hover Background:** `#02907A` (Slightly darker teal for solid press feedback)
- **Text & Icon Color:** `#FFFFFF` (Pure White for high legibility)
- **Box Shadow:** `0 4px 14px rgba(2, 168, 142, 0.20)`

#### Dark Mode:
- **Idle Background:** `#0BDBB9` (Electric Mint / Cyan-Teal)
- **Hover Background:** `#00F5D4` (Bright Neon Mint high-energy feedback)
- **Text & Icon Color:** `#0A1118` (Deep Slate Black for 4.5:1+ contrast ratio)
- **Glow Shadow:** `0 4px 20px rgba(11, 219, 185, 0.25)` (Glowing cyan background shadow)
- **Hover Glow Shadow:** `0 6px 24px rgba(11, 219, 185, 0.40)`

#### CSS Utility Definition (`globals.css`):
```css
.btn-save-superadmin {
  background-color: #02A88E !important;
  color: #FFFFFF !important;
  box-shadow: 0 4px 14px rgba(2, 168, 142, 0.20) !important;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
}
.btn-save-superadmin:hover:not(:disabled) {
  background-color: #02907A !important;
  color: #FFFFFF !important;
  box-shadow: 0 6px 18px rgba(2, 168, 142, 0.30) !important;
  transform: translateY(-1px);
}
.btn-save-superadmin:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.dark .btn-save-superadmin {
  background-color: #0BDBB9 !important;
  color: #0A1118 !important;
  box-shadow: 0 4px 20px rgba(11, 219, 185, 0.25) !important;
}
.dark .btn-save-superadmin:hover:not(:disabled) {
  background-color: #00F5D4 !important;
  color: #0A1118 !important;
  box-shadow: 0 6px 24px rgba(11, 219, 185, 0.40) !important;
  transform: translateY(-1px);
}
```

---

## 3. Input Controls, Selects, Comboboxes & DatePickers

All input controls must support both Light Mode and Dark Mode without raw, un-themed white inputs appearing in dark mode:

### Input & Textarea Fields
```tsx
className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-[3px] focus:ring-[#635BFF]/10 focus:border-[#635BFF] transition-all shadow-2xs"
```

### Combobox & Dropdown Popovers
```tsx
// Trigger
className="w-full h-[38px] bg-white dark:bg-[#0B131A] border border-slate-200/90 dark:border-slate-700/80 rounded-[12px] px-3 text-xs text-slate-900 dark:text-slate-100"

// Popover Content
className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-xl rounded-[14px]"

// Option Item Hover
className="hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-800 dark:text-slate-200"
```

### Modals & Dialogs
```tsx
// Dialog Overlay
className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs z-50"

// Dialog Content Card
className="bg-white dark:bg-[#121B22] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-slate-900 dark:text-slate-100"
```

---

## 4. UX & Accessibility Principles

1. **No Hardcoded Single-Theme Inline Styles:** Never use hardcoded inline styles like `style={{ backgroundColor: '#fafafa' }}` on layout tags. Use CSS variables or Tailwind `dark:` utility variants.
2. **Dynamic Spinner Color:** `Loader2` and icon elements inside buttons must inherit `color: currentColor` so they automatically match text color in both Light and Dark mode.
3. **Contrast Ratio Compliance:** Text on bright mint cyan backgrounds in dark mode MUST use `#0A1118` (Deep Slate Black) to maintain WCAG AAA contrast ratio standards.
4. **Smooth Transitions:** All theme switches, hover states, and press feedbacks use `transition-all duration-200 ease-out`.
