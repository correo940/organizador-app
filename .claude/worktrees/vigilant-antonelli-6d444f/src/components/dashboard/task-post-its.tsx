'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, differenceInCalendarDays, addDays, isSameDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useRouter, usePathname } from 'next/navigation';
import { usePostItSettings } from '@/context/PostItSettingsContext';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

type Task = {
    id: string;
    title: string;
    date: string;
    time: string;
    dueDate: string;
};

export default function TaskPostIts() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [hiddenTaskIds, setHiddenTaskIds] = useState<Set<string>>(new Set());
    const { user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const { isVisible, colors, snoozeDuration, position, opacity, layout, visibilityMode, allowedPaths, daysToHideAfterExpiration } = usePostItSettings();

    // ... (existing code) ...



    useEffect(() => {
        if (!user) {
            setTasks([]);
            return;
        }
        fetchTasks(user.id);
    }, [user]);

    const fetchTasks = async (userId: string) => {
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .eq('is_completed', false)
            .order('due_date', { ascending: true });

        if (!error && data) {
            const mappedTasks: Task[] = data.map((item: any) => ({
                id: item.id,
                title: item.title,
                date: format(new Date(item.due_date), 'd MMM', { locale: es }),
                time: format(new Date(item.due_date), 'HH:mm'),
                dueDate: item.due_date // Keep original ISO string for comparison
            }));
            setTasks(mappedTasks);
        }
    };

    const hideTask = (e: React.MouseEvent, id: string) => {
        e.stopPropagation(); // Prevent navigation when clicking X
        setHiddenTaskIds(prev => new Set(prev).add(id));

        // Re-show after snooze duration (in minutes)
        setTimeout(() => {
            setHiddenTaskIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }, snoozeDuration * 60 * 1000);
    };

    const isDraggingRef = React.useRef(false);

    const handleTaskClick = (e: React.MouseEvent) => {
        if (isDraggingRef.current) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        router.push('/apps/mi-hogar/tasks');
    };

    // Visibility Check Logic
    const shouldShow = () => {
        if (!isVisible) return false;
        if (visibilityMode === 'all') return true;
        if (!pathname) return false;

        // Check if current path is in allowed paths
        // We use startsWith for sub-routes (like /tasks/detail) but exact match for dashboard
        return allowedPaths.some(path => {
            if (path === '/apps/mi-hogar') return pathname === '/apps/mi-hogar'; // Strict for dashboard to avoid matching all sub-apps
            return pathname.startsWith(path);
        });
    };

    if (!user || tasks.length === 0 || !shouldShow()) return null;

    // Filter out hidden tasks and expired tasks based on setting
    const visibleTasks = tasks.filter(task => {
        if (hiddenTaskIds.has(task.id)) return false;

        // Check expiration visibility
        const now = new Date();
        const dueDate = new Date(task.dueDate);

        // Only check if it's actually overdue
        if (dueDate < now && daysToHideAfterExpiration !== -1) {
            const daysOverdue = differenceInCalendarDays(now, dueDate);
            if (daysOverdue > daysToHideAfterExpiration) return false;
        }

        return true;
    });

    if (visibleTasks.length === 0) return null;

    // Position styles
    const positionStyles = {
        'top-left': 'top-24 left-4',
        'top-center': 'top-24 left-1/2 -translate-x-1/2',
        'top-right': 'top-24 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
        'bottom-right': 'bottom-4 right-4',
        'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    };

    return (
        <div className={`fixed ${positionStyles[position]} z-40 flex ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} gap-4 pointer-events-none`}>
            <AnimatePresence>
                {visibleTasks.map((task, index) => {
                    const now = new Date();
                    const dueDate = new Date(task.dueDate);
                    const isOverdue = dueDate < now;
                    const isTomorrow = isSameDay(dueDate, addDays(now, 1));
                    const diffDays = differenceInCalendarDays(dueDate, now);

                    let bgColor = colors.future; // Default Yellow (> 1 week)

                    if (isOverdue) {
                        bgColor = colors.overdue;
                    } else if (isTomorrow) {
                        bgColor = colors.tomorrow;
                    } else if (diffDays < 7) {
                        bgColor = colors.upcoming;
                    }

                    // Remove any hardcoded opacity from the color class (e.g., /80) so the slider works
                    bgColor = bgColor.replace(/\/\d+/g, '');

                    return (
                        <motion.div
                            key={task.id}
                            drag
                            dragMomentum={false}
                            dragElastic={0} // Follow cursor exactly
                            onDragStart={() => { isDraggingRef.current = true; }}
                            onDragEnd={() => {
                                // Small delay to ensure onClick sees the drag state
                                setTimeout(() => { isDraggingRef.current = false; }, 100);
                            }}
                            whileDrag={{ scale: 1.1, cursor: 'grabbing', zIndex: 100 }}
                            initial={{ opacity: 0, scale: 0.8, x: -50, rotate: -10 }}
                            animate={{ opacity: 1, scale: 1, x: 0, rotate: index % 2 === 0 ? -2 : 2 }}
                            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                            className={`pointer-events-auto relative w-48 text-black p-4 shadow-lg transform transition-transform hover:scale-105 hover:z-50 cursor-grab active:cursor-grabbing ${bgColor}`}
                            style={{
                                boxShadow: '2px 2px 10px rgba(0,0,0,0.1)',
                                fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif', // Fallback to handwritten-ish font
                                '--tw-bg-opacity': opacity,
                            } as any}
                            onClick={handleTaskClick}
                        >
                            {/* Pin effect */}
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-red-500 shadow-sm border border-red-600" />

                            <button
                                onClick={(e) => hideTask(e, task.id)}
                                className="absolute top-1 right-1 p-1 hover:bg-black/10 rounded-full transition-colors"
                                title={`Ocultar por ${snoozeDuration} minutos`}
                            >
                                <X className="w-3 h-3 text-black/60" />
                            </button>

                            <p className="font-medium text-sm mb-2 leading-tight">{task.title}</p>

                            <div className="flex items-center text-xs text-black/60 gap-1 mt-2 border-t border-black/10 pt-2">
                                <Clock className="w-3 h-3" />
                                <span>{task.date} - {task.time}</span>
                                {isOverdue && <span className="font-bold text-red-700 ml-auto">!</span>}
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
