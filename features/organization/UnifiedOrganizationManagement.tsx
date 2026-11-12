"use client"

import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DepartmentManagement from '@/features/departments/DepartmentManagement'
import DesignationManagement from '@/features/users/components/designation-management'
import { Building2, Briefcase } from 'lucide-react'
import { trpc } from '@/lib/trpc/client'

interface UnifiedOrganizationManagementProps {
    defaultTab?: 'departments' | 'designations'
    initialDesignationsData?: any[]
}

export default function UnifiedOrganizationManagement({
    defaultTab = 'departments',
    initialDesignationsData,
}: UnifiedOrganizationManagementProps) {
    const searchParams = useSearchParams()
    const router = useRouter()
    const urlTab = searchParams.get('tab') as 'departments' | 'designations' | null

    const [activeTab, setActiveTab] = useState<'departments' | 'designations'>(
        urlTab === 'designations' || urlTab === 'departments' ? urlTab : defaultTab
    )

    const utils = trpc.useUtils()

    // Sync state with URL parameter if it changes
    useEffect(() => {
        if (urlTab === 'designations' || urlTab === 'departments') {
            setActiveTab(urlTab)
        }
    }, [urlTab])

    const handleTabChange = (value: string) => {
        const tab = value as 'departments' | 'designations'
        setActiveTab(tab)
        const params = new URLSearchParams(window.location.search)
        params.set('tab', tab)
        const newUrl = `${window.location.pathname}?${params.toString()}`
        window.history.replaceState(null, '', newUrl)

        // Always refresh queries when switching tabs for real-time synchronization
        if (tab === 'designations') {
            utils.departments.getAll.invalidate()
            utils.admin.designation.getDesignations.invalidate()
        } else {
            utils.departments.getAll.invalidate()
        }
    }

    // Quick drill-down from department to designations
    const handleViewDesignations = (departmentId?: string) => {
        handleTabChange('designations')
    }

    // Fetch counts for badges
    const { data: departments } = trpc.departments.getAll.useQuery()
    const { data: designations } = trpc.admin.designation.getDesignations.useQuery()

    return (
        <div className="space-y-6">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3">
                    <TabsList className="bg-muted/60 p-1 rounded-xl h-11">
                        <TabsTrigger
                            value="departments"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                            <Building2 className="h-4 w-4 text-primary" />
                            <span>Departments</span>
                        </TabsTrigger>

                        <TabsTrigger
                            value="designations"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                            <Briefcase className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            <span>Designations</span>
                        </TabsTrigger>
                    </TabsList>

                    <div className="text-xs text-muted-foreground hidden sm:block">
                        Unified Organization Structure: <strong>{departments?.length || 0} Departments</strong>, <strong>{designations?.length || 0} Designations</strong>
                    </div>
                </div>

                <TabsContent value="departments" className="m-0 focus-visible:outline-none">
                    <DepartmentManagement
                        onViewDesignations={handleViewDesignations}
                        embedded={true}
                    />
                </TabsContent>

                <TabsContent value="designations" className="m-0 focus-visible:outline-none">
                    <DesignationManagement
                        initialData={initialDesignationsData}
                        embedded={true}
                    />
                </TabsContent>
            </Tabs>
        </div>
    )
}
