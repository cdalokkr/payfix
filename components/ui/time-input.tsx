import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "./input"

export interface TimeInputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const TimeInput = React.forwardRef<HTMLInputElement, TimeInputProps>(
    ({ className, ...props }, ref) => {
        return (
            <div className="relative group/time flex-1">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground/50 group-focus-within/time:text-primary z-10" />
                <Input
                    type="time"
                    ref={ref}
                    className={cn(
                        "pl-9 h-11 rounded-xl bg-background transition-all appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none",
                        className
                    )}
                    {...props}
                />
            </div>
        )
    }
)
TimeInput.displayName = "TimeInput"

export { TimeInput }
