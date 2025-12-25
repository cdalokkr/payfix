'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  Users,
  Search,
  Filter,
  MoreHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Download,
  Upload,
  Eye
} from 'lucide-react'
import VirtualScrollManager from './virtual-scroll-manager'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'user' | 'moderator' | 'guest'
  status: 'active' | 'inactive' | 'pending' | 'suspended'
  lastActive: Date
  joinDate: Date
  avatar?: string
  permissions?: string[]
  metadata?: {
    [key: string]: any
  }
}

interface UserTableConfig {
  pageSize: number
  enableVirtualScrolling: boolean
  virtualScrollingThreshold: number
  enableSearch: boolean
  enableFiltering: boolean
  enableSorting: boolean
  enableBulkActions: boolean
  enableExport: boolean
  enableImport: boolean
  loadingPriority: 'critical' | 'important' | 'normal' | 'low'
  staleTime: number
  prefetchDistance: number
  maxConcurrentLoads: number
}

interface UserTableState {
  users: User[]
  isLoading: boolean
  isLoadingMore: boolean
  isSearching: boolean
  hasMore: boolean
  page: number
  totalUsers: number
  searchQuery: string
  filter: {
    role: string[]
    status: string[]
    dateRange: {
      start?: Date
      end?: Date
    }
  }
  sort: {
    field: keyof User
    direction: 'asc' | 'desc'
  }
  selectedUsers: Set<string>
  viewMode: 'table' | 'grid' | 'cards'
  compact: boolean
  error?: Error | null
  lastUpdated?: Date
}

interface ProgressiveUserTableProps {
  dataLoader: (page: number, pageSize: number, filters?: any, sort?: any) => Promise<{
    users: User[]
    hasMore: boolean
    total: number
  }>
  config?: Partial<UserTableConfig>
  className?: string
  onUserSelect?: (users: User[]) => void
  onUserAction?: (action: string, user: User) => void
  onBulkAction?: (action: string, users: User[]) => void
  onRefresh?: () => void
  compact?: boolean
  maxHeight?: number
}

const DEFAULT_CONFIG: UserTableConfig = {
  pageSize: 50,
  enableVirtualScrolling: true,
  virtualScrollingThreshold: 100,
  enableSearch: true,
  enableFiltering: true,
  enableSorting: true,
  enableBulkActions: true,
  enableExport: true,
  enableImport: false,
  loadingPriority: 'normal',
  staleTime: 300000, // 5 minutes
  prefetchDistance: 3,
  maxConcurrentLoads: 3
}

export function ProgressiveUserTable({
  dataLoader,
  config = {},
  className,
  onUserSelect,
  onUserAction,
  onBulkAction,
  onRefresh,
  compact = false,
  maxHeight = 600
}: ProgressiveUserTableProps) {
  const [state, setState] = useState<UserTableState>({
    users: [],
    isLoading: true,
    isLoadingMore: false,
    isSearching: false,
    hasMore: true,
    page: 0,
    totalUsers: 0,
    searchQuery: '',
    filter: {
      role: [],
      status: [],
      dateRange: {}
    },
    sort: {
      field: 'name',
      direction: 'asc'
    },
    selectedUsers: new Set(),
    viewMode: 'table',
    compact,
    error: null,
    lastUpdated: new Date()
  })

  const configFinal = { ...DEFAULT_CONFIG, ...config }
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null)

  // Load initial data
  const loadInitialData = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const result = await dataLoader(0, configFinal.pageSize, state.filter, state.sort)

      setState(prev => ({
        ...prev,
        users: result.users,
        isLoading: false,
        hasMore: result.hasMore,
        totalUsers: result.total,
        page: 1,
        lastUpdated: new Date(),
        selectedUsers: new Set() // Clear selections on refresh
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error as Error
      }))
    }
  }, [dataLoader, configFinal.pageSize, state.filter, state.sort])

  // Load more data
  const loadMoreData = useCallback(async () => {
    if (state.isLoadingMore || !state.hasMore) return

    setState(prev => ({ ...prev, isLoadingMore: true }))

    try {
      const result = await dataLoader(state.page, configFinal.pageSize, state.filter, state.sort)

      setState(prev => ({
        ...prev,
        users: [...prev.users, ...result.users],
        isLoadingMore: false,
        hasMore: result.hasMore,
        totalUsers: result.total,
        page: prev.page + 1
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoadingMore: false,
        error: error as Error
      }))
    }
  }, [dataLoader, configFinal.pageSize, state.filter, state.sort, state.page, state.isLoadingMore, state.hasMore])

  // Handle search with debouncing
  const handleSearch = useCallback((query: string) => {
    setState(prev => ({ ...prev, searchQuery: query, isSearching: true }))

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const result = await dataLoader(0, configFinal.pageSize, { ...state.filter, search: query }, state.sort)

        setState(prev => ({
          ...prev,
          users: result.users,
          isLoading: false,
          isSearching: false,
          hasMore: result.hasMore,
          totalUsers: result.total,
          page: 1,
          selectedUsers: new Set() // Clear selections on search
        }))
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isSearching: false,
          error: error as Error
        }))
      }
    }, 500)
  }, [dataLoader, configFinal.pageSize, state.filter, state.sort])

  // Handle filter changes
  const handleFilterChange = useCallback((newFilter: Partial<typeof state.filter>) => {
    setState(prev => ({
      ...prev,
      filter: { ...prev.filter, ...newFilter }
    }))
  }, [])

  // Handle sorting
  const handleSort = useCallback((field: keyof User) => {
    setState(prev => ({
      ...prev,
      sort: {
        field,
        direction: prev.sort.field === field && prev.sort.direction === 'asc' ? 'desc' : 'asc'
      }
    }))
  }, [])

  // Handle user selection
  const handleUserSelect = useCallback((userId: string, selected: boolean) => {
    setState(prev => {
      const newSelected = new Set(prev.selectedUsers)
      if (selected) {
        newSelected.add(userId)
      } else {
        newSelected.delete(userId)
      }
      return { ...prev, selectedUsers: newSelected }
    })
  }, [])

  // Handle select all
  const handleSelectAll = useCallback((selected: boolean) => {
    setState(prev => ({
      ...prev,
      selectedUsers: selected ? new Set(prev.users.map(u => u.id)) : new Set()
    }))
  }, [])

  // Virtual scrolling setup
  const shouldUseVirtualScrolling = configFinal.enableVirtualScrolling && state.users.length > configFinal.virtualScrollingThreshold

  // Get user status badge
  const getStatusBadge = (status: User['status']) => {
    const variants: Record<User['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      inactive: 'secondary',
      pending: 'outline',
      suspended: 'destructive'
    }

    return (
      <Badge variant={variants[status]} className="text-xs">
        {status}
      </Badge>
    )
  }

  // Get role badge
  const getRoleBadge = (role: User['role']) => {
    const colors: Record<User['role'], string> = {
      admin: 'bg-red-100 text-red-800',
      user: 'bg-blue-100 text-blue-800',
      moderator: 'bg-green-100 text-green-800',
      guest: 'bg-gray-100 text-gray-800'
    }

    return (
      <Badge className={cn('text-xs', colors[role])}>
        {role}
      </Badge>
    )
  }

  // Format date
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  // Handle bulk actions
  const handleBulkAction = useCallback((action: string) => {
    const selectedUsersArray = state.users.filter(user => state.selectedUsers.has(user.id))
    onBulkAction?.(action, selectedUsersArray)
  }, [state.users, state.selectedUsers, onBulkAction])

  // Table row component
  const renderUserRow = (user: User, index: number, isVisible: boolean) => (
    <TableRow
      key={user.id}
      className={cn(
        'cursor-pointer hover:bg-muted/50 transition-colors',
        state.selectedUsers.has(user.id) && 'bg-blue-50'
      )}
      onClick={() => onUserAction?.('view', user)}
    >
      <TableCell className="w-12">
        <input
          type="checkbox"
          checked={state.selectedUsers.has(user.id)}
          onChange={(e) => {
            e.stopPropagation()
            handleUserSelect(user.id, e.target.checked)
          }}
          className="rounded"
        />
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {user.avatar ? (
              <Image
                src={user.avatar}
                alt={user.name}
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-sm font-medium">
                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {getRoleBadge(user.role)}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {getStatusBadge(user.status)}
      </TableCell>
      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
        {formatDate(user.lastActive)}
      </TableCell>
      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
        {formatDate(user.joinDate)}
      </TableCell>
      <TableCell className="w-12">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation()
              onUserAction?.('view', user)
            }}>
              <Eye className="h-4 w-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation()
              onUserAction?.('edit', user)
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Edit User
            </DropdownMenuItem>
            {user.status === 'active' ? (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onUserAction?.('deactivate', user)
              }}>
                <UserX className="h-4 w-4 mr-2" />
                Deactivate
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onUserAction?.('activate', user)
              }}>
                <UserCheck className="h-4 w-4 mr-2" />
                Activate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                onUserAction?.('delete', user)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )

  // Loading skeleton
  const renderSkeleton = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12"><Skeleton className="h-4 w-4" /></TableHead>
          <TableHead><Skeleton className="h-4 w-24" /></TableHead>
          <TableHead className="hidden md:table-cell"><Skeleton className="h-4 w-16" /></TableHead>
          <TableHead className="hidden sm:table-cell"><Skeleton className="h-4 w-16" /></TableHead>
          <TableHead className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableHead>
          <TableHead className="hidden xl:table-cell"><Skeleton className="h-4 w-20" /></TableHead>
          <TableHead className="w-12"><Skeleton className="h-4 w-4" /></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 5 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
            <TableCell>
              <div className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-12" /></TableCell>
            <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-12" /></TableCell>
            <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
            <TableCell><Skeleton className="h-4 w-4" /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className={compact ? 'pb-2' : 'pb-4'}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={cn('text-lg', compact && 'text-base')}>
              Users
            </CardTitle>
            {!compact && (
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadInitialData}
              disabled={state.isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', state.isLoading && 'animate-spin')} />
            </Button>

            {configFinal.enableExport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('export')}
                disabled={state.selectedUsers.size === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {configFinal.enableSearch && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={state.searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          )}

          {configFinal.enableFiltering && (
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          )}
        </div>

        {/* Bulk actions */}
        {configFinal.enableBulkActions && state.selectedUsers.size > 0 && (
          <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg">
            <span className="text-sm text-blue-700">
              {state.selectedUsers.size} user(s) selected
            </span>
            <div className="flex space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('bulk-activate')}
              >
                <UserCheck className="h-4 w-4 mr-1" />
                Activate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('bulk-deactivate')}
              >
                <UserX className="h-4 w-4 mr-1" />
                Deactivate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('bulk-delete')}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {/* Table content */}
        <div className="overflow-auto" style={{ maxHeight: compact ? 400 : maxHeight }}>
          {state.isLoading ? (
            <div className="p-4">
              {renderSkeleton()}
            </div>
          ) : state.error ? (
            <div className="p-4 text-center text-destructive">
              <p>Failed to load users</p>
              <p className="text-sm text-muted-foreground mt-1">
                {state.error.message}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={loadInitialData}
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          ) : state.users.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No users found</p>
              {state.searchQuery && (
                <p className="text-sm mt-1">Try adjusting your search query</p>
              )}
            </div>
          ) : shouldUseVirtualScrolling ? (
            <VirtualScrollManager
              data={state.users}
              itemHeight={60}
              containerHeight={compact ? 350 : 500}
              renderItem={(user, index) => renderUserRow(user, index, true)}
              overscan={5}
              className="h-full"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={state.users.length > 0 && state.selectedUsers.size === state.users.length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSort('name')}
                      className="h-auto p-0 font-medium"
                    >
                      Name
                      {state.sort.field === 'name' && (
                        state.sort.direction === 'asc' ?
                          <ChevronUp className="h-4 w-4 ml-1" /> :
                          <ChevronDown className="h-4 w-4 ml-1" />
                      )}
                    </Button>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Last Active</TableHead>
                  <TableHead className="hidden xl:table-cell">Join Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.users.map((user) => renderUserRow(user, 0, true))}
              </TableBody>
            </Table>
          )}

          {/* Load more trigger for infinite scroll */}
          {!shouldUseVirtualScrolling && state.hasMore && (
            <div ref={loadMoreTriggerRef} className="p-4 text-center">
              {state.isLoadingMore ? (
                <div className="flex items-center justify-center space-x-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading more users...</span>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={loadMoreData}
                >
                  <ChevronRight className="h-4 w-4 mr-1" />
                  Load More
                </Button>
              )}
            </div>
          )}

          {/* End of results */}
          {!state.hasMore && state.users.length > 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground border-t">
              <p>Showing {state.users.length} of {state.totalUsers} users</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ProgressiveUserTable