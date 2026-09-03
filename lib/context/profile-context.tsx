import { createContext, useContext } from 'react'
import type { Profile } from '@/types'

interface ProfileContextType {
    profile: Profile | null | undefined
    isLoading: boolean
    isInitializing: boolean
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function useProfile() {
    const context = useContext(ProfileContext)
    if (context === undefined) {
        throw new Error('useProfile must be used within a ProfileProvider')
    }
    return context
}

export const ProfileProvider = ProfileContext.Provider
