import { Metadata } from "next"
import { ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const metadata: Metadata = {
    title: "Account Deactivated",
    description: "Your account has been deactivated by an administrator.",
}

export default function DeactiveAccountPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
            <div className="max-w-md space-y-6">
                <div className="flex justify-center">
                    <div className="rounded-full bg-red-100 p-6 dark:bg-red-900/20">
                        <ShieldAlert className="h-16 w-16 text-red-600 dark:text-red-500" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Account is De-Active
                </h1>

                <p className="text-lg text-muted-foreground">
                    Your access to the dashboard has been restricted. Please contact your system administrator for more information or to request reactivation.
                </p>

                <div className="pt-4">
                    <Button asChild size="lg" variant="default" className="w-full">
                        <Link href="/login">Return to Login</Link>
                    </Button>
                </div>
            </div>
        </div>
    )
}
