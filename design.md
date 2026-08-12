# PayFix Platform Design & UI Component Standards

## 1. Action Buttons Standard
- **Primary Action Buttons**:
  - All primary creation/action buttons across SuperAdmin pages (`/superadmin/tenants`, `/superadmin/plans`) and all tenant-level pages (`/admin/*`, `/moderator/*`, `/employee/*`) must use the standard `<CreateUserButton>` component (`@/components/ui/create-user-button`).
  - **Color & Style**: Deep purple/indigo gradient (`bg-blue-600` / `bg-purple-600` / `#635BFF` theme) matching the platform's primary action system.

## 2. Standardized Modal Dialog Component (`<ModalDialog>`)
All modal dialog popups throughout the PayFix application must use the central reusable `<ModalDialog>` component (`@/components/ui/modal-dialog`).

### Core Rules for Modal Dialogs:
1. **No Backdrop Blur / Crisp Clear Background**:
   - `overlayClassName="bg-transparent pointer-events-none"`
   - The background page must remain 100% sharp, clear, and visible when the modal dialog is active. No dark overlay or blur filter screen is allowed.

2. **Non-Dismissible Modal Area**:
   - Clicks outside the modal dialog box or pressing the `Escape` key will NOT dismiss the dialog.
   - The dialog can only be closed via the top-right close (X) button or after completing the async save workflow.

3. **Windows-Style Close (X) Hover Effect**:
   - The top-right close icon (X) must display a Windows close hover effect:
     - On hover: background turns red-orange (`hover:bg-[#E81123]`) and icon turns white (`text-white`).

4. **Async Save Button with Success State**:
   - The modal footer features a full-width async Save button (`CreateUserButton`).
   - When saving:
     1. `asyncState="loading"`: shows loading spinner and text `"Updating..."` / `"Saving..."`.
     2. `asyncState="success"`: button turns emerald green (`bg-[#02A88E]` / `bg-emerald-600`) with text `"Update Successful!!"` (or custom success text).
     3. Simultaneously, a Sonner toast notification appears.
     4. A **2-second delay** allows the user to see the green success state before the modal automatically closes and page data refreshes.

### Reusable `<ModalDialog>` Usage Example:
```tsx
import ModalDialog from "@/components/ui/modal-dialog";
import { useState } from "react";
import { AsyncState } from "@/components/ui/create-user-button";

export function ExampleFeatureModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [asyncState, setAsyncState] = useState<AsyncState>('idle');

  const handleSave = async () => {
    setAsyncState('loading');
    try {
      await apiMutation.mutateAsync({...});
      toast.success("Saved successfully!");
      setAsyncState('success'); // Displays green success state on button
      await new Promise(r => setTimeout(r, 2000)); // 2-second success visibility delay
      setIsOpen(false);
      setAsyncState('idle');
    } catch (err) {
      setAsyncState('error');
      setTimeout(() => setAsyncState('idle'), 3000);
    }
  };

  return (
    <ModalDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      title="Edit Feature"
      description="Update feature details for this tenant."
      icon={<Users className="w-5 h-5 text-[#635BFF]" />}
      asyncState={asyncState}
      onSave={handleSave}
    >
      {/* Form Content */}
    </ModalDialog>
  );
}
```
