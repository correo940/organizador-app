'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SetupWizard } from '@/components/apps/organizador-vital/setup-wizard';
import { MainDashboard } from '@/components/apps/organizador-vital/main-dashboard';

export default function OrganizadorVitalPage() {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);

    useEffect(() => {
        async function checkProfile() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                let currentUser = session?.user ?? null;
                
                if (!currentUser) {
                    const { data: { user: u } } = await supabase.auth.getUser();
                    currentUser = u;
                }

                if (!currentUser) {
                    setLoading(false);
                    return;
                }

                setUser(currentUser);

                const { data, error } = await supabase
                    .from('smart_scheduler_profiles')
                    .select('*')
                    .eq('id', currentUser.id)
                    .maybeSingle();

                if (data && !error) {
                    setProfile(data);
                }
            } catch (error) {
                console.error('Error checking profile:', error);
            } finally {
                setLoading(false);
            }
        }

        checkProfile();
    }, []);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center p-4 text-center">
                <h1 className="text-2xl font-bold mb-2">Inicia Sesión</h1>
                <p className="text-muted-foreground mb-4">Necesitas estar logueado para usar el Organizador Vital.</p>
                <Button onClick={() => window.location.href = '/login'}>Ir al Login</Button>
            </div>
        );
    }

    if (!profile) {
        return <SetupWizard onComplete={(newProfile) => setProfile(newProfile)} />;
    }

    return <MainDashboard profile={profile} onReconfigure={() => setProfile(null)} />;
}

