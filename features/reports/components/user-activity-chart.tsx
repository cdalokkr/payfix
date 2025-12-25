"use client"

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

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

    const chartData = {
        labels: data.map(d => d.name),
        datasets: [
            {
                label: 'Activities',
                data: data.map(d => d.count),
                backgroundColor: color || (isDark ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.6)'),
                borderColor: color || 'rgb(16, 185, 129)',
                borderWidth: 1,
                borderRadius: 6,
                hoverBackgroundColor: color ? `${color}dd` : (isDark ? 'rgba(16, 185, 129, 0.9)' : 'rgba(16, 185, 129, 0.8)'),
            }
        ]
    };

    const options: ChartOptions<'bar'> = {
        indexAxis: 'y' as const,
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            delay: (context) => {
                let delay = 0;
                const ctx = context as { type: string; mode: string; dropped?: boolean; dataIndex: number; datasetIndex: number };
                if (ctx.type === 'data' && ctx.mode === 'default' && !ctx.dropped) {
                    delay = ctx.dataIndex * 100;
                }
                return delay;
            },
        },
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                backgroundColor: isDark ? 'hsl(222.2 84% 4.9%)' : 'hsl(0 0% 100%)',
                titleColor: isDark ? 'hsl(210 40% 98%)' : 'hsl(222.2 84% 4.9%)',
                bodyColor: isDark ? 'hsl(210 40% 98%)' : 'hsl(222.2 84% 4.9%)',
                borderColor: gridColor,
                borderWidth: 1,
                padding: 12,
                boxPadding: 4,
                usePointStyle: true,
            }
        },
        scales: {
            x: {
                grid: {
                    color: gridColor,
                },
                ticks: {
                    color: textColor,
                    font: {
                        family: "Inter, sans-serif",
                        size: 11
                    }
                }
            },
            y: {
                grid: {
                    display: false,
                },
                ticks: {
                    color: textColor,
                    font: {
                        family: "Inter, sans-serif",
                        size: 11
                    }
                }
            },
        },
    };

    return (
        <div className={cn("w-full h-full min-h-[300px]", className)}>
            <Bar options={options} data={chartData} />
        </div>
    );
}
