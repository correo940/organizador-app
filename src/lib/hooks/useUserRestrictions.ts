import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserRestriction {
    isRestricted: boolean;
    type: 'muted' | 'banned' | null;
    reason: string | null;
    expiresAt: string | null;
    remainingMinutes: number | null;
}

export function useUserRestrictions(debateId: string, userId: string | undefined): UserRestriction {
    const [restriction, setRestriction] = useState<UserRestriction>({
        isRestricted: false,
        type: null,
        reason: null,
        expiresAt: null,
        remainingMinutes: null
    });

    useEffect(() => {
        if (!debateId || !userId) return;

        const checkRestriction = async () => {
            const { data, error } = await supabase.rpc('check_user_restrictions', {
                p_debate_id: debateId,
                p_user_id: userId
            });

            if (error) {
                console.error('Error checking restrictions:', error);
                return;
            }

            // The RPC returns a JSON object or specific fields depending on implementation.
            // Based on create_moderation_system.sql:
            // RETURNS TABLE (restricted boolean, restriction_type text, reason text, expires_at timestamptz)

            if (data && data.length > 0) {
                const r = data[0];
                const now = new Date();
                const expires = r.expires_at ? new Date(r.expires_at) : null;
                const remaining = expires ? Math.ceil((expires.getTime() - now.getTime()) / 60000) : null;

                setRestriction({
                    isRestricted: r.restricted,
                    type: r.restriction_type,
                    reason: r.reason,
                    expiresAt: r.expires_at,
                    remainingMinutes: remaining
                });
            } else {
                setRestriction({
                    isRestricted: false,
                    type: null,
                    reason: null,
                    expiresAt: null,
                    remainingMinutes: null
                });
            }
        };

        checkRestriction();

        // Subscribe to changes in debate_user_restrictions to update in real-time
        const channel = supabase
            .channel(`restrictions_${debateId}_${userId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'debate_user_restrictions',
                filter: `debate_id=eq.${debateId}&user_id=eq.${userId}`
            }, () => {
                checkRestriction();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [debateId, userId]);

    return restriction;
}
