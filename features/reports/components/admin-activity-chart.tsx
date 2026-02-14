"use client"

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

interface AdminActivityChartProps {
    data: {
        labels: string[];
        datasets: {
            label: string;
            data: number[];
            backgroundColor: string;
            borderColor?: string;
            borderWidth?: number;
        }[];
    };
    className?: string;
    layout?: 'vertical' | 'horizontal';
}

export function AdminActivityChart({ data, className, layout = 'vertical' }: AdminActivityChartProps) {
    const { theme } = useTheme()
    const isDark = theme === "dark"

    const textColor = isDark ? "hsl(215 20.2% 65.1%)" : "hsl(215.4 16.3% 46.9%)"
    const gridColor = isDark ? "hsl(217.2 32.6% 17.5%)" : "hsl(214.3 31.8% 91.4%)"

    // Transform chart.js data format to recharts format
    const rechartsData = data.labels.map((label, index) => {
        const point: Record<string, string | number> = { name: label };
        data.datasets.forEach((dataset) => {
            point[dataset.label] = dataset.data[index] ?? 0;
        });
        return point;
    });

    const isHorizontal = layout === 'horizontal';

    return (
        <div className={cn("w-full h-full min-h-[300px]", className)}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={rechartsData}
                    layout={isHorizontal ? 'vertical' : 'horizontal'}
                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={gridColor}
                    />
                    {isHorizontal ? (
                        <>
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
                                axisLine={{ stroke: gridColor }}
                                tickLine={{ stroke: gridColor }}
                                width={100}
                            />
                        </>
                    ) : (
                        <>
                            <XAxis
                                dataKey="name"
                                tick={{ fill: textColor, fontSize: 11, fontFamily: "Inter, sans-serif" }}
                                axisLine={{ stroke: gridColor }}
                                tickLine={{ stroke: gridColor }}
                            />
                            <YAxis
                                tick={{ fill: textColor, fontSize: 11, fontFamily: "Inter, sans-serif" }}
                                axisLine={{ stroke: gridColor }}
                                tickLine={{ stroke: gridColor }}
                                allowDecimals={false}
                            />
                        </>
                    )}
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
                    <Legend
                        wrapperStyle={{
                            color: textColor,
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12,
                        }}
                        iconType="circle"
                    />
                    {data.datasets.map((dataset, index) => (
                        <Bar
                            key={dataset.label}
                            dataKey={dataset.label}
                            fill={dataset.backgroundColor}
                            stroke={dataset.borderColor}
                            strokeWidth={dataset.borderWidth || 0}
                            radius={isHorizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]}
                            animationDuration={800}
                            animationBegin={index * 100}
                        />
                    ))}
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
