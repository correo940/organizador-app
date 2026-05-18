'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ensureCompatibleBrowserStorage } from '@/lib/browser-storage-version'

type AuthContextType = {
    session: Session | null
    user: User | null
    loading: boolean
    isPremium: boolean
    signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null)
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState(true)
    const [isPremium, setIsPremium] = useState(false)
    const router = useRouter()

    const checkPremiumStatus = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('is_premium, subscription_tier')
                .eq('id', userId)
                .single()
            if (data && !error) {
                setIsPremium(data.is_premium || data.subscription_tier === 'premium')
            }
        } catch (error) {
            console.error('Error fetching premium status:', error)
        }
    }

    useEffect(() => {
        ensureCompatibleBrowserStorage()

        // ✅ FIX 1: Dejar que Supabase gestione todo via onAuthStateChange
        // No llamar a getValidatedSession() manualmente — Supabase ya emite
        // INITIAL_SESSION al montar, que es más fiable que leer caché manual.
        const safetyTimer = setTimeout(() => setLoading(false), 5000)

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, newSession) => {
                console.log('[AuthProvider] onAuthStateChange:', event, 'session=', !!newSession)

                // ✅ FIX 2: Manejar INITIAL_SESSION explícitamente
                if (event === 'INITIAL_SESSION') {
                    if (newSession) {
                        // NO AWAIT aquí para evitar deadlock del cliente de Supabase
                        ;(async () => {
                            const { error } = await supabase.auth.getUser()
                            if (error) {
                                console.warn('[AuthProvider] INITIAL_SESSION inválida, cerrando sesión')
                                await supabase.auth.signOut({ scope: 'local' })
                                setSession(null)
                                setUser(null)
                                setIsPremium(false)
                            } else {
                                setSession(newSession)
                                setUser(newSession.user)
                                checkPremiumStatus(newSession.user.id) // Sin await
                            }
                            clearTimeout(safetyTimer)
                            setLoading(false)
                        })()
                    } else {
                        setSession(null)
                        setUser(null)
                        clearTimeout(safetyTimer)
                        setLoading(false)
                    }
                    return
                }

                if (event === 'SIGNED_OUT') {
                    setSession(null)
                    setUser(null)
                    setIsPremium(false)
                    setLoading(false)
                    return
                }

                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    setSession(newSession)
                    setUser(newSession?.user ?? null)
                    if (newSession?.user) {
                        checkPremiumStatus(newSession.user.id) // NO AWAIT to prevent GoTrue token deadlock
                    }
                    setLoading(false)
                    return
                }
            }
        )

        // ✅ FIX 3: Al volver visible, pedir refresco activo en vez de solo startAutoRefresh
        const handleVisibility = async () => {
            if (document.visibilityState === 'visible') {
                // Refrescar sesión al volver, pero NUNCA cerrar sesión automáticamente
                const { data } = await supabase.auth.getSession()
                if (data.session) {
                    setSession(data.session)
                    setUser(data.session.user)
                    supabase.auth.startAutoRefresh()
                }
                // Si no hay sesión al volver, simplemente no hacemos nada —
                // el usuario la cerrará manualmente cuando quiera
            }
        }

        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            subscription.unsubscribe()
            clearTimeout(safetyTimer)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [])

    const signOut = async () => {
        const confirmed = window.confirm('¿Seguro que quieres cerrar sesión?')
        if (!confirmed) return
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setIsPremium(false)
        // Redirigir solo si estamos en una zona que requiere login
        if (window.location.pathname.includes('/apps/')) {
            router.push('/apps/mi-hogar/login')
        }
    }

    return (
        <AuthContext.Provider value={{ session, user, loading, isPremium, signOut }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => {
    const context = useContext(AuthContext)
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider')
    }
    return context
}
