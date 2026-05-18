'use client';

import React, { useEffect, useState, useRef } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const AccountDetailDialog = dynamic(() => import('@/components/apps/mi-hogar/savings/account-detail-dialog'), { ssr: false });
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// TypeScript Types
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
    account_id: string;
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

// 8% Opacity rounded pill styling builder
const getBankStyle = (bankName?: string) => {
    if (!bankName) return { border: '1px solid #cbd5e1', background: 'rgba(203, 213, 225, 0.08)', color: '#64748b', borderRadius: '20px', padding: '2px 8px', fontSize: '11px', fontWeight: '600', display: 'inline-flex', alignItems: 'center' };
    const bank = BANKS.find(b => b.name.toLowerCase() === bankName.toLowerCase()) || { color: '#64748b' };
    const hex = bank.color;
    const cleanHex = hex.startsWith('#') ? hex.slice(1) : hex;
    let r = 100, g = 100, b = 100;
    if (cleanHex.length === 6) {
        r = parseInt(cleanHex.slice(0, 2), 16);
        g = parseInt(cleanHex.slice(2, 4), 16);
        b = parseInt(cleanHex.slice(4, 6), 16);
    }
    return {
        border: `1.5px solid ${hex}`,
        background: `rgba(${r}, ${g}, ${b}, 0.08)`,
        color: hex,
        borderRadius: '20px',
        padding: '2px 8px',
        fontSize: '11px',
        fontWeight: '600',
        display: 'inline-flex',
        alignItems: 'center'
    };
};

// Intelligent Description Expense Categorizer
const classifyExpense = (description: string): string => {
    const desc = (description || '').toLowerCase();
    if (desc.includes('alquiler') || desc.includes('hipoteca') || desc.includes('luz') || desc.includes('agua') || desc.includes('gas') || desc.includes('casa') || desc.includes('comunidad') || desc.includes('ibi')) {
        return 'Vivienda';
    }
    if (desc.includes('super') || desc.includes('mercadona') || desc.includes('carrefour') || desc.includes('lidl') || desc.includes('comida') || desc.includes('cena') || desc.includes('restaurante') || desc.includes('bar') || desc.includes('compras') || desc.includes('ahorramas') || desc.includes('aldi') || desc.includes('dia')) {
        return 'Alimentación';
    }
    if (desc.includes('gasolina') || desc.includes('metro') || desc.includes('bus') || desc.includes('taxi') || desc.includes('uber') || desc.includes('renfe') || desc.includes('coche') || desc.includes('peaje') || desc.includes('transporte') || desc.includes('parking')) {
        return 'Transporte';
    }
    if (desc.includes('netflix') || desc.includes('spotify') || desc.includes('prime') || desc.includes('hbo') || desc.includes('disney') || desc.includes('suscrip') || desc.includes('apple') || desc.includes('movistar') || desc.includes('orange') || desc.includes('vodafone')) {
        return 'Suscripciones';
    }
    if (desc.includes('cine') || desc.includes('regalo') || desc.includes('viaje') || desc.includes('hotel') || desc.includes('vuelo') || desc.includes('concierto') || desc.includes('fiesta') || desc.includes('ocio') || desc.includes('copa') || desc.includes('museo') || desc.includes('escapada') || desc.includes('vacaciones')) {
        return 'Ocio';
    }
    return 'Otros';
};

export default function SavingsV2Preview() {
    const [activeTab, setActiveTab] = useState('overview');
    const [activeTimeframe, setActiveTimeframe] = useState('1M');
    const chartsRef = useRef<Record<string, any>>({});

    const { user, loading: authLoading } = useAuth();
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
    const [monthlyStats, setMonthlyStats] = useState({ income: 0, expense: 0, savingsRate: 0 });
    const [chartData, setChartData] = useState<any[]>([]);
    const [recurringItems, setRecurringItems] = useState<RecurringItem[]>([]);
    const [pendingExpenses, setPendingExpenses] = useState<any[]>([]);
    const [pendingTotal, setPendingTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [selectedMonthBalance, setSelectedMonthBalance] = useState<number>(0);
    const [accountStats, setAccountStats] = useState<Record<string, { income: number, expense: number }>>({});
    
    const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
        const d = new Date();
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const [aiInsight, setAiInsight] = useState<{ insight: string, metricHighlight: string, type: string } | null>(null);
    const [aiLoading, setAiLoading] = useState(true);

    const [expandedBanks, setExpandedBanks] = useState<string[]>([]);
    const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
    const [accountTransactions, setAccountTransactions] = useState<SavingsTransaction[]>([]);
    const [isAccountDetailOpen, setIsAccountDetailOpen] = useState(false);
    const [passwords, setPasswords] = useState<any[]>([]);

    const selectedAccountPasswordId = selectedAccount?.password_id || null;
    const selectedAccountPasswordName = selectedAccountPasswordId
        ? passwords.find((p) => p.id === selectedAccountPasswordId)?.name
        : undefined;

    const processAutoDeposits = async (userId?: string) => {
        if (!userId) return;

        const today = new Date();
        const currentDay = today.getDate();
        const currentMonthStr = format(today, 'yyyy-MM');

        try {
            const { data: items } = await withTimeout<any>(
                supabase
                    .from('savings_recurring_items')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('type', 'income')
                    .not('target_account_id', 'is', null),
                QUERY_TIMEOUT_MS,
                'savings_recurring_items'
            );

            if (!items || items.length === 0) return;

            let processedCount = 0;

            for (const item of items) {
                if ((item.day_of_month || 1) > currentDay) continue;
                if (item.last_run_date && item.last_run_date.startsWith(currentMonthStr)) continue;
                if (item.end_date && new Date(item.end_date) < today) continue;

                await supabase.from('savings_account_transactions').insert({
                    user_id: userId,
                    account_id: item.target_account_id,
                    amount: item.amount,
                    date: format(today, 'yyyy-MM-dd'),
                    description: `Auto: ${item.name}`
                });

                const { data: acc } = await supabase.from('savings_accounts').select('current_balance').eq('id', item.target_account_id).single();
                if (acc) {
                    await supabase.from('savings_accounts').update({
                        current_balance: (acc.current_balance || 0) + item.amount
                    }).eq('id', item.target_account_id);
                }

                await supabase.from('savings_recurring_items').update({
                    last_run_date: format(today, 'yyyy-MM-dd')
                }).eq('id', item.id);

                processedCount++;
            }

            if (processedCount > 0) {
                toast.success(`Se han procesado ${processedCount} ingresos automáticos`);
                await fetchData(userId);
            }
        } catch (err) {
            console.error('Auto deposits failed:', err);
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
            const { data: accs } = await supabase
                .from('savings_accounts')
                .select('*')
                .eq('user_id', userId)
                .order('name');
            const accountsList = accs || [];
            setAccounts(accountsList);

            const { data: gls } = await supabase
                .from('savings_goals')
                .select('*')
                .eq('user_id', userId)
                .order('deadline', { ascending: true });
            setGoals(gls || []);

            const lastDayOfMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
            const today = new Date();
            const referenceDate = lastDayOfMonth < today ? lastDayOfMonth : today;
            const referenceDateStr = format(referenceDate, 'yyyy-MM-dd');

            const chartStartDate = new Date(referenceDate);
            chartStartDate.setDate(chartStartDate.getDate() - 365);

            const { data: txs } = await supabase
                .from('savings_account_transactions')
                .select('*')
                .gte('date', chartStartDate.toISOString().split('T')[0])
                .in('account_id', accountsList.map(a => a.id) || [])
                .order('date', { ascending: false });

            const includedAccountIds = accountsList.filter(a => a.include_in_total !== false).map(a => a.id);
            let currentTotal = accountsList.reduce((sum, a) => sum + (a.include_in_total !== false ? (a.current_balance || 0) : 0), 0);

            (txs || []).forEach(t => {
                if (t.date && t.date.split('T')[0] > referenceDateStr && includedAccountIds.includes(t.account_id)) {
                    currentTotal -= t.amount;
                }
            });

            setSelectedMonthBalance(currentTotal);

            const txsForMonth = (txs || []).filter(t => t.date && t.date.split('T')[0] <= referenceDateStr);
            setRecentTransactions(txsForMonth);

            const { data: recs } = await supabase
                .from('savings_recurring_items')
                .select('*')
                .eq('user_id', userId)
                .order('day_of_month', { ascending: true });
            setRecurringItems((recs as RecurringItem[]) || []);

            const { data: passes } = await supabase
                .from('passwords')
                .select('id, name');
            setPasswords(passes || []);

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

            const dailyBalances = [];
            let chartTotal = currentTotal;

            for (let i = 0; i < 365; i++) {
                const d = new Date(referenceDate);
                d.setDate(d.getDate() - i);
                const dateStr = format(d, 'yyyy-MM-dd');

                dailyBalances.push({
                    date: format(d, 'd MMM', { locale: es }),
                    fullDate: dateStr,
                    value: chartTotal
                });

                const daysTransactions = (txsForMonth || []).filter(t => t.date && t.date.split('T')[0] === dateStr && includedAccountIds.includes(t.account_id));
                const daysChange = daysTransactions.reduce((sum, t) => sum + t.amount, 0);

                chartTotal -= daysChange;
            }

            setChartData(dailyBalances.reverse());

            const { data: pendingExps } = await supabase
                .from('pending_balance_expenses')
                .select('*')
                .eq('user_id', userId)
                .eq('status', 'pending');
            setPendingExpenses(pendingExps || []);
            const pTotal = (pendingExps || []).reduce((s: number, e: any) => s + (e.amount || 0), 0);
            setPendingTotal(pTotal);

        } catch (error) {
            console.error(error);
            toast.error('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user) {
            setAccounts([]);
            setGoals([]);
            setRecentTransactions([]);
            setMonthlyStats({ income: 0, expense: 0, savingsRate: 0 });
            setChartData([]);
            setRecurringItems([]);
            setPendingExpenses([]);
            setPendingTotal(0);
            setSelectedMonthBalance(0);
            setLoading(false);
            return;
        }

        const loadSavingsPage = async () => {
            await fetchData(user.id);
            await processAutoDeposits(user.id);
        };
        loadSavingsPage();
    }, [user?.id, authLoading]);

    useEffect(() => {
        if (loading || authLoading || !user) {
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
            try {
                const res = await fetch('/api/financial-insights', {
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
                    }
                }
            } catch (error) {
                console.error(error);
            } finally {
                window.clearTimeout(timeoutId);
                setAiLoading(false);
            }
        };

        if (activeTab === 'overview') {
            fetchInsight();
        }
    }, [monthlyStats, recentTransactions, activeTab, loading, user, authLoading]);

    const fetchAccountTransactions = async (accountId: string) => {
        const { data } = await supabase
            .from('savings_account_transactions')
            .select('*')
            .eq('account_id', accountId)
            .order('date', { ascending: false });
        setAccountTransactions(data || []);
    };

    const handleOpenAccountDetail = async (acc: BankAccount) => {
        setSelectedAccount(acc);
        setAccountTransactions([]);
        await fetchAccountTransactions(acc.id);
        setIsAccountDetailOpen(true);
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
            await fetchData(user?.id);
            toast.success(checked ? 'Cuenta incluida en el total' : 'Cuenta excluida del total');
        } catch (error) {
            console.error(error);
            toast.error('Error al actualizar cuenta');
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
            await fetchData(user?.id);
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
            await fetchData(user?.id);
        } catch (error) {
            console.error(error);
            toast.error('Error al eliminar cuenta');
        }
    };

    // We define the initialization function for the charts
    const initCharts = () => {
        if (typeof window === 'undefined' || !(window as any).Chart || loading) return;
        const Chart = (window as any).Chart;

        const isDark = matchMedia('(prefers-color-scheme: dark)').matches;
        const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? '#888' : '#999';
        const qfYellow = '#F5C400';
        const qfRed = '#E24B4A';
        const qfGreen = '#3B6D11';

        // Destruir gráficos previos si existen para evitar errores al remontar
        Object.values(chartsRef.current).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        chartsRef.current = {};

        // --- CHART 1: Evolución del saldo (Línea) ---
        const balCtx = document.getElementById('balanceChart') as HTMLCanvasElement;
        if (balCtx && chartData && chartData.length > 0) {
            const days = activeTimeframe === '1M' ? 30 : activeTimeframe === '3M' ? 90 : activeTimeframe === '6M' ? 180 : 365;
            const slicedData = chartData.slice(-days);
            const labels = slicedData.map(d => d.date);
            const values = slicedData.map(d => d.value);

            chartsRef.current.balChart = new Chart(balCtx, {
                type: 'line',
                data: { labels: labels, datasets: [{ label: 'Saldo', data: values, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 2, fill: true, tension: 0.4, pointRadius: 0, pointHoverRadius: 4 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: any) => c.parsed.y.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) } } },
                    scales: {
                        x: { ticks: { color: textColor, maxTicksLimit: 6, font: { size: 11 } }, grid: { color: gridColor } },
                        y: { ticks: { color: textColor, callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'k €' : v + '€', font: { size: 11 } }, grid: { color: gridColor } }
                    }
                }
            });
        }

        // --- CHART 2: Distribución de gastos ---
        const monthExpenses = recentTransactions.filter(tx => {
            if (tx.amount >= 0) return false;
            const d = new Date(tx.date);
            return d.getMonth() === selectedMonth.getMonth() && d.getFullYear() === selectedMonth.getFullYear();
        });

        const categoriesMap: Record<string, number> = {
            'Vivienda': 0, 'Alimentación': 0, 'Transporte': 0, 'Suscripciones': 0, 'Ocio': 0, 'Otros': 0
        };
        monthExpenses.forEach(tx => {
            const cat = classifyExpense(tx.description);
            categoriesMap[cat] += Math.abs(tx.amount);
        });

        const pieLabels = Object.keys(categoriesMap);
        const pieData = Object.values(categoriesMap);
        const pieColors = ['#2563EB', '#10B981', '#EA580C', '#EF4444', '#8B5CF6', '#06B6D4'];

        const legend = document.getElementById('pie-legend');
        if (legend) {
            legend.innerHTML = '';
            const total = pieData.reduce((a, b) => a + b, 0);
            if (total === 0) {
                legend.innerHTML = '<span style="font-size: 11px; color: var(--color-text-secondary);">Sin gastos este mes</span>';
            } else {
                let html = '';
                pieLabels.forEach((l, i) => {
                    if (pieData[i] > 0) {
                        html += `<span><span class="qf-leg-sq" style="background:${pieColors[i]}"></span>${l} ${Math.round(pieData[i] / total * 100)}%</span>`;
                    }
                });
                legend.innerHTML = html;
            }
        }

        const pieCtx = document.getElementById('pieChart') as HTMLCanvasElement;
        if (pieCtx) {
            chartsRef.current.pieChart = new Chart(pieCtx, {
                type: 'doughnut',
                data: { labels: pieLabels, datasets: [{ data: pieData, backgroundColor: pieColors, borderWidth: 2, borderColor: isDark ? '#111' : '#fff' }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { display: false } } }
            });
        }

        // --- CHART 3: Ingresos vs Gastos últimos 6 meses (Barras) ---
        const barLabels: string[] = [];
        const barIncomes: number[] = [];
        const barExpenses: number[] = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(selectedMonth);
            d.setMonth(d.getMonth() - i);
            const mLabel = format(d, 'MMM', { locale: es });
            barLabels.push(mLabel.charAt(0).toUpperCase() + mLabel.slice(1));

            let incSum = 0;
            let expSum = 0;
            recentTransactions.forEach(tx => {
                const txDate = new Date(tx.date);
                if (txDate.getMonth() === d.getMonth() && txDate.getFullYear() === d.getFullYear()) {
                    if (tx.amount > 0) incSum += tx.amount;
                    else expSum += Math.abs(tx.amount);
                }
            });
            barIncomes.push(incSum);
            barExpenses.push(expSum);
        }

        const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
        if (barCtx) {
            chartsRef.current.barChart = new Chart(barCtx, {
                type: 'bar',
                data: {
                    labels: barLabels,
                    datasets: [
                        { label: 'Ingresos', data: barIncomes, backgroundColor: '#10b981', borderRadius: 4 },
                        { label: 'Gastos', data: barExpenses, backgroundColor: '#ef4444', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { display: false } },
                        y: { ticks: { color: textColor, callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'k €' : v + '€', font: { size: 11 } }, grid: { color: gridColor } }
                    }
                }
            });
        }

        // --- CHART 4: Distribución por cuenta ---
        const accPieCtx = document.getElementById('accPieChart') as HTMLCanvasElement;
        if (accPieCtx && accounts && accounts.length > 0) {
            const accNames = accounts.map(a => a.name);
            const accBals = accounts.map(a => a.current_balance);
            const accColors = accounts.map(a => a.color || '#166534');

            chartsRef.current.accPieChart = new Chart(accPieCtx, {
                type: 'doughnut',
                data: {
                    labels: accNames,
                    datasets: [{ data: accBals, backgroundColor: accColors, borderWidth: 2, borderColor: isDark ? '#111' : '#fff' }]
                },
                options: { responsive: true, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { display: false } } }
            });
        }

        // --- CHART 5: Progreso de Metas ---
        const goalsBarCtx = document.getElementById('goalsBar') as HTMLCanvasElement;
        if (goalsBarCtx && goals && goals.length > 0) {
            const goalNames = goals.map(g => g.name);
            const goalSavs = goals.map(g => g.current_amount);
            const goalTargs = goals.map(g => g.target_amount);

            chartsRef.current.goalsBar = new Chart(goalsBarCtx, {
                type: 'bar',
                data: {
                    labels: goalNames,
                    datasets: [
                        { label: 'Ahorrado', data: goalSavs, backgroundColor: qfYellow, borderRadius: 4 },
                        { label: 'Objetivo', data: goalTargs, backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)', borderRadius: 4 }
                    ]
                },
                options: {
                    indexAxis: 'y', responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor, callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'k €' : v + '€', font: { size: 11 } }, grid: { color: gridColor } },
                        y: { ticks: { color: textColor, font: { size: 11 } }, grid: { display: false } }
                    }
                }
            });
        }

        // --- CHART 6: Fijos ---
        const recurCtx = document.getElementById('recurChart') as HTMLCanvasElement;
        if (recurCtx) {
            const recIncs = recurringItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
            const recExps = recurringItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

            chartsRef.current.recurChart = new Chart(recurCtx, {
                type: 'bar',
                data: {
                    labels: ['Ingresos fijos', 'Gastos fijos'],
                    datasets: [{ data: [recIncs, recExps], backgroundColor: [qfGreen, qfRed], borderRadius: 6 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textColor }, grid: { display: false } },
                        y: { ticks: { color: textColor, callback: (v: any) => v >= 1000 ? (v / 1000).toFixed(0) + 'k €' : v + '€', font: { size: 11 } }, grid: { color: gridColor } }
                    }
                }
            });
        }
    };

    useEffect(() => {
        initCharts();
    }, [activeTab, activeTimeframe, loading, chartData, recentTransactions, accounts, goals, recurringItems]);

    const updateChart = (tf: string) => {
        setActiveTimeframe(tf);
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh', gap: '1rem', fontFamily: 'system-ui, sans-serif' }}>
                <div className="animate-spin" style={{ width: '40px', height: '40px', border: '3px solid #e2e8f0', borderTopColor: '#10b981', borderRadius: '50%' }}></div>
                <div style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>Cargando tus datos financieros de Quioba...</div>
                <style dangerouslySetInnerHTML={{ __html: `
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                    .animate-spin { animation: spin 1s linear infinite; }
                `}} />
            </div>
        );
    }

    const startBalance = selectedMonthBalance - monthlyStats.income + monthlyStats.expense;

    return (
        <>
            <style dangerouslySetInnerHTML={{
                __html: `
        :root {
          --qf: #F5C400;
          --qf-dark: #B8940A;
          --qf-darker: #7A6200;
          --qf-bg: #FFFBEB;
          --qf-border: #F5C40040;
          --font-sans: system-ui, -apple-system, sans-serif;
          --border-radius-lg: 16px;
          --border-radius-md: 10px;
          --color-background-primary: #fff;
          --color-background-secondary: #f8fafc;
          --color-border-secondary: #e2e8f0;
          --color-border-tertiary: #f1f5f9;
          --color-text-primary: #0f172a;
          --color-text-secondary: #64748b;
          --color-background-success: #bbf7d0;
          --color-text-success: #166534;
          --color-background-danger: #fecaca;
          --color-text-danger: #991b1b;
        }

        @media (prefers-color-scheme: dark) {
          :root {
            --color-background-primary: #0f172a;
            --color-background-secondary: #1e293b;
            --color-border-secondary: #334155;
            --color-border-tertiary: #1e293b;
            --color-text-primary: #f8fafc;
            --color-text-secondary: #94a3b8;
          }
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }
        .qf-wrap { font-family: var(--font-sans); width: 100%; max-width: 1000px; margin: 0 auto; padding: 20px; }

        .qf-header {
          background: var(--qf-bg);
          border: 1px solid rgba(245,196,0,0.5);
          border-radius: var(--border-radius-lg);
          padding: 1.5rem;
          color: #1a1200;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
        }
        .qf-header::before {
          content: '';
          position: absolute;
          top: -50px; right: -50px;
          width: 180px; height: 180px;
          border-radius: 50%;
          background: rgba(245,196,0,0.1);
        }
        .qf-header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; }
        .qf-badge { font-size: 11px; background: rgba(245,196,0,0.15); color: #7A6200; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(245,196,0,0.4); }
        .qf-balance-label { font-size: 12px; color: #7A6200; opacity: 0.9; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 4px; }
        .qf-balance-amount { font-size: 38px; font-weight: 500; color: #1a1200; letter-spacing: -0.02em; line-height: 1; }
        .qf-balance-sub { font-size: 12px; color: #7A6200; margin-top: 6px; opacity: 0.85; }
        .qf-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 1.25rem; }
        .qf-stat { background: #fff; border-radius: var(--border-radius-md); padding: 10px 12px; border: 1px solid rgba(245,196,0,0.3); }
        .qf-stat-label { font-size: 11px; color: #7A6200; opacity: 0.85; margin-bottom: 4px; }
        .qf-stat-val { font-size: 16px; font-weight: 500; color: #1a1200; }
        .qf-stat-val.green { color: #22c55e; }
        .qf-stat-val.red { color: #ef4444; }

        .qf-actions { display: flex; gap: 8px; margin-bottom: 1.5rem; flex-wrap: wrap; }
        .qf-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 20px;
          border: 1px solid #1a5c2e;
          background: #e8f5ec;
          color: #1a5c2e;
          font-size: 13px; cursor: pointer;
          transition: background 0.15s, border-color 0.15s;
          text-decoration: none;
        }
        .qf-btn:hover { background: #d6ebd8; border-color: #154a25; }
        .qf-btn.primary { background: #2563eb; color: #ffffff; border-color: #2563eb; font-weight: 500; }
        .qf-btn.primary:hover { background: #1d4ed8; }
        .qf-btn i { font-size: 15px; }

        .qf-tabs { display: flex; gap: 6px; margin-bottom: 1.25rem; flex-wrap: wrap; }
        .qf-tab { flex: 1; min-width: 100px; padding: 7px 4px; text-align: center; font-size: 12px; border-radius: 6px; cursor: pointer; color: #1a5c2e; border: 1px solid #1a5c2e; background: #e8f5ec; display: flex; align-items: center; justify-content: center; gap: 4px; white-space: nowrap; transition: all 0.15s; }
        .qf-tab.active { background: #2563eb; color: #ffffff; font-weight: 500; border-color: #2563eb; }
        .qf-tab i { font-size: 14px; }

        .qf-section { display: none; }
        .qf-section.active { display: block; }

        .qf-grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
        .qf-card { background: var(--qf-bg); border: 1px solid rgba(245,196,0,0.5); border-radius: var(--border-radius-lg); padding: 1.25rem; --color-background-primary: var(--qf-bg); --color-text-primary: #1a1200; --color-text-secondary: #7A6200; color: var(--color-text-primary); }
        .qf-card-title { font-size: 13px; color: var(--color-text-secondary); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px; }
        .qf-card-title i { font-size: 15px; color: #F5C400; }

        .qf-highlight { background: #FFFBEB; border-color: #F5C40060; }
        .qf-highlight .qf-card-title { color: #7A6200; }

        .qf-chart-wrap { position: relative; width: 100%; height: 200px; }
        .qf-chart-wrap2 { position: relative; width: 100%; height: 180px; }

        .qf-timeframe { display: flex; gap: 4px; margin-bottom: 0.75rem; }
        .qf-tf { font-size: 11px; padding: 3px 8px; border-radius: 12px; border: 0.5px solid var(--color-border-tertiary); background: transparent; color: var(--color-text-secondary); cursor: pointer; }
        .qf-tf.active { background: #2563eb; color: #ffffff; border-color: #2563eb; font-weight: 500; }

        .qf-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .qf-table th { text-align: left; padding: 8px 10px; font-size: 11px; color: var(--color-text-secondary); font-weight: 500; border-bottom: 0.5px solid var(--color-border-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
        .qf-table td { padding: 9px 10px; border-bottom: 0.5px solid var(--color-border-tertiary); color: var(--color-text-primary); }
        .qf-table tr:last-child td { border-bottom: none; }
        .qf-table tr:hover td { background: var(--color-background-secondary); }
        .amount-pos { color: #16a34a !important; font-weight: 600; }
        .amount-neg { color: #dc2626 !important; font-weight: 600; }

        .qf-account-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 0.5px solid var(--color-border-tertiary); }
        .qf-account-row:last-child { border-bottom: none; }
        .qf-account-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .qf-account-info { flex: 1; margin-left: 10px; }
        .qf-account-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
        .qf-account-bank { font-size: 11px; color: var(--color-text-secondary); margin-top: 2px; }
        .qf-account-bal { font-size: 14px; font-weight: 500; color: var(--color-text-primary); }

        .qf-goal-row { margin-bottom: 1rem; }
        .qf-goal-top { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
        .qf-goal-name { font-size: 13px; font-weight: 500; color: var(--color-text-primary); }
        .qf-goal-pct { font-size: 12px; color: var(--color-text-secondary); }
        .qf-progress { width: 100%; height: 7px; background: var(--color-background-secondary); border-radius: 10px; overflow: hidden; margin-bottom: 4px; }
        .qf-progress-fill { height: 100%; border-radius: 10px; }
        .qf-goal-amounts { display: flex; justify-content: space-between; font-size: 11px; color: var(--color-text-secondary); }

        .qf-rec-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 10px; border-radius: var(--border-radius-md); margin-bottom: 6px; background: var(--color-background-secondary); }
        .qf-rec-info { display: flex; align-items: center; gap: 10px; }
        .qf-rec-day { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 500; flex-shrink: 0; }

        .qf-insight { background: var(--qf-bg); border: 0.5px solid #F5C40050; border-left: 3px solid #F5C400; border-radius: var(--border-radius-lg); padding: 1rem 1.25rem; margin-bottom: 1.25rem; display: flex; gap: 10px; align-items: flex-start; }
        .qf-insight i { font-size: 18px; color: #F5C400; flex-shrink: 0; margin-top: 2px; }
        .qf-insight-metric { font-size: 18px; font-weight: 500; color: #7A6200; margin-bottom: 2px; }
        .qf-insight-text { font-size: 13px; color: #7A6200; line-height: 1.55; }

        .qf-legend { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 8px; font-size: 12px; color: var(--color-text-secondary); }
        .qf-legend span { display: flex; align-items: center; gap: 5px; }
        .qf-leg-sq { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

        .badge-warn { background: #FFFBEB; color: #7A6200; padding: 2px 8px; border-radius: 10px; font-size: 11px; }
        .badge-ok { background: var(--color-background-success); color: var(--color-text-success); padding: 2px 8px; border-radius: 10px; font-size: 11px; }
        .badge-risk { background: var(--color-background-danger); color: var(--color-text-danger); padding: 2px 8px; border-radius: 10px; font-size: 11px; }

        @media (max-width: 500px) {
          .qf-stats-row { grid-template-columns: 1fr; }
          .qf-balance-amount { font-size: 28px; }
          .qf-tab span { display: none; }
        }

        /* PREMIUM PHYSICAL BANK CARDS STYLE */
        .qf-bank-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(290px, 1fr));
          gap: 1.25rem;
          margin-top: 0.5rem;
        }

        /* PREMIUM BANK CARD STACKS */
        .qf-bank-card-stack-wrapper {
          position: relative;
          cursor: pointer;
          min-height: 185px;
          margin-top: 16px;
        }
        
        .qf-bank-card-stack-underlay1 {
          position: absolute;
          inset: 0;
          border-radius: var(--border-radius-lg);
          z-index: 1;
          transform: translateY(-8px) scale(0.96) rotate(-1.5deg);
          opacity: 0.8;
          filter: brightness(0.85);
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        
        .qf-bank-card-stack-underlay2 {
          position: absolute;
          inset: 0;
          border-radius: var(--border-radius-lg);
          z-index: 0;
          transform: translateY(-16px) scale(0.92) rotate(1.5deg);
          opacity: 0.5;
          filter: brightness(0.7);
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .qf-bank-card-stack-wrapper:hover .qf-bank-card-stack-underlay1 {
          transform: translateY(-12px) scale(0.97) rotate(-3deg);
          opacity: 0.9;
        }
        
        .qf-bank-card-stack-wrapper:hover .qf-bank-card-stack-underlay2 {
          transform: translateY(-22px) scale(0.94) rotate(3deg);
          opacity: 0.65;
        }
        
        .qf-bank-card-front {
          position: relative;
          z-index: 2;
          height: 100%;
        }

        .qf-bank-group-expanded-container {
          grid-column: 1 / -1;
          background: rgba(245, 196, 0, 0.03);
          border: 1.5px dashed rgba(245, 196, 0, 0.35);
          border-radius: var(--border-radius-lg);
          padding: 1.25rem;
          margin-top: 0.5rem;
          margin-bottom: 1.5rem;
          box-shadow: inset 0 2px 8px rgba(0,0,0,0.02);
          transition: all 0.3s ease;
        }

        .qf-bank-card {
          position: relative;
          border-radius: var(--border-radius-lg);
          padding: 1.5rem;
          min-height: 185px;
          color: #ffffff;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          cursor: pointer;
          user-select: none;
        }

        .qf-bank-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 15px 30px rgba(0, 0, 0, 0.25) !important;
        }

        .qf-bank-card-glass {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0) 100%);
          pointer-events: none;
          z-index: 1;
        }

        .qf-bank-card-shine {
          position: absolute;
          top: -50%;
          left: -50%;
          right: -50%;
          bottom: -50%;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0) 70%);
          transform: rotate(30deg);
          pointer-events: none;
          z-index: 1;
          transition: transform 0.5s ease;
        }

        .qf-bank-card:hover .qf-bank-card-shine {
          transform: rotate(35deg) translate(5%, 5%);
        }

        .qf-bank-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          z-index: 2;
        }

        .qf-bank-card-logo {
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .qf-bank-card-type {
          font-size: 10px;
          opacity: 0.75;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .qf-bank-card-wireless {
          font-size: 16px;
          opacity: 0.8;
        }

        .qf-bank-card-chip-container {
          margin: 10px 0;
          z-index: 2;
        }

        .qf-bank-card-chip {
          width: 32px;
          height: 24px;
          background: linear-gradient(135deg, #f3d060 0%, #d4af37 100%);
          border-radius: 4px;
          position: relative;
          box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.5), 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .qf-bank-card-chip::before {
          content: '';
          position: absolute;
          inset: 3px;
          border: 1px solid rgba(0, 0, 0, 0.15);
          border-radius: 2px;
        }

        .qf-bank-card-number {
          font-family: 'Courier New', Courier, monospace;
          font-size: 15px;
          letter-spacing: 0.15em;
          word-spacing: 0.1em;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
          z-index: 2;
          margin-bottom: 8px;
        }

        .qf-bank-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          z-index: 2;
        }

        .qf-bank-card-holder-label, .qf-bank-card-balance-label {
          font-size: 9px;
          opacity: 0.75;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .qf-bank-card-holder-value {
          font-size: 12px;
          font-weight: 500;
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);
        }

        .qf-bank-card-balance-value {
          font-size: 18px;
          font-weight: 700;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }

        .qf-bank-card-action {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 28px;
          height: 28px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          opacity: 0;
          transform: scale(0.8);
          transition: all 0.2s ease;
          z-index: 3;
          border: 1px solid rgba(255, 255, 255, 0.25);
          text-decoration: none;
        }

        .qf-bank-card:hover .qf-bank-card-action {
          opacity: 1;
          transform: scale(1);
        }

        .qf-bank-card-action:hover {
          background: rgba(255, 255, 255, 0.35);
          color: #fff;
        }
      `}} />

            <Script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" onLoad={initCharts} />
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.36.0/tabler-icons.min.css" />

            <div className="qf-wrap">
                <Link
                    href="/apps/mi-hogar/savings"
                    className="qf-btn"
                    style={{ display: 'inline-flex', marginBottom: '1.5rem', fontSize: '12px', background: 'var(--qf-bg)', borderColor: 'var(--qf)', color: 'var(--qf-darker)' }}>
                    &larr; Volver a la versión actual
                </Link>
                <h2 className="sr-only">Dashboard Mi Economía — Quioba Finanzas</h2>

                {/* MONTH SELECTOR HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eaf5ec', borderRadius: '1.5rem', padding: '10px 16px', marginBottom: '1.5rem', border: '1.5px solid rgba(26, 92, 46, 0.25)' }}>
                    <button className="qf-btn" style={{ padding: '6px 12px' }} onClick={() => {
                        const prev = new Date(selectedMonth);
                        prev.setMonth(prev.getMonth() - 1);
                        setSelectedMonth(prev);
                        fetchData(user?.id, prev);
                    }}>
                        <i className="ti ti-chevron-left" style={{ fontSize: '16px' }} aria-hidden="true"></i>
                    </button>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', textTransform: 'capitalize', color: '#1a5c2e' }}>
                        {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                    </h3>
                    <button className="qf-btn" style={{ padding: '6px 12px' }} onClick={() => {
                        const next = new Date(selectedMonth);
                        next.setMonth(next.getMonth() + 1);
                        setSelectedMonth(next);
                        fetchData(user?.id, next);
                    }}>
                        <i className="ti ti-chevron-right" style={{ fontSize: '16px' }} aria-hidden="true"></i>
                    </button>
                </div>

                {/* HEADER */}
                <div className="qf-header">
                    <div className="qf-header-top">
                        <div>
                            <div className="qf-balance-label">Saldo total</div>
                            <div className="qf-balance-amount" style={{ color: '#2563eb' }}>
                                {selectedMonthBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                            <div className="qf-balance-sub">
                                <i className="ti ti-calendar" aria-hidden="true"></i> Saldo proyectado a fin del mes
                            </div>
                        </div>
                        <div className="qf-badge"><i className="ti ti-sparkles" aria-hidden="true"></i> IA activa</div>
                    </div>
                    <div className="qf-stats-row">
                        <div className="qf-stat">
                            <div className="qf-stat-label">Ingresos mes</div>
                            <div className="qf-stat-val" style={{ color: '#16a34a', fontWeight: '600' }}>
                                +{monthlyStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </div>
                        </div>
                        <div className="qf-stat">
                            <div className="qf-stat-label">Gastos mes</div>
                            <div className="qf-stat-val" style={{ color: '#dc2626', fontWeight: '600' }}>
                                -{monthlyStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </div>
                        </div>
                        <div className="qf-stat">
                            <div className="qf-stat-label">Ahorro neto</div>
                            <div className="qf-stat-val" style={{ color: '#2563eb', fontWeight: '600' }}>
                                {((monthlyStats.income - monthlyStats.expense) >= 0 ? '+' : '')}
                                {(monthlyStats.income - monthlyStats.expense).toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* QUICK ACTIONS */}
                <div className="qf-actions">
                    <Link href="/apps/mi-hogar/savings" className="qf-btn primary">
                        <i className="ti ti-plus" aria-hidden="true"></i> Nuevo Movimiento
                    </Link>
                    <Link href="/apps/mi-hogar/savings" className="qf-btn">
                        <i className="ti ti-arrows-right-left" aria-hidden="true"></i> Transferir
                    </Link>
                    <button className="qf-btn" onClick={() => toast.info("Por favor, abre la versión actual (V1) para importar extractos bancarios.")}>
                        <i className="ti ti-upload" aria-hidden="true"></i> Importar extracto
                    </button>
                    <button className="qf-btn" onClick={async () => {
                        toast.loading('Sincronizando saldos...', { id: 'sync' });
                        await fetchData(user?.id);
                        toast.success('Saldos sincronizados correctamente', { id: 'sync' });
                    }}>
                        <i className="ti ti-refresh" aria-hidden="true"></i> Sincronizar
                    </button>
                </div>

                {/* TABS */}
                <div className="qf-tabs">
                    <button className={`qf-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}><i className="ti ti-chart-line" aria-hidden="true"></i> <span>Resumen</span></button>
                    <button className={`qf-tab ${activeTab === 'accounts' ? 'active' : ''}`} onClick={() => setActiveTab('accounts')}><i className="ti ti-credit-card" aria-hidden="true"></i> <span>Cuentas</span></button>
                    <button className={`qf-tab ${activeTab === 'goals' ? 'active' : ''}`} onClick={() => setActiveTab('goals')}><i className="ti ti-target" aria-hidden="true"></i> <span>Metas</span></button>
                    <button className={`qf-tab ${activeTab === 'recurring' ? 'active' : ''}`} onClick={() => setActiveTab('recurring')}><i className="ti ti-repeat" aria-hidden="true"></i> <span>Fijos</span></button>
                    <button className={`qf-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}><i className="ti ti-receipt" aria-hidden="true"></i> <span>Pendiente</span></button>
                </div>

                {/* OVERVIEW */}
                <div className={`qf-section ${activeTab === 'overview' ? 'active' : ''}`}>
                    <div className="qf-insight">
                        <i className="ti ti-bulb" aria-hidden="true"></i>
                        <div>
                            <div className="qf-insight-metric">
                                {aiLoading ? 'Analizando...' : `${monthlyStats.savingsRate.toFixed(1)}% tasa de ahorro`}
                            </div>
                            <div className="qf-insight-text">
                                {aiLoading ? (
                                    'Quioba IA está calculando los indicadores de tu mes basándose en tus movimientos reales...'
                                ) : aiInsight?.insight ? (
                                    aiInsight.insight
                                ) : (
                                    `Tu tasa de ahorro de este mes es del ${monthlyStats.savingsRate.toFixed(1)}%. Tienes un balance de ingresos de ${monthlyStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} frente a unos gastos de ${monthlyStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="qf-grid2">
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-chart-area-line" aria-hidden="true"></i> Evolución del saldo</div>
                            <div className="qf-timeframe">
                                <button className={`qf-tf ${activeTimeframe === '1M' ? 'active' : ''}`} onClick={() => updateChart('1M')}>1M</button>
                                <button className={`qf-tf ${activeTimeframe === '3M' ? 'active' : ''}`} onClick={() => updateChart('3M')}>3M</button>
                                <button className={`qf-tf ${activeTimeframe === '6M' ? 'active' : ''}`} onClick={() => updateChart('6M')}>6M</button>
                                <button className={`qf-tf ${activeTimeframe === '1A' ? 'active' : ''}`} onClick={() => updateChart('1A')}>1A</button>
                            </div>
                            <div className="qf-chart-wrap">
                                <canvas id="balanceChart" role="img" aria-label="Evolución del saldo bancario en el tiempo">Evolución del saldo.</canvas>
                            </div>
                        </div>
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-chart-donut" aria-hidden="true"></i> Distribución de gastos</div>
                            <div className="qf-legend" id="pie-legend"></div>
                            <div className="qf-chart-wrap">
                                <canvas id="pieChart" role="img" aria-label="Distribución de gastos por categoría">Gastos por categoría.</canvas>
                            </div>
                        </div>
                    </div>

                    <div className="qf-card" style={{ marginBottom: '1.25rem' }}>
                        <div className="qf-card-title"><i className="ti ti-chart-bar" aria-hidden="true"></i> Ingresos vs Gastos — últimos 6 meses</div>
                        <div className="qf-legend">
                            <span><span className="qf-leg-sq" style={{ background: '#10b981' }}></span>Ingresos</span>
                            <span><span className="qf-leg-sq" style={{ background: '#ef4444' }}></span>Gastos</span>
                        </div>
                        <div className="qf-chart-wrap">
                            <canvas id="barChart" role="img" aria-label="Ingresos vs gastos últimos 6 meses">Comparativa ingresos vs gastos.</canvas>
                        </div>
                    </div>

                    <div className="qf-card">
                        <div className="qf-card-title" style={{ justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><i className="ti ti-list" aria-hidden="true"></i> Últimas transacciones</span>
                            <button className="qf-btn" style={{ padding: '4px 10px', fontSize: '12px' }} onClick={() => setActiveTab('accounts')}>Ver cuentas <i className="ti ti-arrow-right" aria-hidden="true"></i></button>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="qf-table">
                                <thead><tr><th>Concepto</th><th>Cuenta</th><th>Fecha</th><th style={{ textAlign: 'right' }}>Importe</th></tr></thead>
                                <tbody>
                                    {recentTransactions.slice(0, 6).map(tx => {
                                        const acc = accounts.find(a => a.id === tx.account_id);
                                        const style = getBankStyle(acc?.bank_name);
                                        return (
                                            <tr key={tx.id}>
                                                <td style={{ fontWeight: '500' }}>{tx.description || 'Gasto General'}</td>
                                                <td>
                                                    <span style={style}>
                                                        {acc?.name || 'Tarjeta'}
                                                    </span>
                                                </td>
                                                <td>{format(new Date(tx.date), 'dd MMM', { locale: es })}</td>
                                                <td className={tx.amount >= 0 ? 'amount-pos' : 'amount-neg'} style={{ textAlign: 'right' }}>
                                                    {tx.amount > 0 ? '+' : ''}
                                                    {tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {recentTransactions.length === 0 && (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '20px' }}>
                                                Sin transacciones registradas en este periodo
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* ACCOUNTS */}
                <div className={`qf-section ${activeTab === 'accounts' ? 'active' : ''}`}>
                    <div className="qf-grid2" style={{ marginBottom: '1.25rem' }}>
                        <div className="qf-card qf-highlight">
                            <div className="qf-card-title"><i className="ti ti-wallet" aria-hidden="true"></i> Saldo total real</div>
                            <div style={{ fontSize: '28px', fontWeight: 500, color: '#7A6200' }}>
                                {accounts.reduce((s, a) => s + (a.include_in_total !== false ? a.current_balance : 0), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                            <div style={{ fontSize: '12px', color: '#B8940A', marginTop: '4px' }}>{accounts.length} cuentas y tarjetas registradas</div>
                        </div>
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-chart-donut" aria-hidden="true"></i> Distribución por cuenta</div>
                            <div className="qf-chart-wrap2">
                                <canvas id="accPieChart" role="img" aria-label="Distribución del saldo por cuenta">Saldo por cuenta.</canvas>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '15px', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                            <i className="ti ti-credit-card" style={{ color: '#F5C400' }} aria-hidden="true"></i> Cuentas y tarjetas
                        </span>
                        <Link href="/apps/mi-hogar/savings" className="qf-btn primary" style={{ padding: '5px 12px' }}>
                            <i className="ti ti-plus" aria-hidden="true"></i> Añadir cuenta
                        </Link>
                    </div>

                    <div className="qf-bank-cards-grid" style={{ marginBottom: '1.5rem' }}>
                        {(() => {
                            const grouped = accounts.reduce((groups: Record<string, BankAccount[]>, acc) => {
                                const bankKey = acc.bank_name || 'Otro';
                                if (!groups[bankKey]) groups[bankKey] = [];
                                groups[bankKey].push(acc);
                                return groups;
                            }, {});

                            return Object.keys(grouped).map(bankName => {
                                const bankAccounts = grouped[bankName];
                                const isExpanded = expandedBanks.includes(bankName);

                                if (bankAccounts.length === 1) {
                                    const acc = bankAccounts[0];
                                    const last4 = acc.id ? acc.id.slice(-4).toUpperCase() : '0000';
                                    const cardBg = `linear-gradient(135deg, ${acc.color || '#2563eb'} 0%, ${acc.color ? acc.color + 'bb' : '#1d4ed8'} 100%)`;
                                    
                                    return (
                                        <div key={acc.id} className="qf-bank-card" style={{
                                            background: cardBg,
                                            boxShadow: `0 8px 16px -4px ${acc.color || '#2563eb'}40`
                                        }} onClick={() => handleOpenAccountDetail(acc)}>
                                            <div className="qf-bank-card-glass"></div>
                                            <div className="qf-bank-card-shine"></div>
                                            
                                            <div className="qf-bank-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {acc.logo_url ? (
                                                            <div style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '22px', width: '22px', overflow: 'hidden' }}>
                                                                <img src={acc.logo_url} alt={acc.bank_name} style={{ maxHeight: '16px', maxWidth: '16px', objectFit: 'contain' }} />
                                                            </div>
                                                        ) : (
                                                            <i className="ti ti-building-bank" style={{ fontSize: '18px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}></i>
                                                        )}
                                                        <span style={{ fontWeight: '700', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.3)', color: '#ffffff', letterSpacing: '0.5px' }}>
                                                            {acc.bank_name}
                                                        </span>
                                                    </div>
                                                    <div className="qf-bank-card-type" style={{ fontSize: '11px', opacity: 0.85 }}>
                                                        {acc.interest_rate ? `${acc.interest_rate}% TAE` : 'Ahorro / Corriente'}
                                                    </div>
                                                </div>
                                                <div className="qf-bank-card-wireless" style={{ opacity: 0.8 }}>
                                                    <i className="ti ti-wifi" style={{ fontSize: '18px' }}></i>
                                                </div>
                                            </div>
                                            
                                            <div className="qf-bank-card-chip-container">
                                                <div className="qf-bank-card-chip"></div>
                                            </div>
                                            
                                            <div className="qf-bank-card-number">
                                                •••• •••• •••• {last4}
                                            </div>
                                            
                                            <div className="qf-bank-card-footer">
                                                <div>
                                                    <div className="qf-bank-card-holder-label">Cuenta</div>
                                                    <div className="qf-bank-card-holder-value">{acc.name}</div>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div className="qf-bank-card-balance-label">Saldo disponible</div>
                                                    <div className="qf-bank-card-balance-value">
                                                        {acc.current_balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <button className="qf-bank-card-action" onClick={(e) => { e.stopPropagation(); handleOpenAccountDetail(acc); }}>
                                                <i className="ti ti-eye"></i>
                                            </button>
                                        </div>
                                    );
                                }

                                const firstAcc = bankAccounts[0];
                                const aggregatedBalance = bankAccounts.reduce((sum, a) => sum + a.current_balance, 0);
                                const cardBg = `linear-gradient(135deg, ${firstAcc.color || '#2563eb'} 0%, ${firstAcc.color ? firstAcc.color + 'bb' : '#1d4ed8'} 100%)`;
                                
                                return (
                                    <React.Fragment key={`group-${bankName}`}>
                                        <div className="qf-bank-card-stack-wrapper" onClick={() => {
                                            setExpandedBanks(prev => prev.includes(bankName) ? prev.filter(b => b !== bankName) : [...prev, bankName]);
                                        }}>
                                            <div className="qf-bank-card-stack-underlay2" style={{ background: cardBg }} />
                                            <div className="qf-bank-card-stack-underlay1" style={{ background: cardBg }} />
                                            
                                            <div className="qf-bank-card qf-bank-card-front" style={{
                                                background: cardBg,
                                                boxShadow: `0 8px 16px -4px ${firstAcc.color || '#2563eb'}40`
                                            }}>
                                                <div className="qf-bank-card-glass"></div>
                                                <div className="qf-bank-card-shine"></div>
                                                
                                                <div className="qf-bank-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            {firstAcc.logo_url ? (
                                                                <div style={{ background: '#ffffff', padding: '2px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '22px', width: '22px', overflow: 'hidden' }}>
                                                                    <img src={firstAcc.logo_url} alt={bankName} style={{ maxHeight: '16px', maxWidth: '16px', objectFit: 'contain' }} />
                                                                </div>
                                                            ) : (
                                                                <i className="ti ti-building-bank" style={{ fontSize: '18px', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}></i>
                                                            )}
                                                            <span style={{ fontWeight: '700', fontSize: '14px', textShadow: '0 1px 3px rgba(0,0,0,0.3)', color: '#ffffff', letterSpacing: '0.5px' }}>
                                                                {bankName}
                                                            </span>
                                                        </div>
                                                        <div className="qf-bank-card-type" style={{ fontSize: '11px', opacity: 0.85 }}>
                                                            Grupo de {bankAccounts.length} cuentas
                                                        </div>
                                                    </div>
                                                    <div className="qf-bank-card-wireless" style={{ opacity: 0.8 }}>
                                                        <i className="ti ti-layers" style={{ fontSize: '18px' }}></i>
                                                    </div>
                                                </div>
                                                
                                                <div className="qf-bank-card-chip-container">
                                                    <div className="qf-bank-card-chip"></div>
                                                </div>
                                                
                                                <div className="qf-bank-card-number" style={{ letterSpacing: '2px', fontSize: '12px' }}>
                                                    •••• •••• •••• MULTIPLE
                                                </div>
                                                
                                                <div className="qf-bank-card-footer">
                                                    <div>
                                                        <div className="qf-bank-card-holder-label">Grupo Bancario</div>
                                                        <div className="qf-bank-card-holder-value">{bankName}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div className="qf-bank-card-balance-label">Saldo combinado</div>
                                                        <div className="qf-bank-card-balance-value">
                                                            {aggregatedBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <button className="qf-bank-card-action" style={{ opacity: 1, transform: 'scale(1)', background: 'rgba(255,255,255,0.25)', color: '#ffffff' }}>
                                                    <i className={isExpanded ? 'ti ti-chevron-up' : 'ti ti-chevron-down'}></i>
                                                </button>
                                            </div>
                                        </div>

                                        {isExpanded && (
                                            <div className="qf-bank-group-expanded-container">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid rgba(245,196,0,0.15)', paddingBottom: '0.5rem' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--color-text-primary)' }}>
                                                            Tarjetas y cuentas de <span style={{ color: '#F5C400' }}>{bankName}</span>
                                                        </span>
                                                        <span className="qf-badge" style={{ background: 'rgba(245, 196, 0, 0.12)', color: '#7A6200', fontSize: '11px', border: '0.5px solid rgba(245,196,0,0.2)' }}>
                                                            {bankAccounts.length} cuentas
                                                        </span>
                                                    </div>
                                                    <button className="qf-btn" style={{ padding: '3px 10px', fontSize: '11px', color: '#dc2626', borderColor: '#dc262620' }} onClick={(e) => {
                                                        e.stopPropagation();
                                                        setExpandedBanks(prev => prev.filter(b => b !== bankName));
                                                    }}>
                                                        <i className="ti ti-chevron-up"></i> Contraer
                                                    </button>
                                                </div>
                                                <div className="qf-bank-cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: 0 }}>
                                                    {bankAccounts.map(acc => {
                                                        const last4 = acc.id ? acc.id.slice(-4).toUpperCase() : '0000';
                                                        const innerCardBg = `linear-gradient(135deg, ${acc.color || '#2563eb'} 0%, ${acc.color ? acc.color + 'bb' : '#1d4ed8'} 100%)`;
                                                        
                                                        return (
                                                            <div key={acc.id} className="qf-bank-card" style={{
                                                                background: innerCardBg,
                                                                boxShadow: `0 4px 10px -2px ${acc.color || '#2563eb'}30`,
                                                                minHeight: '175px'
                                                            }} onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleOpenAccountDetail(acc);
                                                            }}>
                                                                <div className="qf-bank-card-glass"></div>
                                                                <div className="qf-bank-card-shine"></div>
                                                                
                                                                <div className="qf-bank-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                            {acc.logo_url ? (
                                                                                <div style={{ background: '#ffffff', padding: '2px 4px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '18px', width: '18px', overflow: 'hidden' }}>
                                                                                    <img src={acc.logo_url} alt={acc.bank_name} style={{ maxHeight: '12px', maxWidth: '12px', objectFit: 'contain' }} />
                                                                                </div>
                                                                            ) : (
                                                                                <i className="ti ti-building-bank" style={{ fontSize: '15px' }}></i>
                                                                            )}
                                                                            <span style={{ fontWeight: '700', fontSize: '12px', textShadow: '0 1px 2px rgba(0,0,0,0.3)', color: '#ffffff' }}>
                                                                                {acc.bank_name}
                                                                            </span>
                                                                        </div>
                                                                        <div className="qf-bank-card-type" style={{ fontSize: '10px', opacity: 0.85 }}>
                                                                            {acc.interest_rate ? `${acc.interest_rate}% TAE` : 'Ahorro / Corriente'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="qf-bank-card-wireless" style={{ opacity: 0.8 }}>
                                                                        <i className="ti ti-wifi" style={{ fontSize: '15px' }}></i>
                                                                    </div>
                                                                </div>
                                                                
                                                                <div className="qf-bank-card-chip-container" style={{ margin: '8px 0' }}>
                                                                    <div className="qf-bank-card-chip" style={{ width: '28px', height: '20px' }}></div>
                                                                </div>
                                                                
                                                                <div className="qf-bank-card-number" style={{ fontSize: '13px', margin: '4px 0 8px 0' }}>
                                                                    •••• •••• •••• {last4}
                                                                </div>
                                                                
                                                                <div className="qf-bank-card-footer">
                                                                    <div>
                                                                        <div className="qf-bank-card-holder-label" style={{ fontSize: '9px' }}>Cuenta</div>
                                                                        <div className="qf-bank-card-holder-value" style={{ fontSize: '11px' }}>{acc.name}</div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <div className="qf-bank-card-balance-label" style={{ fontSize: '9px' }}>Saldo disponible</div>
                                                                        <div className="qf-bank-card-balance-value" style={{ fontSize: '13px' }}>
                                                                            {acc.current_balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                
                                                                <button className="qf-bank-card-action" style={{ height: '30px', width: '30px' }} onClick={(e) => { e.stopPropagation(); handleOpenAccountDetail(acc); }}>
                                                                    <i className="ti ti-eye" style={{ fontSize: '12px' }}></i>
                                                                </button>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            });
                        })()}
                    </div>

                    <div className="qf-card">
                        <div className="qf-card-title"><i className="ti ti-table" aria-hidden="true"></i> Desglose mensual por cuenta — {format(selectedMonth, 'MMMM yyyy', { locale: es })}</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="qf-table">
                                <thead><tr><th>Cuenta</th><th>Banco</th><th>Ingresos</th><th>Gastos</th><th>Resultado</th><th>Saldo actual</th></tr></thead>
                                <tbody>
                                    {accounts.map(acc => {
                                        const stats = accountStats[acc.id] || { income: 0, expense: 0 };
                                        const net = stats.income - stats.expense;
                                        return (
                                            <tr key={acc.id}>
                                                <td style={{ fontWeight: '500' }}>{acc.name}</td>
                                                <td>{acc.bank_name}</td>
                                                <td className="amount-pos">{stats.income > 0 ? `+${stats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : '—'}</td>
                                                <td className="amount-neg">{stats.expense > 0 ? `-${stats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : '—'}</td>
                                                <td className={net >= 0 ? 'amount-pos' : 'amount-neg'}>
                                                    {net !== 0 ? `${net > 0 ? '+' : ''}${net.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}` : '—'}
                                                </td>
                                                <td style={{ fontWeight: '500' }}>{acc.current_balance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                            </tr>
                                        );
                                    })}
                                    <tr style={{ fontWeight: '700', borderTop: '2px solid var(--color-border-secondary)' }}>
                                        <td>Total</td>
                                        <td>—</td>
                                        <td className="amount-pos">+{monthlyStats.income.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                        <td className="amount-neg">-{monthlyStats.expense.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                        <td className={(monthlyStats.income - monthlyStats.expense) >= 0 ? 'amount-pos' : 'amount-neg'}>
                                            {((monthlyStats.income - monthlyStats.expense) > 0 ? '+' : '')}
                                            {(monthlyStats.income - monthlyStats.expense).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                        </td>
                                        <td>{selectedMonthBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* GOALS */}
                <div className={`qf-section ${activeTab === 'goals' ? 'active' : ''}`}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                        <div>
                            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Total en metas</div>
                            <div style={{ fontSize: '24px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                                {goals.reduce((s, g) => s + (g.current_amount || 0), 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                        </div>
                        <Link href="/apps/mi-hogar/savings" className="qf-btn primary">
                            <i className="ti ti-plus" aria-hidden="true"></i> Nueva meta
                        </Link>
                    </div>

                    <div className="qf-grid2" style={{ marginBottom: '1.25rem' }}>
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-chart-bar" aria-hidden="true"></i> Progreso de metas</div>
                            <div className="qf-chart-wrap2">
                                <canvas id="goalsBar" role="img" aria-label="Progreso de metas de ahorro">Progreso de metas.</canvas>
                            </div>
                        </div>
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-target" aria-hidden="true"></i> Detalle</div>
                            {goals.map(g => {
                                const pct = Math.round((g.current_amount / g.target_amount) * 100) || 0;
                                return (
                                    <div className="qf-goal-row" key={g.id}>
                                        <div className="qf-goal-top">
                                            <span className="qf-goal-name">{g.icon || '🎯'} {g.name}</span>
                                            <span className="qf-goal-pct">{pct}%</span>
                                        </div>
                                        <div className="qf-progress">
                                            <div className="qf-progress-fill" style={{ width: `${Math.min(100, pct)}%`, background: g.color || '#F5C400' }}></div>
                                        </div>
                                        <div className="qf-goal-amounts">
                                            <span>{g.current_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                            <span>{g.target_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}</span>
                                        </div>
                                    </div>
                                );
                            })}
                            {goals.length === 0 && (
                                <div style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: '20px 0', fontSize: '13px' }}>
                                    No tienes metas creadas todavía
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="qf-card">
                        <div className="qf-card-title"><i className="ti ti-table" aria-hidden="true"></i> Tabla resumen de metas</div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="qf-table">
                                <thead><tr><th>Meta</th><th>Ahorrado</th><th>Objetivo</th><th>Progreso</th><th>Fecha límite</th><th>Estado</th></tr></thead>
                                <tbody>
                                    {goals.map(g => {
                                        const pct = Math.round((g.current_amount / g.target_amount) * 100) || 0;
                                        const isCompleted = pct >= 100;
                                        const isAtRisk = !isCompleted && g.deadline && new Date(g.deadline) < new Date();
                                        return (
                                            <tr key={g.id}>
                                                <td style={{ fontWeight: '500' }}>{g.name}</td>
                                                <td>{g.current_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                                <td>{g.target_amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                                <td>{pct}%</td>
                                                <td>{g.deadline ? format(new Date(g.deadline), 'MMM yyyy', { locale: es }) : '—'}</td>
                                                <td>
                                                    {isCompleted ? (
                                                        <span className="badge-ok">Completada</span>
                                                    ) : isAtRisk ? (
                                                        <span className="badge-risk">En riesgo</span>
                                                    ) : (
                                                        <span className="badge-warn">En curso</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {goals.length === 0 && (
                                        <tr>
                                            <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '20px 0' }}>
                                                Sin metas de ahorro configuradas
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* RECURRING */}
                <div className={`qf-section ${activeTab === 'recurring' ? 'active' : ''}`}>
                    <div className="qf-grid2" style={{ marginBottom: '1.25rem' }}>
                        <div className="qf-card qf-highlight">
                            <div className="qf-card-title"><i className="ti ti-calendar-stats" aria-hidden="true"></i> Flujo mensual estimado</div>
                            <div style={{ fontSize: '28px', fontWeight: 500, color: '#7A6200' }}>
                                {(() => {
                                    const inc = recurringItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
                                    const exp = recurringItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);
                                    const flow = inc - exp;
                                    return `${flow >= 0 ? '+' : ''}${flow.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`;
                                })()}
                            </div>
                            <div style={{ fontSize: '12px', color: '#B8940A', marginTop: '4px' }}>Lo que te queda tras gastos fijos programados</div>
                        </div>
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-chart-bar" aria-hidden="true"></i> Ingresos vs gastos fijos</div>
                            <div className="qf-chart-wrap2">
                                <canvas id="recurChart" role="img" aria-label="Ingresos fijos vs gastos fijos">Ingresos vs gastos fijos.</canvas>
                            </div>
                        </div>
                    </div>

                    <div className="qf-grid2">
                        <div className="qf-card">
                            <div className="qf-card-title" style={{ color: '#3B6D11' }}><i className="ti ti-arrow-up-right" aria-hidden="true"></i> Ingresos recurrentes</div>
                            {recurringItems.filter(i => i.type === 'income').map(item => (
                                <div className="qf-rec-row" key={item.id}>
                                    <div className="qf-rec-info">
                                        <div className="qf-rec-day" style={{ background: '#EAF3DE', color: '#3B6D11' }}>{item.day_of_month || 1}</div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Día {item.day_of_month || 1} · mensual</div>
                                        </div>
                                    </div>
                                    <div className="amount-pos">+{item.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                                </div>
                            ))}
                            {recurringItems.filter(i => i.type === 'income').length === 0 && (
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', textAlign: 'center', padding: '15px' }}>
                                    No tienes ingresos fijos programados
                                </div>
                            )}
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Total ingresos fijos</span>
                                <span className="amount-pos" style={{ fontSize: '15px' }}>
                                    +{recurringItems.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>
                        </div>
                        <div className="qf-card">
                            <div className="qf-card-title" style={{ color: '#A32D2D' }}><i className="ti ti-arrow-down-right" aria-hidden="true"></i> Gastos recurrentes</div>
                            {recurringItems.filter(i => i.type === 'expense').map(item => (
                                <div className="qf-rec-row" key={item.id}>
                                    <div className="qf-rec-info">
                                        <div className="qf-rec-day" style={{ background: '#FCEBEB', color: '#A32D2D' }}>{item.day_of_month || 1}</div>
                                        <div>
                                            <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Día {item.day_of_month || 1} · mensual</div>
                                        </div>
                                    </div>
                                    <div className="amount-neg">-{item.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</div>
                                </div>
                            ))}
                            {recurringItems.filter(i => i.type === 'expense').length === 0 && (
                                <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px', textAlign: 'center', padding: '15px' }}>
                                    No tienes gastos fijos programados
                                </div>
                            )}
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid var(--color-border-tertiary)', display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                <span style={{ color: 'var(--color-text-secondary)' }}>Total gastos fijos</span>
                                <span className="amount-neg" style={{ fontSize: '15px' }}>
                                    -{recurringItems.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PENDING */}
                <div className={`qf-section ${activeTab === 'pending' ? 'active' : ''}`}>
                    <div className="qf-grid2" style={{ marginBottom: '1.25rem' }}>
                        <div className="qf-card qf-highlight">
                            <div className="qf-card-title"><i className="ti ti-clock" aria-hidden="true"></i> Pendiente de reposición</div>
                            <div style={{ fontSize: '28px', fontWeight: 500, color: '#7A6200' }}>
                                {pendingTotal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                            </div>
                            <div style={{ fontSize: '12px', color: '#B8940A', marginTop: '4px' }}>
                                {pendingExpenses.length} gastos pendientes de liquidar
                            </div>
                        </div>
                        <div className="qf-card">
                            <div className="qf-card-title"><i className="ti ti-camera" aria-hidden="true"></i> Escanear ticket con IA</div>
                            <div style={{ border: '1.5px dashed #F5C40070', borderRadius: 'var(--border-radius-md)', padding: '1.5rem', textAlign: 'center', cursor: 'pointer' }} onClick={() => toast.info('Abre la aplicación actual (V1) para escanear tickets reales utilizando nuestro motor OCR con IA.')}>
                                <i className="ti ti-camera" style={{ fontSize: '28px', color: '#F5C400', display: 'block', marginBottom: '8px' }} aria-hidden="true"></i>
                                <div style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>Toca para escanear un recibo</div>
                                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Auto-rellena importe y comercio ↗</div>
                            </div>
                        </div>
                    </div>

                    <div className="qf-card">
                        <div className="qf-card-title" style={{ justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><i className="ti ti-receipt" aria-hidden="true"></i> Gastos pendientes de reposición</span>
                            <Link href="/apps/mi-hogar/savings" className="qf-btn primary" style={{ padding: '5px 12px' }}>
                                <i className="ti ti-plus" aria-hidden="true"></i> Añadir gasto
                            </Link>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="qf-table">
                                <thead><tr><th>Concepto</th><th>Comercio</th><th>Fecha</th><th>Importe</th><th>Estado</th></tr></thead>
                                <tbody>
                                    {pendingExpenses.map(e => (
                                        <tr key={e.id}>
                                            <td style={{ fontWeight: '500' }}>{e.description || e.name || 'Gasto sin concepto'}</td>
                                            <td>{e.merchant || 'General'}</td>
                                            <td>{e.date ? format(new Date(e.date), 'dd MMM', { locale: es }) : '—'}</td>
                                            <td className="amount-neg">-{e.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}</td>
                                            <td>
                                                <span className={e.repay_status === 'partial' ? 'badge-risk' : 'badge-warn'}>
                                                    {e.repay_status === 'partial' ? 'Parcial' : 'Pendiente'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {pendingExpenses.length === 0 && (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-secondary)', padding: '20px 0' }}>
                                                ¡No tienes gastos pendientes de reposición! 🎉
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {selectedAccount && (
                <AccountDetailDialog
                    open={isAccountDetailOpen}
                    onOpenChange={setIsAccountDetailOpen}
                    account={selectedAccount}
                    transactions={accountTransactions}
                    linkedPasswordName={selectedAccountPasswordName}
                    accounts={accounts}
                    onSubmitTransaction={handleSubmitAccountTransaction}
                    onDeleteTransaction={handleDeleteAccountTransaction}
                    onDeleteTransactions={handleDeleteAccountTransactions}
                    onDeleteAccount={handleDeleteAccount}
                    onSyncBalance={handleSyncAccountBalance}
                    onUpdateBalance={handleUpdateAccountBalance}
                    onUpdateAccount={handleUpdateAccount}
                    onToggleIncludeInTotal={handleToggleAccountInTotal}
                />
            )}
        </>
    );
}
