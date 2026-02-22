import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MobileAdvancesClient } from "./mobile-advances-client"

export const metadata = {
    title: 'My Advances - Payfix',
}

export default async function MobileAdvancesPage() {
    const supabase = await createServerSupabaseClient()

    const { data: { session }, error: sessionError } = await supabase.auth.getSession()

    if (sessionError || !session) {
        redirect("/login")
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single()

    if (!profile) {
        redirect("/login")
    }

    return <MobileAdvancesClient profile={profile} />
}
