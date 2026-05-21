import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AdminOverview } from './admin-overview'
import { useAdminRealtimeDashboard } from '@/hooks/use-realtime-dashboard-data'
import { useDashboardPrefetch } from '@/hooks/use-dashboard-prefetch'
import { trpc } from '@/lib/trpc/client'

// Mock the hooks and dependencies
jest.mock('@/hooks/use-realtime-dashboard-data')
jest.mock('@/hooks/use-dashboard-prefetch')
jest.mock('@/lib/context/profile-context', () => ({
  useProfile: () => ({
    profile: { id: 'test-user-id', role: 'admin' },
    isLoading: false,
  }),
}))
jest.mock('@/lib/trpc/client', () => ({
  trpc: {
    useUtils: jest.fn(),
    profile: {
      get: {
        useQuery: jest.fn(),
      },
      getLastSession: {
        useQuery: jest.fn().mockReturnValue({ data: null, isLoading: false }),
      },
    },
  },
}))
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(() => '/admin'),
}))
jest.mock('next/dynamic', () => () => {
  const MockModernAddUserForm = ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) => {
    if (!open) return null
    return (
      <div data-testid="modern-add-user-form">
        <h2>Create New User</h2>
        <label htmlFor="firstName">First Name</label>
        <input id="firstName" />
        <label htmlFor="lastName">Last Name</label>
        <input id="lastName" />
        <label htmlFor="email">Email Address</label>
        <input id="email" />
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    )
  }
  return MockModernAddUserForm
})

const mockUseAdminRealtimeDashboard = useAdminRealtimeDashboard as jest.MockedFunction<typeof useAdminRealtimeDashboard>
const mockUseDashboardPrefetch = useDashboardPrefetch as jest.MockedFunction<typeof useDashboardPrefetch>
const mockTrpc = trpc

describe('AdminOverview', () => {
  const mockOnLoadingChange = jest.fn()
  const mockRefetch = jest.fn()
  const mockClearPrefetch = jest.fn()

  const mockDashboardData = {
    stats: {
      totalUsers: 100,
      totalActivities: 200,
      todayActivities: 20,
      moderatorCount: 5,
      employeeCount: 10,
      adminCount: 3,
    },
    recentActivities: [
      { id: '1', description: 'User logged in', activity_type: 'login', created_at: '2023-01-01T00:00:00Z' },
      { id: '2', description: 'User created post', activity_type: 'data_create', created_at: '2023-01-02T00:00:00Z' },
    ],
    analytics: [
      { id: '1', metric_name: 'active_users', metric_value: 25, metric_date: '2023-01-01' },
    ],
    activeUsers: 50,
    isLoading: false,
    isError: false,
    error: null,
    refetch: mockRefetch,
    dataSource: 'cache' as const,
    lastUpdated: new Date(),
    magicCardsDataReady: true,
    recentActivityDataReady: true,
    showSkeleton: false,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAdminRealtimeDashboard.mockReturnValue(mockDashboardData)
    mockUseDashboardPrefetch.mockReturnValue({
      prefetch: jest.fn(),
      isPrefetched: false,
      prefetchedData: null,
      clearPrefetch: mockClearPrefetch,
      isPrefetching: false,
    })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (mockTrpc.useUtils as any).mockReturnValue({
        admin: {
          dashboard: {
            getUnifiedDashboardData: { invalidate: jest.fn() },
          },
        },
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ; (mockTrpc.profile.get.useQuery as any).mockReturnValue({
        data: { user_id: 'test-user-id' },
      })
  })

  describe('Dashboard Rendering', () => {
    it('renders the Quick Actions heading', () => {
      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
    })

    it('renders the Create User action', () => {
      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      expect(screen.getByText('Create User')).toBeInTheDocument()
    })

    it('displays metric cards with correct values when data is ready', () => {
      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      // Check that metric values are displayed
      expect(screen.getByText('100')).toBeInTheDocument() // Total Users
      expect(screen.getByText('10')).toBeInTheDocument() // Employee Role (replaces Active Users if > 0)
      expect(screen.getByText('5')).toBeInTheDocument() // Moderator Role
      expect(screen.getByText('3')).toBeInTheDocument() // Administrators
    })

    it('shows skeleton loading state when showSkeleton is true', () => {
      mockUseAdminRealtimeDashboard.mockReturnValue({
        ...mockDashboardData,
        showSkeleton: true,
        magicCardsDataReady: false,
      })

      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      // When skeleton is showing, metric values render as animated placeholders
      expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    })
  })

  describe('Add User Form', () => {
    it('opens the add user form when Create User action is clicked', async () => {
      const user = userEvent.setup()
      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      const createUserAction = screen.getByText('Create User')
      await user.click(createUserAction)

      expect(screen.getByTestId('modern-add-user-form')).toBeInTheDocument()
      expect(screen.getByText('Create New User')).toBeInTheDocument()
    })
  })

  describe('Loading State Callback', () => {
    it('calls onLoadingChange with correct loading state', () => {
      mockUseAdminRealtimeDashboard.mockReturnValue({
        ...mockDashboardData,
        isLoading: true,
        showSkeleton: true,
      })

      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      // onLoadingChange should be called with true when loading
      expect(mockOnLoadingChange).toHaveBeenCalledWith(true)
    })

    it('calls onLoadingChange with false when not loading', () => {
      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      // onLoadingChange should be called with false when not loading
      expect(mockOnLoadingChange).toHaveBeenCalledWith(false)
    })
  })

  describe('Error State', () => {
    it('displays error alert when there is an error and no data', () => {
      mockUseAdminRealtimeDashboard.mockReturnValue({
        ...mockDashboardData,
        isError: true,
        stats: { totalUsers: 0, totalActivities: 0, todayActivities: 0, moderatorCount: 0, employeeCount: 0, adminCount: 0 },
      })

      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      expect(screen.getByText(/failed to load dashboard data/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('calls refetch when Retry button is clicked', async () => {
      const user = userEvent.setup()
      mockUseAdminRealtimeDashboard.mockReturnValue({
        ...mockDashboardData,
        isError: true,
        stats: { totalUsers: 0, totalActivities: 0, todayActivities: 0, moderatorCount: 0, employeeCount: 0, adminCount: 0 },
      })

      render(<AdminOverview onLoadingChange={mockOnLoadingChange} />)

      const retryButton = screen.getByRole('button', { name: /retry/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalled()
    })
  })
})
