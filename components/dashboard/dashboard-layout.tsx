'use client'

import { ReactNode, useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'
import { trpc } from '@/lib/trpc/client'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { AppSidebar } from './app-sidebar'
import { TopBar } from './top-bar'
import { StatusBar } from './status-bar'
import { BottomNav } from './bottom-nav'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { ProfileProvider } from '@/lib/context/profile-context'
import { Profile } from '@/types'
import { cn } from '@/lib/utils'
import { useDashboardCacheInvalidation } from '@/hooks/use-dashboard-cache-invalidation'
import { NotificationToastListener } from './notification-toast-listener'

// Dynamic imports for heavy dashboard components to reduce initial bundle size
const AdminOverview = dynamic(
  () => import('./admin-overview').then(mod => ({ default: mod.AdminOverview })),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false
  }
)

const UserOverview = dynamic(
  () => import('./user-overview').then(mod => ({ default: mod.UserOverview })),
  {
    loading: () => <DashboardSkeleton />,
    ssr: false
  }
)

// Skeleton component for dashboard loading state
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}

interface DashboardLayoutProps {
  children?: ReactNode
  tenantBrand?: string | null
  tenantLicenseExpiresAt?: string | null
}

function DashboardContent({
  profile,
  isLoading,
  onLoadingChange
}: {
  profile: Profile | undefined
  isLoading: boolean
  onLoadingChange: (loading: boolean) => void
}) {
  useEffect(() => {
    onLoadingChange(isLoading)
  }, [isLoading, onLoadingChange])

  if (!profile) {
    return (
      <div className="p-4 md:p-6 lg:p-8 flex items-center justify-center">
        <div className="bg-background/50 backdrop-blur-sm rounded-lg border border-border/20 shadow-sm p-6 md:p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Profile not found</h2>
          <p className="text-muted-foreground">Unable to load your profile information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="bg-background/50 backdrop-blur-sm rounded-lg border border-border/20 shadow-sm p-6 md:p-8">
        {profile.role === 'admin' ? <AdminOverview onLoadingChange={onLoadingChange} /> : <UserOverview profile={profile} onLoadingChange={onLoadingChange} />}
      </div>
    </div>
  )
}


// Function to get initial profile from localStorage
function getInitialProfile(): Profile | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem('userProfile');
    if (!stored) return null;

    const profile = JSON.parse(stored);
    return profile;
  } catch (error) {
    console.error('Error parsing stored profile:', error);
    return null;
  }
}

export function DashboardLayout({ 
  children,
  tenantBrand,
  tenantLicenseExpiresAt
}: DashboardLayoutProps) {
  const pathname = usePathname()
  const [storedProfile, setStoredProfile] = useState<Profile | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Detect and set stored profile
  useEffect(() => {
    const initialProfile = getInitialProfile();
    if (initialProfile) {
      setStoredProfile(initialProfile);
    }
  }, [])

  // Listen for logout event to stop fetching data
  useEffect(() => {
    const handleLogout = () => {
      setIsLoggingOut(true)
    }
    window.addEventListener('loggingOut', handleLogout)
    return () => window.removeEventListener('loggingOut', handleLogout)
  }, [])

  // Get initial profile once to avoid multiple calls
  const initialProfile = getInitialProfile();

  // Use cached profile as initial data and always fetch fresh data in background
  const { data: profile, isLoading: profileLoading, isError: profileError } = trpc.profile.get.useQuery(undefined, {
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary refetches during navigation
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnMount: false, // Use cached data if available, don't refetch on every mount
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
    enabled: !isLoggingOut, // Prevent fetching when logging out to avoid 401 errors
    retry: 2, // Limit retries to prevent infinite loading
    retryDelay: 1000,
  })

  // Enable real-time cache invalidation for dashboard data (disabled for managers as their hook already handles it)
  useDashboardCacheInvalidation(profile?.role === 'admin' || profile?.role === 'moderator' || storedProfile?.role === 'admin' || storedProfile?.role === 'moderator')

  useEffect(() => {
    if (profile) {
      const currentStored = getInitialProfile()
      if (!currentStored || currentStored.id !== profile.id || currentStored.avatar_url !== profile.avatar_url || currentStored.full_name !== profile.full_name || currentStored.role !== profile.role) {
        setStoredProfile(profile)
        localStorage.setItem('userProfile', JSON.stringify(profile))
      }
    }
  }, [profile])

  // Mock tenant data - in a real app, this would come from an API
  const tenants = useMemo(() => [
    { id: '1', name: 'Default Organization' }
  ], [])
  const defaultTenant = useMemo(() => tenants[0], [tenants])

  const handleTenantSwitch = useCallback((tenantId: string) => {
    // Handle tenant switching logic here
    console.log('Switching to tenant:', tenantId)
  }, [])

  // Determine the current user role, prioritizing fresh profile data
  const currentRole = profile?.role || storedProfile?.role;
  const currentUser = profile || storedProfile || null;

  // Memoize profile context value to prevent unnecessary re-renders
  const profileContextValue = useMemo(() => ({
    profile,
    isLoading: profileLoading
  }), [profile, profileLoading]);

  // Show loading dialog while role is being determined (but don't block the UI)
  if (!currentRole && (pathname === '/admin' || pathname === '/user')) {
    return (
      <SidebarProvider>
        <AppSidebar
          role="employee"
          tenants={tenants}
          defaultTenant={defaultTenant}
          onTenantSwitch={handleTenantSwitch}
          user={null}
        />
        <SidebarInset className="flex flex-col min-h-screen">
          <TopBar 
            user={null} 
            tenantBrand={tenantBrand} 
            tenantLicenseExpiresAt={tenantLicenseExpiresAt} 
          />
          <div className="flex-1 w-full pt-6 pb-4 px-4">
            <div className="min-h-full p-4 md:p-6 lg:p-8 space-y-6 scroll-smooth-touch mobile-optimized">
              <div className="bg-background/50 backdrop-blur-sm rounded-lg border border-border/20 shadow-sm p-6 md:p-8">
                <div className="text-center">
                  <h2 className="text-xl font-bold mb-4">Loading your dashboard...</h2>
                  <p className="text-muted-foreground">Please wait while we prepare your content.</p>
                </div>
              </div>
            </div>
          </div>
          <StatusBar />
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <ProfileProvider value={profileContextValue}>
      {/* Listen for real-time notification events and show toasts */}
      <NotificationToastListener />
      <SidebarProvider>
        <AppSidebar
          role={currentRole || 'employee'}
          tenants={tenants}
          defaultTenant={defaultTenant}
          onTenantSwitch={handleTenantSwitch}
          user={currentUser}
          className={cn(currentRole === 'employee' && "hidden lg:flex")}
        />
        <SidebarInset className="flex flex-col h-screen overflow-hidden bg-background">
          <TopBar 
            user={currentUser} 
            tenantBrand={tenantBrand} 
            tenantLicenseExpiresAt={tenantLicenseExpiresAt} 
          />
          <div className="flex-1 overflow-y-auto pt-6 pb-20 lg:pb-4 scroll-smooth bg-background">
            <div
              key={pathname}
              className="w-full animate-fade-in"
            >
              {children || <DashboardContent profile={profile} isLoading={profileLoading} onLoadingChange={() => {}} />}
            </div>
          </div>
          <BottomNav />
          <StatusBar className="hidden lg:flex" />
        </SidebarInset>
      </SidebarProvider>
    </ProfileProvider>
  )
}