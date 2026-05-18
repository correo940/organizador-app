'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { X, TrendingDown, TrendingUp, Target, CheckCircle2, Trophy, BarChart3 } from 'lucide-react';
import { getSecretarySettings, getAvatarById, getUserFirstName } from '@/lib/secretary-settings';

// ─── Reunión de Vida Mensual — Fase 4.2 ───────────────────────────────────────

interface MonthData {
  label: string;          // "Abr 2026"
  income: number;
  expenses: number;
  savings: number;        // income - expenses
  taskRate: number;       // % completadas (de secretary_syncs)
  victories: string[];
}

export default function SecretariaVidaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [latestVictories, setLatestVictories] = useState<string[]>([]);
  const [totalBalance, setTotalBalance] = useState(0);
  const [savingsGoal, setSavingsGoal] = useState<number | null>(null);
  const [savingsAchieved, setSavingsAchieved] = useState<number | null>(null);

  const settings = getSecretarySettings();
  const profile = getAvatarById(settings.avatarId);
  const now = new Date();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);

      // Cargar saldo actual
      const { data: accs } = await supabase.from('savings_accounts').select('current_balance').eq('user_id', u.id);
      const balance = (accs || []).reduce((s, a) => s + Number(a.current_balance || 0), 0);
      setTotalBalance(balance);

      // ─── Último sync mensual (para objetivo de ahorro) ────────────────────
      const { data: lastMonthlySync } = await supabase
        .from('secretary_syncs')
        .select('planned_expenses, savings_achieved')
        .eq('user_id', u.id)
        .eq('sync_type', 'monthly')
        .order('sync_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMonthlySync) {
        setSavingsGoal(lastMonthlySync.planned_expenses ?? null);
        setSavingsAchieved(lastMonthlySync.savings_achieved ?? null);
      }

      // ─── Últimos 4 meses de datos ─────────────────────────────────────────
      const monthsData: MonthData[] = [];
      for (let i = 3; i >= 0; i--) {
        const targetMonth = subMonths(now, i);
        const monthStart = startOfMonth(targetMonth);
        const monthEnd = endOfMonth(targetMonth);
        const label = format(targetMonth, 'MMM yyyy', { locale: es });

        // Transacciones del mes
        const { data: txns } = await supabase
          .from('savings_transactions')
          .select('amount, transaction_type')
          .eq('user_id', u.id)
          .gte('transaction_date', monthStart.toISOString())
          .lte('transaction_date', monthEnd.toISOString());

        const income = (txns || []).filter((t: any) => t.amount > 0 && t.transaction_type !== 'expense').reduce((s: number, t: any) => s + Number(t.amount), 0);
        const expenses = (txns || []).filter((t: any) => t.amount < 0 || t.transaction_type === 'expense').reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);

        // Sync mensual del mes — para victories y completedTasksCount
        const { data: monthSync } = await supabase
          .from('secretary_syncs')
          .select('victories, completed_tasks_count')
          .eq('user_id', u.id)
          .eq('sync_type', 'monthly')
          .gte('sync_date', format(monthStart, 'yyyy-MM-dd'))
          .lte('sync_date', format(monthEnd, 'yyyy-MM-dd'))
          .maybeSingle();

        // Tareas completadas del mes desde tasks table
        const [completedQ, totalQ] = await Promise.all([
          supabase.from('tasks').select('*', { count: 'exact', head: true })
            .eq('user_id', u.id).eq('is_completed', true)
            .gte('updated_at', monthStart.toISOString())
            .lte('updated_at', monthEnd.toISOString()),
          supabase.from('tasks').select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .gte('created_at', monthStart.toISOString())
            .lte('created_at', monthEnd.toISOString()),
        ]);
        const taskRate = (totalQ.count ?? 0) > 0
          ? Math.round(((completedQ.count ?? 0) / (totalQ.count ?? 1)) * 100)
          : 0;

        const victories = monthSync?.victories ?? [];
        if (i === 0 && victories.length > 0) setLatestVictories(victories);

        monthsData.push({ label, income, expenses, savings: income - expenses, taskRate, victories });
      }

      setMonths(monthsData);
    } catch (e) {
      console.error('Error loading Vida data:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  // Calcular máximo gasto para escalar las barras
  const maxExpense = Math.max(...months.map(m => m.expenses), 1);
  const currentMonth = months[months.length - 1];
  const prevMonth = months[months.length - 2];
  const savingsTrend = currentMonth && prevMonth
    ? currentMonth.savings - prevMonth.savings
    : null;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col p-6">
      <div className="flex justify-between items-center mb-8">
        <button onClick={() => router.push('/apps/organizador')} className="text-white/40 hover:text-white/70">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <span className="text-white/60 text-sm font-medium">Reunión de Vida</span>
        </div>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6">

        {/* Avatar + Fecha */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl border border-white/10">
            {profile.emoji}
          </div>
          <div>
            <h1 className="text-xl font-bold">Visión estratégica</h1>
            <p className="text-white/40 text-sm capitalize">
              {format(now, "MMMM yyyy", { locale: es })}
            </p>
          </div>
        </div>

        {/* ── Saldo + Tendencia ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Saldo total</p>
            <p className={`text-2xl font-extrabold ${totalBalance < 0 ? 'text-red-300' : 'text-green-300'}`}>
              {totalBalance.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
            </p>
          </div>
          {savingsTrend !== null && (
            <div className={`p-4 rounded-2xl border ${savingsTrend >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
              <p className="text-white/40 text-xs uppercase tracking-wider mb-1">Tendencia ahorro</p>
              <div className="flex items-center gap-1.5">
                {savingsTrend >= 0
                  ? <TrendingUp className="w-4 h-4 text-green-400" />
                  : <TrendingDown className="w-4 h-4 text-red-400" />
                }
                <p className={`text-2xl font-extrabold ${savingsTrend >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                  {savingsTrend >= 0 ? '+' : ''}{savingsTrend.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Objetivo ahorro vs real ────────────────────────────────────────── */}
        {(savingsGoal !== null || savingsAchieved !== null) && (
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5" /> Objetivo de ahorro
            </p>
            {savingsGoal !== null && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-white/60">Meta</span>
                  <span className="font-semibold">{savingsGoal.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
                </div>
                {savingsAchieved !== null && (
                  <>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${savingsAchieved >= savingsGoal ? 'bg-green-400' : 'bg-indigo-400'}`}
                        style={{ width: `${Math.min((savingsAchieved / savingsGoal) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className={savingsAchieved >= savingsGoal ? 'text-green-300' : 'text-indigo-300'}>
                        Real: {savingsAchieved.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
                      </span>
                      <span className="text-white/30">
                        {Math.round((savingsAchieved / savingsGoal) * 100)}%
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Gráfico de gastos (últimos 4 meses) ───────────────────────────── */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
          <p className="text-white/40 text-xs uppercase tracking-wider">💳 Gastos mensuales</p>
          <div className="flex items-end gap-3 h-28">
            {months.map((m, i) => {
              const heightPct = maxExpense > 0 ? (m.expenses / maxExpense) * 100 : 0;
              const isLast = i === months.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                  <p className={`text-xs font-semibold ${isLast ? 'text-white' : 'text-white/30'}`}>
                    {m.expenses > 0 ? `${Math.round(m.expenses)}€` : '-'}
                  </p>
                  <div className="w-full flex items-end" style={{ height: '80px' }}>
                    <div
                      className={`w-full rounded-t-lg transition-all duration-700 ${isLast ? 'bg-indigo-400' : 'bg-white/20'
                        }`}
                      style={{ height: `${Math.max(heightPct, 4)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 capitalize text-center">{m.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Productividad de tareas ────────────────────────────────────────── */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Productividad mensual
          </p>
          <div className="space-y-2">
            {months.map((m, i) => (
              <div key={i} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-white/50 capitalize">{m.label}</span>
                  <span className={`font-semibold ${m.taskRate >= 70 ? 'text-green-300' : m.taskRate >= 40 ? 'text-amber-300' : 'text-red-300'}`}>
                    {m.taskRate}%
                  </span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${m.taskRate >= 70 ? 'bg-green-400' : m.taskRate >= 40 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                    style={{ width: `${m.taskRate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Victorias del mes actual ───────────────────────────────────────── */}
        {latestVictories.length > 0 && (
          <div className="space-y-2">
            <p className="text-white/40 text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Victorias del mes
            </p>
            <div className="space-y-2">
              {latestVictories.slice(0, 5).map((v, i) => (
                <div key={i} className="flex items-center gap-2 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                  <span className="text-yellow-400 text-sm">🏆</span>
                  <span className="text-sm text-yellow-200">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}

