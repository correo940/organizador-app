'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    ArrowLeft,
    PiggyBank,
    Plus,
    Landmark,
    TrendingUp,
    Calendar,
    Target,
    Lock,
    ExternalLink,
    Wallet,
    Trash2,
    Save,
    Repeat,
    FileUp,
    Settings,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import dynamic from 'next/dynamic';
import SavingsNotificationManager from '@/components/apps/mi-hogar/savings/savings-notification-manager';
import SavingsDashboardUI from '@/components/apps/mi-hogar/savings/savings-dashboard-ui';
const BankStatementImporter = dynamic(() => import('@/components/apps/mi-hogar/savings/bank-statement-importer'), { ssr: false });
const SavingsNotificationSettings = dynamic(() => import('@/components/apps/mi-hogar/savings/savings-notification-settings'), { ssr: false });
const ResetDataDialog = dynamic(() => import('@/components/apps/mi-hogar/savings/reset-data-dialog'), { ssr: false });
const AccountDetailDialog = dynamic(() => import('@/components/apps/mi-hogar/savings/account-detail-dialog'), { ssr: false });
import type { ResetOptions } from '@/components/apps/mi-hogar/savings/reset-data-dialog';

// Types
type BankAccount = {
    id: string;
    name: string;
    bank_name: string;
    color: string;
    password_id?: string; // Linked password
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

type SavingsGoal = {
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

type SavingsTransaction = {
    id: string;
    amount: number;
    date: string;
    description: string;
    account_id: string; // From the relationship
    is_envelope_spend?: boolean;
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

// Mock Bank Logos/Colors
const BANKS = [
    { name: 'BBVA', color: '#004481', logo: 'https://www.google.com/s2/favicons?domain=bbva.es&sz=128', url: 'https://www.bbva.es' },
    { name: 'Santander', color: '#EC0000', logo: 'https://www.google.com/s2/favicons?domain=bancosantander.es&sz=128', url: 'https://www.bancosantander.es' },
    { name: 'CaixaBank', color: '#007dbd', logo: 'https://www.google.com/s2/favicons?domain=caixabank.es&sz=128', url: 'https://www.caixabank.es' },
    { name: 'Sabadell', color: '#006dff', logo: 'https://www.google.com/s2/favicons?domain=bancsabadell.com&sz=128', url: 'https://www.bancsabadell.com' },
    { name: 'ING', color: '#FF6200', logo: 'https://www.google.com/s2/favicons?domain=ing.es&sz=128', url: 'https://www.ing.es' },
    { name: 'Openbank', color: '#EC0000', logo: 'https://www.google.com/s2/favicons?domain=openbank.es&sz=128', url: 'https://www.openbank.es' },
    { name: 'Revolut', color: '#4079FA', logo: 'https://www.google.com/s2/favicons?domain=revolut.com&sz=128', url: 'https://www.revolut.com' },
    { name: 'N26', color: '#36a18b', logo: 'https://www.google.com/s2/favicons?domain=n26.com&sz=128', url: 'https://n26.com' },
    { name: 'Trade Republic', color: '#0e0e0e', logo: 'https://www.google.com/s2/favicons?domain=traderepublic.com&sz=128', url: 'https://traderepublic.com' },
    { name: 'Efectivo', color: '#10b981', logo: null, url: null },
    { name: 'Otro', color: '#64748b', logo: null, url: null },
];

const QUERY_TIMEOUT_MS = 12000;
function withTimeout<T>(promise: PromiseLike<T>, timeoutMs: number, label: string): Promise<T> {
    return Promise.race([
        Promise.resolve(promise),
        new Promise<T>((_, reject) => {
            setTimeout(() => reject(new Error(label + ' timed out after ' + timeoutMs + 'ms')), timeoutMs);
        })
    ]);
}

export default function SavingsPage() {
    const { user, loading: authLoading } = useAuth();
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [monthlyStats, setMonthlyStats] = useState({ income: 0, expense: 0, savingsRate: 0 });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
    const [passwords, setPasswords] = useState<{ id: string, name: string }[]>([]);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedMonthBalance, setSelectedMonthBalance] = useState<number>(0);
    const [accountStats, setAccountStats] = useState<Record<string, { income: number, expense: number }>>({});

    // Detail States
    const [selectedGoal, setSelectedGoal] = useState<SavingsGoal | null>(null);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);

    // Transactions State
    const [goalTransactions, setGoalTransactions] = useState<SavingsTransaction[]>([]);
    const [accountTransactions, setAccountTransactions] = useState<SavingsTransaction[]>([]);
    const [transType, setTransType] = useState<'deposit' | 'expense'>('deposit');
    const [newTransaction, setNewTransaction] = useState({ amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });

    // Dialogs
    const [isGoalDetailOpen, setIsGoalDetailOpen] = useState(false);
    const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
    const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
    const [isAddRecurringOpen, setIsAddRecurringOpen] = useState(false);
    const [isAccountDetailOpen, setIsAccountDetailOpen] = useState(false);
    const [isImporterOpen, setIsImporterOpen] = useState(false);
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);

    // Month Filter
    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    // Forms
    const [newAccount, setNewAccount] = useState<{ name: string, bank: string, color: string, passId: string, customBankName?: string, interestRate: string, includeInTotal: boolean, parentAccountId: string, envelopeSpent: string }>({ name: '', bank: 'Otro', color: '#64748b', passId: 'none', interestRate: '', includeInTotal: true, parentAccountId: 'none', envelopeSpent: '' });
    const [newGoal, setNewGoal] = useState({ name: '', target: '', current: '', deadline: '', linkedAccountId: 'none', interestRate: '' });
    const [newRecurring, setNewRecurring] = useState({ name: '', amount: '', type: 'expense', day: '', targetAccountId: 'none', endDate: '' });

    const resetSavingsState = () => {
        setAccounts([]);
        setGoals([]);
        setRecentTransactions([]);
        setMonthlyStats({ income: 0, expense: 0, savingsRate: 0 });
        setChartData([]);
        setRecurringItems([]);
        setPasswords([]);
        setPendingTotal(0);
        setSelectedMonthBalance(0);
        setSelectedMonth(new Date());
        setLoading(false);
    };

    useEffect(() => {
        if (!loading) return;

        const timer = window.setTimeout(() => {
            console.warn('SavingsPage: safety timeout — force-stopping loading spinner');
            setLoading(false);
        }, QUERY_TIMEOUT_MS);

        return () => window.clearTimeout(timer);
    }, [loading]);


    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            resetSavingsState();
            return;
        }
        const userId = user.id;
        let cancelled = false;
        const loadSavingsPage = async () => {
            await fetchData(userId);
            if (!cancelled) {
                await processAutoDeposits(userId);
            }
        };
        loadSavingsPage();
        fetchPasswordsLite(userId);
        return () => {
            cancelled = true;
        };
    }, [user?.id, authLoading]);

    // --- AUTOMATION LOGIC ---
    const processAutoDeposits = async (userId?: string) => {
        if (!userId) return;

        const today = new Date();
        const currentDay = today.getDate(); // 1-31
        const currentMonthStr = format(today, 'yyyy-MM'); // 2024-02

        // Fetch valid items for automation directly to insure freshness
        const { data: items } = await withTimeout<any>(
            supabase
                .from('savings_recurring_items')
                .select('*')
                .eq('user_id', userId)
                .eq('type', 'income') // Only incomes are automated for now per user request
                .not('target_account_id', 'is', null),
            QUERY_TIMEOUT_MS,
            'savings_recurring_items'
        );

        if (!items || items.length === 0) return;

        let processedCount = 0;

        for (const item of items) {
            // Check if it should run today or if we missed it this month
            // Condition 1: Day of month has passed or is today
            if ((item.day_of_month || 1) > currentDay) continue;

            // Condition 2: Has NOT run this month yet
            // We check if last_run_date is in current month
            if (item.last_run_date && item.last_run_date.startsWith(currentMonthStr)) continue;

            // Condition 3: End Date not passed
            if (item.end_date && new Date(item.end_date) < today) continue;

            // EXECUTE DEPOSIT
            console.log('Executing Auto Deposit:', item.name);

            // 1. Transaction Record
            await supabase.from('savings_account_transactions').insert({
                user_id: userId,
                account_id: item.target_account_id,
                amount: item.amount,
                date: format(today, 'yyyy-MM-dd'),
                description: `Auto: ${item.name}`
            });

            // 2. Update Account Balance
            // We need current balance first
            const { data: acc } = await supabase.from('savings_accounts').select('current_balance').eq('id', item.target_account_id).single();
            if (acc) {
                await supabase.from('savings_accounts').update({
                    current_balance: (acc.current_balance || 0) + item.amount
                }).eq('id', item.target_account_id);
            }

            // 3. Mark as Run
            await supabase.from('savings_recurring_items').update({
                last_run_date: format(today, 'yyyy-MM-dd')
            }).eq('id', item.id);

            processedCount++;
        }

        if (processedCount > 0) {
            toast.success(`Se han procesado ${processedCount} ingresos automáticos`);
            // Refetch to update UI
            await fetchData(userId);
        }
    };

    const fetchData = async (userIdArg?: string, monthDateArg?: Date) => {
        const userId = userIdArg || user?.id;
        const monthDate = monthDateArg || selectedMonth;
        if (!userId) {
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // 1. Accounts
            const { data: accs } = await supabase
                .from('savings_accounts')
                .select('*')
                .eq('user_id', userId)
                .order('name');
            setAccounts(accs || []);

            // 2. Goals
            const { data: gls } = await supabase
                .from('savings_goals')
                .select('*')
                .eq('user_id', userId)
                .order('deadline', { ascending: true });
            setGoals(gls || []);

            // Time Travel Logic
            const lastDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            const today = new Date();
            const referenceDate = lastDayOfMonth < today ? lastDayOfMonth : today;
            const referenceDateStr = format(referenceDate, 'yyyy-MM-dd');

            // 3. Transactions (Last 365 days from referenceDate, up to TODAY to allow rewinding)
            const chartStartDate = new Date(referenceDate);
            chartStartDate.setDate(chartStartDate.getDate() - 365);

            const { data: txs } = await supabase
                .from('savings_account_transactions')
                .select('*')
                .gte('date', chartStartDate.toISOString().split('T')[0])
                .in('account_id', accs?.map(a => a.id) || [])
                .order('date', { ascending: false });

            // Calculate balance at referenceDate
            const includedAccountIds = (accs || []).filter(a => a.include_in_total !== false).map(a => a.id);
            let currentTotal = (accs || []).reduce((sum, a) => sum + (a.include_in_total !== false ? (a.current_balance || 0) : 0), 0);

            // Rewind currentTotal to referenceDate by subtracting transactions that happened AFTER referenceDate
            (txs || []).forEach(t => {
                if (t.date && t.date.split('T')[0] > referenceDateStr && includedAccountIds.includes(t.account_id)) {
                    currentTotal -= t.amount;
                }
            });

            setSelectedMonthBalance(currentTotal);

            // Filter txs to only those <= referenceDate for UI display
            const txsForMonth = (txs || []).filter(t => t.date && t.date.split('T')[0] <= referenceDateStr);
            setRecentTransactions(txsForMonth);

            // 4. Recurring Items
            const { data: recs } = await supabase
                .from('savings_recurring_items')
                .select('*')
                .eq('user_id', userId)
                .order('day_of_month', { ascending: true });
            setRecurringItems((recs as RecurringItem[]) || []);

            // Calculate Monthly Stats (Selected Month)
            const currentMonth = monthDate.getMonth();
            const currentYear = monthDate.getFullYear();
            let mIncome = 0;
            let mExpense = 0;
            const mAccountStats: Record<string, { income: number, expense: number }> = {};

            (txsForMonth || []).forEach(tx => {
                if (tx.date) {
                    const dateParts = tx.date.split('T')[0].split('-');
                    if (dateParts.length >= 3) {
                        const txYear = parseInt(dateParts[0], 10);
                        const txMonth = parseInt(dateParts[1], 10) - 1;
                        if (txMonth === currentMonth && txYear === currentYear) {
                            if (tx.amount > 0) mIncome += tx.amount;
                            else mExpense += Math.abs(tx.amount);
                            
                            if (!mAccountStats[tx.account_id]) mAccountStats[tx.account_id] = { income: 0, expense: 0 };
                            if (tx.amount > 0) mAccountStats[tx.account_id].income += tx.amount;
                            else mAccountStats[tx.account_id].expense += Math.abs(tx.amount);
                        }
                    }
                }
            });

            const rate = mIncome > 0 ? ((mIncome - mExpense) / mIncome) * 100 : 0;
            setMonthlyStats({ income: mIncome, expense: mExpense, savingsRate: rate > 0 ? rate : 0 });
            setAccountStats(mAccountStats);

            // Calculate Chart Data (Reconstruct backwards from referenceDate)
            const dailyBalances = [];
            let chartTotal = currentTotal;

            for (let i = 0; i < 365; i++) {
                const d = new Date(referenceDate);
                d.setDate(d.getDate() - i);
                const dateStr = format(d, 'yyyy-MM-dd');

                dailyBalances.push({
                    date: format(d, 'd MMM', { locale: es }),
                    fullDate: dateStr,
                    value: chartTotal // Using 'value' for Recharts compatibility
                });

                // Subtract ONLY the transactions from the included accounts of THIS day
                const daysTransactions = (txsForMonth || []).filter(t => t.date && t.date.split('T')[0] === dateStr && includedAccountIds.includes(t.account_id));
                const daysChange = daysTransactions.reduce((sum, t) => sum + t.amount, 0);

                chartTotal -= daysChange;
            }

            setChartData(dailyBalances.reverse());

            // 5. Pending Balance Total
            const { data: pendingExps } = await supabase
                .from('pending_balance_expenses')
                .select('amount')
                .eq('user_id', userId)
                .eq('status', 'pending');
            const pTotal = (pendingExps || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
            setPendingTotal(pTotal);

        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const fetchPasswordsLite = async (userId?: string) => {
        if (!userId) {
            setPasswords([]);
            return;
        }

        const { data } = await supabase.from('passwords').select('id, name').eq('user_id', userId).order('name');
        setPasswords(data || []);
    };

    // --- GENERIC TRANSACTION FETCHERS ---
    const fetchGoalTransactions = async (goalId: string) => {
        const { data } = await supabase.from('savings_goal_transactions').select('*').eq('goal_id', goalId).order('date', { ascending: false });
        setGoalTransactions(data || []);
    };

    const fetchAccountTransactions = async (accountId: string) => {
        const { data } = await supabase.from('savings_account_transactions').select('*').eq('account_id', accountId).order('date', { ascending: false });
        setAccountTransactions(data || []);
    };

    // --- OPEN DETAIL HANDLERS ---
    const handleOpenGoalDetail = async (goal: SavingsGoal) => {
        setSelectedGoal(goal);
        setTransType('deposit');
        setNewTransaction({ amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
        setGoalTransactions([]);
        await fetchGoalTransactions(goal.id);
        setIsGoalDetailOpen(true);
    };

    const handleOpenAccountDetail = async (acc: BankAccount) => {
        setSelectedAccount(acc);
        setAccountTransactions([]);
        await fetchAccountTransactions(acc.id);
        setIsAccountDetailOpen(true);
    };

    // --- ACTIONS ---

    const handleCreateAccount = async () => {
        if (!newAccount.name) return toast.error('Nombre obligatorio');
        try {
            let bankName = newAccount.bank;
            let bankColor = newAccount.color;
            let bankLogo = null;
            if (newAccount.bank === 'Otro') {
                if (!newAccount.customBankName) return toast.error('Escribe el nombre del banco');
                bankName = newAccount.customBankName;
            } else {
                const bankInfo = BANKS.find(b => b.name === newAccount.bank) || { color: '#64748b', logo: null };
                bankColor = bankInfo.color;
                bankLogo = bankInfo.logo;
            }
            const payload = {
                user_id: user?.id,
                name: newAccount.name,
                bank_name: bankName,
                color: bankColor,
                logo_url: bankLogo,
                password_id: newAccount.passId === 'none' ? null : newAccount.passId,
                interest_rate: newAccount.interestRate ? parseFloat(newAccount.interestRate) : 0,
                include_in_total: newAccount.includeInTotal,
                parent_account_id: newAccount.parentAccountId === 'none' ? null : newAccount.parentAccountId,
                envelope_spent: newAccount.envelopeSpent ? parseFloat(newAccount.envelopeSpent) : 0
            };
            const { error } = await supabase.from('savings_accounts').insert(payload);
            if (error) throw error;
            toast.success('Cuenta creada');
            setIsAddAccountOpen(false);
            setNewAccount({ name: '', bank: 'Otro', color: '#64748b', passId: 'none', interestRate: '', includeInTotal: true, parentAccountId: 'none', envelopeSpent: '' });
            fetchData(user?.id);
        } catch (error) {
            toast.error('Error al crear cuenta');
        }
    };

    const handleToggleAccountInTotal = async (checked: boolean) => {
        if (!selectedAccount) return;

        try {
            const { error } = await supabase
                .from('savings_accounts')
                .update({ include_in_total: checked })
                .eq('id', selectedAccount.id);

            if (error) throw error;

            const updatedAccount = { ...selectedAccount, include_in_total: checked };
            setSelectedAccount(updatedAccount);
            setAccounts((prev) => prev.map((account) => (
                account.id === updatedAccount.id
                    ? { ...account, include_in_total: checked }
                    : account
            )));
            toast.success(checked ? 'Cuenta incluida en el balance general' : 'Cuenta excluida del balance general');
            fetchData(user?.id);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo actualizar el balance general');
        }
    };

    const handleCreateGoal = async () => {
        if (!newGoal.name || !newGoal.target) return toast.error('Rellena los campos obligatorios');
        try {
            const payload = {
                user_id: user?.id,
                name: newGoal.name,
                target_amount: parseFloat(newGoal.target),
                current_amount: parseFloat(newGoal.current) || 0,
                deadline: newGoal.deadline || null,
                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                linked_account_id: newGoal.linkedAccountId === 'none' ? null : newGoal.linkedAccountId,
                interest_rate: newGoal.interestRate ? parseFloat(newGoal.interestRate) : 0
            };
            const { error } = await supabase.from('savings_goals').insert(payload);
            if (error) throw error;
            toast.success('Meta creada');
            setIsAddGoalOpen(false);
            setNewGoal({ name: '', target: '', current: '', deadline: '', linkedAccountId: 'none', interestRate: '' });
            fetchData(user?.id);
        } catch (error) {
            console.error(error);
            toast.error('Error al crear meta');
        }
    };

    const handleAddGoalTransaction = async () => {
        if (!selectedGoal || !newTransaction.amount) return toast.error('Importe obligatorio');
        try {
            let amount = parseFloat(newTransaction.amount);
            if (transType === 'expense') amount = -amount;
            const { error: txError } = await supabase.from('savings_goal_transactions').insert({
                goal_id: selectedGoal.id,
                amount: amount,
                date: newTransaction.date,
                description: newTransaction.description || (transType === 'deposit' ? 'Aporte' : 'Retiro')
            });
            if (txError) throw txError;
            const newTotal = (selectedGoal.current_amount || 0) + amount;
            const { error: upError } = await supabase.from('savings_goals').update({ current_amount: newTotal }).eq('id', selectedGoal.id);
            if (upError) throw upError;
            toast.success('Movimiento registrado');
            setNewTransaction({ amount: '', description: '', date: format(new Date(), 'yyyy-MM-dd') });
            fetchGoalTransactions(selectedGoal.id);
            fetchData(user?.id);
            setSelectedGoal({ ...selectedGoal, current_amount: newTotal });
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar movimiento');
        }
    };

    const handleSubmitAccountTransaction = async ({
        transactionId,
        amount,
        date,
        description,
        kind,
        is_envelope_spend
    }: {
        transactionId?: string;
        amount: number;
        date: string;
        description: string;
        kind: 'deposit' | 'expense';
        is_envelope_spend?: boolean;
    }) => {
        if (!selectedAccount) {
            toast.error('Selecciona una cuenta');
            return;
        }

        try {
            const signedAmount = kind === 'expense' ? -Math.abs(amount) : Math.abs(amount);
            const currentTransaction = transactionId
                ? accountTransactions.find((tx) => tx.id === transactionId)
                : null;

            if (transactionId && !currentTransaction) {
                throw new Error('Movimiento no encontrado');
            }

            if (currentTransaction) {
                const { error: txError } = await supabase
                    .from('savings_account_transactions')
                    .update({
                        amount: signedAmount,
                        date,
                        description: description || (kind === 'deposit' ? 'Ingreso' : 'Retiro'),
                        is_envelope_spend
                    })
                    .eq('id', transactionId);

                if (txError) throw txError;

                let balanceDiff = 0;
                let envelopeDiff = 0;

                if (currentTransaction.is_envelope_spend) {
                    envelopeDiff -= Math.abs(currentTransaction.amount);
                } else {
                    balanceDiff -= currentTransaction.amount;
                }

                if (is_envelope_spend) {
                    envelopeDiff += Math.abs(signedAmount);
                } else {
                    balanceDiff += signedAmount;
                }

                const recalculatedBalance = (selectedAccount.current_balance || 0) + balanceDiff;
                const recalculatedEnvelope = (selectedAccount.envelope_spent || 0) + envelopeDiff;

                const { error: accountError } = await supabase
                    .from('savings_accounts')
                    .update({ current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope })
                    .eq('id', selectedAccount.id);

                if (accountError) throw accountError;

                setSelectedAccount({ ...selectedAccount, current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope });
                toast.success('Movimiento actualizado');
            } else {
                const { error: txError } = await supabase.from('savings_account_transactions').insert({
                    account_id: selectedAccount.id,
                    amount: signedAmount,
                    date,
                    description: description || (kind === 'deposit' ? 'Ingreso' : 'Retiro'),
                    is_envelope_spend
                });

                if (txError) throw txError;

                let recalculatedBalance = selectedAccount.current_balance || 0;
                let recalculatedEnvelope = selectedAccount.envelope_spent || 0;

                if (is_envelope_spend) {
                    recalculatedEnvelope += Math.abs(signedAmount);
                } else {
                    recalculatedBalance += signedAmount;
                }

                const { error: accountError } = await supabase
                    .from('savings_accounts')
                    .update({ current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope })
                    .eq('id', selectedAccount.id);

                if (accountError) throw accountError;

                setSelectedAccount({ ...selectedAccount, current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope });
                toast.success('Movimiento registrado');
            }

            await fetchAccountTransactions(selectedAccount.id);
            await fetchData(user?.id);
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar movimiento');
        }
    };

    const handleDeleteGoalTransaction = async (txId: string, amount: number) => {
        if (!selectedGoal) return;
        try {
            const { error: txError } = await supabase
                .from('savings_goal_transactions')
                .delete()
                .eq('id', txId);

            if (txError) throw txError;

            const newAmount = (selectedGoal.current_amount || 0) - amount;
            const { error: gError } = await supabase
                .from('savings_goals')
                .update({ current_amount: newAmount })
                .eq('id', selectedGoal.id);

            if (gError) throw gError;

            setSelectedGoal({ ...selectedGoal, current_amount: newAmount });

            // Re-fetch transactions
            const { data: gtxs } = await supabase
                .from('savings_goal_transactions')
                .select('*')
                .eq('goal_id', selectedGoal.id)
                .order('date', { ascending: false });
            setGoalTransactions(gtxs || []);

            fetchData(user?.id);
            toast.success('Movimiento de meta eliminado');
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar movimiento de meta');
        }
    };

    const handleSyncGoalBalance = async (goalId: string) => {
        try {
            const { data: gtxs } = await supabase
                .from('savings_goal_transactions')
                .select('amount')
                .eq('goal_id', goalId);

            const trueSum = (gtxs || []).reduce((s, t) => s + t.amount, 0);

            await supabase.from('savings_goals').update({ current_amount: trueSum }).eq('id', goalId);

            toast.success('Meta sincronizada');
            fetchData(user?.id);
            if (selectedGoal?.id === goalId) {
                setSelectedGoal(prev => prev ? { ...prev, current_amount: trueSum } : prev);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al sincronizar meta');
        }
    };

    const handleDeleteAccountTransaction = async (transactionId: string, amount: number) => {
        if (!selectedAccount) return;

        try {
            const tx = accountTransactions.find(t => t.id === transactionId);
            const { error: txError } = await supabase
                .from('savings_account_transactions')
                .delete()
                .eq('id', transactionId);

            if (txError) throw txError;

            let recalculatedBalance = selectedAccount.current_balance || 0;
            let recalculatedEnvelope = selectedAccount.envelope_spent || 0;

            if (tx?.is_envelope_spend) {
                recalculatedEnvelope -= Math.abs(amount);
            } else {
                recalculatedBalance -= amount;
            }

            const { error: accountError } = await supabase
                .from('savings_accounts')
                .update({ current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope })
                .eq('id', selectedAccount.id);

            if (accountError) throw accountError;

            setSelectedAccount({ ...selectedAccount, current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope });
            await fetchAccountTransactions(selectedAccount.id);
            await fetchData(user?.id);
            toast.success('Movimiento eliminado');
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar movimiento');
        }
    };

    const handleDeleteAccountTransactions = async (transactionIds: string[], totalAmount: number) => {
        if (!selectedAccount || transactionIds.length === 0) return;

        try {
            const txsToDelete = accountTransactions.filter(t => transactionIds.includes(t.id));
            const { error: txError } = await supabase
                .from('savings_account_transactions')
                .delete()
                .in('id', transactionIds);

            if (txError) throw txError;

            let balanceDiff = 0;
            let envelopeDiff = 0;

            for (const tx of txsToDelete) {
                if (tx.is_envelope_spend) {
                    envelopeDiff -= Math.abs(tx.amount);
                } else {
                    balanceDiff -= tx.amount;
                }
            }

            const recalculatedBalance = (selectedAccount.current_balance || 0) + balanceDiff;
            const recalculatedEnvelope = (selectedAccount.envelope_spent || 0) + envelopeDiff;

            const { error: accountError } = await supabase
                .from('savings_accounts')
                .update({ current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope })
                .eq('id', selectedAccount.id);

            if (accountError) throw accountError;

            setSelectedAccount({ ...selectedAccount, current_balance: recalculatedBalance, envelope_spent: recalculatedEnvelope });
            await fetchAccountTransactions(selectedAccount.id);
            await fetchData(user?.id);
            toast.success(`${transactionIds.length} movimientos eliminados`);
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar movimientos');
        }
    };

    const handleSyncAccountBalance = async (accountId: string) => {
        try {
            const { data: txs } = await supabase
                .from('savings_account_transactions')
                .select('amount, is_envelope_spend')
                .eq('account_id', accountId);

            let trueBalance = 0;
            let currentEnvelope = 0;

            for (const tx of (txs || [])) {
                if (tx.is_envelope_spend) {
                    currentEnvelope += Math.abs(tx.amount);
                } else {
                    trueBalance += tx.amount;
                }
            }

            const { error: accError } = await supabase
                .from('savings_accounts')
                .update({ current_balance: trueBalance, envelope_spent: currentEnvelope })
                .eq('id', accountId);

            if (accError) throw accError;

            toast.success('Saldo sincronizado (incluye estado de sobre)');
            fetchData(user?.id);
            if (selectedAccount?.id === accountId) {
                setSelectedAccount(prev => prev ? { ...prev, current_balance: trueBalance, envelope_spent: currentEnvelope } : prev);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al sincronizar saldo');
        }
    };

    const handleUpdateAccountBalance = async (accountId: string, newBalance: number) => {
        try {
            const { error: updateError } = await supabase
                .from('savings_accounts')
                .update({ current_balance: newBalance })
                .eq('id', accountId);

            if (updateError) throw updateError;

            toast.success('Saldo actualizado manualmente');
            await fetchData(user?.id);
            if (selectedAccount?.id === accountId) {
                setSelectedAccount(prev => prev ? { ...prev, current_balance: newBalance } : prev);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar saldo');
        }
    };

    const handleUpdateAccount = async (accountId: string, updates: Partial<BankAccount>) => {
        try {
            const { error: updateError } = await supabase
                .from('savings_accounts')
                .update(updates)
                .eq('id', accountId);

            if (updateError) throw updateError;

            toast.success('Cuenta actualizada');
            await fetchData(user?.id);
            if (selectedAccount?.id === accountId) {
                setSelectedAccount(prev => prev ? { ...prev, ...updates } : prev);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar cuenta');
        }
    };

    const handleSyncAllBalances = async () => {
        if (!user) return;
        try {
            toast.loading('Sincronizando todo...', { id: 'sync-all' });

            // 1. Sync Accounts
            const { data: accs } = await supabase.from('savings_accounts').select('id, parent_account_id').eq('user_id', user.id);
            if (accs) {
                for (const acc of accs) {
                    const { data: txs } = await supabase.from('savings_account_transactions').select('amount, is_envelope_spend').eq('account_id', acc.id);

                    let sum = 0;
                    let envSum = 0;
                    for (const t of (txs || [])) {
                        if (t.is_envelope_spend && acc.parent_account_id) envSum += Math.abs(t.amount);
                        else sum += t.amount;
                    }

                    await supabase.from('savings_accounts').update({ current_balance: sum, envelope_spent: envSum }).eq('id', acc.id);
                }
            }

            // 2. Sync Goals
            const { data: metas } = await supabase.from('savings_goals').select('id').eq('user_id', user.id);
            if (metas) {
                for (const meta of metas) {
                    const { data: gtxs } = await supabase.from('savings_goal_transactions').select('amount').eq('goal_id', meta.id);
                    const sum = (gtxs || []).reduce((s, t) => s + t.amount, 0);
                    await supabase.from('savings_goals').update({ current_amount: sum }).eq('id', meta.id);
                }
            }

            toast.success('Todo sincronizado correctamente', { id: 'sync-all' });
            fetchData(user.id);
        } catch (error) {
            console.error(error);
            toast.error('Error en la sincronización global', { id: 'sync-all' });
        }
    };


    const handleDeleteAccount = async () => {
        if (!selectedAccount) return;
        if (!window.confirm('¿Seguro que quieres eliminar esta cuenta? Se perderá el historial y las metas asociadas.')) return;
        try {
            const { error } = await supabase.from('savings_accounts').delete().eq('id', selectedAccount.id);
            if (error) throw error;
            toast.success('Cuenta eliminada');
            setIsAccountDetailOpen(false);
            setSelectedAccount(null);
            setAccountTransactions([]);
            fetchData(user?.id);
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar cuenta');
        }
    };
    const handleResetData = async (options: ResetOptions) => {
        if (!user) return;
        try {
            const allAccountIds = accounts.map((account) => account.id);
            const targetAccountIds = options.accounts
                ? options.accountDeletionMode === 'single' && options.selectedAccountId
                    ? [options.selectedAccountId]
                    : allAccountIds
                : allAccountIds;

            if (options.accounts) {
                if (targetAccountIds.length > 0) {
                    await supabase.from('savings_account_transactions').delete().in('account_id', targetAccountIds);
                    await supabase.from('savings_accounts').delete().in('id', targetAccountIds);
                }
            } else if (options.transactions && targetAccountIds.length > 0) {
                await supabase.from('savings_account_transactions').delete().in('account_id', targetAccountIds);
                await supabase.from('savings_accounts').update({ current_balance: 0 }).in('id', targetAccountIds);
            }

            if (options.goals) {
                await supabase.from('savings_goals').delete().eq('user_id', user.id);
            }
            if (options.recurring) {
                await supabase.from('savings_recurring_items').delete().eq('user_id', user.id);
            }
            if (options.pending) {
                await supabase.from('pending_balance_expenses').delete().eq('user_id', user.id);
                await supabase.from('pending_balance_projects').delete().eq('user_id', user.id);
            }

            toast.success(options.accounts && options.accountDeletionMode === 'single' ? 'Cuenta eliminada correctamente' : 'Datos eliminados correctamente');
            setIsResetDialogOpen(false);
            fetchData(user.id);
        } catch (error) {
            console.error(error);
            toast.error('Error al resetear datos');
        }
    };
    const handleCreateRecurring = async () => {
        if (!newRecurring.name || !newRecurring.amount) return toast.error('Rellena nombre e importe');
        try {
            const payload = {
                user_id: user?.id,
                name: newRecurring.name,
                amount: parseFloat(newRecurring.amount),
                type: newRecurring.type,
                day_of_month: newRecurring.day ? parseInt(newRecurring.day) : null,
                category: 'General',
                target_account_id: newRecurring.targetAccountId === 'none' ? null : newRecurring.targetAccountId,
                end_date: newRecurring.endDate || null
            };
            const { error } = await supabase.from('savings_recurring_items').insert(payload);
            if (error) throw error;
            toast.success('Fijo añadido');
            setIsAddRecurringOpen(false);
            setNewRecurring({ name: '', amount: '', type: 'expense', day: '', targetAccountId: 'none', endDate: '' });
            fetchData(user?.id);
        } catch (error) {
            console.error(error);
            toast.error('Error al crear fijo');
        }
    };

    const handleDeleteRecurring = async (id: string) => {
        if (!window.confirm('¿Eliminar este gasto/ingreso fijo?')) return;
        try {
            const { error } = await supabase.from('savings_recurring_items').delete().eq('id', id);
            if (error) throw error;
            toast.success('Eliminado');
            fetchData(user?.id);
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const navigateToPassword = (passId: string) => {
        window.open(`/apps/mi-hogar/passwords`, '_blank');
    };

    // --- CALCULATIONS ---
    const selectedAccountPasswordId = selectedAccount?.password_id;
    const selectedAccountPasswordName = selectedAccountPasswordId
        ? passwords.find((p) => p.id === selectedAccountPasswordId)?.name
        : undefined;
    const totalCurrentBalance = accounts.filter(a => a.include_in_total !== false).reduce((acc, curr) => acc + (curr.current_balance || 0), 0);
    const totalGoalSaved = goals.reduce((acc, curr) => acc + (curr.current_amount || 0), 0);

    return (
        <div className="container mx-auto p-4 max-w-6xl space-y-6 pb-nav">
            {/* Header */}
            <div className="flex justify-between items-center">
                <Link href="/apps/mi-hogar">
                    <Button variant="ghost" size="sm" className="rounded-full gap-2 text-xs font-semibold uppercase tracking-wider">
                        <ArrowLeft className="h-4 w-4" /> Volver
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsImporterOpen(true)}>
                        <FileUp className="h-4 w-4" /> Importar Extracto
                    </Button>
                    <SavingsNotificationSettings />
                    <Button
                        variant="outline"
                        size="icon"
                        className="text-red-500 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20 w-9 h-9 sm:w-8 sm:h-8"
                        onClick={() => setIsResetDialogOpen(true)}
                        title="Purgar Datos"
                    >
                        <Settings className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Notification Manager (invisible) */}
            <SavingsNotificationManager />

            {/* MAIN DASHBOARD UI */}
            <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/40 rounded-[1.5rem] p-4 shadow-sm border-2 border-green-600/30 dark:border-green-800">
                <Button variant="ghost" size="icon" className="text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50" onClick={() => {
                    const prev = new Date(selectedMonth);
                    prev.setMonth(prev.getMonth() - 1);
                    setSelectedMonth(prev);
                    fetchData(user?.id, prev);
                }}>
                    <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-lg font-bold capitalize text-slate-800 dark:text-slate-100">
                    {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                </h2>
                <Button variant="ghost" size="icon" className="text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50" onClick={() => {
                    const next = new Date(selectedMonth);
                    next.setMonth(next.getMonth() + 1);
                    setSelectedMonth(next);
                    fetchData(user?.id, next);
                }}>
                    <ChevronRight className="w-5 h-5" />
                </Button>
            </div>

            <SavingsDashboardUI
                accounts={accounts}
                goals={goals}
                monthlyStats={monthlyStats}
                accountStats={accountStats}
                totalBalance={selectedMonthBalance}
                totalGoalSaved={totalGoalSaved}
                chartData={chartData}
                loading={loading}
                selectedMonth={selectedMonth}
                onAddAccount={() => setIsAddAccountOpen(true)}
                onAddGoal={() => setIsAddGoalOpen(true)}
                onAddTransaction={() => {
                    if (accounts.length > 0) {
                        handleOpenAccountDetail(accounts[0]);
                    } else {
                        toast.info("Añade una cuenta primero");
                    }
                }}
                onViewAccount={handleOpenAccountDetail}
                recentTransactions={recentTransactions}
                recurringItems={recurringItems}
                onDeleteRecurring={handleDeleteRecurring}
                userId={user?.id}
                pendingTotal={pendingTotal}
                onBalanceChange={() => fetchData(user?.id)}
                onSyncAll={handleSyncAllBalances}
            />

            {/* --- BANK STATEMENT IMPORTER --- */}
            <BankStatementImporter
                open={isImporterOpen}
                onOpenChange={setIsImporterOpen}
                accounts={accounts}
                userId={user?.id || ''}
                onImportComplete={() => fetchData(user?.id)}
            />

            {/* --- RESET DATA DIALOG --- */}
            <ResetDataDialog
                isOpen={isResetDialogOpen}
                onClose={() => setIsResetDialogOpen(false)}
                onConfirm={handleResetData}
                accounts={accounts.map((account) => ({
                    id: account.id,
                    name: account.name,
                    bank_name: account.bank_name,
                }))}
            />

            {/* --- DIALOGS --- */}

            <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Añadir Cuenta</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Nombre</Label><Input placeholder="Ej: Ahorros Piso" value={newAccount.name} onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })} /></div>
                        <div className="space-y-2">
                            <Label>Banco</Label>
                            <Select value={newAccount.bank} onValueChange={(v) => {
                                const isManual = v === 'Otro';
                                if (!isManual) {
                                    const bankInfo = BANKS.find(b => b.name === v);
                                    setNewAccount({ ...newAccount, bank: v, color: bankInfo?.color || '#64748b' });
                                } else {
                                    setNewAccount({ ...newAccount, bank: v });
                                }
                            }}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                    {BANKS.map(b => (
                                        <SelectItem key={b.name} value={b.name}><div className="flex items-center gap-2">{b.logo ? <img src={b.logo} alt={b.name} className="w-5 h-5 object-contain" /> : <div className="w-4 h-4 rounded-full" style={{ backgroundColor: b.color }} />}{b.name}</div></SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {newAccount.bank === 'Otro' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Nombre Banco</Label><Input value={newAccount.customBankName || ''} onChange={(e) => setNewAccount({ ...newAccount, customBankName: e.target.value })} /></div>
                                <div className="space-y-2"><Label>Color</Label><input type="color" className="h-9 w-12 p-1 rounded border cursor-pointer" value={newAccount.color} onChange={(e) => setNewAccount({ ...newAccount, color: e.target.value })} /></div>
                            </div>
                        )}
                        <div className="space-y-2"><Label>Interés Anual (%)</Label><Input type="number" placeholder="Ej: 3.5" value={newAccount.interestRate} onChange={(e) => setNewAccount({ ...newAccount, interestRate: e.target.value })} /></div>
                        <div className="space-y-2">
                            <Label>Contraseña (Opcional)</Label>
                            <Select onValueChange={(v) => setNewAccount({ ...newAccount, passId: v })}>
                                <SelectTrigger><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sin vincular</SelectItem>{passwords.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                            <div className="space-y-2">
                                <Label>¿Es un Sobre protegido?</Label>
                                <p className="text-[10px] text-slate-500 mb-2">Vincula esta cuenta como un fondo que vive dentro de otra cuenta principal (ej. Vacaciones en BBVA).</p>
                                <Select onValueChange={(v) => setNewAccount({ ...newAccount, parentAccountId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Cuenta Independiente" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Cuenta Independiente (No es sobre)</SelectItem>
                                        {accounts.filter(a => !a.parent_account_id).map(acc => (
                                            <SelectItem key={acc.id} value={acc.id}>🗂 Sobre de: {acc.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {newAccount.parentAccountId !== 'none' && (
                                <div className="space-y-2">
                                    <Label>Gastado del sobre en la cuenta principal (€)</Label>
                                    <Input type="number" placeholder="Ej: 500" value={newAccount.envelopeSpent} onChange={(e) => setNewAccount({ ...newAccount, envelopeSpent: e.target.value })} />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-green-100 bg-green-50/70 px-4 py-3">
                            <div className="space-y-1">
                                <Label htmlFor="include-in-total" className="text-sm font-semibold text-slate-900">Incluir en balance general</Label>
                                <p className="text-xs text-slate-500">Esta cuenta sumará al total principal de Mi Economía.</p>
                            </div>
                            <Switch
                                id="include-in-total"
                                checked={newAccount.includeInTotal}
                                onCheckedChange={(checked) => setNewAccount({ ...newAccount, includeInTotal: checked })}
                            />
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateAccount}>Crear Cuenta</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nueva Meta de Economía</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Nombre</Label><Input value={newGoal.name} onChange={(e) => setNewGoal({ ...newGoal, name: e.target.value })} /></div>
                        <div className="space-y-2">
                            <Label>Banco Asociado</Label>
                            <Select value={newGoal.linkedAccountId} onValueChange={(v) => setNewGoal({ ...newGoal, linkedAccountId: v })}>
                                <SelectTrigger><SelectValue placeholder="Selecciona un banco..." /></SelectTrigger>
                                <SelectContent><SelectItem value="none">Sin asociar</SelectItem>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bank_name})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Objetivo (€)</Label><Input type="number" value={newGoal.target} onChange={(e) => setNewGoal({ ...newGoal, target: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Ya tienes (€)</Label><Input type="number" value={newGoal.current} onChange={(e) => setNewGoal({ ...newGoal, current: e.target.value })} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Interés (%)</Label><Input type="number" value={newGoal.interestRate} onChange={(e) => setNewGoal({ ...newGoal, interestRate: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Fecha Límite</Label><Input type="date" value={newGoal.deadline} onChange={(e) => setNewGoal({ ...newGoal, deadline: e.target.value })} /></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateGoal}>Crear Meta</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddRecurringOpen} onOpenChange={setIsAddRecurringOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nuevo Ingreso/Gasto Fijo</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Nombre</Label><Input placeholder="Ej: Alquiler, Nómina..." value={newRecurring.name} onChange={(e) => setNewRecurring({ ...newRecurring, name: e.target.value })} /></div>
                        <div className="flex gap-4">
                            <Button variant={newRecurring.type === 'income' ? 'default' : 'outline'} onClick={() => setNewRecurring({ ...newRecurring, type: 'income' })} className={newRecurring.type === 'income' ? 'bg-green-800 hover:bg-green-900 w-full' : 'w-full'}>Ingreso</Button>
                            <Button variant={newRecurring.type === 'expense' ? 'default' : 'outline'} onClick={() => setNewRecurring({ ...newRecurring, type: 'expense' })} className={newRecurring.type === 'expense' ? 'bg-rose-600 hover:bg-rose-700 w-full' : 'w-full'}>Gasto</Button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>Importe (€)</Label><Input type="number" value={newRecurring.amount} onChange={(e) => setNewRecurring({ ...newRecurring, amount: e.target.value })} /></div>
                            <div className="space-y-2"><Label>Día del mes</Label><Input type="number" min="1" max="31" placeholder="Ej: 5" value={newRecurring.day} onChange={(e) => setNewRecurring({ ...newRecurring, day: e.target.value })} /></div>
                        </div>

                        {newRecurring.type === 'income' && (
                            <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950/10 rounded-lg border border-green-100 dark:border-green-950">
                                <Label className="text-green-900 dark:text-green-400 font-semibold flex items-center gap-2">
                                    <Landmark className="w-4 h-4" /> Ingreso Automático (Opcional)
                                </Label>
                                <p className="text-xs text-muted-foreground mb-2">Si seleccionas una cuenta, el dinero se sumará automáticamente el día elegido.</p>
                                <Select value={newRecurring.targetAccountId} onValueChange={(v) => setNewRecurring({ ...newRecurring, targetAccountId: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona cuenta destino..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No automatizar (Solo recordatorio)</SelectItem>
                                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({acc.bank_name})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Fin (Opcional)</Label>
                            <Input type="date" value={newRecurring.endDate} onChange={(e) => setNewRecurring({ ...newRecurring, endDate: e.target.value })} />
                            <p className="text-xs text-muted-foreground">Dejar en blanco para indefinido.</p>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleCreateRecurring}>Guardar</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isGoalDetailOpen} onOpenChange={setIsGoalDetailOpen}>
                <DialogContent className="max-w-md sm:max-w-lg">
                    <DialogHeader><DialogTitle>Detalle: {selectedGoal?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-6 py-2">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg text-center relative">
                            <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                                Saldo Actual
                                <button
                                    onClick={() => {
                                        if (selectedGoal && window.confirm('¿Quieres sincronizar esta meta con sus movimientos?')) {
                                            handleSyncGoalBalance(selectedGoal.id);
                                        }
                                    }}
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
                                    title="Sincronizar Meta"
                                >
                                    <Repeat className="w-3 h-3 text-slate-400" />
                                </button>
                            </p>
                            <div className="text-3xl font-bold text-green-800 dark:text-green-400">{selectedGoal?.current_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                            <p className="text-xs text-muted-foreground mt-1">Meta: {selectedGoal?.target_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</p>
                            {selectedGoal?.interest_rate ? <div className="absolute top-2 right-2 bg-green-100 text-green-900 text-xs px-2 py-1 rounded-full font-bold">{selectedGoal.interest_rate}% Interés</div> : null}
                        </div>
                        <div className="space-y-3 border-t pt-4">
                            <div className="flex justify-center gap-4 mb-2">
                                <Button variant={transType === 'deposit' ? 'default' : 'outline'} onClick={() => setTransType('deposit')} className={transType === 'deposit' ? 'bg-green-800 hover:bg-green-900 text-white' : ''} size="sm"><TrendingUp className="w-4 h-4 mr-2" />Aportación</Button>
                                <Button variant={transType === 'expense' ? 'default' : 'outline'} onClick={() => setTransType('expense')} className={transType === 'expense' ? 'bg-red-600 hover:bg-red-700 text-white' : ''} size="sm"><Wallet className="w-4 h-4 mr-2" />Gasto</Button>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Input placeholder="Importe (Ej: 50)" type="number" value={newTransaction.amount} onChange={(e) => setNewTransaction({ ...newTransaction, amount: e.target.value })} />
                                <Input type="date" value={newTransaction.date} onChange={(e) => setNewTransaction({ ...newTransaction, date: e.target.value })} />
                            </div>
                            <div className="flex gap-3">
                                <Input placeholder="Concepto..." value={newTransaction.description} onChange={(e) => setNewTransaction({ ...newTransaction, description: e.target.value })} />
                                <Button size="icon" onClick={handleAddGoalTransaction}><Save className="w-4 h-4" /></Button>
                            </div>
                        </div>
                        <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1">
                            <h4 className="font-medium text-sm">Historial</h4>
                            {goalTransactions.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Sin movimientos</p> :
                                goalTransactions.map(tx => (
                                    <div key={tx.id} className="flex justify-between items-center text-sm p-2 border rounded hover:bg-slate-50 dark:hover:bg-slate-900/50">
                                        <div><p className="font-medium">{tx.description || 'Movimiento'}</p><p className="text-xs text-muted-foreground">{format(parseISO(tx.date), 'dd MMM yyyy', { locale: es })}</p></div>
                                        <div className="flex items-center gap-3">
                                            <span className={tx.amount >= 0 ? 'text-green-800 font-bold' : 'text-red-600 font-bold'}>{tx.amount >= 0 ? '+' : ''}{tx.amount}€</span>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm('¿Eliminar este movimiento de la meta?')) {
                                                        handleDeleteGoalTransaction(tx.id, tx.amount);
                                                    }
                                                }}
                                                className="text-slate-400 hover:text-red-500 transition-colors p-1"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <AccountDetailDialog
                open={isAccountDetailOpen}
                onOpenChange={setIsAccountDetailOpen}
                account={selectedAccount}
                transactions={accountTransactions}
                linkedPasswordName={selectedAccountPasswordName}
                onSubmitTransaction={handleSubmitAccountTransaction}
                onDeleteTransaction={handleDeleteAccountTransaction}
                onDeleteTransactions={handleDeleteAccountTransactions}
                onDeleteAccount={handleDeleteAccount}
                onSyncBalance={handleSyncAccountBalance}
                onUpdateBalance={handleUpdateAccountBalance}
                onUpdateAccount={handleUpdateAccount}
                onToggleIncludeInTotal={handleToggleAccountInTotal}
                onNavigateAccount={handleOpenAccountDetail}
                onNavigateToPassword={selectedAccountPasswordId ? () => navigateToPassword(selectedAccountPasswordId) : undefined}
                accounts={accounts}
            />

        </div>
    );
}








