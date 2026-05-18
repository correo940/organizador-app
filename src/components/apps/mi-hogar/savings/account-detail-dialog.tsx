'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { addMonths, format, isSameMonth, parseISO, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    AreaChart as AreaChartIcon,
    ArrowDownRight,
    ArrowUpRight,
    BarChart3,
    ChevronLeft,
    ChevronRight,
    CreditCard,
    Edit3,
    Landmark,
    LineChart as LineChartIcon,
    PiggyBank,
    ReceiptText,
    Save,
    Search,
    ShieldCheck,
    Sparkles,
    Trash2,
    Wallet,
    RefreshCw,
    X
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

type BankAccount = {
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
    parent_account_id?: string | null;
    envelope_spent?: number;
};

type SavingsTransaction = {
    id: string;
    amount: number;
    date: string;
    description: string;
    account_id: string;
    is_envelope_spend?: boolean;
};

type TransactionKind = 'deposit' | 'expense';

type TransactionPayload = {
    transactionId?: string;
    amount: number;
    date: string;
    description: string;
    kind: TransactionKind;
    is_envelope_spend?: boolean;
};

interface AccountDetailDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    account: BankAccount | null;
    transactions: SavingsTransaction[];
    linkedPasswordName?: string;
    onSubmitTransaction: (payload: TransactionPayload) => Promise<void>;
    onDeleteTransaction: (transactionId: string, amount: number) => Promise<void>;
    onDeleteTransactions?: (transactionIds: string[], totalAmount: number) => Promise<void>;
    onDeleteAccount: () => Promise<void>;
    onSyncBalance?: (accountId: string) => Promise<void>;
    onToggleIncludeInTotal: (checked: boolean) => Promise<void>;
    onNavigateToPassword?: () => void;
    onUpdateBalance?: (accountId: string, newBalance: number) => Promise<void>;
    onUpdateAccount?: (accountId: string, updates: Partial<BankAccount>) => Promise<void>;
    onNavigateAccount?: (acc: BankAccount) => void;
    accounts?: BankAccount[];
}

const currencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
});

const compactCurrencyFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1
});

function getAccountTypeLabel(type?: BankAccount['account_type']) {
    switch (type) {
        case 'objetivo':
            return 'Cuenta objetivo';
        case 'bloqueada':
            return 'Cuenta bloqueada';
        case 'libre':
        default:
            return 'Cuenta libre';
    }
}

export default function AccountDetailDialog({
    open,
    onOpenChange,
    account,
    transactions,
    linkedPasswordName,
    onSubmitTransaction,
    onDeleteTransaction,
    onDeleteTransactions,
    onDeleteAccount,
    onSyncBalance,
    onToggleIncludeInTotal,
    onNavigateToPassword,
    onUpdateBalance,
    onUpdateAccount,
    onNavigateAccount,
    accounts = []
}: AccountDetailDialogProps) {
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'details'>('overview');
    const [transactionKind, setTransactionKind] = useState<TransactionKind>('deposit');
    const [form, setForm] = useState({
        amount: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        is_envelope_spend: false
    });
    const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingTransactionId, setDeletingTransactionId] = useState<string | null>(null);
    const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
    const [isUpdatingIncludeInTotal, setIsUpdatingIncludeInTotal] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [movementFilter, setMovementFilter] = useState<'all' | 'income' | 'expense'>('all');
    const [selectedMonth, setSelectedMonth] = useState(new Date());
    const [chartType, setChartType] = useState<'area' | 'line' | 'bar'>('area');
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
    const [exactMonthFilter, setExactMonthFilter] = useState('');
    const [exactDateFilter, setExactDateFilter] = useState('');
    const [isEditingBalance, setIsEditingBalance] = useState(false);
    const [manualBalanceValue, setManualBalanceValue] = useState('');

    useEffect(() => {
        if (!open) return;

        setActiveTab('overview');
        setTransactionKind('deposit');
        setForm({
            amount: '',
            description: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            is_envelope_spend: !!account?.parent_account_id
        });
        setEditingTransactionId(null);
        setSearchTerm('');
        setMovementFilter('all');
        setSelectedMonth(new Date());
        setSelectedTxIds(new Set());
    }, [open, account?.id]);

    const handleNextAccount = () => {
        if (!account || accounts.length <= 1 || !onNavigateAccount) return;
        const currentIndex = accounts.findIndex(a => a.id === account.id);
        const nextIndex = (currentIndex + 1) % accounts.length;
        onNavigateAccount(accounts[nextIndex]);
    };

    const handlePrevAccount = () => {
        if (!account || accounts.length <= 1 || !onNavigateAccount) return;
        const currentIndex = accounts.findIndex(a => a.id === account.id);
        const prevIndex = (currentIndex - 1 + accounts.length) % accounts.length;
        onNavigateAccount(accounts[prevIndex]);
    };

    useEffect(() => {
        if (open) {
            setSelectedTxIds(new Set());
        }
    }, [activeTab, open]);

    if (!account) {
        return null;
    }

    const sortedTransactionsAsc = [...transactions].sort((a, b) => {
        const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return a.id.localeCompare(b.id);
    });

    const startingBalance = account.current_balance - transactions.reduce((sum, tx) => sum + tx.amount, 0);

    let runningBalance = startingBalance;
    const enrichedTransactionsAsc = sortedTransactionsAsc.map((tx) => {
        runningBalance += tx.amount;

        return {
            ...tx,
            runningBalance
        };
    });

    const enrichedTransactionsDesc = [...enrichedTransactionsAsc].sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateDiff !== 0) return dateDiff;
        return b.id.localeCompare(a.id);
    });

    const filteredTransactions = enrichedTransactionsDesc.filter((tx) => {
        const matchesSearch = !searchTerm.trim() ||
            `${tx.description} ${format(parseISO(tx.date), 'dd MMM yyyy', { locale: es })}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase());

        const matchesFilter =
            movementFilter === 'all' ||
            (movementFilter === 'income' && tx.amount > 0) ||
            (movementFilter === 'expense' && tx.amount < 0);

        const matchesMonth = !exactMonthFilter || tx.date.startsWith(exactMonthFilter);
        const matchesDate = !exactDateFilter || tx.date === exactDateFilter;

        return matchesSearch && matchesFilter && matchesMonth && matchesDate;
    });

    const selectedMonthTransactions = transactions.filter((tx) =>
        isSameMonth(parseISO(tx.date), selectedMonth)
    );

    const monthlyIncome = selectedMonthTransactions
        .filter((tx) => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0);

    const monthlyExpense = selectedMonthTransactions
        .filter((tx) => tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const netFlow = monthlyIncome - monthlyExpense;
    const selectedMonthMovements = selectedMonthTransactions.length;
    const isCurrentMonth = isSameMonth(selectedMonth, new Date());
    const selectedMonthLabel = format(selectedMonth, 'MMM yyyy', { locale: es });
    const latestTransaction = enrichedTransactionsDesc[0];

    const chartData = enrichedTransactionsAsc.length > 0
        ? [
            {
                label: 'Inicio',
                balance: startingBalance,
                fullDate: account.id
            },
            ...enrichedTransactionsAsc.map((tx) => ({
                label: format(parseISO(tx.date), 'd MMM', { locale: es }),
                balance: tx.runningBalance,
                fullDate: tx.date
            }))
        ]
        : [
            {
                label: 'Hoy',
                balance: account.current_balance,
                fullDate: format(new Date(), 'yyyy-MM-dd')
            }
        ];

    const resetTransactionForm = () => {
        setEditingTransactionId(null);
        setTransactionKind('deposit');
        setForm({
            amount: '',
            description: '',
            date: format(new Date(), 'yyyy-MM-dd'),
            is_envelope_spend: !!account?.parent_account_id
        });
    };

    const handleEditTransaction = (tx: SavingsTransaction) => {
        setEditingTransactionId(tx.id);
        setTransactionKind(tx.amount >= 0 ? 'deposit' : 'expense');
        setForm({
            amount: String(Math.abs(tx.amount)),
            description: tx.description || '',
            date: tx.date,
            is_envelope_spend: tx.is_envelope_spend || false
        });
        setActiveTab('overview');
    };

    const handleManualBalanceSave = async () => {
        const val = parseFloat(manualBalanceValue.replace(',', '.'));
        if (isNaN(val)) return;
        if (onUpdateBalance && account) {
            await onUpdateBalance(account.id, val);
            setIsEditingBalance(false);
        }
    };

    const handleSubmit = async () => {
        const parsedAmount = Number(form.amount);

        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmitTransaction({
                transactionId: editingTransactionId || undefined,
                amount: parsedAmount,
                date: form.date,
                description: form.description,
                kind: transactionKind,
                is_envelope_spend: form.is_envelope_spend
            });

            resetTransactionForm();
            setActiveTab('transactions');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMovement = async (tx: SavingsTransaction) => {
        if (!window.confirm('Eliminar este movimiento? El saldo se recalculara.')) {
            return;
        }

        setDeletingTransactionId(tx.id);
        try {
            await onDeleteTransaction(tx.id, tx.amount);

            if (editingTransactionId === tx.id) {
                resetTransactionForm();
            }
        } finally {
            setDeletingTransactionId(null);
        }
    };

    const handleIncludeInTotalChange = async (checked: boolean) => {
        setIsUpdatingIncludeInTotal(true);
        try {
            await onToggleIncludeInTotal(checked);
        } finally {
            setIsUpdatingIncludeInTotal(false);
        }
    };

    const handleUpdateEnvelopeField = async (field: 'parent_account_id' | 'envelope_spent', value: string | null | number) => {
        if (!account || !onUpdateAccount) return;
        setIsUpdatingAccount(true);
        try {
            await onUpdateAccount(account.id, { [field]: value });
        } finally {
            setIsUpdatingAccount(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedTxIds.size === 0) return;
        if (!window.confirm(`¿Eliminar ${selectedTxIds.size} movimientos seleccionados? El saldo se recalculará automáticamente.`)) return;

        if (onDeleteTransactions) {
            setIsSubmitting(true);
            try {
                const txsToDelete = transactions.filter(t => selectedTxIds.has(t.id));
                const totalAmount = txsToDelete.reduce((sum, t) => sum + t.amount, 0);
                await onDeleteTransactions(Array.from(selectedTxIds), totalAmount);
                setSelectedTxIds(new Set());
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    const toggleAllVisible = () => {
        if (selectedTxIds.size >= filteredTransactions.length && filteredTransactions.length > 0) {
            setSelectedTxIds(new Set());
        } else {
            setSelectedTxIds(new Set(filteredTransactions.map(tx => tx.id)));
        }
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedTxIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedTxIds(newSet);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="h-[92vh] w-[96vw] max-w-[96vw] overflow-hidden border-none bg-transparent p-0 shadow-none [&>button]:hidden">
                <Tabs
                    value={activeTab}
                    onValueChange={(value) => setActiveTab(value as 'overview' | 'transactions' | 'details')}
                    className="flex h-full flex-col"
                >
                    <div className="flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-[0_30px_80px_rgba(15,23,42,0.55)]">
                        <div
                            className="relative overflow-hidden border-b border-white/10 px-5 py-2 sm:px-6"
                            style={{
                                background: `linear-gradient(145deg, ${account.color || '#0f766e'} 0%, #0f172a 55%, #020617 100%)`
                            }}
                        >
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)] opacity-90" />

                            <DialogHeader className="relative z-10 space-y-0 text-left pt-2">
                                <button
                                    onClick={() => onOpenChange(false)}
                                    className="absolute right-0 top-0 z-50 -mt-2 -mr-2 rounded-full bg-white/10 p-2 text-white/50 backdrop-blur-md transition-all hover:bg-white/20 hover:text-white"
                                    aria-label="Cerrar"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                                <div className="grid gap-2 lg:grid-cols-[1fr_auto_1fr] lg:items-start">

                                    {/* ── IZQUIERDA: Info de la cuenta ── */}
                                    <div className="space-y-2">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white/95 shadow-lg">
                                                {account.logo_url ? (
                                                    <img
                                                        src={account.logo_url}
                                                        alt={account.bank_name}
                                                        className="h-7 w-7 object-contain"
                                                    />
                                                ) : (
                                                    <Landmark className="h-5 w-5 text-slate-800" />
                                                )}
                                            </div>
                                            <div className="flex-1 pr-12 lg:pr-0">
                                                <div className="flex items-center gap-2">
                                                    {onNavigateAccount && accounts && accounts.length > 1 && (
                                                        <button onClick={handlePrevAccount} className="p-1 hover:bg-white/10 rounded-md transition-colors -ml-2" title="Cuenta anterior">
                                                            <ChevronLeft className="w-5 h-5 text-white/50 hover:text-white" />
                                                        </button>
                                                    )}
                                                    <DialogTitle className="text-xl font-black tracking-tight text-white">
                                                        {account.name}
                                                    </DialogTitle>
                                                    {onNavigateAccount && accounts && accounts.length > 1 && (
                                                        <button onClick={handleNextAccount} className="p-1 hover:bg-white/10 rounded-md transition-colors" title="Siguiente cuenta">
                                                            <ChevronRight className="w-5 h-5 text-white/50 hover:text-white" />
                                                        </button>
                                                    )}
                                                </div>
                                                <DialogDescription className="flex flex-wrap items-center gap-1.5 text-xs text-white/70">
                                                    <span>{account.bank_name}</span>
                                                    <span className="h-0.5 w-0.5 rounded-full bg-white/40" />
                                                    <span>{getAccountTypeLabel(account.account_type)}</span>
                                                    {account.interest_rate ? (
                                                        <>
                                                            <span className="h-0.5 w-0.5 rounded-full bg-white/40" />
                                                            <span className="text-amber-300">{account.interest_rate}% TAE</span>
                                                        </>
                                                    ) : null}
                                                </DialogDescription>
                                            </div>
                                        </div>

                                        <div className="group relative">
                                            <p className="text-[10px] uppercase tracking-[0.3em] text-white/45 flex items-center gap-2">
                                                Saldo actual
                                                {onUpdateBalance && (
                                                    <button
                                                        onClick={() => {
                                                            setIsEditingBalance(!isEditingBalance);
                                                            setManualBalanceValue(String(account.current_balance));
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                                                        title="Editar saldo manualmente"
                                                    >
                                                        <Edit3 className="w-3 h-3 text-white/60" />
                                                    </button>
                                                )}
                                                {onSyncBalance && (
                                                    <button
                                                        onClick={() => onSyncBalance(account.id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                                                        title="Sincronizar con historial"
                                                    >
                                                        <RefreshCw className="w-3 h-3 text-white/60" />
                                                    </button>
                                                )}
                                            </p>
                                            {isEditingBalance ? (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Input
                                                        className="h-8 w-32 bg-white/10 border-white/20 text-white font-bold"
                                                        value={manualBalanceValue}
                                                        onChange={(e) => setManualBalanceValue(e.target.value)}
                                                        autoFocus
                                                    />
                                                    <Button size="sm" className="h-8 bg-green-500 hover:bg-green-800" onClick={handleManualBalanceSave}>
                                                        <Save className="w-3 h-3" />
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-8 text-white/60 hover:text-white" onClick={() => setIsEditingBalance(false)}>
                                                        X
                                                    </Button>
                                                </div>
                                            ) : (
                                                <p className="text-xl font-black tracking-tight text-white sm:text-2xl">
                                                    {currencyFormatter.format(account.current_balance)}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── CENTRO: Formulario nuevo movimiento compacto ── */}
                                    <div className="lg:w-[280px]">
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/50">
                                            {editingTransactionId ? 'Editar movimiento' : 'Nuevo movimiento'}
                                        </p>

                                        {/* Toggle Ingreso / Gasto */}
                                        <div className="mb-2 grid grid-cols-2 gap-1.5 rounded-lg bg-white/5 p-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setTransactionKind('deposit')}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition-all',
                                                    transactionKind === 'deposit'
                                                        ? 'bg-green-500 text-white shadow-md'
                                                        : 'text-white/50 hover:text-white/80'
                                                )}
                                            >
                                                <ArrowUpRight className="h-3 w-3" />
                                                Ingreso
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setTransactionKind('expense')}
                                                className={cn(
                                                    'flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition-all',
                                                    transactionKind === 'expense'
                                                        ? 'bg-rose-500 text-white shadow-md'
                                                        : 'text-white/50 hover:text-white/80'
                                                )}
                                            >
                                                <ArrowDownRight className="h-3 w-3" />
                                                Gasto
                                            </button>
                                        </div>

                                        {/* Campos */}
                                        <div className="space-y-1.5">
                                            <Input
                                                type="number"
                                                placeholder="Importe"
                                                value={form.amount}
                                                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                                className="h-8 rounded-lg border-white/15 bg-white/10 text-xs text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/10"
                                            />
                                            <Input
                                                placeholder="Concepto"
                                                value={form.description}
                                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                                className="h-8 rounded-lg border-white/15 bg-white/10 text-xs text-white placeholder:text-white/30 focus-visible:border-white/30 focus-visible:ring-white/10"
                                            />
                                            <div className="flex gap-1.5">
                                                <Input
                                                    type="date"
                                                    value={form.date}
                                                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                                                    className="h-8 flex-1 rounded-lg border-white/15 bg-white/10 text-xs text-white focus-visible:border-white/30 focus-visible:ring-white/10"
                                                />
                                                <Button
                                                    type="button"
                                                    onClick={handleSubmit}
                                                    disabled={isSubmitting || !form.amount}
                                                    className="h-8 rounded-lg bg-green-500 px-3 text-xs font-semibold text-white hover:bg-green-800 disabled:opacity-40"
                                                >
                                                    <Save className="mr-1 h-3 w-3" />
                                                    {editingTransactionId ? 'Guardar' : 'Añadir'}
                                                </Button>
                                            </div>

                                            {account.parent_account_id && transactionKind === 'expense' && (
                                                <div className="flex items-center gap-2 mt-2 bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg">
                                                    <Switch
                                                        checked={form.is_envelope_spend}
                                                        onCheckedChange={(checked) => setForm({ ...form, is_envelope_spend: checked })}
                                                        className="data-[state=checked]:bg-amber-500"
                                                    />
                                                    <span className="text-[10px] text-amber-200/90 font-medium">Pagado desde cuenta principal (No resta saldo de esta cuenta)</span>
                                                </div>
                                            )}
                                            {editingTransactionId && (
                                                <button
                                                    type="button"
                                                    onClick={resetTransactionForm}
                                                    className="w-full rounded-lg py-1 text-[10px] font-medium text-white/40 hover:text-white/70"
                                                >
                                                    Cancelar edición
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── DERECHA: Selector de mes + KPIs ── */}
                                    <div className="space-y-2 pr-10 lg:pr-12">
                                        {/* Selector de mes */}
                                        <div className="flex items-center justify-between">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMonth((prev) => subMonths(prev, 1))}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
                                            >
                                                <ChevronLeft className="h-4 w-4" />
                                            </button>
                                            <p className="text-xs font-semibold uppercase tracking-wider text-white/80">
                                                {selectedMonthLabel}
                                            </p>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!isCurrentMonth) setSelectedMonth((prev) => addMonths(prev, 1));
                                                }}
                                                className={cn(
                                                    'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                                                    isCurrentMonth
                                                        ? 'cursor-not-allowed bg-white/5 text-white/20'
                                                        : 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                                                )}
                                                disabled={isCurrentMonth}
                                            >
                                                <ChevronRight className="h-4 w-4" />
                                            </button>
                                        </div>
                                        {/* KPIs del mes seleccionado */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur-xl">
                                                <CardContent className="p-2">
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Ingresos</p>
                                                    <p className="mt-1 text-base font-bold text-green-300">{compactCurrencyFormatter.format(monthlyIncome)}</p>
                                                </CardContent>
                                            </Card>
                                            <Card className="border-white/10 bg-white/10 text-white shadow-none backdrop-blur-xl">
                                                <CardContent className="p-2">
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Gastos</p>
                                                    <p className="mt-1 text-base font-bold text-rose-300">{compactCurrencyFormatter.format(monthlyExpense)}</p>
                                                </CardContent>
                                            </Card>
                                            <Card className={cn(
                                                'border-white/10 text-white shadow-none backdrop-blur-xl',
                                                netFlow >= 0 ? 'bg-green-500/15' : 'bg-rose-500/15'
                                            )}>
                                                <CardContent className="p-2">
                                                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">Diferencia</p>
                                                    <p className={cn(
                                                        'mt-1 text-base font-bold',
                                                        netFlow >= 0 ? 'text-green-300' : 'text-rose-300'
                                                    )}>
                                                        {netFlow >= 0 ? '+' : ''}{compactCurrencyFormatter.format(netFlow)}
                                                    </p>
                                                </CardContent>
                                            </Card>
                                        </div>
                                        <p className="text-center text-[10px] text-white/40">
                                            {selectedMonthMovements} movimiento{selectedMonthMovements !== 1 ? 's' : ''} en {selectedMonthLabel}
                                        </p>
                                    </div>
                                </div>
                                {/* ── Tabs dentro del header ── */}
                                <div className="relative z-10 mt-2 px-5 sm:px-6">
                                    <TabsList className="inline-flex gap-1 rounded-xl bg-white/10 p-0.5">
                                        <TabsTrigger value="overview" className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white">Resumen</TabsTrigger>
                                        <TabsTrigger value="transactions" className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white">Movimientos</TabsTrigger>
                                        <TabsTrigger value="details" className="rounded-lg px-4 py-1.5 text-xs font-semibold text-white/60 data-[state=active]:bg-white/20 data-[state=active]:text-white">Detalles</TabsTrigger>
                                    </TabsList>
                                </div>
                            </DialogHeader>
                        </div>

                        <div className="relative flex-1 overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-900">

                            <TabsContent value="overview" className="absolute inset-0 mt-0 overflow-y-auto px-4 py-4 sm:px-8 data-[state=inactive]:hidden">
                                <div className="flex flex-col gap-4">
                                    {/* Gráfico con selector de tipo */}
                                    <Card className="flex flex-1 flex-col overflow-hidden rounded-[1.75rem] border-white/70 bg-white/80 shadow-xl shadow-slate-200/50">
                                        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100/80 pb-3 shrink-0">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <PiggyBank className="h-5 w-5 text-green-800" />
                                                Evolución del saldo
                                            </CardTitle>
                                            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setChartType('area')}
                                                    className={cn(
                                                        'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                                                        chartType === 'area'
                                                            ? 'bg-white text-slate-900 shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    )}
                                                >
                                                    <AreaChartIcon className="h-3.5 w-3.5" />
                                                    Área
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setChartType('line')}
                                                    className={cn(
                                                        'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                                                        chartType === 'line'
                                                            ? 'bg-white text-slate-900 shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    )}
                                                >
                                                    <LineChartIcon className="h-3.5 w-3.5" />
                                                    Línea
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setChartType('bar')}
                                                    className={cn(
                                                        'flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all',
                                                        chartType === 'bar'
                                                            ? 'bg-white text-slate-900 shadow-sm'
                                                            : 'text-slate-500 hover:text-slate-700'
                                                    )}
                                                >
                                                    <BarChart3 className="h-3.5 w-3.5" />
                                                    Barras
                                                </button>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="flex flex-1 flex-col p-4 min-h-0">
                                            <div className="w-full" style={{ height: 'clamp(200px, 35vh, 400px)' }}>
                                                <ResponsiveContainer width="100%" height="100%">
                                                    {chartType === 'bar' ? (
                                                        <BarChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 12 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.35} />
                                                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                                            <YAxis
                                                                tickLine={false}
                                                                axisLine={false}
                                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                                tickFormatter={(value) => compactCurrencyFormatter.format(value)}
                                                                width={75}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                                                                    borderRadius: '14px',
                                                                    border: '1px solid rgba(148, 163, 184, 0.15)',
                                                                    color: '#f8fafc',
                                                                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.35)'
                                                                }}
                                                                formatter={(value: number) => currencyFormatter.format(value)}
                                                                labelFormatter={(_, payload) => {
                                                                    const point = payload?.[0]?.payload;
                                                                    if (!point?.fullDate) return 'Balance';
                                                                    return point.fullDate === account.id
                                                                        ? 'Balance inicial'
                                                                        : format(parseISO(point.fullDate), 'dd MMM yyyy', { locale: es });
                                                                }}
                                                            />
                                                            <Bar
                                                                dataKey="balance"
                                                                fill={account.color || '#10b981'}
                                                                radius={[6, 6, 0, 0]}
                                                                opacity={0.85}
                                                            />
                                                        </BarChart>
                                                    ) : chartType === 'line' ? (
                                                        <LineChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 12 }}>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.35} />
                                                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                                            <YAxis
                                                                tickLine={false}
                                                                axisLine={false}
                                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                                tickFormatter={(value) => compactCurrencyFormatter.format(value)}
                                                                width={75}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                                                                    borderRadius: '14px',
                                                                    border: '1px solid rgba(148, 163, 184, 0.15)',
                                                                    color: '#f8fafc',
                                                                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.35)'
                                                                }}
                                                                formatter={(value: number) => currencyFormatter.format(value)}
                                                                labelFormatter={(_, payload) => {
                                                                    const point = payload?.[0]?.payload;
                                                                    if (!point?.fullDate) return 'Balance';
                                                                    return point.fullDate === account.id
                                                                        ? 'Balance inicial'
                                                                        : format(parseISO(point.fullDate), 'dd MMM yyyy', { locale: es });
                                                                }}
                                                            />
                                                            <Line
                                                                type="monotone"
                                                                dataKey="balance"
                                                                stroke={account.color || '#10b981'}
                                                                strokeWidth={3}
                                                                dot={{ fill: account.color || '#10b981', r: 3 }}
                                                                activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
                                                            />
                                                        </LineChart>
                                                    ) : (
                                                        <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -18, bottom: 12 }}>
                                                            <defs>
                                                                <linearGradient id="account-balance-fill" x1="0" x2="0" y1="0" y2="1">
                                                                    <stop offset="0%" stopColor={account.color || '#10b981'} stopOpacity={0.35} />
                                                                    <stop offset="100%" stopColor={account.color || '#10b981'} stopOpacity={0.02} />
                                                                </linearGradient>
                                                            </defs>
                                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" opacity={0.35} />
                                                            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                                                            <YAxis
                                                                tickLine={false}
                                                                axisLine={false}
                                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                                tickFormatter={(value) => compactCurrencyFormatter.format(value)}
                                                                width={75}
                                                            />
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                                                                    borderRadius: '14px',
                                                                    border: '1px solid rgba(148, 163, 184, 0.15)',
                                                                    color: '#f8fafc',
                                                                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.35)'
                                                                }}
                                                                formatter={(value: number) => currencyFormatter.format(value)}
                                                                labelFormatter={(_, payload) => {
                                                                    const point = payload?.[0]?.payload;
                                                                    if (!point?.fullDate) return 'Balance';
                                                                    return point.fullDate === account.id
                                                                        ? 'Balance inicial'
                                                                        : format(parseISO(point.fullDate), 'dd MMM yyyy', { locale: es });
                                                                }}
                                                            />
                                                            <Area
                                                                type="monotone"
                                                                dataKey="balance"
                                                                stroke={account.color || '#10b981'}
                                                                strokeWidth={3}
                                                                fill="url(#account-balance-fill)"
                                                            />
                                                        </AreaChart>
                                                    )}
                                                </ResponsiveContainer>
                                            </div>

                                            <div className="mt-3 grid shrink-0 gap-2 sm:grid-cols-3">
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Balance inicial</p>
                                                    <p className="mt-1 text-base font-bold text-slate-900">{currencyFormatter.format(startingBalance)}</p>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                                                    <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Último mov.</p>
                                                    <p className="mt-1 text-base font-bold text-slate-900">
                                                        {latestTransaction
                                                            ? format(parseISO(latestTransaction.date), 'dd MMM', { locale: es })
                                                            : 'Sin datos'}
                                                    </p>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 group relative">
                                                    <div className="flex justify-between items-start">
                                                        <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Balance actual</p>
                                                        {onSyncBalance && (
                                                            <button
                                                                onClick={() => {
                                                                    if (window.confirm('¿Quieres sincronizar y recalcular el saldo desde cero sumando el historial exacto de movimientos?')) {
                                                                        onSyncBalance(account.id);
                                                                    }
                                                                }}
                                                                className="text-slate-400 hover:text-green-800 transition-colors"
                                                                title="Sincronizar saldo con el historial"
                                                            >
                                                                <RefreshCw className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                    <p className="mt-1 text-base font-bold text-slate-900">{currencyFormatter.format(account.current_balance)}</p>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="flex flex-col gap-6">
                                        <Card className="rounded-[1.75rem] border-white/70 bg-white/80 shadow-xl shadow-slate-200/50">
                                            <CardHeader className="pb-4">
                                                <CardTitle className="text-lg">Resumen operativo</CardTitle>
                                            </CardHeader>
                                            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Balance general</p>
                                                    <p className="mt-2 text-base font-bold text-slate-900">
                                                        {account.include_in_total === false ? 'No incluida' : 'Incluida'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {account.include_in_total === false
                                                            ? 'Esta cuenta no suma al total global de Mi Economia.'
                                                            : 'Su saldo se refleja en el balance total de Mi Economia.'}
                                                    </p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Credencial bancaria</p>
                                                    <p className="mt-2 text-base font-bold text-slate-900">
                                                        {linkedPasswordName || 'No vinculada'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {linkedPasswordName
                                                            ? 'La cuenta esta conectada con una entrada del gestor de contrasenas.'
                                                            : 'Todavia no hay una credencial asociada a esta cuenta.'}
                                                    </p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Vinculación (Sobre)</p>
                                                    <div className="mt-2 flex items-center justify-between">
                                                        <p className="text-base font-bold text-slate-900">
                                                            {account.parent_account_id ? 'Es un Sobre' : 'Independiente'}
                                                        </p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2 text-[10px] text-amber-600 hover:bg-amber-100"
                                                            onClick={() => setActiveTab('details')}
                                                        >
                                                            Configurar
                                                        </Button>
                                                    </div>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {account.parent_account_id
                                                            ? `Vinculada a ${accounts.find(a => a.id === account.parent_account_id)?.name || 'una cuenta principal'}.`
                                                            : 'Esta cuenta no está vinculada como sobre de ninguna otra.'}
                                                    </p>
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Ultima actividad</p>
                                                    <p className="mt-2 text-base font-bold text-slate-900">
                                                        {latestTransaction
                                                            ? format(parseISO(latestTransaction.date), 'dd MMM yyyy', { locale: es })
                                                            : 'Sin movimientos'}
                                                    </p>
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        {latestTransaction
                                                            ? 'Fecha del ultimo movimiento registrado.'
                                                            : 'Aun no hay movimientos registrados.'}
                                                    </p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>


                                </div>
                            </TabsContent>

                            <TabsContent value="transactions" className="absolute inset-0 mt-0 overflow-y-auto px-6 py-6 sm:px-8 data-[state=inactive]:hidden">
                                <Card className="rounded-[1.75rem] border-white/70 bg-white/85 shadow-xl shadow-slate-200/50">
                                    <CardHeader className="gap-4 border-b border-slate-100/80 pb-5">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <ReceiptText className="h-5 w-5 text-green-800" />
                                                    Historial de movimientos
                                                </CardTitle>
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    Edita o elimina cualquier apunte sin salir del detalle de la cuenta.
                                                </p>
                                            </div>
                                            <div className="flex flex-col gap-3 sm:flex-row">
                                                <div className="relative min-w-[260px]">
                                                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                                    <Input
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        placeholder="Buscar por concepto o fecha..."
                                                        className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
                                                    {[
                                                        { id: 'all', label: 'Todos' },
                                                        { id: 'income', label: 'Ingresos' },
                                                        { id: 'expense', label: 'Gastos' }
                                                    ].map((item) => (
                                                        <Button
                                                            key={item.id}
                                                            type="button"
                                                            variant="ghost"
                                                            onClick={() => setMovementFilter(item.id as 'all' | 'income' | 'expense')}
                                                            className={cn(
                                                                'rounded-xl px-4 text-sm',
                                                                movementFilter === item.id && 'bg-white shadow-sm'
                                                            )}
                                                        >
                                                            {item.label}
                                                        </Button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1 shadow-sm">
                                                    <div className="flex items-center pl-3">
                                                        <span className="text-xs font-medium text-slate-400 mr-2 whitespace-nowrap">Filtrar para borrar:</span>
                                                        <select
                                                            title="Filtrar por mes"
                                                            value={exactMonthFilter}
                                                            onChange={(e) => {
                                                                setExactMonthFilter(e.target.value);
                                                                if (e.target.value) setExactDateFilter('');
                                                            }}
                                                            className="h-9 bg-transparent border-none text-sm outline-none cursor-pointer focus:ring-0 text-slate-700 font-medium capitalize"
                                                        >
                                                            <option value="">Mes completo...</option>
                                                            {Array.from({ length: 12 }).map((_, i) => {
                                                                const d = new Date();
                                                                d.setMonth(d.getMonth() - i);
                                                                const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                                                                const label = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(d);
                                                                return <option key={val} value={val}>{label}</option>;
                                                            })}
                                                        </select>
                                                    </div>
                                                    <div className="w-px h-6 bg-slate-200 mx-1" />
                                                    <div className="flex items-center pr-1">
                                                        <span className="text-xs font-medium text-slate-400 mr-2">ó Día:</span>
                                                        <Input
                                                            type="date"
                                                            title="Día exacto"
                                                            value={exactDateFilter}
                                                            onChange={(e) => {
                                                                setExactDateFilter(e.target.value);
                                                                if (e.target.value) setExactMonthFilter('');
                                                            }}
                                                            className="h-9 w-[130px] border-none bg-white shadow-sm rounded-xl text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                {selectedTxIds.size > 0 && onDeleteTransactions && (
                                                    <Button
                                                        type="button"
                                                        variant="destructive"
                                                        className="h-11 rounded-2xl gap-2 font-semibold shadow-sm"
                                                        onClick={handleBulkDelete}
                                                        disabled={isSubmitting}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                        Borrar {selectedTxIds.size}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader className="sticky top-0 bg-white/95 backdrop-blur-xl z-20 shadow-sm">
                                                <TableRow>
                                                    <TableHead className="w-12 text-center">
                                                        <Checkbox
                                                            checked={filteredTransactions.length > 0 && selectedTxIds.size >= filteredTransactions.length}
                                                            onCheckedChange={toggleAllVisible}
                                                            className="border-slate-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-none"
                                                        />
                                                    </TableHead>
                                                    <TableHead>Movimiento</TableHead>
                                                    <TableHead className="hidden md:table-cell">Fecha</TableHead>
                                                    <TableHead className="hidden lg:table-cell">Tipo</TableHead>
                                                    <TableHead className="text-right">Importe</TableHead>
                                                    <TableHead className="hidden xl:table-cell text-right">Saldo</TableHead>
                                                    <TableHead className="text-right">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {filteredTransactions.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                                            No hay movimientos que coincidan con ese filtro.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    filteredTransactions.map((tx) => (
                                                        <TableRow
                                                            key={tx.id}
                                                            className={cn("hover:bg-slate-50/70 transition-colors cursor-pointer", selectedTxIds.has(tx.id) && "bg-green-50/40 hover:bg-green-50/60")}
                                                            onClick={() => toggleSelection(tx.id)}
                                                        >
                                                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                                                                <Checkbox
                                                                    checked={selectedTxIds.has(tx.id)}
                                                                    onCheckedChange={() => toggleSelection(tx.id)}
                                                                    className="border-slate-300 data-[state=checked]:bg-green-500 data-[state=checked]:border-none"
                                                                />
                                                            </TableCell>
                                                            <TableCell>
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className={cn(
                                                                            'flex h-10 w-10 items-center justify-center rounded-2xl',
                                                                            tx.amount >= 0
                                                                                ? 'bg-green-100 text-green-900'
                                                                                : 'bg-rose-100 text-rose-700'
                                                                        )}
                                                                    >
                                                                        {tx.amount >= 0 ? (
                                                                            <ArrowUpRight className="h-4 w-4" />
                                                                        ) : (
                                                                            <ArrowDownRight className="h-4 w-4" />
                                                                        )}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-semibold text-slate-900">
                                                                            {tx.description || 'Movimiento sin concepto'}
                                                                        </p>
                                                                        <p className="text-xs text-muted-foreground md:hidden">
                                                                            {format(parseISO(tx.date), 'dd MMM yyyy', { locale: es })}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="hidden md:table-cell text-muted-foreground">
                                                                {format(parseISO(tx.date), 'dd MMM yyyy', { locale: es })}
                                                            </TableCell>
                                                            <TableCell className="hidden lg:table-cell">
                                                                <Badge
                                                                    className={cn(
                                                                        'rounded-full px-3 py-1 font-semibold',
                                                                        tx.amount >= 0
                                                                            ? 'bg-green-100 text-green-900 hover:bg-green-100'
                                                                            : 'bg-rose-100 text-rose-700 hover:bg-rose-100'
                                                                    )}
                                                                >
                                                                    {tx.amount >= 0 ? 'Ingreso' : 'Gasto'}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell
                                                                className={cn(
                                                                    'text-right font-bold',
                                                                    tx.amount >= 0 ? 'text-green-800' : 'text-slate-900'
                                                                )}
                                                            >
                                                                {tx.amount >= 0 ? '+' : '-'}{currencyFormatter.format(Math.abs(tx.amount))}
                                                            </TableCell>
                                                            <TableCell className="hidden xl:table-cell text-right font-semibold text-slate-600">
                                                                {currencyFormatter.format(tx.runningBalance)}
                                                            </TableCell>
                                                            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                                                                <div className="flex justify-end gap-2">
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-9 w-9 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                                                        onClick={() => handleEditTransaction(tx)}
                                                                    >
                                                                        <Edit3 className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-9 w-9 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                                                        onClick={() => handleDeleteMovement(tx)}
                                                                        disabled={deletingTransactionId === tx.id}
                                                                    >
                                                                        <Trash2 className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))
                                                )}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="details" className="absolute inset-0 mt-0 overflow-y-auto px-6 py-6 sm:px-8 data-[state=inactive]:hidden">
                                <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                                    <Card className="rounded-[1.75rem] border-white/70 bg-white/85 shadow-xl shadow-slate-200/50">
                                        <CardHeader className="border-b border-slate-100/80 pb-4">
                                            <CardTitle className="flex items-center gap-2 text-lg">
                                                <CreditCard className="h-5 w-5 text-indigo-600" />
                                                Ficha de cuenta
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Nombre</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">{account.name}</p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Banco</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">{account.bank_name}</p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Tipo</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">{getAccountTypeLabel(account.account_type)}</p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Interes</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">
                                                    {account.interest_rate ? `${account.interest_rate}% TAE` : 'Sin interes'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Ultima actividad</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">
                                                    {latestTransaction
                                                        ? format(parseISO(latestTransaction.date), 'dd MMM yyyy', { locale: es })
                                                        : 'Sin movimientos'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Saldo en panel</p>
                                                <p className="mt-2 text-lg font-bold text-slate-900">
                                                    {account.include_in_total === false ? 'Oculta del balance total' : 'Visible en balance total'}
                                                </p>
                                            </div>
                                            <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4 md:col-span-2">
                                                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                                    <div>
                                                        <p className="text-xs uppercase tracking-[0.25em] text-green-900">Balance general</p>
                                                        <p className="mt-2 text-lg font-bold text-slate-900">
                                                            {account.include_in_total === false ? 'Excluida del computo global' : 'Incluida en el computo global'}
                                                        </p>
                                                        <p className="mt-1 text-sm text-slate-600">
                                                            Decide si esta cuenta debe sumar o no al total principal de Mi Economia.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-sm font-medium text-slate-700">
                                                            {account.include_in_total === false ? 'Excluida' : 'Incluida'}
                                                        </span>
                                                        <Switch
                                                            checked={account.include_in_total !== false}
                                                            onCheckedChange={handleIncludeInTotalChange}
                                                            disabled={isUpdatingIncludeInTotal}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Configuración de Sobre */}
                                            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 md:col-span-2 space-y-4">
                                                <div>
                                                    <p className="text-xs uppercase tracking-[0.25em] text-amber-700">Configuración de Sobre protegido</p>
                                                    <p className="mt-1 text-sm text-slate-600">
                                                        Puedes vincular esta cuenta a una principal y definir un saldo gastado que quieres recuperar.
                                                    </p>
                                                </div>
                                                <div className="flex flex-col gap-4 sm:flex-row">
                                                    <div className="flex-1 space-y-2">
                                                        <Label className="text-amber-900">Vinculado a (Cuenta Principal)</Label>
                                                        <select
                                                            className="w-full bg-white border border-amber-200 rounded-lg p-2 text-sm disabled:opacity-50"
                                                            value={account.parent_account_id || 'none'}
                                                            disabled={isUpdatingAccount}
                                                            onChange={(e) => handleUpdateEnvelopeField('parent_account_id', e.target.value === 'none' ? null : e.target.value)}
                                                        >
                                                            <option value="none">Cuenta independiente (no es sobre)</option>
                                                            {accounts.filter(a => a.id !== account.id && !a.parent_account_id).map(acc => (
                                                                <option key={acc.id} value={acc.id}>🗂 Sobre de: {acc.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    {account.parent_account_id && (
                                                        <div className="flex-1 space-y-2">
                                                            <Label className="text-amber-900">Gastado en cuenta principal (€)</Label>
                                                            <div className="flex gap-2">
                                                                <Input
                                                                    type="number"
                                                                    defaultValue={account.envelope_spent || 0}
                                                                    disabled={isUpdatingAccount}
                                                                    className="bg-white border-amber-200"
                                                                    onBlur={(e) => handleUpdateEnvelopeField('envelope_spent', parseFloat(e.target.value) || 0)}
                                                                />
                                                            </div>
                                                            <p className="text-[10px] text-amber-700/70">Pulsa fuera del campo para guardar automáticamente.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <div className="flex flex-col gap-6">
                                        <Card className="rounded-[1.75rem] border-white/70 bg-white/85 shadow-xl shadow-slate-200/50">
                                            <CardHeader className="border-b border-slate-100/80 pb-4">
                                                <CardTitle className="flex items-center gap-2 text-lg">
                                                    <ShieldCheck className="h-5 w-5 text-green-800" />
                                                    Vinculacion y acceso
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4 p-6">
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Password Manager</p>
                                                    <p className="mt-2 text-base font-bold text-slate-900">
                                                        {linkedPasswordName || 'No hay credencial vinculada'}
                                                    </p>
                                                    {linkedPasswordName && onNavigateToPassword ? (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="mt-4 rounded-2xl"
                                                            onClick={onNavigateToPassword}
                                                        >
                                                            Abrir contrasena vinculada
                                                        </Button>
                                                    ) : null}
                                                </div>
                                                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                                                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Color de cuenta</p>
                                                    <div className="mt-3 flex items-center gap-3">
                                                        <div
                                                            className="h-10 w-10 rounded-2xl border border-slate-200 shadow-inner"
                                                            style={{ backgroundColor: account.color || '#10b981' }}
                                                        />
                                                        <p className="font-semibold text-slate-900">{account.color || '#10b981'}</p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card className="rounded-[1.75rem] border-rose-200 bg-gradient-to-br from-white to-rose-50 shadow-xl shadow-rose-100/60">
                                            <CardHeader className="pb-4">
                                                <CardTitle className="flex items-center gap-2 text-lg text-rose-700">
                                                    <Trash2 className="h-5 w-5" />
                                                    Zona delicada
                                                </CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                                <p className="text-sm text-rose-700/80">
                                                    Si eliminas esta cuenta, desaparecera tambien su historial de movimientos asociado.
                                                </p>
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    className="w-full rounded-2xl"
                                                    onClick={() => void onDeleteAccount()}
                                                >
                                                    Eliminar cuenta
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </div>
                            </TabsContent>
                        </div>
                    </div>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

