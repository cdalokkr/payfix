"use client"

import React, { createContext, useContext, useRef, useState } from 'react'

// Context for persisting async button state across re-renders
const AsyncButtonStateContext = createContext<{
  setButtonState: (state: 'idle' | 'loading' | 'success' | 'error') => void
  getButtonState: () => 'idle' | 'loading' | 'success' | 'error'
}>({
  setButtonState: () => {},
  getButtonState: () => 'idle'
})

export function AsyncButtonStateProvider({ children }: { children: React.ReactNode }) {
  // Use useRef to persist state across re-renders
  const buttonState = useRef<'idle' | 'loading' | 'success' | 'error'>('idle')
  
  const setButtonState = (state: 'idle' | 'loading' | 'success' | 'error') => {
    console.log('AsyncButtonStateProvider: Setting state to:', state)
    buttonState.current = state
  }
  
  const getButtonState = () => {
    return buttonState.current
  }
  
  return (
    <AsyncButtonStateContext.Provider value={{ setButtonState, getButtonState }}>
      {children}
    </AsyncButtonStateContext.Provider>
  )
}

export function useAsyncButtonState() {
  return useContext(AsyncButtonStateContext)
}