"use client"

import React from 'react'
import {
  ModernDialog,
  ModernDialogContent,
  ModernDialogTitle,
  ModernDialogDescription,
  ModernDialogHeader,
  ModernDialogFooter,
} from '@/components/ui/modern-dialog'

export function DialogAccessibilityTest() {
  const [open, setOpen] = React.useState(false)

  return (
    <div>
      <button onClick={() => setOpen(true)}>Open Dialog</button>
      
      <ModernDialog open={open} onOpenChange={setOpen}>
        <ModernDialogContent size="lg">
          {/* This should now work correctly - title extracted and positioned as direct child */}
          <ModernDialogHeader>
            <ModernDialogTitle id="test-title">
              Test Dialog Title
            </ModernDialogTitle>
            <ModernDialogDescription id="test-desc">
              Test dialog description for accessibility
            </ModernDialogDescription>
          </ModernDialogHeader>
          
          <div className="p-6">
            <p>This is the dialog content area.</p>
          </div>
          
          <ModernDialogFooter>
            <button onClick={() => setOpen(false)}>Close</button>
          </ModernDialogFooter>
        </ModernDialogContent>
      </ModernDialog>
    </div>
  )
}