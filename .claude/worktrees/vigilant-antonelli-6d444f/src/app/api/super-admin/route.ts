import { NextResponse } from 'next/server';
import { getAuthenticatedSupabaseUser, isSuperAdminEmail } from '@/lib/server-request-auth';

export async function GET(request: Request) {
  const user = await getAuthenticatedSupabaseUser(request);

  return NextResponse.json({
    isSuperAdmin: isSuperAdminEmail(user?.email),
  });
}
