import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"

interface ReportCardProps {
    title: string
    value: string | number
    description?: string
    icon: LucideIcon
    trend?: {
        value: number
        label: string
        positive?: boolean
    }
    className?: string
}

export function ReportCard({
    title,
    value,
    description,
    icon: Icon,
    trend,
    className,
}: ReportCardProps) {
    return (
        <Card className={cn("overflow-hidden", className)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
                {(description || trend) && (
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                        {trend && (
                            <span
                                className={cn(
                                    "flex items-center font-medium",
                                    trend.positive ? "text-green-500" : "text-red-500"
                                )}
                            >
                                {trend.positive ? "+" : ""}
                                {trend.value}%
                            </span>
                        )}
                        {description && <span>{description}</span>}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
