'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Newspaper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { motion } from 'framer-motion';
import { useGlobalMenu } from '@/context/GlobalMenuContext';

export default function Taskbar() {
    const pathname = usePathname();
    const [hoveredApp, setHoveredApp] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const { toggleStartMenu, isStartMenuOpen, isLauncherMode, setIsLauncherMode } = useGlobalMenu();

    // Prevent hydration mismatch - only check window after mount
    useEffect(() => {
        setMounted(true);
        setIsMobile(window.innerWidth < 768);

        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // if (isLauncherMode) return null;

    const handleNavClick = async () => {
        try {
            await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {
            // Ignore errors (e.g. on web)
        }
    };

    // Estilos premium para los iconos
    const getIconStyles = (id: string, active: boolean) => {
        if (!active) return {
            bg: 'bg-slate-100/50 dark:bg-slate-800/40',
            icon: 'text-slate-500 dark:text-slate-400',
            border: 'border-slate-200/50 dark:border-white/5',
            glow: ''
        };

        switch (id) {
            case 'home':
                return {
                    bg: 'bg-gradient-to-br from-green-600 to-green-800 shadow-lg shadow-green-900/30',
                    icon: 'text-white drop-shadow-sm',
                    border: 'border-green-500/50',
                    glow: 'after:content-[""] after:absolute after:-inset-1 after:bg-green-600/20 after:rounded-3xl after:blur-md after:-z-10'
                };
            case 'articles':
                return {
                    bg: 'bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/30',
                    icon: 'text-white drop-shadow-sm',
                    border: 'border-blue-300/50',
                    glow: 'after:content-[""] after:absolute after:-inset-1 after:bg-blue-400/20 after:rounded-3xl after:blur-md after:-z-10'
                };
            case 'profile':
                return {
                    bg: 'bg-gradient-to-br from-violet-400 to-violet-600 shadow-lg shadow-violet-500/30',
                    icon: 'text-white drop-shadow-sm',
                    border: 'border-violet-300/50',
                    glow: 'after:content-[""] after:absolute after:-inset-1 after:bg-violet-400/20 after:rounded-3xl after:blur-md after:-z-10'
                };
            default:
                return { bg: 'bg-transparent', icon: 'text-slate-500', border: 'border-transparent', glow: '' };
        }
    };

    const apps = [
        {
            id: 'start',
            label: 'Menú',
            icon: (active: boolean) => (
                <div className={cn(
                    "relative w-12 h-12 rounded-2xl p-1 transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]",
                    active ? "rotate-[10deg] scale-110" : "hover:rotate-[-5deg]"
                )}>
                    {/* Glass backdrop for logo */}
                    <div className={cn(
                        "w-full h-full bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center p-0.5 shadow-md border overflow-hidden",
                        active ? "border-green-800 shadow-green-800/20" : "border-slate-200/60"
                    )}>
                        <img src="/images/logo.png" alt="Quioba" className="w-full h-full object-contain" />
                    </div>
                    {/* Ring animation */}
                    {active && (
                        <motion.div
                            layoutId="logoRing"
                            className="absolute -inset-0.5 border-2 border-green-800/40 rounded-2xl"
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                        />
                    )}
                </div>
            ),
            href: '#start',
            isStart: true,
        },
        {
            id: 'home',
            label: 'Dashboard',
            icon: (active: boolean) => {
                const styles = getIconStyles('home', active);
                return (
                    <div className={cn(
                        "relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 border shadow-sm",
                        styles.bg,
                        styles.border,
                        styles.glow
                    )}>
                        <Home className={cn("w-6 h-6", styles.icon)} strokeWidth={active ? 2.5 : 2} />
                    </div>
                );
            },
            href: '/desktop',
        },
        {
            id: 'articles',
            label: 'Artículos',
            icon: (active: boolean) => {
                const styles = getIconStyles('articles', active);
                return (
                    <div className={cn(
                        "relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 border shadow-sm",
                        styles.bg,
                        styles.border,
                        styles.glow
                    )}>
                        <Newspaper className={cn("w-6 h-6", styles.icon)} strokeWidth={active ? 2.5 : 2} />
                    </div>
                );
            },
            href: '/',
        },
        {
            id: 'profile',
            label: 'Perfil',
            icon: (active: boolean) => {
                const styles = getIconStyles('profile', active);
                return (
                    <div className={cn(
                        "relative w-12 h-12 flex items-center justify-center rounded-2xl transition-all duration-300 border shadow-sm",
                        styles.bg,
                        styles.border,
                        styles.glow
                    )}>
                        <User className={cn("w-6 h-6", styles.icon)} strokeWidth={active ? 2.5 : 2} />
                    </div>
                );
            },
            href: '/profile',
        },
    ];

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none pb-[env(safe-area-inset-bottom)]">
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className={cn(
                    "pointer-events-auto bg-white/60 dark:bg-slate-900/60 backdrop-blur-3xl border border-white/60 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[3rem] p-2 md:p-3 flex items-center gap-2 md:gap-4 transition-all duration-500 ring-1 ring-black/5 dark:ring-white/10"
                )}
            >
                {apps.map((app) => {
                    const isActive = !!(app.isStart
                        ? isStartMenuOpen
                        : (pathname === app.href || (app.href !== '/' && pathname?.startsWith(app.href))));

                    const isHovered = hoveredApp === app.id;

                    return (
                        <div key={app.id} className="relative flex flex-col items-center">
                            <Link
                                href={app.href}
                                onClick={(e) => {
                                    handleNavClick();
                                    if (app.isStart) {
                                        e.preventDefault();
                                        toggleStartMenu();
                                    }
                                }}
                                onMouseEnter={() => setHoveredApp(app.id)}
                                onMouseLeave={() => setHoveredApp(null)}
                                className="relative flex items-center justify-center active:scale-90 touch-none transition-transform duration-200 px-1"
                            >
                                <motion.div
                                    whileHover={{ y: -5, scale: 1.1 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                                >
                                    {app.icon(isActive)}
                                </motion.div>

                                {/* Tooltip Ultra-Premium */}
                                {isHovered && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.5, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: -10 }}
                                        className="absolute -top-16 bg-slate-900/90 dark:bg-white/90 backdrop-blur-md text-white dark:text-slate-900 text-[10px] font-black tracking-widest px-4 py-2 rounded-2xl whitespace-nowrap shadow-2xl uppercase border border-white/20"
                                    >
                                        {app.label}
                                    </motion.div>
                                )}

                                {/* Glossy Glow Indicator */}
                                {isActive && !app.isStart && (
                                    <motion.div
                                        layoutId="activeIndicator"
                                        className="absolute -bottom-3 w-8 h-1 bg-gradient-to-r from-green-800 to-blue-500 rounded-full shadow-[0_0_12px_rgba(22,101,52,1)]"
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                            </Link>
                        </div>
                    );
                })}
            </motion.div>
        </div>
    );
}

