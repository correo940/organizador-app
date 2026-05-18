'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Crown, Clock, Bell } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context'; 
import { usePostItSettings } from '@/context/PostItSettingsContext';
import { usePathname } from 'next/navigation';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { es } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { NotificationManager } from '@/lib/notifications';
import { toast } from 'sonner';

type AdminPostIt = {
    id: string;
    title: string;
    content: string;
    target_audience: 'all' | 'premium' | 'free';
    bg_color: string;
    created_at: string;
    event_date?: string;
};

export default function SystemPostIts() {
    const [postIts, setPostIts] = useState<AdminPostIt[]>([]);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
    const { user } = useAuth();
    const [isPremium, setIsPremium] = useState(false);

    const { isVisible, allowedPaths, visibilityMode, position, layout, opacity } = usePostItSettings();
    const pathname = usePathname();

    useEffect(() => {
        if (!user) {
            setIsPremium(false);
            setDismissedIds(new Set()); // Reset dismissed items
            fetchPostIts(); // Fetch public post-its
            return;
        }

        checkPremiumAndFetch(user.id);
    }, [user]);

    const checkPremiumAndFetch = async (userId: string) => {
        // Fetch Premium Status
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', userId)
            .single();

        const premiumStatus = profile?.is_premium || false;
        setIsPremium(premiumStatus);

        // Fetch Post-its (and dismissed)
        await Promise.all([
            fetchPostIts(),
            fetchDismissedPostIts(userId)
        ]);
    };

    const fetchDismissedPostIts = async (userId: string) => {
        // if (!user) return; // UserId passed directly now
        const { data } = await supabase
            .from('user_dismissed_post_its')
            .select('post_it_id')
            .eq('user_id', userId);

        if (data) {
            setDismissedIds(new Set(data.map(d => d.post_it_id)));
        }
    };

    const fetchPostIts = async () => {
        const { data, error } = await supabase
            .from('admin_post_its')
            .select('*')
            .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setPostIts(data);
        }
    };

    const handleDismiss = async (id: string) => {
        // Optimistic update
        setDismissedIds(prev => new Set(prev).add(id));

        if (!user) return;

        await supabase.from('user_dismissed_post_its').insert({
            user_id: user.id,
            post_it_id: id
        });
    };

    const shouldShow = () => {
        if (!isVisible) return false;

        // Always show Admin Post-its on public pages and dashboard
        if (pathname === '/' || pathname === '/about' || pathname === '/contact' || pathname?.startsWith('/category/') || pathname?.startsWith('/apps/mi-hogar')) {
            return true;
        }

        if (visibilityMode === 'all') return true;
        if (!pathname) return false;

        return allowedPaths.some(path => {
            return pathname.startsWith(path);
        });
    };

    if (!shouldShow()) return null;

    const visiblePostIts = postIts.filter(p => {
        // Filter dismissed
        if (dismissedIds.has(p.id)) return false;

        // Filter audience
        if (p.target_audience === 'premium' && !isPremium) return false;
        if (p.target_audience === 'free' && isPremium) return false;

        return true;
    });

    if (visiblePostIts.length === 0) return null;

    // Offset calculation to stack with Task Post-its if needed, 
    // but for now let's just use CSS stacking or similar.
    // Ideally these should share a container with TaskPostIts to avoid overlap,
    // but without refactoring everything, let's offset them slightly or put them in a corner.
    // Or we rely on the user dragging them.

    // Let's reuse similar position logic but maybe offset by default?
    const positionStyles = {
        'top-left': 'top-24 left-4', // Same as tasks, might overlap initially
        'top-center': 'top-24 left-1/2 -translate-x-1/2',
        'top-right': 'top-24 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
        'bottom-right': 'bottom-4 right-4',
        'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    };

    return (
        <div className={`fixed ${positionStyles[position]} z-[41] flex ${layout === 'horizontal' ? 'flex-row' : 'flex-col'} gap-4 pointer-events-none mt-4 ml-4`}>
            {/* Added margin to slight offset from tasks if they are in same spot, though user can drag */}
            <AnimatePresence>
                {visiblePostIts.map((postIt, index) => (
                    <motion.div
                        key={postIt.id}
                        drag
                        dragMomentum={false}
                        initial={{ opacity: 0, scale: 0.8, y: -20, rotate: 5 }}
                        animate={{ opacity: 1, scale: 1, y: 0, rotate: index % 2 === 0 ? 3 : -3 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className={`pointer-events-auto relative w-56 p-4 shadow-xl transform transition-transform hover:scale-105 hover:z-50 cursor-grab active:cursor-grabbing ${postIt.bg_color || 'bg-yellow-200'}`}
                        style={{
                            boxShadow: '4px 4px 15px rgba(0,0,0,0.15)',
                            fontFamily: '"Comic Sans MS", "Chalkboard SE", sans-serif',
                            '--tw-bg-opacity': opacity,
                        } as any}
                    >
                        {/* Pin */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500 shadow-sm border border-blue-600 z-10" />

                        <button
                            onClick={() => handleDismiss(postIt.id)}
                            className="absolute top-1 right-1 p-1 hover:bg-black/10 rounded-full transition-colors"
                            title="Descartar para siempre"
                        >
                            <X className="w-3 h-3 text-black/60" />
                        </button>

                        <div className="flex items-center gap-2 mb-2 border-b border-black/10 pb-1">
                            {postIt.target_audience === 'premium' && <Crown className="w-3 h-3 text-amber-600" />}
                            <span className="font-bold text-sm uppercase tracking-wider text-black/70">Aviso</span>
                        </div>

                        <h3 className="font-bold text-sm mb-1 leading-tight text-black">{postIt.title}</h3>
                        <p className="text-sm text-black/80 leading-snug whitespace-pre-wrap mb-3">{postIt.content}</p>

                        {/* Countdown */}
                        {postIt.event_date && (
                            <div className="mb-3 p-2 bg-black/5 rounded text-center">
                                <p className="text-xs font-semibold text-black/60 uppercase mb-1">Faltan:</p>
                                <Countdown targetDate={postIt.event_date} />
                            </div>
                        )}

                        <div className="flex gap-2 mt-auto">
                            {postIt.event_date && (
                                <ReminderButton postIt={postIt} />
                            )}

                            <button
                                onClick={() => handleDismiss(postIt.id)}
                                className="flex-1 py-1 px-2 border border-black/20 rounded bg-white/20 hover:bg-white/40 text-xs font-bold uppercase tracking-wide text-black/70 transition-colors"
                            >
                                Entendido
                            </button>
                        </div>

                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

function Countdown({ targetDate }: { targetDate: string }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const update = () => {
            const now = new Date();
            const target = new Date(targetDate);
            const diff = differenceInSeconds(target, now);

            if (diff <= 0) {
                setTimeLeft('¡Ya llegó!');
                return;
            }

            const days = Math.floor(diff / (3600 * 24));
            const hours = Math.floor((diff % (3600 * 24)) / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            const parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            parts.push(`${minutes}m`);
            parts.push(`${seconds}s`);

            setTimeLeft(parts.join(' '));
        };

        update();
        const interval = setInterval(update, 1000);
        return () => clearInterval(interval);
    }, [targetDate]);

    return <span className="text-lg font-mono font-bold text-black/80">{timeLeft}</span>;
}

function ReminderButton({ postIt }: { postIt: AdminPostIt }) {
    const handleSchedule = async (minutesBefore: number) => {
        try {
            const date = new Date(postIt.event_date!);
            const notifyTime = new Date(date.getTime() - minutesBefore * 60000);

            if (notifyTime <= new Date()) {
                toast.error('Es demasiado tarde para este aviso.');
                return;
            }

            await NotificationManager.requestPermissions();
            await NotificationManager.schedule({
                id: new Date().getTime(), // Random ID
                title: `Aviso: ${postIt.title}`,
                body: postIt.content,
                schedule: { at: notifyTime },
            });

            toast.success(`Aviso programado para ${minutesBefore < 60 ? minutesBefore + ' minutos' : minutesBefore / 60 + ' horas'} antes.`);
        } catch (e) {
            console.error(e);
            toast.error('No se pudo programar el aviso.');
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button className="py-1 px-2 border border-black/20 rounded bg-white/20 hover:bg-white/40 text-black/70 transition-colors" title="Avisar">
                    <Bell className="w-4 h-4" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2">
                <p className="text-xs font-semibold mb-2 text-center">Recordarme:</p>
                <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="sm" className="justify-start h-8 text-xs" onClick={() => handleSchedule(30)}>30 min antes</Button>
                    <Button variant="ghost" size="sm" className="justify-start h-8 text-xs" onClick={() => handleSchedule(60)}>1 hora antes</Button>
                    <Button variant="ghost" size="sm" className="justify-start h-8 text-xs" onClick={() => handleSchedule(1440)}>1 día antes</Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
