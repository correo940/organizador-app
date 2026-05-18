'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/api-utils';

interface ApiUsageInfo {
    endpoint: string;
    used: number;
    limit: number;
    remaining: number;
    isAdmin: boolean;
    loading: boolean;
}

/**
 * Hook to fetch and display the current user's API usage for an endpoint.
 * Returns used/limit/remaining, refreshable after each call.
 */
export function useApiUsage(endpoint: string): ApiUsageInfo & { refresh: () => void } {
    const [info, setInfo] = useState<ApiUsageInfo>({
        endpoint,
        used: 0,
        limit: 999,
        remaining: 999,
        isAdmin: false,
        loading: true
    });

    const fetchUsage = useCallback(async () => {
        try {
            const [{ data: { user } }, { data: { session } }] = await Promise.all([
                supabase.auth.getUser(),
                supabase.auth.getSession()
            ]);
            if (!user) {
                setInfo(prev => ({ ...prev, loading: false }));
                return;
            }

            let isAdmin = false;
            if (session?.access_token) {
                try {
                    const adminRes = await fetch(getApiUrl('api/super-admin'), {
                        headers: { Authorization: `Bearer ${session.access_token}` }
                    });
                    const adminData = await adminRes.json();
                    isAdmin = Boolean(adminData?.isSuperAdmin);
                } catch (error) {
                    console.warn('[useApiUsage] Super admin check failed:', error);
                }
            }

            if (isAdmin) {
                setInfo({ endpoint, used: 0, limit: Infinity, remaining: Infinity, isAdmin: true, loading: false });
                return;
            }

            // Check for custom user limit
            const { data: customLimitData } = await supabase
                .from('user_api_limits')
                .select('monthly_limit')
                .eq('user_id', user.id)
                .eq('endpoint', endpoint)
                .maybeSingle();

            let monthlyLimit;
            let enabled = true;

            if (customLimitData) {
                monthlyLimit = customLimitData.monthly_limit;
            } else {
                // Get global limit for this endpoint
                const { data: limitData } = await supabase
                    .from('api_limits')
                    .select('monthly_limit, enabled')
                    .eq('endpoint', endpoint)
                    .single();

                monthlyLimit = limitData?.monthly_limit || 50;
                enabled = limitData?.enabled ?? true;
            }

            if (!enabled) {
                setInfo({ endpoint, used: 0, limit: 0, remaining: 0, isAdmin: false, loading: false });
                return;
            }

            // Count usage this month
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const { count } = await supabase
                .from('api_usage')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id)
                .eq('endpoint', endpoint)
                .gte('used_at', startOfMonth);

            const used = count || 0;

            setInfo({
                endpoint,
                used,
                limit: monthlyLimit,
                remaining: Math.max(0, monthlyLimit - used),
                isAdmin,
                loading: false
            });
        } catch (err) {
            console.error('[useApiUsage] Error:', err);
            setInfo(prev => ({ ...prev, loading: false }));
        }
    }, [endpoint]);

    useEffect(() => {
        fetchUsage();
    }, [fetchUsage]);

    return { ...info, refresh: fetchUsage };
}
