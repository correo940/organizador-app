
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
    addDays,
    endOfWeek,
    format,
    isBefore,
    isToday,
    isTomorrow,
    isWithinInterval,
    startOfDay,
} from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Bell,
    BellOff,
    Calendar as CalendarIcon,
    Camera,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    Circle,
    Clock,
    FileText,
    Filter,
    Loader2,
    Lock,
    Pencil,
    Plus,
    Search,
    Trash2,
    Users,
    X,
} from 'lucide-react';
import { toast } from 'sonner';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { supabase } from '@/lib/supabase';
import { usePostItSettings } from '@/context/PostItSettingsContext';
import PostItConfig from './post-it-config';
import ScreenshotToTaskDialog from './screenshot-to-task-dialog';
import { ShareTasksDialog } from './share-tasks-dialog';
import { TaskList, TaskListSelector } from './task-list-selector';

type TaskPriority = 'high' | 'medium' | 'low';
type TaskView = 'today' | 'upcoming' | 'week' | 'all';
type TaskFilter = 'all' | 'pending' | 'completed' | 'overdue' | 'alarm' | 'unassigned';

type Task = {
    id: string;
    title: string;
    notes?: string;
    description?: string;
    date: string;
    time: string;
    hasAlarm: boolean;
    completed: boolean;
    assignedTo?: string | null;
    priority: TaskPriority;
    assignee?: {
        full_name: string;
        avatar_url: string;
    } | null;
};

type ListMember = {
    user_id: string;
    role: string;
    profile: {
        full_name: string;
        avatar_url: string;
    };
};

type TaskSection = {
    key: string;
    title: string;
    description: string;
    tasks: Task[];
};

const DEFAULT_PRIORITY: TaskPriority = 'medium';
const DOCUMENT_TASK_PREFIX = '[QUIOBA_DOCUMENT]';

function sortTasks(items: Task[]) {
    return [...items].sort((a, b) => {
        const dateCompare = new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime();
        if (dateCompare !== 0) return dateCompare;
        const priorityWeight: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 };
        return priorityWeight[a.priority] - priorityWeight[b.priority];
    });
}

function parseTaskDescription(notes?: string) {
    const lines = (notes || '').split('\n');
    const noteLines: string[] = [];
    const subtaskLines: string[] = [];

    lines.forEach((line) => {
        if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
            subtaskLines.push(line.replace(/^- \[[ x]\] /, ''));
        } else if (line.trim()) {
            noteLines.push(line);
        }
    });

    return { notes: noteLines.join('\n').trim(), subtasks: subtaskLines };
}

function buildTaskDescription(notes: string, subtasks: string[]) {
    const subtasksString = subtasks.filter((item) => item.trim() !== '').map((item) => `- [ ] ${item}`).join('\n');
    return [notes.trim(), subtasksString].filter(Boolean).join('\n\n');
}

function isDocumentTask(task: Task) {
    return String(task.description || task.notes || '').startsWith(DOCUMENT_TASK_PREFIX);
}

function getTaskDate(task: Task) {
    return new Date(`${task.date}T${task.time}`);
}

function getTaskDay(task: Task) {
    return startOfDay(getTaskDate(task));
}

function getTaskTone(task: Task) {
    if (task.completed) return 'completed';
    if (isBefore(getTaskDay(task), startOfDay(new Date()))) return 'overdue';
    if (isToday(getTaskDate(task))) return 'today';
    if (isTomorrow(getTaskDate(task))) return 'tomorrow';
    return 'upcoming';
}

function getPriorityLabel(priority: TaskPriority) {
    if (priority === 'high') return 'Alta';
    if (priority === 'low') return 'Baja';
    return 'Media';
}

function getPriorityClasses(priority: TaskPriority) {
    if (priority === 'high') return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300';
    if (priority === 'low') return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300';
}

function formatTaskMoment(task: Task) {
    return format(getTaskDate(task), "EEE d MMM, HH:mm", { locale: es });
}

function getSectionEmptyMessage(taskView: TaskView, taskFilter: TaskFilter) {
    if (taskFilter === 'completed') return 'No hay tareas completadas para esta vista.';
    if (taskFilter === 'overdue') return 'No hay tareas vencidas.';
    if (taskView === 'today') return 'No hay tareas para hoy.';
    if (taskView === 'upcoming') return 'No hay tareas proximas.';
    if (taskView === 'week') return 'No hay tareas para esta semana.';
    return 'No hay tareas para estos filtros.';
}

export default function TaskManager() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [subtasks, setSubtasks] = useState<string[]>([]);
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [priority, setPriority] = useState<TaskPriority>(DEFAULT_PRIORITY);
    const [hasAlarm, setHasAlarm] = useState(true);
    const [loading, setLoading] = useState(true);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [currentList, setCurrentList] = useState<TaskList | null>(null);
    const [showShareDialog, setShowShareDialog] = useState(false);
    const [showScanDialog, setShowScanDialog] = useState(false);
    const [members, setMembers] = useState<ListMember[]>([]);
    const [assignedTo, setAssignedTo] = useState<string>('unassigned');
    const [filterByMe, setFilterByMe] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [taskView, setTaskView] = useState<TaskView>('today');
    const [taskFilter, setTaskFilter] = useState<TaskFilter>('pending');
    const [showCompletedSection, setShowCompletedSection] = useState(false);
    const { user, isPremium } = useAuth();
    const { colors } = usePostItSettings();

    useEffect(() => {
        const safetyTimer = window.setTimeout(() => setLoading(false), 10000);
        if (user && currentList) { fetchTasks().finally(() => clearTimeout(safetyTimer)); } else if (!user) { setTasks([]); setLoading(false); clearTimeout(safetyTimer); } else if (!currentList) { setLoading(false); clearTimeout(safetyTimer); }
        if ('Notification' in window && Notification.permission !== 'granted') { void Notification.requestPermission(); }
        return () => clearTimeout(safetyTimer);
    }, [user, currentList]);

    useEffect(() => {
        if (currentList) {
            void fetchMembers();
        } else {
            setMembers([]);
        }
    }, [currentList]);

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            const currentTime = format(now, 'HH:mm');
            const currentDate = format(now, 'yyyy-MM-dd');

            tasks.forEach((task) => {
                if (!task.completed && task.hasAlarm && task.date === currentDate && task.time === currentTime) {
                    playAlarmSound();
                    showNotification(task.title);
                    toast.info(`ALARMA: ${task.title}`, {
                        duration: 10000,
                        action: {
                            label: 'Completar',
                            onClick: () => { void toggleComplete(task.id); },
                        },
                    });
                }
            });
        }, 60000);

        return () => clearInterval(interval);
    }, [tasks]);

    const canEditCurrentList = isPremium && !!currentList && currentList.role !== 'viewer';
    const currentUserMember = members.find((member) => member.user_id === user?.id);
    const canShareCurrentList = !!currentList && (currentList.owner_id === user?.id || currentUserMember?.role === 'editor');

    const fetchMembers = async () => {
        if (!currentList) return;

        try {
            const { data, error } = await supabase
                .from('task_list_members')
                .select(`
                    user_id,
                    role,
                    profile:profiles!user_id(full_name, avatar_url)
                `)
                .eq('list_id', currentList.id);

            if (error) throw error;
            setMembers((data as any) || []);
        } catch (error) {
            console.error('Error fetching members:', error);
        }
    };

    const fetchTasks = async () => {
        if (!currentList) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('tasks')
                .select(`
                    *,
                    assignee:profiles!assigned_to(full_name, avatar_url)
                `)
                .eq('list_id', currentList.id)
                .order('due_date', { ascending: true });

            if (error) throw error;

            const mappedTasks: Task[] = (data || []).map((item: any) => {
                const dueDate = new Date(item.due_date);
                return {
                    id: item.id,
                    title: item.title,
                    notes: item.description,
                    description: item.description,
                    date: format(dueDate, 'yyyy-MM-dd'),
                    time: format(dueDate, 'HH:mm'),
                    hasAlarm: item.has_alarm,
                    completed: item.is_completed,
                    assignedTo: item.assigned_to,
                    priority: (item.priority as TaskPriority) || DEFAULT_PRIORITY,
                    assignee: item.assignee,
                };
            });

            setTasks(sortTasks(mappedTasks));
        } catch (error) {
            console.error('Error fetching tasks:', error);
            toast.error('Error al cargar las tareas');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setEditingTask(null);
        setTitle('');
        setNotes('');
        setSubtasks([]);
        setDate('');
        setTime('');
        setHasAlarm(true);
        setAssignedTo('unassigned');
        setPriority(DEFAULT_PRIORITY);
    };

    const playAlarmSound = () => {
        try {
            const audio = new Audio('/alarm-sound.mp3');
            void audio.play().catch((error) => console.log('Audio play failed', error));
        } catch (error) {
            console.error('Audio play failed', error);
        }
    };

    const showNotification = (taskTitle: string) => {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Mi Hogar - Alarma', {
                body: taskTitle,
                icon: '/icons/icon-192x192.png',
            });
        }
    };
    const handleSaveTask = async () => {
        if (!isPremium) {
            toast.error('Solo los usuarios Premium pueden crear nuevas tareas.');
            return;
        }

        if (!canEditCurrentList) {
            toast.error('No puedes editar esta lista.');
            return;
        }

        if (!title || !date || !time || !user || !currentList) {
            toast.error('Completa titulo, fecha, hora y lista.');
            return;
        }

        const dueDate = new Date(`${date}T${time}`);
        const description = buildTaskDescription(notes, subtasks);
        const payload = {
            title,
            description,
            due_date: dueDate.toISOString(),
            has_alarm: hasAlarm,
            assigned_to: assignedTo === 'unassigned' ? null : assignedTo,
            priority,
        };

        try {
            if (editingTask) {
                const { error } = await supabase.from('tasks').update(payload).eq('id', editingTask.id);
                if (error) throw error;
                toast.success('Tarea actualizada');
            } else {
                const { error } = await supabase.from('tasks').insert([
                    {
                        user_id: user.id,
                        list_id: currentList.id,
                        is_completed: false,
                        ...payload,
                    },
                ]);
                if (error) throw error;
                toast.success('Tarea creada');
            }

            resetForm();
            await fetchTasks();
        } catch (error) {
            console.error('Error saving task:', error);
            toast.error(editingTask ? 'Error al actualizar la tarea' : 'Error al crear la tarea');
        }
    };

    const startEditing = (task: Task) => {
        if (!isPremium) {
            toast.error('Solo los usuarios Premium pueden editar tareas.');
            return;
        }

        if (!canEditCurrentList) {
            toast.error('No puedes editar esta lista.');
            return;
        }

        const parsed = parseTaskDescription(task.notes);
        setEditingTask(task);
        setTitle(task.title);
        setNotes(parsed.notes);
        setSubtasks(parsed.subtasks);
        setDate(task.date);
        setTime(task.time);
        setHasAlarm(task.hasAlarm);
        setAssignedTo(task.assignedTo || 'unassigned');
        setPriority(task.priority || DEFAULT_PRIORITY);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const toggleComplete = async (id: string) => {
        const task = tasks.find((item) => item.id === id);
        if (!task) return;

        try {
            const { error } = await supabase.from('tasks').update({ is_completed: !task.completed }).eq('id', id);
            if (error) throw error;
            setTasks((current) => sortTasks(current.map((item) => item.id === id ? { ...item, completed: !item.completed } : item)));
        } catch (error) {
            console.error('Error updating task:', error);
            toast.error('Error al actualizar la tarea');
        }
    };

    const deleteTask = async (id: string) => {
        try {
            const { error } = await supabase.from('tasks').delete().eq('id', id);
            if (error) throw error;
            setTasks((current) => current.filter((item) => item.id !== id));
            if (editingTask?.id === id) resetForm();
            toast.success('Tarea eliminada');
        } catch (error) {
            console.error('Error deleting task:', error);
            toast.error('Error al eliminar la tarea');
        }
    };

    const postponeTask = async (task: Task, days: number) => {
        const nextDate = addDays(getTaskDate(task), days);
        try {
            const { error } = await supabase.from('tasks').update({ due_date: nextDate.toISOString() }).eq('id', task.id);
            if (error) throw error;
            setTasks((current) => sortTasks(current.map((item) => item.id === task.id ? { ...item, date: format(nextDate, 'yyyy-MM-dd'), time: format(nextDate, 'HH:mm') } : item)));
            toast.success(days === 1 ? 'Tarea pospuesta 1 dia' : 'Tarea pospuesta 1 semana');
        } catch (error) {
            console.error('Error postponing task:', error);
            toast.error('No se pudo posponer la tarea');
        }
    };

    const toggleNoteSubtask = async (taskId: string, lineIndex: number, currentChecked: boolean) => {
        const task = tasks.find((item) => item.id === taskId);
        if (!task || !task.notes) return;

        const lines = task.notes.split('\n');
        if (lineIndex >= lines.length) return;
        lines[lineIndex] = currentChecked ? lines[lineIndex].replace('- [x]', '- [ ]') : lines[lineIndex].replace('- [ ]', '- [x]');
        const newNotes = lines.join('\n');
        setTasks((current) => current.map((item) => item.id === taskId ? { ...item, notes: newNotes, description: newNotes } : item));

        try {
            const { error } = await supabase.from('tasks').update({ description: newNotes }).eq('id', taskId);
            if (error) throw error;
        } catch (error) {
            console.error('Error updating subtask:', error);
            toast.error('Error al actualizar la subtarea');
            setTasks((current) => current.map((item) => item.id === taskId ? { ...item, notes: task.notes, description: task.notes } : item));
        }
    };

    const handleAddSubtask = () => setSubtasks((current) => [...current, '']);
    const handleSubtaskChange = (index: number, value: string) => setSubtasks((current) => current.map((item, itemIndex) => itemIndex === index ? value : item));
    const removeDraftSubtask = (index: number) => setSubtasks((current) => current.filter((_, itemIndex) => itemIndex !== index));

    const handleSubtaskKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            setSubtasks((current) => {
                const next = [...current];
                next.splice(index + 1, 0, '');
                return next;
            });
        } else if (event.key === 'Backspace' && subtasks[index] === '' && subtasks.length > 0) {
            event.preventDefault();
            removeDraftSubtask(index);
        }
    };

    const renderNotes = (task: Task) => {
        if (!task.notes) return null;

        return (
            <div className="mt-3 rounded-xl bg-secondary/50 p-3 text-sm text-muted-foreground">
                <div className="mb-2 flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-70">Notas y checklist</span>
                </div>
                <div className="space-y-1 pl-6">
                    {task.notes.split('\n').map((line, index) => {
                        const isCheckbox = line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]');
                        if (isCheckbox) {
                            const isChecked = line.trim().startsWith('- [x]');
                            const text = line.replace(/- \[[ x]\]/, '').trim();
                            return (
                                <div key={index} className="flex items-start gap-2">
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            void toggleNoteSubtask(task.id, index, isChecked);
                                        }}
                                        className={isChecked ? 'mt-0.5 text-primary' : 'mt-0.5 text-muted-foreground hover:text-primary'}
                                    >
                                        {isChecked ? <CheckCircle2 className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                                    </button>
                                    <span className={isChecked ? 'line-through opacity-70' : ''}>{text}</span>
                                </div>
                            );
                        }

                        return <p key={index} className="min-h-[1.25rem] whitespace-pre-wrap">{line}</p>;
                    })}
                </div>
            </div>
        );
    };

    const visibleTasks = useMemo(() => {
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
        const nextSevenDays = addDays(startOfDay(new Date()), 7);

        return tasks.filter((task) => {
            const taskDate = getTaskDate(task);
            const taskDay = getTaskDay(task);
            const normalizedSearch = searchQuery.trim().toLowerCase();
            const matchesSearch = !normalizedSearch
                || task.title.toLowerCase().includes(normalizedSearch)
                || String(task.notes || '').toLowerCase().includes(normalizedSearch)
                || String(task.assignee?.full_name || '').toLowerCase().includes(normalizedSearch);
            const matchesMine = !filterByMe || task.assignedTo === user?.id;
            const matchesView = taskView === 'all'
                || (taskView === 'today' && (task.completed || isBefore(taskDay, startOfDay(new Date())) || isToday(taskDate)))
                || (taskView === 'upcoming' && (task.completed || isTomorrow(taskDate) || taskDate > startOfDay(new Date())))
                || (taskView === 'week' && (task.completed || isWithinInterval(taskDate, { start: startOfDay(new Date()), end: nextSevenDays })));
            const matchesFilter = taskFilter === 'all'
                || (taskFilter === 'pending' && !task.completed)
                || (taskFilter === 'completed' && task.completed)
                || (taskFilter === 'overdue' && !task.completed && isBefore(taskDay, startOfDay(new Date())))
                || (taskFilter === 'alarm' && task.hasAlarm)
                || (taskFilter === 'unassigned' && !task.assignedTo);
            const withinWeekFilter = taskView !== 'week' || task.completed || isWithinInterval(taskDate, { start: startOfDay(new Date()), end: weekEnd }) || taskDate > weekEnd;

            return matchesSearch && matchesMine && matchesView && matchesFilter && withinWeekFilter;
        });
    }, [tasks, searchQuery, filterByMe, taskView, taskFilter, user?.id]);

    const sectionData = useMemo(() => {
        const completedTasks = visibleTasks.filter((task) => task.completed);
        const pendingTasks = visibleTasks.filter((task) => !task.completed);
        const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
        const todayStart = startOfDay(new Date());

        const overdue = pendingTasks.filter((task) => isBefore(getTaskDay(task), todayStart));
        const todayTasks = pendingTasks.filter((task) => isToday(getTaskDate(task)));
        const tomorrowTasks = pendingTasks.filter((task) => isTomorrow(getTaskDate(task)));
        const weekTasks = pendingTasks.filter((task) => {
            const taskDate = getTaskDate(task);
            return !isToday(taskDate) && !isTomorrow(taskDate) && isWithinInterval(taskDate, { start: todayStart, end: weekEnd });
        });
        const laterTasks = pendingTasks.filter((task) => getTaskDate(task) > weekEnd);

        const sections: TaskSection[] = [];
        if (overdue.length > 0) sections.push({ key: 'overdue', title: 'Vencidas', description: 'Pendientes fuera de fecha.', tasks: sortTasks(overdue) });
        if (todayTasks.length > 0) sections.push({ key: 'today', title: 'Hoy', description: 'Trabajo operativo del dia.', tasks: sortTasks(todayTasks) });
        if (tomorrowTasks.length > 0) sections.push({ key: 'tomorrow', title: 'Manana', description: 'Lo siguiente en la cola.', tasks: sortTasks(tomorrowTasks) });
        if (weekTasks.length > 0) sections.push({ key: 'week', title: 'Esta semana', description: 'Pendiente para los proximos dias.', tasks: sortTasks(weekTasks) });
        if (laterTasks.length > 0) sections.push({ key: 'later', title: 'Mas adelante', description: 'Sin urgencia inmediata.', tasks: sortTasks(laterTasks) });
        if ((showCompletedSection || taskFilter === 'completed') && completedTasks.length > 0) {
            sections.push({ key: 'completed', title: 'Completadas', description: 'Historial reciente.', tasks: sortTasks(completedTasks) });
        }

        return {
            sections,
            counts: {
                total: tasks.length,
                pending: tasks.filter((task) => !task.completed).length,
                completed: tasks.filter((task) => task.completed).length,
                overdue: tasks.filter((task) => !task.completed && isBefore(getTaskDay(task), todayStart)).length,
                today: tasks.filter((task) => !task.completed && isToday(getTaskDate(task))).length,
                withAlarm: tasks.filter((task) => task.hasAlarm && !task.completed).length,
            },
        };
    }, [tasks, visibleTasks, showCompletedSection, taskFilter]);

    const summaryCards = [
        {
            label: 'Pendientes',
            value: sectionData.counts.pending,
            accent: colors.future,
            active: taskFilter === 'pending' && taskView === 'all',
            onClick: () => {
                setTaskView('all');
                setTaskFilter('pending');
            },
        },
        {
            label: 'Hoy',
            value: sectionData.counts.today,
            accent: colors.upcoming,
            active: taskFilter === 'pending' && taskView === 'today',
            onClick: () => {
                setTaskView('today');
                setTaskFilter('pending');
            },
        },
        {
            label: 'Vencidas',
            value: sectionData.counts.overdue,
            accent: colors.overdue,
            active: taskFilter === 'overdue',
            onClick: () => {
                setTaskView('all');
                setTaskFilter('overdue');
            },
        },
        {
            label: 'Alarmas',
            value: sectionData.counts.withAlarm,
            accent: colors.tomorrow,
            active: taskFilter === 'alarm',
            onClick: () => {
                setTaskView('all');
                setTaskFilter('alarm');
            },
        },
    ];

    const today = format(new Date(), 'yyyy-MM-dd');

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-2 text-2xl">
                                <CheckCircle2 className="h-6 w-6 text-primary" />
                                Gestor de tareas
                            </CardTitle>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Organiza pendientes por horizonte temporal, prioridad y responsable.
                            </p>
                        </div>
                        <div className="flex w-full flex-col gap-2 lg:w-auto lg:min-w-[420px]">
                            <TaskListSelector
                                currentListId={currentList?.id || null}
                                onListChange={(list) => {
                                    setCurrentList(list);
                                    resetForm();
                                }}
                            />
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" onClick={() => setShowScanDialog(true)} disabled={!currentList}>
                                    <Camera className="mr-2 h-4 w-4" /> Escanear
                                </Button>
                                <Button variant="outline" onClick={() => setShowShareDialog(true)} disabled={!currentList || !canShareCurrentList}>
                                    <Users className="mr-2 h-4 w-4" /> Compartir
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summaryCards.map((item) => (
                    <Card
                        key={item.label}
                        className={`cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md ${item.active ? 'ring-2 ring-primary/30 border-primary/40 shadow-sm' : ''}`}
                        onClick={item.onClick}
                    >
                        <CardContent className="flex items-center justify-between p-5">
                            <div>
                                <p className="text-sm text-muted-foreground">{item.label}</p>
                                <p className="mt-1 text-3xl font-semibold">{item.value}</p>
                            </div>
                            <div className={`rounded-2xl border p-3 text-primary ${item.accent}`}>
                                <Filter className="h-5 w-5" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="pb-4">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                {editingTask ? <Pencil className="h-5 w-5 text-primary" /> : <Plus className="h-5 w-5 text-primary" />}
                                {editingTask ? 'Editar tarea' : 'Nueva tarea'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isPremium ? (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                    Solo Premium puede crear y editar tareas.
                                </div>
                            ) : null}
                            {currentList?.role === 'viewer' ? (
                                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                    Esta lista esta en modo lectura para tu usuario.
                                </div>
                            ) : null}

                            <div className="space-y-2">
                                <Label>Titulo</Label>
                                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Renovar seguro del coche" />
                            </div>

                            <div className="space-y-2">
                                <Label>Notas</Label>
                                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contexto, pasos, referencias o enlaces." className="min-h-[110px]" />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Checklist</Label>
                                    <Button type="button" variant="ghost" size="sm" onClick={handleAddSubtask} disabled={!canEditCurrentList}>
                                        <Plus className="mr-1 h-4 w-4" /> Anadir paso
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {subtasks.map((subtask, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Circle className="h-4 w-4 text-muted-foreground" />
                                            <Input
                                                value={subtask}
                                                onChange={(e) => handleSubtaskChange(index, e.target.value)}
                                                onKeyDown={(event) => handleSubtaskKeyDown(index, event)}
                                                placeholder={`Paso ${index + 1}`}
                                            />
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removeDraftSubtask(index)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {subtasks.length === 0 ? <p className="text-sm text-muted-foreground">Sin pasos todavia.</p> : null}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Fecha</Label>
                                    <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Hora</Label>
                                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label>Prioridad</Label>
                                    <Select value={priority} onValueChange={(value: TaskPriority) => setPriority(value)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="high">Alta</SelectItem>
                                            <SelectItem value="medium">Media</SelectItem>
                                            <SelectItem value="low">Baja</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Asignada a</Label>
                                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unassigned">Sin asignar</SelectItem>
                                            {members.map((member) => (
                                                <SelectItem key={member.user_id} value={member.user_id}>
                                                    {member.profile?.full_name || 'Usuario'}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between rounded-xl border p-3">
                                <div>
                                    <p className="font-medium">Aviso</p>
                                    <p className="text-sm text-muted-foreground">Genera alarma local en la fecha y hora fijadas.</p>
                                </div>
                                <Button type="button" variant={hasAlarm ? 'default' : 'outline'} onClick={() => setHasAlarm((current) => !current)}>
                                    {hasAlarm ? <Bell className="mr-2 h-4 w-4" /> : <BellOff className="mr-2 h-4 w-4" />}
                                    {hasAlarm ? 'Activada' : 'Desactivada'}
                                </Button>
                            </div>

                            <div className="flex flex-wrap gap-2 pt-2">
                                <Button onClick={() => void handleSaveTask()} disabled={!canEditCurrentList || !title || !date || !time}>
                                    <Lock className="mr-2 h-4 w-4" />
                                    {editingTask ? 'Guardar cambios' : 'Crear tarea'}
                                </Button>
                                {editingTask ? (
                                    <Button variant="outline" onClick={resetForm}>
                                        Cancelar edicion
                                    </Button>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <PostItConfig />
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardContent className="space-y-4 p-5">
                            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_repeat(3,minmax(0,0.9fr))]">
                                <div className="relative">
                                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        className="pl-9"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Buscar por titulo, notas o persona asignada"
                                    />
                                </div>
                                <Select value={taskView} onValueChange={(value: TaskView) => setTaskView(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Vista" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="today">Hoy</SelectItem>
                                        <SelectItem value="upcoming">Proximas</SelectItem>
                                        <SelectItem value="week">Semana</SelectItem>
                                        <SelectItem value="all">Todas</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={taskFilter} onValueChange={(value: TaskFilter) => setTaskFilter(value)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Filtro" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="pending">Pendientes</SelectItem>
                                        <SelectItem value="all">Todas</SelectItem>
                                        <SelectItem value="completed">Completadas</SelectItem>
                                        <SelectItem value="overdue">Vencidas</SelectItem>
                                        <SelectItem value="alarm">Con alarma</SelectItem>
                                        <SelectItem value="unassigned">Sin asignar</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button variant={filterByMe ? 'default' : 'outline'} onClick={() => setFilterByMe((current) => !current)}>
                                    <Users className="mr-2 h-4 w-4" /> Solo mias
                                </Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button variant={showCompletedSection ? 'default' : 'outline'} onClick={() => setShowCompletedSection((current) => !current)}>
                                    {showCompletedSection ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronRight className="mr-2 h-4 w-4" />}
                                    Completadas
                                </Button>
                                {(searchQuery || filterByMe || taskView !== 'today' || taskFilter !== 'pending') ? (
                                    <Button
                                        variant="ghost"
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilterByMe(false);
                                            setTaskView('today');
                                            setTaskFilter('pending');
                                        }}
                                    >
                                        Limpiar filtros
                                    </Button>
                                ) : null}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full border ${colors.overdue}`} />
                            <span>Caducada</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full border ${colors.tomorrow}`} />
                            <span>Manana</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full border ${colors.upcoming}`} />
                            <span>Hoy / esta semana</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full border ${colors.future}`} />
                            <span>Mas adelante</span>
                        </div>
                    </div>

                    {sectionData.sections.length === 0 ? (
                        <Card>
                            <CardContent className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
                                <CalendarIcon className="mb-4 h-10 w-10 text-muted-foreground" />
                                <h3 className="text-lg font-semibold">Nada que mostrar</h3>
                                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                                    {getSectionEmptyMessage(taskView, taskFilter)}
                                </p>
                            </CardContent>
                        </Card>
                    ) : (
                        sectionData.sections.map((section) => (
                            <Card key={section.key}>
                                <CardHeader className="pb-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <CardTitle className="text-lg">{section.title}</CardTitle>
                                            <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                                        </div>
                                        <Badge variant="outline">{section.tasks.length}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {section.tasks.map((task) => {
                                        const tone = getTaskTone(task);
                                        const isCompleted = task.completed;
                                        const isDocTask = isDocumentTask(task);
                                        const toneColor = tone === 'overdue'
                                            ? colors.overdue
                                            : tone === 'tomorrow'
                                                ? colors.tomorrow
                                                : tone === 'today' || tone === 'upcoming'
                                                    ? colors.upcoming
                                                    : colors.future;
                                        const borderClass = tone === 'overdue'
                                            ? 'border-rose-200 dark:border-rose-900/40'
                                            : tone === 'today'
                                                ? 'border-amber-200 dark:border-amber-900/40'
                                                : 'border-slate-200 dark:border-slate-800';

                                        return (
                                            <div key={task.id} className={`relative overflow-hidden rounded-2xl border bg-card p-4 ${borderClass} ${isCompleted ? 'opacity-70' : ''}`}>
                                                <div className={`pointer-events-none absolute inset-0 opacity-20 ${toneColor}`} />
                                                <div className="relative z-10 flex items-start justify-between gap-4">
                                                    <div className="flex min-w-0 flex-1 items-start gap-3">
                                                        <button type="button" className="mt-0.5 shrink-0" onClick={() => void toggleComplete(task.id)}>
                                                            {isCompleted ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                                                        </button>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className={`h-3 w-3 rounded-full border ${toneColor}`} />
                                                                <h3 className={`text-base font-semibold ${isCompleted ? 'line-through text-muted-foreground' : ''}`}>{task.title}</h3>
                                                                <Badge className={getPriorityClasses(task.priority)} variant="outline">{getPriorityLabel(task.priority)}</Badge>
                                                                {isDocTask ? <Badge variant="secondary">Documento</Badge> : null}
                                                                {task.hasAlarm ? <Badge variant="outline"><Bell className="mr-1 h-3 w-3" /> Alarma</Badge> : null}
                                                            </div>
                                                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                                                                <span className="inline-flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> {formatTaskMoment(task)}</span>
                                                                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {tone === 'overdue' ? 'Vencida' : tone === 'today' ? 'Hoy' : tone === 'tomorrow' ? 'Manana' : 'Proxima'}</span>
                                                                {task.assignee ? (
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <Avatar className="h-5 w-5">
                                                                            <AvatarImage src={task.assignee.avatar_url} alt={task.assignee.full_name} />
                                                                            <AvatarFallback>{task.assignee.full_name?.slice(0, 1)?.toUpperCase() || 'U'}</AvatarFallback>
                                                                        </Avatar>
                                                                        {task.assignee.full_name}
                                                                    </span>
                                                                ) : (
                                                                    <span>Sin asignar</span>
                                                                )}
                                                            </div>
                                                            {renderNotes(task)}
                                                        </div>
                                                    </div>

                                                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                                                        {!isCompleted ? (
                                                            <>
                                                                <Button variant="outline" size="sm" onClick={() => void postponeTask(task, 1)}>
                                                                    +1 dia
                                                                </Button>
                                                                <Button variant="outline" size="sm" onClick={() => void postponeTask(task, 7)}>
                                                                    +1 sem
                                                                </Button>
                                                            </>
                                                        ) : null}
                                                        <Button variant="ghost" size="icon" onClick={() => startEditing(task)} disabled={!canEditCurrentList}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => void deleteTask(task.id)} disabled={!canEditCurrentList}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </div>

            {currentList ? (
                <ShareTasksDialog
                    open={showShareDialog}
                    onOpenChange={setShowShareDialog}
                    listId={currentList.id}
                    listName={currentList.name}
                    isOwner={currentList.owner_id === user?.id}
                    onListUpdated={() => {
                        void fetchMembers();
                        void fetchTasks();
                    }}
                />
            ) : null}

            <ScreenshotToTaskDialog
                open={showScanDialog}
                onOpenChange={setShowScanDialog}
                onSuccess={() => void fetchTasks()}
                listId={currentList?.id}
            />
        </div>
    );
}



