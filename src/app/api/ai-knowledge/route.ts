import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
}

// GET — lista todas las notas del usuario
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Falta userId' }, { status: 400 });

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('ai_knowledge')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ knowledge: data });
}

// POST — guarda una nueva nota
export async function POST(req: Request) {
    const body = await req.json();
    const { userId, title, content } = body as { userId: string; title: string; content: string };

    if (!userId || !content?.trim()) {
        return NextResponse.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('ai_knowledge')
        .insert({ user_id: userId, title: title?.trim() || 'Sin título', content: content.trim() })
        .select('id, title, content, created_at')
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ knowledge: data });
}

// DELETE — elimina una nota por id
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id || !userId) return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });

    const supabase = getSupabase();
    const { error } = await supabase
        .from('ai_knowledge')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
