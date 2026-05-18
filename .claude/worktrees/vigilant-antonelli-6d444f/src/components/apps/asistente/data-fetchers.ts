// Data fetchers for the Quioba Assistant
// These functions query user data from Supabase to answer questions

import { supabase } from '@/lib/supabase';

export interface AssistantDataContext {
    userId: string;
    userName?: string;
}

// Fetch savings summary
export async function fetchSavingsSummary(ctx: AssistantDataContext) {
    const { data: goals } = await supabase
        .from('savings_goals')
        .select('id, name, current_amount, target_amount, color')
        .eq('user_id', ctx.userId);

    const { data: accounts } = await supabase
        .from('savings_accounts')
        .select('id, name, current_balance, bank_name')
        .eq('user_id', ctx.userId);

    const totalGoals = goals?.reduce((sum, g) => sum + (g.current_amount || 0), 0) || 0;
    const totalAccounts = accounts?.reduce((sum, a) => sum + (a.current_balance || 0), 0) || 0;

    return {
        totalSaved: totalGoals + totalAccounts,
        goals: goals || [],
        accounts: accounts || [],
        goalsCount: goals?.length || 0,
        accountsCount: accounts?.length || 0,
    };
}

// Fetch pending tasks
export async function fetchPendingTasks(ctx: AssistantDataContext) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date, priority, is_completed')
        .eq('user_id', ctx.userId)
        .eq('is_completed', false)
        .order('due_date', { ascending: true });

    const overdue = tasks?.filter(t => t.due_date && new Date(t.due_date) < today) || [];
    const todayTasks = tasks?.filter(t => {
        if (!t.due_date) return false;
        const d = new Date(t.due_date);
        return d.toDateString() === today.toDateString();
    }) || [];
    const upcoming = tasks?.filter(t => t.due_date && new Date(t.due_date) > today) || [];

    return {
        total: tasks?.length || 0,
        tasks: tasks || [],
        overdue,
        today: todayTasks,
        upcoming,
    };
}

// Fetch shopping list
export async function fetchShoppingList(ctx: AssistantDataContext) {
    const { data: items } = await supabase
        .from('shopping_items')
        .select('id, name, quantity, category, is_checked')
        .eq('user_id', ctx.userId)
        .eq('is_checked', false)
        .order('category', { ascending: true });

    const byCategory = items?.reduce((acc, item) => {
        const cat = item.category || 'Sin categoría';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, typeof items>) || {};

    return {
        total: items?.length || 0,
        items: items || [],
        byCategory,
    };
}

// Fetch medicines
export async function fetchMedicines(ctx: AssistantDataContext) {
    const { data: medicines } = await supabase
        .from('medicines')
        .select('id, name, dosage, frequency, stock, expiry_date')
        .eq('user_id', ctx.userId);

    const lowStock = medicines?.filter(m => m.stock !== null && m.stock <= 5) || [];
    const expiringSoon = medicines?.filter(m => {
        if (!m.expiry_date) return false;
        const expiry = new Date(m.expiry_date);
        const inOneMonth = new Date();
        inOneMonth.setMonth(inOneMonth.getMonth() + 1);
        return expiry <= inOneMonth;
    }) || [];

    return {
        total: medicines?.length || 0,
        medicines: medicines || [],
        lowStock,
        expiringSoon,
    };
}

// Fetch insurances
export async function fetchInsurances(ctx: AssistantDataContext) {
    const { data: insurances } = await supabase
        .from('insurances')
        .select('id, name, provider, policy_number, expiration_date, cost')
        .eq('user_id', ctx.userId)
        .order('expiration_date', { ascending: true });

    const expiringSoon = insurances?.filter(i => {
        if (!i.expiration_date) return false;
        const exp = new Date(i.expiration_date);
        const inThreeMonths = new Date();
        inThreeMonths.setMonth(inThreeMonths.getMonth() + 3);
        return exp <= inThreeMonths;
    }) || [];

    return {
        total: insurances?.length || 0,
        insurances: insurances || [],
        expiringSoon,
    };
}

// Fetch expenses summary
export async function fetchExpensesSummary(ctx: AssistantDataContext) {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const { data: expenses } = await supabase
        .from('expenses')
        .select('id, concept, amount, category, date')
        .eq('user_id', ctx.userId)
        .gte('date', firstDayOfMonth.toISOString());

    const totalThisMonth = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    const byCategory = expenses?.reduce((acc, e) => {
        const cat = e.category || 'Otros';
        acc[cat] = (acc[cat] || 0) + (e.amount || 0);
        return acc;
    }, {} as Record<string, number>) || {};

    return {
        total: expenses?.length || 0,
        totalThisMonth,
        byCategory,
    };
}

// Fetch vehicles
export async function fetchVehicles(ctx: AssistantDataContext) {
    const { data: vehicles } = await supabase
        .from('vehicles')
        .select('id, name, brand, model, license_plate, next_maintenance_date, next_itv_date')
        .eq('user_id', ctx.userId);

    const pendingMaintenance = vehicles?.filter(v => {
        if (!v.next_maintenance_date) return false;
        return new Date(v.next_maintenance_date) <= new Date();
    }) || [];

    const pendingITV = vehicles?.filter(v => {
        if (!v.next_itv_date) return false;
        const inOneMonth = new Date();
        inOneMonth.setMonth(inOneMonth.getMonth() + 1);
        return new Date(v.next_itv_date) <= inOneMonth;
    }) || [];

    return {
        total: vehicles?.length || 0,
        vehicles: vehicles || [],
        pendingMaintenance,
        pendingITV,
    };
}

// Fetch recurring items (savings)
export async function fetchRecurringItems(ctx: AssistantDataContext) {
    const { data: recurring } = await supabase
        .from('savings_recurring_items')
        .select('id, name, amount, type, day_of_month')
        .eq('user_id', ctx.userId);

    const income = recurring?.filter(r => r.type === 'income') || [];
    const expenses = recurring?.filter(r => r.type === 'expense') || [];

    return {
        total: recurring?.length || 0,
        income,
        expenses,
        totalIncome: income.reduce((sum, r) => sum + (r.amount || 0), 0),
        totalExpenses: expenses.reduce((sum, r) => sum + (r.amount || 0), 0),
    };
}

// Fetch pending balance (autodeudas)
export async function fetchPendingBalance(ctx: AssistantDataContext) {
    const { data: expenses } = await supabase
        .from('pending_balance_expenses')
        .select('id, amount, concept, status, project_id')
        .eq('user_id', ctx.userId)
        .eq('status', 'pending');

    const totalPending = expenses?.reduce((sum, e) => sum + (e.amount || 0), 0) || 0;

    return {
        totalPending,
        expenses: expenses || [],
    };
}

