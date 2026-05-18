'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { X, CalendarDays, Calendar, Zap, BookOpen, Trophy, ChevronDown, ChevronUp, Filter } from 'lucide-react';

// ─── Sync Archive ─────────────────────────────────────────────────────────────

type SyncType = 'daily' | 'weekly' | 'monthly';
type FilterType = 'all' | SyncType;

const TYPE_CONFIG: Record<SyncType, { label: string; color: string; bg: string; border: string; icon: React.ElementType; emoji: string }> = {
  daily: { label: 'Diario', color: 'text-indigo-300', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', icon: Zap, emoji: '🌙' },
  weekly: { label: 'Semanal', color: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: CalendarDays, emoji: '📅' },
  monthly: { label: 'Mensual', color: 'text-purple-300', bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: Calendar, emoji: '📆' },
};

export default function SecretariaArchivoPage() {
  const router = useRouter();
  const [syncs, setSyncs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => { loadSyncs(); }, []);

  const loadSyncs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data } = await supabase
        .from('secretary_syncs')
        .select('*')
        .eq('user_id', user.id)
        .order('sync_date', { ascending: false })
        .limit(60);

      setSyncs(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const filtered = filter === 'all' ? syncs : syncs.filter(s => s.sync_type === filter);

  // Group by month
  const grouped: Record<string, any[]> = {};
  filtered.forEach(s => {
    const key = format(parseISO(s.sync_date), 'MMMM yyyy', { locale: es });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  });

  const totalByType = (type: SyncType) => syncs.filter(s => s.sync_type === type).length;

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
      <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-indigo-950/80 backdrop-blur-md z-10">
        <button onClick={() => router.push('/apps/organizador')} className="text-white/40 hover:text-white/70 transition-colors">
          <X className="w-5 h-5" />
        </button>
        <h1 className="font-bold text-sm">Archivo de Syncs</h1>
        <div className="w-5" />
      </div>

      <div className="flex-1 overflow-y-auto">

        {/* Stats header */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(['daily', 'weekly', 'monthly'] as SyncType[]).map(type => {
              const cfg = TYPE_CONFIG[type];
              const cnt = totalByType(type);
              return (
                <div key={type} className={`p-3 rounded-2xl ${cfg.bg} border ${cfg.border} text-center`}>
                  <p className="text-2xl mb-1">{cfg.emoji}</p>
                  <p className={`text-xl font-bold ${cfg.color}`}>{cnt}</p>
                  <p className="text-white/40 text-xs">{cfg.label}{cnt !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>

          {/* Filter pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(['all', 'daily', 'weekly', 'monthly'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filter === f
                    ? 'bg-white text-slate-900 border-white'
                    : 'bg-white/10 text-white/60 border-white/10 hover:bg-white/20'
                  }`}
              >
                {f === 'all' ? 'Todos' : TYPE_CONFIG[f].label}
                {f !== 'all' && filter !== f && <span className="ml-1 text-white/40">({totalByType(f)})</span>}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped sync list */}
        {Object.keys(grouped).length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <span className="text-5xl">📭</span>
            <p className="text-white/40">No hay syncs en el archivo todavía.</p>
            <p className="text-white/20 text-sm">Completa tu primer Sync para verlo aquí.</p>
          </div>
        ) : (
          <div className="px-5 pb-8 space-y-6">
            {Object.entries(grouped).map(([month, items]) => (
              <div key={month}>
                <p className="text-white/30 text-xs uppercase tracking-widest font-bold mb-3 capitalize">{month}</p>
                <div className="space-y-2">
                  {items.map(sync => {
                    const cfg = TYPE_CONFIG[(sync.sync_type || 'daily') as SyncType];
                    const isExp = expanded.has(sync.id);
                    const victories = sync.victories as string[] | null;
                    const hasDetails = !!sync.notes || (victories && victories.length > 0) || !!sync.planned_expenses;

                    return (
                      <div key={sync.id} className={`rounded-2xl ${cfg.bg} border ${cfg.border} overflow-hidden`}>
                        <button
                          onClick={() => hasDetails && toggleExpand(sync.id)}
                          className="w-full flex items-center gap-3 p-4 text-left"
                        >
                          <span className="text-xl flex-shrink-0">{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={`text-sm font-semibold ${cfg.color}`}>
                                {format(parseISO(sync.sync_date), "EEEE d", { locale: es })}
                              </p>
                              <Badge className={`text-[10px] ${cfg.bg} ${cfg.color} border-0`}>{cfg.label}</Badge>
                              {sync.mode && (
                                <Badge className="text-[10px] bg-white/5 text-white/30 border-0">
                                  {sync.mode === 'quick' ? '⚡' : '📖'}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              {victories && victories.length > 0 && (
                                <span className="text-xs text-yellow-300 flex items-center gap-1">
                                  <Trophy className="w-3 h-3" />{victories.length}
                                </span>
                              )}
                              {sync.planned_expenses && (
                                <span className="text-xs text-white/40">{sync.planned_expenses}€ planeado</span>
                              )}
                              {sync.completed_tasks_count != null && (
                                <span className="text-xs text-green-300">✅ {sync.completed_tasks_count} tareas</span>
                              )}
                            </div>
                          </div>
                          {hasDetails && (
                            isExp ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" />
                              : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />
                          )}
                        </button>

                        {isExp && (
                          <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-3">
                            {victories && victories.length > 0 && (
                              <div className="space-y-1.5">
                                <p className="text-xs text-white/30 uppercase tracking-wider">Victorias</p>
                                {victories.map((v, i) => (
                                  <div key={i} className="flex items-center gap-2 text-sm">
                                    <span className="text-yellow-400">🏆</span>
                                    <span className="text-yellow-200">{v}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {sync.notes && (
                              <div className="space-y-1">
                                <p className="text-xs text-white/30 uppercase tracking-wider">Notas</p>
                                <p className="text-sm text-white/60 italic">"{sync.notes}"</p>
                              </div>
                            )}
                            {sync.savings_achieved != null && (
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-white/40">Ahorro del mes</span>
                                <span className={sync.savings_achieved >= 0 ? 'text-green-300 font-bold' : 'text-red-300 font-bold'}>
                                  {sync.savings_achieved >= 0 ? '+' : ''}{sync.savings_achieved}€
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

