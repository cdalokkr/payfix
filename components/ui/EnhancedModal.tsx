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
import { Button } from '@/components/ui/button';
import { EnhancedAsyncButton } from './EnhancedAsyncButton';
import { 
  User, 
  Settings, 
  Mail, 
  Phone, 
  Shield, 
  Edit, 
  Trash, 
  UserPlus, 
  Save,
  AlertTriangle,
  Info,
  CheckCircle,
  Clock,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ModalIconType = 
  | 'user' 
  | 'user-plus' 
  | 'edit' 
  | 'delete' 
  | 'settings' 
  | 'mail' 
  | 'phone' 
  | 'shield'
  | 'save'
  | 'alert'
  | 'info'
  | 'success'
  | 'clock';

export type ModalSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalSection {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: React.ReactNode;
  className?: string;
  hoverClassName?: string;
}

export interface EnhancedModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal open state changes */
  onOpenChange: (open: boolean) => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal icon type */
  icon?: ModalIconType;
  /** Custom icon component */
  customIcon?: React.ReactNode;
  /** Modal size */
  size?: ModalSize;
  /** Modal content */
  children?: React.ReactNode;
  /** Modal sections for structured content */
  sections?: ModalSection[];
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
  /** Animation variant */
  animation?: 'fade' | 'slide' | 'zoom' | 'bounce';
  /** Whether to show header icon with animation */
  showAnimatedIcon?: boolean;
  /** Custom actions in addition to submit/cancel */
  customActions?: React.ReactNode[];
  /** Custom content for the submit button (can include icons) */
  submitButtonContent?: React.ReactNode;
  /** Whether to place buttons at bottom of content instead of fixed footer */
  buttonsInContent?: boolean;
  /** Whether to show the default dialog close button (radix default) */
  showDefaultCloseButton?: boolean;
  /** Additional props to pass to the submit button */
  submitButtonProps?: Partial<import('./EnhancedAsyncButton').EnhancedAsyncButtonProps>;
}

export function EnhancedModal({
  isOpen,
  onOpenChange,
  title = 'Modal',
  description,
  icon,
  customIcon,
  size = 'md',
  children,
  sections = [],
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  showCancelButton = true,
  submitLoadingText = 'Processing...',
  submitSuccessText = 'Success!',
  autoCloseDuration = 2000,
  className,
  animation = 'zoom',
  showAnimatedIcon = true,
  customActions = [],
  submitButtonContent,
  buttonsInContent = false,
  showDefaultCloseButton = false,
  submitButtonProps = {},
}: EnhancedModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [animationClass, setAnimationClass] = useState('');

  // Default icon mapping
  const getIconComponent = (iconType: ModalIconType): React.ReactNode => {
    const iconProps = { 
      className: "h-5 w-5" 
    };

    switch (iconType) {
      case 'user':
        return <User {...iconProps} />;
      case 'user-plus':
        return <UserPlus {...iconProps} />;
      case 'edit':
        return <Edit {...iconProps} />;
      case 'delete':
        return <Trash {...iconProps} />;
      case 'settings':
        return <Settings {...iconProps} />;
      case 'mail':
        return <Mail {...iconProps} />;
      case 'phone':
        return <Phone {...iconProps} />;
      case 'shield':
        return <Shield {...iconProps} />;
      case 'save':
        return <Save {...iconProps} />;
      case 'alert':
        return <AlertTriangle {...iconProps} />;
      case 'info':
        return <Info {...iconProps} />;
      case 'success':
        return <CheckCircle {...iconProps} />;
      case 'clock':
        return <Clock {...iconProps} />;
      default:
        return <Info {...iconProps} />;
    }
  };

  // Initialize sections state
  useEffect(() => {
    if (sections.length > 0) {
      const defaultOpen = sections
        .filter(section => section.defaultOpen !== false)
        .map(section => section.id);
      setOpenSections(new Set(defaultOpen));
    }
  }, [sections]);

  // Animation effects
  useEffect(() => {
    if (isOpen) {
      switch (animation) {
        case 'fade':
          setAnimationClass('animate-in fade-in-0 duration-300');
          break;
        case 'slide':
          setAnimationClass('animate-in slide-in-from-bottom-4 duration-300');
          break;
        case 'zoom':
          setAnimationClass('animate-in zoom-in-95 duration-300');
          break;
        case 'bounce':
          setAnimationClass('animate-in bounce-in duration-500');
          break;
      }
    }
  }, [isOpen, animation]);

  // Reset states when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setIsSuccess(false);
      // Reset sections to default state
      if (sections.length > 0) {
        const defaultOpen = sections
          .filter(section => section.defaultOpen !== false)
          .map(section => section.id);
        setOpenSections(new Set(defaultOpen));
      }
    }
  }, [isOpen, sections]);

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
      console.error('Enhanced Modal: Submit operation failed:', error);
      setIsSubmitting(false);
      // Don't set success state on error, let user retry
    }
  };

  const handleClose = (open: boolean) => {
    // Prevent closing during submission
    if (!open && isSubmitting) return;
    onOpenChange(open);
  };

  const toggleSection = (sectionId: string) => {
    const newOpenSections = new Set(openSections);
    if (newOpenSections.has(sectionId)) {
      newOpenSections.delete(sectionId);
    } else {
      newOpenSections.add(sectionId);
    }
    setOpenSections(newOpenSections);
  };

  // Size classes
  const sizeClasses = {
    xs: 'max-w-xs',
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-7xl w-[98vw]',
    full: 'max-w-[95vw] max-h-[95vh]',
  };

  // Animation classes for icon
  const iconAnimation = showAnimatedIcon ? 'animate-pulse' : '';

  const iconComponent = customIcon || (icon ? getIconComponent(icon) : null);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton={showDefaultCloseButton}
        className={cn(
          'flex flex-col transition-all duration-300',
          sizeClasses[size],
          'max-h-[calc(100vh-2rem)]',
          'data-[state=open]:animate-in',
          animationClass,
          className
        )}
        onInteractOutside={(e) => {
          if (isSubmitting) {
            e.preventDefault();
          }
        }}
      >
        {/* Enhanced Header */}
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {iconComponent && (
                <div className={cn(
                  'p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0 mt-1',
                  iconAnimation
                )}>
                  {iconComponent}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-xl font-semibold text-left">
                  {title}
                </DialogTitle>
                {description && (
                  <DialogDescription className="mt-2 text-left">
                    {description}
                  </DialogDescription>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="h-6 w-6 -mt-1 -mr-2 flex-shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Structured Sections or Content */}
        <div className="flex-1 overflow-y-auto py-4 pr-4 min-h-0">
          {sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((section) => {
                const isOpen = openSections.has(section.id);
                
                // Dynamic corner classes based on section state
                const getCornerClasses = () => {
                  if (isOpen && section.collapsible) {
                    // Expanded: rounded top corners, sharp bottom corners
                    return 'rounded-t-lg rounded-b-none';
                  } else {
                    // Collapsed: all corners rounded
                    return 'rounded-lg';
                  }
                };
                
                return (
                  <div
                    key={section.id}
                    className={cn(
                      'border bg-background/50 backdrop-blur-sm',
                      getCornerClasses(),
                      // Apply section-specific styling
                      section.className?.includes('border-') ? '' : 'border-border'
                    )}
                  >
                    <button
                      onClick={() => section.collapsible && toggleSection(section.id)}
                      className={cn(
                        'w-full flex items-center justify-between p-4 text-left transition-all duration-300',
                        section.collapsible && 'cursor-pointer',
                        section.className,
                        section.hoverClassName || 'hover:bg-muted/50',
                        // Ensure button has same corner styling
                        getCornerClasses(),
                        // Top corners should match container
                        isOpen && section.collapsible ? 'rounded-t-lg' : 'rounded-lg',
                        // Remove bottom rounding when expanded to avoid double rounding
                        isOpen && section.collapsible ? 'rounded-b-none' : ''
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {section.icon && (
                          <div className="text-muted-foreground">
                            {section.icon}
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-sm text-foreground">{section.title}</h3>
                          {section.description && (
                            <p className="text-sm text-muted-foreground dark:text-muted-foreground/80 mt-1">
                              {section.description}
                            </p>
                          )}
                        </div>
                      </div>
                      {section.collapsible && (
                        <div className="text-muted-foreground">
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      )}
                    </button>
                    {(section.collapsible ? isOpen : true) && section.children && (
                      <div className={cn(
                        'p-4 pt-0',
                        // Apply section border color to the content area border
                        section.className?.includes('border-')
                          ? `border-t ${section.className.match(/border-[^\\s]+/)?.[0] || 'border-border'}`
                          : 'border-t border-border'
                      )}>
                        <div className="pt-4">
                          {section.children}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            children
          )}
          
          {/* Action Buttons in Content Area */}
          {buttonsInContent && (onSubmit || showCancelButton) && (
            <div className="flex flex-col sm:flex-row gap-3 pt-8 mt-8 border-t pb-4 mr-4">
              {/* Custom Actions */}
              {customActions.length > 0 && (
                <div className="flex flex-wrap gap-2 w-full">
                  {customActions}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
                {showCancelButton && (
                  <Button
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    {cancelText}
                  </Button>
                )}
                
                {onSubmit && (
                  <EnhancedAsyncButton
                    onClick={handleSubmit}
                    loadingText={submitLoadingText}
                    successText={submitSuccessText}
                    successDuration={autoCloseDuration}
                    disabled={isSubmitting || isSuccess}
                    variant={showCancelButton ? 'default' : 'destructive'}
                    className="w-full sm:w-auto order-1 sm:order-2"
                    stateClasses={{
                      success: 'animate-pulse',
                    }}
                    {...submitButtonProps}
                  >
                    {submitButtonContent || submitText}
                  </EnhancedAsyncButton>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Footer - only show if buttonsInContent is false */}
        {!buttonsInContent && (
          <DialogFooter className="flex-shrink-0 flex-col gap-3 pt-8 border-t">
            {/* Custom Actions */}
            {customActions.length > 0 && (
              <div className="flex flex-wrap gap-2 w-full">
                {customActions}
              </div>
            )}
            
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:justify-end">
              {showCancelButton && (
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  {cancelText}
                </Button>
              )}
              
              {onSubmit && (
                <EnhancedAsyncButton
                  onClick={handleSubmit}
                  loadingText={submitLoadingText}
                  successText={submitSuccessText}
                  successDuration={autoCloseDuration}
                  disabled={isSubmitting || isSuccess}
                  variant={showCancelButton ? 'default' : 'destructive'}
                  className="w-full sm:w-auto order-1 sm:order-2"
                  stateClasses={{
                    success: 'animate-pulse',
                  }}
                  {...submitButtonProps}
                >
                  {submitButtonContent || submitText}
                </EnhancedAsyncButton>
              )}
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Pre-configured modal variants
export function ProfileEditModal({ onSubmit, ...props }: Omit<EnhancedModalProps, 'icon' | 'title' | 'description'>) {
  return (
    <EnhancedModal
      icon="edit"
      title="Edit Profile"
      description="Update your profile information and preferences"
      {...props}
      onSubmit={onSubmit}
    />
  );
}

export function SettingsModal({ onSubmit, ...props }: Omit<EnhancedModalProps, 'icon' | 'title' | 'description'>) {
  return (
    <EnhancedModal
      icon="settings"
      title="Settings"
      description="Configure your application preferences and settings"
      size="lg"
      {...props}
      onSubmit={onSubmit}
    />
  );
}

export function DeleteConfirmationModal({ 
  itemName, 
  onSubmit, 
  ...props 
}: Omit<EnhancedModalProps, 'icon' | 'title' | 'description'> & { itemName: string }) {
  return (
    <EnhancedModal
      icon="delete"
      title="Delete Confirmation"
      description={`Are you sure you want to delete ${itemName}? This action cannot be undone.`}
      size="sm"
      submitText="Delete"
      submitLoadingText="Deleting..."
      submitSuccessText="Deleted!"
      showCancelButton={true}
      {...props}
      onSubmit={onSubmit}
    />
  );
}

export function NotificationModal({ 
  title = "Notification",
  description,
  onClose,
  ...props 
}: Omit<EnhancedModalProps, 'icon' | 'onSubmit' | 'showCancelButton'> & {
  onClose?: () => void;
}) {
  return (
    <EnhancedModal
      icon="info"
      title={title}
      description={description}
      size="sm"
      showCancelButton={false}
      customActions={[
        <Button
          key="close"
          onClick={() => onClose?.() || props.onOpenChange?.(false)}
          className="w-full"
        >
          Close
        </Button>
      ]}
      {...props}
    />
  );
}