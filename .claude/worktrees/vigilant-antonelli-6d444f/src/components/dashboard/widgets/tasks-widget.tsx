'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { CheckCircle2, Circle, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

type Task = {
    id: string;
    title: string;
    description?: string;
    due_date: string;
    is_completed: boolean;
};

interface TasksWidgetProps {
    selectedDate: Date | undefined;
}

export default function TasksWidget({ selectedDate }: TasksWidgetProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();

    const fetchTasks = async () => {
        if (!user) return;

        let query = supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('is_completed', false)
            .order('due_date', { ascending: true });

        if (selectedDate) {
            // Filter by selected date
            const startOfDay = new Date(selectedDate);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(selectedDate);
            endOfDay.setHours(23, 59, 59, 999);

            query = query
                .gte('due_date', startOfDay.toISOString())
                .lte('due_date', endOfDay.toISOString());
        } else {
            // If no date selected, show next 10 tasks
            query = query.limit(10);
        }

        const { data, error } = await query;

        if (!error && data) {
            setTasks(data);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!user) return;
        fetchTasks();
    }, [selectedDate, user]); // Refetch when date changes

    useEffect(() => {
        if (!user) return;
        fetchTasks();

        // Subscribe to changes
        const channel = supabase
            .channel('tasks_widget')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
                fetchTasks();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user]);

    const toggleTask = async (taskId: string, currentStatus: boolean) => {
        const { error } = await supabase
            .from('tasks')
            .update({ is_completed: !currentStatus })
            .eq('id', taskId);

        if (!error) fetchTasks();
    };

    const toggleSubtask = async (taskId: string, description: string, lineIndex: number, currentChecked: boolean) => {
        const lines = description.split('\n');
        if (lineIndex >= lines.length) return;

        const line = lines[lineIndex];
        const newLine = currentChecked
            ? line.replace('- [x]', '- [ ]')
            : line.replace('- [ ]', '- [x]');

        lines[lineIndex] = newLine;
        const newDescription = lines.join('\n');

        // Optimistic update
        setTasks(tasks.map(t => t.id === taskId ? { ...t, description: newDescription } : t));

        const { error } = await supabase
            .from('tasks')
            .update({ description: newDescription })
            .eq('id', taskId);

        if (error) {
            // Revert on error
            setTasks(tasks.map(t => t.id === taskId ? { ...t, description: description } : t));
        }
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>
                    {selectedDate
                        ? `Tareas del ${format(selectedDate, "d 'de' MMMM", { locale: es })}`
                        : "Tareas Pendientes"
                    }
                </CardTitle>
                <Button variant="ghost" size="sm" asChild>
                    <Link href="/apps/mi-hogar/tasks">Ver todas</Link>
                </Button>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
                <ScrollArea className="h-[300px] pr-4">
                    {loading ? (
                        <div className="space-y-3 py-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-start gap-3 p-2">
                                    <div className="w-5 h-5 rounded-full bg-slate-200/60 animate-pulse mt-1 shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-200/60 rounded-lg animate-pulse w-3/4" />
                                        <div className="h-3 bg-slate-200/40 rounded animate-pulse w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : tasks.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>¡Todo al día!</p>
                            <p className="text-sm">No tienes tareas pendientes.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tasks.map((task) => (
                                <div key={task.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors group">
                                    <button
                                        onClick={() => toggleTask(task.id, task.is_completed)}
                                        className="mt-1 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        {task.is_completed ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <p className={`font-medium truncate ${task.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                                            {task.title}
                                        </p>
                                        {task.description && (
                                            <div className="mt-1.5 space-y-1">
                                                {task.description.split('\n').map((line, i) => {
                                                    const isSubtask = line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]');
                                                    if (isSubtask) {
                                                        const isChecked = line.trim().startsWith('- [x]');
                                                        const text = line.replace(/- \[[ x]\]/, '').trim();
                                                        return (
                                                            <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground/90">
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleSubtask(task.id, task.description!, i, isChecked);
                                                                    }}
                                                                    className="hover:text-primary transition-colors"
                                                                >
                                                                    {isChecked ? (
                                                                        <CheckCircle2 className="w-3 h-3 mt-0.5 text-primary/60 shrink-0" />
                                                                    ) : (
                                                                        <Circle className="w-3 h-3 mt-0.5 shrink-0" />
                                                                    )}
                                                                </button>
                                                                <span className={`${isChecked ? 'line-through opacity-70' : ''} leading-tight`}>{text}</span>
                                                            </div>
                                                        );
                                                    }
                                                    if (line.trim() === '') return null;
                                                    return (
                                                        <p key={i} className="text-xs text-muted-foreground leading-snug">
                                                            {line}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        <div className="flex items-center text-xs text-muted-foreground gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            <span>
                                                {format(new Date(task.due_date), "d 'de' MMMM, HH:mm", { locale: es })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    );
}
