import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MobilePayslipClient } from "./mobile-payslip-client"

export const metadata = {
    title: 'My PaySlips - Payfix',
}

export default async function MobilePayslipPage() {
    const supabase = await createServerSupabaseClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select(`*, designation:designations(name)`)
        .eq('id', session.user.id)
        .single()

    if (!profile) {
        redirect("/login")
    }

    const transformedProfile = {
        ...profile,
        designation: Array.isArray(profile.designation)
            ? profile.designation[0] || null
            : profile.designation
    }

    return <MobilePayslipClient profile={transformedProfile} />
}
