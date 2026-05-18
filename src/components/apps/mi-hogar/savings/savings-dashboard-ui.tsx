'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    ArrowUpRight,
    ArrowDownRight,
    Wallet,
    Target,
    PiggyBank,
    CreditCard,
    TrendingUp,
    Plus,
    List,
    MoreHorizontal,
    Sparkles,
    Landmark,
    Lock,
    ExternalLink,
    Search,
    Repeat,
    CalendarClock,
    Trash2,
    ReceiptText,
    Settings,
    ChevronDown,
    ArrowRight,
    ArrowDown,
    ArrowRightLeft,
    TrendingDown,
    RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getApiUrl } from '@/lib/api-utils';
import PendingBalanceTab from './pending-balance-tab';

// --- TYPES (Duplicated from page.tsx for decoupling) ---
export type BankAccount = {
    id: string;
    name: string;
    bank_name: string;
    color: string;
    password_id?: string;
    current_balance: number;
    logo_type: 'icon' | 'url';
    logo_url?: string;
    interest_rate?: number;
    include_in_total?: boolean;
    account_type?: 'libre' | 'objetivo' | 'bloqueada';
    // Envelope system
    parent_account_id?: string | null;
    envelope_spent?: number;
};

export type SavingsGoal = {
    id: string;
    name: string;
    target_amount: number;
    current_amount: number;
    deadline?: string;
    color: string;
    icon?: string;
    linked_account_id?: string;
    interest_rate?: number;
};

const BANK_LOGOS: Record<string, string> = {
    'BBVA': 'https://www.google.com/s2/favicons?domain=bbva.es&sz=128',
    'Santander': 'https://www.google.com/s2/favicons?domain=bancosantander.es&sz=128',
    'CaixaBank': 'https://www.google.com/s2/favicons?domain=caixabank.es&sz=128',
    'Sabadell': 'https://www.google.com/s2/favicons?domain=bancsabadell.com&sz=128',
    'ING': 'https://www.google.com/s2/favicons?domain=ing.es&sz=128',
    'Openbank': 'https://www.google.com/s2/favicons?domain=openbank.es&sz=128',
    'Revolut': 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128',
    'N26': 'https://www.google.com/s2/favicons?domain=n26.com&sz=128',
    'Trade Republic': 'https://www.google.com/s2/favicons?domain=traderepublic.com&sz=128',
    'Imagin': 'https://www.google.com/s2/favicons?domain=imagin.com&sz=128',
};

function getBankLogo(bankName?: string) {
    if (!bankName) return null;
    return BANK_LOGOS[bankName] || null;
}

export type MonthlyStats = {
    income: number;
    expense: number;
    savingsRate?: number;
};

export type RecurringItem = {
    id: string;
    name: string;
    amount: number;
    type: 'income' | 'expense';
    day_of_month?: number;
    category?: string;
    target_account_id?: string;
    end_date?: string;
    last_run_date?: string;
};

interface SavingsDashboardUIProps {
    accounts: BankAccount[];
    goals: SavingsGoal[];
    monthlyStats: { income: number; expense: number; savingsRate: number };
    accountStats?: Record<string, { income: number, expense: number }>;
    totalBalance: number;
    totalGoalSaved: number;
    chartData: any[];
    loading?: boolean;
    onAddAccount?: () => void;
    onAddGoal?: () => void;
    onAddTransaction?: () => void;
    onViewAccount?: (account: BankAccount) => void;
    recentTransactions?: { id: string, amount: number, date: string, description: string, account_id?: string }[];
    recurringItems?: RecurringItem[];
    onAddRecurring?: () => void;
    onDeleteRecurring?: (id: string) => void;
    userId?: string;
    onBalanceChange?: () => void;
    pendingTotal?: number;
    onResetData?: () => Promise<void>;
    selectedMonth?: Date;
    onSyncAll?: () => Promise<void>;
}

export default function SavingsDashboardUI({
    accounts,
    goals,
    monthlyStats,
    accountStats = {},
    totalBalance,
    totalGoalSaved,
    chartData,
    loading,
    onAddAccount,
    onAddGoal,
    onAddTransaction,
    onViewAccount,
    recentTransactions = [],
    recurringItems = [],
    onAddRecurring,
    onDeleteRecurring,
    userId,
    onBalanceChange,
    pendingTotal = 0,
    selectedMonth = new Date(),
    onSyncAll
}: SavingsDashboardUIProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'goals' | 'recurring' | 'pending'>('overview');

    const [aiInsight, setAiInsight] = useState<{ insight: string, metricHighlight: string, type: string } | null>(null);
    const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
    const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [expandedBanks, setExpandedBanks] = useState<string[]>([]);
    const [expandedSummaries, setExpandedSummaries] = useState<string[]>([]);
    const [chartTimeframe, setChartTimeframe] = useState<string>('1M');

    const compactCurrencyFormatter = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR',
        notation: 'compact',
        maximumFractionDigits: 1
    });

    const currencyFormatter = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: 'EUR'
    });

    const groupedAccounts = React.useMemo(() => {
        const groups: Record<string, BankAccount[]> = {};
        accounts.forEach(acc => {
            const bank = acc.bank_name || 'Otros';
            if (!groups[bank]) groups[bank] = [];
            groups[bank].push(acc);
        });
        return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    }, [accounts]);

    const balanceGrowth = React.useMemo(() => {
        if (!chartData || chartData.length < 30) return { percent: 0, isPositive: true };
        const oldBalance = chartData[chartData.length - 30].value;
        const newBalance = chartData[chartData.length - 1].value;
        if (oldBalance === 0) {
            return { percent: newBalance > 0 ? 100 : 0, isPositive: newBalance >= 0 };
        }
        const diff = newBalance - oldBalance;
        return {
            percent: (diff / oldBalance) * 100,
            isPositive: diff >= 0
        };
    }, [chartData]);

    const filteredChartData = React.useMemo(() => {
        if (!chartData || chartData.length === 0) return [];
        const today = new Date();
        let daysToTake = 30;
        if (chartTimeframe === '1M') daysToTake = 30;
        else if (chartTimeframe === '3M') daysToTake = 90;
        else if (chartTimeframe === '6M') daysToTake = 180;
        else if (chartTimeframe === '1A') daysToTake = 365;
        else if (chartTimeframe === 'YTD') {
            const startOfYear = new Date(today.getFullYear(), 0, 1);
            daysToTake = Math.floor((today.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
            if (daysToTake < 1) daysToTake = 1;
        }
        return chartData.slice(-daysToTake);
    }, [chartData, chartTimeframe]);

    const toggleBank = (bank: string) => {
        setExpandedBanks(prev => prev.includes(bank) ? prev.filter(b => b !== bank) : [...prev, bank]);
    };

    const [aiLoading, setAiLoading] = useState(true);
    const [aiError, setAiError] = useState(false);

    useEffect(() => {
        if (loading) {
            setAiLoading(true);
            return;
        }

        if (!monthlyStats || recentTransactions.length === 0) {
            setAiLoading(false);
            return;
        }

        const fetchInsight = async () => {
            const currentHash = `${monthlyStats.income}_${monthlyStats.expense}_${recentTransactions.length}`;
            const cachedInsight = localStorage.getItem('quioba_ai_insight_v2');
            const cachedHash = localStorage.getItem('quioba_ai_insight_v2_hash');
            const now = new Date().getTime();
            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 8000);

            if (cachedInsight && cachedHash === currentHash) {
                try {
                    setAiInsight(JSON.parse(cachedInsight));
                    setAiLoading(false);
                    window.clearTimeout(timeoutId);
                    return;
                } catch (e) {
                    console.error('Error parsing cached insight', e);
                }
            }

            setAiLoading(true);
            setAiError(false);
            try {
                const apiUrl = getApiUrl('api/financial-insights');
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ monthlyStats, recentTransactions }),
                    signal: controller.signal
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data && data.insight) {
                        setAiInsight(data);
                        localStorage.setItem('quioba_ai_insight_v2', JSON.stringify(data));
                        localStorage.setItem('quioba_ai_insight_v2_hash', currentHash);
                    } else {
                        setAiError(true);
                    }
                } else {
                    setAiError(true);
                }
            } catch (error) {
                console.error(error);
                setAiError(true);
            } finally {
                window.clearTimeout(timeoutId);
                setAiLoading(false);
            }
        };

        if (activeTab === 'overview') {
            fetchInsight();
        }
    }, [monthlyStats, recentTransactions, activeTab, loading]);

    // Calculate Recurring Stats
    const recurringIncome = recurringItems.filter(i => i.type === 'income').reduce((sum, i) => sum + i.amount, 0);
    const recurringExpense = recurringItems.filter(i => i.type === 'expense').reduce((sum, i) => sum + i.amount, 0);
    const expectedCashflow = recurringIncome - recurringExpense;

    // --- ANIMATION VARIANTS ---
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: { type: 'spring', stiffness: 100 }
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-800"></div>
            </div>
        );
    }

    return (
        <motion.div
            className="space-y-8"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* HERO SECTION - Cash Flow Card (Light/Minimal Style) */}
            <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] bg-green-50 dark:bg-green-950/40 p-6 md:p-8 text-slate-800 dark:text-slate-100 shadow-xl shadow-green-900/5 border-2 border-green-600/30 dark:border-green-800">
                {/* Decorative Background Elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-green-50 dark:bg-green-900/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl opacity-60 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-50 dark:bg-green-900/10 rounded-full translate-y-1/2 -translate-x-1/3 blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col gap-8">
                    {/* Top Row: Global Cash Flow Cascade & Quick Actions */}
                    <div className="flex flex-col xl:flex-row justify-between gap-8 items-start">
                        
                        {/* Cash Flow Timeline */}
                        <div className="flex-1 w-full max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-2">
                            {/* Start Balance */}
                            <div className="flex flex-col items-center sm:items-start text-center sm:text-left opacity-80">
                                <span className="text-xs font-medium tracking-wider uppercase mb-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Wallet className="w-3.5 h-3.5" /> Inicio Mes</span>
                                <span className="text-2xl font-light text-slate-700 dark:text-slate-300">
                                    {(totalBalance - monthlyStats.income + monthlyStats.expense).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>

                            <ArrowRight className="hidden sm:block w-5 h-5 text-slate-300 dark:text-slate-700" />
                            <ArrowDown className="block sm:hidden w-5 h-5 text-slate-300 dark:text-slate-700" />

                            {/* Income */}
                            <div className="flex flex-col items-center sm:items-start text-center sm:text-left bg-green-50 dark:bg-green-900/20 px-4 py-2 rounded-2xl border border-green-100 dark:border-green-800/50">
                                <span className="text-xs font-medium tracking-wider uppercase text-green-600 dark:text-green-400 mb-1 flex items-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5" /> Ingresos</span>
                                <span className="text-2xl font-bold text-green-700 dark:text-green-300">
                                    +{monthlyStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>

                            <ArrowRight className="hidden sm:block w-5 h-5 text-slate-300 dark:text-slate-700" />
                            <ArrowDown className="block sm:hidden w-5 h-5 text-slate-300 dark:text-slate-700" />

                            {/* Expense */}
                            <div className="flex flex-col items-center sm:items-start text-center sm:text-left bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-2xl border border-red-100 dark:border-red-800/50">
                                <span className="text-xs font-medium tracking-wider uppercase text-red-600 dark:text-red-400 mb-1 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5" /> Gastos</span>
                                <span className="text-2xl font-bold text-red-700 dark:text-red-300">
                                    -{monthlyStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>

                            <ArrowRight className="hidden sm:block w-5 h-5 text-slate-300 dark:text-slate-700" />
                            <ArrowDown className="block sm:hidden w-5 h-5 text-slate-300 dark:text-slate-700" />

                            {/* Net Result (Ahorro Neto) */}
                            <div className="flex flex-col items-center sm:items-start text-center sm:text-left bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                                <span className="text-xs font-medium tracking-wider uppercase text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1.5"><PiggyBank className="w-3.5 h-3.5" /> Resultado</span>
                                <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                                    {((monthlyStats.income - monthlyStats.expense) > 0 ? '+' : '')}{(monthlyStats.income - monthlyStats.expense).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>

                            <ArrowRight className="hidden sm:block w-5 h-5 text-slate-300 dark:text-slate-700" />
                            <ArrowDown className="block sm:hidden w-5 h-5 text-slate-300 dark:text-slate-700" />

                            {/* End Balance */}
                            <div className="flex flex-col items-center sm:items-end text-center sm:text-right">
                                <span className="text-xs font-medium tracking-wider uppercase mb-1 flex items-center gap-1.5 text-slate-500 dark:text-slate-400"><Wallet className="w-3.5 h-3.5" /> Fin Mes</span>
                                <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                                    {totalBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                                {onSyncAll && (
                                    <button
                                        onClick={() => {
                                            if (window.confirm('¿Re-sincronizar todos los saldos con el historial?')) {
                                                onSyncAll();
                                            }
                                        }}
                                        className="text-[10px] text-slate-400 hover:text-green-600 dark:hover:text-green-400 mt-1 flex items-center gap-1 transition-colors"
                                    >
                                        <RefreshCw className="w-3 h-3" /> Sincronizar saldos
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-row xl:flex-col gap-2 w-full xl:w-auto overflow-x-auto pb-2 xl:pb-0">
                            <Button onClick={() => setIsAddTransactionOpen(true)} className="flex-1 xl:flex-none bg-green-50 hover:bg-green-100 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800 shadow-none justify-start whitespace-nowrap">
                                <Plus className="w-4 h-4 mr-2" />
                                <span className="text-sm">Ingreso / Gasto</span>
                            </Button>
                            <Button onClick={() => setIsTransferOpen(true)} className="flex-1 xl:flex-none bg-slate-50 hover:bg-slate-100 dark:bg-slate-900/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-none justify-start whitespace-nowrap">
                                <ArrowRightLeft className="w-4 h-4 mr-2 opacity-70" />
                                <span className="text-sm">Transferir</span>
                            </Button>
                        </div>
                    </div>

                    {/* Bottom Row: Per Account Breakdown */}
                    {Object.keys(accountStats).length > 0 && (
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                            <p className="text-xs font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-3">Desglose por Cuentas</p>
                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                                {Object.entries(accountStats).map(([accountId, stats]) => {
                                    if (stats.income === 0 && stats.expense === 0) return null;
                                    const account = accounts.find(a => a.id === accountId);
                                    if (!account) return null;

                                    return (
                                        <div key={accountId} className="snap-start shrink-0 bg-white dark:bg-slate-900/50 border border-green-100/50 dark:border-slate-800 rounded-xl p-3 min-w-[140px] flex flex-col gap-2">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm" style={{ backgroundColor: account.color || '#166534' }}>
                                                    {account.bank_name?.charAt(0) || <Landmark className="w-3 h-3" />}
                                                </div>
                                                <span className="text-xs font-medium truncate text-slate-700 dark:text-slate-300">{account.name}</span>
                                            </div>
                                            {stats.income > 0 && (
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-500 dark:text-slate-400">Ingresos</span>
                                                    <span className="text-green-600 dark:text-green-400 font-semibold">+{stats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                                </div>
                                            )}
                                            {stats.expense > 0 && (
                                                <div className="flex justify-between items-center text-[11px]">
                                                    <span className="text-slate-500 dark:text-slate-400">Gastos</span>
                                                    <span className="text-red-600 dark:text-red-400 font-semibold">-{stats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* NAVIGATION TABS (Pills) */}
            <div className="flex justify-center">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 flex gap-1 relative overflow-x-auto">
                    {(['overview', 'accounts', 'goals', 'recurring', 'pending'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`
                                relative px-4 md:px-6 py-2.5 rounded-xl text-sm font-medium transition-colors z-10 flex items-center gap-2 whitespace-nowrap
                                ${activeTab === tab ? 'text-white' : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}
                            `}
                        >
                            {activeTab === tab && (
                                <motion.div
                                    layoutId="activeTab"
                                    className={`absolute inset-0 rounded-xl ${tab === 'overview' ? 'bg-green-800' :
                                        tab === 'accounts' ? 'bg-blue-600' :
                                            tab === 'goals' ? 'bg-amber-600' :
                                                tab === 'recurring' ? 'bg-purple-600' :
                                                    'bg-orange-600'
                                        }`}
                                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="relative z-10 flex items-center gap-2">
                                {tab === 'overview' && <TrendingUp className="w-4 h-4" />}
                                {tab === 'accounts' && <CreditCard className="w-4 h-4" />}
                                {tab === 'goals' && <Target className="w-4 h-4" />}
                                {tab === 'recurring' && <Repeat className="w-4 h-4" />}
                                {tab === 'pending' && <ReceiptText className="w-4 h-4" />}
                                {tab === 'overview' ? 'Resumen' : tab === 'accounts' ? 'Cuentas' : tab === 'goals' ? 'Metas' : tab === 'recurring' ? 'Fijos' : 'Balance Pendiente'}
                                {tab === 'pending' && pendingTotal > 0 && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === 'pending' ? 'bg-white/20' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300'}`}>
                                        {pendingTotal.toLocaleString('es-ES', { notation: 'compact', compactDisplay: 'short', currency: 'EUR', style: 'currency' })}
                                    </span>
                                )}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* CONTENT AREA */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="min-h-[400px]"
                >
                    {activeTab === 'overview' && (
                        <div className="flex flex-col gap-6">
                            {/* TOP KPI CARDS (Compact) */}
                            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                <motion.div variants={itemVariants}>
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-sm bg-green-50 dark:bg-green-950/40 backdrop-blur-md hover:shadow-md transition-all">
                                        <CardContent className="p-3.5 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Ingresos</span>
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{monthlyStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                            </div>
                                            <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 flex items-center justify-center shrink-0">
                                                <ArrowDownRight className="w-4 h-4" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                                <motion.div variants={itemVariants}>
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-sm bg-green-50 dark:bg-green-950/40 backdrop-blur-md hover:shadow-md transition-all">
                                        <CardContent className="p-3.5 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Gastos</span>
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{monthlyStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                            </div>
                                            <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                                                <ArrowUpRight className="w-4 h-4" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                                <motion.div variants={itemVariants}>
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-sm bg-green-50 dark:bg-green-950/40 backdrop-blur-md hover:shadow-md transition-all">
                                        <CardContent className="p-3.5 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Ahorro Neto</span>
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{(monthlyStats.income - monthlyStats.expense).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                            </div>
                                            <div className="w-9 h-9 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                                <PiggyBank className="w-4 h-4" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                                <motion.div variants={itemVariants}>
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-sm bg-green-50 dark:bg-green-950/40 backdrop-blur-md hover:shadow-md transition-all">
                                        <CardContent className="p-3.5 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5 block">Tasa de Ahorro</span>
                                                <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{(monthlyStats.savingsRate || 0).toFixed(1)}%</span>
                                            </div>
                                            <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                                <Target className="w-4 h-4" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </motion.div>

                            {/* BENTO GRID MAIN AREA */}
                            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                                {/* AI Insights Banner (Full Width) */}
                                <motion.div variants={itemVariants} className="lg:col-span-12">
                                    <div className="relative overflow-hidden rounded-xl bg-blue-50 dark:bg-blue-950/40 text-slate-800 dark:text-slate-100 shadow-md border border-blue-500/30 dark:border-blue-800">
                                        <div className="p-3 md:p-4 backdrop-blur-md flex flex-col md:flex-row items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center border border-blue-200 dark:border-blue-800 shrink-0">
                                                {aiLoading ? (
                                                    <Sparkles className="w-5 h-5 text-blue-500 dark:text-blue-400 animate-pulse" />
                                                ) : (
                                                    <Sparkles className="w-5 h-5 text-blue-600 dark:text-blue-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 text-center md:text-left">
                                                {aiLoading ? (
                                                    <div className="h-4 bg-blue-200 dark:bg-blue-800/50 rounded w-2/3 animate-pulse"></div>
                                                ) : aiInsight ? (
                                                    <p className="text-blue-900 dark:text-blue-100 text-sm font-medium leading-snug">
                                                        {aiInsight.insight}
                                                    </p>
                                                ) : (
                                                    <p className="text-blue-600/60 dark:text-blue-300/60 text-sm italic">Quioba IA está analizando tus movimientos...</p>
                                                )}
                                            </div>
                                            {aiInsight?.metricHighlight && (
                                                <div className="shrink-0 bg-white dark:bg-slate-900/50 rounded-lg px-3 py-1.5 flex items-center gap-2 border border-blue-200 dark:border-blue-800/50">
                                                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300">{aiInsight.metricHighlight}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>

                                {/* Chart Card Area (Left 8 cols) */}
                                <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col gap-4">
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-md shadow-green-900/5 dark:shadow-none bg-green-50 dark:bg-green-950/40 backdrop-blur-xl">
                                        <CardHeader className="pb-0 pt-4 px-5">
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <CardTitle className="text-sm flex items-center gap-2">
                                                        <TrendingUp className="w-4 h-4 text-green-700 dark:text-green-400" />
                                                        Evolución Patrimonial
                                                    </CardTitle>
                                                </div>
                                                <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-md">
                                                    {['1M', '3M', '6M', 'YTD', '1A'].map((period) => (
                                                        <button
                                                            key={period}
                                                            onClick={() => setChartTimeframe(period)}
                                                            className={`text-[10px] px-2 py-1 rounded font-bold transition-all ${chartTimeframe === period ? 'bg-white dark:bg-slate-700 shadow-sm text-green-800 dark:text-green-300' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                                                        >
                                                            {period}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="h-[240px] px-2 pb-2 mt-2">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <AreaChart data={filteredChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#166534" stopOpacity={0.6} />
                                                            <stop offset="95%" stopColor="#166534" stopOpacity={0} />
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.3} />
                                                    <XAxis
                                                        dataKey="date"
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                                        dy={5}
                                                        minTickGap={20}
                                                    />
                                                    <YAxis
                                                        axisLine={false}
                                                        tickLine={false}
                                                        tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                                                        tickFormatter={(value) => `${value / 1000}k`}
                                                        dx={10}
                                                        domain={['auto', 'auto']}
                                                    />
                                                    <Tooltip
                                                        contentStyle={{
                                                            backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                            backdropFilter: 'blur(12px)',
                                                            borderRadius: '8px',
                                                            border: 'none',
                                                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                                                        }}
                                                        itemStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '14px' }}
                                                        formatter={(value: number) => [`${value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}`, 'Patrimonio']}
                                                    />
                                                    <Area type="monotone" dataKey="value" stroke="#166534" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </CardContent>
                                    </Card>

                                    {/* Condensend Recent Transactions */}
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-md shadow-green-900/5 dark:shadow-none bg-green-50 dark:bg-green-950/40 backdrop-blur-xl">
                                        <CardHeader className="py-3 px-5 border-b border-slate-100 dark:border-slate-800">
                                            <CardTitle className="text-sm font-semibold flex items-center justify-between">
                                                <span>Últimos Movimientos</span>
                                                <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2 hover:bg-green-50 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400">Ver todos</Button>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                                {recentTransactions.slice(0, 4).map(tx => {
                                                    const account = accounts.find(a => a.id === tx.account_id);
                                                    return (
                                                        <div key={tx.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 flex items-center justify-center rounded-lg ${tx.amount > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/40' : 'bg-slate-100 text-slate-600 dark:bg-slate-800'}`}>
                                                                    {tx.amount > 0 ? <ArrowUpRight className="w-4 h-4" /> : <CreditCard className="w-4 h-4" />}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">{tx.description || 'Gasto General'}</p>
                                                                    <p className="text-[10px] text-muted-foreground font-medium truncate">{format(new Date(tx.date), 'd MMM', { locale: es })} • {account?.bank_name || 'Tarjeta'}</p>
                                                                </div>
                                                            </div>
                                                            <span className={`text-sm font-bold tracking-tight ${tx.amount > 0 ? 'text-green-700 dark:text-green-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                            </span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>

                                {/* Right Column (4 cols) */}
                                <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col gap-4">
                                    {/* Distribution Chart */}
                                    <Card className="border-2 border-green-600/30 dark:border-green-800 shadow-md shadow-green-900/5 dark:shadow-none bg-green-50 dark:bg-green-950/40 backdrop-blur-xl flex-grow flex flex-col">
                                        <CardHeader className="py-4 px-5">
                                            <CardTitle className="text-sm font-semibold text-slate-800 dark:text-slate-200">Distribución de Activos</CardTitle>
                                        </CardHeader>
                                        <CardContent className="px-5 pb-5 flex flex-col flex-grow">
                                            <div className="h-[180px] w-full flex items-center justify-center relative">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={accounts}
                                                            dataKey="current_balance"
                                                            nameKey="bank_name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={55}
                                                            outerRadius={75}
                                                            paddingAngle={3}
                                                            stroke="none"
                                                        >
                                                            {accounts.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color || '#166534'} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip
                                                            contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                                                            formatter={(value: number) => value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                                                        />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Liquidez</span>
                                                    <span className="text-lg font-black text-slate-800 dark:text-white mt-0.5">
                                                        {totalBalance.toLocaleString('es-ES', { notation: 'compact', compactDisplay: 'short', currency: 'EUR', style: 'currency' })}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="mt-4 space-y-2.5 flex-grow">
                                                {accounts.map(acc => (
                                                    <div key={acc.id} className="flex justify-between items-center text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: acc.color }} />
                                                            <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[100px]">{acc.name}</span>
                                                        </div>
                                                        <span className="font-bold text-slate-400 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">{Math.round((acc.current_balance / totalBalance) * 100) || 0}%</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            </motion.div>
                        </div>
                    )}

                    {activeTab === 'accounts' && (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                        >
                            <motion.div
                                variants={itemVariants}
                                onClick={onAddAccount}
                                whileHover={{ scale: 1.02, y: -4 }}
                                whileTap={{ scale: 0.98 }}
                                className="cursor-pointer group relative overflow-hidden rounded-[1.5rem] border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 flex flex-col items-center justify-center gap-4 hover:border-green-800/50 hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-colors min-h-[220px]"
                            >
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-green-100 dark:group-hover:bg-green-900 transition-colors">
                                    <Plus className="w-8 h-8 text-slate-400 group-hover:text-green-800 dark:text-slate-500 dark:group-hover:text-green-300" />
                                </div>
                                <p className="font-medium text-slate-500 group-hover:text-green-800 dark:text-slate-400">Añadir Nueva Cuenta</p>
                            </motion.div>

                            {groupedAccounts.map(([bankName, bankAccounts]) => {
                                const isExpanded = expandedBanks.includes(bankName);
                                const totalBalance = bankAccounts.reduce((sum, acc) => sum + acc.current_balance, 0);
                                const totalAccounts = bankAccounts.length;
                                const firstLogo = bankAccounts.find(a => a.logo_url)?.logo_url;
                                const firstColor = bankAccounts.find(a => a.color)?.color || '#166534';

                                const currentMonth = selectedMonth.getMonth();
                                const currentYear = selectedMonth.getFullYear();

                                // Accumulated bank income/expenses
                                let bankIncome = 0;
                                let bankExpense = 0;
                                bankAccounts.forEach(account => {
                                    const accountTransactions = recentTransactions.filter(tx => tx.account_id === account.id);
                                    accountTransactions.forEach(tx => {
                                        const d = new Date(tx.date);
                                        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                                            if (tx.amount > 0) bankIncome += tx.amount;
                                            else bankExpense += Math.abs(tx.amount);
                                        }
                                    });
                                });

                                return (
                                    <React.Fragment key={`group-${bankName}`}>
                                        {/* TARJETA CAJA RECOLECTORA DEL BANCO */}
                                        <motion.div
                                            variants={itemVariants}
                                            onClick={() => toggleBank(bankName)}
                                            whileHover={{ scale: 1.02, y: -4 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="relative overflow-hidden rounded-[1.5rem] text-white shadow-xl group cursor-pointer transition-shadow hover:shadow-2xl"
                                            style={{
                                                background: `linear-gradient(135deg, ${firstColor}, ${firstColor}dd)`
                                            }}
                                        >
                                            <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                                            <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
                                            <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                                            <div className="relative p-6 h-full flex flex-col justify-between min-h-[220px]">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="font-medium text-white/80 text-sm">Resumen de Banco</p>
                                                        </div>
                                                        <h3 className="font-bold text-2xl tracking-tight">{bankName}</h3>
                                                    </div>
                                                    {firstLogo ? (
                                                        <div className="w-12 h-12 bg-white rounded-lg p-1 shadow-sm shrink-0">
                                                            <img src={firstLogo} alt={bankName} className="w-full h-full object-contain" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0">
                                                            <Landmark className="w-6 h-6" />
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-4 mt-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 flex items-center gap-2">
                                                            <Wallet className="w-4 h-4 text-white" />
                                                            <span className="text-sm font-semibold">{totalAccounts} {totalAccounts === 1 ? 'cuenta' : 'cuentas'}</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-center bg-black/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                                                        <div>
                                                            <p className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Ingresos Tot.</p>
                                                            <p className="font-bold text-green-300">{currencyFormatter.format(bankIncome)}</p>
                                                        </div>
                                                        <div className="h-6 w-px bg-white/20" />
                                                        <div>
                                                            <p className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Gastos Tot.</p>
                                                            <p className="font-bold text-rose-300">{currencyFormatter.format(bankExpense)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-between items-end border-t border-white/10 pt-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="text-[10px] text-white/70 uppercase tracking-widest">Patrimonio Físico Total</p>
                                                            </div>
                                                            <p className="text-3xl font-black tracking-tight drop-shadow-sm">
                                                                {currencyFormatter.format(totalBalance)}
                                                            </p>


                                                            {(() => {
                                                                let owedToAdd = 0;
                                                                bankAccounts.forEach(acc => {
                                                                    const linkedEnvelopes = accounts.filter(globalAcc => globalAcc.parent_account_id === acc.id);
                                                                    owedToAdd += linkedEnvelopes.reduce((sum, env) => sum + (env.envelope_spent || 0), 0);
                                                                });

                                                                if (owedToAdd > 0) {
                                                                    return (
                                                                        <div className="flex flex-col mt-1.5">
                                                                            <p className="text-[11px] font-bold text-green-300">
                                                                                ✨ Patrimonio Real: {currencyFormatter.format(totalBalance + owedToAdd)}
                                                                            </p>
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                        </div>
                                                    </div>

                                                    {/* THREE BUTTONS TO TOGGLE DATA OR OPERATE */}
                                                    <div className="flex gap-2 mt-4 pt-4 border-t border-white/10" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const candidates = bankAccounts.filter(a => !a.parent_account_id);
                                                                const principal = candidates.find(a => a.name.toLowerCase().includes(bankName.toLowerCase())) ||
                                                                    candidates.sort((a, b) => (b.current_balance || 0) - (a.current_balance || 0))[0] ||
                                                                    bankAccounts[0];
                                                                if (principal && onViewAccount) onViewAccount(principal);
                                                            }}
                                                            className="flex-1 bg-green-800/80 hover:bg-green-800 text-white text-[11px] uppercase tracking-wider font-bold py-2.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-green-700/30"
                                                        >
                                                            <Plus className="w-4 h-4 shrink-0" />
                                                            <span className="truncate">Operar</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setExpandedSummaries(prev => prev.includes(bankName) ? prev.filter(b => b !== bankName) : [...prev, bankName]);
                                                            }}
                                                            className="flex-1 bg-black/20 hover:bg-black/30 text-white text-[11px] uppercase tracking-wider font-bold py-2.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors border border-white/5"
                                                        >
                                                            <List className="w-4 h-4 shrink-0" />
                                                            <span className="truncate">{expandedSummaries.includes(bankName) ? 'Ocultar' : 'Resumen'}</span>
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                toggleBank(bankName);
                                                            }}
                                                            className="flex-1 bg-white/20 hover:bg-white/30 text-white text-[11px] uppercase tracking-wider font-bold py-2.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
                                                        >
                                                            <CreditCard className="w-4 h-4 shrink-0" />
                                                            <span className="truncate">{isExpanded ? 'Ocultar' : 'Cuentas'}</span>
                                                            <ChevronDown className="w-3.5 h-3.5 shrink-0 transition-transform duration-300" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                                                        </button>
                                                    </div>

                                                    <AnimatePresence>
                                                        {expandedSummaries.includes(bankName) && (
                                                            <motion.div
                                                                initial={{ opacity: 0, height: 0 }}
                                                                animate={{ opacity: 1, height: 'auto' }}
                                                                exit={{ opacity: 0, height: 0 }}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="overflow-hidden mt-3"
                                                            >
                                                                <div className="flex flex-col gap-1.5">
                                                                    {bankAccounts.map(acc => {
                                                                        const isEnv = !!acc.parent_account_id;
                                                                        const envSpent = acc.envelope_spent || 0;
                                                                        const disp = acc.current_balance - envSpent;

                                                                        return (
                                                                            <div
                                                                                key={acc.id}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    if (onViewAccount) onViewAccount(acc);
                                                                                }}
                                                                                className="flex flex-col gap-1 bg-black/10 hover:bg-black/20 rounded-lg px-3 py-2 border border-white/5 shadow-inner cursor-pointer transition-colors"
                                                                            >
                                                                                <div className="flex justify-between items-center text-xs">
                                                                                    <span className="text-white/90 font-medium truncate pr-2 flex items-center gap-1.5 transition-colors group-hover:text-white">
                                                                                        {isEnv ? <span className="text-amber-300">🗂</span> : <span className="text-green-300">💳</span>}
                                                                                        {acc.name}
                                                                                    </span>
                                                                                    <span className="font-bold text-white group-hover:scale-105 transition-transform">
                                                                                        {currencyFormatter.format(acc.current_balance)}
                                                                                    </span>
                                                                                </div>
                                                                                {isEnv && (
                                                                                    <div className="flex justify-between items-center text-[10px] pl-6 pb-0.5">
                                                                                        <span className="text-green-200 opacity-90">Disp. a gastar: {currencyFormatter.format(disp)}</span>
                                                                                        {envSpent > 0 && <span className="text-rose-300 font-medium opacity-90">Adeudado: {currencyFormatter.format(envSpent)}</span>}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>


                                                </div>
                                            </div>
                                        </motion.div>

                                        {/* TARJETAS DESPLEGADAS HIJAS */}
                                        <AnimatePresence>
                                            {isExpanded && bankAccounts.map((account) => {
                                                let accIncome = 0;
                                                let accExpense = 0;
                                                const accountTransactions = recentTransactions.filter(tx => tx.account_id === account.id);
                                                accountTransactions.forEach(tx => {
                                                    const d = new Date(tx.date);
                                                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                                                        if (tx.amount > 0) accIncome += tx.amount;
                                                        else accExpense += Math.abs(tx.amount);
                                                    }
                                                });

                                                const isEnvelope = !!account.parent_account_id;
                                                const envelopeSpent = account.envelope_spent || 0;
                                                const parentAccount = isEnvelope ? accounts.find(a => a.id === account.parent_account_id) : null;
                                                const linkedEnvelopes = !isEnvelope ? accounts.filter(a => a.parent_account_id === account.id && (a.envelope_spent || 0) > 0) : [];
                                                const totalOwedByEnvelopes = linkedEnvelopes.reduce((sum, e) => sum + (e.envelope_spent || 0), 0);

                                                return (
                                                    <motion.div
                                                        key={`child-${account.id}`}
                                                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -20, transition: { duration: 0.2 } }}
                                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                                        onClick={() => onViewAccount && onViewAccount(account)}
                                                        whileHover={{ scale: 1.02, y: -4 }}
                                                        whileTap={{ scale: 0.98 }}
                                                        className="relative overflow-hidden rounded-[1.5rem] text-white shadow-lg group cursor-pointer transition-shadow hover:shadow-xl border-2 border-white/20 dark:border-white/10"
                                                        style={{ background: `linear-gradient(135deg, ${account.color || '#166534'}, ${account.color ? account.color : '#14532d'})` }}
                                                    >
                                                        <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                                                        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent pointer-events-none" />
                                                        <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />

                                                        <div className="relative p-6 h-full flex flex-col justify-between min-h-[220px]">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                                        <div className="inline-flex items-center justify-center p-1 bg-white/20 rounded-md">
                                                                            <ArrowDownRight className="w-3 h-3 text-white" />
                                                                        </div>
                                                                        <p className="font-medium text-white/80 text-sm">De {account.bank_name}</p>
                                                                        {isEnvelope && (
                                                                            <span className="text-[10px] font-bold bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/30">
                                                                                🗂 Sobre de {parentAccount?.name || '...'}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h3 className="font-bold text-xl tracking-tight">{account.name}</h3>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex gap-1">
                                                                        {[1, 2, 3, 4].map(i => <div key={i} className="w-2 h-2 rounded-full bg-white/40" />)}
                                                                    </div>
                                                                    <span className="text-white/60 font-mono text-sm ml-2">•••• {account.id.substring(0, 4)}</span>
                                                                </div>

                                                                <div className="flex justify-between items-center bg-black/10 rounded-xl p-3 backdrop-blur-sm border border-white/10">
                                                                    <div>
                                                                        <p className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Ingresos ({format(selectedMonth, 'MMM', { locale: es })})</p>
                                                                        <p className="font-bold text-green-300">{currencyFormatter.format(accIncome)}</p>
                                                                    </div>
                                                                    <div className="h-6 w-px bg-white/20" />
                                                                    <div>
                                                                        <p className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Gastos ({format(selectedMonth, 'MMM', { locale: es })})</p>
                                                                        <p className="font-bold text-rose-300">{currencyFormatter.format(accExpense)}</p>
                                                                    </div>
                                                                    <div className="h-6 w-px bg-white/20" />
                                                                    <div>
                                                                        <p className="text-[10px] text-white/60 uppercase tracking-widest mb-0.5">Dif.</p>
                                                                        <p className={`font-bold ${(accIncome - accExpense) >= 0 ? 'text-white' : 'text-rose-200'}`}>{currencyFormatter.format(accIncome - accExpense)}</p>
                                                                    </div>
                                                                </div>

                                                                {isEnvelope ? (
                                                                    <div className="space-y-1.5 mt-2">
                                                                        <div className="flex justify-between items-end">
                                                                            <div>
                                                                                <p className="text-[10px] text-white/70 uppercase tracking-widest mb-1">Acumulado ({account.bank_name})</p>
                                                                                <p className="text-3xl font-bold tracking-tight">
                                                                                    {currencyFormatter.format(account.current_balance)}
                                                                                </p>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-white/10">
                                                                            <div className="flex justify-between items-center text-sm">
                                                                                <p className="text-green-200/90 font-medium">✨ Disponible para gastar</p>
                                                                                <p className="font-bold text-green-300">{currencyFormatter.format(account.current_balance - envelopeSpent)}</p>
                                                                            </div>
                                                                            {envelopeSpent > 0 && (
                                                                                <div className="flex justify-between items-center text-sm">
                                                                                    <p className="text-amber-200/80 font-medium">⚠️ Adeuda a {parentAccount?.name || 'cuenta principal'}</p>
                                                                                    <p className="font-bold text-amber-300">-{currencyFormatter.format(envelopeSpent)}</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-1.5 mt-2">
                                                                        <div className="flex justify-between items-end">
                                                                            <div>
                                                                                <p className="text-[10px] text-white/70 uppercase tracking-widest mb-1">Saldo Disponible</p>
                                                                                <p className="text-3xl font-bold tracking-tight">
                                                                                    {currencyFormatter.format(account.current_balance)}
                                                                                </p>
                                                                            </div>
                                                                            {account.interest_rate && (
                                                                                <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                                                                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                                                                    <span className="font-bold text-sm">{account.interest_rate}% TAE</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {linkedEnvelopes.length > 0 && (
                                                                            <div className="bg-black/20 rounded-xl p-2.5 border border-white/10 space-y-1 mt-1">
                                                                                <p className="text-[9px] text-white/50 uppercase tracking-widest mb-1.5">Pendiente de sobres</p>
                                                                                {linkedEnvelopes.map(env => (
                                                                                    <div key={env.id} className="flex justify-between items-center text-xs">
                                                                                        <span className="text-white/70 truncate max-w-[130px]">🗂 {env.name}</span>
                                                                                        <span className="font-bold text-amber-300">{currencyFormatter.format(env.envelope_spent || 0)}</span>
                                                                                    </div>
                                                                                ))}
                                                                                <div className="border-t border-white/10 pt-1 flex justify-between items-center text-xs">
                                                                                    <span className="text-white/80 font-semibold">Patrimonio real</span>
                                                                                    <span className="font-bold text-green-300">{currencyFormatter.format(account.current_balance + totalOwedByEnvelopes)}</span>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </motion.div>
                                                );
                                            })}
                                        </AnimatePresence>
                                    </React.Fragment>
                                );
                            })}
                        </motion.div>
                    )}

                    {activeTab === 'goals' && (
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            <motion.div variants={itemVariants} onClick={onAddGoal} className="cursor-pointer group relative overflow-hidden rounded-[1.5rem] border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 flex flex-col items-center justify-center gap-4 hover:border-green-800/50 hover:bg-green-50/50 dark:hover:bg-green-950/10 transition-all min-h-[200px]">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-green-100 dark:group-hover:bg-green-900 transition-colors">
                                    <Plus className="w-8 h-8 text-slate-400 group-hover:text-green-800 dark:text-slate-500 dark:group-hover:text-green-400" />
                                </div>
                                <p className="font-medium text-slate-500 group-hover:text-green-800 dark:text-slate-400">Crear Nueva Meta</p>
                            </motion.div>

                            {goals.map(goal => (
                                <motion.div
                                    key={goal.id}
                                    variants={itemVariants}
                                    className="bg-green-50 dark:bg-green-950/40 border-2 border-green-600/30 dark:border-green-800 rounded-[1.5rem] p-6 shadow-xl shadow-green-900/5 dark:shadow-none relative overflow-hidden"
                                >
                                    <div className="absolute top-0 left-0 w-2 h-full" style={{ backgroundColor: goal.color }} />
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: goal.color }}>
                                                <Target className="w-5 h-5" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-lg">{goal.name}</h3>
                                                <p className="text-sm text-muted-foreground">{goal.interest_rate ? `${goal.interest_rate}% Interés` : 'Sin interés'}</p>
                                            </div>
                                        </div>
                                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-xs font-medium">
                                            {Math.round((goal.current_amount / goal.target_amount) * 100)}%
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-4">
                                        <div className="flex justify-between text-sm font-medium">
                                            <span>{goal.current_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                            <span className="text-muted-foreground">{goal.target_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</span>
                                        </div>
                                        <Progress value={(goal.current_amount / goal.target_amount) * 100} className="h-2.5" />
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>

                    )
                    }

                    {
                        activeTab === 'recurring' && (
                            <motion.div
                                variants={containerVariants}
                                initial="hidden"
                                animate="visible"
                                className="space-y-6"
                            >
                                {/* Summary Card */}
                                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <Card className="border-none shadow-lg shadow-green-200/40 dark:shadow-none bg-gradient-to-br from-green-50 to-green-50 dark:from-green-950/20 dark:to-green-800-950/20 backdrop-blur-xl">
                                        <CardContent className="p-6 flex flex-col justify-between h-full">
                                            <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                                                <CalendarClock className="w-5 h-5" />
                                                <h3 className="font-semibold">Flujo Mensual Estimado</h3>
                                            </div>
                                            <div>
                                                <p className="text-3xl font-bold text-slate-800 dark:text-slate-100 mt-2">
                                                    {expectedCashflow > 0 ? '+' : ''}{expectedCashflow.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                </p>
                                                <p className="text-sm text-muted-foreground mt-1">Lo que te queda tras gastos fijos</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-none shadow-none bg-green-50/50 dark:bg-green-950/10">
                                        <CardContent className="p-6">
                                            <p className="text-sm text-green-800 font-medium mb-1">Ingresos Fijos</p>
                                            <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                                                {recurringIncome.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </p>
                                        </CardContent>
                                    </Card>

                                    <Card className="border-none shadow-none bg-rose-50/50 dark:bg-rose-950/10">
                                        <CardContent className="p-6">
                                            <p className="text-sm text-rose-600 font-medium mb-1">Gastos Fijos</p>
                                            <p className="text-2xl font-bold text-rose-700 dark:text-rose-400">
                                                {recurringExpense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                            </p>
                                        </CardContent>
                                    </Card>
                                </motion.div>

                                {/* Add Button */}
                                <div className="flex justify-end">
                                    <Button onClick={onAddRecurring} className="bg-green-800 hover:bg-green-900 text-white gap-2 rounded-full px-6 shadow-lg shadow-green-500/20">
                                        <Plus className="w-5 h-5" /> Añadir Fijo
                                    </Button>
                                </div>

                                {/* Lists */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    {/* Incomes List */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-green-800 flex items-center gap-2"><ArrowUpRight className="w-4 h-4" /> Ingresos Recurrentes</h4>
                                        {recurringItems.filter(i => i.type === 'income').length === 0 ? (
                                            <div className="p-4 border border-dashed border-green-200 rounded-xl text-center text-sm text-muted-foreground">No tienes ingresos fijos</div>
                                        ) : (
                                            recurringItems.filter(i => i.type === 'income').map(item => (
                                                <motion.div variants={itemVariants} key={item.id} className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-950/40 rounded-xl border-2 border-green-600/30 dark:border-green-800 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-800 text-xs font-bold">
                                                            {item.day_of_month || 1}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{item.name}</p>
                                                            <p className="text-xs text-muted-foreground">Día {item.day_of_month}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-green-800">+{item.amount}€</span>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDeleteRecurring && onDeleteRecurring(item.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>

                                    {/* Expenses List */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-rose-600 flex items-center gap-2"><ArrowDownRight className="w-4 h-4" /> Gastos Recurrentes</h4>
                                        {recurringItems.filter(i => i.type === 'expense').length === 0 ? (
                                            <div className="p-4 border border-dashed border-rose-200 rounded-xl text-center text-sm text-muted-foreground">No tienes gastos fijos</div>
                                        ) : (
                                            recurringItems.filter(i => i.type === 'expense').map(item => (
                                                <motion.div variants={itemVariants} key={item.id} className="flex justify-between items-center p-4 bg-green-50 dark:bg-green-950/40 rounded-xl border-2 border-green-600/30 dark:border-green-800 shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 text-xs font-bold">
                                                            {item.day_of_month || 1}
                                                        </div>
                                                        <div>
                                                            <p className="font-medium">{item.name}</p>
                                                            <p className="text-xs text-muted-foreground">Día {item.day_of_month}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="font-bold text-rose-600">-{item.amount}€</span>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => onDeleteRecurring && onDeleteRecurring(item.id)}>
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        )
                    }

                    {
                        activeTab === 'pending' && userId && (
                            <PendingBalanceTab
                                userId={userId}
                                accounts={accounts}
                                onBalanceChange={onBalanceChange}
                            />
                        )
                    }

                </motion.div >
            </AnimatePresence >
        </motion.div >
    );
}


