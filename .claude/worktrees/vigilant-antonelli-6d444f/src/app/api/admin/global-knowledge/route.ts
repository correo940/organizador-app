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

// GET — lista todo el conocimiento global
export async function GET() {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) return unauthorized;

  const { data, error } = await supabaseAdmin
    .from('ai_global_knowledge')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Admin Global Knowledge] GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

// POST — crea un nuevo conocimiento global
export async function POST(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const { title, content, category } = await request.json();

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Título y contenido son obligatorios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_global_knowledge')
      .insert({ 
        title: title.trim(), 
        content: content.trim(),
        category: category?.trim() || 'General'
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Global Knowledge] POST error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// PUT — edita un conocimiento global existente
export async function PUT(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const { id, title, content, category } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('ai_global_knowledge')
      .update({
        title: title?.trim(),
        content: content?.trim(),
        category: category?.trim() || 'General',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Admin Global Knowledge] PUT error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE — elimina un conocimiento global
export async function DELETE(request: Request) {
  const unauthorized = await ensureAdminSession();
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('ai_global_knowledge').delete().eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin Global Knowledge] DELETE error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
