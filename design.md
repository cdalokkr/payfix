# PayFix Platform Design & UI Component Standards

## 1. Unified Primary Non-Async Button Component (`<AppButton variant="primary">`)
All non-async primary buttons across the entire PayFix platform (e.g. "Add Tenant" CTA, "Create Plan" CTA, Card 1 & Card 2 "Edit" buttons) MUST use the central reusable `<AppButton variant="primary">` component (`@/components/ui/button-system`).

### Unified Primary Button Standards:
- **Component**: `<AppButton variant="primary">`
- **Background Color**: Solid Indigo (`bg-[#635BFF] hover:bg-[#5249ea] text-white shadow-xs hover:shadow-md border border-transparent`)
- **Typography & Font Size**: `text-xs sm:text-sm font-semibold`
- **Dimensions & Radius**: Height `h-9` (`h-[38px]`), horizontal padding `px-4`, rounded corners `rounded-xl` (`rounded-[12px]`)
- **Icon Alignment**: `flex items-center justify-center gap-1.5`
- **Result**: Guarantees 100% identical visual appearance, font size, font weight, background color, hover effect, and padding across all non-async primary buttons in the project.

## 2. Universal Stateful Async Button System (`<CreateUserButton>` / `<LoginButton>`)
All stateful async buttons throughout the PayFix platform (Login page, modal dialog save buttons, user creation, password resets, and delete buttons) MUST use the central stateful async engine supporting 3 visual variant modes:

### Variant Modes & Usage Rules:
1. **Primary Mode (`mode="create"` / `variant="primary"`)**:
   - **Usage**: Auth flows (Login Page Sign In button), new record creation ("Add Tenant", "Create Plan", "Create User").
   - **Idle State**: Solid Indigo theme (`bg-[#635BFF]` hover `bg-[#5249ea] text-white shadow-xs hover:shadow-md font-semibold`). Hover matches Login page Sign In button.
   - **Processing / Loading State**: Solid Indigo background (`bg-[#635BFF] text-white cursor-wait font-semibold`) with animated spinner & text (`"Authenticating..."` / `"Creating..."`).
   - **Success State**: Emerald Green background (`bg-[#02A88E]` / `bg-emerald-600 text-white shadow-md font-semibold`) with checkmark icon & success text (`"Access granted!"` / `"Creation Successful!!"`).

2. **Secondary Mode (`mode="edit"` / `variant="secondary"`)**:
   - **Usage**: Editing / updating existing records ("Edit Admin Info", "Edit Subscription", "Edit Plan").
   - **Idle State**: Light Plum/Purple background (`bg-[#7C007C]/10 dark:bg-[#7C007C]/20 text-[#7C007C] dark:text-[#F080F0] border border-[#7C007C]/30`), **Hover Background**: Solid Plum/Purple (`hover:bg-[#7C007C] hover:text-white transition-colors duration-200 cursor-pointer font-semibold`).
   - **Processing / Loading State**: Solid Plum/Purple background (`bg-[#7C007C] text-white cursor-wait font-semibold`) with animated spinner & text (`"Updating..."` / `"Saving..."`).
   - **Success State**: Emerald Green background (`bg-[#02A88E]` / `bg-emerald-600 text-white shadow-md font-semibold`) with checkmark icon & success text (`"Update Successful!!"`).

3. **Danger Mode (`mode="delete"` / `variant="danger"`)**:
   - **Usage**: Delete Tenant / Destructive operations.
   - **Idle State**: Red-Orange background (`bg-orange-600 hover:bg-red-700 text-white shadow-xs hover:shadow-md transition-colors duration-200 cursor-pointer font-semibold`).
   - **Processing / Loading State**: Dark Red background (`bg-red-700 text-white cursor-wait font-semibold`) with animated spinner & text (`"Deleting..."`).
   - **Success State**: Light Red-Orange / Coral Red background (`bg-rose-500 dark:bg-rose-600 text-white shadow-md font-semibold`) with icon & success text (`"Deletion Successful!!"`).

## 3. Standardized Modal Dialog Component (`<ModalDialog>`)
All modal dialog popups throughout the PayFix application must use the central reusable `<ModalDialog>` component (`@/components/ui/modal-dialog`).

### Core Rules for Modal Dialogs:
1. **No Backdrop Blur / Crisp Clear Background**:
   - `overlayClassName="bg-transparent pointer-events-none"`
   - The background page must remain 100% sharp, clear, and visible when the modal dialog is active.

2. **Top-Aligned Viewport Positioning**:
   - Modals are positioned top-aligned right below the top platform header (`fixed top-10 sm:top-14 left-[50%] translate-x-[-50%] max-h-[85vh] overflow-y-auto`).

3. **Form Input Label & Control Styling Standard**:
   - ALL input labels across the platform (including `FormInput`, `Subscription Plan`, `Expiry Date`, toolbar filters, and form step fields) MUST use **`text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5`** (14px font-semibold).
   - ALL input controls MUST use `text-xs font-normal text-slate-900 dark:text-slate-100` (12px font-normal).

4. **Field-Level Zod Validation & Inline Error Standard**:
   - Inputs validate against Zod schemas (e.g. phone numbers must be 10 digits with optional country code).
   - Validation errors display inline below the input control (`text-xs font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-0.5`).

5. **Modal Reset on Open/Close**:
   - Closing and re-opening a modal dialog resets all input fields, steps, and error states to blank/empty.

6. **Windows-Style Close (X) Hover Effect**:
   - On hover: background turns red-orange (`hover:bg-[#E81123]`) and icon turns white (`text-white`).

7. **Async Save Button with 2-Second Success State**:
   - The modal footer features a full-width async Save button (`CreateUserButton`).

## 4. Date Formatting Standard (`dd/MM/yyyy`)
All dates, license expiration dates, and registered dates across tenant cards, date pickers, and modals MUST be formatted as **`dd/MM/yyyy`** (e.g. `13/08/2026`).

## 5. 3-Column Responsive Layout for Tenant Provisioning (`md:max-w-[840px]`)
Add Tenant modals use a wide 3-column horizontal SaaS layout:
- **Column 1**: 🏢 1. Workspace Details (Company Name, Workspace Slug)
- **Column 2**: 👤 2. Primary Admin Account (Contact Name, Admin Email, 10-digit Phone)
- **Column 3 (Narrower 240px Width)**: 💳 3. Subscription & License (Initial Subscription Plan, Expiration Date)
Container width is set to `md:max-w-[840px]`. Layout uses `grid grid-cols-1 md:grid-cols-[1fr_1fr_240px] gap-4 sm:gap-5`. Features single-click Zod inline validation over all fields and a stateful **"Provision Tenant Workspace"** button.

## 6. Card Bottom Right-Aligned Idle Primary Edit Button Standard
Card headers in tenant details MUST feature:
- **Card Header**: Distinct full-width bottom border (`-mx-4 px-4 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800`).
- **Data Rows**: All key-value data rows use a left-aligned grid structure (`grid grid-cols-[120px_1fr] items-center gap-2 text-left`). Labels use `font-semibold text-slate-700 dark:text-slate-300` and values use `font-normal text-slate-600 dark:text-slate-400`.
- **Card Action Footer**: The Edit button is placed at the **bottom right of the card** using `<AppButton variant="primary">` (`flex justify-end pt-3 border-t mt-3`), rendering text **"Edit"** with icon (`<Edit2 className="w-3.5 h-3.5 text-white" /> Edit`).

## 7. Single-Row Overrides & Compact Expiration Date Layout
In subscription edit modals, `Employees Overrides`, `Moderators Override`, and `License Expiration Date` MUST be rendered in a single horizontal row with compact input field widths (`max-w-[130px]`) and tight modal dialog container widths (`maxWidth="sm:max-w-[480px]"`).
