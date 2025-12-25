'use client';

import React, { useState } from 'react';
import AsyncButton, { LoginButton, SaveButton, DeleteButton, SubmitButton } from './async-button';
import { Upload, CheckCircle, XCircle } from 'lucide-react';

/**
 * AsyncButton Usage Examples
 *
 * This file demonstrates various ways to use the AsyncButton component
 * for different async operations in your application.
 */

// Example 1: Basic AsyncButton with custom loading/success messages
export function BasicExample() {
  const handleAsyncOperation = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  return (
    <AsyncButton
      onClick={handleAsyncOperation}
      loadingText="Processing..."
      successText="Completed!"
      className="bg-blue-600 hover:bg-blue-700"
    >
      Start Process
    </AsyncButton>
  );
}

// Example 2: LoginButton (pre-configured for login operations)
export function LoginExample() {
  const handleLogin = async () => {
    // Your login logic here
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  return (
    <LoginButton
      onClick={handleLogin}
      className="w-full bg-gradient-primary hover:bg-primary-hover"
    >
      Sign In
    </LoginButton>
  );
}

// Example 3: SaveButton with custom durations
export function SaveExample() {
  const handleSave = async () => {
    // Your save logic here
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  return (
    <SaveButton
      onClick={handleSave}
      successDuration={3000} // Show success for 3 seconds
      className="bg-green-600 hover:bg-green-700"
    >
      Save Changes
    </SaveButton>
  );
}

// Example 4: DeleteButton with confirmation
export function DeleteExample() {
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this item?')) {
      throw new Error('Delete cancelled');
    }
    // Your delete logic here
    await new Promise(resolve => setTimeout(resolve, 1500));
  };

  return (
    <DeleteButton
      onClick={handleDelete}
      className="bg-red-600 hover:bg-red-700"
      variant="destructive"
    >
      Delete Item
    </DeleteButton>
  );
}

// Example 5: SubmitButton with state change callback
export function SubmitExample() {
  const [buttonState, setButtonState] = useState('idle');
  const handleSubmit = async () => {
    // Your submit logic here
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  return (
    <div className="space-y-2">
      <SubmitButton
        onClick={handleSubmit}
        onStateChange={setButtonState}
        className="bg-purple-600 hover:bg-purple-700"
      >
        Submit Form
      </SubmitButton>
      <p className="text-sm text-gray-600">Current state: {buttonState}</p>
    </div>
  );
}

// Example 6: AsyncButton with custom icons
export function CustomIconsExample() {
  const handleOperation = async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  return (
    <AsyncButton
      onClick={handleOperation}
      loadingText="Uploading..."
      successText="Upload complete!"
      icons={{
        loading: <Upload className="mr-2 h-4 w-4 animate-spin" />,
        success: <CheckCircle className="mr-2 h-4 w-4" />,
        error: <XCircle className="mr-2 h-4 w-4" />,
      }}
      className="bg-indigo-600 hover:bg-indigo-700"
    >
      Upload File
    </AsyncButton>
  );
}

// Example 7: Multiple AsyncButtons with different states
export function MultipleButtonsExample() {
  const handleOperation1 = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000));
  };

  const handleOperation2 = async () => {
    await new Promise(resolve => setTimeout(resolve, 3000));
  };

  return (
    <div className="space-y-4">
      <AsyncButton
        onClick={handleOperation1}
        loadingText="Quick operation..."
        successText="Quick done!"
        className="bg-blue-600 hover:bg-blue-700"
      >
        Quick Action
      </AsyncButton>

      <AsyncButton
        onClick={handleOperation2}
        loadingText="Long operation..."
        successText="Long operation completed!"
        successDuration={5000}
        className="bg-orange-600 hover:bg-orange-700"
      >
        Long Action
      </AsyncButton>
    </div>
  );
}

// Example 8: Error handling example
export function ErrorHandlingExample() {
  const handleFailingOperation = async () => {
    // Simulate an operation that might fail
    await new Promise(resolve => setTimeout(resolve, 1000));
    if (Math.random() > 0.5) {
      throw new Error('Random failure occurred');
    }
  };

  return (
    <AsyncButton
      onClick={handleFailingOperation}
      loadingText="Trying operation..."
      successText="Operation successful!"
      errorText="Operation failed - try again"
      errorDuration={4000}
      className="bg-gray-600 hover:bg-gray-700"
    >
      Risky Operation
    </AsyncButton>
  );
}

// Example 9: Disabled state handling
export function DisabledExample() {
  const [isDisabled, setIsDisabled] = useState(false);
  const handleOperation = async () => {
    setIsDisabled(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsDisabled(false);
  };

  return (
    <AsyncButton
      onClick={handleOperation}
      loadingText="Processing..."
      successText="Done!"
      disabled={isDisabled}
      className="bg-teal-600 hover:bg-teal-700"
    >
      Conditional Action
    </AsyncButton>
  );
}

// Example 10: Form integration
export function FormIntegrationExample() {
  const [formData, setFormData] = useState({ name: '', email: '' });

  const handleSubmit = async () => {
    // Validate form
    if (!formData.name || !formData.email) {
      throw new Error('Please fill all fields');
    }

    // Submit form data
    await new Promise(resolve => setTimeout(resolve, 2000));
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        className="w-full p-2 border rounded"
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        className="w-full p-2 border rounded"
      />
      <SubmitButton
        onClick={handleSubmit}
        className="w-full bg-emerald-600 hover:bg-emerald-700"
      >
        Submit Form
      </SubmitButton>
    </div>
  );
}