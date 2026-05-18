'use client'

import { AuthProvider, useAuth } from '@/components/apps/mi-hogar/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

function OccupationalHealthGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, isPremium } = useAuth()
    const router = useRouter()

    const [forceRender, setForceRender] = useState(false);

    useEffect(() => {
        if (!loading && !user) {
            router.push('/apps/mi-hogar/login')
        }
    }, [user, loading, router])

    // Salvavidas absoluto: si Auth tarda más de 2 segundos, mostrar la app o redirigir
    useEffect(() => {
        const timer = setTimeout(() => {
            if (loading) {
                console.warn("AuthGuard tardó demasiado. Forzando renderizado para evitar pantalla negra.");
                setForceRender(true);
            }
        }, 2000)
        return () => clearTimeout(timer)
    }, [loading])

    if (loading && !forceRender) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 border-t-4 border-teal-500 transition-all">
                <Loader2 className="w-10 h-10 text-teal-500 animate-spin mb-4" />
                <p className="text-sm text-teal-600 dark:text-teal-400 font-medium">Iniciando sistema...</p>
            </div>
        )
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mr-2 mb-2" />
                <p className="text-muted-foreground">Redirigiendo al inicio de sesión...</p>
            </div>
        )
    }

    if (!isPremium) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center bg-slate-50 dark:bg-slate-900">
                <Lock className="w-12 h-12 text-slate-300 mb-4" />
                <h2 className="text-xl font-bold mb-2">Acceso Restringido</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                    Salud Ocupacional es una aplicación Premium. Suscríbete para acceder a planes personalizados de bienestar y ergonomía.
                </p>
                <Button onClick={() => router.push('/apps/mi-hogar/profile')} className="bg-teal-600 hover:bg-teal-700">
                    Ver Opciones Premium
                </Button>
            </div>
        )
    }

    return <>{children}</>
}

export default function SaludOcupacionalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthProvider>
            <OccupationalHealthGuard>
                <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100">
                    {children}
                </div>
            </OccupationalHealthGuard>
        </AuthProvider>
    )
}
