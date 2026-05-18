import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function usePendingReports(debateId: string) {
    const [pendingCount, setPendingCount] = useState(0);

    useEffect(() => {
        if (!debateId) return;

        const fetchCount = async () => {
            const { count, error } = await supabase
                .from('debate_reports')
                .select('*', { count: 'exact', head: true })
                .eq('debate_id', debateId)
                .eq('status', 'pending');

            if (!error) {
                setPendingCount(count || 0);
            }
        };

        fetchCount();

        const channel = supabase
            .channel(`debate_reports_count:${debateId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'debate_reports',
                    filter: `debate_id=eq.${debateId}`,
                },
                () => {
                    fetchCount();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [debateId]);

    return pendingCount;
}
