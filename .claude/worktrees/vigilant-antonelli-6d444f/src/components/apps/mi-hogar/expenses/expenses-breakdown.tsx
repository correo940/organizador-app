import { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const COLORS = [
    '#10b981', // green-800 500
    '#3b82f6', // Blue 500
    '#8b5cf6', // Violet 500
    '#f59e0b', // Amber 500
    '#ef4444', // Red 500
    '#06b6d4', // Cyan 500
    '#ec4899', // Pink 500
    '#6366f1', // Indigo 500
    '#84cc16', // Lime 500
    '#f97316', // Orange 500
];

interface CategoryData {
    name: string;
    value: number;
}

interface ExpensesBreakdownProps {
    data: CategoryData[];
    totalAmount: number;
    currency?: string;
}

export function ExpensesBreakdown({ data, totalAmount, currency = '€' }: ExpensesBreakdownProps) {
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    // Calculate percentages
    const detailedData = useMemo(() => {
        return data.map((item, index) => ({
            ...item,
            formattedValue: item.value.toFixed(2),
            percentage: totalAmount > 0 ? ((item.value / totalAmount) * 100).toFixed(1) : '0',
            color: COLORS[index % COLORS.length]
        })).sort((a, b) => b.value - a.value); // Sort by highest amount
    }, [data, totalAmount]);

    if (data.length === 0) {
        return (
            <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                <div className="h-40 flex flex-col items-center justify-center text-muted-foreground gap-2">
                    <Wallet className="w-8 h-8 opacity-50" />
                    <span>Sin gastos registrados</span>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-800" />
                    Desglose de Gastos
                </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <div className="flex flex-col gap-6 items-center">
                    {/* Chart Column */}
                    <div className="relative w-full h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={detailedData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={2}
                                    dataKey="value"
                                    onMouseEnter={(_, index) => setActiveIndex(index)}
                                    onMouseLeave={() => setActiveIndex(null)}
                                >
                                    {detailedData.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={entry.color}
                                            className="stroke-transparent outline-none transition-all duration-300"
                                            style={{
                                                filter: activeIndex === index ? 'drop-shadow(0px 0px 6px rgba(0,0,0,0.2))' : 'none',
                                                opacity: activeIndex === null || activeIndex === index ? 1 : 0.6,
                                                transform: activeIndex === index ? 'scale(1.05)' : 'scale(1)',
                                                transformOrigin: 'center',
                                            }}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip
                                    formatter={(value: number) => `${value.toFixed(2)}${currency}`}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                    itemStyle={{ color: '#1e293b' }}
                                />
                            </PieChart>
                        </ResponsiveContainer>

                        {/* Center Text */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</span>
                            <span className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                                {totalAmount.toFixed(0)}{currency}
                            </span>
                        </div>
                    </div>

                    {/* List Column */}
                    <div className="w-full flex flex-col gap-2">
                        {detailedData.map((item, index) => (
                            <div
                                key={item.name}
                                className={cn(
                                    "flex items-center justify-between p-2 rounded-lg transition-all",
                                    activeIndex === index ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                                )}
                                onMouseEnter={() => setActiveIndex(index)}
                                onMouseLeave={() => setActiveIndex(null)}
                            >
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div
                                        className="w-2 h-8 rounded-full shadow-sm shrink-0"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <div className="flex flex-col truncate">
                                        <span className="font-semibold text-sm text-slate-700 dark:text-slate-200 truncate">
                                            {item.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {item.percentage}% del total
                                        </span>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="block font-bold text-sm text-slate-900 dark:text-white">
                                        {item.formattedValue}{currency}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

