"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { X } from 'lucide-react';
import ModalAsyncButton, { AsyncState, ButtonMode, AsyncVariant } from '@/components/ui/create-user-button';
import { cn } from '@/lib/utils';

export interface ModalDialogProps {
  /** Controls modal visibility */
  open: boolean;
  /** Modal open state change handler */
  onOpenChange: (open: boolean) => void;
  /** Modal header title */
  title: React.ReactNode;
  /** Optional subtitle or description text (deprecated: subheadings removed per design standard) */
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
  buttonVariant?: AsyncVariant;
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
 * 3. Light Gray Modal Header Background
 * 4. Header Top-Right Close (X) button with Red-Orange hover effect (hover:bg-[#EA580C] hover:text-white)
 * 5. Sticky Header with reduced height & no subheadings
 * 6. Reduced content top spacing
 * 7. Universal 3-Mode Async Action Button in footer (primary | secondary | danger)
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
  buttonVariant,
  onSave,
  showSaveButton = true,
  isSaving = false,
  maxWidth = "sm:max-w-[480px]",
  footer,
  className,
}: ModalDialogProps) {
  const currentAsyncState: AsyncState = isSaving ? 'loading' : asyncState;
  const effectiveVariant = buttonVariant || (buttonMode === 'create' ? 'primary' : buttonMode === 'delete' ? 'danger' : 'secondary');

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
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className={cn(
          maxWidth,
          "p-0 overflow-hidden bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 pointer-events-auto flex flex-col max-h-[85vh]",
          className
        )}
      >
        {/* Sticky Compact Header - Lighter Gray Background with Top Right Close (X) */}
        <DialogHeader className="sticky top-0 z-20 px-5 py-2.5 bg-slate-50/95 dark:bg-[#121B22]/95 backdrop-blur-md border-b border-slate-100 dark:border-slate-800/80 text-left shrink-0 flex flex-row items-center justify-between">
          <DialogTitle className="text-[15px] sm:text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{title}</span>
          </DialogTitle>
          <DialogClose
            disabled={currentAsyncState === 'loading' || currentAsyncState === 'success'}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-white hover:bg-[#EA580C] transition-colors focus:outline-none cursor-pointer shrink-0 disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </DialogClose>
        </DialogHeader>

        {/* Scrollable Content Body with Reduced Top and Bottom Padding */}
        <div className="flex-1 overflow-y-auto px-5 py-2.5 space-y-3">
          {children}
        </div>

        {/* Sticky Footer with Right-Aligned Natural-Width Button */}
        {footer ? (
          <div className="sticky bottom-0 z-20 px-5 py-2.5 bg-slate-50/95 dark:bg-[#121B22]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80 shrink-0">
            {footer}
          </div>
        ) : showSaveButton ? (
          <DialogFooter className="sticky bottom-0 z-20 px-5 py-2.5 bg-slate-50/95 dark:bg-[#121B22]/95 backdrop-blur-md border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end shrink-0">
            <ModalAsyncButton
              mode={buttonMode}
              variant={effectiveVariant}
              size="md"
              className="w-full sm:w-auto px-6"
              asyncState={currentAsyncState}
              loadingText={loadingText}
              successText={successText}
              errorText={errorText}
              onClick={onSave}
            >
              {saveText}
            </ModalAsyncButton>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

