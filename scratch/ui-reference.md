# UI/UX Reference Guide for Service Desk Modules

When adding or refactoring forms inside sheets (like clients, tickets, complaints), ALWAYS enforce the following formatting patterns to match `ModernAddUserForm.tsx` and `modern-add-user-form-content.tsx`.

## 1. Sheet Wrapper and Header Formatting
Do **not** use `p-0` on `SheetContent`. The exact wrappers must look like this:

```tsx
<Sheet open={isOpen} onOpenChange={handleOpenChange}>
  <SheetContent className="w-full sm:max-w-2xl flex flex-col">
    <div className="flex-shrink-0 px-4 sm:px-6 border-b border-border/80 pb-3">
      <SheetHeader className="text-left pb-0">
        <SheetTitle className="flex items-center gap-3 text-xl font-bold py-1">
          <div className={cn(
            "p-2 rounded-lg",
            isEditMode ? "bg-purple-100" : "bg-blue-100"
          )}>
            <FormIcon className={cn(
              "h-6 w-6",
              isEditMode ? "text-purple-600" : "text-blue-600"
            )} />
          </div>
          <div className="flex flex-col">
            <span className={cn(
              "leading-tight",
              isEditMode ? "text-purple-700" : "text-blue-700"
            )}>{dynamicTitle}</span>
            <span className="text-xs font-medium text-muted-foreground mt-0 leading-tight">
              {dynamicDescription}
            </span>
          </div>
        </SheetTitle>
      </SheetHeader>
    </div>
    
    <div className="flex-1 overflow-y-auto mt-0">
      <div className="px-4 sm:px-6 lg:px-6 pb-4 pt-4 space-y-6">
        {/* Card and Form content go here */}
      </div>
    </div>
  </SheetContent>
</Sheet>
```

## 2. Form Container and Accordions Structural Pattern
Always use an outer `<Card>` configuration for the form, and use **separate `<Accordion>` wrappers** for each section rather than nesting multiple `<AccordionItem>` elements inside a single `<Accordion>`. The `space-y-6` utility on the `<form>` will automatically handle the top and bottom margins between these accordion sections. Additionally, use `border-b-0` on `<AccordionItem>` and `rounded-t-lg` on `<AccordionTrigger>` to ensure clean, detached-card aesthetics.

```tsx
<div className="px-4 sm:px-6 lg:px-6 pb-4 pt-4 space-y-6">
  <Card className="w-full max-w-2xl mx-auto bg-white shadow-lg border-2 border-border/60 rounded-lg">
    <CardContent className="p-4">
      <form onSubmit={handleFormSubmit} className="space-y-6" noValidate>
        
        {/* Section 1 */}
        <Accordion type="multiple" defaultValue={["section-1"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
          <AccordionItem value="section-1" className="border-b-0">
            <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-blue-50 hover:bg-blue-100">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <span className="font-medium text-blue-900">Primary Information</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
              {/* Form fields */}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Section 2 */}
        <Accordion type="multiple" defaultValue={["section-2"]} className="bg-white/80 backdrop-blur-sm rounded-lg border">
          <AccordionItem value="section-2" className="border-b-0">
             <AccordionTrigger className="px-4 py-3 rounded-t-lg hover:no-underline transition-colors bg-blue-50 hover:bg-blue-100">
               {/* Trigger content */}
             </AccordionTrigger>
             <AccordionContent className="px-4 pb-4 pt-4 space-y-4 bg-white/80">
               {/* Form fields */}
             </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="flex gap-4 pt-2 mt-8">
          {/* Submit and Cancel Buttons */}
        </div>
      </form>
    </CardContent>
  </Card>
</div>
```

## 3. Input Fields and React Hook Form
Use `react-hook-form` + `@hookform/resolvers/zod` with the `<Field>`, `<FieldLabel>`, and `<FieldError>` components:

```tsx
<Controller
  name="field_name"
  control={form.control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="field_name">Input Label {required && "*"}</FieldLabel>
      <Input 
        id="field_name" 
        className={cn("rounded-xl", fieldState.invalid && "border-destructive")} 
        {...field} 
        value={field.value || ""} 
      />
      {fieldState.invalid && fieldState.error && (
        <FieldError errors={[fieldState.error]} className="mt-1" />
      )}
    </Field>
  )}
/>
```

## 4. Submit Buttons
Use `CreateUserButton` and `CancelButton`:

```tsx
<div className="flex gap-4 pt-6 mt-6 border-t border-border/20">
  <CancelButton onClick={onCancel} disabled={isSaving} size="lg" className="flex-1">
    Cancel
  </CancelButton>
  <CreateUserButton
    type="submit"
    disabled={form.formState.isSubmitting || isSaving}
    size="lg"
    className="flex-1"
    asyncState={
      isSaving ? 'loading' : 
      isSuccess ? 'success' : 
      isError ? 'error' : 
      'idle'
    }
    mode={isEditMode ? 'edit' : 'create'}
  >
    {isEditMode ? "Update" : "Add"}
  </CreateUserButton>
</div>
```

## 5. Zod Validation Patterns
- **Phone**: `.min(1, "Phone is required").regex(/^[0-9]{10}$/, "Phone must be exactly 10 digits")`
- **Email**: `.min(1, "Email is required").email("Invalid email address")`
- **Pincode**: `.refine(val => !val || /^[0-9]+$/.test(val), "Pincode must contain only numbers").optional()`
