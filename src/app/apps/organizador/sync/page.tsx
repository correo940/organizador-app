'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  ChevronRight, ChevronLeft, Check, X, Briefcase, ListTodo,
  ShoppingCart, Pill, Wallet, Trophy, PartyPopper, Plus,
  Zap, BookOpen, Clock, RefreshCw, AlertTriangle, SkipForward
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getSecretarySettings, getAvatarById, getUserFirstName,
  PERSONALITY_TEXTS, type SecretarySettings
} from '@/lib/secretary-settings';
import {
  detectConflicts, calculateDayLoad, getPendingRescheduleItems,
  scoreTaskPriority,
  type DayConflict, type DayLoad, type TaskWithScore
} from '@/lib/secretary-intelligence';
import { usePredictiveShopping } from '@/lib/hooks/use-predictive-shopping';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SyncBlock {
  id: string;
  title: string;
  emoji: string;
  icon: React.ElementType;
  skippableInQuick?: boolean;
}

const BLOCKS: SyncBlock[] = [
  { id: 'welcome',    title: 'Bienvenida',           emoji: 'ðŸŒ™', icon: Zap },
  { id: 'followup',   title: 'Seguimiento del día',  emoji: 'ðŸ“Š', icon: RefreshCw },
  { id: 'shifts',     title: 'Turno de mañana',      emoji: 'ðŸ’¼', icon: Briefcase, skippableInQuick: false },
  { id: 'tasks',      title: 'Tareas de mañana',     emoji: '✅', icon: ListTodo },
  { id: 'shopping',   title: 'Lista de la compra',   emoji: 'ðŸ›’', icon: ShoppingCart },
  { id: 'medicines',  title: 'Medicación',           emoji: 'ðŸ’Š', icon: Pill, skippableInQuick: true },
  { id: 'finances',   title: 'Finanzas',             emoji: 'ðŸ’¶', icon: Wallet },
  { id: 'victories',  title: 'Victorias del día',    emoji: 'ðŸ†', icon: Trophy },
  { id: 'done',       title: '¡Listo!',              emoji: 'ðŸŽ‰', icon: PartyPopper },
];

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SecretariaSyncPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<SecretarySettings | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'quick' | 'deep' | 'conversational' | null>(null);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [saving, setSaving] = useState(false);
  const [scoredTasks, setScoredTasks] = useState<TaskWithScore[]>([]);

  // Data from DB
  const [tomorrowShifts, setTomorrowShifts] = useState<any[]>([]);
  const [tomorrowTasks, setTomorrowTasks] = useState<any[]>([]);
  const [shoppingItems, setShoppingItems] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [todayTasks, setTodayTasks] = useState<any[]>([]);
  const [todayIncompleteTasks, setTodayIncompleteTasks] = useState<any[]>([]);

  // User edits during sync
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newShoppingItem, setNewShoppingItem] = useState('');
  const [plannedExpense, setPlannedExpense] = useState('');
  const [syncNotes, setSyncNotes] = useState('');
  const [victories, setVictories] = useState<string[]>([]);
  const [newVictory, setNewVictory] = useState('');

  // Phase 2 â€” follow-up state
  const [rescheduledTasks, setRescheduledTasks] = useState<Set<string>>(new Set());
  const [skippedTasks, setSkippedTasks] = useState<Set<string>>(new Set());
  const [tomorrowConflicts, setTomorrowConflicts] = useState<DayConflict[]>([]);
  const [tomorrowLoad, setTomorrowLoad] = useState<DayLoad | null>(null);

  // Phase 4.3 â€” conversational mode
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [chatReady, setChatReady] = useState(false); // ready to close

  // â”€â”€ Load data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

      const tomorrow = addDays(new Date(), 1);
      const tomorrowStart = new Date(tomorrow); tomorrowStart.setHours(0, 0, 0, 0);
      const tomorrowEnd   = new Date(tomorrow); tomorrowEnd.setHours(23, 59, 59, 999);
      const todayStart    = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd      = new Date(); todayEnd.setHours(23, 59, 59, 999);

      const [shifts, tasks, shopping, meds, accs, todayTasksData, todayIncomplete] = await Promise.all([
        supabase.from('work_shifts').select('*').eq('user_id', u.id)
          .gte('start_time', tomorrowStart.toISOString())
          .lte('start_time', tomorrowEnd.toISOString()),
        supabase.from('tasks').select('*').eq('user_id', u.id).eq('is_completed', false)
          .gte('due_date', tomorrowStart.toISOString())
          .lte('due_date', tomorrowEnd.toISOString()),
        supabase.from('shopping_items').select('*').eq('user_id', u.id).eq('is_checked', false),
        supabase.from('medicines').select('*').eq('user_id', u.id),
        supabase.from('savings_accounts').select('*').eq('user_id', u.id),
        // Completed today
        supabase.from('tasks').select('*').eq('user_id', u.id).eq('is_completed', true)
          .gte('updated_at', todayStart.toISOString())
          .lte('updated_at', todayEnd.toISOString()),
        // Pending today (not completed)
        supabase.from('tasks').select('*').eq('user_id', u.id).eq('is_completed', false)
          .gte('due_date', todayStart.toISOString())
          .lte('due_date', todayEnd.toISOString()),
      ]);

      const shiftsData = shifts.data || [];
      const tasksData  = tasks.data  || [];
      const accsData   = accs.data   || [];
      const balance    = accsData.reduce((s: number, a: any) => s + Number(a.current_balance || 0), 0);

      setTomorrowShifts(shiftsData);
      setTomorrowTasks(tasksData);
      setScoredTasks(scoreTaskPriority(tasksData)); // Fase 4.1 â€” prioridades
      setShoppingItems(shopping.data || []);
      setMedicines((meds.data || []).filter((m: any) => m.alarm_times?.length > 0));
      setAccounts(accsData);
      setTodayTasks(todayTasksData.data || []);
      setTodayIncompleteTasks(todayIncomplete.data || []);

      // Pre-compute tomorrow's intelligence
      const conflicts = detectConflicts({
        tasks: tasksData,
        shifts: shiftsData,
        balance,
        medicines: meds.data || [],
      });
      setTomorrowConflicts(conflicts);
      setTomorrowLoad(calculateDayLoad({
        tasks: tasksData,
        shifts: shiftsData,
        medicines: (meds.data || []).filter((m: any) => m.alarm_times?.length > 0),
        conflicts,
      }));

    } catch (e) {
      console.error('Error loading sync data:', e);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const activeBlocks = mode === 'quick'
    ? BLOCKS.filter(b => !b.skippableInQuick)
    : BLOCKS;

  const next = () => { if (currentBlock < activeBlocks.length - 1) setCurrentBlock(c => c + 1); };
  const prev = () => { if (currentBlock > 0) setCurrentBlock(c => c - 1); };

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const addTask = async () => {
    if (!newTaskTitle.trim() || !user) return;
    const tomorrow = addDays(new Date(), 1); tomorrow.setHours(9, 0, 0, 0);
    const { data, error } = await supabase.from('tasks').insert({
      user_id: user.id, title: newTaskTitle.trim(),
      due_date: tomorrow.toISOString(), is_completed: false,
    }).select().single();
    if (!error && data) {
      setTomorrowTasks(prev => [...prev, data]);
      setNewTaskTitle('');
    }
  };

  const addShoppingItem = async () => {
    if (!newShoppingItem.trim() || !user) return;
    const { data, error } = await supabase.from('shopping_items').insert({
      user_id: user.id, name: newShoppingItem.trim(), is_checked: false,
    }).select().single();
    if (!error && data) {
      setShoppingItems(prev => [...prev, data]);
      setNewShoppingItem('');
    }
  };

  const addVictory = () => {
    if (!newVictory.trim()) return;
    setVictories(prev => [...prev, newVictory.trim()]);
    setNewVictory('');
  };

  // Phase 2 â€” Reschedule a pending today task to tomorrow
  const rescheduleTask = async (task: any) => {
    const tomorrow = addDays(new Date(), 1); tomorrow.setHours(9, 0, 0, 0);
    const { data, error } = await supabase.from('tasks')
      .update({ due_date: tomorrow.toISOString() })
      .eq('id', task.id)
      .select().single();
    if (!error && data) {
      setRescheduledTasks(prev => new Set([...prev, task.id]));
      setTomorrowTasks(prev => [...prev, data]);
      toast.success(`"${task.title}" pospuesta a mañana`);
    }
  };

  const skipTask = (taskId: string) => {
    setSkippedTasks(prev => new Set([...prev, taskId]));
  };

  const saveSync = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const allVictories = [
        ...todayTasks.map(t => t.title),
        ...victories,
      ];
      await supabase.from('secretary_syncs').upsert({
        user_id: user.id,
        sync_date: format(new Date(), 'yyyy-MM-dd'),
        sync_type: 'daily',
        mode: mode ?? 'quick',
        notes: syncNotes || null,
        victories: allVictories.length > 0 ? allVictories : null,
        planned_expenses: plannedExpense ? parseFloat(plannedExpense) : null,
        // Fase 4.3 â€” guardar conversaciÃ³n y resumen IA
        conversation_history: chatMessages.length > 0 ? chatMessages : null,
        ai_summary: chatSummary ?? null,
        // Fase 4.1 â€” guardar puntuaciones de prioridad
        priority_scores: scoredTasks.length > 0
          ? scoredTasks.map(s => ({ id: s.task.id, title: s.task.title, score: s.score, level: s.level }))
          : null,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,sync_date' });
      toast.success('Â¡Sync completado! Que descanses ðŸ˜´');
      router.push('/');
    } catch (e) {
      console.error(e);
      toast.error('Error al guardar el sync');
    } finally {
      setSaving(false);
    }
  };

  // â”€â”€ Conversational mode chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const sendChatMessage = async (text?: string) => {
    const content = text ?? chatInput.trim();
    if (!content || chatLoading) return;
    setChatInput('');
    const newMessages = [...chatMessages, { role: 'user' as const, content }];
    setChatMessages(newMessages);
    setChatLoading(true);
    try {
      const res = await fetch('/api/secretary-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          isFirstMessage: false,
          userContext: {
            firstName,
            todayTasks: todayTasks.map(t => ({ title: t.title, is_completed: t.is_completed })),
            tomorrowTasks: tomorrowTasks.map(t => ({ title: t.title, due_date: t.due_date })),
            balance: totalBalance,
            plannedExpense: plannedExpense ? parseFloat(plannedExpense) : undefined,
            shoppingCount: shoppingItems.length,
            tomorrowShifts,
            incompleteToday: todayIncompleteTasks.map(t => ({ title: t.title })),
          },
        }),
      });
      const data = await res.json();
      const reply = data.reply ?? '';
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (data.isSummary) {
        setChatSummary(data.summaryText);
        setChatReady(true);
      }
    } catch (e) {
      toast.error('Error al contactar con el asistente IA');
    } finally {
      setChatLoading(false);
    }
  };

  const initChat = async () => {
    setChatLoading(true);
    try {
      const res = await fetch('/api/secretary-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [],
          isFirstMessage: true,
          userContext: {
            firstName,
            todayTasks: todayTasks.map(t => ({ title: t.title, is_completed: t.is_completed })),
            tomorrowTasks: tomorrowTasks.map(t => ({ title: t.title, due_date: t.due_date })),
            balance: totalBalance,
            shoppingCount: shoppingItems.length,
            tomorrowShifts,
            incompleteToday: todayIncompleteTasks.map(t => ({ title: t.title })),
          },
        }),
      });
      const data = await res.json();
      if (data.reply) {
        setChatMessages([{ role: 'assistant', content: data.reply }]);
      }
    } catch (e) {
      console.error('initChat error:', e);
    } finally {
      setChatLoading(false);
    }
  };

  // â”€â”€ Computed â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);
  const profile      = settings ? getAvatarById(settings.avatarId) : null;
  const texts        = settings ? PERSONALITY_TEXTS[settings.personality] : PERSONALITY_TEXTS.friendly;
  const firstName    = getUserFirstName(user);
  const progressPercent = ((currentBlock + 1) / activeBlocks.length) * 100;

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900">
        <div className="flex flex-col items-center gap-3 text-white/60">
          <div className="w-12 h-12 rounded-full bg-indigo-500/20 animate-pulse" />
          <p className="text-sm">Preparando tu Sync...</p>
        </div>
      </div>
    );
  }

  // Modo conversacional â€” pantalla completa de chat
  if (mode === 'conversational') {
    return (
      <ConversationalSyncScreen
        profile={profile}
        firstName={firstName}
        chatMessages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatLoading={chatLoading}
        chatReady={chatReady}
        chatSummary={chatSummary}
        onSend={sendChatMessage}
        onInit={initChat}
        onSave={saveSync}
        saving={saving}
        onBack={() => setMode(null)}
      />
    );
  }

  // Mode selection screen
  if (mode === null) {
    return (
      <ModeSelectionScreen
        settings={settings}
        profile={profile}
        firstName={firstName}
        texts={texts}
        tomorrowLoad={tomorrowLoad}
        tomorrowConflicts={tomorrowConflicts}
        hasIncomplete={todayIncompleteTasks.length > 0}
        onSelect={setMode}
      />
    );
  }

  const block   = activeBlocks[currentBlock];
  const isLast  = currentBlock === activeBlocks.length - 1;
  const isFirst = currentBlock === 0;

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={() => router.push('/')} className="text-white/40 hover:text-white/70 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-white/50 text-xs">
            {mode === 'quick' ? '⚡ Sync Rápido' : (mode as string) === 'conversational' ? '🤖 Conversacional' : '📖 Planificación Profunda'}
          </span>
          <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
            {currentBlock + 1}/{activeBlocks.length}
          </Badge>
        </div>
        <div className="w-5" />
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-indigo-400 to-purple-400 transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Block content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Block header */}
          <div className="flex items-center gap-3">
            <span className="text-4xl">{block.emoji}</span>
            <div>
              <h2 className="text-xl font-bold text-white">{block.title}</h2>
              <p className="text-white/40 text-sm">{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</p>
            </div>
          </div>

          {/* Block body */}
          {block.id === 'welcome'   && <WelcomeBlock firstName={firstName} texts={texts} profile={profile} mode={mode} />}
          {block.id === 'followup'  && (
            <FollowUpBlock
              todayIncompleteTasks={todayIncompleteTasks}
              rescheduledTasks={rescheduledTasks}
              skippedTasks={skippedTasks}
              onReschedule={rescheduleTask}
              onSkip={skipTask}
              mode={mode}
            />
          )}
          {block.id === 'shifts'    && <ShiftsBlock shifts={tomorrowShifts} settings={settings} />}
          {block.id === 'tasks'     && (
            <TasksBlock
              tasks={tomorrowTasks} setTasks={setTomorrowTasks}
              scoredTasks={scoredTasks} setScoredTasks={setScoredTasks}
              newTaskTitle={newTaskTitle} setNewTaskTitle={setNewTaskTitle}
              onAddTask={addTask} userId={user?.id} mode={mode}
              conflicts={tomorrowConflicts.filter(c => c.id === 'task-overload' || c.id === 'shift-tasks-combo')}
            />
          )}
          {block.id === 'shopping'  && (
            <ShoppingBlock
              items={shoppingItems} setItems={setShoppingItems}
              newItem={newShoppingItem} setNewItem={setNewShoppingItem}
              onAdd={addShoppingItem}
              userId={user?.id}
            />
          )}
          {block.id === 'medicines' && <MedicinesBlock medicines={medicines} />}
          {block.id === 'finances'  && (
            <FinancesBlock
              balance={totalBalance}
              plannedExpense={plannedExpense} setPlannedExpense={setPlannedExpense}
              notes={syncNotes} setNotes={setSyncNotes}
            />
          )}
          {block.id === 'victories' && (
            <VictoriesBlock
              todayTasks={todayTasks}
              victories={victories} setVictories={setVictories}
              newVictory={newVictory} setNewVictory={setNewVictory}
              onAdd={addVictory} texts={texts}
            />
          )}
          {block.id === 'done'      && (
            <DoneBlock
              firstName={firstName} texts={texts} profile={profile}
              tomorrowTasks={tomorrowTasks} shoppingItems={shoppingItems}
              tomorrowShifts={tomorrowShifts} balance={totalBalance}
              tomorrowLoad={tomorrowLoad}
              conflicts={tomorrowConflicts}
              rescheduledCount={rescheduledTasks.size}
              onSave={saveSync} saving={saving}
            />
          )}
        </div>
      </div>

      {/* Navigation footer */}
      {block.id !== 'done' && (
        <div className="p-4 border-t border-white/10 flex gap-3">
          {!isFirst && (
            <Button
              variant="ghost"
              onClick={prev}
              className="text-white/60 hover:text-white hover:bg-white/10 flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <Button
            onClick={next}
            className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold h-12 rounded-2xl"
          >
            {isLast ? 'Ver resumen' : 'Siguiente'}
            <ChevronRight className="w-5 h-5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

// â”€â”€ Sub-screens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ModeSelectionScreen({ settings, profile, firstName, texts, tomorrowLoad, tomorrowConflicts, hasIncomplete, onSelect }: any) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white p-6">
      <div className="flex flex-col items-center gap-6 max-w-sm w-full">
        <span className="text-7xl animate-bounce">{profile?.emoji ?? '🤖'}</span>
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">{texts.syncWelcome(firstName)}</h1>
          <p className="text-white/50 text-sm">¿Cómo quieres hacer el Sync de hoy?</p>
        </div>

        {/* Tomorrow load preview */}
        {tomorrowLoad && tomorrowLoad.level !== 'relaxed' && (
          <div className={`w-full p-3 rounded-xl ${tomorrowLoad.bgColor} border border-white/10 flex items-center gap-2`}>
            <span className="text-xl">{tomorrowLoad.emoji}</span>
            <div>
              <p className={`text-sm font-semibold ${tomorrowLoad.color}`}>{tomorrowLoad.label}</p>
              <p className="text-white/40 text-xs">MaÃ±ana tiene {tomorrowLoad.score}/100 de carga</p>
            </div>
          </div>
        )}

        {/* Critical conflicts preview */}
        {tomorrowConflicts.filter((c: any) => c.severity === 'critical').length > 0 && (
          <div className="w-full p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-red-300 text-xs font-bold uppercase tracking-wider mb-1.5">âš ï¸ Conflictos detectados</p>
            {tomorrowConflicts.filter((c: any) => c.severity === 'critical').map((c: any) => (
              <p key={c.id} className="text-white/60 text-xs">{c.emoji} {c.title}</p>
            ))}
          </div>
        )}

        {/* Pending tasks reminder */}
        {hasIncomplete && (
          <div className="w-full p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <p className="text-amber-200 text-xs">Tienes tareas de hoy sin completar. Puedes reajustarlas.</p>
          </div>
        )}

        <div className="w-full space-y-3">
          <button
            onClick={() => onSelect('quick')}
            className="w-full p-5 rounded-2xl bg-white/10 hover:bg-indigo-500/30 border border-white/10 hover:border-indigo-400/40 transition-all text-left group"
          >
            <div className="flex items-center gap-3 mb-1">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="font-semibold text-lg">Sync Rápido</span>
              <Badge className="bg-yellow-400/20 text-yellow-300 border-yellow-400/30 text-xs ml-auto">â‰ˆ 2 min</Badge>
            </div>
            <p className="text-white/50 text-sm">Revisa en 2 minutos lo que tienes mañana y confirma o cambia lo que necesites. Rápido y sin complicaciones.</p>
          </button>
          <button
            onClick={() => onSelect('deep')}
            className="w-full p-5 rounded-2xl bg-white/10 hover:bg-purple-500/30 border border-white/10 hover:border-purple-400/40 transition-all text-left group"
          >
            <div className="flex items-center gap-3 mb-1">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <span className="font-semibold text-lg">Planificación Profunda</span>
              <Badge className="bg-purple-400/20 text-purple-300 border-purple-400/30 text-xs ml-auto">Completo</Badge>
            </div>
            <p className="text-white/50 text-sm">Repasa con calma cada apartado: tareas, finanzas, compra y turnos. Perfecto cuando tienes unos minutos para organizarte bien.</p>
          </button>
          <button
            onClick={() => onSelect('conversational')}
            className="w-full p-5 rounded-2xl bg-white/10 hover:bg-green-500/20 border border-white/10 hover:border-green-400/40 transition-all text-left group"
          >
            <div className="flex items-center gap-3 mb-1">
              <span className="text-xl">🤖</span>
              <span className="font-semibold text-lg">Sync Conversacional</span>
              <Badge className="bg-green-400/20 text-green-300 border-green-400/30 text-xs ml-auto">IA</Badge>
            </div>
            <p className="text-white/50 text-sm">Habla con la IA de Quioba y ella organiza tu mañana por ti. Solo cuéntale cómo ha ido el día.</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function WelcomeBlock({ firstName, texts, profile, mode }: any) {
  return (
    <div className="space-y-4">
      <p className="text-white/70 text-lg leading-relaxed">
        {mode === 'quick'
          ? `Vas a revisar rÃ¡pidamente cada bloque. Si todo estÃ¡ bien, pulsa "Siguiente". Si no, edita lo que necesites.`
          : `Vamos a revisar todos los bloques y ajustar lo que necesites para que mañana salga perfecto.`}
      </p>
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-3">
        <span className="text-3xl">{profile?.emoji ?? '🤖'}</span>
        <div>
          <p className="font-semibold">{profile?.label ?? 'Quioba'}</p>
          <p className="text-white/50 text-sm">Tu secretaria/o personal</p>
        </div>
      </div>
    </div>
  );
}

// â”€â”€ Phase 2: Follow-Up Block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function FollowUpBlock({ todayIncompleteTasks, rescheduledTasks, skippedTasks, onReschedule, onSkip, mode }: any) {
  const pending = todayIncompleteTasks.filter(
    (t: any) => !rescheduledTasks.has(t.id) && !skippedTasks.has(t.id)
  );
  const done    = rescheduledTasks.size;
  const skipped = skippedTasks.size;

  if (todayIncompleteTasks.length === 0) {
    return (
      <div className="space-y-3">
        <div className="p-5 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
          <span className="text-4xl">ðŸŽ‰</span>
          <p className="text-green-300 font-bold mt-2">Â¡Cumpliste todo lo de hoy!</p>
          <p className="text-white/50 text-sm mt-1">No quedan tareas pendientes. MagnÃ­fico.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-white/70 text-base">
        Tienes <span className="text-amber-300 font-bold">{todayIncompleteTasks.length} tarea{todayIncompleteTasks.length > 1 ? 's' : ''}</span> de hoy sin completar.
        Decide quÃ© hacer con cada una:
      </p>

      <div className="space-y-2">
        {pending.map((task: any) => (
          <div key={task.id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
            <p className="text-sm font-medium">{task.title}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => onReschedule(task)}
                className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/40 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs h-9"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Pasar a mañana
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSkip(task.id)}
                className="text-white/30 hover:text-white/60 rounded-xl text-xs h-9 px-3"
              >
                <SkipForward className="w-3.5 h-3.5 mr-1" />
                Descartar
              </Button>
            </div>
          </div>
        ))}
      </div>

      {(done > 0 || skipped > 0) && (
        <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-white/40 flex gap-4">
          {done > 0    && <span>✅ {done} pospuesta{done > 1 ? 's' : ''} a mañana</span>}
          {skipped > 0 && <span>ðŸ—‘ï¸ {skipped} descartada{skipped > 1 ? 's' : ''}</span>}
        </div>
      )}

      {pending.length === 0 && todayIncompleteTasks.length > 0 && (
        <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-green-300 font-semibold">Todo gestionado ðŸ‘</p>
          <p className="text-white/40 text-sm mt-1">Pulsa Siguiente para continuar.</p>
        </div>
      )}
    </div>
  );
}

function ShiftsBlock({ shifts, settings }: any) {
  const tomorrow = addDays(new Date(), 1);
  if (!settings.modules.shifts) {
    return <p className="text-white/40 italic">MÃ³dulo de turnos desactivado.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-white/60 text-sm">
        Tu turno para el {format(tomorrow, "EEEE d 'de' MMMM", { locale: es })}:
      </p>
      {shifts.length > 0 ? (
        shifts.map((s: any) => (
          <div key={s.id} className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <p className="font-semibold text-blue-300">{s.title}</p>
            <p className="text-white/60 text-sm flex items-center gap-1 mt-1">
              <Clock className="w-3.5 h-3.5" />
              {format(new Date(s.start_time), 'HH:mm')} â€“ {format(new Date(s.end_time), 'HH:mm')}
            </p>
          </div>
        ))
      ) : (
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-white/50 text-sm italic">
          Sin turno asignado para mañana. âœ¨ DÃ­a libre.
        </div>
      )}
    </div>
  );
}

function TasksBlock({ tasks, setTasks, scoredTasks, setScoredTasks, newTaskTitle, setNewTaskTitle, onAddTask, userId, mode, conflicts }: any) {
  const removeTask = async (id: string) => {
    await supabase.from('tasks').delete().eq('id', id);
    const newTasks = tasks.filter((t: any) => t.id !== id);
    setTasks(newTasks);
    setScoredTasks(scoreTaskPriority(newTasks));
  };

  // Usar scoredTasks si disponible, si no renderizar tasks sin puntaje
  const displayTasks: TaskWithScore[] = scoredTasks?.length > 0
    ? scoredTasks
    : tasks.map((t: any) => ({ task: t, score: 0, level: 'normal', levelLabel: 'Normal', levelEmoji: 'âšª', levelColor: 'text-white/40', levelBg: 'bg-white/5 border-white/10', daysUntilDue: null }));

  return (
    <div className="space-y-3">
      {/* Conflict warning */}
      {conflicts && conflicts.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-200 text-xs">{conflicts[0].detail}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-white/60 text-sm">Tareas previstas para mañana:</p>
        {displayTasks.length > 0 && (
          <span className="text-white/30 text-xs">ordenadas por prioridad</span>
        )}
      </div>
      {displayTasks.length === 0 ? (
        <p className="text-white/40 italic text-sm">No hay tareas para mañana.</p>
      ) : (
        <div className="space-y-2">
          {displayTasks.map(({ task: t, levelEmoji, levelLabel, levelColor, levelBg, daysUntilDue }) => (
            <div key={t.id} className={`flex items-center gap-3 p-3 rounded-xl border ${levelBg}`}>
              <span className="text-base flex-shrink-0">{levelEmoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.title}</p>
                {daysUntilDue !== null && (
                  <p className={`text-xs mt-0.5 ${levelColor}`}>
                    {daysUntilDue <= 0 ? 'âš ï¸ Vence hoy' : daysUntilDue === 1 ? 'Vence mañana' : `En ${daysUntilDue} días`}
                  </p>
                )}
              </div>
              <Badge className={`text-[10px] flex-shrink-0 border ${levelBg} ${levelColor}`}>{levelLabel}</Badge>
              <button onClick={() => removeTask(t.id)} className="text-white/20 hover:text-red-400 transition-colors flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAddTask()}
          placeholder="AÃ±adir tarea rÃ¡pida..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
        />
        <Button onClick={onAddTask} className="bg-indigo-500 hover:bg-indigo-600 rounded-xl flex-shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function ShoppingBlock({ items, setItems, newItem, setNewItem, onAdd, userId }: any) {
  const removeItem = async (id: string) => {
    await supabase.from('shopping_items').delete().eq('id', id);
    setItems((prev: any[]) => prev.filter(i => i.id !== id));
  };

  const currentNames = items.map((i: any) => i.name);
  const { suggestions, confidenceLevel, dataWeeks, loading: predLoading } = usePredictiveShopping(userId, currentNames);

  const addSuggestion = async (name: string) => {
    const { data, error } = await supabase.from('shopping_items')
      .insert({ user_id: userId, name, is_checked: false })
      .select().single();
    if (!error && data) setItems((prev: any[]) => [...prev, data]);
  };

  return (
    <div className="space-y-4">
      <p className="text-white/60 text-sm">Lista de la compra pendiente ({items.length} ítems):</p>
      {items.length === 0 ? (
        <p className="text-white/40 italic text-sm">La lista estÃ¡ vacÃ­a. ðŸŽ‰</p>
      ) : (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
              <ShoppingCart className="w-4 h-4 text-orange-400 flex-shrink-0" />
              <span className="flex-1 text-sm">{item.name}</span>
              <button onClick={() => removeItem(item.id)} className="text-white/20 hover:text-red-400 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="AÃ±adir Ã­tem..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
        />
        <Button onClick={onAdd} className="bg-orange-500 hover:bg-orange-600 rounded-xl flex-shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Fase 4.4 â€” Sugerencias predictivas */}
      {!predLoading && suggestions.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-white/10">
          <div className="flex items-center gap-2">
            <p className="text-white/40 text-xs uppercase tracking-wider">ðŸ’¡ Sugerencias recurrentes</p>
            {confidenceLevel === 'low' && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">âš ï¸ Confianza baja</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.slice(0, 6).map((s, i) => (
              <button
                key={i}
                onClick={() => addSuggestion(s.name)}
                className="px-3 py-1.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-200 text-xs hover:bg-orange-500/20 transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3 h-3" />
                {s.name}
                <span className="text-orange-400/60">Ã—{s.frequency}</span>
              </button>
            ))}
          </div>
          {dataWeeks > 0 && (
            <p className="text-white/20 text-[10px]">{dataWeeks} semanas de historial</p>
          )}
        </div>
      )}
    </div>
  );
}

function MedicinesBlock({ medicines }: any) {
  return (
    <div className="space-y-3">
      <p className="text-white/60 text-sm">Tu medicaciÃ³n diaria programada:</p>
      {medicines.length === 0 ? (
        <p className="text-white/40 italic text-sm">Sin tomas programadas.</p>
      ) : (
        <div className="space-y-2">
          {medicines.map((med: any) => (
            <div key={med.id} className="p-4 rounded-2xl bg-pink-500/10 border border-pink-500/20">
              <p className="font-semibold text-pink-300">{med.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {med.alarm_times?.map((time: string, i: number) => (
                  <Badge key={i} className="bg-pink-500/20 text-pink-200 border-pink-500/30 text-xs">
                    {time}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-white/30 text-xs italic">Solo informativo â€” edita la medicaciÃ³n desde Mi Hogar.</p>
    </div>
  );
}

function FinancesBlock({ balance, plannedExpense, setPlannedExpense, notes, setNotes }: any) {
  const low = balance < 200;
  const negative = balance < 0;
  return (
    <div className="space-y-4">
      <div className={`p-5 rounded-2xl border text-center ${negative ? 'bg-red-500/10 border-red-500/20' : low ? 'bg-amber-500/10 border-amber-500/20' : 'bg-green-500/10 border-green-500/20'}`}>
        <p className="text-white/50 text-sm">Saldo total disponible</p>
        <p className={`text-4xl font-extrabold mt-1 ${negative ? 'text-red-300' : low ? 'text-amber-300' : 'text-green-300'}`}>
          {balance.toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}€
        </p>
        {low && !negative && <p className="text-amber-400 text-xs mt-1">âš ï¸ Saldo bajo</p>}
        {negative && <p className="text-red-400 text-xs mt-1">ðŸš¨ Saldo negativo</p>}
      </div>
      <div className="space-y-2">
        <label className="text-white/60 text-sm">Â¿Tienes algÃºn gasto fuerte previsto mañana?</label>
        <Input
          type="number"
          value={plannedExpense}
          onChange={e => setPlannedExpense(e.target.value)}
          placeholder="0€"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
        />
        {plannedExpense && parseFloat(plannedExpense) > balance * 0.5 && (
          <p className="text-amber-400 text-xs flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Esto supera el 50% de tu saldo disponible.
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label className="text-white/60 text-sm">Notas adicionales (opcional)</label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Apunta cualquier cosa relevante..."
          rows={3}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl resize-none"
        />
      </div>
    </div>
  );
}

function VictoriesBlock({ todayTasks, victories, setVictories, newVictory, setNewVictory, onAdd, texts }: any) {
  return (
    <div className="space-y-4">
      <p className="text-white/70 text-base">{texts.victoriesPrompt}</p>

      {todayTasks.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">Tareas completadas hoy</p>
          {todayTasks.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-green-500/10 border border-green-500/20">
              <Check className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-200">{t.title}</span>
            </div>
          ))}
        </div>
      )}

      {victories.length > 0 && (
        <div className="space-y-2">
          <p className="text-white/40 text-xs uppercase tracking-wider">Tus victorias</p>
          {victories.map((v: string, i: number) => (
            <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="flex-1 text-sm text-yellow-200">{v}</span>
              <button onClick={() => setVictories((prev: string[]) => prev.filter((_, idx) => idx !== i))}
                className="text-white/20 hover:text-red-400">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          value={newVictory}
          onChange={e => setNewVictory(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && onAdd()}
          placeholder="Escribe una victoria libre..."
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 rounded-xl"
        />
        <Button onClick={onAdd} className="bg-yellow-500 hover:bg-yellow-600 rounded-xl flex-shrink-0">
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

function DoneBlock({ firstName, texts, profile, tomorrowTasks, shoppingItems, tomorrowShifts, balance, tomorrowLoad, conflicts, rescheduledCount, onSave, saving }: any) {
  const criticals = (conflicts || []).filter((c: any) => c.severity === 'critical');
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <span className="text-6xl">{profile?.emoji ?? 'ðŸŽ‰'}</span>
        <p className="text-xl font-bold text-white mt-2">{texts.confirmationMessage}</p>
      </div>

      {/* Tomorrow load summary */}
      {tomorrowLoad && (
        <div className={`p-3 rounded-xl ${tomorrowLoad.bgColor} border border-white/10 flex items-center gap-2`}>
          <span className="text-xl">{tomorrowLoad.emoji}</span>
          <div>
            <p className={`text-sm font-bold ${tomorrowLoad.color}`}>{tomorrowLoad.label}</p>
            <p className="text-white/40 text-xs">MaÃ±ana: {tomorrowTasks.length} tareas{tomorrowShifts.length > 0 ? ' + turno' : ''}</p>
          </div>
        </div>
      )}

      {/* Critical conflicts reminder */}
      {criticals.length > 0 && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20">
          <p className="text-red-300 text-xs font-bold uppercase tracking-wider mb-1">Recuerda mañana:</p>
          {criticals.map((c: any) => (
            <p key={c.id} className="text-white/60 text-xs">{c.emoji} {c.title}</p>
          ))}
        </div>
      )}

      {rescheduledCount > 0 && (
        <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-indigo-400" />
          <p className="text-indigo-300 text-sm">{rescheduledCount} tarea{rescheduledCount > 1 ? 's' : ''} reajustada{rescheduledCount > 1 ? 's' : ''} a mañana</p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/10">
        <SummaryRow emoji="ðŸ’¼" label="Turnos mañana" value={tomorrowShifts.length > 0 ? tomorrowShifts[0].title : 'Libre'} />
        <SummaryRow emoji="✅" label="Tareas mañana" value={`${tomorrowTasks.length} pendientes`} />
        <SummaryRow emoji="ðŸ›’" label="Lista compra" value={`${shoppingItems.length} ítems`} />
        <SummaryRow emoji="ðŸ’¶" label="Saldo" value={`${balance.toLocaleString('es-ES', { maximumFractionDigits: 0 })}€`} />
      </div>

      <Button
        onClick={onSave}
        disabled={saving}
        className="w-full h-14 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-lg rounded-2xl shadow-lg shadow-indigo-500/20"
      >
        {saving ? 'Guardando...' : '✅ Guardar y cerrar Sync'}
      </Button>
    </div>
  );
}

function SummaryRow({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3.5">
      <div className="flex items-center gap-2 text-white/60 text-sm">
        <span>{emoji}</span>
        <span>{label}</span>
      </div>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

// â”€â”€ Fase 4.3: Pantalla de Sync Conversacional â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ConversationalSyncScreen({
  profile, firstName, chatMessages, chatInput, setChatInput,
  chatLoading, chatReady, chatSummary, onSend, onInit, onSave, saving, onBack,
}: any) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatMessages.length === 0) onInit();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white">

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button onClick={onBack} className="text-white/40 hover:text-white/70">
          <X className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{profile?.emoji ?? '🤖'}</span>
          <span className="text-white/60 text-sm font-medium">Sync Conversacional</span>
          <Badge className="bg-green-400/20 text-green-300 border-green-400/30 text-xs">IA</Badge>
        </div>
        <div className="w-5" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 && chatLoading && (
          <div className="flex items-center gap-2 p-4">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg flex-shrink-0">
              {profile?.emoji ?? '🤖'}
            </div>
            <div className="flex gap-1 px-3 py-2 rounded-2xl bg-white/10">
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {chatMessages.map((msg: any, i: number) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg flex-shrink-0">
                {profile?.emoji ?? '🤖'}
              </div>
            )}
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-500 text-white rounded-br-none'
                : 'bg-white/10 text-white/90 rounded-bl-none'
            }`}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {chatLoading && chatMessages.length > 0 && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-lg flex-shrink-0">
              {profile?.emoji ?? '🤖'}
            </div>
            <div className="flex gap-1 px-3 py-2 rounded-2xl bg-white/10">
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Resumen final */}
        {chatReady && chatSummary && (
          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
            <p className="text-green-300 text-xs font-bold uppercase tracking-wider mb-2">✅ Resumen del día listo</p>
            <p className="text-white/80 text-sm">{chatSummary}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      {chatMessages.length > 0 && !chatReady && !chatLoading && (
        <div className="px-4 flex gap-2 flex-wrap">
          {['Todo bien por Aquí ðŸ‘', 'Tengo algo mÃ¡s que añadir', 'Listo para cerrar el sync'].map((s) => (
            <button
              key={s}
              onClick={() => onSend(s)}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white/60 hover:text-white text-xs transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      {!chatReady ? (
        <div className="p-4 border-t border-white/10 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSend()}
            placeholder="Escribe Aquí..."
            disabled={chatLoading}
            className="flex-1 bg-white/10 border border-white/20 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-400/50 disabled:opacity-50"
          />
          <Button
            onClick={() => onSend()}
            disabled={chatLoading || !chatInput.trim()}
            className="bg-indigo-500 hover:bg-indigo-600 rounded-xl px-4"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="p-4 border-t border-white/10">
          <Button
            onClick={onSave}
            disabled={saving}
            className="w-full h-14 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-800 hover:to-teal-700 text-white font-bold text-base rounded-2xl shadow-lg shadow-green-500/20"
          >
            {saving ? 'Guardando...' : '✅ Guardar Sync Conversacional'}
          </Button>
        </div>
      )}
    </div>
  );
}



