'use client'

import React, { useState } from 'react'
import { UserManagementSkeleton, UserManagementSkeletonPresets, UserManagementSkeletonVariant } from './user-management-skeleton'
import { EnhancedSkeleton, SkeletonType, AnimationMode } from '../enhanced-skeletons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * UserManagementSkeleton Demo Component
 * 
 * This component demonstrates the integration between the UserManagementSkeleton
 * and the existing enhanced skeleton system. It shows various loading states
 * and integration patterns for different use cases.
 */
export default function UserManagementSkeletonDemo() {
  const [demoVariant, setDemoVariant] = useState<UserManagementSkeletonVariant>(UserManagementSkeletonVariant.STANDARD)
  const [animationMode, setAnimationMode] = useState<AnimationMode>(AnimationMode.STAGGERED)

  return (
    <div className="space-y-8 p-6 bg-background">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">UserManagementSkeleton Integration Demo</h1>
        <p className="text-muted-foreground">
          This demo showcases the new UserManagementSkeleton component and its integration
          with the existing enhanced skeleton system for the admin user management interface.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
          <CardDescription>
            Adjust the settings below to see different skeleton variations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Skeleton Variant</label>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant={demoVariant === UserManagementSkeletonVariant.COMPACT ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoVariant(UserManagementSkeletonVariant.COMPACT)}
                >
                  Compact
                </Button>
                <Button 
                  variant={demoVariant === UserManagementSkeletonVariant.STANDARD ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoVariant(UserManagementSkeletonVariant.STANDARD)}
                >
                  Standard
                </Button>
                <Button 
                  variant={demoVariant === UserManagementSkeletonVariant.DETAILED ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDemoVariant(UserManagementSkeletonVariant.DETAILED)}
                >
                  Detailed
                </Button>
              </div>
            </div>
            
            <div>
              <label className="text-sm font-medium">Animation Mode</label>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant={animationMode === AnimationMode.STATIC ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAnimationMode(AnimationMode.STATIC)}
                >
                  Static
                </Button>
                <Button 
                  variant={animationMode === AnimationMode.PULSE ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAnimationMode(AnimationMode.PULSE)}
                >
                  Pulse
                </Button>
                <Button 
                  variant={animationMode === AnimationMode.STAGGERED ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAnimationMode(AnimationMode.STAGGERED)}
                >
                  Staggered
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UserManagement Skeleton Examples */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">UserManagementSkeleton Variations</h2>
        
        {/* Direct UserManagementSkeleton Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Direct UserManagementSkeleton Usage</CardTitle>
            <CardDescription>
              Using the UserManagementSkeleton component directly with custom props
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserManagementSkeleton
              variant={demoVariant}
              rowCount={6}
              showHeader={true}
              showSearchBar={true}
              showFilters={true}
              showCreateButton={true}
              showActions={true}
              showPagination={true}
              showBulkActions={demoVariant === UserManagementSkeletonVariant.DETAILED}
            />
          </CardContent>
        </Card>

        {/* Using UserManagementSkeletonPresets */}
        <Card>
          <CardHeader>
            <CardTitle>UserManagementSkeletonPresets</CardTitle>
            <CardDescription>
              Pre-configured skeletons for common use cases
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-3">Compact Preset</h3>
              {UserManagementSkeletonPresets.compact()}
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Standard Preset</h3>
              {UserManagementSkeletonPresets.standard()}
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Detailed Preset</h3>
              {UserManagementSkeletonPresets.detailed()}
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-3">Dashboard Preset</h3>
              {UserManagementSkeletonPresets.dashboard()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Integration with Enhanced Skeleton System */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Integration with Enhanced Skeleton System</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Using EnhancedSkeleton with USER_MANAGEMENT Type</CardTitle>
            <CardDescription>
              The UserManagementSkeleton integrated into the unified EnhancedSkeleton component
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EnhancedSkeleton 
              type={SkeletonType.USER_MANAGEMENT} 
              variant={animationMode}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Using SkeletonPresets.userManagement</CardTitle>
            <CardDescription>
              Accessing UserManagementSkeleton through the existing SkeletonPresets
            </CardDescription>
          </CardHeader>
          <CardContent>
            {UserManagementSkeletonPresets.standard()}
          </CardContent>
        </Card>
      </div>

      {/* Integration Examples */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Real-World Integration Examples</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Admin Dashboard Context</CardTitle>
            <CardDescription>
              UserManagementSkeleton in an admin dashboard layout
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">User Management</h3>
                  <p className="text-sm text-muted-foreground">Manage system users and permissions</p>
                </div>
                <Button disabled>Create User</Button>
              </div>
              {UserManagementSkeletonPresets.dashboard()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Full Admin Interface</CardTitle>
            <CardDescription>
              Complete user management interface with all features
            </CardDescription>
          </CardHeader>
          <CardContent>
            {UserManagementSkeletonPresets.detailed()}
          </CardContent>
        </Card>
      </div>

      {/* Progressive Loading Integration */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Progressive Loading Integration</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Layer 1 Skeleton for /admin/users/all</CardTitle>
            <CardDescription>
              Example of how UserManagementSkeleton serves as Layer 1 in the dual-layer 
              loading mechanism for progressive data loading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/25">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Layer 1: Initial Skeleton Loading</span>
              </div>
              {UserManagementSkeletonPresets.minimal()}
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• Fast initial render with minimal skeleton</p>
              <p>• Shows basic structure while data loads</p>
              <p>• Progresses to full data when ready</p>
              <p>• Maintains smooth user experience</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Considerations */}
      <Card>
        <CardHeader>
          <CardTitle>Performance & Accessibility Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">Performance</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Validated row count (5-10 rows)</li>
                <li>• Optimized animation delays</li>
                <li>• CSS-only animations</li>
                <li>• Responsive design</li>
                <li>• Modular component structure</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Accessibility</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• ARIA labels and roles</li>
                <li>• Screen reader support</li>
                <li>• Keyboard navigation</li>
                <li>• High contrast compatible</li>
                <li>• Semantic HTML structure</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}