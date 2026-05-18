import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function ensureAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  const [{ data: globalLimits, error: globalError }, { data: customLimits, error: customError }] =
    await Promise.all([
      supabaseAdmin.from('api_limits').select('*').order('endpoint'),
      supabaseAdmin.from('user_api_limits').select('*').order('created_at', { ascending: false }),
    ]);

  if (globalError || customError) {
    console.error('[Admin API Limits] Error fetching data:', globalError || customError);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }

  return NextResponse.json({
    globalLimits: globalLimits || [],
    customLimits: customLimits || [],
  });
}

export async function POST(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const body = await request.json();
    const { type, ...payload } = body;

    if (type === 'global') {
      const { id, monthly_limit, enabled } = payload;
      const { error } = await supabaseAdmin
        .from('api_limits')
        .update({ monthly_limit, enabled })
        .eq('id', id);

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    if (type === 'custom') {
      const { user_id, endpoint, monthly_limit } = payload;
      const { error } = await supabaseAdmin
        .from('user_api_limits')
        .upsert({ user_id, endpoint, monthly_limit }, { onConflict: 'user_id,endpoint' });

      if (error) {
        throw error;
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('[Admin API Limits] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('user_api_limits').delete().eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin API Limits] DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
