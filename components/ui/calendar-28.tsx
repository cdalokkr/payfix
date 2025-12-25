"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DatePickerDDMMYYYYProps {
  id: string
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  className?: string
  disabled?: boolean
  removeSpacing?: boolean
  minAge?: number
  maxAge?: number
  asOnDate?: Date
}

function formatDateDDMMYYYY(date: Date | undefined) {
  if (!date) {
    return ""
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function isValidDate(date: Date | undefined) {
  if (!date) {
    return false
  }
  return !isNaN(date.getTime())
}

function calculateAge(dateOfBirth: Date, asOnDate: Date = new Date()): number {
  let age = asOnDate.getFullYear() - dateOfBirth.getFullYear()
  const monthDiff = asOnDate.getMonth() - dateOfBirth.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && asOnDate.getDate() < dateOfBirth.getDate())) {
    age--
  }
  
  return age
}

function isValidAge(date: Date, minAge?: number, maxAge?: number, asOnDate?: Date): boolean {
  const age = calculateAge(date, asOnDate)
  
  if (minAge !== undefined && age < minAge) {
    return false
  }
  
  if (maxAge !== undefined && age > maxAge) {
    return false
  }
  
  return true
}

function getFullYearFromTwoDigit(twoDigitYear: string): string {
  const year = parseInt(twoDigitYear, 10)
  // Use pivot year 2000: 00-69 => 2000-2069, 70-99 => 1970-1999
  return year <= 69 ? `20${twoDigitYear.padStart(2, '0')}` : `19${twoDigitYear.padStart(2, '0')}`
}

export function Calendar28({
  id,
  value,
  onChange,
  label = "Date of Birth",
  placeholder = "dd/mm/yyyy",
  className = "",
  disabled = false,
  removeSpacing = false,
  minAge,
  maxAge,
  asOnDate
}: DatePickerDDMMYYYYProps) {
  const [open, setOpen] = React.useState(false)
  const [date, setDate] = React.useState<Date | undefined>(undefined)
  const [month, setMonth] = React.useState<Date | undefined>(date)
  const [inputValue, setInputValue] = React.useState("")
  const [isUserTyping, setIsUserTyping] = React.useState(false)
  const [lastUserValue, setLastUserValue] = React.useState("")

  React.useEffect(() => {
    if (value) {
      // Handle both dd/mm/yyyy and dd/mm/yy formats
      const parts = value.split('/')
      if (parts.length === 3) {
        const [day, month, year] = parts
        const fullYear = year.length === 2 ? getFullYearFromTwoDigit(year) : year
        
        // Create Date object for calendar logic
        const parsedDate = new Date(parseInt(fullYear), parseInt(month) - 1, parseInt(day))
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate)
          setMonth(parsedDate)
          
          // Display the exact format received from parent
          setInputValue(`${day}/${month}/${year}`)
        }
      }
    } else {
      setInputValue("")
      setDate(undefined)
      setMonth(undefined)
    }
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value
    let parentValue = inputValue // Value to send to parent
    
    // Mark that user is typing to prevent parent from overwriting
    setIsUserTyping(true)
    
    // Allow only numbers
    const cleanValue = inputValue.replace(/\D/g, '')
    
    if (cleanValue.length === 0) {
      // Empty input
      inputValue = ""
      parentValue = ""
    } else if (cleanValue.length <= 2) {
      // Day part only
      inputValue = cleanValue
      parentValue = cleanValue
    } else if (cleanValue.length <= 4) {
      // Day and month
      inputValue = cleanValue.substring(0, 2) + '/' + cleanValue.substring(2)
      parentValue = inputValue
    } else if (cleanValue.length === 5) {
      // Incomplete date like "10071" -> don't send to parent yet
      const day = cleanValue.substring(0, 2)
      const month = cleanValue.substring(2, 4)
      const year = cleanValue.substring(4, 5)
      inputValue = `${day}/${month}/${year}`
      parentValue = "" // Don't send incomplete date to parent
    } else if (cleanValue.length === 6) {
      // Full date with 2-digit year (dd/mm/yy) - display to user but don't send to parent
      const day = cleanValue.substring(0, 2)
      const month = cleanValue.substring(2, 4)
      const year = cleanValue.substring(4, 6)
      
      // Display dd/mm/yy to user
      inputValue = `${day}/${month}/${year}`
      // Only send to parent if it's complete dd/mm/yyyy format (8 digits)
      parentValue = "" // Don't send until user completes to dd/mm/yyyy
    } else if (cleanValue.length === 7) {
      // Incomplete 7-digit date - don't send to parent
      const day = cleanValue.substring(0, 2)
      const month = cleanValue.substring(2, 4)
      const year = cleanValue.substring(4, 7)
      inputValue = `${day}/${month}/${year}`
      parentValue = "" // Don't send incomplete date to parent
    } else if (cleanValue.length === 8) {
      // Full date with 4-digit year (dd/mm/yyyy) - only this triggers Zod validation
      inputValue = cleanValue.substring(0, 2) + '/' + cleanValue.substring(2, 4) + '/' + cleanValue.substring(4, 8)
      parentValue = inputValue
    } else {
      // For 3-4 or 9-10 digits, handle gracefully but don't validate incomplete input
      if (cleanValue.length <= 2) {
        inputValue = cleanValue
        parentValue = cleanValue
      } else if (cleanValue.length <= 4) {
        inputValue = cleanValue.substring(0, 2) + '/' + cleanValue.substring(2)
        parentValue = inputValue
      } else {
        // For 9-10 digits, handle but don't validate until proper format
        const day = cleanValue.substring(0, 2)
        const month = cleanValue.substring(2, 4)
        const year = cleanValue.substring(4, 8)
        inputValue = `${day}/${month}/${year}`
        parentValue = cleanValue.length >= 8 ? inputValue : ""
      }
    }
    
    setInputValue(inputValue)
    setLastUserValue(inputValue)
    onChange(parentValue)
    
    // Clear typing state after a short delay
    setTimeout(() => setIsUserTyping(false), 500)
  }

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate)
    if (selectedDate) {
      const formatted = formatDateDDMMYYYY(selectedDate)
      
      setInputValue(formatted) // Display full dd/mm/yyyy
      onChange(formatted) // Send full dd/mm/yyyy to parent
    }
    setOpen(false)
  }

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Position cursor at start for natural typing
    setTimeout(() => {
      if (e.target.value.length > 0) {
        e.target.setSelectionRange(0, 0)
      }
    }, 0)
  }

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Preserve user input - don't modify on blur
    // Keep empty string as empty string
  }

  return (
    <div className={removeSpacing ? "flex flex-col" : "flex flex-col gap-3"}>
      {!removeSpacing && (
        <Label htmlFor={id} className="px-1">
          {label}
        </Label>
      )}
      <div className="relative flex gap-2">
        <Input
          id={id}
          value={inputValue}
          placeholder={placeholder}
          className={`bg-background pr-10 ${className}`}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          maxLength={10} // Restrict to dd/mm/yyyy format (10 characters)
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setOpen(true)
            }
          }}
          disabled={disabled}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              id={`${id}-picker`}
              variant="ghost"
              className="absolute top-1/2 right-2 size-6 -translate-y-1/2"
              disabled={disabled}
            >
              <CalendarIcon className="size-3.5" />
              <span className="sr-only">Select date</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto overflow-hidden p-0"
            align="end"
            alignOffset={-8}
            sideOffset={10}
          >
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              month={month}
              onMonthChange={setMonth}
              onSelect={handleDateSelect}
              disabled={(date) => {
                if (disabled) return false
                if (!date) return false
                return !isValidAge(date, minAge, maxAge, asOnDate)
              }}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}