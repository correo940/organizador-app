'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowRight, Check, Briefcase, ShoppingCart, Pill,
  AlertTriangle, Clock, CalendarCheck, X,
  TrendingUp, Zap
} from 'lucide-react';
import {
  getSecretarySettings, getAvatarById, getUserFirstName,
  PERSONALITY_TEXTS, type SecretarySettings
} from '@/lib/secretary-settings';
import {
  detectConflicts, calculateDayLoad, getTopPriorityTasks,
  type DayConflict, type DayLoad, type TaskWithScore
} from '@/lib/secretary-intelligence';

// ─── Briefing del día — Fase 2 ────────────────────────────────────────────────

export default function SecretariaBriefingPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SecretarySettings | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [archived, setArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);

  // Data
  const [todayShifts, setTodayShifts] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [shoppingItems, setShoppingItems] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [upcomingAlerts, setUpcomingAlerts] = useState<string[]>([]);

  // Intelligence (Fase 2 + 4)
  const [conflicts, setConflicts] = useState<DayConflict[]>([]);
  const [dayLoad, setDayLoad] = useState<DayLoad | null>(null);
  const [lastPlannedExpense, setLastPlannedExpense] = useState<number | null>(null);
  const [priorityTasks, setPriorityTasks] = useState<TaskWithScore[]>([]); // Fase 4.1

  useEffect(() => {
    const s = getSecretarySettings();
    setSettings(s);
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/login'); return; }
      setUser(u);

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const [shifts, tasks, shopping, meds, accs, todaySync] = await Promise.all([
        supabase.from('work_shifts').select('*').eq('user_id', u.id)
          .gte('start_time', todayStart.toISOString())
          .lte('start_time', todayEnd.toISOString())
          .order('start_time'),
        supabase.from('tasks').select('*').eq('user_id', u.id).eq('is_completed', false)
          .gte('due_date', todayStart.toISOString())
          .lte('due_date', todayEnd.toISOString())
          .order('due_date'),
        supabase.from('shopping_items').select('*').eq('user_id', u.id).eq('is_checked', false),
        supabase.from('medicines').select('*').eq('user_id', u.id),
        supabase.from('savings_accounts').select('*').eq('user_id', u.id),
        supabase.from('secretary_syncs').select('briefing_read_at, planned_expenses')
          .eq('user_id', u.id)
          .eq('sync_date', format(new Date(), 'yyyy-MM-dd'))
          .maybeSingle(),
      ]);

      const shiftsData = shifts.data || [];
      const tasksData = tasks.data || [];
      const medsFiltered = (meds.data || []).filter((m: any) => m.alarm_times?.length > 0);
      const accsData = accs.data || [];
      const balance = accsData.reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0);
      const plannedExp = todaySync.data?.planned_expenses ?? null;

      setTodayShifts(shiftsData);
      setTodayTasks(tasksData);
      setShoppingItems(shopping.data || []);
      setMedicines(medsFiltered);
      setAccounts(accsData);
      setLastPlannedExpense(plannedExp);

      if (todaySync.data?.briefing_read_at) setArchived(true);

      // ── Intelligence (Fase 2) ────────────────────────────────────────────
      const detectedConflicts = detectConflicts({
        tasks: tasksData,
        shifts: shiftsData,
        balance,
        plannedExpense: plannedExp ?? undefined,
        medicines: meds.data || [],
      });
      setConflicts(detectedConflicts);
      setDayLoad(calculateDayLoad({
        tasks: tasksData,
        shifts: shiftsData,
        medicines: medsFiltered,
        conflicts: detectedConflicts,
      }));

      // Fase 4.1 — prioridades
      setPriorityTasks(getTopPriorityTasks(tasksData, 5));

      // Build upcoming alerts (next 7 days)
      const alerts: string[] = [];
      const now = new Date();
      meds.data?.forEach((m: any) => {
        if (!m.expiration_date) return;
        const days = differenceInDays(parseISO(m.expiration_date), now);
        if (days >= 0 && days <= 7) alerts.push(`💊 ${m.name} caduca el ${format(parseISO(m.expiration_date), 'dd/MM')}`);
      });
      setUpcomingAlerts(alerts);

    } catch (e) {
      console.error('Error loading briefing:', e);
    } finally {
      setLoading(false);
    }
  };

  const archiveBriefing = async () => {
    if (!user) return;
    setArchiving(true);
    try {
      await supabase.from('secretary_syncs').upsert({
        user_id: user.id,
        sync_date: format(new Date(), 'yyyy-MM-dd'),
        briefing_read_at: new Date().toISOString(),
      }, { onConflict: 'user_id,sync_date' });
      setArchived(true);
    } catch (e) {
      console.error(e);
    } finally {
      setArchiving(false);
    }
  };

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3 text-white/40">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <p className="text-sm">Preparando tu briefing...</p>
        </div>
      </div>
    );
  }

  const profile = getAvatarById(settings.avatarId);
  const texts = PERSONALITY_TEXTS[settings.personality];
  const firstName = getUserFirstName(user);
  const now = new Date();

  const criticalConflicts = conflicts.filter(c => c.severity === 'critical');
  const warningConflicts = conflicts.filter(c => c.severity === 'warning');

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* Close button */}
      <div className="absolute top-4 right-4 z-10">
        <button onClick={() => router.push('/')} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Header strip */}
      <div className={`px-6 pt-10 pb-8 ${dayLoad?.level === 'overloaded'
        ? 'bg-gradient-to-r from-red-900/80 to-orange-900/80'
        : dayLoad?.level === 'heavy'
          ? 'bg-gradient-to-r from-amber-900/60 to-indigo-900'
          : 'bg-gradient-to-r from-indigo-900 to-purple-900'
        }`}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-3xl shadow-inner">
            {profile.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-sm">{texts.briefingGreeting(firstName)}</p>
            <h1 className="text-xl font-bold mt-0.5 capitalize">
              {format(now, "EEEE, d 'de' MMMM", { locale: es })}
            </h1>
          </div>
        </div>

        {/* Day Load Bar */}
        {dayLoad && (
          <div className={`mt-4 p-3 rounded-xl ${dayLoad.bgColor} border border-white/10`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{dayLoad.emoji}</span>
                <span className={`font-bold text-sm ${dayLoad.color}`}>{dayLoad.label}</span>
              </div>
              <span className="text-white/40 text-xs">{dayLoad.score}/100</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${dayLoad.level === 'overloaded' ? 'bg-red-400' :
                    dayLoad.level === 'heavy' ? 'bg-amber-400' :
                      dayLoad.level === 'moderate' ? 'bg-blue-400' : 'bg-green-400'
                  }`}
                style={{ width: `${dayLoad.score}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">

        {/* Archived state */}
        {archived && (
          <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-2 text-green-300 text-sm">
            <CalendarCheck className="w-4 h-4 flex-shrink-0" />
            Briefing archivado. Ya tienes el día en la mano.
          </div>
        )}

        {/* ALERTAS CRÍTICAS — siempre al tope */}
        {criticalConflicts.length > 0 && (
          <BriefingCard title="Atención requerida" emoji="🚨" accent="red">
            {criticalConflicts.map(c => (
              <ConflictRow key={c.id} conflict={c} />
            ))}
          </BriefingCard>
        )}

        {/* AVISOS */}
        {warningConflicts.length > 0 && (
          <BriefingCard title="Puntos a revisar" emoji="⚠️" accent="amber">
            {warningConflicts.map(c => (
              <ConflictRow key={c.id} conflict={c} />
            ))}
          </BriefingCard>
        )}

        {/* AGENDA */}
        {(settings.modules.shifts || settings.modules.tasks) && (
          <BriefingCard title="Agenda de hoy" emoji="📋" accent="blue">
            {settings.modules.shifts && todayShifts.length > 0 && todayShifts.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                <Briefcase className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">{s.title}</p>
                  <p className="text-white/40 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(s.start_time), 'HH:mm')} – {format(new Date(s.end_time), 'HH:mm')}
                  </p>
                </div>
              </div>
            ))}
            {/* Tareas — Fase 4.1: mostrar con badge de prioridad */}
            {settings.modules.tasks && priorityTasks.length > 0
              ? priorityTasks.map(({ task: t, levelEmoji, levelLabel, levelColor, levelBg }) => (
                <div key={t.id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                  <span className="text-sm flex-shrink-0">{levelEmoji}</span>
                  <p className="text-sm flex-1">{t.title}</p>
                  <Badge className={`text-[10px] border ${levelBg} ${levelColor}`}>{levelLabel}</Badge>
                </div>
              ))
              : settings.modules.tasks && todayTasks.map((t: any) => (
                <div key={t.id} className="flex items-center gap-2.5 py-2 border-b border-white/5 last:border-0">
                  <div className="w-4 h-4 rounded border border-white/30 flex-shrink-0" />
                  <p className="text-sm flex-1">{t.title}</p>
                  {t.priority === 'high' && <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-[10px]">Urgente</Badge>}
                </div>
              ))
            }
            {todayShifts.length === 0 && todayTasks.length === 0 && (
              <p className="text-white/40 text-sm italic py-2">Sin agenda para hoy. 🎉</p>
            )}
            {/* Task count summary */}
            {todayTasks.length > 0 && (
              <div className="pt-2 flex items-center gap-1.5 text-white/30 text-xs">
                <Zap className="w-3 h-3" />
                {todayTasks.length} tarea{todayTasks.length > 1 ? 's' : ''} en la lista
              </div>
            )}
          </BriefingCard>
        )}

        {/* MEDICACIÓN */}
        {settings.modules.medicines && medicines.length > 0 && (
          <BriefingCard title="Medicación de hoy" emoji="💊" accent="pink">
            {medicines.map((med: any) => (
              <div key={med.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-pink-400 flex-shrink-0" />
                  <span className="text-sm font-medium">{med.name}</span>
                </div>
                <div className="flex gap-1 flex-wrap justify-end">
                  {med.alarm_times?.map((time: string, i: number) => (
                    <Badge key={i} className="bg-pink-500/20 text-pink-200 border-pink-500/30 text-xs">
                      {time}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </BriefingCard>
        )}

        {/* FINANZAS */}
        {settings.modules.finances && (
          <BriefingCard title="Estado financiero" emoji="💶" accent="green-800">
            <div className="flex items-baseline gap-2 py-2">
              <span className={`text-3xl font-extrabold ${totalBalance < 0 ? 'text-red-400' : totalBalance < 200 ? 'text-amber-300' : 'text-green-300'}`}>
                {totalBalance.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€
              </span>
              <span className="text-white/40 text-sm">disponibles</span>
            </div>
            {accounts.map((acc: any) => (
              <div key={acc.id} className="flex justify-between items-center py-1.5 text-sm border-b border-white/5 last:border-0">
                <span className="text-white/50">{acc.name}</span>
                <span className="font-medium">{Number(acc.current_balance).toLocaleString('es-ES', { maximumFractionDigits: 0 })}€</span>
              </div>
            ))}
            {lastPlannedExpense && lastPlannedExpense > 0 && (
              <div className="mt-2 pt-2 border-t border-white/10 flex items-center gap-2 text-amber-300 text-xs">
                <TrendingUp className="w-3.5 h-3.5" />
                Gasto planeado hoy: <span className="font-bold">{lastPlannedExpense.toFixed(0)}€</span>
              </div>
            )}
          </BriefingCard>
        )}

        {/* COMPRA */}
        {settings.modules.shopping && shoppingItems.length > 0 && (
          <BriefingCard title="Lista de la compra" emoji="🛒" accent="orange">
            <div className="flex items-center gap-3 py-2">
              <ShoppingCart className="w-5 h-5 text-orange-400" />
              <div>
                <p className="font-semibold">{shoppingItems.length} ítems pendientes</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {shoppingItems.slice(0, 3).map((i: any) => i.name).join(', ')}
                  {shoppingItems.length > 3 && ` +${shoppingItems.length - 3} más`}
                </p>
              </div>
            </div>
          </BriefingCard>
        )}

        {/* ALERTAS PRÓXIMAS */}
        {upcomingAlerts.length > 0 && (
          <BriefingCard title="Alertas próximas" emoji="⚠️" accent="amber">
            {upcomingAlerts.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 text-sm border-b border-white/5 last:border-0">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span className="text-amber-200">{a}</span>
              </div>
            ))}
          </BriefingCard>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <QuickLink label="Hacer Sync" href="/apps/organizador/sync" />
          <QuickLink label="Resumen completo" href="/apps/resumen-diario" />
        </div>

      </div>

      {/* Footer CTA */}
      {!archived ? (
        <div className="p-5 border-t border-white/10">
          <Button
            onClick={archiveBriefing}
            disabled={archiving}
            className="w-full h-12 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl"
          >
            <Check className="w-4 h-4 mr-2" />
            {archiving ? 'Archivando...' : 'He leído el briefing ✓'}
          </Button>
        </div>
      ) : (
        <div className="p-5 border-t border-white/10">
          <Button
            variant="ghost"
            onClick={() => router.push('/')}
            className="w-full h-12 text-white/50 hover:text-white hover:bg-white/5 rounded-2xl"
          >
            Volver al inicio
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Reusable BriefingCard ─────────────────────────────────────────────────────

type Accent = 'blue' | 'pink' | 'green-800' | 'orange' | 'amber' | 'red';

const ACCENT_STYLES: Record<Accent, string> = {
  blue: 'border-l-blue-500   bg-blue-500/5',
  pink: 'border-l-pink-500   bg-pink-500/5',
  'green-800': 'border-l-green-500 bg-green-500/5',
  orange: 'border-l-orange-500  bg-orange-500/5',
  amber: 'border-l-amber-500   bg-amber-500/5',
  red: 'border-l-red-500     bg-red-500/8',
};

function BriefingCard({ title, emoji, accent, children }: {
  title: string; emoji: string; accent: Accent; children: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border border-white/8 border-l-2 ${ACCENT_STYLES[accent]} p-4`}>
      <h3 className="text-xs font-bold uppercase tracking-widest text-white/30 flex items-center gap-1.5 mb-3">
        <span>{emoji}</span> {title}
      </h3>
      {children}
    </div>
  );
}

function ConflictRow({ conflict }: { conflict: DayConflict }) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-white/5 last:border-0">
      <span className="text-lg flex-shrink-0 mt-0.5">{conflict.emoji}</span>
      <div>
        <p className={`font-semibold text-sm ${conflict.severity === 'critical' ? 'text-red-300' : 'text-amber-300'}`}>
          {conflict.title}
        </p>
        <p className="text-white/50 text-xs mt-0.5">{conflict.detail}</p>
      </div>
    </div>
  );
}

function QuickLink({ label, href }: { label: string; href: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.push(href)}
      className="p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-white/60 hover:text-white transition-all flex items-center justify-between"
    >
      <span>{label}</span>
      <ArrowRight className="w-3.5 h-3.5" />
    </button>
  );
}

