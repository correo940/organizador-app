import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import {
    fetchSavingsSummary,
    fetchPendingTasks,
    fetchShoppingList,
    fetchMedicines,
    fetchInsurances,
    fetchExpensesSummary,
    fetchVehicles,
    fetchRecurringItems,
    fetchPendingBalance
} from '@/lib/server/assistant-data';
import { getAuthenticatedSupabaseUser } from '@/lib/server-request-auth';

export async function POST(req: Request) {
    try {
        const groqKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;
        if (!groqKey) {
            return NextResponse.json({ error: 'Falta configurar GROQ_API_KEY' }, { status: 500 });
        }

        const user = await getAuthenticatedSupabaseUser(req);
        if (!user) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const groq = new Groq({ apiKey: groqKey });
        const { message, userName } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Falta mensaje' }, { status: 400 });
        }

        const ctx = { userId: user.id, userName: userName || user.user_metadata?.full_name || user.email || 'Usuario' };

        // Realizamos todas las consultas a la DB en paralelo para máxima velocidad
        const [
            savings, tasks, shopping, medicines,
            insurances, expenses, vehicles, recurring, pendingBalance
        ] = await Promise.all([
            fetchSavingsSummary(ctx),
            fetchPendingTasks(ctx),
            fetchShoppingList(ctx),
            fetchMedicines(ctx),
            fetchInsurances(ctx),
            fetchExpensesSummary(ctx),
            fetchVehicles(ctx),
            fetchRecurringItems(ctx),
            fetchPendingBalance(ctx)
        ]);

        // Construir el contexto en formato comprimido para el LLM
        const systemPrompt = `Eres Quioba, el asistente virtual experto, rápido y amigable de la app Quioba.
El usuario se llama ${userName || 'Usuario'}.

Aquí tienes el contexto COMPLETO, SECRETO y EN TIEMPO REAL del usuario. NUNCA menciones que te he pasado un JSON o "contexto", simplemente actúa con naturalidad como si lo supieras.

**1. Mi Economía y Finanzas:**
- Patrimonio Real (lo que tienes de verdad): ${(savings.totalSaved + pendingBalance.totalPending).toFixed(2)}€
- Total en Cuentas (Balance visible): ${savings.totalSaved}€
- Balance Pendiente (Autodeuda, dinero gastado de ahorros a reponer): ${pendingBalance.totalPending}€
- Cuentas: ${JSON.stringify(savings.accounts.map(a => ({ n: a.name, b: a.current_balance })))}
- Metas de Ahorro: ${JSON.stringify(savings.goals.map(g => ({ n: g.name, act: g.current_amount, obj: g.target_amount })))}
- Gastos Compartidos de este mes: ${expenses.totalThisMonth}€ (${JSON.stringify(expenses.byCategory)})
- Finanzas Fijas/Recurrentes: Ingresos ${recurring.totalIncome}€/mes, Gastos ${recurring.totalExpenses}€/mes.

**2. Tareas:**
- Caducadas/Atrasadas (¡URGENTES!): ${JSON.stringify(tasks.overdue.map(t => ({ t: t.title, f: t.due_date })))}
- Para Hoy: ${JSON.stringify(tasks.today.map(t => t.title))}
- Próximas: ${JSON.stringify(tasks.upcoming.map(t => ({ t: t.title, f: t.due_date })))}

**3. Salud y Compras:**
- Lista de la compra: ${JSON.stringify(shopping.byCategory)}
- Medicinas: ${JSON.stringify(medicines.medicines.map(m => m.name))} (${medicines.lowStock.length} con poco stock).

**4. Vehículos y Seguros:**
- Vehículos: ${JSON.stringify(vehicles.vehicles.map(v => v.name))} (ITV pendientes: ${vehicles.pendingITV.length})
- Seguros: ${JSON.stringify(insurances.insurances.map(i => i.name))}

Instrucciones:
1. Responde de forma cálida, cercana y directa a la pregunta del usuario. 
2. Si preguntan por Mi Economía o tareas caducadas, usa los datos reales provistos arriba.
3. SIEMPRE usa emojis para que la lectura sea agradable.
4. Si te saludan o preguntan "¿qué puedes hacer?", resume 3 o 4 cosas de las que tienes acceso (finanzas, tareas, vehículos, salud).
5. Usa formato markdown para listas si es necesario, pero mantén mensajes cortos y fáciles de leer en móvil.`;

        const completion = await groq.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: message }
            ],
            // Usamos un modelo rápido y capaz
            model: 'llama3-8b-8192',
            temperature: 0.6,
            max_tokens: 1024,
        });

        const reply = completion.choices[0]?.message?.content || 'Lo siento, no pude entender eso.';

        return NextResponse.json({ response: reply });

    } catch (error) {
        console.error('Error in Groq Chat Route:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
