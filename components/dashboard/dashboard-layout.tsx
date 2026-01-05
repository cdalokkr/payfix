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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Profile } from '@/types'
import { cn } from '@/lib/utils'

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

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [contentLoading, setContentLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [storedProfile, setStoredProfile] = useState<Profile | null>(null)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [isLoginFlow, setIsLoginFlow] = useState(false)
  const [dashboardDataLoaded, setDashboardDataLoaded] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Detect if this is a fresh login (no stored profile in this session)
  useEffect(() => {
    const sessionProfile = sessionStorage.getItem('sessionProfile');
    const initialProfile = getInitialProfile();

    if (initialProfile) {
      setStoredProfile(initialProfile);
      // Check if this is a fresh login by checking session storage
      if (!sessionProfile) {
        setIsLoginFlow(true);
        sessionStorage.setItem('sessionProfile', JSON.stringify(initialProfile));
      }
    }

    // Set a timeout to force close the splash screen after 10 seconds
    const timeout = setTimeout(() => {
      setLoadingTimeout(true);
      setIsInitialLoad(false);
    }, 10000); // 10 seconds max

    return () => clearTimeout(timeout);
  }, [])

  // Track when dashboard data starts loading
  useEffect(() => {
    if (storedProfile && isLoginFlow) {
      // Start tracking dashboard data loading
      setContentLoading(true);
      setIsInitialLoad(true);

      // Set up a listener for when dashboard data is loaded
      const handleDashboardLoad = () => {
        setDashboardDataLoaded(true);
        setContentLoading(false);
        setIsInitialLoad(false);
        setIsLoginFlow(false);
      };

      // Listen for dashboard data loading events
      window.addEventListener('dashboardDataLoaded', handleDashboardLoad);

      // Auto-trigger after 3 seconds if no explicit load event
      const autoTimeout = setTimeout(() => {
        if (!dashboardDataLoaded) {
          handleDashboardLoad();
        }
      }, 3000);

      return () => {
        window.removeEventListener('dashboardDataLoaded', handleDashboardLoad);
        clearTimeout(autoTimeout);
      };
    }
  }, [storedProfile, isLoginFlow, dashboardDataLoaded])

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
    initialData: initialProfile || undefined, // Use cached profile from localStorage
    staleTime: 30 * 1000, // 30 seconds - reduced to ensure fresher avatar data
    enabled: !isLoggingOut, // Prevent fetching when logging out to avoid 401 errors
    retry: 2, // Limit retries to prevent infinite loading
    retryDelay: 1000,
  })

  // Memoize the setContentLoading callback to prevent unnecessary re-renders
  const handleLoadingChange = useCallback((loading: boolean) => {
    setContentLoading(loading)
  }, [])

  useEffect(() => {
    if (profile && profile !== getInitialProfile()) {
      setStoredProfile(profile)
      localStorage.setItem('userProfile', JSON.stringify(profile))
      // Close splash screen once we have profile data
      setContentLoading(false)
      setIsInitialLoad(false)
    }
    // Close splash screen if profile query fails
    if (profileError && !initialProfile) {
      setContentLoading(false)
      setIsInitialLoad(false)
    }
  }, [profile, profileError, initialProfile])

  // Loading messages for the splash screen
  const loadingMessages = [
    "Loading profile data...",
    "Fetching dashboard metrics...",
    "Loading recent activities...",
  ]

  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)

  useEffect(() => {
    if ((contentLoading && isInitialLoad && !loadingTimeout) || (isLoginFlow && !dashboardDataLoaded)) {
      const timer = setTimeout(() => setShowDialog(true), 300)
      return () => clearTimeout(timer)
    } else if (!contentLoading || loadingTimeout || dashboardDataLoaded) {
      setShowDialog(false)
    }
  }, [contentLoading, isInitialLoad, loadingTimeout, isLoginFlow, dashboardDataLoaded])

  useEffect(() => {
    if (!contentLoading || !isInitialLoad || loadingTimeout) return

    const interval = setInterval(() => {
      setCurrentMessageIndex((prev) => (prev + 1) % loadingMessages.length)
    }, 1500)

    return () => clearInterval(interval)
  }, [contentLoading, isInitialLoad, loadingTimeout, loadingMessages.length])

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

  // Show loading dialog while role is being determined (but don't block the UI)
  if (!currentRole && (pathname === '/admin' || pathname === '/user')) {
    return (
      <>
        <Dialog
          open={showDialog}
        >
          <DialogContent showCloseButton={false} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Loading your profile...</DialogTitle>
              <DialogDescription>
                Please wait while we prepare your dashboard.
              </DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
        <SidebarProvider>
          <AppSidebar
            role="employee"
            tenants={tenants}
            defaultTenant={defaultTenant}
            onTenantSwitch={handleTenantSwitch}
            user={null}
          />
          <SidebarInset className="flex flex-col min-h-screen">
            <TopBar user={null} />
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
      </>
    )
  }

  return (
    <>
      <Dialog
        open={showDialog && (contentLoading || (isLoginFlow && !dashboardDataLoaded)) && (pathname === '/admin' || pathname === '/user')}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {loadingTimeout ? 'Dashboard Loading Issue' : 'Welcome to Your Dashboard'}
            </DialogTitle>
            <DialogDescription>
              {loadingTimeout
                ? 'We\'re having trouble loading your dashboard. You can still access the main features while we resolve this issue.'
                : isLoginFlow
                  ? 'Initializing your dashboard with all necessary data...'
                  : loadingMessages[currentMessageIndex]
              }
            </DialogDescription>
          </DialogHeader>
          {(loadingTimeout || (isLoginFlow && !dashboardDataLoaded)) && (
            <div className="mt-4">
              <Button
                onClick={() => {
                  setLoadingTimeout(false)
                  setContentLoading(false)
                  setIsInitialLoad(false)
                  setDashboardDataLoaded(true)
                  setIsLoginFlow(false)
                }}
                className="w-full"
              >
                {loadingTimeout ? 'Continue to Dashboard' : 'Skip Loading & Continue'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <SidebarProvider>
        <AppSidebar
          role={currentRole || 'employee'}
          tenants={tenants}
          defaultTenant={defaultTenant}
          onTenantSwitch={handleTenantSwitch}
          user={currentUser}
          className={cn(currentRole === 'employee' && "hidden lg:flex")}
        />
        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          <TopBar user={currentUser} />
          <div className="flex-1 overflow-y-auto pt-6 pb-20 lg:pb-4 scroll-smooth">
            {children || <DashboardContent profile={profile} isLoading={profileLoading} onLoadingChange={handleLoadingChange} />}
          </div>
          <BottomNav />
          <StatusBar className="hidden lg:flex" />
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}