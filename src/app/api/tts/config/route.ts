import { NextResponse } from 'next/server';
import { savePhantomConfig, getPhantomConfig } from '@/lib/server/phantom-config';

export async function GET() {
    return NextResponse.json(getPhantomConfig());
}

export async function POST(req: Request) {
    try {
        const { xttsApiUrl, defaultVoice } = await req.json();
        const updated = savePhantomConfig({ xttsApiUrl, defaultVoice });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
