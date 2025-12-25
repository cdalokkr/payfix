# AsyncButton Component

A powerful, reusable button component for handling async operations with built-in loading, success, and error states.

## Features

- 🚀 **Async Operation Support**: Handles promises and async functions
- ⏳ **Loading States**: Shows spinner and loading text during operations
- ✅ **Success States**: Displays checkmark and success message
- ❌ **Error Handling**: Shows error icon and message with retry option
- 🎨 **Customizable**: Icons, text, colors, and timing
- 🔄 **Auto-reset**: Automatically returns to idle state
- 📱 **Responsive**: Works on all screen sizes
- ♿ **Accessible**: Proper ARIA labels and keyboard navigation

## Basic Usage

```tsx
import { AsyncButton } from '@/components/ui/async-button';

function MyComponent() {
  const handleAsyncAction = async () => {
    // Your async operation here
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  return (
    <AsyncButton
      onClick={handleAsyncAction}
      loadingText="Processing..."
      successText="Success!"
    >
      Start Operation
    </AsyncButton>
  );
}
```

## Pre-configured Variants

### LoginButton
Perfect for authentication forms:
```tsx
import { LoginButton } from '@/components/ui/async-button';

<LoginButton
  onClick={handleLogin}
  className="w-full bg-gradient-to-br from-primary to-primary/80 hover:to-primary/60 text-primary-foreground transition-smooth"
>
  Sign In
</LoginButton>
```

### SaveButton
Ideal for save operations:
```tsx
import { SaveButton } from '@/components/ui/async-button';

<SaveButton
  onClick={handleSave}
  className="bg-green-600 hover:bg-green-700 text-white transition-smooth"
>
  Save Changes
</SaveButton>
```

### DeleteButton
For destructive operations:
```tsx
import { DeleteButton } from '@/components/ui/async-button';

<DeleteButton
  onClick={handleDelete}
  className="bg-red-600 hover:bg-red-700 text-white transition-smooth"
>
  Delete Item
</DeleteButton>
```

### SubmitButton
For form submissions:
```tsx
import { SubmitButton } from '@/components/ui/async-button';

<SubmitButton
  onClick={handleSubmit}
  className="w-full bg-blue-600 hover:bg-blue-700 text-white transition-smooth"
>
  Submit Form
</SubmitButton>
```

## Advanced Usage

### Custom Icons
```tsx
<AsyncButton
  onClick={handleUpload}
  loadingText="Uploading..."
  successText="Upload complete!"
  icons={{
    loading: <Upload className="mr-2 h-4 w-4 animate-spin" />,
    success: <CheckCircle className="mr-2 h-4 w-4" />,
    error: <XCircle className="mr-2 h-4 w-4" />,
  }}
>
  Upload File
</AsyncButton>
```

### State Change Callback
```tsx
const [buttonState, setButtonState] = useState('idle');

<AsyncButton
  onClick={handleOperation}
  onStateChange={(state) => setButtonState(state)}
>
  Track State
</AsyncButton>
```

### Custom Timing
```tsx
<AsyncButton
  onClick={handleLongOperation}
  loadingText="Processing..."
  successText="Complete!"
  successDuration={5000}  // Show success for 5 seconds
  errorDuration={3000}    // Show error for 3 seconds
  autoReset={true}       // Auto-reset to idle state
>
  Long Operation
</AsyncButton>
```

## Props API

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onClick` | `() => Promise<void> \| void` | - | Async function to execute |
| `loadingText` | `string` | `'Loading...'` | Text shown during loading |
| `successText` | `string` | `'Success!'` | Text shown on success |
| `errorText` | `string` | `'Error occurred'` | Text shown on error |
| `successDuration` | `number` | `2000` | Success state duration (ms) |
| `errorDuration` | `number` | `3000` | Error state duration (ms) |
| `autoReset` | `boolean` | `true` | Auto-reset to idle state |
| `icons` | `object` | Default icons | Custom icons for states |
| `onStateChange` | `(state) => void` | - | State change callback |
| `children` | `ReactNode` | - | Button content (idle state) |
| `variant` | `string` | `'default'` | Button variant |
| `size` | `string` | `'default'` | Button size |
| `className` | `string` | - | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable button |

## State Management

The component manages these states automatically:

- **`idle`**: Default state, shows children
- **`loading`**: Shows spinner and loading text
- **`success`**: Shows checkmark and success text
- **`error`**: Shows error icon and error text

## Error Handling

The component catches and displays errors automatically:

```tsx
const handleRiskyOperation = async () => {
  if (Math.random() > 0.5) {
    throw new Error('Something went wrong!');
  }
  // Success logic
};

<AsyncButton
  onClick={handleRiskyOperation}
  errorText="Please try again"
/>
```

## Best Practices

1. **Always handle errors**: The component will catch them, but provide meaningful error messages
2. **Use appropriate variants**: LoginButton for auth, SaveButton for data operations
3. **Customize timing**: Adjust durations based on operation length
4. **Provide feedback**: Use onStateChange for complex state management
5. **Test error scenarios**: Ensure error states work as expected

## Examples in Your Project

### Login Page
```tsx
// Already implemented in src/app/auth/login/page.tsx
<LoginButton
  className="w-full bg-gradient-to-br from-primary to-primary/80 hover:to-primary/60 text-primary-foreground transition-smooth"
  onClick={handleLogin}
>
  Sign In
</LoginButton>
```

### Dashboard Actions
```tsx
// Save settings
<SaveButton onClick={handleSaveSettings}>
  Save Settings
</SaveButton>

// Delete item
<DeleteButton onClick={handleDeleteItem}>
  Delete
</DeleteButton>
```

### Form Submissions
```tsx
<SubmitButton onClick={handleFormSubmit}>
  Submit Application
</SubmitButton>
```

## Migration from Regular Buttons

### Before
```tsx
<Button
  onClick={handleAsyncOperation}
  disabled={loading}
>
  {loading ? 'Loading...' : 'Submit'}
</Button>
```

### After
```tsx
<AsyncButton
  onClick={handleAsyncOperation}
  loadingText="Submitting..."
  successText="Submitted!"
>
  Submit
</AsyncButton>
```

The AsyncButton provides a much better user experience with automatic state management, proper loading indicators, and error handling.

## Tailwind CSS v4 Gradient Classes

Use these standard Tailwind classes for gradients:

```tsx
// Basic gradient
bg-gradient-to-br from-primary to-primary/80

// With hover effects
bg-gradient-to-br from-primary to-primary/80 hover:to-primary/60

// Custom colors
bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700

// Text contrast
text-primary-foreground  // White text for dark backgrounds
text-white               // White text
text-black               // Black text for light backgrounds
```

### Available Gradient Directions
- `bg-gradient-to-t` - top
- `bg-gradient-to-tr` - top right
- `bg-gradient-to-r` - right
- `bg-gradient-to-br` - bottom right (most common)
- `bg-gradient-to-b` - bottom
- `bg-gradient-to-bl` - bottom left
- `bg-gradient-to-l` - left
- `bg-gradient-to-tl` - top left