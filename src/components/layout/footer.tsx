'use client';

import Link from 'next/link';
import { Logo } from '../logo';
import { Github, Twitter, Instagram } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useGlobalMenu } from '@/context/GlobalMenuContext';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Footer() {
  const [currentYear, setCurrentYear] = useState<number | null>(null);
  const { isLauncherMode } = useGlobalMenu();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setCurrentYear(new Date().getFullYear());
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hide footer on launcher mode or on dashboard (home) when logged in
  if (isLauncherMode) return null;
  if (pathname === '/' && isLoggedIn) return null;


  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-8" suppressHydrationWarning>
        <div className="flex flex-col md:flex-row justify-between items-center" suppressHydrationWarning>
          <div className="flex items-center space-x-2 mb-4 md:mb-0" suppressHydrationWarning>
            <Logo className="h-7 w-auto" />
            <span className="font-bold text-lg">Quioba</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentYear !== null ? (
              `© ${currentYear} Quioba. Todos los derechos reservados.`
            ) : (
              'Cargando...'
            )}
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0" suppressHydrationWarning>
            <Link href="#" aria-label="Twitter">
              <Twitter className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
            <Link href="#" aria-label="GitHub">
              <Github className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
            <Link href="#" aria-label="Instagram">
              <Instagram className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
