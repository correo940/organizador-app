'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import HomeDashboard from '@/components/dashboard/home-dashboard';
import MobileLauncher from '@/components/mobile/mobile-launcher';
import { Capacitor } from '@capacitor/core';
import { useGlobalMenu } from '@/context/GlobalMenuContext';
import BlogContent from '@/components/blog-content';
import { useAuth } from '@/components/apps/mi-hogar/auth-context'; // ✅ usa el contexto
import LogoLoader from '@/components/ui/logo-loader';

function HomeContent() {
  // ✅ Leer sesión del AuthProvider global — sin llamadas duplicadas a Supabase
  const { user, loading } = useAuth()
  const [isLauncherMode, setIsLauncherMode] = useState(false)
  const [isRedirectingToLogin, setIsRedirectingToLogin] = useState(false)
  const router = useRouter()
  const { setIsLauncherMode: setGlobalLauncherMode } = useGlobalMenu()

  // Detectar si es móvil/nativo
  useEffect(() => {
    const isNative = Capacitor.isNativePlatform()
    const isSmallScreen = window.innerWidth < 768
    if (isNative || isSmallScreen) {
      setIsLauncherMode(true)
      setGlobalLauncherMode(true)
    }
  }, [setGlobalLauncherMode])

  // Redirigir a login solo si estamos seguros de que no hay sesión
  useEffect(() => {
    if (!loading && isLauncherMode && !user) {
      setIsRedirectingToLogin(true)
      router.replace('/login')
    }
  }, [isLauncherMode, user, loading, router])

  // ✅ Solo un loading state — el del AuthProvider
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <LogoLoader size="lg" />
        <p className="text-xl font-medium text-slate-600 animate-pulse">Entrando en Quioba...</p>
      </div>
    )
  }

  if (isRedirectingToLogin) {
    return (
      <div className="container mx-auto px-4 py-20 min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <LogoLoader size="lg" />
        <p className="text-xl font-medium text-slate-600 animate-pulse">Abriendo acceso seguro...</p>
      </div>
    )
  }

  if (isLauncherMode && user) {
    return <MobileLauncher user={user} onLaunchDesktop={() => setIsLauncherMode(false)} />
  }

  // La página principal siempre muestra los artículos, independientemente del login
  return <BlogContent />
}

export default function Home() {
  return (
    <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center">Cargando...</div>}>
      <HomeContent />
    </Suspense>
  )
}
