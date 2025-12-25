'use client'

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface VirtualScrollConfig {
  itemHeight: number
  containerHeight: number
  overscan?: number
  threshold?: number
  enableSmoothScrolling?: boolean
  preloadDistance?: number
}

interface VirtualScrollState {
  scrollTop: number
  startIndex: number
  endIndex: number
  visibleItems: number[]
  totalHeight: number
  scrollPercentage: number
  isScrolling: boolean
  scrollVelocity: number
}

interface VirtualScrollItem<T> {
  id: string | number
  data: T
  index: number
  height?: number
  isVisible?: boolean
  isLoaded?: boolean
  loadPriority: 'high' | 'medium' | 'low'
}

interface VirtualScrollManagerProps<T> {
  data: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode
  overscan?: number
  className?: string
  loadingComponent?: React.ReactNode
  emptyComponent?: React.ReactNode
  onItemVisible?: (item: T, index: number) => void
  onItemInvisible?: (item: T, index: number) => void
  onLoadMore?: () => void
  hasMore?: boolean
  loadMoreThreshold?: number
  enablePrefetch?: boolean
  maxConcurrentLoads?: number
}

export function VirtualScrollManager<T>({
  data,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className,
  loadingComponent,
  emptyComponent,
  onItemVisible,
  onItemInvisible,
  onLoadMore,
  hasMore = false,
  loadMoreThreshold = 0.8,
  enablePrefetch = true,
  maxConcurrentLoads = 3
}: VirtualScrollManagerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [state, setState] = useState<VirtualScrollState>({
    scrollTop: 0,
    startIndex: 0,
    endIndex: 0,
    visibleItems: [],
    totalHeight: data.length * itemHeight,
    scrollPercentage: 0,
    isScrolling: false,
    scrollVelocity: 0
  })

  const [visibleItemsSet, setVisibleItemsSet] = useState<Set<number>>(new Set())
  const [prefetchedItems, setPrefetchedItems] = useState<Set<number>>(new Set())
  const [loadingItems, setLoadingItems] = useState<Set<number>>(new Set())

  // Calculate visible range
  const calculateVisibleRange = useCallback((scrollTop: number) => {
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      Math.ceil((scrollTop + containerHeight) / itemHeight),
      data.length - 1
    )

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(data.length - 1, endIndex + overscan)
    }
  }, [itemHeight, containerHeight, data.length, overscan])

  // Update visible items when scroll position changes
  useEffect(() => {
    const { startIndex, endIndex } = calculateVisibleRange(state.scrollTop)
    const visibleItems = Array.from(
      { length: endIndex - startIndex + 1 },
      (_, i) => startIndex + i
    ).filter(i => i < data.length)

    setState(prev => ({
      ...prev,
      startIndex,
      endIndex,
      visibleItems,
      scrollPercentage: (state.scrollTop / (state.totalHeight - containerHeight)) * 100
    }))

    // Track which items are actually visible
    const newVisibleItems = new Set(visibleItems)
    setVisibleItemsSet(prevVisible => {
      const added = new Set([...newVisibleItems].filter(i => !prevVisible.has(i)))
      const removed = new Set([...prevVisible].filter(i => !newVisibleItems.has(i)))

      // Notify about items that became visible/invisible
      added.forEach(index => {
        onItemVisible?.(data[index], index)
      })
      removed.forEach(index => {
        onItemInvisible?.(data[index], index)
      })

      return newVisibleItems
    })

    // Check if we need to load more data
    if (hasMore && onLoadMore && state.scrollPercentage > loadMoreThreshold * 100) {
      onLoadMore()
    }
  }, [
    state.scrollTop,
    calculateVisibleRange,
    data,
    itemHeight,
    containerHeight,
    hasMore,
    onLoadMore,
    onItemVisible,
    onItemInvisible,
    state.totalHeight,
    loadMoreThreshold,
    state.scrollPercentage
  ])

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    const scrollDiff = newScrollTop - state.scrollTop
    const scrollVelocity = Math.abs(scrollDiff)

    setState(prev => ({
      ...prev,
      scrollTop: newScrollTop,
      isScrolling: true,
      scrollVelocity
    }))

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }

    // Set new timeout to detect when scrolling stops
    scrollTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isScrolling: false, scrollVelocity: 0 }))
    }, 150)
  }, [state.scrollTop])

  // Prefetch items that will become visible soon
  useEffect(() => {
    if (!enablePrefetch || state.isScrolling) return

    const prefetchDistance = 3 // Prefetch 3 items ahead
    const itemsToPrefetch: number[] = []

    for (let i = state.endIndex + 1; i <= Math.min(state.endIndex + prefetchDistance, data.length - 1); i++) {
      if (!visibleItemsSet.has(i) && !prefetchedItems.has(i) && !loadingItems.has(i)) {
        itemsToPrefetch.push(i)
      }
    }

    if (itemsToPrefetch.length > 0) {
      // Limit concurrent prefetch requests
      const itemsToProcess = itemsToPrefetch.slice(0, maxConcurrentLoads - loadingItems.size)
      
      itemsToProcess.forEach(index => {
        setLoadingItems(prev => new Set([...prev, index]))
        
        // Simulate prefetch delay (in real app, this would be actual data loading)
        setTimeout(() => {
          setPrefetchedItems(prev => new Set([...prev, index]))
          setLoadingItems(prev => {
            const newSet = new Set(prev)
            newSet.delete(index)
            return newSet
          })
        }, 100 + Math.random() * 200)
      })
    }
  }, [
    state.endIndex,
    enablePrefetch,
    state.isScrolling,
    visibleItemsSet,
    prefetchedItems,
    loadingItems,
    data.length,
    maxConcurrentLoads
  ])

  // Render visible items
  const visibleItems = useMemo(() => {
    return state.visibleItems.map(index => {
      const isVisible = visibleItemsSet.has(index)
      const isPrefetched = prefetchedItems.has(index)
      const isLoading = loadingItems.has(index)
      
      return {
        item: data[index],
        index,
        isVisible,
        isPrefetched,
        isLoading,
        isLoaded: isVisible || isPrefetched
      }
    })
  }, [state.visibleItems, data, visibleItemsSet, prefetchedItems, loadingItems])

  // Calculate total height for spacer
  const totalHeight = data.length * itemHeight

  // Smooth scroll to index
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      const scrollTop = index * itemHeight
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior
      })
    }
  }, [itemHeight])

  // Get scroll metrics
  const scrollMetrics = {
    scrollTop: state.scrollTop,
    scrollPercentage: state.scrollPercentage,
    isScrolling: state.isScrolling,
    scrollVelocity: state.scrollVelocity,
    visibleRange: [state.startIndex, state.endIndex],
    totalItems: data.length,
    loadedItems: prefetchedItems.size + visibleItemsSet.size
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div 
        className={cn('flex items-center justify-center h-full', className)}
        ref={containerRef}
      >
        {emptyComponent || (
          <div className="text-center text-muted-foreground">
            <p>No items to display</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div 
      className={cn('relative overflow-auto', className)}
      ref={containerRef}
      onScroll={handleScroll}
      style={{ height: containerHeight }}
    >
      {/* Virtual spacer to maintain scroll height */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items container */}
        <div className="absolute top-0 left-0 w-full">
          {visibleItems.map(({ item, index, isVisible, isPrefetched, isLoading, isLoaded }) => (
            <div
              key={index}
              className={cn(
                'absolute left-0 w-full transition-opacity duration-200',
                isVisible ? 'opacity-100' : isPrefetched ? 'opacity-75' : 'opacity-0'
              )}
              style={{
                top: index * itemHeight,
                height: itemHeight
              }}
            >
              {/* Loading state for prefetched but not yet visible items */}
              {isLoading && !isVisible && (
                <div className="absolute inset-0 bg-muted/50 flex items-center justify-center">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
              
              {/* Actual content */}
              {isLoaded ? (
                renderItem(item, index, isVisible)
              ) : (
                loadingComponent || (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-sm text-muted-foreground">Loading...</div>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scroll progress indicator */}
      {state.isScrolling && (
        <div className="absolute top-0 right-0 w-1 bg-primary/20 h-full">
          <div 
            className="bg-primary transition-none"
            style={{ 
              height: `${state.scrollPercentage}%`,
              minHeight: '2px'
            }}
          />
        </div>
      )}
    </div>
  )
}

// Hook for managing virtual scroll state
export function useVirtualScroll(config: VirtualScrollConfig) {
  const [scrollState, setScrollState] = useState<VirtualScrollState>({
    scrollTop: 0,
    startIndex: 0,
    endIndex: 0,
    visibleItems: [],
    totalHeight: 0,
    scrollPercentage: 0,
    isScrolling: false,
    scrollVelocity: 0
  })

  const calculateRange = useCallback((scrollTop: number, totalItems: number) => {
    const { itemHeight, containerHeight, overscan = 5 } = config
    
    const startIndex = Math.floor(scrollTop / itemHeight)
    const endIndex = Math.min(
      Math.ceil((scrollTop + containerHeight) / itemHeight),
      totalItems - 1
    )

    return {
      startIndex: Math.max(0, startIndex - overscan),
      endIndex: Math.min(totalItems - 1, endIndex + overscan)
    }
  }, [config])

  const updateScrollState = useCallback((
    scrollTop: number, 
    totalItems: number
  ) => {
    const { startIndex, endIndex } = calculateRange(scrollTop, totalItems)
    const visibleItems = Array.from(
      { length: endIndex - startIndex + 1 },
      (_, i) => startIndex + i
    ).filter(i => i < totalItems)

    setScrollState(prev => ({
      ...prev,
      scrollTop,
      startIndex,
      endIndex,
      visibleItems,
      totalHeight: totalItems * config.itemHeight,
      scrollPercentage: (scrollTop / (totalItems * config.itemHeight - config.containerHeight)) * 100
    }))
  }, [calculateRange, config.itemHeight, config.containerHeight])

  return {
    scrollState,
    updateScrollState,
    scrollToIndex: (index: number) => index * config.itemHeight
  }
}

export default VirtualScrollManager