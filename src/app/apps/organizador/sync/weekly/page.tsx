'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, addDays, startOfWeek, endOfWeek, isSameDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  X, ChevronRight, Briefcase, CheckSquare, ShoppingCart,
  Wallet, TrendingDown, CalendarDays, Trophy, Check, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSecretarySettings, getAvatarById, getUserFirstName,
  PERSONALITY_TEXTS
} from '@/lib/secretary-settings';
import { calculateDayLoad, type DayLoad } from '@/lib/secretary-intelligence';

// ─── Weekly Sync ──────────────────────────────────────────────────────────────

interface DayData {
  date: Date;
  shifts: any[];
  tasks: any[];
  load: DayLoad;
}

export default function SecretariaWeeklySyncPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [weeklyData, setWeeklyData] = useState<DayData[]>([]);
  const [monthExpenses, setMonthExpenses] = useState<number>(0);
  const [shoppingCount, setShoppingCount] = useState(0);
  const [weekVictories, setWeekVictories] = useState<string[]>([]);
  const [weeklyGoal, setWeeklyGoal] = useState('');

  const settings = getSecretarySettings();
  const profile = getAvatarById(settings.avatarId);
  const texts = PERSONALITY_TEXTS[settings.personality];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);

      // Next 7 days
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const days: DayData[] = [];

      for (let i = 1; i <= 7; i++) {
        const d = addDays(today, i);
        const dStart = new Date(d); dStart.setHours(0, 0, 0, 0);
        const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);

        const [shifts, tasks] = await Promise.all([
          supabase.from('work_shifts').select('*').eq('user_id', u.id)
            .gte('start_time', dStart.toISOString())
            .lte('start_time', dEnd.toISOString()),
          supabase.from('tasks').select('*').eq('user_id', u.id).eq('is_completed', false)
            .gte('due_date', dStart.toISOString())
            .lte('due_date', dEnd.toISOString()),
        ]);

        const shiftsData = shifts.data || [];
        const tasksData = tasks.data || [];
        const load = calculateDayLoad({ tasks: tasksData, shifts: shiftsData, medicines: [], conflicts: [] });
        days.push({ date: d, shifts: shiftsData, tasks: tasksData, load });
      }

      setWeeklyData(days);

      // Shopping count
      const { count } = await supabase.from('shopping_items')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id).eq('is_checked', false);
      setShoppingCount(count ?? 0);

      // Month expenses (current month savings transactions)
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { data: txns } = await supabase.from('savings_transactions')
        .select('amount, transaction_type')
        .eq('user_id', u.id)
        .gte('transaction_date', monthStart.toISOString());

      const expenses = (txns || [])
        .filter((t: any) => t.transaction_type === 'expense' || t.amount < 0)
        .reduce((sum: number, t: any) => sum + Math.abs(Number(t.amount)), 0);
      setMonthExpenses(expenses);

    } catch (e) {
      console.error('Error loading weekly sync:', e);
    } finally {
      setLoading(false);
    }
  };

  const saveWeeklySync = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const weekStart = addDays(new Date(), 1);
      weekStart.setHours(0, 0, 0, 0);

      await supabase.from('secretary_syncs').insert({
        user_id: user.id,
        sync_date: format(new Date(), 'yyyy-MM-dd'),
        sync_type: 'weekly',
        week_start: format(weekStart, 'yyyy-MM-dd'),
        mode: 'deep',
        notes: weeklyGoal || null,
        victories: weekVictories.length > 0 ? weekVictories : null,
        completed_at: new Date().toISOString(),
      });

      toast.success('¡Semana planificada! Que vaya todo bien 📅');
      router.push('/apps/organizador');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el sync semanal');
    } finally {
      setSaving(false);
    }
  };

  // Compute week stats
  const totalTasks = weeklyData.reduce((s, d) => s + d.tasks.length, 0);
  const totalShifts = weeklyData.reduce((s, d) => s + d.shifts.length, 0);
  const heavyDays = weeklyData.filter(d => d.load.level === 'heavy' || d.load.level === 'overloaded');
  const weekScore = Math.round(weeklyData.reduce((s, d) => s + d.load.score, 0) / 7);
  const weekLabel = weekScore <= 20 ? { label: 'Semana tranquila 😌', color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/20' }
    : weekScore <= 45 ? { label: 'Semana equilibrada 🙂', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
      : weekScore <= 70 ? { label: 'Semana cargada 😤', color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' }
        : { label: 'Semana muy dura 🔥', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' };

  if (loading || !settings) {
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
          <CalendarDays className="w-4 h-4 text-indigo-400" />
          <span className="text-white/60 text-sm font-medium">Sync Semanal</span>
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
            <h1 className="text-xl font-bold">Revisión Semanal</h1>
            <p className="text-white/50 text-sm">
              {format(addDays(new Date(), 1), "d MMM", { locale: es })} — {format(addDays(new Date(), 7), "d MMM yyyy", { locale: es })}
            </p>
          </div>
        </div>

        {/* Week load summary */}
        <div className={`p-4 rounded-2xl border ${weekLabel.bg} ${weekLabel.border}`}>
          <div className="flex items-center justify-between mb-3">
            <p className={`font-bold text-lg ${weekLabel.color}`}>{weekLabel.label}</p>
            <Badge className="bg-white/10 text-white/50 border-white/10">{weekScore}/100</Badge>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className={`h-full rounded-full ${weekScore <= 20 ? 'bg-green-400' : weekScore <= 45 ? 'bg-blue-400' : weekScore <= 70 ? 'bg-amber-400' : 'bg-red-400'}`}
              style={{ width: `${weekScore}%` }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 rounded-xl bg-white/5">
              <p className="text-lg font-bold text-white">{totalTasks}</p>
              <p className="text-white/40 text-xs">Tareas</p>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <p className="text-lg font-bold text-white">{totalShifts}</p>
              <p className="text-white/40 text-xs">Turnos</p>
            </div>
            <div className="p-2 rounded-xl bg-white/5">
              <p className="text-lg font-bold text-amber-300">{heavyDays.length}</p>
              <p className="text-white/40 text-xs">Días pesados</p>
            </div>
          </div>
        </div>

        {/* Day by day breakdown */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-widest">Los próximos 7 días</p>
          {weeklyData.map((day, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <div className="text-center w-12 flex-shrink-0">
                <p className="text-white/50 text-xs capitalize">{format(day.date, 'EEE', { locale: es })}</p>
                <p className="font-bold text-base">{format(day.date, 'd')}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {day.shifts.length > 0 && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                      💼 {day.shifts[0].title}
                    </Badge>
                  )}
                  {day.tasks.length > 0 && (
                    <Badge className="bg-white/10 text-white/50 border-white/10 text-xs">
                      ✅ {day.tasks.length} tarea{day.tasks.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {day.shifts.length === 0 && day.tasks.length === 0 && (
                    <span className="text-white/30 text-xs italic">Día libre</span>
                  )}
                </div>
              </div>
              <div className={`flex-shrink-0 text-sm ${day.load.color}`}>
                {day.load.emoji}
              </div>
            </div>
          ))}
        </div>

        {/* Week finances snapshot */}
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">💶 Estado financiero del mes</p>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">Gasto acumulado</span>
            <span className="font-bold text-green-300">{monthExpenses.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
          </div>
          {shoppingCount > 0 && (
            <div className="flex items-center gap-2 text-orange-300 text-xs">
              <ShoppingCart className="w-3.5 h-3.5" />
              {shoppingCount} ítems pendientes en la lista de compra
            </div>
          )}
        </div>

        {/* Heavy day alerts */}
        {heavyDays.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-2">
            <p className="text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Días intensos detectados
            </p>
            {heavyDays.map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="font-semibold capitalize">{format(d.date, "EEEE d", { locale: es })}</span>
                <span className={`text-xs ${d.load.color}`}>{d.load.label}</span>
              </div>
            ))}
            <p className="text-white/40 text-xs">Considera redistribuir tareas estos días.</p>
          </div>
        )}

        {/* Weekly goal */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">🎯 Objetivo de la semana</p>
          <textarea
            value={weeklyGoal}
            onChange={e => setWeeklyGoal(e.target.value)}
            placeholder="¿Qué quieres conseguir esta semana? (opcional)"
            rows={3}
            className="w-full bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-indigo-400/50"
          />
        </div>

        {/* This week's wins */}
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">🏆 Victorias de esta semana</p>
          {weekVictories.map((v, i) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="flex-1 text-sm text-yellow-200">{v}</span>
              <button onClick={() => setWeekVictories(prev => prev.filter((_, idx) => idx !== i))} className="text-white/20 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Añadir victoria semanal..."
              className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-400/50"
              onKeyDown={e => {
                if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                  setWeekVictories(prev => [...prev, e.currentTarget.value.trim()]);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="p-5 border-t border-white/10">
        <Button
          onClick={saveWeeklySync}
          disabled={saving}
          className="w-full h-14 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-indigo-500/20"
        >
          <Check className="w-5 h-5 mr-2" />
          {saving ? 'Guardando...' : 'Semana lista ✓'}
        </Button>
      </div>
    </div>
  );
}

