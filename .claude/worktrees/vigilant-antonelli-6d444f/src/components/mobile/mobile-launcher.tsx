'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
    LayoutGrid, ScanLine, ShoppingCart,
    ChevronRight, Battery, Signal, Wifi,
    Settings, Bell, Search, Monitor, Calendar,
    FileText, KeyRound, MessageCircle,
    ShoppingBag, ChefHat, ListTodo, Lock,
    Wallet, CreditCard, Sparkles, Star,
    Pencil, Check, X as XIcon, CheckSquare, ArrowDown,
    AlertTriangle, Info, Pill, ShieldAlert, Car, Send, Leaf, Brain
} from 'lucide-react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Network } from '@capacitor/network';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import SmartScanner from './smart-scanner';
import ScanRosterDialog from '@/components/apps/mi-hogar/roster/scan-roster-dialog';
import ChatInterface from '@/components/apps/asistente/chat-interface';
import { AppWithStatus, MarketplaceApp, UserAppPurchase } from '@/types/marketplace';
import PurchaseDialog from './purchase-dialog';
import { useRouter } from 'next/navigation';
import { fetchPendingTasks, fetchMedicines, fetchInsurances, fetchVehicles } from '@/components/apps/asistente/data-fetchers';

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

// Helper: load quick app keys from localStorage
function loadQuickApps(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('quioba_quick_apps');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Helper: save quick app keys to localStorage
function saveQuickApps(keys: string[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('quioba_quick_apps', JSON.stringify(keys));
    window.dispatchEvent(new Event('quioba_quick_apps_changed'));
}

export interface NotificationItem {
    id: string;
    title: string;
    message: string;
    type: 'error' | 'warning' | 'info';
    date: string;
    icon: any;
}

interface MobileLauncherProps {
    onLaunchDesktop: () => void;
    user: any;
}

const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
    try {
        await Haptics.impact({ style });
    } catch (e) {
        // Ignorar en web
    }
};

export default function MobileLauncher({ onLaunchDesktop, user: initialUser }: MobileLauncherProps) {
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<any>(initialUser);
    const [profile, setProfile] = useState<any>(null);
    const [currentTime, setCurrentTime] = useState('');
    const [currentDate, setCurrentDate] = useState('');

    // Name editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Quick apps (favorites)
    const [quickAppKeys, setQuickAppKeys] = useState<string[]>([]);

    // Feature States
    const [showScanner, setShowScanner] = useState(false);
    const [showScanRoster, setShowScanRoster] = useState(false);
    const [showAssistant, setShowAssistant] = useState(false);
    const [inlineChatInput, setInlineChatInput] = useState('');
    const [assistantInitialMessage, setAssistantInitialMessage] = useState('');

    // Marketplace States
    const [apps, setApps] = useState<AppWithStatus[]>([]);
    const [loadingApps, setLoadingApps] = useState(true);
    const [selectedAppForPurchase, setSelectedAppForPurchase] = useState<MarketplaceApp | null>(null);

    // Pull to Refresh & Time Themes
    const [timeTheme, setTimeTheme] = useState<'morning' | 'afternoon' | 'night'>('afternoon');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [pullProgress, setPullProgress] = useState(0);
    const startY = useRef(0);

    // Notifications
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef<HTMLDivElement>(null);

    // Network Status
    const [isOffline, setIsOffline] = useState(false);

    // Spotlight Search
    const [showSpotlight, setShowSpotlight] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reorderable Actions
    const [quickActionOrder, setQuickActionOrder] = useState<string[]>(['escanear', 'cuadrante', 'asistente', 'tareas']);

    const handleReorder = (newOrder: string[]) => {
        setQuickActionOrder(newOrder);
        if (typeof window !== 'undefined') {
            localStorage.setItem('quioba_quick_actions_order', JSON.stringify(newOrder));
        }
    };

    const getQuickActionData = (id: string) => {
        switch (id) {
            case 'escanear': return { id, icon: ScanLine, label: 'Escanear', sublabel: 'Producto', colorClass: 'bg-green-100 text-green-800', action: () => setShowScanner(true) };
            case 'cuadrante': return { id, icon: Calendar, label: 'Cuadrante', sublabel: 'Subir Foto', colorClass: 'bg-indigo-50 text-indigo-600', action: () => setShowScanRoster(true) };
            case 'asistente': return { id, icon: Sparkles, label: 'Asistente', sublabel: 'Consultar IA', colorClass: 'bg-violet-50 text-violet-600', action: () => { triggerHaptic(ImpactStyle.Light); setShowAssistant(true); } };
            case 'tareas': return { id, icon: CheckSquare, label: 'Tareas', sublabel: 'Añadir Nueva', colorClass: 'bg-purple-50 text-purple-600', route: '/apps/mi-hogar/tasks' };
        }
        return null;
    };

    // Focus spotlight input when opened
    useEffect(() => {
        if (showSpotlight && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [showSpotlight]);

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true);
        setQuickAppKeys(loadQuickApps());
    }, []);

    // Network status listener
    useEffect(() => {
        let networkListener: any;
        
        const updateOfflineStatus = (e: Event) => setIsOffline(!navigator.onLine);
        
        const initNetwork = async () => {
            try {
                const status = await Network.getStatus();
                setIsOffline(!status.connected);
                
                networkListener = await Network.addListener('networkStatusChange', (status: any) => {
                    setIsOffline(!status.connected);
                });
            } catch (e) {
                // Fallback to web API
                setIsOffline(!navigator.onLine);
                window.addEventListener('offline', updateOfflineStatus);
                window.addEventListener('online', updateOfflineStatus);
            }
        };
        initNetwork();
        return () => {
            if (networkListener) networkListener.remove();
            window.removeEventListener('offline', updateOfflineStatus);
            window.removeEventListener('online', updateOfflineStatus);
        };
    }, []);

    // Close notifications on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus name input when editing starts
    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const loadNotifications = async (userId: string) => {
        try {
            const ctx = { userId };
            const [tasksData, medsData, insurancesData, vehiclesData] = await Promise.all([
                fetchPendingTasks(ctx),
                fetchMedicines(ctx),
                fetchInsurances(ctx),
                fetchVehicles(ctx)
            ]);

            const notifs: NotificationItem[] = [];
            
            if (tasksData.overdue?.length > 0) {
                notifs.push({
                    id: 'tasks-overdue',
                    title: 'Tareas Caducadas',
                    message: `Tienes ${tasksData.overdue.length} tareas vencidas sin completar.`,
                    type: 'error',
                    date: new Date().toISOString(),
                    icon: AlertTriangle
                });
            }
            if (tasksData.today?.length > 0) {
                notifs.push({
                    id: 'tasks-today',
                    title: 'Tareas para Hoy',
                    message: `Tienes ${tasksData.today.length} tareas programadas para hoy.`,
                    type: 'info',
                    date: new Date().toISOString(),
                    icon: CheckSquare
                });
            }
            if (medsData.lowStock?.length > 0) {
                notifs.push({
                    id: 'meds-stock',
                    title: 'Stock Medicamentos',
                    message: `Queda poco de ${medsData.lowStock.map(m => m.name).join(', ')}.`,
                    type: 'warning',
                    date: new Date().toISOString(),
                    icon: Pill
                });
            }
            if (insurancesData.expiringSoon?.length > 0) {
                notifs.push({
                    id: 'ins-exp',
                    title: 'Seguros Próximos',
                    message: `Tus seguros de ${insurancesData.expiringSoon.map(i => i.name).join(', ')} vencen pronto.`,
                    type: 'warning',
                    date: new Date().toISOString(),
                    icon: ShieldAlert
                });
            }
            if (vehiclesData.pendingITV?.length > 0) {
                notifs.push({
                    id: 'car-itv',
                    title: 'ITV Próxima',
                    message: `El vehículo ${vehiclesData.pendingITV[0].name} tiene la ITV pronto.`,
                    type: 'warning',
                    date: new Date().toISOString(),
                    icon: Car
                });
            }
            if (vehiclesData.pendingMaintenance?.length > 0) {
                notifs.push({
                    id: 'car-maint',
                    title: 'Mantenimiento',
                    message: `Revisión pendiente para ${vehiclesData.pendingMaintenance[0].name}.`,
                    type: 'warning',
                    date: new Date().toISOString(),
                    icon: Settings
                });
            }

            setNotifications(notifs);
        } catch (e) {
            console.error('Error fetching notifications:', e);
        }
    };

    const fetchApps = async (userId: string) => {
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('FetchApps Timeout')), 3000)
        );

        try {
            const fetchPromise = (async () => {
                const { data: marketplaceApps, error: appsError } = await supabase
                    .from('marketplace_apps')
                    .select('*')
                    .eq('is_active', true)
                    .order('price', { ascending: true });

                if (appsError || !marketplaceApps || marketplaceApps.length === 0) {
                    console.warn('📱 Marketplace: Using fallback apps', appsError?.message);
                    return withLocalMeditationApp(FALLBACK_APPS);
                }

                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('subscription_tier')
                    .eq('id', userId)
                    .single();

                const isPremium = profileData?.subscription_tier === 'premium';

                if (isPremium) {
                    return withLocalMeditationApp(marketplaceApps.map(app => ({
                        ...app,
                        isOwned: true,
                        isLocked: false
                    })));
                }

                const { data: purchases } = await supabase
                    .from('user_app_purchases')
                    .select('app_id, expires_at')
                    .eq('user_id', userId)
                    .eq('status', 'active');

                const ownedAppIds = new Set(
                    (purchases || [])
                        .filter(p => !p.expires_at || new Date(p.expires_at) > new Date())
                        .map(p => p.app_id)
                );

                return withLocalMeditationApp(marketplaceApps.map(app => ({
                    ...app,
                    isOwned: ownedAppIds.has(app.id),
                    isLocked: !ownedAppIds.has(app.id)
                })));
            })();

            const result = await Promise.race([fetchPromise, timeoutPromise]) as AppWithStatus[];
            setApps(result);
        } catch (error) {
            console.error('📱 Marketplace: Error/Timeout, using fallback', error);
            setApps(withLocalMeditationApp(FALLBACK_APPS));
        } finally {
            setLoadingApps(false);
        }
    };

    // Format time and date
    const updateDateTime = () => {
        const now = new Date();
        setCurrentTime(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
        const dayName = now.toLocaleDateString('es-ES', { weekday: 'long' });
        const day = now.getDate();
        const month = now.toLocaleDateString('es-ES', { month: 'long' });
        // Capitalize first letter
        const capitalizedDay = dayName.charAt(0).toUpperCase() + dayName.slice(1);
        setCurrentDate(`${capitalizedDay}, ${day} de ${month}`);
        
        const hour = now.getHours();
        if (hour >= 6 && hour < 12) setTimeTheme('morning');
        else if (hour >= 18 || hour < 6) setTimeTheme('night');
        else setTimeTheme('afternoon');
    };

    useEffect(() => {
        if (!mounted) return;

        let isReplaced = false;
        const safetyTimeout = setTimeout(() => {
            if (loadingApps && !isReplaced) {
                console.warn('📱 MobileLauncher: Safety timeout reached');
                setApps(FALLBACK_APPS);
                setLoadingApps(false);
            }
        }, 4000);

        const init = async () => {
            try {
                // Use Initial User if available from props to avoid redundant getSession
                const currentUser = initialUser || (await supabase.auth.getSession()).data.session?.user;

                if (currentUser) {
                    setUser(currentUser);
                    
                    // Fetch profile in background
                    supabase.from('profiles').select('*').eq('id', currentUser.id).single()
                        .then(({ data }) => { if (data) setProfile(data); });

                    await fetchApps(currentUser.id);
                    await loadNotifications(currentUser.id);
                } else {
                    console.log('📱 MobileLauncher: No user session, using fallback');
                    setApps(withLocalMeditationApp(FALLBACK_APPS));
                    setLoadingApps(false);
                }
            } catch (err) {
                console.error('📱 MobileLauncher: Initialization error', err);
                setApps(withLocalMeditationApp(FALLBACK_APPS));
                setLoadingApps(false);
            } finally {
                isReplaced = true;
                clearTimeout(safetyTimeout);
            }
        };

        init();
        updateDateTime();

        const timer = setInterval(updateDateTime, 1000);
        return () => {
            clearInterval(timer);
            clearTimeout(safetyTimeout);
        };
    }, [mounted]);

    // --- Name Editing ---
    const startEditingName = () => {
        setEditedName(profile?.nickname || user?.email?.split('@')[0] || '');
        setIsEditingName(true);
    };

    const saveNickname = async () => {
        if (!editedName.trim() || !user) return;
        setSavingName(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ nickname: editedName.trim() })
                .eq('id', user.id);

            if (error) throw error;
            setProfile({ ...profile, nickname: editedName.trim() });
            triggerHaptic(ImpactStyle.Heavy);
        } catch (err) {
            console.error('Error saving nickname:', err);
        } finally {
            setSavingName(false);
            setIsEditingName(false);
        }
    };

    const cancelEditingName = () => {
        setIsEditingName(false);
        setEditedName('');
    };

    // --- Quick Apps ---
    const toggleQuickApp = (appKey: string) => {
        setQuickAppKeys(prev => {
            let next: string[];
            if (prev.includes(appKey)) {
                next = prev.filter(k => k !== appKey);
            } else {
                // Max 3 quick apps
                if (prev.length >= 3) {
                    next = [...prev.slice(1), appKey];
                } else {
                    next = [...prev, appKey];
                }
            }
            saveQuickApps(next);
            triggerHaptic(ImpactStyle.Medium);
            return next;
        });
    };

    const quickApps = apps.filter(a => quickAppKeys.includes(a.key) && !a.isLocked);

    // PIN Modal State
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pendingSecureApp, setPendingSecureApp] = useState<AppWithStatus | null>(null);

    const handlePinKeypad = (num: string) => {
        triggerHaptic(ImpactStyle.Light);
        const newPin = pinInput + num;
        setPinInput(newPin);
        if (newPin.length === 4) {
            if (newPin === '1234') { 
                triggerHaptic(ImpactStyle.Medium);
                setShowPinModal(false);
                if (pendingSecureApp) router.push(pendingSecureApp.route);
                setPendingSecureApp(null);
                setPinInput('');
            } else {
                triggerHaptic(ImpactStyle.Heavy);
                setPinInput('');
            }
        }
    };

    const handleAppClick = (app: AppWithStatus) => {
        if (app.isLocked) {
            setSelectedAppForPurchase(app);
            return;
        }
        
        if (app.key === 'passwords' || app.key === 'documents') {
            triggerHaptic(ImpactStyle.Light);
            setPendingSecureApp(app);
            setPinInput('');
            setShowPinModal(true);
            return;
        }
        
        if (app.key === 'desktop') {
            onLaunchDesktop();
        } else if (app.key === 'scanner') {
            triggerHaptic(ImpactStyle.Light);
            setShowScanner(true);
        } else if (app.key === 'roster') {
            triggerHaptic(ImpactStyle.Light);
            setShowScanRoster(true);
        } else {
            triggerHaptic(ImpactStyle.Light);
            router.push(app.route);
        }
    };

    const getAppStyle = (appKey: string) => {
        switch (appKey) {
            case 'desktop': return { bg: 'bg-green-100', text: 'text-green-800', decoration: 'bg-green-800', shadow: 'green' };
            case 'shopping': return { bg: 'bg-orange-50', text: 'text-orange-600', decoration: 'bg-orange-500', shadow: 'orange' };
            case 'chef-ia': return { bg: 'bg-red-50', text: 'text-red-600', decoration: 'bg-red-500', shadow: 'red' };
            case 'tasks': return { bg: 'bg-purple-50', text: 'text-purple-600', decoration: 'bg-purple-500', shadow: 'purple' };
            case 'roster': return { bg: 'bg-indigo-50', text: 'text-indigo-600', decoration: 'bg-indigo-500', shadow: 'indigo' };
            case 'documents': return { bg: 'bg-blue-50', text: 'text-blue-600', decoration: 'bg-blue-500', shadow: 'blue' };
            case 'passwords': return { bg: 'bg-amber-50', text: 'text-amber-600', decoration: 'bg-amber-500', shadow: 'amber' };
            case 'assistant': return { bg: 'bg-violet-50', text: 'text-violet-600', decoration: 'bg-violet-500', shadow: 'violet' };
            case 'huerto': return { bg: 'bg-green-100', text: 'text-green-800', decoration: 'bg-green-800', shadow: 'green' };
            default: return { bg: 'bg-slate-50', text: 'text-slate-600', decoration: 'bg-slate-500', shadow: 'slate' };
        }
    };

    const filteredApps = apps.filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (app.description && app.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (!mounted) {
        return (
            <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center pt-20 px-6 gap-8">
                {/* Time skeleton */}
                <div className="text-center space-y-2">
                    <div className="h-12 w-32 bg-slate-200/60 rounded-2xl animate-pulse mx-auto" />
                    <div className="h-4 w-48 bg-slate-200/40 rounded-lg animate-pulse mx-auto" />
                </div>
                {/* Quick actions skeleton */}
                <div className="flex gap-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="w-16 h-20 bg-slate-200/50 rounded-2xl animate-pulse" />
                    ))}
                </div>
                {/* App grid skeleton */}
                <div className="grid grid-cols-4 gap-4 w-full max-w-sm">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="flex flex-col items-center gap-2">
                            <div className="w-14 h-14 bg-slate-200/50 rounded-2xl animate-pulse" />
                            <div className="h-3 w-10 bg-slate-200/40 rounded animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const handleTouchStart = (e: React.TouchEvent) => {
        if (typeof window !== 'undefined' && window.scrollY === 0) startY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (startY.current > 0 && typeof window !== 'undefined' && window.scrollY <= 0) {
            const currentY = e.touches[0].clientY;
            const diff = currentY - startY.current;
            if (diff > 0 && diff < 150) {
                setPullProgress(Math.min(diff / 80, 1));
            }
        }
    };

    const handleTouchEnd = async () => {
        if (pullProgress > 0.8 && !isRefreshing) {
            triggerHaptic(ImpactStyle.Heavy);
            setIsRefreshing(true);
            setPullProgress(1);
            
            updateDateTime();
            if (user) await fetchApps(user.id);
            
            triggerHaptic(ImpactStyle.Light);
            setIsRefreshing(false);
        }
        setPullProgress(0);
        startY.current = 0;
    };

    return (
        <div 
            className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans relative overflow-x-hidden selection:bg-green-100 pb-24"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Global Spotlight */}
            <AnimatePresence>
                {showSpotlight && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed inset-0 z-[150] bg-slate-900/40 backdrop-blur-sm p-4 pt-20"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setShowSpotlight(false);
                        }}
                    >
                        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-w-md mx-auto flex flex-col max-h-[80vh]">
                            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
                                <Search className="w-5 h-5 text-green-800" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar aplicaciones o funciones..."
                                    className="flex-1 outline-none text-base text-slate-800 placeholder:text-slate-400 bg-transparent font-medium"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <button onClick={() => setShowSpotlight(false)} className="p-2 text-slate-400 hover:text-slate-600 bg-white shadow-sm border border-slate-200 rounded-full transition-all active:scale-90">
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                            
                            <div className="overflow-y-auto p-4 flex flex-col gap-2">
                                {searchQuery.trim() === '' ? (
                                    <div className="text-center text-slate-500 py-10 flex flex-col items-center">
                                        <Search className="w-10 h-10 mb-3 opacity-20" />
                                        <p className="text-sm font-medium">Busca utilidades, funciones o contenido de Quioba.</p>
                                    </div>
                                ) : filteredApps.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm py-8 font-medium">No se encontraron resultados para "{searchQuery}"</p>
                                ) : (
                                    filteredApps.map(app => {
                                        const Icon = IconMap[app.icon_key] || LayoutGrid;
                                        const style = getAppStyle(app.key);
                                        return (
                                            <button
                                                key={app.id}
                                                onClick={() => {
                                                    setShowSpotlight(false);
                                                    handleAppClick(app);
                                                }}
                                                className="flex items-center gap-4 p-3 rounded-2xl hover:bg-slate-50 text-left transition-colors active:scale-95"
                                            >
                                                <div className={`p-3 rounded-xl ${style.bg} ${style.text}`}>
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 leading-tight">{app.name}</h4>
                                                    {app.isLocked ? (
                                                        <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-2 py-0.5 rounded-full inline-flex items-center gap-1 mt-1">
                                                            <Lock className="w-3 h-3" /> Requiere Quioba+
                                                        </span>
                                                    ) : (
                                                        <p className="text-xs text-slate-500 mt-1 line-clamp-1 leading-snug">{app.description}</p>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* PIN Modal for Sensitive Apps */}
            <AnimatePresence>
                {showPinModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-slate-900/60 backdrop-blur-md flex items-end justify-center sm:items-center"
                    >
                        <motion.div 
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-white rounded-t-[32px] sm:rounded-3xl w-full max-w-sm p-6 pb-12 shadow-2xl flex flex-col items-center"
                        >
                            <div className="w-12 h-1.5 bg-slate-200 rounded-full mb-8"></div>
                            
                            <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mb-4 shadow-sm">
                                <Lock className="w-8 h-8" />
                            </div>
                            
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Acceso Seguro</h3>
                            <p className="text-sm text-slate-500 mb-8 max-w-[250px] text-center">
                                Introduce tu PIN (por defecto 1234) para acceder a {pendingSecureApp?.name || 'esta aplicación'}.
                            </p>

                            {/* PIN Display */}
                            <div className="flex gap-4 mb-10">
                                {[0, 1, 2, 3].map((index) => (
                                    <div 
                                        key={index}
                                        className={`w-4 h-4 rounded-full transition-all duration-200 ${
                                            pinInput.length > index 
                                                ? 'bg-green-800 scale-110 shadow-[0_0_10px_rgba(22,101,52,0.3)]' 
                                                : 'bg-slate-200'
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Numpad */}
                            <div className="grid grid-cols-3 gap-x-8 gap-y-6 mb-8">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => handlePinKeypad(num.toString())}
                                        className="w-16 h-16 rounded-full text-2xl font-semibold text-slate-700 hover:bg-slate-100 hover:text-green-800 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                    >
                                        {num}
                                    </button>
                                ))}
                                <div className="col-start-2">
                                    <button
                                        onClick={() => handlePinKeypad('0')}
                                        className="w-16 h-16 rounded-full text-2xl font-semibold text-slate-700 hover:bg-slate-100 hover:text-green-800 active:bg-slate-200 active:scale-95 transition-all flex items-center justify-center"
                                    >
                                        0
                                    </button>
                                </div>
                                <div className="col-start-3 flex items-center justify-center">
                                    <button
                                        onClick={() => {
                                            triggerHaptic(ImpactStyle.Light);
                                            setPinInput(prev => prev.slice(0, -1));
                                        }}
                                        disabled={pinInput.length === 0}
                                        className="w-12 h-12 rounded-full text-slate-400 hover:bg-slate-100 hover:text-rose-500 disabled:opacity-30 disabled:hover:bg-transparent active:scale-95 transition-all flex items-center justify-center"
                                    >
                                        <XIcon className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>
                            
                            <button
                                onClick={() => {
                                    setShowPinModal(false);
                                    setPinInput('');
                                    setPendingSecureApp(null);
                                }}
                                className="text-slate-400 font-medium py-3 px-6 hover:bg-slate-50 rounded-xl transition-colors active:scale-95"
                            >
                                Cancelar
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Offline Indicator */}
            <AnimatePresence>
                {isOffline && (
                    <motion.div 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="fixed top-0 left-0 right-0 z-[100] flex justify-center mt-2 mx-4 pointer-events-none"
                    >
                        <div className="bg-slate-800/90 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-xs font-semibold">
                            <Wifi className="w-4 h-4 text-slate-400 opacity-50 relative">
                                <span className="absolute inset-0 bg-red-500 w-[2px] h-5 rotate-45 left-2 -top-0.5 rounded-full" />
                            </Wifi>
                            Sin conexión
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pull to Refresh Indicator */}
            <div 
                className="absolute top-0 left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform"
                style={{ 
                    transform: `translateY(${pullProgress > 0 || isRefreshing ? Math.max(0, (pullProgress * 60) - 10) : -50}px)`,
                    opacity: pullProgress > 0 || isRefreshing ? 1 : 0
                }}
            >
                <div className="bg-white rounded-full p-2.5 shadow-md border border-slate-100">
                    {isRefreshing ? (
                        <div className="w-5 h-5 border-2 border-green-800 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <ArrowDown 
                            className="w-5 h-5 text-green-800 transition-transform" 
                            style={{ transform: `rotate(${pullProgress * 180}deg)` }} 
                        />
                    )}
                </div>
            </div>

            {/* Ambient Background Elements */}
            <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[30%] blur-[100px] rounded-full pointer-events-none transition-colors duration-1000 ${
                timeTheme === 'morning' ? 'bg-amber-100/40' : 
                timeTheme === 'afternoon' ? 'bg-green-100/40' : 'bg-indigo-300/20'
            }`} />
            <div className={`absolute bottom-[10%] right-[-10%] w-[50%] h-[40%] blur-[120px] rounded-full pointer-events-none transition-colors duration-1000 ${
                timeTheme === 'morning' ? 'bg-orange-100/30' : 
                timeTheme === 'afternoon' ? 'bg-blue-100/30' : 'bg-violet-300/20'
            }`} />

            {/* Header Section */}
            <header className="px-6 pt-8 pb-10 bg-white/60 backdrop-blur-xl rounded-b-[48px] shadow-[0_8px_32px_rgba(0,0,0,0.04)] border-b border-white/40 mb-8 relative z-10 mx-2 mt-2">
                {/* Date and Time Row */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center justify-between mb-4"
                >
                    <p className="text-xs font-medium text-slate-400 tracking-wide">
                        {currentDate}
                    </p>
                    <p className="text-xs font-bold text-green-800 tabular-nums">
                        {currentTime}
                    </p>
                </motion.div>

                <div className="flex justify-between items-start mb-8">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                        className="flex-1 mr-4"
                    >
                        <p className="text-slate-400 text-sm font-medium mb-1 tracking-wide">👋 ¡Hola de nuevo!</p>

                        {/* Editable Name */}
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    ref={nameInputRef}
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveNickname();
                                        if (e.key === 'Escape') cancelEditingName();
                                    }}
                                    className="text-2xl font-extrabold text-slate-900 tracking-tight bg-white border-2 border-green-800 rounded-xl px-3 py-1 outline-none focus:ring-2 focus:ring-green-100 w-full max-w-[200px]"
                                    maxLength={20}
                                />
                                <button
                                    onClick={saveNickname}
                                    disabled={savingName}
                                    className="p-2 bg-green-800 text-white rounded-xl hover:bg-green-900 transition-colors shadow-sm"
                                >
                                    <Check className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={cancelEditingName}
                                    className="p-2 bg-slate-200 text-slate-600 rounded-xl hover:bg-slate-300 transition-colors"
                                >
                                    <XIcon className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                    {user ? (
                                        profile?.nickname || user?.email?.split('@')[0] || 'Usuario'
                                    ) : (
                                        <Link href="/login" className="text-green-800 font-bold decoration-green-100 underline underline-offset-4">
                                            Iniciar Sesión
                                        </Link>
                                    )}
                                </h1>
                                <button
                                    onClick={startEditingName}
                                    className="p-1.5 text-slate-300 hover:text-green-800 hover:bg-green-50 rounded-lg transition-all"
                                    title="Cambiar nombre"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </motion.div>
                    
                    <div className="flex items-center gap-3 relative" ref={notifRef}>
                        <button
                            onClick={() => {
                                triggerHaptic(ImpactStyle.Light);
                                setShowSpotlight(true);
                            }}
                            className="p-2 text-slate-400 hover:text-green-800 hover:bg-green-50 rounded-full transition-all active:scale-90"
                        >
                            <Search className="w-6 h-6" />
                        </button>

                        <button 
                            onClick={() => {
                                triggerHaptic(ImpactStyle.Light);
                                setShowNotifications(!showNotifications);
                            }}
                            className="relative p-2 text-slate-400 hover:text-green-800 hover:bg-green-50 rounded-full transition-all active:scale-90"
                        >
                            <Bell className="w-6 h-6" />
                            {notifications.length > 0 && (
                                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 bg-red-500 border-2 border-white rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm">
                                    {notifications.length}
                                </span>
                            )}
                        </button>
                        
                        <AnimatePresence>
                            {showNotifications && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full right-0 mt-2 w-72 bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-slate-100 z-50 overflow-hidden"
                                >
                                    <div className="p-3 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                                        <h3 className="font-bold text-slate-800 text-sm">Notificaciones</h3>
                                        <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                            {notifications.length} Nuevas
                                        </span>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto p-1">
                                        {notifications.length === 0 ? (
                                            <div className="p-4 text-center text-slate-400">
                                                <Bell className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                                <p className="text-xs font-medium">No tienes notificaciones</p>
                                            </div>
                                        ) : (
                                            notifications.map(notif => {
                                                const Icon = notif.icon;
                                                const bgColors = {
                                                    error: 'bg-red-50 text-red-600 border-red-100',
                                                    warning: 'bg-amber-50 text-amber-600 border-amber-100',
                                                    info: 'bg-blue-50 text-blue-600 border-blue-100'
                                                };
                                                return (
                                                    <div key={notif.id} className="p-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer flex gap-3">
                                                        <div className={`mt-0.5 p-2 rounded-xl flex-shrink-0 border ${bgColors[notif.type]}`}>
                                                            <Icon className="w-4 h-4" />
                                                        </div>
                                                        <div>
                                                            <p className="text-xs font-bold text-slate-800 leading-tight">{notif.title}</p>
                                                            <p className="text-[11px] text-slate-500 mt-1 leading-snug">{notif.message}</p>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <Link href="/profile">
                            <motion.div
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => triggerHaptic(ImpactStyle.Light)}
                            >
                                <Avatar className="w-14 h-14 ring-4 ring-white shadow-xl cursor-pointer">
                                    <AvatarImage src={profile?.custom_avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                                    <AvatarFallback className="bg-green-800 text-white font-bold text-xl">
                                        {profile?.nickname?.[0]?.toUpperCase() || 'Q'}
                                    </AvatarFallback>
                                </Avatar>
                            </motion.div>
                        </Link>
                    </div>
                </div>

                {/* Quick Actions (Replacing Search) */}
                <Reorder.Group
                    axis="y"
                    values={quickActionOrder}
                    onReorder={handleReorder}
                    className="grid grid-cols-2 gap-3 mt-4"
                >
                    {quickActionOrder.map(id => {
                        const data = getQuickActionData(id);
                        if (!data) return null;
                        const Icon = data.icon;
                        
                        const innerBtn = (
                            <div className="flex items-center gap-3 p-3 bg-white/80 backdrop-blur-md rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.03)] border border-white/60 text-left w-full cursor-grab active:cursor-grabbing hover:bg-white transition-all transform-gpu">
                                <div className={`p-2.5 rounded-[14px] ${data.colorClass}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="leading-tight">
                                    <span className="block text-[11px] font-bold text-slate-800">{data.label}</span>
                                    <span className="block text-[10px] font-medium text-slate-400">{data.sublabel}</span>
                                </div>
                            </div>
                        );

                        return (
                            <Reorder.Item 
                                key={data.id} 
                                value={data.id}
                                className="w-full"
                                whileDrag={{ scale: 1.05, zIndex: 10, cursor: "grabbing" }}
                            >
                                {data.route ? (
                                    <Link href={data.route} className="block w-full" draggable="false">
                                        {innerBtn}
                                    </Link>
                                ) : (
                                    <button onClick={data.action} className="block w-full text-left" draggable="false">
                                        {innerBtn}
                                    </button>
                                )}
                            </Reorder.Item>
                        );
                    })}
                </Reorder.Group>
            </header>

            {/* Main Content */}
            <main className="px-6 relative z-10">
                {/* Quick Access Section */}
                {quickApps.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <div className="flex items-center justify-between mb-4 px-1">
                            <h2 className="font-extrabold text-lg text-slate-900 tracking-tight flex items-center gap-2">
                                <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
                                Acceso Rápido
                            </h2>
                            <span className="text-[10px] font-bold text-slate-400">{quickApps.length}/3</span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto no-scrollbar">
                            {quickApps.map((app) => {
                                const Icon = IconMap[app.icon_key] || LayoutGrid;
                                const style = getAppStyle(app.key);
                                return (
                                    <motion.button
                                        key={`quick-${app.id}`}
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => handleAppClick(app)}
                                        className="flex flex-col items-center gap-2 min-w-[80px]"
                                    >
                                        <div className={`w-16 h-16 ${style.bg} ${style.text} rounded-[22px] flex items-center justify-center border border-white/50 shadow-md transition-transform hover:scale-105`}>
                                            <Icon className="w-7 h-7" />
                                        </div>
                                        <span className="text-[11px] font-semibold text-slate-600 text-center leading-tight w-[80px] truncate">
                                            {app.name}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* AI Inline Input */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.25 }}
                    className="mb-6 relative"
                >
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        if (inlineChatInput.trim()) {
                            triggerHaptic(ImpactStyle.Light);
                            setAssistantInitialMessage(inlineChatInput.trim());
                            setInlineChatInput('');
                            setShowAssistant(true);
                        }
                    }}>
                        <div className="relative flex items-center shadow-[0_4px_16px_rgba(0,0,0,0.04)] rounded-[20px] bg-white border border-slate-100 overflow-hidden group focus-within:ring-2 focus-within:ring-green-100 transition-all">
                            <div className="pl-4 pr-2 text-violet-500">
                                <Sparkles className="w-5 h-5 animate-pulse" />
                            </div>
                            <input
                                type="text"
                                placeholder="Pregúntale a Quioba... (ej. ¿Qué tareas tengo hoy?)"
                                value={inlineChatInput}
                                onChange={(e) => setInlineChatInput(e.target.value)}
                                className="flex-1 py-4 bg-transparent outline-none text-sm text-slate-700 placeholder:text-slate-400 font-medium"
                            />
                            <button
                                type="submit"
                                disabled={!inlineChatInput.trim()}
                                className="p-3 mr-1 bg-violet-50 text-violet-600 rounded-xl hover:bg-violet-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4 ml-0.5" />
                            </button>
                        </div>
                    </form>
                </motion.div>

                {/* AI Smart Suggestion Widget */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mb-8 relative"
                >
                    <div className={`p-4 rounded-[24px] flex items-start gap-4 shadow-sm relative overflow-hidden group border transition-colors duration-500 ${
                        timeTheme === 'morning' ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-100' :
                        timeTheme === 'afternoon' ? 'bg-gradient-to-br from-green-700/10 to-green-800/5 border-green-100' :
                        'bg-gradient-to-br from-indigo-500/10 to-violet-500/5 border-indigo-100'
                    }`}>
                        <div className="absolute inset-0 bg-white/40 group-hover:bg-white/60 transition-colors pointer-events-none" />
                        
                        <div className={`relative z-10 p-2.5 rounded-[16px] shadow-sm transition-colors duration-500 ${
                            timeTheme === 'morning' ? 'bg-amber-100 text-amber-600' :
                            timeTheme === 'afternoon' ? 'bg-green-100 text-green-800' :
                            'bg-indigo-100 text-indigo-600'
                        }`}>
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </div>
                        
                        <div className="relative z-10 flex-1">
                            <h3 className="text-sm font-bold text-slate-800 mb-1">
                                {timeTheme === 'morning' ? '¡Buenos días!' : 
                                 timeTheme === 'afternoon' ? '¡Buenas tardes!' : '¡A relajar!'}
                            </h3>
                            <p className="text-xs font-medium text-slate-600 leading-snug">
                                {timeTheme === 'morning' ? 'Revisé tu agenda y tienes 2 tareas pendientes hoy. ¿Las organizamos?' : 
                                 timeTheme === 'afternoon' ? 'Es buen momento para pensar en la cena. Chef IA tiene 3 recetas listas para ti.' : 
                                 'He silenciado las notificaciones no críticas para que descanses.'}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Apps Grid */}
                <div className="flex items-center justify-between mb-5 px-1">
                    <h2 className="font-extrabold text-xl text-slate-900 tracking-tight">Mis Aplicaciones</h2>
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-full">
                        {apps.filter(a => a.isOwned).length} Activas
                    </span>
                </div>

                {loadingApps ? (
                    <div className="grid grid-cols-2 gap-5 animate-pulse">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-40 bg-white/50 rounded-[28px]" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-5 mb-20">
                        {apps.map((app) => {
                            const Icon = IconMap[app.icon_key] || LayoutGrid;
                            const style = getAppStyle(app.key);
                            const isQuick = quickAppKeys.includes(app.key);

                            return (
                                <motion.button
                                    key={app.id}
                                    whileHover={{ y: -4 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => handleAppClick(app)}
                                    className={`
                                        bg-white/70 backdrop-blur-md p-6 rounded-[28px] shadow-[0_4px_20px_rgba(0,0,0,0.03)] 
                                        border border-white/60 flex flex-col items-start text-left relative overflow-hidden group
                                        ${app.isLocked ? 'opacity-80 grayscale-[0.3]' : ''}
                                    `}
                                >
                                    {/* Quick App Star Toggle */}
                                    {!app.isLocked && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleQuickApp(app.key);
                                            }}
                                            className={`absolute top-3 right-3 p-1.5 rounded-full transition-all z-20 ${
                                                isQuick
                                                    ? 'text-amber-400 bg-amber-50'
                                                    : 'text-slate-200 hover:text-amber-300 hover:bg-amber-50/50'
                                            }`}
                                            title={isQuick ? 'Quitar de rápidos' : 'Añadir a rápidos'}
                                        >
                                            <Star className={`w-4 h-4 ${isQuick ? 'fill-amber-400' : ''}`} />
                                        </button>
                                    )}

                                    {/* App Icon Circle */}
                                    <div className={`w-12 h-12 ${app.isLocked ? 'bg-slate-100 text-slate-400' : style.bg + ' ' + style.text} rounded-[18px] flex items-center justify-center mb-4 border border-white/50 shadow-sm z-10 relative transition-transform group-hover:scale-110`}>
                                        {app.isLocked ? <Lock className="w-5 h-5" /> : <Icon className="w-6 h-6" />}
                                    </div>

                                    {app.isLocked && (
                                        <div className="absolute top-4 right-4 bg-slate-900/10 p-1.5 rounded-full backdrop-blur-sm">
                                            <ShoppingCart className="w-3 h-3 text-slate-600" />
                                        </div>
                                    )}

                                    <h4 className="font-bold text-slate-900 text-base leading-tight w-full truncate">
                                        {app.name}
                                    </h4>

                                    <p className="text-[11px] font-medium text-slate-500 mt-1 leading-tight mb-3 line-clamp-1">
                                        {app.description}
                                    </p>

                                    {/* Price Tag or Progress Bar */}
                                    {app.isLocked ? (
                                        <div className="mt-auto flex items-center gap-1.5 bg-violet-100 px-2 py-1 rounded-lg">
                                            <Sparkles className="w-3 h-3 text-violet-600" />
                                            <span className="text-xs font-bold text-violet-700">{app.price}€</span>
                                        </div>
                                    ) : (
                                        <div className="mt-auto w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                            <motion.div
                                                className={`h-full ${style.decoration}`}
                                                initial={{ width: 0 }}
                                                animate={{ width: "100%" }}
                                                transition={{ duration: 1.5, delay: 0.2 }}
                                            />
                                        </div>
                                    )}

                                    {/* Decorative Blob */}
                                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-bl-[60px] -mr-8 -mt-8 pointer-events-none transition-transform group-hover:scale-110 
                                        ${app.isLocked ? 'bg-slate-200/20' : style.text.replace('text-', 'bg-').replace('600', '500') + '/5'}
                                    `} />
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Assistant Floating Panel */}
            {showAssistant && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 h-[25vh] bg-white dark:bg-slate-900 rounded-t-[24px] shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-[60] overflow-hidden"
                >
                    <div className="h-full flex flex-col">
                        <div className="flex items-center justify-between px-4 py-2 border-b bg-violet-50 dark:bg-violet-900/20">
                            <span className="font-semibold text-violet-700 dark:text-violet-300 flex items-center gap-2">
                                <MessageCircle className="w-4 h-4" /> Asistente Quioba
                            </span>
                            <button
                                onClick={() => setShowAssistant(false)}
                                className="p-1 hover:bg-violet-100 dark:hover:bg-violet-800/30 rounded-full"
                            >
                                <XIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ChatInterface userId={user?.id || ''} userName={profile?.nickname} compact />
                        </div>
                    </div>
                </motion.div>
            )}

            {/* Dynamic Bottom Navigation is now handled globally by MobileNav */}

            {/* Modals */}
            {showScanner && (
                <SmartScanner
                    onClose={() => setShowScanner(false)}
                    onProductAdded={async (product) => {
                        console.log('Product added', product);
                    }}
                />
            )}

            <ScanRosterDialog
                open={showScanRoster}
                onOpenChange={setShowScanRoster}
                onSuccess={() => setShowScanRoster(false)}
            />

            <PurchaseDialog
                app={selectedAppForPurchase}
                open={!!selectedAppForPurchase}
                onClose={() => setSelectedAppForPurchase(null)}
                onPurchaseComplete={() => {
                    if (user) fetchApps(user.id);
                }}
            />
        </div>
    );
}
