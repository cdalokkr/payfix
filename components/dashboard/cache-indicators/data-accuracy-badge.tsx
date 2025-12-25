// ============================================
// components/dashboard/cache-indicators/data-accuracy-badge.tsx
// ============================================

'use client'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useState, useEffect } from 'react'
import { CheckCircle, AlertCircle, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface DataAccuracyInfo {
  level: 'realtime' | 'fresh' | 'stale' | 'very-stale' | 'unknown'
  percentage: number
  lastUpdated: number
  ttl: number
  age: number // in milliseconds
  trend: 'improving' | 'declining' | 'stable'
  confidence: number // 0-100
}

interface DataAccuracyBadgeProps {
  lastUpdated: number
  ttl?: number
  dataType?: string
  showTrend?: boolean
  showDetails?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function DataAccuracyBadge({ 
  lastUpdated, 
  ttl = 60000, // Default 1 minute
  dataType = 'unknown',
  showTrend = false,
  showDetails = false,
  size = 'md',
  className = '' 
}: DataAccuracyBadgeProps) {
  const [accuracy, setAccuracy] = useState<DataAccuracyInfo>({
    level: 'unknown',
    percentage: 0,
    lastUpdated,
    ttl,
    age: 0,
    trend: 'stable',
    confidence: 0
  })

  useEffect(() => {
    const calculateAccuracy = () => {
      const now = Date.now()
      const age = now - lastUpdated
      const agePercentage = Math.min(100, (age / ttl) * 100)
      
      let level: DataAccuracyInfo['level']
      let percentage: number
      let confidence: number

      if (age < ttl * 0.1) { // Less than 10% of TTL
        level = 'realtime'
        percentage = 100
        confidence = 95
      } else if (age < ttl * 0.3) { // Less than 30% of TTL
        level = 'fresh'
        percentage = Math.round(100 - (agePercentage * 0.3))
        confidence = 85
      } else if (age < ttl * 0.7) { // Less than 70% of TTL
        level = 'stale'
        percentage = Math.round(100 - (agePercentage * 0.6))
        confidence = 70
      } else if (age < ttl) { // Less than TTL
        level = 'very-stale'
        percentage = Math.round(100 - (agePercentage * 0.8))
        confidence = 50
      } else { // Expired
        level = 'very-stale'
        percentage = Math.max(0, Math.round(100 - (agePercentage * 0.9)))
        confidence = 25
      }

      // Simulate trend calculation (in real implementation, this would be based on historical data)
      const trend: DataAccuracyInfo['trend'] = age < ttl * 0.5 ? 'improving' : 
                                           age > ttl * 0.8 ? 'declining' : 'stable'

      setAccuracy({
        level,
        percentage,
        lastUpdated,
        ttl,
        age,
        trend,
        confidence
      })
    }

    // Initial calculation
    calculateAccuracy()

    // Update every second for real-time feedback
    const interval = setInterval(calculateAccuracy, 1000)

    return () => clearInterval(interval)
  }, [lastUpdated, ttl])

  const getAccuracyColor = () => {
    switch (accuracy.level) {
      case 'realtime':
        return 'default'
      case 'fresh':
        return 'secondary'
      case 'stale':
        return 'outline'
      case 'very-stale':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  const getAccuracyIcon = () => {
    switch (accuracy.level) {
      case 'realtime':
        return <CheckCircle className="h-3 w-3" />
      case 'fresh':
        return <CheckCircle className="h-3 w-3" />
      case 'stale':
        return <Clock className="h-3 w-3" />
      case 'very-stale':
        return <AlertCircle className="h-3 w-3" />
      default:
        return <Minus className="h-3 w-3" />
    }
  }

  const getTrendIcon = () => {
    switch (accuracy.trend) {
      case 'improving':
        return <TrendingUp className="h-3 w-3 text-green-600" />
      case 'declining':
        return <TrendingDown className="h-3 w-3 text-red-600" />
      default:
        return <Minus className="h-3 w-3 text-gray-600" />
    }
  }

  const getAccuracyText = () => {
    switch (accuracy.level) {
      case 'realtime':
        return 'Real-time'
      case 'fresh':
        return 'Fresh'
      case 'stale':
        return 'Stale'
      case 'very-stale':
        return 'Very Stale'
      default:
        return 'Unknown'
    }
  }

  const formatAge = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h`
  }

  const sizeClasses = {
    sm: 'h-4 px-2 text-xs',
    md: 'h-5 px-2.5 text-xs',
    lg: 'h-6 px-3 text-sm'
  }


  const badgeContent = (
    <Badge 
      variant={getAccuracyColor()} 
      className={`${sizeClasses[size]} ${className} ${
        accuracy.level === 'very-stale' ? 'animate-pulse' : ''
      }`}
    >
      {getAccuracyIcon()}
      <span className="ml-1">
        {showDetails ? `${getAccuracyText()} (${accuracy.percentage}%)` : getAccuracyText()}
      </span>
      {showTrend && (
        <span className="ml-1">
          {getTrendIcon()}
        </span>
      )}
    </Badge>
  )

  if (!showDetails) {
    return badgeContent
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent className="w-80">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium">Data Accuracy</span>
              <span className={`text-xs px-2 py-1 rounded ${
                accuracy.level === 'realtime' ? 'bg-green-100 text-green-800' :
                accuracy.level === 'fresh' ? 'bg-blue-100 text-blue-800' :
                accuracy.level === 'stale' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {getAccuracyText()}
              </span>
            </div>
            
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Accuracy:</span>
                <span className="font-medium">{accuracy.percentage}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-medium">{accuracy.confidence}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Age:</span>
                <span className="font-medium">{formatAge(accuracy.age)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">TTL:</span>
                <span className="font-medium">{formatAge(accuracy.ttl)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Trend:</span>
                <div className="flex items-center">
                  {getTrendIcon()}
                  <span className="ml-1 capitalize">{accuracy.trend}</span>
                </div>
              </div>
            </div>

            {/* Progress bar showing data freshness */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Freshness</span>
                <span>{Math.max(0, 100 - Math.round((accuracy.age / accuracy.ttl) * 100))}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    accuracy.level === 'realtime' ? 'bg-green-600' :
                    accuracy.level === 'fresh' ? 'bg-blue-600' :
                    accuracy.level === 'stale' ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ 
                    width: `${Math.max(0, 100 - Math.round((accuracy.age / accuracy.ttl) * 100))}%` 
                  }}
                />
              </div>
            </div>

            {dataType && (
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Data Type: {dataType}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Compact version for inline use
export function CompactDataAccuracyBadge({ 
  lastUpdated, 
  ttl,
  className = '' 
}: { 
  lastUpdated: number
  ttl?: number
  className?: string 
}) {
  return (
    <DataAccuracyBadge 
      lastUpdated={lastUpdated} 
      ttl={ttl}
      size="sm" 
      showDetails={false}
      showTrend={false}
      className={className}
    />
  )
}

// Progress bar version for detailed views
export function DataAccuracyProgressBar({ 
  lastUpdated, 
  ttl,
  className = '' 
}: { 
  lastUpdated: number
  ttl?: number
  className?: string 
}) {
  const [percentage, setPercentage] = useState(100)

  useEffect(() => {
    const updatePercentage = () => {
      const now = Date.now()
      const age = now - lastUpdated
      const freshPercentage = Math.max(0, 100 - Math.round((age / ttl!) * 100))
      setPercentage(freshPercentage)
    }

    updatePercentage()
    const interval = setInterval(updatePercentage, 1000)
    return () => clearInterval(interval)
  }, [lastUpdated, ttl])

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Data Freshness</span>
        <span>{percentage}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div 
          className={`h-2 rounded-full transition-all duration-300 ${
            percentage > 70 ? 'bg-green-600' :
            percentage > 40 ? 'bg-yellow-600' :
            'bg-red-600'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}