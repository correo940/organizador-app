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

  const { data, error } = await supabaseAdmin
    .from('admin_post_its')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Admin Post-Its] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function POST(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { title, content, target_audience, expires_at, bg_color, event_date } = await request.json();
    const { data, error } = await supabaseAdmin
      .from('admin_post_its')
      .insert({
        title,
        content,
        target_audience,
        expires_at,
        event_date,
        bg_color,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Post-Its] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const { id, title, content, target_audience, expires_at, bg_color, event_date } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('admin_post_its')
      .update({
        title,
        content,
        target_audience,
        expires_at,
        event_date,
        bg_color,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Post-Its] PUT error:', error);
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

    const { error } = await supabaseAdmin.from('admin_post_its').delete().eq('id', id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Post-Its] DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
