# PayFix Platform Design & UI Component Standards

## 1. Unified Form Input & Label System (Matching Signup Form UX)
All form inputs, modal dialog fields, and settings controls across the entire PayFix platform MUST adhere to the exact typography, sizing, spacing, and interaction model established by the Signup Form and `<FormInput>` (`@/components/ui/form-input`):

### Form Input Specifications:
- **Typography & Font**: Standard platform font (`font-sans` / Inter / system font).
- **Form Label**:
  - **Font Size & Weight**: `text-[13px] font-medium mb-1.5`
  - **Color**: `text-slate-600 dark:text-slate-400`
  - **Focus Transition**: Smooth transition to `text-brand-primary` (`text-[#635BFF]`) when the corresponding input is focused.
  - **Spacing between Label and Input**: Margin bottom `mb-1.5` (6px).
- **Input Control**:
  - **Dimensions**: Height `h-[38px]`, horizontal padding `px-2.5` (or `pl-8.5` when an icon is present).
  - **Font Size & Color**: `text-[14px] font-normal text-slate-900 dark:text-slate-100 placeholder-slate-400/60 dark:placeholder-slate-600`.
  - **Corner Radius**: `rounded-[12px]`
  - **Background & Border**: `bg-white dark:bg-[#0B131A] border border-slate-200 dark:border-slate-800`.
  - **Hover State**: `hover:border-slate-300 dark:hover:border-slate-700`.
  - **Focus State**: `border-brand-primary dark:border-[#635BFF] ring-[3px] ring-brand-primary/10 dark:ring-[#635BFF]/10 outline-none`.
  - **Error State**: `border-red-400 dark:border-rose-500 ring-[3px] ring-red-400/10`.
- **Validation Error Text**:
  - `text-[12px] font-medium text-red-500 dark:text-rose-400 flex items-center gap-1 mt-1 pl-0.5`.
- **Row Spacing**:
  - Standard spacing between consecutive input rows: `space-y-3.5` or `gap-3.5` (14px).

---

## 2. Universal Reusable Modal Async Button System (`<ModalAsyncButton>` / `<CreateUserButton>`)
All stateful action buttons in modal dialogs, login flows, and entity management MUST use the central reusable `<ModalAsyncButton>` (`@/components/ui/create-user-button`), featuring 3 standardized modes with exact state transitions:

### Dimensions & UX:
- Height `h-[38px]`, horizontal padding `px-4` to `px-6`, rounded corners `rounded-[12px]`, typography `text-[14px] font-semibold`.

### Variant Modes & Visual States:

- **Validating / Processing State (All Modes & Login)**: `#6D7684` (`bg-[#6D7684] text-white cursor-wait font-semibold`) with spinning loader icon (`<Loader2 className="w-4 h-4 animate-spin mr-2" />`).
- **Success State (All Modes & Login)**: `#18AE50` (`bg-[#18AE50] text-white font-semibold shadow-md`) with animated tick in circle icon (`<CheckCircle className="w-4 h-4 mr-2" />`) (or cross icon in delete/danger mode).

1. **Primary Mode (`variant="primary"` / `mode="create"`)**:
   - **Usage**: Inserting / creating new records ("Provision Tenant", "Create Plan", "Create User", "Add Member", Login "Sign In").
   - **Idle State**: Solid Indigo (`bg-[#635BFF] text-white shadow-xs font-semibold`).
   - **Idle Hover State**: Darker Indigo (`hover:bg-[#5249ea] shadow-md transition-colors duration-200 cursor-pointer`).
   - **Validating / Loading State**: Neutral Slate (`bg-[#6D7684] text-white cursor-wait font-semibold`) with spinning loader icon and loading text.
   - **Success State**: Vivid Emerald Green (`bg-[#18AE50] text-white shadow-md font-semibold`) with animated tick in circle icon and success text.
   - **Error State**: Red (`bg-red-600 hover:bg-red-700 text-white font-semibold`) with alert icon.

2. **Secondary Mode (`variant="secondary"` / `mode="edit"`)**:
   - **Usage**: Editing / updating / saving existing records ("Save Changes", "Update Info", "Edit Subscription", "Update Plan").
   - **Idle State**: Purple (`bg-[#7C007C] text-white shadow-xs font-semibold`).
   - **Idle Hover State**: Darker Purple (`hover:bg-[#600060] shadow-md transition-colors duration-200 cursor-pointer`).
   - **Validating / Loading State**: Neutral Slate (`bg-[#6D7684] text-white cursor-wait font-semibold`) with spinning loader icon and text.
   - **Success State**: Exact same Vivid Emerald Green as Login Sign In button (`bg-[#18AE50] text-white shadow-md font-semibold`) with animated tick in circle icon and text (`"Update Successful!!"`).
   - **Error State**: Red (`bg-red-600 hover:bg-red-700 text-white font-semibold`) with alert icon.

3. **Danger Mode (`variant="danger"` / `mode="delete"`)**:
   - **Usage**: Deleting records / destructive actions ("Delete Tenant", "Remove Record", "Revoke Access").
   - **Idle State**: Red-Orange (`bg-[#EA580C] text-white shadow-xs font-semibold`).
   - **Idle Hover State**: Darker Red-Orange (`hover:bg-[#C2410C] shadow-md transition-colors duration-200 cursor-pointer`).
   - **Validating / Loading State**: Neutral Slate (`bg-[#6D7684] text-white cursor-wait font-semibold`) with spinning loader icon and text.
   - **Success State**: Vivid Emerald Green (`bg-[#18AE50] text-white shadow-md font-semibold`) with cross/error icon (`<X className="w-4 h-4 mr-2" />`) and text (`"Deletion Successful!!"`).
   - **Error State**: Dark Red (`bg-red-700 hover:bg-red-800 text-white font-semibold`) with alert icon.

---

## 3. Standardized Modal Dialog Component (`<ModalDialog>`)
All modal dialog popups throughout the PayFix application must use the central reusable `<ModalDialog>` component (`@/components/ui/modal-dialog`).

### Core Rules for Modal Dialogs:
1. **No Backdrop Blur / Crisp Clear Background**:
   - `overlayClassName="bg-transparent pointer-events-none"`
   - The background page must remain 100% sharp, clear, and visible when the modal dialog is active.

2. **Top-Aligned Viewport Positioning**:
   - Modals are positioned top-aligned right below the top platform header (`fixed top-10 sm:top-14 left-[50%] translate-x-[-50%] max-h-[85vh] overflow-y-auto flex flex-col`).

3. **Light Gray Sticky Compact Header & No Subheadings**:
   - Headers MUST NOT have subheadings or descriptions.
   - Header height is reduced and compact (`px-5 py-2.5`).
   - Header background color: **Lighter Gray** (`bg-slate-50/95 dark:bg-[#121B22]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80`).
   - When the modal body scrolls vertically, the header remains **sticky** at the top.

4. **Header Top-Right Close (X) Button with Red-Orange Hover**:
   - Close (X) button is placed at the top-right corner of the modal header.
   - On hover: background turns **Red-Orange** (`hover:bg-[#EA580C]`) and icon turns white (`text-white`).

5. **Reduced Content Top and Bottom Padding**:
   - Padding before content starts is compact: `py-2.5 px-5 space-y-3`.

6. **Input Box Controls Prefix Icons**:
   - Modal input controls MUST NOT use prefix icons inside input boxes; keep clean text-only inputs for high readability.

7. **Sticky Footer with Right-Aligned Natural-Width Action Button**:
   - The modal footer is pinned and sticky at the bottom (`sticky bottom-0 z-20 px-5 py-2.5 bg-slate-50/95 dark:bg-[#121B22]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80`).
   - Action buttons in modal footers must be **natural/idle width (`w-full sm:w-auto px-6`)** and **right-aligned (`flex justify-end`)**, not full-width.

8. **Section Spacing in Complex Modals**:
   - Multi-section modals (e.g. Add Tenant) use larger spacing (`space-y-6`) between major sections compared to row spacing (`gap-3.5` / `space-y-3.5`).

9. **Modal Reset on Open/Close**:
   - Closing and re-opening a modal dialog resets all input fields, validation errors, and async states.

---

## 4. Date Formatting Standard (`dd/MM/yyyy`)
All dates, license expiration dates, and registered dates across tenant cards, date pickers, and modals MUST be formatted as **`dd/MM/yyyy`** (e.g. `14/08/2026`).

---

## 5. Non-Async Action Buttons (`<AppButton variant="primary">`)
All non-async primary buttons across the platform (e.g. "Add Tenant" trigger CTA, "Create Plan" trigger CTA, Card "Edit" triggers) MUST use `<AppButton variant="primary">` (`@/components/ui/button-system`):
- Background: Solid Indigo `bg-[#635BFF] hover:bg-[#5249ea] text-white shadow-xs hover:shadow-md`
- Height: `h-[38px]`, `rounded-[12px]`, `text-[14px] font-semibold`.
