'use client'

import { useAuth } from '@/components/apps/mi-hogar/auth-context'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Lock, Sword } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { GuestExpensesAccess } from '@/components/apps/mi-hogar/expenses/guest-access'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { AuthGuardSkeleton } from '@/components/ui/skeleton-loaders'
import { ErrorBoundary } from '@/components/ui/error-boundary'

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, isPremium } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    const [hasPartners, setHasPartners] = useState(false)
    const [hasTaskInvite, setHasTaskInvite] = useState(false)
    const [accessChecked, setAccessChecked] = useState(false)
    const hasCheckedOnce = useRef(false)

    // Background access check — NEVER blocks the UI
    useEffect(() => {
        if (loading || !user || hasCheckedOnce.current) return

        const checkAccess = async () => {
            try {
                const [partnersResult, tasksResult] = await Promise.allSettled([
                    supabase
                        .from('expense_partners')
                        .select('*', { count: 'exact', head: true })
                        .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`),
                    supabase
                        .from('task_list_members')
                        .select('*', { count: 'exact', head: true })
                        .eq('user_id', user.id)
                ])

                if (partnersResult.status === 'fulfilled') {
                    setHasPartners((partnersResult.value.count || 0) > 0)
                }
                if (tasksResult.status === 'fulfilled') {
                    setHasTaskInvite((tasksResult.value.count || 0) > 0)
                }
            } catch (error) {
                console.error("Access check error:", error)
            } finally {
                hasCheckedOnce.current = true
                setAccessChecked(true)
            }
        }

        // Run with a timeout safety net
        const timer = setTimeout(() => {
            hasCheckedOnce.current = true
            setAccessChecked(true)
        }, 3000)

        checkAccess().finally(() => clearTimeout(timer))

        return () => clearTimeout(timer)
    }, [user?.id, loading])

    // Redirect unauthenticated users
    useEffect(() => {
        if (loading) return

        const isPublicAuthPage = pathname === '/apps/mi-hogar/login'

        if (!user && !isPublicAuthPage) {
            if (pathname?.startsWith('/apps/mi-hogar/expenses')) {
                return // Allow guest expenses access
            }
            router.push('/apps/mi-hogar/login')
        }
    }, [user, loading, pathname, router])

    // ONLY block on initial auth loading — NEVER on access checks
    if (loading) {
        return <AuthGuardSkeleton />
    }

    if (!user && pathname !== '/apps/mi-hogar/login') {
        if (pathname?.startsWith('/apps/mi-hogar/expenses')) {
            return <GuestExpensesAccess onSuccess={() => window.location.reload()} />;
        }
        return null // Will redirect in useEffect
    }

    // --- ACCESS CONTROL LOGIC ---
    // If Premium -> Allow everything
    if (isPremium) {
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    // While the background access check is still running, show children
    // (prevents flash of "Access Restricted" before we know the user's status)
    if (!accessChecked) {
        return <ErrorBoundary>{children}</ErrorBoundary>;
    }

    // Guests (Non-Premium) — only enforced AFTER accessChecked=true
    const isExpensesPage = pathname?.startsWith('/apps/mi-hogar/expenses');
    const isTasksPage = pathname?.startsWith('/apps/mi-hogar/tasks');

    // 1. Accessing Expenses
    if (isExpensesPage) {
        if (hasPartners) {
            return <>{children}</>; // Allow if invited
        } else {
            return <GuestExpensesAccess onSuccess={() => window.location.reload()} />; // Show Gatekeeper
        }
    }

    // 2. Accessing Tasks
    if (isTasksPage) {
        if (hasTaskInvite) {
            return <>{children}</>; // Allow if invited/member
        }
    }

    // 3. Trying to access restricted pages
    const allowed = (isExpensesPage && hasPartners) || (isTasksPage && hasTaskInvite);

    if (!allowed && pathname !== '/apps/mi-hogar/login') {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 pb-nav text-center">
                <Lock className="w-12 h-12 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                    No tienes plan Premium. Solo puedes acceder a las secciones donde has sido invitado.
                </p>
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    {hasTaskInvite && (
                        <Button variant="outline" onClick={() => window.location.href = '/apps/mi-hogar/tasks'}>
                            Ir a Mis Tareas
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => window.location.href = '/apps/mi-hogar/expenses'}>
                        Ir a Gastos (Invitado)
                    </Button>
                    <Button variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => window.location.href = '/apps/debate'}>
                        <Sword className="w-4 h-4 mr-2" />
                        Ir a El Debate
                    </Button>
                    <Button variant="ghost" className="text-red-500" onClick={() => supabase.auth.signOut()}>
                        Cerrar Sesión
                    </Button>
                </div>
            </div>
        );
    }

    return <ErrorBoundary>{children}</ErrorBoundary>
}

export default function MiHogarLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthGuard>{children}</AuthGuard>
    )
}
