'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ChatView } from '@/components/apps/mi-hogar/confessions/chat-view';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function ConfessionClientPage({ id }: { id: string }) {
    const router = useRouter();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (!data.user) {
                router.push('/login');
            } else {
                setUserId(data.user.id);
            }
        });
    }, []);

    if (!userId) return null;

    return (
        <div className="flex flex-col h-screen max-w-4xl mx-auto bg-background border-x">
            <div className="p-4 border-b flex items-center gap-4">
                <Button variant="ghost" onClick={() => router.back()}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Volver
                </Button>
                <h1 className="font-semibold text-lg">Conversación</h1>
            </div>

            <div className="flex-1 overflow-hidden">
                <ChatView
                    conversationId={id}
                    userId={userId}
                />
            </div>
        </div>
    );
}
