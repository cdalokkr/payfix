export type ActivityAction = 'login' | 'logout' | 'create' | 'update' | 'delete'

// Define type for changed field with value
export type ChangedField = string | { name: string; value: any }

interface ActivityDescriptionParams {
    action: ActivityAction
    actorRole: string
    actorEmail: string
    targetEmail?: string
    changedFields?: ChangedField[]
    entityName?: string
    module?: string
}

export function formatActivityDescription({
    action,
    actorRole,
    actorEmail,
    targetEmail,
    changedFields,
    entityName = 'user',
    module
}: ActivityDescriptionParams): string {
    let actionText = ''
    let emoji = ''
    let targetInfo = ''
    let fieldsInfo = ''

    switch (action) {
        case 'login':
            actionText = 'logged in'
            emoji = '🔓'
            break
        case 'logout':
            actionText = 'logged out'
            emoji = '🔒'
            break
        case 'create':
            actionText = `created ${entityName}`
            emoji = entityName === 'user' ? '👤' : '📝'
            if (targetEmail) {
                targetInfo = `(${targetEmail})`
            }
            break
        case 'update':
            actionText = 'updated'
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
            actionText = 'deleted'
            emoji = '⛔'
            if (targetEmail) {
                targetInfo = `for (${targetEmail})`
            }
            break
    }

    // Construct the final string
    // Format: [Role] - [Actor Email] - [Action] [Emoji] [Fields Info] [Target Info]
    // Note: Timestamp is stored in created_at column and displayed separately in UI
    const parts = [
        actorRole,
        '-',
        `[${actorEmail}]`,
        '-',
        actionText,
        emoji,
        fieldsInfo,
        targetInfo,
    ]

    // Filter out empty strings and join with space
    return parts.filter(part => part !== '').join(' ')
}
