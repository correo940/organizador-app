'use client';

import React from 'react';
import { cn } from '@/lib/utils';

/* ───────────────────────────────────────────────
 *  Base Skeleton Pulse
 * ──────────────────────────────────────────────── */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-xl bg-slate-200/60 dark:bg-slate-700/40',
                className
            )}
            {...props}
        />
    );
}

/* ───────────────────────────────────────────────
 *  Dashboard Skeleton (Mi Hogar main page)
 * ──────────────────────────────────────────────── */
export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-background p-4 md:p-8 space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-10 w-10 rounded-full" />
            </div>

            {/* Summary cards row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-4 space-y-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                ))}
            </div>

            {/* Widget cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-xl" />
                            <div className="space-y-1.5 flex-1">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                            <Skeleton className="h-3 w-3/5" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ───────────────────────────────────────────────
 *  AuthGuard Skeleton (replaces blue spinner)
 * ──────────────────────────────────────────────── */
export function AuthGuardSkeleton() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 p-8">
            <div className="relative">
                {/* Pulsing glow */}
                <div className="absolute inset-0 bg-green-400/20 blur-2xl rounded-full animate-pulse" />
                <div className="relative w-16 h-16 bg-white dark:bg-slate-900 rounded-full shadow-lg border border-slate-200/50 dark:border-white/10 flex items-center justify-center overflow-hidden">
                    <img
                        src="/images/logo.png"
                        alt="Quioba"
                        className="w-12 h-12 object-contain animate-pulse"
                    />
                </div>
            </div>
            <div className="text-center space-y-2">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 animate-pulse">
                    Preparando tu espacio...
                </p>
                <div className="w-48 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-green-400 to-green-800 rounded-full animate-[loading_1.5s_ease-in-out_infinite]" 
                         style={{ width: '60%' }} />
                </div>
            </div>
        </div>
    );
}

/* ───────────────────────────────────────────────
 *  Profile page Skeleton
 * ──────────────────────────────────────────────── */
export function ProfileSkeleton() {
    return (
        <div className="container max-w-2xl mx-auto py-8 px-4 pb-32 space-y-8">
            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-4">
                <Skeleton className="w-32 h-32 rounded-full" />
                <div className="text-center space-y-2">
                    <Skeleton className="h-8 w-40 mx-auto" />
                    <Skeleton className="h-4 w-52 mx-auto" />
                    <Skeleton className="h-6 w-20 mx-auto rounded-full" />
                </div>
            </div>

            {/* Cards */}
            {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/30 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-5 rounded" />
                        <Skeleton className="h-5 w-40" />
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 space-y-2">
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-3 w-36" />
                    </div>
                    <Skeleton className="h-10 w-full rounded-lg" />
                </div>
            ))}
        </div>
    );
}

/* ───────────────────────────────────────────────
 *  Blog / Articles Skeleton
 * ──────────────────────────────────────────────── */
export function ArticlesSkeleton() {
    return (
        <div className="container mx-auto px-4 py-12 space-y-8">
            <div className="text-center space-y-3">
                <Skeleton className="h-10 w-64 mx-auto" />
                <Skeleton className="h-4 w-96 mx-auto" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200/50 dark:border-slate-700/30 overflow-hidden">
                        <Skeleton className="h-48 w-full rounded-none" />
                        <div className="p-4 space-y-3">
                            <Skeleton className="h-5 w-3/4" />
                            <Skeleton className="h-3 w-full" />
                            <Skeleton className="h-3 w-4/5" />
                            <div className="flex gap-2 pt-2">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-5 w-12 rounded-full" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ───────────────────────────────────────────────
 *  List Skeleton (Shopping, Tasks, etc.)
 * ──────────────────────────────────────────────── */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {[...Array(rows)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200/30 dark:border-slate-700/20">
                    <Skeleton className="h-5 w-5 rounded" />
                    <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/3" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
            ))}
        </div>
    );
}

