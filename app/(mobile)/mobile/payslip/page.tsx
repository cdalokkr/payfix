import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MobilePayslipClient } from "./mobile-payslip-client"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runWithRequestHeaders } from "@/lib/tenant/with-context"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
    title: 'My PaySlips - Payfix',
}

export default async function MobilePayslipPage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        redirect("/login")
    }

    const profile = await runWithRequestHeaders(async () => {
        return await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id),
            with: {
                designation: true
            }
        })
    })

    if (!profile) {
        redirect("/login")
    }

    const transformedProfile = {
        ...profile,
        designation: profile.designation ? { name: profile.designation.name } : null
    }

    return <MobilePayslipClient profile={transformedProfile as any} />
}

