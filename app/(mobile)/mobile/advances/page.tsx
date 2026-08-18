import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { MobileAdvancesClient } from "./mobile-advances-client"
import { db } from "@/lib/db"
import { profiles } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { runWithRequestHeaders } from "@/lib/tenant/with-context"

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
    title: 'My Advances - Payfix',
}

export default async function MobileAdvancesPage() {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
        redirect("/login")
    }

    const profile = await runWithRequestHeaders(async () => {
        return await db.query.profiles.findFirst({
            where: eq(profiles.id, user.id)
        })
    })

    if (!profile) {
        redirect("/login")
    }

    return <MobileAdvancesClient profile={profile as any} />
}

