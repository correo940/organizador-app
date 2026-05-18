// Response Engine for Quioba Assistant
// Connects to the LLM backend to process queries with full user context

import { supabase } from '@/lib/supabase';
import { getApiUrl } from '@/lib/api-utils';

export interface AssistantDataContext {
    userId: string;
    userName?: string;
}

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

// Main function to process user query and generate response via Groq API
export async function processQuery(query: string, ctx: AssistantDataContext): Promise<string> {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const apiUrl = getApiUrl('api/assistant/chat');
        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
            },
            body: JSON.stringify({
                message: query,
                userName: ctx.userName
            })
        });

        if (!res.ok) {
            throw new Error('Network response was not ok');
        }

        const data = await res.json();
        return data.response || 'Hubo un error al procesar tu mensaje.';
    } catch (error) {
        console.error('API Error:', error);
        return '❌ Vaya, he tenido un problema conectando con el cerebro de Quioba. Por favor revisa tu conexión e inténtalo de nuevo.';
    }
}

// Save conversation to database
export async function saveConversation(userId: string, messages: Message[]): Promise<void> {
    // First check if conversation exists
    const { data: existing } = await supabase
        .from('assistant_conversations')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (existing) {
        await supabase
            .from('assistant_conversations')
            .update({
                messages: messages,
                updated_at: new Date().toISOString()
            })
            .eq('id', existing.id);
    } else {
        await supabase
            .from('assistant_conversations')
            .insert({
                user_id: userId,
                messages: messages,
            });
    }
}

// Load conversation from database
export async function loadConversation(userId: string): Promise<Message[]> {
    const { data } = await supabase
        .from('assistant_conversations')
        .select('messages')
        .eq('user_id', userId)
        .single();

    return (data?.messages as Message[]) || [];
}

// Clear conversation
export async function clearConversation(userId: string): Promise<void> {
    await supabase
        .from('assistant_conversations')
        .update({ messages: [] })
        .eq('user_id', userId);
}

