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

    const options: ChartOptions<'bar'> = {
        indexAxis: layout === 'horizontal' ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            delay: (context) => {
                let delay = 0;
                // Cast to any to access 'dropped' property which is not in ScriptableContext types
                // but is available at runtime during Chart.js animations
                const ctx = context as { type: string; mode: string; dropped?: boolean; dataIndex: number; datasetIndex: number };
                if (ctx.type === 'data' && ctx.mode === 'default' && !ctx.dropped) {
                    delay = ctx.dataIndex * 200 + ctx.datasetIndex * 100;
                }
                return delay;
            },
        },
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    color: textColor,
                    font: {
                        family: "Inter, sans-serif",
                        size: 12
                    },
                    usePointStyle: true,
                    pointStyle: 'circle'
                }
            },
            title: {
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
                    drawOnChartArea: layout === 'horizontal',
                },
                ticks: {
                    color: textColor,
                    font: {
                        family: "Inter, sans-serif",
                        size: 11
                    }
                },
                title: {
                    display: layout === 'vertical',
                    text: 'Activity Type',
                    color: textColor,
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            },
            y: {
                grid: {
                    color: gridColor,
                    drawOnChartArea: layout === 'vertical',
                },
                ticks: {
                    color: textColor,
                    font: {
                        family: "Inter, sans-serif",
                        size: 11
                    },
                    stepSize: 1
                },
                title: {
                    display: layout === 'horizontal',
                    text: 'Activity Type',
                    color: textColor,
                    font: {
                        size: 12,
                        weight: 'bold'
                    }
                }
            },
        },
        interaction: {
            mode: 'index',
            intersect: false,
        },
    };

    return (
        <div className={cn("w-full h-full min-h-[300px]", className)}>
            <Bar options={options} data={data} key={layout} />
        </div>
    );
}
