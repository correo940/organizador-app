import { createClient } from '@supabase/supabase-js';
import { isSuperAdminEmail } from './server-request-auth';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

interface ApiLimitResult {
    allowed: boolean;
    used: number;
    limit: number;
    isAdmin: boolean;
}

/**
 * Check if a user is allowed to use an API endpoint.
 * Admin (SUPER_ADMIN_EMAIL) is always allowed.
 */
export async function checkApiLimit(
    userId: string,
    userEmail: string | null,
    endpoint: string
): Promise<ApiLimitResult> {
    // Admin bypass
    if (isSuperAdminEmail(userEmail)) {
        return { allowed: true, used: 0, limit: Infinity, isAdmin: true };
    }

    // Check for custom user limit
    const { data: customLimitData } = await supabaseAdmin
        .from('user_api_limits')
        .select('monthly_limit')
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .maybeSingle();

    let monthlyLimit;

    if (customLimitData) {
        monthlyLimit = customLimitData.monthly_limit;
    } else {
        // Get global limit config
        const { data: limitConfig } = await supabaseAdmin
            .from('api_limits')
            .select('monthly_limit, enabled')
            .eq('endpoint', endpoint)
            .single();

        // If no config or disabled, allow (no limit set)
        if (!limitConfig) {
            return { allowed: true, used: 0, limit: 999, isAdmin: false };
        }

        if (!limitConfig.enabled) {
            return { allowed: false, used: 0, limit: 0, isAdmin: false };
        }

        monthlyLimit = limitConfig.monthly_limit;
    }

    // Count usage this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count } = await supabaseAdmin
        .from('api_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('endpoint', endpoint)
        .gte('used_at', startOfMonth);

    const used = count || 0;

    return {
        allowed: used < monthlyLimit,
        used,
        limit: monthlyLimit,
        isAdmin: false
    };
}

/**
 * Record an API usage for a user.
 */
export async function recordApiUsage(userId: string, endpoint: string): Promise<void> {
    await supabaseAdmin
        .from('api_usage')
        .insert({ user_id: userId, endpoint });
}

/**
 * Helper to get authenticated user from Supabase auth header.
 * Works with the anon key JWT from the client.
 */
export async function getAuthUser(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(token);
    return user;
}
