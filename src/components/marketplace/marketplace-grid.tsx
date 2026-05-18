'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutGrid, ShoppingCart, Settings, Calendar,
    FileText, KeyRound, MessageCircle, ShoppingBag,
    ChefHat, ListTodo, Lock, Sparkles, Monitor, Leaf, Brain
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { AppWithStatus, MarketplaceApp } from '@/types/marketplace';
import PurchaseDialog from '@/components/mobile/purchase-dialog';
import { useRouter } from 'next/navigation';

// Icon mapping for dynamic rendering
const IconMap: { [key: string]: any } = {
    Settings, ShoppingCart, ShoppingBag, ChefHat,
    ListTodo, Calendar, FileText, KeyRound, MessageCircle,
    Monitor, Leaf, Brain
};

// Fallback apps - used when marketplace_apps table doesn't exist yet
const FALLBACK_APPS: AppWithStatus[] = [
    { id: 'fb-1', key: 'desktop', name: 'Quioba Web', description: 'Acceso al escritorio completo.', icon_key: 'Settings', route: '/desktop', price: 0, category: 'utility', is_active: true, isOwned: true, isLocked: false },
    { id: 'fb-2', key: 'shopping', name: 'Lista de la Compra', description: 'Gestiona tu lista de la compra y despensa.', icon_key: 'ShoppingBag', route: '/apps/mi-hogar/shopping', price: 4.99, category: 'lifestyle', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-3', key: 'chef-ia', name: 'Chef IA', description: 'Tu asistente de cocina y recetas.', icon_key: 'ChefHat', route: '/apps/mi-hogar/chef', price: 2.99, category: 'lifestyle', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-4', key: 'tasks', name: 'Gestor de Tareas', description: 'Organiza tu día a día.', icon_key: 'ListTodo', route: '/apps/mi-hogar/tasks', price: 1.99, category: 'productivity', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-5', key: 'roster', name: 'Cuadrante de Turnos', description: 'Gestiona tu cuadrante de trabajo.', icon_key: 'Calendar', route: '/apps/mi-hogar/roster', price: 3.99, category: 'productivity', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-6', key: 'documents', name: 'Gestor Documental', description: 'DNI, Seguros siempre a mano.', icon_key: 'FileText', route: '/apps/mi-hogar/documents', price: 4.99, category: 'utility', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-7', key: 'passwords', name: 'Gestor de Contraseñas', description: 'Almacena contraseñas seguras.', icon_key: 'KeyRound', route: '/apps/passwords', price: 5.99, category: 'utility', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-8', key: 'assistant', name: 'Asistente Quioba', description: 'Tu asistente personal con IA.', icon_key: 'MessageCircle', route: '/apps/mi-hogar/asistente', price: 9.99, category: 'productivity', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-9', key: 'huerto', name: 'Mis Plantas/Huerto', description: 'Identifica y cuida tus plantas con IA.', icon_key: 'Leaf', route: '/apps/huerto', price: 2.99, category: 'lifestyle', is_active: true, isOwned: false, isLocked: true },
    { id: 'fb-10', key: 'meditation', name: 'Pausa', description: 'Meditacion breve, respiracion y espacio mental.', icon_key: 'Brain', route: '/apps/mi-hogar/meditation', price: 0, category: 'lifestyle', is_active: true, isOwned: true, isLocked: false },
];

const LOCAL_MEDITATION_APP: AppWithStatus = {
    id: 'local-meditation',
    key: 'meditation',
    name: 'Pausa',
    description: 'Meditacion breve, respiracion y espacio mental.',
    icon_key: 'Brain',
    route: '/apps/mi-hogar/meditation',
    price: 0,
    category: 'lifestyle',
    is_active: true,
    isOwned: true,
    isLocked: false
};

function withLocalMeditationApp(apps: AppWithStatus[]) {
    if (apps.some((app) => app.key === LOCAL_MEDITATION_APP.key)) {
        return apps;
    }

    return [...apps, LOCAL_MEDITATION_APP];
}

// Color styles per app key
const getAppStyle = (appKey: string) => {
    switch (appKey) {
        case 'desktop': return { bg: 'bg-green-50', text: 'text-green-800', decoration: 'bg-green-500' };
        case 'shopping': return { bg: 'bg-orange-50', text: 'text-orange-600', decoration: 'bg-orange-500' };
        case 'chef-ia': return { bg: 'bg-red-50', text: 'text-red-600', decoration: 'bg-red-500' };
        case 'tasks': return { bg: 'bg-purple-50', text: 'text-purple-600', decoration: 'bg-purple-500' };
        case 'roster': return { bg: 'bg-indigo-50', text: 'text-indigo-600', decoration: 'bg-indigo-500' };
        case 'documents': return { bg: 'bg-blue-50', text: 'text-blue-600', decoration: 'bg-blue-500' };
        case 'passwords': return { bg: 'bg-amber-50', text: 'text-amber-600', decoration: 'bg-amber-500' };
        case 'assistant': return { bg: 'bg-violet-50', text: 'text-violet-600', decoration: 'bg-violet-500' };
        case 'huerto': return { bg: 'bg-green-50', text: 'text-green-800', decoration: 'bg-green-500' };
        case 'meditation': return { bg: 'bg-green-50', text: 'text-green-800', decoration: 'bg-green-500' };
        default: return { bg: 'bg-slate-50', text: 'text-slate-600', decoration: 'bg-slate-500' };
    }
};

interface MarketplaceGridProps {
    /** Number of columns on desktop (2, 3, or 4) */
    columns?: 2 | 3 | 4;
    /** Callback for special actions like launching desktop */
    onLaunchDesktop?: () => void;
    /** Compact mode (smaller cards, no descriptions) */
    compact?: boolean;
    /** Show title header */
    showHeader?: boolean;
}

export default function MarketplaceGrid({
    columns = 2,
    onLaunchDesktop,
    compact = false,
    showHeader = true
}: MarketplaceGridProps) {
    const router = useRouter();
    const [apps, setApps] = useState<AppWithStatus[]>([]);
    const [loadingApps, setLoadingApps] = useState(true);
    const [selectedAppForPurchase, setSelectedAppForPurchase] = useState<MarketplaceApp | null>(null);
    const [userId, setUserId] = useState<string | null>(null);

    const fetchApps = async (uid: string) => {
        try {
            const { data: marketplaceApps, error: appsError } = await supabase
                .from('marketplace_apps')
                .select('*')
                .eq('is_active', true)
                .order('price', { ascending: true });

            if (appsError || !marketplaceApps || marketplaceApps.length === 0) {
                console.warn('📱 Marketplace: Using fallback apps');
                setApps(withLocalMeditationApp(FALLBACK_APPS));
                setLoadingApps(false);
                return;
            }

            // Check if user is Premium
            const { data: profileData } = await supabase
                .from('profiles')
                .select('subscription_tier')
                .eq('id', uid)
                .single();

            const isPremium = profileData?.subscription_tier === 'premium';

            if (isPremium) {
                setApps(withLocalMeditationApp(marketplaceApps.map(app => ({ ...app, isOwned: true, isLocked: false }))));
                setLoadingApps(false);
                return;
            }

            const { data: purchases } = await supabase
                .from('user_app_purchases')
                .select('app_id, expires_at')
                .eq('user_id', uid)
                .eq('status', 'active');

            const ownedAppIds = new Set(
                (purchases || [])
                    .filter(p => !p.expires_at || new Date(p.expires_at) > new Date())
                    .map(p => p.app_id)
            );

            const processedApps: AppWithStatus[] = withLocalMeditationApp(marketplaceApps.map(app => ({
                ...app,
                isOwned: ownedAppIds.has(app.id),
                isLocked: !ownedAppIds.has(app.id)
            })));

            setApps(processedApps);
        } catch (error) {
            console.error('📱 Marketplace: Error, using fallback', error);
            setApps(withLocalMeditationApp(FALLBACK_APPS));
        } finally {
            setLoadingApps(false);
        }
    };

    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    setUserId(session.user.id);
                    await fetchApps(session.user.id);
                } else {
                    setApps(withLocalMeditationApp(FALLBACK_APPS));
                    setLoadingApps(false);
                }
            } catch {
                setApps(withLocalMeditationApp(FALLBACK_APPS));
                setLoadingApps(false);
            }
        };
        init();
    }, []);

    const handleAppClick = (app: AppWithStatus) => {
        if (app.isLocked) {
            setSelectedAppForPurchase(app);
            return;
        }
        if (app.key === 'desktop' && onLaunchDesktop) {
            onLaunchDesktop();
        } else {
            router.push(app.route);
        }
    };

    const gridCols = columns === 4
        ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
        : columns === 3
            ? 'grid-cols-2 lg:grid-cols-3'
            : 'grid-cols-2';

    return (
        <>
            {showHeader && (
                <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="font-extrabold text-lg md:text-xl text-slate-900 dark:text-white tracking-tight">
                        Mis Aplicaciones
                    </h2>
                    <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-1 rounded-full">
                        {apps.filter(a => a.isOwned).length} Activas
                    </span>
                </div>
            )}

            {loadingApps ? (
                <div className={`grid ${gridCols} gap-4 animate-pulse`}>
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className={`${compact ? 'h-24' : 'h-40'} bg-white/50 dark:bg-slate-800/50 rounded-[20px]`} />
                    ))}
                </div>
            ) : (
                <div className={`grid ${gridCols} gap-4`}>
                    {apps.map((app) => {
                        const Icon = IconMap[app.icon_key] || LayoutGrid;
                        const style = getAppStyle(app.key);

                        return (
                            <motion.button
                                key={app.id}
                                whileHover={{ y: -3, scale: 1.02 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleAppClick(app)}
                                className={`
                                    bg-white/80 dark:bg-slate-800/80 backdrop-blur-md ${compact ? 'p-4' : 'p-5'} 
                                    rounded-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] 
                                    border border-white/60 dark:border-slate-700/60 
                                    flex flex-col items-start text-left relative overflow-hidden group
                                    transition-shadow hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]
                                    ${app.isLocked ? 'opacity-75 grayscale-[0.2]' : ''}
                                `}
                            >
                                {/* Icon */}
                                <div className={`
                                    ${compact ? 'w-10 h-10' : 'w-12 h-12'} 
                                    ${app.isLocked ? 'bg-slate-100 dark:bg-slate-700 text-slate-400' : style.bg + ' ' + style.text} 
                                    rounded-[14px] flex items-center justify-center ${compact ? 'mb-2' : 'mb-3'} 
                                    border border-white/50 dark:border-slate-600/50 shadow-sm z-10 relative 
                                    transition-transform group-hover:scale-110
                                `}>
                                    {app.isLocked ? <Lock className={compact ? 'w-4 h-4' : 'w-5 h-5'} /> : <Icon className={compact ? 'w-5 h-5' : 'w-6 h-6'} />}
                                </div>

                                {/* Cart badge for locked apps */}
                                {app.isLocked && (
                                    <div className="absolute top-3 right-3 bg-slate-900/10 dark:bg-white/10 p-1 rounded-full">
                                        <ShoppingCart className="w-3 h-3 text-slate-500" />
                                    </div>
                                )}

                                {/* Title */}
                                <h4 className={`font-bold text-slate-900 dark:text-white ${compact ? 'text-sm' : 'text-base'} leading-tight w-full truncate`}>
                                    {app.name}
                                </h4>

                                {/* Description (only if not compact) */}
                                {!compact && (
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1 leading-tight mb-2 line-clamp-1">
                                        {app.description}
                                    </p>
                                )}

                                {/* Price or Progress */}
                                {app.isLocked ? (
                                    <div className={`${compact ? 'mt-1' : 'mt-auto'} flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 rounded-md`}>
                                        <Sparkles className="w-3 h-3 text-violet-600 dark:text-violet-400" />
                                        <span className="text-xs font-bold text-violet-700 dark:text-violet-300">{app.price}€/año</span>
                                    </div>
                                ) : (
                                    <div className={`${compact ? 'mt-1' : 'mt-auto'} w-full h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden`}>
                                        <motion.div
                                            className={`h-full ${style.decoration}`}
                                            initial={{ width: 0 }}
                                            animate={{ width: "100%" }}
                                            transition={{ duration: 1.5, delay: 0.2 }}
                                        />
                                    </div>
                                )}

                                {/* Decorative blob */}
                                <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[50px] -mr-6 -mt-6 pointer-events-none transition-transform group-hover:scale-110 
                                    ${app.isLocked ? 'bg-slate-200/20 dark:bg-slate-600/10' : style.text.replace('text-', 'bg-').replace('600', '500') + '/5'}
                                `} />
                            </motion.button>
                        );
                    })}
                </div>
            )}

            {/* Purchase Dialog */}
            <PurchaseDialog
                app={selectedAppForPurchase}
                open={!!selectedAppForPurchase}
                onClose={() => setSelectedAppForPurchase(null)}
                onPurchaseComplete={() => {
                    if (userId) fetchApps(userId);
                }}
            />
        </>
    );
}

