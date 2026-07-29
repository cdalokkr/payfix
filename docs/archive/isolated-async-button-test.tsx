// @ts-nocheck
"use client"

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ManualAsyncButton } from '@/components/ui/manual-async-button'

describe('Isolated ManualAsyncButton Test', () => {
  it('should properly show loading and success states in isolation', async () => {
    console.log('🚀 Starting isolated async button test')
    
    let resolvePromise: (value: any) => void
    const asyncOperation = new Promise(resolve => {
      resolvePromise = resolve
    })
    
    const onClick = jest.fn().mockImplementation(async () => {
      console.log('Isolated test: onClick called')
      await asyncOperation
      console.log('Isolated test: onClick completed')
    })
    
    render(
      <ManualAsyncButton
        onClick={onClick}
        loadingText="Creating..."
        successText="Created successfully!"
        onSuccess={() => {
          console.log('Isolated test: onSuccess callback triggered')
        }}
      >
        Create User
      </ManualAsyncButton>
    )
    
    console.log('✅ Button rendered, clicking...')
    
    // Click the button
    fireEvent.click(screen.getByText('Create User'))
    
    console.log('⏳ Waiting for loading state...')
    
    // Check loading state
    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeTruthy()
      console.log('✅ Loading state detected')
    }, { timeout: 1000 })
    
    console.log('🔄 Resolving promise...')
    resolvePromise!(undefined)
    
    console.log('⏳ Waiting for success state...')
    
    // Check success state
    await waitFor(() => {
      expect(screen.getByText('Created successfully!')).toBeTruthy()
      console.log('✅ Success state detected')
    }, { timeout: 3000 })
    
    console.log('🎉 Isolated test PASSED! ManualAsyncButton works correctly.')
  })
})