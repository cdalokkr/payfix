# ActionButton Component - Complete Implementation Guide

## Overview

The **ActionButton** is a comprehensive, reusable button component designed to provide consistent styling, animations, and accessibility across the application. It replaces scattered button implementations with a unified approach that supports all common action types with proper TypeScript interfaces and extensive customization options.

## 🎯 Key Features

### ✅ **Comprehensive Action Support**
- **Edit buttons**: Blue theme with smooth hover transitions
- **Save buttons**: Green theme with success feedback
- **Delete buttons**: Red theme with destructive styling
- **Cancel buttons**: Gray theme for neutral actions
- **Add buttons**: Purple theme for creation actions
- **View buttons**: Indigo theme for viewing actions
- **Settings buttons**: Gray theme for configuration actions

### ✅ **Advanced Animations**
- **Micro-interactions**: 1.05x scale on hover (200ms duration)
- **Icon animations**: 5° rotation and 1.1x scale on hover
- **Shadow elevation**: Dynamic shadow changes on interaction
- **Press feedback**: 0.95x scale on tap (100ms duration)
- **Loading states**: Smooth opacity and scale transitions
- **Color transitions**: All themes include smooth color changes

### ✅ **Accessibility Excellence**
- **ARIA labels**: Automatic generation for icon-only variants
- **Keyboard navigation**: Full keyboard support with Enter/Space activation
- **Screen reader support**: Comprehensive role and state announcements
- **Focus management**: Visible focus rings and logical tab order
- **High contrast**: Maintains accessibility standards across all themes

### ✅ **Flexible Variants**
- **Button variants**: Full text + icon or icon-only configurations
- **Size options**: Small, medium, and large variants
- **Loading states**: Built-in loading indicators with custom text
- **Disabled states**: Proper disabled styling and behavior
- **Custom icons**: Support for custom icon components
- **ClassName inheritance**: Easy styling overrides

## 📦 Component Structure

### File: `components/ui/action-button.tsx`

The main component file contains:

1. **Core ActionButton Component** - Main reusable component
2. **Convenience Components** - Pre-configured variants for each action type
3. **TypeScript Interfaces** - Comprehensive type definitions
4. **Animation System** - Framer Motion-based animations
5. **Theme System** - Consistent styling across all action types

### File: `components/ui/action-button-examples.tsx`

Comprehensive examples and demo component showing:
- All action button variants
- Size and state variations
- Real-world usage examples
- Accessibility demonstrations
- Animation showcases

## 🚀 Quick Start

### Basic Usage

```tsx
import { EditButton, SaveButton, DeleteButton, AddButton } from '@/components/ui/action-button'

// Basic usage
<EditButton onClick={handleEdit}>Edit</EditButton>
<SaveButton onClick={handleSave} loading={isSaving}>Save</SaveButton>
<DeleteButton onClick={handleDelete} className="w-full">Delete</DeleteButton>

// Icon-only variants
<EditButton variant="icon-only" onClick={handleEdit} aria-label="Edit user" />
<AddButton variant="icon-only" size="lg" onClick={handleAdd} aria-label="Add new item" />

// With custom loading states
<SaveButton 
  onClick={handleSave}
  loading={isSaving}
  loadingText="Saving..." 
  successText="Saved!" 
  errorText="Save failed"
>
  Save Changes
</SaveButton>
```

### Advanced Usage

```tsx
import { ActionButton } from '@/components/ui/action-button'
import { CustomIcon } from '@/icons'

// With custom icon
<ActionButton
  action="edit"
  icon={CustomIcon}
  size="lg"
  className="w-full"
  onClick={handleCustomAction}
  aria-label="Custom action"
>
  Custom Action
</ActionButton>

// With state management
const [loadingState, setLoadingState] = useState(false)

const handleAsyncAction = async () => {
  setLoadingState(true)
  try {
    await performAsyncOperation()
    toast.success('Operation completed!')
  } catch (error) {
    toast.error('Operation failed!')
  } finally {
    setLoadingState(false)
  }
}

<SaveButton 
  onClick={handleAsyncAction}
  loading={loadingState}
>
  Save
</SaveButton>
```

## 🎨 Design System Integration

### Theme Mapping

| Action Type | Color Scheme | Hover Colors | Icon Colors | Use Case |
|------------|-------------|-------------|-------------|----------|
| `edit` | Blue (`bg-blue-50`) | Blue (`hover:bg-blue-100`) | Blue (`text-blue-600`) | Edit operations, modifications |
| `save` | Green (`bg-green-50`) | Green (`hover:bg-green-100`) | Green (`text-green-600`) | Save operations, confirmations |
| `cancel` | Red (`bg-red-50`) | Red (`hover:bg-red-100`) | Red (`text-red-600`) | Cancel operations, abort actions |
| `delete` | Red (`bg-red-50`) | Red (`hover:bg-red-100`) | Red (`text-red-600`) | Delete operations, destructive actions |
| `add` | Purple (`bg-purple-50`) | Purple (`hover:bg-purple-100`) | Purple (`text-purple-600`) | Add operations, creation actions |
| `view` | Indigo (`bg-indigo-50`) | Indigo (`hover:bg-indigo-100`) | Indigo (`text-indigo-600`) | View operations, read-only actions |
| `settings` | Gray (`bg-gray-50`) | Gray (`hover:bg-gray-100`) | Gray (`text-gray-600`) | Settings, configuration actions |

### Animation Specifications

```typescript
const buttonVariants = {
  initial: { 
    scale: 1,
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
  },
  hover: { 
    scale: 1.05,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    transition: { duration: 0.2, ease: 'easeOut' }
  },
  tap: { 
    scale: 0.95,
    transition: { duration: 0.1, ease: 'easeInOut' }
  },
  loading: {
    scale: 0.95,
    opacity: 0.8,
    transition: { duration: 0.2, ease: 'easeOut' }
  }
}
```

## 🔧 Props Interface

### ActionButtonProps

```typescript
export interface ActionButtonProps {
  // Required
  action: 'edit' | 'save' | 'cancel' | 'delete' | 'add' | 'view' | 'settings'
  
  // Optional variants
  variant?: 'button' | 'icon-only'        // Button style variant
  size?: 'sm' | 'md' | 'lg'               // Size option
  loading?: boolean                       // Loading state
  disabled?: boolean                      // Disabled state
  
  // Content options
  icon?: React.ComponentType<any>         // Custom icon component
  children?: React.ReactNode              // Button text
  
  // Event handlers
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void
  
  // Styling
  className?: string                      // Additional CSS classes
  'aria-label'?: string                  // Accessibility label
  'data-testid'?: string                 // Test identifier
  
  // Standard HTML button props
  ...React.ComponentProps<"button">
}
```

### Convenience Components

Each action type has a pre-configured convenience component:

```typescript
// All available convenience components
<EditButton     {...props} />  // action="edit"
<SaveButton     {...props} />  // action="save"
<CancelButton   {...props} />  // action="cancel"
<DeleteButton   {...props} />  // action="delete"
<AddButton      {...props} />  // action="add"
<ViewButton     {...props} />  // action="view"
<SettingsButton {...props} />  // action="settings"
```

## 🛠 Migration Guide

### From Existing Button Patterns

#### Before (Current Pattern):
```tsx
// Old user management buttons
<Button
  variant="outline"
  size="sm"
  className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200 hover:border-blue-300 min-w-[90px] justify-center text-center"
  onClick={() => handleEditUser(user)}
  aria-label={`Edit user ${user.email}`}
>
  <Edit className="h-4 w-4 mr-1" aria-hidden="true" />
  Edit
</Button>

<Button
  variant="outline"
  size="sm"
  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200 hover:border-red-300 min-w-[90px] justify-center text-center"
  onClick={() => setDeleteUserId(user.id)}
  aria-label={`Delete user ${user.email}`}
>
  <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
  Delete
</Button>
```

#### After (ActionButton Pattern):
```tsx
// New ActionButton implementation
<EditButton
  size="sm"
  onClick={() => handleEditUser(user)}
  aria-label={`Edit user ${user.email}`}
>
  Edit
</EditButton>

<DeleteButton
  size="sm"
  onClick={() => setDeleteUserId(user.id)}
  aria-label={`Delete user ${user.email}`}
>
  Delete
</DeleteButton>
```

### Migration Benefits

1. **Consistency**: All buttons follow the same design system
2. **Maintainability**: Single component to update instead of scattered patterns
3. **Accessibility**: Built-in ARIA support and keyboard navigation
4. **Animations**: Smooth micro-interactions enhance user experience
5. **Type Safety**: Full TypeScript support with comprehensive interfaces
6. **Performance**: Optimized animations with Framer Motion

## 🔍 Integration Examples

### User Management Integration

```tsx
// Update user-management.tsx to use ActionButton
import { 
  ActionButton,
  EditButton, 
  SaveButton, 
  CancelButton, 
  DeleteButton 
} from '@/components/ui/action-button'

// In the table row actions section:
<TableCell>
  <div className="flex gap-2">
    {editingUserId === user.id ? (
      <>
        <SaveButton
          size="sm"
          onClick={handleUpdateUser}
          loading={updateProfileMutation.isPending}
          aria-label="Save user changes"
          className="min-w-[90px]"
        >
          Save
        </SaveButton>
        <CancelButton
          size="sm"
          onClick={handleCancelEdit}
          aria-label="Cancel editing user"
          className="min-w-[90px]"
        >
          Cancel
        </CancelButton>
      </>
    ) : (
      <>
        <EditButton
          variant="outline"
          size="sm"
          onClick={() => handleEditUser(user)}
          aria-label={`Edit user ${user.email}`}
          className="min-w-[90px]"
        >
          Edit
        </EditButton>
        <DeleteButton
          variant="outline"
          size="sm"
          onClick={() => setDeleteUserId(user.id)}
          aria-label={`Delete user ${user.email}`}
          className="min-w-[90px]"
        >
          Delete
        </DeleteButton>
      </>
    )}
  </div>
</TableCell>
```

### Form Actions Integration

```tsx
// Update forms to use ActionButton
import { SaveButton, CancelButton } from '@/components/ui/action-button'

// In form footer:
<div className="flex gap-4 justify-end pt-6 border-t">
  <CancelButton
    onClick={handleCancel}
    disabled={isSubmitting}
  >
    Cancel
  </CancelButton>
  <SaveButton
    onClick={handleSubmit}
    loading={isSubmitting}
    disabled={!isValid}
    className="min-w-[120px]"
  >
    {isSubmitting ? 'Saving...' : 'Save Changes'}
  </SaveButton>
</div>
```

### Dashboard Actions Integration

```tsx
// Update dashboard components to use ActionButton
import { AddButton, ViewButton, SettingsButton } from '@/components/ui/action-button'

// In dashboard header:
<div className="flex gap-4">
  <AddButton
    onClick={handleCreateUser}
    aria-label="Add new user"
  >
    Add User
  </AddButton>
  <ViewButton
    onClick={handleViewReports}
    aria-label="View reports"
  >
    Reports
  </ViewButton>
  <SettingsButton
    onClick={handleOpenSettings}
    aria-label="Settings"
  >
    Settings
  </SettingsButton>
</div>
```

## 🎯 Best Practices

### 1. Consistent Usage
- Always use the appropriate convenience component for its action type
- Maintain consistent size variants across similar components
- Use icon-only variants for dense interfaces or toolbar actions

### 2. Accessibility
- Always provide descriptive `aria-label` for icon-only variants
- Use semantic HTML and proper role attributes
- Ensure keyboard navigation works throughout the interface

### 3. Loading States
- Show loading states during async operations
- Disable buttons during loading to prevent duplicate submissions
- Provide meaningful loading text for better UX

### 4. Responsive Design
- Use appropriate sizes for mobile vs desktop
- Consider touch targets on mobile devices (minimum 44px)
- Ensure text and icons remain readable at all sizes

### 5. Error Handling
- Implement proper error boundaries around ActionButton usage
- Provide fallback states for failed operations
- Use toast notifications for success/error feedback

## 🔧 Technical Implementation

### Animation Performance
- Uses Framer Motion for hardware-accelerated animations
- Optimized for 60fps performance on all devices
- Respects `prefers-reduced-motion` for accessibility

### Bundle Size Impact
- Tree-shakeable: Only imports used action types
- Minimal footprint with no external dependencies beyond Framer Motion
- Static analysis friendly for build optimizations

### TypeScript Support
- Full type safety with comprehensive interfaces
- IntelliSense support for all props and variants
- Generic type support for custom onClick handlers

## 🚀 Performance Considerations

### Animation Performance
- Uses `transform` properties for GPU acceleration
- Avoids layout thrashing during animations
- Implements proper cleanup for animation states

### Bundle Optimization
- All convenience components are individually exportable
- Tree-shaking support for unused variants
- Minimal runtime overhead with static configurations

### Memory Management
- Proper cleanup of animation instances
- Efficient event listener management
- No memory leaks in component unmounting

## 📋 Testing Strategy

### Unit Testing
```tsx
// Example test file
import { render, screen, fireEvent } from '@testing-library/react'
import { EditButton } from '@/components/ui/action-button'

describe('EditButton', () => {
  it('renders with correct text', () => {
    render(<EditButton>Edit</EditButton>)
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<EditButton onClick={handleClick}>Edit</EditButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('shows loading state correctly', () => {
    render(<EditButton loading>Edit</EditButton>)
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })
})
```

### Integration Testing
- Test with real async operations
- Verify keyboard navigation flow
- Validate accessibility compliance

### Visual Testing
- Screenshot testing for all variants
- Animation verification
- Responsive behavior testing

## 📝 Future Enhancements

### Planned Features
1. **Custom Themes**: Support for custom color schemes
2. **Icon Library Integration**: Built-in icon mapping
3. **Tooltip Integration**: Automatic tooltip generation
4. **Batch Operations**: Support for multi-select operations
5. **Keyboard Shortcuts**: Built-in hotkey support

### Performance Improvements
1. **Animation Optimization**: Further animation performance gains
2. **Bundle Splitting**: Dynamic imports for unused variants
3. **Memory Optimization**: Reduced memory footprint
4. **SSR Support**: Server-side rendering compatibility

## 🔗 Related Components

- **Button**: Base button component that ActionButton builds upon
- **IconButton**: Icon-only variant for dense interfaces
- **AsyncButton**: For async operations with success/error states
- **LoadingSpinner**: Loading indicator component
- **Toast**: Success/error feedback component

---

## 📞 Support and Contribution

For questions, issues, or contributions to the ActionButton component:

1. **Documentation**: Check this guide for common usage patterns
2. **Examples**: Review `action-button-examples.tsx` for implementation examples
3. **TypeScript**: Ensure proper typing by importing from the correct module
4. **Performance**: Monitor animation performance on target devices

The ActionButton component represents a significant step forward in creating a consistent, accessible, and performant button system throughout the application.