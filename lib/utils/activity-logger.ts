export type ActivityAction = 'login' | 'logout' | 'create' | 'update' | 'delete'

// Define type for changed field with value
export type ChangedField = string | { name: string; value: any }

interface ActivityDescriptionParams {
    action: ActivityAction
    actorRole?: string       // Kept for backward compatibility but not used in description
    actorEmail?: string      // Kept for backward compatibility but not used in description
    targetEmail?: string
    changedFields?: ChangedField[]
    entityName?: string
    module?: string
}

/**
 * Format activity description - returns ONLY the action text.
 * Role and email are stored in profiles table and fetched via user_id FK when displaying.
 * 
 * Examples:
 * - "Logged in 🔓"
 * - "Created user 👤 (user@example.com)"
 * - "Updated 💾 fields: Role (admin) for (user@example.com)"
 */
export function formatActivityDescription({
    action,
    targetEmail,
    changedFields,
    entityName = 'user',
}: ActivityDescriptionParams): string {
    let actionText = ''
    let emoji = ''
    let targetInfo = ''
    let fieldsInfo = ''

    switch (action) {
        case 'login':
            actionText = 'Logged in'
            emoji = '🔓'
            break
        case 'logout':
            actionText = 'Logged out'
            emoji = '🔒'
            break
        case 'create':
            actionText = `Created ${entityName}`
            emoji = entityName === 'user' ? '👤' : '📝'
            if (targetEmail) {
                targetInfo = `(${targetEmail})`
            }
            break
        case 'update':
            actionText = 'Updated'
            emoji = '💾'
            if (targetEmail) {
                targetInfo = `for (${targetEmail})`
            }
            if (changedFields && changedFields.length > 0) {
                fieldsInfo = `fields: ${changedFields.map(field => {
                    if (typeof field === 'string') return field
                    // Format as "Name (Value)" if value is present
                    if (field.value !== undefined && field.value !== null) {
                        return `${field.name} (${field.value})`
                    }
                    return field.name
                }).join(', ')}`
            }
            break
        case 'delete':
            actionText = 'Deleted'
            emoji = '⛔'
            if (targetEmail) {
                targetInfo = `(${targetEmail})`
            }
            break
    }

    // Construct the action-only description
    // Format: [Action] [Emoji] [Fields Info] [Target Info]
    // Role and email are NOT included - they come from profiles table via user_id FK
    const parts = [
        actionText,
        emoji,
        fieldsInfo,
        targetInfo,
    ]

    // Filter out empty strings and join with space
    return parts.filter(part => part !== '').join(' ')
}

