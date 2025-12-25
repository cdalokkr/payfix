
/**
 * Returns the default avatar URL based on user sex
 * @param sex - User's sex ('Male' or 'Female')
 * @returns Default avatar URL path
 */
export function getDefaultAvatarUrl(sex: string | null | undefined): string {
    const s = sex?.toLowerCase()
    if (s === 'male') {
        return '/avatars/default-male.png'
    } else if (s === 'female') {
        return '/avatars/default-female.png'
    }
    // Fallback for null/undefined/other values
    return '/avatars/default-male.png'
}

/**
 * Checks if the avatar URL is a default avatar
 * @param avatarUrl - Avatar URL to check
 * @returns true if it's a default avatar
 */
export function isDefaultAvatar(avatarUrl: string | null | undefined): boolean {
    if (!avatarUrl) return false
    return avatarUrl.includes('/avatars/default-')
}
