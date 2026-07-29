# UI Design Guidelines & Light/Dark Theme System

This document specifies the global design system standards for buttons, form inputs, Zod validation handling, and Light/Dark themes across the PayFix application.

---

## 1. Button System (`AppButton`)

All buttons in the application follow a standardized specification:

- **Height**: `h-[38px]` (38px uniform height)
- **Radius**: `rounded-[12px]` (12px rounded corners)
- **Typography**: `text-sm font-semibold` (14px semi-bold font)

### Button Variants:

| Variant | Light Mode Style | Dark Mode Style | Usage |
| :--- | :--- | :--- | :--- |
| **`primary`** | `#635BFF` background, White text | `#7375EF` background, White text | Primary CTAs, `+ Add Tenant` |
| **`save-superadmin`** | `#02A88E` Emerald Teal, White text, `#02907A` hover | `#0BDBB9` Neon Mint, `#0A1118` Deep Black text, `#00F5D4` hover | Superadmin Save / Confirm actions |
| **`success`** | `#16A34A` Emerald Green, White text | `#22C55E` Emerald Green, White text | General success confirmations |
| **`cancel`** | `#FFF1F2` Light Rose, `#E11D48` text | `rgba(159,18,57,0.4)` Dark Rose, `#FB7185` text | Cancellation / Dismiss |
| **`secondary`** | `#F1F5F9` Slate light, `#334155` text | `#1E293B` Slate dark, `#F1F5F9` text | Secondary actions |
| **`outline`** | `#FFFFFF` background, `#E2E8F0` border | `#0B131A` background, `#334155` border | Filter triggers, actions dropdown |

---

## 2. Form Input Controls (`FormInput`)

- **Dimensions**: `h-[38px]`, `rounded-[12px]`, `px-3` padding
- **Label**: Positioned above input control, typography `text-xs font-semibold text-slate-600 dark:text-slate-400`
- **Focus State**: `focus:ring-[3px] focus:ring-indigo-500/10 focus:border-[#635BFF]`
- **Zod Validation Error**: Red border (`border-rose-400`), inline error text (`text-[11px] font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1`)

---

## 3. Light & Dark Mode Color Palette

### ☀️ Light Mode (`.theme-default` / root)
- **Background**: `#FAFAFA`
- **Card / Surface**: `#FFFFFF`, Border `#E5E7EB`
- **Active Nav Item**: Background `#E0E1FF`, Text `#111827` (bold), Icon `#5B5CEB`

### 🌙 Dark Mode (`.dark`)
- **Background**: `#0B131A` (Deep Slate Obsidian)
- **Card / Surface**: `#141E28`, Border `rgba(255, 255, 255, 0.08)`
- **Active Nav Item**: Background `rgba(91, 92, 235, 0.25)`, Text `#F9FAFB` (bold), Icon `#0BDBB9`
