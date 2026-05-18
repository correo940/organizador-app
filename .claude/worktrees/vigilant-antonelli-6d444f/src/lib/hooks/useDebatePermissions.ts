import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSuperAdmin } from './useSuperAdmin';

export type DebateRole = 'admin' | 'moderator' | 'participant' | 'none';

export interface DebatePermissions {
    role: DebateRole;
    canDeleteMessages: boolean;
    canSilenceUsers: boolean;
    canAssignRoles: boolean;
    canCloseDebate: boolean;
    canEditSettings: boolean;
    isSuperAdmin: boolean;
    loading: boolean;
}

/**
 * Hook to get permissions for a user in a specific debate
 */
export function useDebatePermissions(debateId: string | null, userId?: string) {
    const { isSuperAdmin } = useSuperAdmin();
    const [permissions, setPermissions] = useState<DebatePermissions>({
        role: 'none',
        canDeleteMessages: false,
        canSilenceUsers: false,
        canAssignRoles: false,
        canCloseDebate: false,
        canEditSettings: false,
        isSuperAdmin: false,
        loading: true,
    });

    useEffect(() => {
        if (!debateId) {
            setPermissions(prev => ({ ...prev, loading: false }));
            return;
        }

        fetchPermissions();
    }, [debateId, userId, isSuperAdmin]);

    const fetchPermissions = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const targetUserId = userId || user?.id;

            if (!targetUserId) {
                setPermissions(prev => ({ ...prev, loading: false }));
                return;
            }

            // Call RPC function to get role
            const { data: role, error } = await supabase
                .rpc('get_user_debate_role', {
                    p_debate_id: debateId,
                    p_user_id: targetUserId
                });

            if (error) {
                console.error('Error fetching debate role:', error);
                setPermissions(prev => ({ ...prev, loading: false }));
                return;
            }

            const debateRole = (role as DebateRole) || 'none';

            // Calculate permissions based on role
            const isAdmin = debateRole === 'admin' || isSuperAdmin;
            const isModerator = debateRole === 'moderator';

            setPermissions({
                role: isSuperAdmin ? 'admin' : debateRole,
                canDeleteMessages: isAdmin || isModerator || isSuperAdmin,
                canSilenceUsers: isAdmin || isModerator || isSuperAdmin,
                canAssignRoles: isAdmin || isSuperAdmin,
                canCloseDebate: isAdmin || isSuperAdmin,
                canEditSettings: isAdmin || isSuperAdmin,
                isSuperAdmin,
                loading: false,
            });
        } catch (error) {
            console.error('Error in useDebatePermissions:', error);
            setPermissions(prev => ({ ...prev, loading: false }));
        }
    };

    return permissions;
}
