// ============================================
// lib/utils/user-name.ts
// ============================================

/**
 * Computes the full name from individual name components
 * @param firstName - First name (required)
 * @param middleName - Middle name (optional)
 * @param lastName - Last name (required)
 * @returns Formatted full name string
 */
export function computeFullName(
  firstName?: string | null,
  middleName?: string | null,
  lastName?: string | null
): string {
  const first = (firstName || '').trim()
  const middle = (middleName || '').trim()
  const last = (lastName || '').trim()

  // If no name components are provided, return empty string
  if (!first && !middle && !last) {
    return ''
  }

  // Build the full name
  const nameParts: string[] = []

  // Add first name if present
  if (first) {
    nameParts.push(first)
  }

  // Add middle name if present (with proper spacing)
  if (middle) {
    nameParts.push(middle)
  }

  // Add last name if present
  if (last) {
    nameParts.push(last)
  }

  return nameParts.join(' ')
}

/**
 * Computes display name with fallback to full_name field if individual names are not available
 * @param profile - User profile object
 * @returns Formatted display name
 */
export function getDisplayName(profile?: {
  first_name?: string | null
  middle_name?: string | null
  last_name?: string | null
  full_name?: string | null
} | null): string {
  if (!profile) return ''

  // Try to compute from individual name fields
  const computedName = computeFullName(
    profile.first_name,
    profile.middle_name,
    profile.last_name
  )

  // If we have a computed name, use it
  if (computedName) {
    return computedName
  }

  // Fallback to full_name field if individual names are not available
  const fallbackName = (profile.full_name || '').trim()

  // If still no name available, return empty string
  if (!fallbackName) {
    return ''
  }

  return fallbackName
}

/**
 * Formats name for different contexts
 * @param profile - User profile object
 * @param context - Display context ('full' | 'short' | 'initials')
 * @returns Formatted name based on context
 */
export function formatUserName(
  profile?: {
    first_name?: string | null
    middle_name?: string | null
    last_name?: string | null
    full_name?: string | null
  } | null,
  context: 'full' | 'short' | 'initials' = 'full'
): string {
  if (!profile) return ''

  const fullName = getDisplayName(profile)

  if (!fullName) {
    return ''
  }

  switch (context) {
    case 'short': {
      // Return first name or first part of full name
      const firstPart = fullName.split(' ')[0]
      return firstPart || fullName
    }

    case 'initials': {
      // Return initials from first and last name
      const names = fullName.split(' ')
      if (names.length === 1) {
        return names[0].substring(0, 2).toUpperCase()
      }

      const firstInitial = names[0]?.charAt(0)?.toUpperCase() || ''
      const lastInitial = names[names.length - 1]?.charAt(0)?.toUpperCase() || ''

      return `${firstInitial}${lastInitial}`
    }

    case 'full':
    default:
      return fullName
  }
}

/**
 * Validates that at least first or last name is provided
 * @param firstName - First name
 * @param lastName - Last name
 * @returns Boolean indicating if at least one name is provided
 */
export function validateNameFields(firstName?: string, lastName?: string): boolean {
  const first = (firstName || '').trim()
  const last = (lastName || '').trim()

  return !!(first || last)
}