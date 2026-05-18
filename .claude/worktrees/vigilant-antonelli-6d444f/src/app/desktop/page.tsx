'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LogoLoader from '@/components/ui/logo-loader';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import HomeDashboard from '@/components/dashboard/home-dashboard';

export default function DesktopPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-20 min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <LogoLoader size="lg" />
        <p className="text-xl font-medium text-slate-600 animate-pulse">Cargando tu panel...</p>
      </div>
    );
  }

  if (!user) return null;

  return <HomeDashboard />;
}
