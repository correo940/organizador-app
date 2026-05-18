'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, subMonths, startOfMonth, endOfMonth, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  X, Check, Wallet, TrendingUp, TrendingDown, Target,
  Trophy, Calendar, AlertCircle, PiggyBank, ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSecretarySettings, getAvatarById, getUserFirstName,
  PERSONALITY_TEXTS
} from '@/lib/secretary-settings';

// ─── Monthly Sync ─────────────────────────────────────────────────────────────

export default function SecretariaMonthlySyncPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Previous month data
  const [prevMonthExpenses, setPrevMonthExpenses] = useState(0);
  const [prevMonthIncome, setPrevMonthIncome] = useState(0);
  const [prevCompletedTasks, setPrevCompletedTasks] = useState(0);
  const [prevTotalTasks, setPrevTotalTasks] = useState(0);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [upcomingExpirations, setUpcomingExpirations] = useState<any[]>([]);

  // User inputs
  const [monthlySavingsGoal, setMonthlySavingsGoal] = useState('');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [monthNotes, setMonthNotes] = useState('');
  const [monthVictories, setMonthVictories] = useState<string[]>([]);

  const settings = getSecretarySettings();
  const profile = getAvatarById(settings.avatarId);
  const texts = PERSONALITY_TEXTS[settings.personality];

  const now = new Date();
  const prevMonth = subMonths(now, 1);
  const prevMonthStr = format(prevMonth, "MMMM yyyy", { locale: es });
  const currMonthStr = format(now, "MMMM yyyy", { locale: es });
  const monthYear = format(now, 'yyyy-MM');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);

      const prevStart = startOfMonth(prevMonth);
      const prevEnd = endOfMonth(prevMonth);
      const nowISO = prevEnd.toISOString();

      // Previous month transactions
      const { data: txns } = await supabase.from('savings_transactions')
        .select('amount, transaction_type')
        .eq('user_id', u.id)
        .gte('transaction_date', prevStart.toISOString())
        .lte('transaction_date', nowISO);

      const expenses = (txns || []).filter((t: any) => t.amount < 0 || t.transaction_type === 'expense')
        .reduce((s: number, t: any) => s + Math.abs(Number(t.amount)), 0);
      const income = (txns || []).filter((t: any) => t.amount > 0 && t.transaction_type !== 'expense')
        .reduce((s: number, t: any) => s + Number(t.amount), 0);
      setPrevMonthExpenses(expenses);
      setPrevMonthIncome(income);

      // Previous month tasks
      const [completed, allTasks] = await Promise.all([
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
          .eq('is_completed', true)
          .gte('updated_at', prevStart.toISOString())
          .lte('updated_at', nowISO),
        supabase.from('tasks').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
          .gte('created_at', prevStart.toISOString())
          .lte('created_at', nowISO),
      ]);
      setPrevCompletedTasks(completed.count ?? 0);
      setPrevTotalTasks(allTasks.count ?? 0);

      // Accounts
      const { data: accs } = await supabase.from('savings_accounts').select('*').eq('user_id', u.id);
      setAccounts(accs || []);

      // Upcoming expirations (documents + insurance next 30 days)
      const in30Days = addDays(now, 30).toISOString();
      const [docs, insurances, meds] = await Promise.all([
        supabase.from('documents').select('name, expiry_date')
          .eq('user_id', u.id).not('expiry_date', 'is', null)
          .gte('expiry_date', now.toISOString()).lte('expiry_date', in30Days),
        supabase.from('insurances').select('name, renewal_date')
          .eq('user_id', u.id).not('renewal_date', 'is', null)
          .gte('renewal_date', now.toISOString()).lte('renewal_date', in30Days),
        supabase.from('medicines').select('name, expiration_date')
          .eq('user_id', u.id).not('expiration_date', 'is', null)
          .gte('expiration_date', now.toISOString()).lte('expiration_date', in30Days),
      ]);

      const expirations = [
        ...(docs.data || []).map((d: any) => ({ type: '📄', name: d.name, date: d.expiry_date })),
        ...(insurances.data || []).map((i: any) => ({ type: '🛡️', name: i.name, date: i.renewal_date })),
        ...(meds.data || []).map((m: any) => ({ type: '💊', name: m.name, date: m.expiration_date })),
      ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setUpcomingExpirations(expirations);

    } catch (e) {
      console.error('Error loading monthly sync:', e);
    } finally {
      setLoading(false);
    }
  };

  const addVictory = (text: string) => {
    if (!text.trim()) return;
    setMonthVictories(prev => [...prev, text.trim()]);
  };

  const saveMonthlySync = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const savings = prevMonthIncome - prevMonthExpenses;
      await supabase.from('secretary_syncs').insert({
        user_id: user.id,
        sync_date: format(now, 'yyyy-MM-dd'),
        sync_type: 'monthly',
        month_year: monthYear,
        mode: 'deep',
        notes: monthNotes || null,
        victories: monthVictories.length > 0 ? monthVictories : null,
        completed_tasks_count: prevCompletedTasks,
        savings_achieved: savings > 0 ? savings : null,
        planned_expenses: monthlyBudget ? parseFloat(monthlyBudget) : null,
        completed_at: now.toISOString(),
      });
      toast.success('¡Mes planificado! A por todas 🚀');
      router.push('/apps/organizador');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el sync mensual');
    } finally {
      setSaving(false);
    }
  };

  const totalBalance = accounts.reduce((s, a) => s + Number(a.current_balance || 0), 0);
  const prevSavings = prevMonthIncome - prevMonthExpenses;
  const taskRate = prevTotalTasks > 0 ? Math.round((prevCompletedTasks / prevTotalTasks) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900">
        <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={() => router.push('/apps/organizador')} className="text-white/40 hover:text-white/70">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          <span className="text-white/60 text-sm font-medium">Sync Mensual</span>
        </div>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Avatar header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl border border-white/10">
            {profile.emoji}
          </div>
          <div>
            <h1 className="text-xl font-bold capitalize">¡Llegó {currMonthStr}!</h1>
            <p className="text-white/50 text-sm capitalize">Repasemos {prevMonthStr}</p>
          </div>
        </div>

        {/* ─── Resumen mes anterior ─────────────────────────────────────── */}
        <SectionTitle emoji="📊" title={`Resumen de ${prevMonthStr}`} />

        {/* Task completion */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm font-medium">Tareas completadas</span>
            </div>
            <Badge className={`${taskRate >= 70 ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
              {prevCompletedTasks}/{prevTotalTasks} ({taskRate}%)
            </Badge>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${taskRate >= 70 ? 'bg-green-400' : taskRate >= 40 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${taskRate}%` }}
            />
          </div>
          {taskRate >= 80 && <p className="text-green-300 text-xs">🌟 ¡Mes excepcional! Más del 80% de tareas completadas.</p>}
          {taskRate < 40 && <p className="text-amber-300 text-xs">⚠️ Menos del 40% de tareas completadas. ¿Demasiado cargado?</p>}
        </div>

        {/* Financial summary */}
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
          <p className="text-white/40 text-xs uppercase tracking-wider">Finanzas del mes anterior</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <p className="text-red-300 text-xs">Gastos</p>
              </div>
              <p className="text-xl font-bold text-red-300">
                {prevMonthExpenses.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
              </p>
            </div>
            <div className={`p-3 rounded-xl ${prevSavings >= 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <PiggyBank className={`w-3.5 h-3.5 ${prevSavings >= 0 ? 'text-green-400' : 'text-red-400'}`} />
                <p className={`text-xs ${prevSavings >= 0 ? 'text-green-300' : 'text-red-300'}`}>Ahorro neto</p>
              </div>
              <p className={`text-xl font-bold ${prevSavings >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                {prevSavings >= 0 ? '+' : ''}{prevSavings.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
              </p>
            </div>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-white/10">
            <span className="text-white/40 text-sm">Saldo total actual</span>
            <span className={`font-bold ${totalBalance < 0 ? 'text-red-300' : 'text-green-300'}`}>
              {totalBalance.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€
            </span>
          </div>
        </div>

        {/* ─── Alertas proactivas ───────────────────────────────────────── */}
        {upcomingExpirations.length > 0 && (
          <>
            <SectionTitle emoji="⚠️" title="Vencimientos próximos (30 días)" />
            <div className="space-y-2">
              {upcomingExpirations.map((item, i) => {
                const daysLeft = Math.ceil((new Date(item.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${daysLeft <= 7 ? 'bg-red-500/10 border-red-500/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                    <span className="text-xl">{item.type}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className={`text-xs ${daysLeft <= 7 ? 'text-red-300' : 'text-amber-300'}`}>
                        Vence en {daysLeft} día{daysLeft !== 1 ? 's' : ''} — {format(new Date(item.date), 'd MMM', { locale: es })}
                      </p>
                    </div>
                    {daysLeft <= 7 && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ─── Planificación del mes nuevo ─────────────────────────────── */}
        <SectionTitle emoji="🎯" title={`Planifica ${currMonthStr}`} />

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-white/40 text-xs uppercase tracking-wider">Presupuesto mensual (€)</label>
            <Input
              type="number"
              value={monthlyBudget}
              onChange={e => setMonthlyBudget(e.target.value)}
              placeholder="Ej: 1200"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-white/40 text-xs uppercase tracking-wider">Objetivo de ahorro (€)</label>
            <Input
              type="number"
              value={monthlySavingsGoal}
              onChange={e => setMonthlySavingsGoal(e.target.value)}
              placeholder="Ej: 200"
              className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-white/40 text-xs uppercase tracking-wider">Notas para el mes</label>
            <textarea
              value={monthNotes}
              onChange={e => setMonthNotes(e.target.value)}
              placeholder="Gastos previstos, vacaciones, pagos grandes..."
              rows={3}
              className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-indigo-400/50"
            />
          </div>
        </div>

        {/* Month victories */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">🏆 Victorias del mes anterior</p>
          {monthVictories.map((v, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="flex-1 text-sm text-yellow-200">{v}</span>
              <button onClick={() => setMonthVictories(prev => prev.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <input
            type="text"
            placeholder="Añadir victoria del mes..."
            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400/50"
            onKeyDown={e => {
              if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                addVictory(e.currentTarget.value);
                e.currentTarget.value = '';
              }
            }}
          />
        </div>

        <div className="h-4" />
      </div>

      {/* Save button */}
      <div className="p-5 border-t border-white/10">
        <Button
          onClick={saveMonthlySync}
          disabled={saving}
          className="w-full h-14 bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-purple-500/20"
        >
          <Check className="w-5 h-5 mr-2" />
          {saving ? 'Guardando...' : 'Mes planificado ✓'}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-white/30 flex items-center gap-1.5">
      <span>{emoji}</span>{title}
    </p>
  );
}

