'use client'

import React, { useState } from 'react'
import { ProgressiveLoader, LoadingPriority } from '@/components/ui/loading-states'
import { UserManagementSkeleton, UserManagementSkeletonPresets, UserManagementSkeletonVariant } from './user-management-skeleton'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * ProgressiveLoader Integration Example
 * 
 * This component demonstrates how the UserManagementSkeleton integrates seamlessly
 * with the existing ProgressiveLoader system for dual-layer loading mechanism.
 */

export default function ProgressiveLoaderIntegrationExample() {
  const [isLoading, setIsLoading] = useState(true)
  const [userData, setUserData] = useState<any[] | null>(null)
  const [priority, setPriority] = useState<LoadingPriority>(LoadingPriority.MEDIUM)

  const simulateDataLoad = () => {
    setIsLoading(true)
    setUserData(null)
    
    // Simulate API call delay
    setTimeout(() => {
      setUserData([
        { id: 1, email: 'user1@example.com', firstName: 'John', lastName: 'Doe', role: 'admin' },
        { id: 2, email: 'user2@example.com', firstName: 'Jane', lastName: 'Smith', role: 'user' },
        // ... more mock data
      ])
      setIsLoading(false)
    }, 2000)
  }

  const ActualUserManagementTable = ({ users }: { users: any[] }) => (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage system users and permissions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {users.map(user => (
            <div key={user.id} className="flex items-center space-x-4 p-3 border rounded">
              <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium">{user.email}</div>
                <div className="text-sm text-muted-foreground">
                  {user.firstName} {user.lastName}
                </div>
              </div>
              <div className="text-sm capitalize px-2 py-1 bg-primary/10 rounded">
                {user.role}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-8 p-6 bg-background">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">ProgressiveLoader Integration Example</h1>
        <p className="text-muted-foreground">
          Demonstrating how UserManagementSkeleton integrates with the ProgressiveLoader
          system for dual-layer loading on the /admin/users/all endpoint.
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Controls</CardTitle>
          <CardDescription>
            Configure the loading behavior and priority levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Loading Priority</label>
              <div className="flex gap-2 mt-2">
                <Button 
                  variant={priority === LoadingPriority.CRITICAL ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(LoadingPriority.CRITICAL)}
                >
                  Critical
                </Button>
                <Button 
                  variant={priority === LoadingPriority.HIGH ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(LoadingPriority.HIGH)}
                >
                  High
                </Button>
                <Button 
                  variant={priority === LoadingPriority.MEDIUM ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPriority(LoadingPriority.MEDIUM)}
                >
                  Medium
                </Button>
              </div>
            </div>
            
            <div className="flex items-end">
              <Button onClick={simulateDataLoad} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Simulate Data Load'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layer 1: Skeleton Loading */}
      <Card>
        <CardHeader>
          <CardTitle>Layer 1: Initial Skeleton Loading</CardTitle>
          <CardDescription>
            UserManagementSkeleton serves as the first layer for immediate UI feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-muted/50 rounded-lg border-2 border-dashed border-muted-foreground/25">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Layer 1: Skeleton Loading</span>
            </div>
            
            {/* UserManagementSkeleton as Layer 1 */}
            <UserManagementSkeleton
              variant={UserManagementSkeletonVariant.COMPACT}
              rowCount={6}
              showHeader={false}
              showSearchBar={false}
              showCreateButton={false}
              showActions={false}
              showPagination={false}
            />
            
            <div className="text-xs text-muted-foreground mt-4 space-y-1">
              <p>• Renders immediately for instant feedback</p>
              <p>• Shows expected table structure</p>
              <p>• Minimal resource usage</p>
              <p>• Smooth transition to actual data</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Layer 2: ProgressiveLoader Integration */}
      <Card>
        <CardHeader>
          <CardTitle>Layer 2: ProgressiveLoader with Actual Data</CardTitle>
          <CardDescription>
            ProgressiveLoader manages the transition from skeleton to real data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProgressiveLoader 
            priority={priority}
            showImmediate={priority === LoadingPriority.CRITICAL}
            className="min-h-[400px]"
          >
            {isLoading ? (
              /* Layer 2: Enhanced Skeleton while data loads */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">User Management</h3>
                    <p className="text-sm text-muted-foreground">
                      Loading detailed user data...
                    </p>
                  </div>
                  <Button disabled>Create User</Button>
                </div>
                
                {/* Enhanced skeleton for full data loading */}
                <UserManagementSkeleton
                  variant={UserManagementSkeletonVariant.STANDARD}
                  rowCount={8}
                  showHeader={true}
                  showSearchBar={true}
                  showFilters={true}
                  showCreateButton={true}
                  showActions={true}
                  showPagination={true}
                />
              </div>
            ) : userData ? (
              /* Actual User Management Data */
              <ActualUserManagementTable users={userData} />
            ) : (
              /* Empty State */
              <div className="text-center py-8">
                <p className="text-muted-foreground">Click "Simulate Data Load" to see the demo</p>
              </div>
            )}
          </ProgressiveLoader>
        </CardContent>
      </Card>

      {/* Real-world Integration Example */}
      <Card>
        <CardHeader>
          <CardTitle>Real-world: /admin/users/all Endpoint Integration</CardTitle>
          <CardDescription>
            How this would work in the actual admin interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Implementation Flow:</p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>User navigates to /admin/users/all</li>
              <li>Layer 1: UserManagementSkeleton renders immediately</li>
              <li>API call initiated for user data</li>
              <li>Layer 2: ProgressiveLoader manages loading state</li>
              <li>Enhanced skeleton shows while data loads</li>
              <li>Actual user table replaces skeleton when ready</li>
            </ol>
          </div>

          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="space-y-3">
              <div className="text-sm font-medium">Code Example:</div>
              <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
{`// In UserManagement component
const { data: users, isLoading } = trpc.admin.users.getUsers.useQuery()

return (
  <div className="space-y-4">
    {isLoading ? (
      // Layer 1: Quick skeleton
      <UserManagementSkeleton variant="minimal" />
    ) : (
      // Layer 2: Progressive loading for detailed data
      <ProgressiveLoader priority={LoadingPriority.MEDIUM}>
        <UserManagementTable users={users} />
      </ProgressiveLoader>
    )}
  </div>
)`}
              </pre>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Performance Benefits */}
      <Card>
        <CardHeader>
          <CardTitle>Performance & UX Benefits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-2 text-green-600">Performance</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Instant initial render ({"<"}50ms)</li>
                <li>• Progressive data loading</li>
                <li>• Priority-based loading system</li>
                <li>• Minimal JavaScript bundle impact</li>
                <li>• CPU and memory efficient</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-2 text-blue-600">User Experience</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• No blank screens or layout shift</li>
                <li>• Smooth skeleton-to-data transitions</li>
                <li>• Contextual loading indicators</li>
                <li>• Predictable loading states</li>
                <li>• Accessibility compliant</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}