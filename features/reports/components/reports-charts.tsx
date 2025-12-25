"use client"

import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend,
} from "recharts"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface ChartDataPoint {
    name: string
    [key: string]: string | number | null
}

interface ChartProps {
    data: ChartDataPoint[]
    className?: string
}

// Modern color palette matching the dashboard theme
const COLORS = [
    "hsl(var(--chart-1))",  // Purple
    "hsl(var(--chart-2))",  // Green
    "hsl(var(--chart-3))",  // Yellow
    "hsl(var(--chart-4))",  // Blue
    "hsl(var(--chart-5))",  // Orange
]

export function UserGrowthChart({ data, className }: ChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const textColor = isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))"
    const gridColor = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipBg = isDark ? "hsl(var(--card))" : "hsl(var(--card))"
    const tooltipBorder = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipText = isDark ? "hsl(var(--card-foreground))" : "hsl(var(--card-foreground))"

    return (
        <div className={cn("w-full", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <LineChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 10,
                        left: 10,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                        opacity={0.3}
                    />
                    <XAxis
                        dataKey="name"
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                    />
                    <YAxis
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            borderColor: tooltipBorder,
                            borderRadius: "8px",
                            color: tooltipText,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                        }}
                        labelStyle={{
                            color: tooltipText,
                            fontWeight: 600,
                        }}
                    />
                    <Line
                        type="monotone"
                        dataKey="users"
                        stroke={COLORS[0]}
                        strokeWidth={2.5}
                        activeDot={{ r: 6, fill: COLORS[0], strokeWidth: 2, stroke: tooltipBg }}
                        dot={false}
                        animationDuration={750}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    )
}

export function ActivityBarChart({ data, className }: ChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const textColor = isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))"
    const gridColor = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipBg = isDark ? "hsl(var(--card))" : "hsl(var(--card))"
    const tooltipBorder = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipText = isDark ? "hsl(var(--card-foreground))" : "hsl(var(--card-foreground))"
    const cursorFill = isDark ? "hsl(var(--muted) / 0.3)" : "hsl(var(--muted) / 0.2)"

    return (
        <div className={cn("w-full", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{
                        top: 5,
                        right: 10,
                        left: 10,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                        opacity={0.3}
                    />
                    <XAxis
                        dataKey="name"
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                    />
                    <YAxis
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        cursor={{ fill: cursorFill, radius: 4 }}
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            borderColor: tooltipBorder,
                            borderRadius: "8px",
                            color: tooltipText,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                        }}
                        labelStyle={{
                            color: tooltipText,
                            fontWeight: 600,
                        }}
                    />
                    <Bar
                        dataKey="activity"
                        fill={COLORS[1]}
                        radius={[6, 6, 0, 0]}
                        animationDuration={750}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function DevicePieChart({ data, className }: ChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const tooltipBg = isDark ? "hsl(var(--card))" : "hsl(var(--card))"
    const tooltipBorder = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipText = isDark ? "hsl(var(--card-foreground))" : "hsl(var(--card-foreground))"

    return (
        <div className={cn("w-full", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        fill="hsl(var(--chart-1))"
                        paddingAngle={2}
                        dataKey="value"
                        animationDuration={750}
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                                stroke={tooltipBg}
                                strokeWidth={2}
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            borderColor: tooltipBorder,
                            borderRadius: "8px",
                            color: tooltipText,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                        }}
                        labelStyle={{
                            color: tooltipText,
                            fontWeight: 600,
                        }}
                    />
                    <Legend
                        wrapperStyle={{ fontSize: '12px' }}
                        iconType="circle"
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}

export function ActivityByRoleChart({ data, className }: ChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const textColor = isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))"
    const gridColor = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipBg = isDark ? "hsl(var(--card))" : "hsl(var(--card))"
    const tooltipBorder = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipText = isDark ? "hsl(var(--card-foreground))" : "hsl(var(--card-foreground))"
    const cursorFill = isDark ? "hsl(var(--muted) / 0.3)" : "hsl(var(--muted) / 0.2)"

    return (
        <div className={cn("w-full", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    margin={{
                        top: 20,
                        right: 10,
                        left: 10,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        vertical={false}
                        opacity={0.3}
                    />
                    <XAxis
                        dataKey="name"
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                    />
                    <YAxis
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                        tickFormatter={(value) => `${value}`}
                    />
                    <Tooltip
                        cursor={{ fill: cursorFill, radius: 4 }}
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            borderColor: tooltipBorder,
                            borderRadius: "8px",
                            color: tooltipText,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                            backdropFilter: "blur(12px)",
                            border: `1px solid ${tooltipBorder}`,
                            padding: "12px",
                        }}
                        labelStyle={{
                            color: tooltipText,
                            fontWeight: 600,
                            marginBottom: "8px",
                        }}
                        itemStyle={{
                            padding: "2px 0",
                        }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar
                        dataKey="admin"
                        name="Admin Role"
                        fill={COLORS[0]} // Purple
                        radius={[4, 4, 0, 0]}
                        animationDuration={750}
                    />
                    <Bar
                        dataKey="user"
                        name="User Role"
                        fill={COLORS[1]} // Green/Emerald or use COLORS[4] for Orange/Distinct
                        // Using Green (COLORS[1]) as it provides nice contrast with Purple (COLORS[0])
                        // and aligns with the system theme without being too similar to Purple
                        radius={[4, 4, 0, 0]}
                        animationDuration={750}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}

export function TopUsersBarChart({ data, className, color, nameKey = "name", valueKey = "count" }: ChartProps & { color: string, nameKey?: string, valueKey?: string }) {
    const { theme } = useTheme()
    const isDark = theme === "dark"
    const textColor = isDark ? "hsl(var(--muted-foreground))" : "hsl(var(--muted-foreground))"
    const gridColor = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipBg = isDark ? "hsl(var(--card))" : "hsl(var(--card))"
    const tooltipBorder = isDark ? "hsl(var(--border))" : "hsl(var(--border))"
    const tooltipText = isDark ? "hsl(var(--card-foreground))" : "hsl(var(--card-foreground))"
    const cursorFill = isDark ? "hsl(var(--muted) / 0.3)" : "hsl(var(--muted) / 0.2)"

    return (
        <div className={cn("w-full", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{
                        top: 5,
                        right: 10,
                        left: 10,
                        bottom: 0,
                    }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                        horizontal={false} // Different for vertical chart
                        opacity={0.3}
                    />
                    <XAxis
                        type="number"
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: textColor }}
                    />
                    <YAxis
                        dataKey={nameKey}
                        type="category"
                        stroke={textColor}
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        width={100} // Give space for names
                        tick={{ fill: textColor }}
                        tickFormatter={(value) => value.length > 15 ? `${value.substring(0, 12)}...` : value}
                    />
                    <Tooltip
                        cursor={{ fill: cursorFill, radius: 4 }}
                        contentStyle={{
                            backgroundColor: tooltipBg,
                            borderColor: tooltipBorder,
                            borderRadius: "8px",
                            color: tooltipText,
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
                            backdropFilter: "blur(12px)",
                            border: `1px solid ${tooltipBorder}`,
                            padding: "12px",
                        }}
                        labelStyle={{
                            color: tooltipText,
                            fontWeight: 600,
                            marginBottom: "8px",
                        }}
                        itemStyle={{
                            padding: "2px 0",
                        }}
                    />
                    <Bar
                        dataKey={valueKey}
                        fill={color}
                        radius={[0, 4, 4, 0]}
                        animationDuration={750}
                        barSize={32}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
