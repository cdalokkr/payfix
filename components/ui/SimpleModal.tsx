'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { AdvancedAsyncButton } from './advanced-async-button';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SimpleModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal content */
  children?: React.ReactNode;
  /** The async operation to perform when the primary action is clicked */
  onSubmit?: () => Promise<void> | void;
  /** Text for the submit button */
  submitText?: string;
  /** Text for the cancel button */
  cancelText?: string;
  /** Whether to show the cancel button */
  showCancelButton?: boolean;
  /** Loading text for the submit button */
  submitLoadingText?: string;
  /** Success text for the submit button */
  submitSuccessText?: string;
  /** Duration before auto-closing after successful submit (ms) */
  autoCloseDuration?: number;
  /** Additional CSS classes */
  className?: string;
  /** Size of the modal */
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function SimpleModal({
  isOpen,
  onOpenChange,
  title = 'Modal',
  description,
  children,
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  showCancelButton = true,
  submitLoadingText = 'Submitting...',
  submitSuccessText = 'Submitted!',
  autoCloseDuration = 1500,
  className,
  size = 'md',
}: SimpleModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setIsSuccess(false);
    }
  }, [isOpen]);

  // Auto-close modal after successful submission
  useEffect(() => {
    if (isSuccess) {
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, autoCloseDuration);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, autoCloseDuration, onOpenChange]);

  const handleSubmit = async () => {
    if (!onSubmit || isSubmitting) return;

    setIsSubmitting(true);
    setIsSuccess(false);

    try {
      await onSubmit();
      setIsSuccess(true);
    } catch (error) {
      console.error('SimpleModal: Submit operation failed:', error);
      setIsSubmitting(false);
      // Don't set success state on error, let user retry
    }
  };

  const handleClose = (open: boolean) => {
    // Prevent closing during submission
    if (!open && isSubmitting) return;
    onOpenChange(open);
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={cn(
          'flex flex-col',
          sizeClasses[size],
          'max-h-[calc(100vh-2rem)]',
          className
        )}
        onInteractOutside={(e) => {
          // Prevent closing on backdrop click during submission
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        {/* Header - Fixed */}
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{title}</DialogTitle>
              {description && (
                <DialogDescription className="mt-1">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto py-4 min-h-0">
          {children}
        </div>

        {/* Footer - Fixed */}
        <DialogFooter className="flex-shrink-0 flex-col gap-2 sm:flex-row sm:justify-between pt-4 border-t">
          {showCancelButton && (
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {cancelText}
            </Button>
          )}
          
          {onSubmit && (
            <AdvancedAsyncButton
              onClick={handleSubmit}
              loadingText={submitLoadingText}
              successText={submitSuccessText}
              successDuration={autoCloseDuration}
              disabled={isSubmitting || isSuccess}
              className="w-full sm:w-auto"
            >
              {submitText}
            </AdvancedAsyncButton>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}