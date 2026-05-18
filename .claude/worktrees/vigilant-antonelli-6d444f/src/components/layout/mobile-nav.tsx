'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutGrid, ShoppingCart, MessageCircle, Settings,
    ListTodo, Calendar, FileText, KeyRound, Monitor, ChefHat, ShoppingBag, X as XIcon, ChevronLeft, Brain
} from 'lucide-react';
import Link from 'next/link';
import { useGlobalMenu } from '@/context/GlobalMenuContext';
import SmartScanner from '@/components/mobile/smart-scanner';
import ChatInterface from '@/components/apps/asistente/chat-interface';
import { supabase } from '@/lib/supabase';

// Helper: load quick app keys
function loadQuickApps(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem('quioba_quick_apps');
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Icon mapping explicitly
const IconMap: { [key: string]: any } = {
    Settings, ShoppingCart, ShoppingBag, ChefHat,
    ListTodo, Calendar, FileText, KeyRound, MessageCircle,
    Monitor, LayoutGrid, Brain
};

export default function MobileNav() {
    const { isLauncherMode } = useGlobalMenu();
    const pathname = usePathname();
    const router = useRouter();
    const [quickAppKeys, setQuickAppKeys] = useState<string[]>([]);

    // Minimal app data structure for rendering the bottom nav buttons
    const [coreApps, setCoreApps] = useState<any[]>([
        { key: 'desktop', name: 'Quioba Web', icon_key: 'Settings', route: '/desktop' },
        { key: 'shopping', name: 'Lista', icon_key: 'ShoppingBag', route: '/apps/mi-hogar/shopping' },
        { key: 'chef-ia', name: 'Chef', icon_key: 'ChefHat', route: '/apps/mi-hogar/chef' },
        { key: 'tasks', name: 'Tareas', icon_key: 'ListTodo', route: '/apps/mi-hogar/tasks' },
        { key: 'roster', name: 'Roster', icon_key: 'Calendar', route: '/apps/mi-hogar/roster' },
        { key: 'documents', name: 'Documentos', icon_key: 'FileText', route: '/apps/mi-hogar/documents' },
        { key: 'passwords', name: 'Claves', icon_key: 'KeyRound', route: '/apps/passwords' },
        { key: 'assistant', name: 'Asistente', icon_key: 'MessageCircle', route: '/apps/mi-hogar/asistente' },
        { key: 'meditation', name: 'Pausa', icon_key: 'Brain', route: '/apps/mi-hogar/meditation' },
    ]);

    const [showScanner, setShowScanner] = useState(false);
    const [showAssistant, setShowAssistant] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);

    // Initial auth & sync
    useEffect(() => {
        supabase.auth.getSession().then(({ data }) => {
            if (data?.session?.user) {
                setUser(data.session.user);
                supabase.from('profiles').select('nickname').eq('id', data.session.user.id).single()
                    .then(({ data: profileData }) => {
                        if (profileData) setProfile(profileData);
                    });
            }
        });

        // Event listener for quick apps syncing
        const updateKeys = () => setQuickAppKeys(loadQuickApps());
        updateKeys(); // Initial load
        window.addEventListener('quioba_quick_apps_changed', updateKeys);
        return () => window.removeEventListener('quioba_quick_apps_changed', updateKeys);
    }, []);

    // Only render on mobile (isLauncherMode) and NEVER on auth pages
    const isAuthPage = pathname === '/login' || pathname?.includes('/login') || pathname?.includes('/register');
    if (!isLauncherMode || isAuthPage) return null;

    // Build the rendered quick apps array
    const quickApps = coreApps.filter(app => quickAppKeys.includes(app.key));

    const getAppStyle = (appKey: string) => {
        switch (appKey) {
            case 'desktop': return { text: 'text-green-800', bg: 'bg-green-100' };
            case 'shopping': return { text: 'text-orange-600', bg: 'bg-orange-50' };
            case 'chef-ia': return { text: 'text-red-600', bg: 'bg-red-50' };
            case 'tasks': return { text: 'text-purple-600', bg: 'bg-purple-50' };
            case 'roster': return { text: 'text-indigo-600', bg: 'bg-indigo-50' };
            case 'documents': return { text: 'text-blue-600', bg: 'bg-blue-50' };
            case 'passwords': return { text: 'text-amber-600', bg: 'bg-amber-50' };
            case 'assistant': return { text: 'text-violet-600', bg: 'bg-violet-50' };
            default: return { text: 'text-slate-600', bg: 'bg-slate-50' };
        }
    };

    const handleAppClick = (app: any) => {
        if (app.key === 'desktop') {
            window.location.href = '/desktop'; // full page reload to switch modes
        } else if (app.key === 'scanner') {
            setShowScanner(true);
        } else {
            router.push(app.route);
        }
    };

    return (
        <div className="z-50">
            {/* Global Back Button (only on subpages) */}
            {pathname !== '/' && (
                <button
                    onClick={() => router.back()}
                    className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-4 z-50 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/80 backdrop-blur-xl rounded-2xl border border-white shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-slate-600 hover:text-green-800 hover:bg-green-100 transition-all active:scale-90"
                    title="Volver"
                >
                    <ChevronLeft className="w-6 h-6" strokeWidth={2.5} />
                </button>
            )}

            {/* Assistant Floating Panel */}
            <AnimatePresence>
                {showAssistant && (
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed bottom-0 left-0 right-0 h-[30vh] bg-white dark:bg-slate-900 shadow-[0_-10px_40px_rgba(0,0,0,0.15)] z-[60] overflow-hidden"
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
            </AnimatePresence>

            {/* Modals */}
            {showScanner && (
                <SmartScanner
                    onClose={() => setShowScanner(false)}
                    onProductAdded={async (product) => {
                        console.log('Product added', product);
                    }}
                />
            )}

            {/* Dynamic Bottom Navigation Bar - Disabled in favor of global Taskbar */}
            {/* 
            <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[max(1.5rem,env(safe-area-inset-bottom))] px-4 pointer-events-none">
                ...
            </div>
            */}
        </div>
    );
}

