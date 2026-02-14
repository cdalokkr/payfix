"use client"

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from 'recharts';
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface UserActivityChartProps {
    data: {
        name: string;
        count: number;
    }[];
    className?: string;
    color?: string;
}

export function UserActivityChart({ data, className, color }: UserActivityChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    const textColor = isDark ? "hsl(215 20.2% 65.1%)" : "hsl(215.4 16.3% 46.9%)"
    const gridColor = isDark ? "hsl(217.2 32.6% 17.5%)" : "hsl(214.3 31.8% 91.4%)"
    const barColor = color || (isDark ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.6)')

    return (
        <div className={cn("w-full h-full min-h-[300px]", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        horizontal={true}
                        vertical={true}
                    />
                    <XAxis
                        type="number"
                        tick={{ fill: textColor, fontSize: 11, fontFamily: "Inter, sans-serif" }}
                        axisLine={{ stroke: gridColor }}
                        tickLine={{ stroke: gridColor }}
                    />
                    <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: textColor, fontSize: 11, fontFamily: "Inter, sans-serif" }}
                        axisLine={false}
                        tickLine={false}
                        width={100}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: isDark ? 'hsl(222.2 84% 4.9%)' : 'hsl(0 0% 100%)',
                            color: isDark ? 'hsl(210 40% 98%)' : 'hsl(222.2 84% 4.9%)',
                            border: `1px solid ${gridColor}`,
                            borderRadius: '8px',
                            padding: '12px',
                            fontFamily: "Inter, sans-serif",
                        }}
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                    />
                    <Bar
                        dataKey="count"
                        name="Activities"
                        fill={barColor}
                        radius={[0, 6, 6, 0]}
                        animationDuration={800}
                        animationBegin={0}
                    >
                        {data.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={barColor} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
