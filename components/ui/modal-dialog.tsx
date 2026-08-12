"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import CreateUserButton, { AsyncState, ButtonMode } from '@/components/ui/create-user-button';
import { cn } from '@/lib/utils';

export interface ModalDialogProps {
  /** Controls modal visibility */
  open: boolean;
  /** Modal open state change handler */
  onOpenChange: (open: boolean) => void;
  /** Modal header title */
  title: React.ReactNode;
  /** Optional subtitle or description text */
  description?: React.ReactNode;
  /** Optional title icon component */
  icon?: React.ReactNode;
  /** Form or content inside modal body */
  children: React.ReactNode;

  // Save button configurations
  saveText?: string;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  asyncState?: AsyncState;
  buttonMode?: ButtonMode;
  onSave?: () => Promise<void> | void;
  showSaveButton?: boolean;
  isSaving?: boolean;

  // Custom styling & overrides
  maxWidth?: string; // e.g. "sm:max-w-[480px]"
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Standard Reusable Modal Dialog Component for PayFix Platform
 * Features:
 * 1. No Backdrop Blur / Crisp Clear Background (overlayClassName="bg-transparent pointer-events-none")
 * 2. Non-Dismissible outside click / escape key
 * 3. Windows Close (X) button hover effect (hover:bg-[#E81123] hover:text-white)
 * 4. Full-width Async Save button with 'idle' | 'loading' | 'success' | 'error' states
 */
export default function ModalDialog({
  open,
  onOpenChange,
  title,
  description,
  icon,
  children,
  saveText = "Save",
  loadingText,
  successText,
  errorText,
  asyncState = 'idle',
  buttonMode = 'edit',
  onSave,
  showSaveButton = true,
  isSaving = false,
  maxWidth = "sm:max-w-[480px]",
  footer,
  className,
}: ModalDialogProps) {
  const currentAsyncState: AsyncState = isSaving ? 'loading' : asyncState;

  return (
    <Dialog 
      open={open} 
      onOpenChange={(val) => { 
        if (!val && currentAsyncState !== 'loading' && currentAsyncState !== 'success') {
          onOpenChange(false); 
        }
      }}
    >
      <DialogContent
        overlayClassName="bg-transparent pointer-events-none"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          maxWidth,
          "p-6 bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 pointer-events-auto",
          className
        )}
      >
        <DialogHeader className="pb-4 border-b border-slate-100 dark:border-slate-800 text-left">
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            {icon}
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {children}
        </div>

        {footer ? (
          footer
        ) : showSaveButton ? (
          <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <CreateUserButton
              mode={buttonMode}
              size="md"
              className="w-full"
              asyncState={currentAsyncState}
              loadingText={loadingText}
              successText={successText}
              errorText={errorText}
              onClick={onSave}
            >
              {saveText}
            </CreateUserButton>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
