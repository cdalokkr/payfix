# Form Design System & Reference Guide (Shadcn UI & React Hook Form)

This document serves as the standard design system and technical reference guide for all create, edit, update, and delete forms in the project. It is based on the highly optimized `ModernAddUserForm` architecture. Future form creations or refactorings must strictly adhere to these patterns.

---

## 1. Architectural Pattern: Controller vs. Content Separation
To maximize rendering performance, prevent sheet closure stutter, and isolate re-renders:
* **The Controller Shell (`FormSheet`)**: Stateful wrapper managing the outer sheet (`Sheet`, `SheetContent`), API interactions (TRPC mutations), success/error delays, cache invalidation sequences, and prefetch triggers.
* **The Pure Content Form (`FormContent`)**: Memoized using `React.memo` (or similar optimization). It accepts `form` context, `isSubmitting`, `isSuccess`, `submitError`, and helper state props. It is purely responsible for rendering the form layouts, accordions, and controls, ensuring that typing or field validation does not trigger heavy parent re-renders.

---

## 2. Style & Formatting System

### 2.1 Glassmorphic Container Cards
Inner form segments must use premium backdrop blurs and theme-adaptive borders to match the design system:
```tsx
// Outer Card Wrapper
<Card className="w-full max-w-2xl mx-auto bg-card dark:bg-zinc-900/90 text-card-foreground shadow-lg border-2 border-border/60 dark:border-zinc-800 rounded-lg">
  <CardContent className="p-4">
    ...
  </CardContent>
</Card>
```

### 2.2 Collapsible High-Density Accordions
Group related input fields using Shadcn's Accordion to maintain a high-density, clean, and organized screen space:
* **Default Values**: Set `type="multiple"` and specify `defaultValue` arrays to keep logical sections expanded by default for instant visibility.
* **Theme-Adaptive Hover States**: Use dynamic background accents for accordion headers that reflect the current operation (e.g., Blue for Create, Purple for Edit, Red for Delete/Warning).
* **Sibling-Style Accordions**: Place logical form divisions (e.g., `Company Details`, `Contact Information`, and `Location Details`) as sibling items at the same hierarchical level (outside of each other) to maintain clean and direct navigation.
* **Separate Color Themes**: Ensure sibling sections use distinct, vibrant color themes (e.g., Sky Blue for Company Details, Emerald Green for Contacts, Indigo Purple for Locations) across create, edit/update, and delete actions for enhanced readability:
  - **Company Details**: Sky Blue theme (`bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200`)
  - **Contact Information**: Emerald Green theme (`bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/10 text-emerald-900 dark:text-emerald-200`)
  - **Location Details**: Indigo Purple theme (`bg-purple-500/5 hover:bg-purple-500/10 dark:bg-purple-950/10 text-purple-900 dark:text-purple-200`)
  - **Warning/Deactivation Subsections**: Distinct destructive tones (e.g., Red/Rose for Company details warning, Amber/Warning for Contact info warning, Zinc/Gray for Location info warning).

* **HTML Structure**:
```tsx
<Accordion type="multiple" defaultValue={["company-details", "contact-details", "location-details"]} className="bg-white/80 dark:bg-zinc-950/40 backdrop-blur-sm rounded-lg border dark:border-zinc-800 space-y-4">
  
  {/* Sibling Item 1 (Company Details - Sky Blue Theme) */}
  <AccordionItem value="company-details" className="border-b-0 border border-blue-500/25 rounded-lg overflow-hidden bg-white/60 dark:bg-zinc-950/20">
    <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-blue-500/5 hover:bg-blue-500/10 dark:bg-blue-950/20">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <span className="font-medium text-blue-900 dark:text-blue-200">Company Details</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
      {/* Company Fields */}
    </AccordionContent>
  </AccordionItem>

  {/* Sibling Item 2 (Contact Information - Emerald Green Theme) */}
  <AccordionItem value="contact-details" className="border-b-0 border border-emerald-500/25 rounded-lg overflow-hidden bg-white/60 dark:bg-zinc-950/20">
    <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-emerald-500/5 hover:bg-emerald-500/10 dark:bg-emerald-950/10">
      <div className="flex items-center gap-3">
        <Mail className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium text-emerald-900 dark:text-emerald-200">Contact Information</span>
      </div>
    </AccordionTrigger>
    <AccordionContent className="px-4 pb-4 pt-4 space-y-4">
      {/* Contact Fields */}
    </AccordionContent>
  </AccordionItem>

</Accordion>
```

### 2.3 Grid Layout Specs
Always implement mobile-first responsive grids for form fields. Use compact, consistent gap utilities:
* **3-Column Grid (e.g., Name Rows, City/State/Pincode)**:
  `grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6`
* **2-Column Grid (e.g., Credentials, Website/GST Rows)**:
  `grid grid-cols-1 md:grid-cols-2 gap-4`

---

## 3. Controls & Form Validation

### 3.1 Field-Level Standard
Every input must be wrapped in a controlled `<Field>` layout from the unified UI fields (`@/components/ui/field`), mapping its error state to visually change styles:
* **Round Corners Symmetry**: Do NOT apply custom rounded utility classes (such as `rounded-xl` or `rounded-2xl`) directly on `<Input>` or `<Textarea>` controls. Instead, let them naturally fall back to the project's standard form input roundings (`rounded-md`, as defined in the default component layer). This ensures 100% round-corner consistency across all project forms.
```tsx
<Controller
  name="companyName"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="companyName">Company Name *</FieldLabel>
      <Input
        id="companyName"
        type="text"
        placeholder="Enter company name"
        className={fieldState.invalid ? "border-destructive" : ""}
        {...field}
      />
      {fieldState.invalid && fieldState.error && (
        <FieldError errors={[fieldState.error]} className="mt-1" />
      )}
    </Field>
  )}
/>
```

### 3.2 Key Input Control Rules
1. **Phone Numbers**: Must strictly accept only numbers and restrict input to 10 digits in length:
   ```typescript
   onChange={(e) => {
     const value = e.target.value
     if (/^\d*$/.test(value) && value.length <= 10) {
       field.onChange(value)
     }
   }}
   ```
2. **Text Names**: Restrict name characters to alphabetical and spaces:
   ```typescript
   onChange={(e) => {
     const value = e.target.value
     if (/^[a-zA-Z. ]*$/.test(value)) {
       field.onChange(value)
     }
   }}
   ```
3. **Pincodes / Numeric Inputs**: Ensure input only contains numbers:
   ```typescript
   onChange={(e) => {
     const value = e.target.value
     if (/^\d*$/.test(value)) {
       field.onChange(value)
     }
   }}
   ```
4. **Dropdown Dropdowns (e.g., Industry Selector)**: Use standard Shadcn Select components with predefined values to ensure clean, structured data inputs (e.g. Technology, Education, Healthcare, Finance, Manufacturing, Retail, Real Estate, Logistics, Media, Others):
   ```tsx
   <Controller
     name="industry"
     control={control}
     render={({ field, fieldState }) => (
       <Field data-invalid={fieldState.invalid}>
         <FieldLabel htmlFor="industry">Industry</FieldLabel>
         <Select value={field.value || ""} onValueChange={field.onChange}>
           <SelectTrigger id="industry" className={fieldState.invalid ? "border-destructive" : ""}>
             <SelectValue placeholder="Select Industry" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="Technology">Technology</SelectItem>
             <SelectItem value="Education">Education</SelectItem>
             ...
           </SelectContent>
         </Select>
          {fieldState.invalid && fieldState.error && <FieldError errors={[fieldState.error]} className="mt-1" />}
        </Field>
      )}
    />
    ```

### 3.3 Popover Calendar / Date Picker
For any single date input, do NOT use default `<input type="date" />`. Instead, use the standard shadcn Popover + Calendar picker for UI symmetry:
1. **State Management**: Track the date value as a formatted string (e.g., `'yyyy-MM-dd'`) and control popover visibility:
   ```typescript
   const [isCalendarOpen, setIsCalendarOpen] = useState(false);
   const [dateVal, setDateVal] = useState<string>("");
   ```
2. **Component Structure**:
   ```tsx
   import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
   import { Calendar } from "@/components/ui/calendar";
   import { format } from "date-fns";
   import { Calendar as CalendarIcon } from "lucide-react";
   import { Button } from "@/components/ui/button";

   // Inside render:
   <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
     <PopoverTrigger asChild>
       <Button
         variant="outline"
         className={cn(
           "w-full h-10 pl-3 text-left font-normal border-muted-foreground/20 hover:bg-muted/10 flex items-center justify-between",
           !dateVal && "text-muted-foreground"
         )}
       >
         {dateVal ? (
           format(new Date(dateVal), "PPP")
         ) : (
           <span>Pick a date</span>
         )}
         <CalendarIcon className="h-4 w-4 opacity-50" />
       </Button>
     </PopoverTrigger>
     <PopoverContent className="w-auto p-0" align="start">
       <Calendar
         mode="single"
         selected={dateVal ? new Date(dateVal) : undefined}
         onSelect={(date) => {
           if (date) {
             setDateVal(format(date, 'yyyy-MM-dd'));
           }
           setIsCalendarOpen(false);
         }}
         initialFocus
       />
     </PopoverContent>
   </Popover>
   ```

---

## 4. Asynchronous & Action Buttons System

### 4.1 Stateful Multi-Mode Action Buttons
Form submissions must leverage standard action buttons (`@/components/ui/create-user-button`) to reflect accurate status transitions without layout shifts:
* **Async States**: Supports `'idle' | 'loading' | 'success' | 'error'`.
* **Action Modes**: Configurable via `mode` prop (`'create' | 'edit' | 'delete' | 'reset'`).
* **Text Customization**: Pass explicit `loadingText`, `successText`, and `errorText` when using the component for non-user resources (e.g., Clients):
```tsx
<CreateUserButton
  type="submit"
  disabled={form.formState.isSubmitting || isSubmitting}
  size="lg"
  className="flex-1"
  asyncState={
    isSubmitting ? 'loading' : 
    isSuccess ? 'success' : 
    submitError ? 'error' : 
    'idle'
  }
  mode={isEditMode ? 'edit' : 'create'}
  loadingText={isEditMode ? "Updating client..." : "Creating client..."}
  successText={isEditMode ? "Client updated successfully!" : "Client created successfully!"}
  errorText={submitError || "Operation failed"}
>
  {isEditMode ? "Update Client" : "Add Client"}
</CreateUserButton>
```

### 4.2 Framer Motion Form Alerts
Always wrap server or transaction errors inside a smooth Framer Motion container to prevent jarring layout shifts:
```tsx
<AnimatePresence>
  {submitError && (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-0 mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/20 overflow-hidden"
    >
      <p className="text-sm text-destructive font-medium">{submitError}</p>
    </motion.div>
  )}
</AnimatePresence>
```

---

257: ## 5. Client-Side Cache Invalidation Flow
258: On any successful write operation (`create`/`edit`/`delete`), follow this systematic invalidation sequence to prevent showing stale cached data to the user:
259: 1. **Server-Side Cache Clearance**: Await a server invalidation call to clear backend or Redis keys first.
260: 2. **Client-Side Cache Invalidation**: Invalidate relevant tRPC queries (e.g., list queries, metrics queries) so that table lists update instantly.
261: 3. **Background Prefetch**: Eagerly prefetch fresh dashboard data (or high-traffic route cache chunks) in a non-blocking background promise to eliminate post-navigation loading spinners.

---

## 6. Standard Modal Dialog & Primary Action Button System (`design.md`)

All page implementations across SuperAdmin (`/superadmin/*`) and Tenants (`/admin/*`, `/moderator/*`) must adhere to standard UI components defined in `design.md`:

1. **Standard Form Input System (`<FormInput>`)**:
   - Component: `@/components/ui/form-input`
   - Features: Standard label `text-[13px] font-medium mb-1.5`, input height `h-[38px] rounded-[12px] text-[14px]`, focus transition `border-brand-primary ring-[3px] ring-brand-primary/10`, error text `text-[12px] text-red-500`, and row spacing `gap-3.5` / `space-y-3.5`.

2. **Standard Reusable Modal Dialog (`<ModalDialog>`)**:
   - Component: `@/components/ui/modal-dialog`
   - Features: Lighter gray sticky compact header (`bg-slate-50/95 dark:bg-[#121B22]/95 sticky top-0 z-20 px-5 py-2.5`), header top-right close (X) button with red-orange hover (`hover:bg-[#EA580C] hover:text-white`), compact body padding (`py-2.5 px-5 space-y-3`), clean text-only inputs without prefix icons, and sticky footer with right-aligned natural-width button (`w-full sm:w-auto px-6 flex justify-end`).

3. **Universal Reusable Modal Async Button (`<ModalAsyncButton>` / `<CreateUserButton>`)**:
   - Component: `@/components/ui/create-user-button`
   - **Validating / Processing State (All Modes & Login)**: Neutral Slate `bg-[#6D7684]` with processing spinner.
   - **Success State (All Modes & Login)**: Vivid Emerald Green `bg-[#18AE50]` with animated CheckCircle / X icon.
   - **Primary Mode (`variant="primary"` / `mode="create"`)**: Indigo `bg-[#635BFF]` (hover `bg-[#5249ea]`).
   - **Secondary Mode (`variant="secondary"` / `mode="edit"`)**: Purple `bg-[#7C007C]` (hover darker Purple `bg-[#600060]`).
   - **Danger Mode (`variant="danger"` / `mode="delete"`)**: Red-Orange `bg-[#EA580C]` (hover darker Red-Orange `bg-[#C2410C]`).

4. **Standard Dropdown Combobox (`<Combobox>`)**:
   - Component: `@/components/ui/combobox`
   - Usage: All select dropdowns, filter controls, and form select fields must use `<Combobox>` for unified dropdown popovers, searchability, and theme styling.
