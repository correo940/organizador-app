'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Lock, Mail, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { translateAuthError } from '@/lib/utils'

import LogoLoader from '@/components/ui/logo-loader'

const AUTH_TIMEOUT_MS = 30000

// Floating particle component for background ambiance (Light version)
function FloatingParticle({ delay, duration, x, y, size }: { delay: number; duration: number; x: string; y: string; size: number }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0 }}
            animate={{
                opacity: [0, 0.25, 0.1, 0.25, 0],
                scale: [0.5, 1, 0.8, 1, 0.5],
                y: [0, -40, -20, -60, 0],
            }}
            transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
            }}
            className="absolute rounded-full"
            style={{
                left: x,
                top: y,
                width: size,
                height: size,
                background: 'radial-gradient(circle, rgba(34,197,94,0.3) 0%, rgba(16,185,129,0.05) 70%, transparent 100%)',
                filter: 'blur(2px)',
            }}
        />
    )
}

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [mode, setMode] = useState<'signin' | 'signup'>('signin')
    const [showPassword, setShowPassword] = useState(false)
    const router = useRouter()

    const handleClearCache = async () => {
        if (confirm('¿Estás seguro de que quieres limpiar la caché y recargar? Esto puede solucionar problemas de conexión.')) {
            localStorage.clear()
            sessionStorage.clear()
            if ('caches' in window) {
                try {
                    const keys = await caches.keys()
                    await Promise.all(keys.map(key => caches.delete(key)))
                } catch (e) {}
            }
            window.location.reload()
        }
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            if (mode === 'signup') {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                setError('Revisa tu email para confirmar tu cuenta.')
            } else {
                const result = await Promise.race([
                    supabase.auth.signInWithPassword({
                        email,
                        password,
                    }),
                    new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Tiempo de espera agotado al iniciar sesión')), AUTH_TIMEOUT_MS)
                    ),
                ])
                console.log('[LOGIN] result:', JSON.stringify(result)); const { error } = result
                if (error) throw error

                router.replace('/')
                router.refresh()
            }
        } catch (err: any) {
            setError(translateAuthError(err.message))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
            style={{
                background: 'radial-gradient(circle at top center, #f0fff4 0%, #f9fafb 40%, #ffffff 100%)',
            }}
        >
            {/* Floating ambient particles */}
            <FloatingParticle delay={0} duration={8} x="15%" y="25%" size={8} />
            <FloatingParticle delay={2} duration={10} x="80%" y="20%" size={6} />
            <FloatingParticle delay={4} duration={9} x="75%" y="75%" size={10} />
            <FloatingParticle delay={3} duration={11} x="20%" y="80%" size={7} />

            {/* Subtle top decorative glow */}
            <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none opacity-40"
                style={{
                    background: 'radial-gradient(ellipse, rgba(34,197,94,0.15) 0%, transparent 70%)',
                }}
            />

            {/* Main card with light glassmorphism */}
            <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="w-full max-w-md rounded-[2.5rem] p-10 relative z-10"
                style={{
                    background: 'rgba(255, 255, 255, 0.75)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                }}
            >
                {/* Logo with green-800 glow */}
                <div className="flex justify-center mb-8">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.2 }}
                        className="relative"
                    >
                        <motion.div
                            animate={{
                                opacity: [0.2, 0.4, 0.2],
                                scale: [1, 1.2, 1],
                            }}
                            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                            className="absolute inset-0 rounded-full"
                            style={{
                                background: 'radial-gradient(circle, rgba(34,197,94,0.2) 0%, transparent 70%)',
                                filter: 'blur(15px)',
                                transform: 'scale(1.8)',
                            }}
                        />
                        <div
                            className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
                            style={{
                                background: '#ffffff',
                                border: '1px solid rgba(16, 185, 129, 0.1)',
                                boxShadow: '0 10px 25px rgba(0, 0, 0, 0.05)',
                            }}
                        >
                            <img
                                src="/images/logo.png"
                                alt="Quioba Logo"
                                className="w-14 h-14 object-contain"
                            />
                        </div>
                    </motion.div>
                </div>

                {/* Typography */}
                <motion.h2
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                    className="text-3xl font-bold text-center mb-2 tracking-tight"
                    style={{ color: '#064e3b' }}
                >
                    {mode === 'signin' ? 'Bienvenido a Quioba' : 'Crear Cuenta'}
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.5 }}
                    className="text-center mb-10 text-base"
                    style={{ color: '#6b7280' }}
                >
                    {mode === 'signin'
                        ? 'Ingresa tus credenciales para continuar'
                        : 'Regístrate para acceder al ecosistema'}
                </motion.p>

                {/* Form */}
                <motion.form
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.5 }}
                    onSubmit={handleAuth}
                    className="space-y-6"
                >
                    <div className="space-y-2">
                        <label
                            className="text-xs font-semibold tracking-wider uppercase ml-1"
                            style={{ color: '#065f46' }}
                        >
                            Email
                        </label>
                        <div className="relative group">
                            <Mail
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200"
                                style={{ color: '#9ca3af' }}
                            />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full rounded-2xl py-4 pl-12 pr-4 text-sm transition-all duration-300 outline-none shadow-sm"
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    color: '#111827',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#10b981'
                                    e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)'
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e5e7eb'
                                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
                                }}
                                placeholder="tu@email.com"
                                required
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label
                            className="text-xs font-semibold tracking-wider uppercase ml-1"
                            style={{ color: '#065f46' }}
                        >
                            Contraseña
                        </label>
                        <div className="relative group">
                            <Lock
                                className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors duration-200"
                                style={{ color: '#9ca3af' }}
                            />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full rounded-2xl py-4 pl-12 pr-12 text-sm transition-all duration-300 outline-none shadow-sm"
                                style={{
                                    background: '#ffffff',
                                    border: '1px solid #e5e7eb',
                                    color: '#111827',
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = '#10b981'
                                    e.target.style.boxShadow = '0 0 0 4px rgba(16, 185, 129, 0.1)'
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = '#e5e7eb'
                                    e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
                                }}
                                placeholder="••••••••"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-200 p-1"
                                style={{ color: '#9ca3af' }}
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="p-4 rounded-2xl text-sm text-center border font-medium"
                            style={{
                                background: '#fef2f2',
                                borderColor: '#fee2e2',
                                color: '#b91c1c',
                            }}
                        >
                            {error}
                        </motion.div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                            background: 'linear-gradient(135deg, #228b22 0%, #1a6d1a 100%)',
                            color: '#ffffff',
                            boxShadow: '0 10px 25px rgba(34, 139, 34, 0.2)',
                        }}
                    >
                        {loading ? (
                            <LogoLoader size="sm" className="gap-0" />
                        ) : mode === 'signin' ? (
                            'Iniciar Sesión'
                        ) : (
                            'Registrarse'
                        )}
                    </button>
                </motion.form>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                        className="text-sm font-semibold transition-all duration-200 hover:underline"
                        style={{ color: '#228b22' }}
                    >
                        {mode === 'signin'
                            ? '¿No tienes cuenta? Regístrate gratis'
                            : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t flex flex-col items-center" style={{ borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                    <p className="text-xs text-center mb-3 max-w-[280px]" style={{ color: '#6b7280' }}>
                        ¿La aplicación se queda cargando o tienes problemas de conexión?
                    </p>
                    <button
                        onClick={handleClearCache}
                        type="button"
                        className="flex items-center gap-2 text-xs px-4 py-2 border rounded-full transition-colors"
                        style={{ color: '#4b5563', borderColor: 'rgba(16, 185, 129, 0.2)', background: 'rgba(255, 255, 255, 0.5)' }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)'
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.5)'
                        }}
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Limpiar Caché y Recargar
                    </button>
                </div>
            </motion.div>
        </div>
    )
}


