# Advanced Async Button Component

A feature-rich, accessible async button component with smooth motion effects, comprehensive state management, and extensive customization options.

## Features

### ✨ **Smooth Motion Effects**
- Background gradient transitions with state-based animations
- Text animations with enter/exit transitions
- Icon animations (rotation, scale, bounce effects)
- Micro-interactions (hover, tap, focus effects)
- Reduced motion support for accessibility

### 🎯 **Comprehensive State Management**
- `idle` - Initial state
- `loading` - Operation in progress
- `success` - Operation completed successfully
- `error` - Operation failed
- `paused` - Operation temporarily paused
- `retrying` - Retrying failed operation

### 🎨 **Visual Feedback Systems**
- Progress indicator for long operations
- Loading dots animation
- State-specific color schemes
- Animated success confirmations
- Error states with retry options

### ♿ **Accessibility Features**
- ARIA attributes for screen readers
- Live region announcements
- Reduced motion preference support
- Keyboard navigation support
- Focus management

### 🔧 **Advanced Functionality**
- Pause/resume operations
- Retry failed operations
- Operation timeout handling
- Auto-reset functionality
- Custom icon support
- Multiple animation presets

## Installation

```bash
# Already available in your project components
import { AdvancedAsyncButton, AdvancedLoginButton, AdvancedSaveButton, AdvancedDeleteButton, AdvancedSubmitButton } from '@/components/ui/advanced-async-button';
```

## Basic Usage

### Simple Async Operation

```tsx
import { AdvancedAsyncButton } from '@/components/ui/advanced-async-button';

function BasicExample() {
  const handleSave = async () => {
    // Your async operation here
    await fetch('/api/save', { method: 'POST' });
  };

  return (
    <AdvancedAsyncButton
      onClick={handleSave}
      initialText="Save Changes"
      loadingText="Saving..."
      successText="Saved Successfully!"
      errorText="Save Failed"
    />
  );
}
```

### Pre-configured Variants

The component includes pre-configured variants for common use cases:

```tsx
import { AdvancedLoginButton, AdvancedSaveButton, AdvancedDeleteButton, AdvancedSubmitButton } from '@/components/ui/advanced-async-button';

// Login button with authentication flow
<AdvancedLoginButton
  onClick={handleLogin}
  onSuccess={() => router.push('/dashboard')}
/>

// Save button for forms
<AdvancedSaveButton
  onClick={handleSave}
  autoReset={true}
/>

// Delete button with confirmation
<AdvancedDeleteButton
  onClick={handleDelete}
  confirmMessage="Are you sure you want to delete this item?"
/>

// Submit button for forms
<AdvancedSubmitButton
  onClick={handleSubmit}
  variant="primary"
/>
```

## Advanced Configuration

### Complete Configuration Example

```tsx
<AdvancedAsyncButton
  // Core functionality
  onClick={handleComplexOperation}
  initialText="Start Process"
  loadingText="Processing request..."
  successText="Process completed successfully!"
  errorText="Process failed - click to retry"
  pausedText="Process paused"
  retryText="Retrying operation..."

  // Timing
  successDuration={3000}      // Show success for 3 seconds
  errorDuration={5000}        // Show error for 5 seconds
  pausedDuration={Infinity}   // Pause indefinitely
  timeoutDuration={30000}     // 30 second timeout
  progressDuration={10000}    // Show progress for 10+ second ops

  // Features
  autoReset={true}            // Auto-reset to idle
  showProgress={true}         // Show progress bar
  enableRetry={true}          // Enable retry button
  enablePause={true}          // Enable pause/resume
  respectReducedMotion={true} // Respect user preferences
  showLoadingDots={true}      // Animate loading dots

  // Styling
  variant="primary"           // primary, secondary, success, danger, warning, outline, ghost
  size="md"                   // sm, md, lg, xl
  className="custom-class"

  // Animation
  preset="default"            // default, subtle, dramatic, minimal

  // Icons
  icons={{
    idle: <Play className="w-4 h-4" />,
    loading: <Loader2 className="w-4 h-4 animate-spin" />,
    success: <CheckCircle className="w-4 h-4" />,
    error: <AlertCircle className="w-4 h-4" />,
    pause: <Pause className="w-4 h-4" />,
    retry: <RotateCcw className="w-4 h-4" />
  }}

  // Callbacks
  onStateChange={(state, previousState) => 
    console.log(`State: ${previousState} → ${state}`)
  }
  onSuccess={() => console.log('Operation completed successfully!')}
  onError={(error) => console.error('Operation failed:', error)}
  onRetry={() => console.log('Retrying operation...')}
  onPause={() => console.log('Operation paused')}
  onResume={() => console.log('Operation resumed')}

  // Micro-interactions
  microInteractions={{
    hover: true,    // Enable hover effects
    tap: true,      // Enable tap effects
    focus: true     // Enable focus effects
  }}
/>
```

### Custom Progress Indicator

```tsx
<AdvancedAsyncButton
  onClick={handleFileUpload}
  showProgress={true}
  progressDuration={15000}  // 15 second upload
  loadingText="Uploading file"
  successText="Upload complete!"
  variant="primary"
  className="w-full"
/>
```

### Complex Form Integration

```tsx
import { useState } from 'react';
import { AdvancedSubmitButton } from '@/components/ui/advanced-async-button';

function ComplexForm() {
  const [formData, setFormData] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Validate form
      if (!formData.name || !formData.email) {
        throw new Error('Please fill all required fields');
      }

      // Submit data
      await submitForm(formData);
      
      // Show success
      showToast('Form submitted successfully!');
    } catch (error) {
      // Handle error
      showToast('Form submission failed', 'error');
      throw error; // Re-throw to trigger error state
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form>
      {/* Form fields */}
      <AdvancedSubmitButton
        onClick={handleSubmit}
        disabled={isSubmitting}
        autoReset={true}
        timeoutDuration={30000}
        className="w-full"
      />
    </form>
  );
}
```

### Long-Running Operations

```tsx
<AdvancedAsyncButton
  onClick={handleDataExport}
  initialText="Export Data"
  loadingText="Preparing export..."
  successText="Export ready!"
  errorText="Export failed"
  successDuration={5000}
  timeoutDuration={120000}  // 2 minutes
  showProgress={true}
  progressDuration={30000}  // Show progress after 30 seconds
  enablePause={true}
  enableRetry={true}
  preset="dramatic"  // More prominent animations
/>
```

### Batch Operations

```tsx
function BatchProcessor() {
  const [items, setItems] = useState([]);

  const processBatch = async () => {
    for (const item of items) {
      await processItem(item);
      // Add delay to show loading state between items
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <AdvancedAsyncButton
      onClick={processBatch}
      initialText={`Process ${items.length} items`}
      loadingText="Processing batch..."
      successText="All items processed!"
      errorText="Batch processing failed"
      showLoadingDots={true}
      variant="success"
      size="lg"
    />
  );
}
```

## API Reference

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClick` | `() => Promise<void> \| void` | - | **Required.** The async operation to perform |
| `initialText` | `string` | `"Click to start"` | Text shown in idle state |
| `loadingText` | `string` | `"Processing..."` | Text shown during loading |
| `successText` | `string` | `"Completed successfully!"` | Text shown on success |
| `errorText` | `string` | `"Something went wrong"` | Text shown on error |
| `pausedText` | `string` | `"Paused"` | Text shown when paused |
| `retryText` | `string` | `"Retrying..."` | Text shown during retry |
| `successDuration` | `number` | `2500` | Duration to show success state (ms) |
| `errorDuration` | `number` | `4000` | Duration to show error state (ms) |
| `pausedDuration` | `number` | `Infinity` | Duration to show paused state (ms) |
| `timeoutDuration` | `number` | `30000` | Operation timeout (ms) |
| `progressDuration` | `number` | `5000` | Show progress after this duration (ms) |
| `autoReset` | `boolean` | `true` | Auto-reset to idle state |
| `showProgress` | `boolean` | `true` | Show progress indicator |
| `enableRetry` | `boolean` | `true` | Enable retry functionality |
| `enablePause` | `boolean` | `true` | Enable pause/resume |
| `respectReducedMotion` | `boolean` | `true` | Respect reduced motion preferences |
| `showLoadingDots` | `boolean` | `false` | Show animated loading dots |
| `variant` | `string` | `"primary"` | Button variant |
| `size` | `string` | `"md"` | Button size |
| `disabled` | `boolean` | `false` | Whether button is disabled |
| `className` | `string` | - | Custom CSS classes |
| `preset` | `string` | `"default"` | Animation preset |
| `icons` | `object` | - | Custom icons for states |
| `microInteractions` | `object` | - | Enable/disable micro-interactions |
| `onStateChange` | `function` | - | Callback when state changes |
| `onSuccess` | `function` | - | Callback on success |
| `onError` | `function` | - | Callback on error |
| `onRetry` | `function` | - | Callback when retrying |
| `onPause` | `function` | - | Callback when pausing |
| `onResume` | `function` | - | Callback when resuming |

### Variants

- `primary` - Primary action button
- `secondary` - Secondary action button
- `success` - Success/positive actions
- `danger` - Destructive actions
- `warning` - Warning actions
- `outline` - Outline style
- `ghost` - Ghost/transparent style

### Sizes

- `sm` - Small button
- `md` - Medium button (default)
- `lg` - Large button
- `xl` - Extra large button

### Animation Presets

- `default` - Balanced animations
- `subtle` - Minimal animations
- `dramatic` - Enhanced animations
- `minimal` - No animations

## Accessibility

The component is built with accessibility in mind:

- **Screen Reader Support**: Proper ARIA attributes and live regions
- **Keyboard Navigation**: Full keyboard support
- **Reduced Motion**: Respects user motion preferences
- **Focus Management**: Proper focus handling during state changes
- **Color Contrast**: High contrast colors for better visibility

### Accessibility Features

```tsx
// Automatic announcements for state changes
<span className="sr-only" role="status" aria-live="polite">
  {state === 'loading' && `Loading: ${loadingText}`}
  {state === 'success' && `Success: ${successText}`}
  {state === 'error' && `Error: ${errorText}`}
</span>

// Error details for screen readers
<div className="sr-only" role="alert">
  {error?.message}
</div>

// Proper ARIA attributes
<button
  aria-live={state === 'loading' ? 'polite' : 'off'}
  aria-busy={state === 'loading'}
  aria-describedby={state === 'error' ? 'error-message' : undefined}
  disabled={disabled || state === 'loading'}
>
```

## Styling

### Custom CSS

The component accepts standard CSS classes and uses CSS custom properties for theming:

```css
/* Custom button styles */
.advanced-async-button {
  --primary: #3b82f6;
  --primary-hover: #2563eb;
  --success: #16a34a;
  --error: #dc2626;
  --warning: #f59e0b;
}

/* Animation customizations */
.advanced-async-button.preset-dramatic {
  animation-duration: 0.6s;
  animation-easing: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

### Theme Integration

```tsx
// Works with design systems
<AdvancedAsyncButton
  variant="primary"
  className="theme-primary-button"
/>

<AdvancedAsyncButton
  variant="success"
  className="theme-success-button"
  preset="dramatic"
/>
```

## Performance Considerations

### Optimization Tips

1. **Memoize onClick handler** to prevent unnecessary re-renders
2. **Use appropriate timeout durations** to prevent memory leaks
3. **Enable reduced motion** for better performance on low-end devices
4. **Disable unused features** (progress, dots, micro-interactions) when not needed

### Best Practices

```tsx
// ✅ Good: Memoized handler
const handleSave = useCallback(async () => {
  await saveData(data);
}, [data]);

<AdvancedAsyncButton onClick={handleSave} />

// ❌ Bad: Inline handler (causes re-renders)
<AdvancedAsyncButton onClick={async () => { await saveData(data); }} />

// ✅ Good: Appropriate timeout
<AdvancedAsyncButton timeoutDuration={10000} />

// ✅ Good: Disable unused features
<AdvancedAsyncButton showProgress={false} showLoadingDots={false} microInteractions={false} />
```

## Troubleshooting

### Common Issues

1. **Animations not working**: Check if framer-motion is properly installed
2. **TypeScript errors**: Ensure all required props are provided
3. **Accessibility issues**: Verify ARIA attributes are properly set
4. **Performance issues**: Check for memory leaks with timeouts

### Debug Mode

```tsx
<AdvancedAsyncButton
  onClick={handleOperation}
  onStateChange={(state, previous) => 
    console.log(`State changed: ${previous} → ${state}`)
  }
  onError={(error) => console.error('Operation error:', error)}
/>
```

## Examples Repository

For more comprehensive examples, see:
- `/components/ui/async-button-examples.tsx` - Usage examples
- `/tests/advanced-async-button-comprehensive-test.tsx` - Test examples
- `/app/demo-async-button/` - Interactive demo

## Contributing

When contributing to this component:

1. Maintain accessibility standards
2. Add tests for new features
3. Update documentation
4. Follow existing code patterns
5. Consider performance implications

## Changelog

### v1.0.0
- Initial release with comprehensive async button functionality
- Smooth motion effects and animations
- Full accessibility support
- Pre-configured variants
- Advanced state management
- Comprehensive testing suite