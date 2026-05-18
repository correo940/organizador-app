"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { format, addDays, startOfDay, endOfDay, isSameDay, differenceInDays, parseISO, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ShoppingCart, Briefcase, Calendar as CalendarIcon, Wallet, CreditCard, Car, AlertTriangle, Pill, Shield, Receipt, PiggyBank, Droplets, Gauge, Clock, User } from 'lucide-react';
import { Separator } from "@/components/ui/separator";

interface DailyNotificationSettings {
    enabled: boolean;
    time: string;
    categories: {
        tasks: boolean;
        shifts: boolean;
        vehicles: boolean;
        shopping: boolean;
        money: boolean;
        medicines: boolean;
        insurances: boolean;
        warranties: boolean;
        expenses: boolean;
    };
}

interface DebtDetail {
    id: string;
    name: string;
    amount: number; // Positive = I owe them, Negative = They owe me
}

export default function DailySummaryPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [settings, setSettings] = useState<DailyNotificationSettings | null>(null);

    // Data States
    const [todayData, setTodayData] = useState<any>({});
    const [threeDayData, setThreeDayData] = useState<any[]>([]);
    const [weekData, setWeekData] = useState<any[]>([]);

    // Categories
    const [shoppingList, setShoppingList] = useState<any[]>([]);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [vehicles, setVehicles] = useState<any[]>([]);
    const [medicines, setMedicines] = useState<any[]>([]);
    const [warranties, setWarranties] = useState<any[]>([]);
    const [insurances, setInsurances] = useState<any[]>([]);

    // Expenses
    const [debts, setDebts] = useState<DebtDetail[]>([]);
    const [globalBalance, setGlobalBalance] = useState<number>(0);

    useEffect(() => {
        const savedSettings = localStorage.getItem('dailyNotificationSettings');
        if (savedSettings) {
            try {
                setSettings(JSON.parse(savedSettings));
            } catch (e) {
                console.error("Error parsing settings", e);
            }
        } else {
            setSettings({
                enabled: false, time: '08:00',
                categories: {
                    tasks: true, shifts: true, vehicles: true, shopping: true,
                    money: true, medicines: true, insurances: true, warranties: true, expenses: true
                }
            });
        }
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push('/login');
                return;
            }
            setUser(user);

            const today = new Date();
            const weekLater = addDays(today, 6);

            // 1. Fetch Basic Data
            const { data: shopping } = await supabase.from('shopping_items').select('*').eq('user_id', user.id).eq('is_checked', false);
            const { data: accs } = await supabase.from('savings_accounts').select('*').eq('user_id', user.id);
            const { data: vhcls } = await supabase.from('vehicles').select('*').eq('user_id', user.id);
            const { data: meds } = await supabase.from('medicines').select('*').eq('user_id', user.id);
            const { data: wrnties } = await supabase.from('warranties').select('*').eq('user_id', user.id);
            const { data: ins } = await supabase.from('insurances').select('*').eq('user_id', user.id);

            setShoppingList(shopping || []);
            setAccounts(accs || []);
            setVehicles(vhcls || []);
            setMedicines(meds || []);
            setWarranties(wrnties || []);
            setInsurances(ins || []);

            // 2. Fetch Expenses & Calculate Detailed Debts
            const { data: expenses } = await supabase.from('expenses').select('*').is('folder_id', null).order('date', { ascending: false });
            const { data: settlements } = await supabase.from('settlements').select('*').is('folder_id', null);

            // Fetch Partners to ensure correct split denominator (same as Expenses App)
            const { data: partners } = await supabase
                .from('expense_partners')
                .select('user_id_1, user_id_2')
                .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

            // Get all unique users involved
            const userIds = new Set<string>();
            userIds.add(user.id);

            // Add explicit partners to the group
            partners?.forEach((p: any) => {
                if (p.user_id_1 && p.user_id_1 !== user.id) userIds.add(p.user_id_1);
                if (p.user_id_2 && p.user_id_2 !== user.id) userIds.add(p.user_id_2);
            });

            if (expenses) {
                expenses.forEach((e: any) => {
                    if (e.user_id) userIds.add(e.user_id);
                    if (e.paid_by && e.paid_by.length > 10) userIds.add(e.paid_by); // UUID
                });
            }

            // Fetch names
            const { data: profiles } = await supabase.from('profiles').select('id, nickname').in('id', Array.from(userIds));
            const nameMap: Record<string, string> = {};
            profiles?.forEach((p: any) => nameMap[p.id] = p.nickname || 'Usuario');

            const getPayerId = (e: any) => {
                if (e.paid_by === user.id) return user.id;
                if (e.paid_by === 'Mi') return e.user_id; // Usually legacy for "Creator paid"
                if (e.paid_by === 'Partner') return e.user_id === user.id ? 'partner_placeholder' : user.id;
                return e.paid_by.length > 10 ? e.paid_by : e.user_id;
            };

            const allUserIdsArr = Array.from(userIds);
            const debtMatrix: Record<string, Record<string, number>> = {};
            allUserIdsArr.forEach(u1 => {
                debtMatrix[u1] = {};
                allUserIdsArr.forEach(u2 => { if (u1 !== u2) debtMatrix[u1][u2] = 0; });
            });

            expenses?.forEach((e: any) => {
                const payerId = getPayerId(e);
                if (!userIds.has(payerId)) return;

                const split = e.amount / (userIds.size || 1);
                allUserIdsArr.forEach(debtorId => {
                    if (debtorId !== payerId) {
                        if (!debtMatrix[debtorId]) debtMatrix[debtorId] = {};
                        if (debtMatrix[debtorId][payerId] === undefined) debtMatrix[debtorId][payerId] = 0;
                        debtMatrix[debtorId][payerId] += split;
                    }
                });
            });

            settlements?.forEach((s: any) => {
                if (debtMatrix[s.payer_id]?.[s.receiver_id] !== undefined) {
                    debtMatrix[s.payer_id][s.receiver_id] -= s.amount;
                }
            });

            // Calculate MY debts (vs others)
            const myDebts: DebtDetail[] = [];
            let totalBalance = 0;

            allUserIdsArr.forEach(otherId => {
                if (otherId === user.id) return;

                const iOweThem = debtMatrix[user.id]?.[otherId] || 0;
                const theyOweMe = debtMatrix[otherId]?.[user.id] || 0;
                const net = iOweThem - theyOweMe;

                if (Math.abs(net) > 0.1) { // Tolerance
                    myDebts.push({
                        id: otherId,
                        name: nameMap[otherId] || 'Compañero',
                        amount: net
                    });
                    totalBalance -= net; // If net is positive (I owe), my balance decreases
                }
            });

            setDebts(myDebts);
            setGlobalBalance(totalBalance);

            // 3. Date Specific Data
            const startStr = startOfDay(today).toISOString();
            const endStr = endOfDay(weekLater).toISOString();
            const { data: tasks } = await supabase.from('tasks').select('*').eq('user_id', user.id).gte('due_date', startStr).lte('due_date', endStr).eq('is_completed', false).order('due_date');
            const { data: shifts } = await supabase.from('work_shifts').select('*').eq('user_id', user.id).gte('start_time', startStr).lte('start_time', endStr).order('start_time');

            // Helper to get alerts for a date
            const getAlertsForDate = (date: Date) => {
                const dateAlerts: any[] = [];
                vhcls?.forEach((v: any) => {
                    if (v.next_itv_date && isSameDay(parseISO(v.next_itv_date), date)) dateAlerts.push({ type: 'vehicle', label: `ITV: ${v.brand}`, icon: Car, color: 'text-red-500' });
                    if (v.insurance_expiry_date && isSameDay(parseISO(v.insurance_expiry_date), date)) dateAlerts.push({ type: 'vehicle', label: `Seguro: ${v.brand}`, icon: Shield, color: 'text-orange-500' });
                });
                meds?.forEach((m: any) => {
                    if (m.expiration_date && isSameDay(parseISO(m.expiration_date), date)) dateAlerts.push({ type: 'med', label: `Caduca: ${m.name}`, icon: Pill, color: 'text-red-500' });
                });
                wrnties?.forEach((w: any) => {
                    const expiry = addMonths(parseISO(w.purchase_date), w.warranty_months);
                    if (isSameDay(expiry, date)) dateAlerts.push({ type: 'warranty', label: `Garantía: ${w.product_name}`, icon: Receipt, color: 'text-purple-500' });
                });
                ins?.forEach((i: any) => {
                    if (i.expiration_date && isSameDay(parseISO(i.expiration_date), date)) dateAlerts.push({ type: 'insurance', label: `Seguro: ${i.name}`, icon: Shield, color: 'text-orange-500' });
                });
                return dateAlerts;
            };

            const processDays = (count: number) => {
                const days = [];
                for (let i = 0; i < count; i++) {
                    const d = addDays(today, i);
                    days.push({
                        date: d,
                        tasks: tasks?.filter(t => isSameDay(new Date(t.due_date), d)) || [],
                        shifts: shifts?.filter(s => isSameDay(new Date(s.start_time), d)) || [],
                        alerts: getAlertsForDate(d)
                    });
                }
                return days;
            };

            setTodayData(processDays(1)[0]);
            setThreeDayData(processDays(3));
            setWeekData(processDays(7));

        } catch (error) {
            console.error("Error loading daily summary:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !settings) {
        return <div className="flex items-center justify-center h-screen bg-gray-50 dark:bg-gray-900">
            <div className="animate-pulse flex flex-col items-center">
                <div className="h-12 w-12 bg-gray-200 rounded-full mb-4"></div>
                <div className="h-4 w-32 bg-gray-200 rounded"></div>
            </div>
        </div>;
    }

    const expiringMeds = medicines.filter(m => m.expiration_date && differenceInDays(parseISO(m.expiration_date), new Date()) <= 30);
    const expiringWarranties = warranties.filter(w => {
        const expiry = addMonths(parseISO(w.purchase_date), w.warranty_months);
        return differenceInDays(expiry, new Date()) <= 30;
    });
    const expiringInsurances = insurances.filter(i => i.expiration_date && differenceInDays(parseISO(i.expiration_date), new Date()) <= 30);
    const vehicleAlerts = vehicles.filter(v => {
        const itvDue = v.next_itv_date && differenceInDays(parseISO(v.next_itv_date), new Date()) <= 30;
        const insDue = v.insurance_expiry_date && differenceInDays(parseISO(v.insurance_expiry_date), new Date()) <= 30;
        const oilDue = v.last_oil_change_km && v.current_kilometers && (v.current_kilometers - v.last_oil_change_km) > (v.oil_change_interval_km || 15000);
        return itvDue || insDue || oilDue;
    });

    const dailyMedicines = medicines.filter(m => m.alarm_times && m.alarm_times.length > 0);
    const showCat = (cat: keyof DailyNotificationSettings['categories']) => settings.categories?.[cat] ?? true;

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-gray-900/50 p-4 md:p-8 space-y-6">
            <header className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white mb-2">Resumen Diario</h1>
                <p className="text-muted-foreground">Tu visión general para estar al día.</p>
            </header>

            <Tabs defaultValue="today" className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="today">Hoy</TabsTrigger>
                    <TabsTrigger value="3days">3 Días</TabsTrigger>
                    <TabsTrigger value="week">Semana</TabsTrigger>
                </TabsList>

                <TabsContent value="today" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">

                        {/* AGENDA HOY */}
                        <Card className="md:col-span-2 shadow-sm border-t-4 border-t-blue-500">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                    <CalendarIcon className="h-5 w-5" /> Agenda de Hoy
                                </CardTitle>
                                <CardDescription>{format(new Date(), "EEEE, d 'de' MMMM", { locale: es })}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-6">
                                    {showCat('shifts') && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1"><Briefcase className="h-3 w-3" /> Turno Laboral</h4>
                                            {todayData.shifts?.length > 0 ? (
                                                todayData.shifts.map((shift: any) => (
                                                    <div key={shift.id} className="flex items-center p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                                        <Clock className="h-4 w-4 text-blue-600 mr-2" />
                                                        <div>
                                                            <p className="font-semibold text-gray-900 dark:text-gray-100">{shift.title}</p>
                                                            <p className="text-sm text-gray-500">{format(new Date(shift.start_time), "HH:mm")} - {format(new Date(shift.end_time), "HH:mm")}</p>
                                                        </div>
                                                    </div>
                                                ))
                                            ) : <div className="text-sm text-gray-400 italic pl-1">Sin turno asignado hoy</div>}
                                        </div>
                                    )}

                                    {showCat('tasks') && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1"><Check className="h-3 w-3" /> Tareas Pendientes</h4>
                                            {todayData.tasks?.length > 0 ? (
                                                <div className="space-y-2">
                                                    {todayData.tasks.map((task: any) => (
                                                        <div key={task.id} className="flex items-start gap-2 group p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded transition-colors cursor-pointer">
                                                            <div className="h-4 w-4 rounded border border-gray-300 dark:border-gray-600 flex items-center justify-center mt-0.5">
                                                                <div className="h-2 w-2 rounded-sm bg-transparent group-hover:bg-green-500 transition-colors" />
                                                            </div>
                                                            <span className="text-gray-700 dark:text-gray-300 group-hover:line-through transition-all text-sm">{task.title}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div className="text-sm text-gray-400 italic pl-1">No hay tareas para hoy</div>}
                                        </div>
                                    )}

                                    {showCat('shopping') && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Lista de Compra</h4>
                                            {shoppingList.length > 0 ? (
                                                <div className="space-y-1">
                                                    {shoppingList.map((item: any) => (
                                                        <div key={item.id} className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-2 pl-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                                            {item.name}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div className="text-sm text-gray-400 italic pl-1">Lista vacía</div>}
                                        </div>
                                    )}

                                    {showCat('medicines') && (
                                        <div className="space-y-2">
                                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1"><Pill className="h-3 w-3" /> Medicación de Hoy</h4>
                                            {dailyMedicines.length > 0 ? (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {dailyMedicines.map((med: any) => (
                                                        <div key={med.id} className="p-2 border rounded bg-pink-50/50 dark:bg-pink-900/10 text-sm">
                                                            <p className="font-semibold text-pink-700 dark:text-pink-300">{med.name}</p>
                                                            <div className="flex flex-wrap gap-1 mt-1">
                                                                {med.alarm_times?.map((time: string, idx: number) => (
                                                                    <Badge key={idx} variant="outline" className="text-xs border-pink-200 text-pink-600">{time}</Badge>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : <div className="text-sm text-gray-400 italic pl-1">Sin tomas programadas</div>}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* ESTADO FINANCIERO */}
                        {(showCat('money') || showCat('expenses')) && (
                            <Card className="shadow-sm border-t-4 border-t-green-500 lg:col-span-1 h-fit">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-green-900 dark:text-green-400"><Wallet className="h-5 w-5" /> Finanzas</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {showCat('money') && (
                                        <div className="space-y-2">
                                            {accounts.length > 0 ? (
                                                accounts.map((acc: any) => (
                                                    <div key={acc.id} className="flex justify-between items-center p-3 bg-green-50/50 dark:bg-green-950/10 rounded-lg">
                                                        <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1 text-green-950 dark:text-green-300"><CreditCard className="h-3 w-3" /> {acc.name}</span>
                                                        <span className="font-bold text-green-950 dark:text-green-100">{Number(acc.current_balance).toFixed(0)}€</span>
                                                    </div>
                                                ))
                                            ) : <p className="text-sm text-gray-500 italic">Sin cuentas registradas</p>}
                                        </div>
                                    )}

                                    {(showCat('money') && showCat('expenses')) && <Separator />}

                                    {showCat('expenses') && (
                                        <div className="space-y-3">
                                            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1"><PiggyBank className="w-3 h-3" /> Gastos (Deudas)</h4>

                                            {debts.length > 0 ? (
                                                <div className="space-y-2">
                                                    {debts.map(debt => (
                                                        <div key={debt.id} className={`p-2 rounded border flex flex-col ${debt.amount > 0 ? 'bg-red-50 border-red-100' : 'bg-green-50 border-green-100'}`}>
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-medium text-sm flex items-center gap-1 text-gray-700">
                                                                    <User className="w-3 h-3" /> {debt.name}
                                                                </span>
                                                                <span className={`font-bold text-sm ${debt.amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                    {Math.abs(debt.amount).toFixed(2)}€
                                                                </span>
                                                            </div>
                                                            <span className="text-[10px] text-gray-500 text-right">
                                                                {debt.amount > 0 ? 'Debes a esta persona' : 'Te debe a ti'}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-center">
                                                    <p className="text-sm text-gray-500 italic">Cuentas saldadas ✨</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* AVISOS Y ALERTAS */}
                        {(showCat('vehicles') || showCat('medicines') || showCat('insurances') || showCat('warranties')) && (
                            <Card className="md:col-span-2 lg:col-span-3 shadow-sm border-t-4 border-t-orange-500">
                                <CardHeader className="pb-3">
                                    <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400"><AlertTriangle className="h-5 w-5" /> Avisos y Mantenimiento</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {showCat('vehicles') && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Car className="w-3 h-3" /> Garaje</h4>
                                                <ScrollArea className="h-[100px] w-full rounded-md border p-2">
                                                    {vehicleAlerts.length > 0 ? (
                                                        vehicleAlerts.map((v: any) => (
                                                            <div key={v.id} className="mb-2 last:mb-0">
                                                                <p className="font-semibold text-sm text-gray-800 dark:text-gray-200">{v.brand} {v.model}</p>
                                                                {v.next_itv_date && differenceInDays(parseISO(v.next_itv_date), new Date()) <= 30 && <p className="text-xs text-red-500 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> ITV: {format(parseISO(v.next_itv_date), 'dd/MM')}</p>}
                                                                {v.insurance_expiry_date && differenceInDays(parseISO(v.insurance_expiry_date), new Date()) <= 30 && <p className="text-xs text-orange-500 flex items-center gap-1"><Shield className="w-3 h-3" /> Seguro: {format(parseISO(v.insurance_expiry_date), 'dd/MM')}</p>}
                                                                {v.last_oil_change_km && v.current_kilometers && (v.current_kilometers - v.last_oil_change_km) > (v.oil_change_interval_km || 15000) && <p className="text-xs text-amber-500 flex items-center gap-1"><Droplets className="w-3 h-3" /> Revisar Aceite</p>}
                                                            </div>
                                                        ))
                                                    ) : <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Todo en orden</div>}
                                                </ScrollArea>
                                            </div>
                                        )}

                                        {showCat('medicines') && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Pill className="w-3 h-3" /> Caducidad (30d)</h4>
                                                <ScrollArea className="h-[100px] w-full rounded-md border p-2">
                                                    {expiringMeds.length > 0 ? (
                                                        expiringMeds.map((m: any) => (
                                                            <div key={m.id} className="mb-1 last:mb-0 text-xs text-red-500 font-medium flex justify-between"><span>{m.name}</span><span>{m.expiration_date ? format(parseISO(m.expiration_date), 'dd/MM') : '!'}</span></div>
                                                        ))
                                                    ) : <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Sin caducidades</div>}
                                                </ScrollArea>
                                            </div>
                                        )}

                                        {showCat('insurances') && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Shield className="w-3 h-3" /> Mis Seguros</h4>
                                                <ScrollArea className="h-[100px] w-full rounded-md border p-2">
                                                    {expiringInsurances.length > 0 ? (
                                                        expiringInsurances.map((i: any) => (
                                                            <div key={i.id} className="mb-1 last:mb-0 text-xs text-orange-600 font-medium flex justify-between"><span>{i.name}</span><span>{format(parseISO(i.expiration_date), 'dd/MM')}</span></div>
                                                        ))
                                                    ) : <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Sin vencimientos</div>}
                                                </ScrollArea>
                                            </div>
                                        )}

                                        {showCat('warranties') && (
                                            <div className="space-y-2">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><Receipt className="w-3 h-3" /> Garantías</h4>
                                                <ScrollArea className="h-[100px] w-full rounded-md border p-2">
                                                    {expiringWarranties.length > 0 ? (
                                                        expiringWarranties.map((w: any) => (
                                                            <div key={w.id} className="mb-1 last:mb-0 text-xs text-purple-600 font-medium flex justify-between"><span className="truncate max-w-[100px]">{w.product_name}</span><span>{format(addMonths(parseISO(w.purchase_date), w.warranty_months), 'dd/MM')}</span></div>
                                                        ))
                                                    ) : <div className="h-full flex items-center justify-center text-xs text-gray-400 italic">Todo vigente</div>}
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="3days" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid gap-4 md:grid-cols-3">
                        {threeDayData.map((day, idx) => (
                            <DaySummaryCard key={idx} dayData={day} isToday={idx === 0} shoppingCount={shoppingList.length} totalMoney={accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0)} settings={settings} />
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="week" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card>
                        <CardContent className="p-0">
                            {weekData.map((day, idx) => (
                                <div key={idx}>
                                    <div className={`flex items-start p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${idx === 0 ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}>
                                        <div className="w-24 flex-shrink-0 pt-1">
                                            <p className={`font-semibold ${idx === 0 ? 'text-blue-600' : ''}`}>{format(day.date, 'EEE d', { locale: es })}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{format(day.date, 'MMMM', { locale: es })}</p>
                                        </div>
                                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            {showCat('shifts') && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Briefcase className="h-3 w-3" /> Turno</p>
                                                    {day.shifts.length > 0 ? (day.shifts.map((s: any) => <div key={s.id} className="text-sm font-medium text-blue-700 dark:text-blue-300">{s.title}</div>)) : <span className="text-sm text-gray-400 italic">Libre</span>}
                                                </div>
                                            )}
                                            {showCat('tasks') && (
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Check className="h-3 w-3" /> Tareas</p>
                                                    {day.tasks.length > 0 ? (
                                                        <div className="space-y-1">
                                                            {day.tasks.slice(0, 2).map((t: any) => <p key={t.id} className="text-sm text-gray-600 dark:text-gray-300 truncate">• {t.title}</p>)}
                                                            {day.tasks.length > 2 && <p className="text-xs text-gray-500 pl-2">+ {day.tasks.length - 2} más</p>}
                                                        </div>
                                                    ) : <span className="text-sm text-gray-400 italic">Nada pendiente</span>}
                                                </div>
                                            )}
                                            {(() => {
                                                const visibleAlerts = day.alerts.filter((a: any) => {
                                                    if (a.type === 'vehicle' && !showCat('vehicles')) return false;
                                                    if (a.type === 'med' && !showCat('medicines')) return false;
                                                    if (a.type === 'warranty' && !showCat('warranties')) return false;
                                                    if (a.type === 'insurance' && !showCat('insurances')) return false;
                                                    return true;
                                                });
                                                if (visibleAlerts.length === 0) return null;
                                                return (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Avisos</p>
                                                        {visibleAlerts.map((a: any, i: number) => { const Icon = a.icon; return <div key={i} className={`text-sm font-medium flex items-center gap-1 ${a.color}`}><Icon className="h-3 w-3" /> {a.label}</div> })}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    {idx < weekData.length - 1 && <Separator />}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function DaySummaryCard({ dayData, isToday, shoppingCount, totalMoney, settings }: { dayData: any, isToday: boolean, shoppingCount: number, totalMoney: number, settings: DailyNotificationSettings }) {
    const showCat = (cat: keyof DailyNotificationSettings['categories']) => settings.categories?.[cat] ?? true;
    const visibleAlerts = dayData.alerts.filter((a: any) => {
        if (a.type === 'vehicle' && !showCat('vehicles')) return false;
        if (a.type === 'med' && !showCat('medicines')) return false;
        if (a.type === 'warranty' && !showCat('warranties')) return false;
        if (a.type === 'insurance' && !showCat('insurances')) return false;
        return true;
    });

    return (
        <Card className={`h-full flex flex-col ${isToday ? 'border-t-4 border-t-blue-500 shadow-md ring-1 ring-blue-500/10' : 'border-t-4 border-t-gray-200 dark:border-t-gray-700'}`}>
            <CardHeader className="pb-3 px-4 pt-4">
                <CardTitle className={`text-lg ${isToday ? 'text-blue-600' : ''}`}>{isToday ? 'Hoy' : format(dayData.date, 'EEEE', { locale: es })}</CardTitle>
                <CardDescription>{format(dayData.date, "d 'de' MMMM", { locale: es })}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 px-4 pb-4 flex-1">
                {showCat('shifts') && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Briefcase className="h-3 w-3" /> Turno</p>
                        {dayData.shifts?.length > 0 ? (
                            dayData.shifts.map((s: any) => (
                                <div key={s.id} className="text-sm font-medium bg-blue-50/50 dark:bg-blue-900/10 p-1.5 rounded text-blue-900 dark:text-blue-100 border border-blue-100 dark:border-blue-800">
                                    {s.title} <span className="text-blue-600/70 font-normal text-xs ml-1">({format(new Date(s.start_time), 'HH:mm')})</span>
                                </div>
                            ))
                        ) : <p className="text-xs text-gray-400 italic pl-1">Libre</p>}
                    </div>
                )}
                {showCat('tasks') && (
                    <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Check className="h-3 w-3" /> Tareas</p>
                        {dayData.tasks?.length > 0 ? (
                            <ul className="space-y-1">
                                {dayData.tasks.slice(0, 3).map((t: any) => (<li key={t.id} className="text-xs flex items-start gap-1.5"><div className="h-1.5 w-1.5 rounded-full bg-blue-400 mt-1 flex-shrink-0" /><span className="line-clamp-1">{t.title}</span></li>))}
                                {dayData.tasks.length > 3 && <li className="text-[10px] text-gray-500 pl-3">+ {dayData.tasks.length - 3} más</li>}
                            </ul>
                        ) : <p className="text-xs text-gray-400 italic pl-1">Nada pendiente</p>}
                    </div>
                )}
                {(visibleAlerts.length > 0 || isToday) && (
                    <div className="space-y-1">
                        {(visibleAlerts.length > 0) && <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Avisos</p>}
                        {visibleAlerts.length > 0 ? (
                            visibleAlerts.map((a: any, i: number) => { const Icon = a.icon; return <div key={i} className={`text-xs flex items-center gap-1 font-medium p-1 rounded bg-gray-50 dark:bg-gray-800 ${a.color}`}><Icon className="h-3 w-3" /><span className="truncate">{a.label}</span></div> })
                        ) : (isToday ? <p className="text-xs text-gray-400 italic pl-1">Sin alertas</p> : null)}
                    </div>
                )}
                <div className="pt-2 mt-2 border-t border-gray-100 dark:border-gray-800 grid grid-cols-2 gap-2">
                    {showCat('shopping') && (
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><ShoppingCart className="h-3 w-3" /> Compras</p>
                            <p className={`text-xs ${shoppingCount > 0 ? 'text-gray-700 dark:text-gray-300 font-medium' : 'text-gray-400 italic'}`}>{shoppingCount > 0 ? `${shoppingCount} items` : 'Vacía'}</p>
                        </div>
                    )}
                    {(showCat('money')) && (
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1"><Wallet className="h-3 w-3" /> Saldo</p>
                            <p className="text-xs font-medium text-green-800 dark:text-green-400">{Number(totalMoney).toFixed(0)}€</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

