import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/api-utils';

/**
 * Hook to check if the current user is a Super Admin.
 * The check is resolved server-side to avoid exposing admin identifiers in the client bundle.
 */
export function useSuperAdmin() {
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkSuperAdmin();
    }, []);

    const checkSuperAdmin = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setIsSuperAdmin(false);
                setLoading(false);
                return;
            }

            const response = await fetch(getApiUrl('api/super-admin'), {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });
            const data = await response.json();
            setIsSuperAdmin(Boolean(data?.isSuperAdmin));
        } catch (error) {
            console.error('Error checking super admin status:', error);
            setIsSuperAdmin(false);
        } finally {
            setLoading(false);
        }
    };

    return { isSuperAdmin, loading };
}
