import { supabaseAdmin } from '@/lib/supabase-admin';

export interface AssistantDataContext {
  userId: string;
  userName?: string;
}

export async function fetchSavingsSummary(ctx: AssistantDataContext) {
  const [goalsRes, accountsRes] = await Promise.all([
    supabaseAdmin
      .from('savings_goals')
      .select('id, name, current_amount, target_amount, color')
      .eq('user_id', ctx.userId),
    supabaseAdmin
      .from('savings_accounts')
      .select('id, name, current_balance, bank_name')
      .eq('user_id', ctx.userId),
  ]);

  const goals = goalsRes.data || [];
  const accounts = accountsRes.data || [];
  const totalGoals = goals.reduce((sum, goal) => sum + (goal.current_amount || 0), 0);
  const totalAccounts = accounts.reduce((sum, account) => sum + (account.current_balance || 0), 0);

  return {
    totalSaved: totalGoals + totalAccounts,
    goals,
    accounts,
  };
}

export async function fetchPendingTasks(ctx: AssistantDataContext) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('id, title, due_date, priority, is_completed')
    .eq('user_id', ctx.userId)
    .eq('is_completed', false)
    .order('due_date', { ascending: true });

  const safeTasks = tasks || [];
  const overdue = safeTasks.filter((task) => task.due_date && new Date(task.due_date) < today);
  const todayTasks = safeTasks.filter((task) => {
    if (!task.due_date) {
      return false;
    }

    return new Date(task.due_date).toDateString() === today.toDateString();
  });
  const upcoming = safeTasks.filter((task) => task.due_date && new Date(task.due_date) > today);

  return {
    overdue,
    today: todayTasks,
    upcoming,
  };
}

export async function fetchShoppingList(ctx: AssistantDataContext) {
  const { data: items } = await supabaseAdmin
    .from('shopping_items')
    .select('id, name, quantity, category, is_checked')
    .eq('user_id', ctx.userId)
    .eq('is_checked', false)
    .order('category', { ascending: true });

  const safeItems = items || [];
  const byCategory = safeItems.reduce<Record<string, typeof safeItems>>((acc, item) => {
    const category = item.category || 'Sin categoría';
    if (!acc[category]) {
      acc[category] = [];
    }

    acc[category].push(item);
    return acc;
  }, {});

  return {
    byCategory,
  };
}

export async function fetchMedicines(ctx: AssistantDataContext) {
  const { data: medicines } = await supabaseAdmin
    .from('medicines')
    .select('id, name, dosage, frequency, stock, expiry_date')
    .eq('user_id', ctx.userId);

  const safeMedicines = medicines || [];

  return {
    medicines: safeMedicines,
    lowStock: safeMedicines.filter((medicine) => medicine.stock !== null && medicine.stock <= 5),
  };
}

export async function fetchInsurances(ctx: AssistantDataContext) {
  const { data: insurances } = await supabaseAdmin
    .from('insurances')
    .select('id, type, provider, policy_number, expiration_date, cost')
    .eq('user_id', ctx.userId)
    .order('expiration_date', { ascending: true });

  return {
    insurances: (insurances || []).map((insurance) => ({
      ...insurance,
      name: insurance.type || insurance.provider || 'Seguro',
    })),
  };
}

export async function fetchExpensesSummary(ctx: AssistantDataContext) {
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: expenses } = await supabaseAdmin
    .from('expenses')
    .select('id, concept, amount, category, date')
    .eq('user_id', ctx.userId)
    .gte('date', firstDayOfMonth);

  const safeExpenses = expenses || [];
  const byCategory = safeExpenses.reduce<Record<string, number>>((acc, expense) => {
    const category = expense.category || 'Otros';
    acc[category] = (acc[category] || 0) + (expense.amount || 0);
    return acc;
  }, {});

  return {
    totalThisMonth: safeExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
    byCategory,
  };
}

export async function fetchVehicles(ctx: AssistantDataContext) {
  const { data: vehicles } = await supabaseAdmin
    .from('vehicles')
    .select('id, name, brand, model, license_plate, next_maintenance_date, next_itv_date')
    .eq('user_id', ctx.userId);

  const safeVehicles = vehicles || [];
  const pendingITV = safeVehicles.filter((vehicle) => {
    if (!vehicle.next_itv_date) {
      return false;
    }

    const inOneMonth = new Date();
    inOneMonth.setMonth(inOneMonth.getMonth() + 1);
    return new Date(vehicle.next_itv_date) <= inOneMonth;
  });

  return {
    vehicles: safeVehicles,
    pendingITV,
  };
}

export async function fetchRecurringItems(ctx: AssistantDataContext) {
  const { data: recurring } = await supabaseAdmin
    .from('savings_recurring_items')
    .select('id, name, amount, type, day_of_month')
    .eq('user_id', ctx.userId);

  const safeRecurring = recurring || [];
  const income = safeRecurring.filter((item) => item.type === 'income');
  const expenses = safeRecurring.filter((item) => item.type === 'expense');

  return {
    totalIncome: income.reduce((sum, item) => sum + (item.amount || 0), 0),
    totalExpenses: expenses.reduce((sum, item) => sum + (item.amount || 0), 0),
  };
}

export async function fetchPendingBalance(ctx: AssistantDataContext) {
  const { data: expenses } = await supabaseAdmin
    .from('pending_balance_expenses')
    .select('id, amount, concept, status, project_id')
    .eq('user_id', ctx.userId)
    .eq('status', 'pending');

  const safeExpenses = expenses || [];

  return {
    totalPending: safeExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
  };
}
