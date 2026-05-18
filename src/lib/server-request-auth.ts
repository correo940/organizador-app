import { supabaseAdmin } from '@/lib/supabase-admin';

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  return authHeader.slice('Bearer '.length).trim() || null;
}

export async function getAuthenticatedSupabaseUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(token);

  if (error) {
    console.error('[Auth] Failed to resolve Supabase user from request:', error.message);
    return null;
  }

  return user;
}

export function isSuperAdminEmail(email: string | null | undefined) {
  const adminEmail =
    process.env.SUPER_ADMIN_EMAIL ??
    process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL ??
    'todojuntomirar@gmail.com';

  return Boolean(email && email === adminEmail);
}
