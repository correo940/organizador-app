// ──────────────────────────────────────────────────────────────────────────────
// Quioba Secretaria — Motor de Inteligencia (Fases 2 + 4)
// ──────────────────────────────────────────────────────────────────────────────

// ── Task Priority Scoring (Fase 4.1) ─────────────────────────────────────────

export type PriorityLevel = 'critical' | 'high' | 'medium' | 'normal';

export interface TaskWithScore {
  task: any;
  score: number;
  level: PriorityLevel;
  levelLabel: string;
  levelEmoji: string;
  levelColor: string;  // tailwind text color
  levelBg: string;     // tailwind bg color
  daysUntilDue: number | null;
}

/**
 * Puntúa una lista de tareas según urgencia, prioridad declarada y complejidad.
 * Lógica local — sin llamadas a ninguna API.
 *
 * Factores:
 *  +50  — vence HOY
 *  +30  — vence MAÑANA
 *  +15  — vence en 2-3 días
 *  +5   — vence en 4-7 días
 *  +25  — campo priority === 'urgent' | 'high'
 *  +10  — campo priority === 'medium'
 *  +5   — tiene descripción (señal de complejidad)
 *  -10  — sin fecha de vencimiento (no se puede priorizar)
 */
export function scoreTaskPriority(tasks: any[]): TaskWithScore[] {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const scored: TaskWithScore[] = tasks.map(task => {
    let score = 0;
    let daysUntilDue: number | null = null;

    // ── Factor 1: días hasta vencimiento ─────────────────────────────
    if (task.due_date) {
      const due = new Date(task.due_date);
      due.setHours(0, 0, 0, 0);
      daysUntilDue = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue <= 0)  score += 50; // vence hoy o pasado
      else if (daysUntilDue === 1) score += 30;
      else if (daysUntilDue <= 3) score += 15;
      else if (daysUntilDue <= 7) score += 5;
    } else {
      score -= 10; // sin fecha — prioridad baja por defecto
    }

    // ── Factor 2: campo priority declarado ───────────────────────────
    const prio = (task.priority ?? '').toLowerCase();
    if (prio === 'urgent' || prio === 'high') score += 25;
    else if (prio === 'medium') score += 10;

    // ── Factor 3: tiene descripción (tarea compleja) ──────────────────
    if (task.description?.trim()) score += 5;

    // ── Clasificar nivel ─────────────────────────────────────────────
    let level: PriorityLevel;
    if (score >= 50)      level = 'critical';
    else if (score >= 30) level = 'high';
    else if (score >= 15) level = 'medium';
    else                  level = 'normal';

    const meta = PRIORITY_META[level];

    return { task, score, level, daysUntilDue, ...meta };
  });

  // Ordenar de mayor a menor puntuación
  return scored.sort((a, b) => b.score - a.score);
}

const PRIORITY_META: Record<PriorityLevel, { levelLabel: string; levelEmoji: string; levelColor: string; levelBg: string }> = {
  critical: { levelLabel: 'Crítica',  levelEmoji: '🔴', levelColor: 'text-red-300',    levelBg: 'bg-red-500/15 border-red-500/25'    },
  high:     { levelLabel: 'Alta',     levelEmoji: '🟠', levelColor: 'text-orange-300', levelBg: 'bg-orange-500/15 border-orange-500/25' },
  medium:   { levelLabel: 'Media',    levelEmoji: '🟡', levelColor: 'text-amber-300',  levelBg: 'bg-amber-500/15 border-amber-500/25'  },
  normal:   { levelLabel: 'Normal',   levelEmoji: '⚪', levelColor: 'text-white/40',   levelBg: 'bg-white/5 border-white/10'           },
};

/**
 * Devuelve las N tareas con mayor puntuación de prioridad.
 * Ideal para el Briefing matutino.
 */
export function getTopPriorityTasks(tasks: any[], limit = 3): TaskWithScore[] {
  return scoreTaskPriority(tasks).slice(0, limit);
}

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export interface DayConflict {
  id: string;
  severity: ConflictSeverity;
  emoji: string;
  title: string;
  detail: string;
}

export interface DayLoad {
  level: 'relaxed' | 'moderate' | 'heavy' | 'overloaded';
  score: number; // 0-100
  label: string;
  emoji: string;
  color: string; // tailwind text color
  bgColor: string;
}

// ── Conflict Detection ─────────────────────────────────────────────────────────

export function detectConflicts(data: {
  tasks: any[];
  shifts: any[];
  balance: number;
  plannedExpense?: number;
  medicines: any[];
  budgetThreshold?: number; // e.g. 500
}): DayConflict[] {
  const conflicts: DayConflict[] = [];
  const { tasks, shifts, balance, plannedExpense, medicines, budgetThreshold = 200 } = data;

  // 1. Saldo bajo
  if (balance < budgetThreshold && balance >= 0) {
    conflicts.push({
      id: 'low-balance',
      severity: 'warning',
      emoji: '💰',
      title: 'Saldo bajo',
      detail: `Solo te quedan ${balance.toFixed(0)}€. Revisa tus gastos antes de mañana.`,
    });
  }
  if (balance < 0) {
    conflicts.push({
      id: 'negative-balance',
      severity: 'critical',
      emoji: '🚨',
      title: 'Saldo negativo',
      detail: `Tu saldo está en ${balance.toFixed(0)}€. Es urgente revisar tus finanzas.`,
    });
  }

  // 2. Gasto planeado > 50% del saldo
  if (plannedExpense && balance > 0 && plannedExpense > balance * 0.5) {
    conflicts.push({
      id: 'high-planned-expense',
      severity: 'warning',
      emoji: '📉',
      title: 'Gasto importante mañana',
      detail: `Tienes planeado gastar ${plannedExpense.toFixed(0)}€, más del 50% de tu saldo disponible.`,
    });
  }

  // 3. Sobrecarga de tareas (más de 5 en un día)
  if (tasks.length >= 6) {
    conflicts.push({
      id: 'task-overload',
      severity: 'warning',
      emoji: '😤',
      title: 'Día muy cargado',
      detail: `Tienes ${tasks.length} tareas para mañana. Considera aplazar algunas.`,
    });
  }

  // 4. Turno + muchas tareas (combo agotador)
  if (shifts.length > 0 && tasks.length >= 4) {
    conflicts.push({
      id: 'shift-tasks-combo',
      severity: 'info',
      emoji: '⚡',
      title: 'Turno + tareas',
      detail: `Trabajas mañana y además tienes ${tasks.length} tareas. ¿Seguro que es viable todo?`,
    });
  }

  // 5. Turnos solapados (mismo día, horas que se cruzan)
  if (shifts.length >= 2) {
    const sorted = [...shifts].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = new Date(sorted[i].end_time).getTime();
      const nextStart = new Date(sorted[i + 1].start_time).getTime();
      if (currentEnd > nextStart) {
        conflicts.push({
          id: `overlap-${i}`,
          severity: 'critical',
          emoji: '🔴',
          title: 'Turnos solapados',
          detail: `"${sorted[i].title}" y "${sorted[i + 1].title}" se solapan en horario.`,
        });
      }
    }
  }

  // 6. Medicación próxima a caducar (< 3 días)
  const now = new Date();
  medicines.forEach((m: any) => {
    if (!m.expiration_date) return;
    const days = Math.ceil(
      (new Date(m.expiration_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (days >= 0 && days <= 3) {
      conflicts.push({
        id: `med-expiry-${m.id}`,
        severity: days === 0 ? 'critical' : 'warning',
        emoji: '💊',
        title: `${m.name} caduca ${days === 0 ? 'HOY' : `en ${days} día${days === 1 ? '' : 's'}`}`,
        detail: 'Recuerda renovar la medicación.',
      });
    }
  });

  return conflicts;
}

// ── Day Load Calculator ────────────────────────────────────────────────────────

export function calculateDayLoad(data: {
  tasks: any[];
  shifts: any[];
  medicines: any[];
  conflicts: DayConflict[];
}): DayLoad {
  const { tasks, shifts, medicines, conflicts } = data;

  // Score factors (0-100)
  let score = 0;
  score += Math.min(tasks.length * 10, 40);           // hasta 40pts por tareas
  score += shifts.length > 0 ? 25 : 0;               // 25pts si hay turno
  score += medicines.length > 2 ? 10 : 0;            // 10pts si muchas tomas
  score += conflicts.filter(c => c.severity === 'critical').length * 15; // 15pts por crítico
  score += conflicts.filter(c => c.severity === 'warning').length * 5;   // 5pts por warning
  score = Math.min(score, 100);

  if (score <= 20) return { level: 'relaxed',    score, label: 'Día tranquilo',       emoji: '😌', color: 'text-green-400', bgColor: 'bg-green-500/10' };
  if (score <= 45) return { level: 'moderate',   score, label: 'Día equilibrado',     emoji: '🙂', color: 'text-blue-400',    bgColor: 'bg-blue-500/10'    };
  if (score <= 70) return { level: 'heavy',      score, label: 'Día cargado',         emoji: '😤', color: 'text-amber-400',  bgColor: 'bg-amber-500/10'   };
  return              { level: 'overloaded', score, label: 'Día muy cargado 🔥',   emoji: '🔥', color: 'text-red-400',    bgColor: 'bg-red-500/10'     };
}

// ── Budget Deviation Checker ──────────────────────────────────────────────────
// Compara el gasto planificado en el Sync nocturno con el gasto real del día

export interface BudgetDeviation {
  deviated: boolean;
  plannedExpense: number;
  currentDayExpense: number;
  overshoot: number;
  message: string;
}

export function checkBudgetDeviation(
  plannedExpense: number,
  currentDayExpense: number
): BudgetDeviation {
  const overshoot = currentDayExpense - plannedExpense;
  const deviated = overshoot > 0 && plannedExpense > 0;
  const percent = plannedExpense > 0 ? Math.round((overshoot / plannedExpense) * 100) : 0;

  return {
    deviated,
    plannedExpense,
    currentDayExpense,
    overshoot,
    message: deviated
      ? `Te has pasado ${overshoot.toFixed(0)}€ del presupuesto planeado (${percent}% más).`
      : `Dentro del presupuesto. Vas bien.`,
  };
}

// ── Nocturnal Auto-Reschedule ─────────────────────────────────────────────────
// Detecta qué tareas de hoy NO se completaron y sugiere reajustarlas a mañana

export function getPendingRescheduleItems(
  todayTasks: any[],
  completedTaskIds: Set<string>
): any[] {
  return todayTasks.filter(t => !completedTaskIds.has(t.id) && !t.is_completed);
}

