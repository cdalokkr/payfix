# PayFix Global Theme & UX Design System Rules

This file is automatically applied to all file edits, additions, and refactoring tasks.

1. **Dark & Light Mode Support Required**:
   Every new component or modified page MUST provide full dark mode support using Tailwind `dark:` variants or CSS variable tokens.

2. **Colors**:
   - Light Mode Page Background: `#F8FAFC`
   - Dark Mode Page Background: `#0B131A`
   - Light Card Background: `#FFFFFF`
   - Dark Card Background: `#121B22` / `#0B131A/60`
   - Light Save Button: `#02A88E` background, `#FFFFFF` text
   - Dark Save Button: `#0BDBB9` background (`#00F5D4` hover), `#0A1118` text & icons, `0 4px 20px rgba(11,219,185,0.25)` shadow

3. **Input Controls**:
   All `<input>`, `<select>`, `<textarea>`, `Combobox`, and `DatePicker` components MUST include:
   `bg-white dark:bg-[#0B131A] border-slate-200/90 dark:border-slate-700/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500`

4. **Modals & Popovers**:
   All `DialogContent`, `PopoverContent`, `SheetContent` MUST include:
   `bg-white dark:bg-[#121B22] border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100`
