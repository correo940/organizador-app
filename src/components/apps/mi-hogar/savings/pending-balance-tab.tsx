'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import {
    Plus,
    RotateCcw,
    CheckCircle2,
    Clock,
    FolderOpen,
    Trash2,
    Camera,
    ShoppingBag,
    Receipt,
    ArrowDownRight,
    Sparkles,
    Edit3
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { PendingBalanceImageScanner } from './pending-balance-image-scanner';

// --- TYPES ---
export type PendingProject = {
    id: string;
    name: string;
    icon: string;
    color: string;
};

export type PendingExpense = {
    id: string;
    project_id: string | null;
    source_account_id: string | null;
    concept: string;
    amount: number;
    date: string;
    merchant: string | null;
    status: 'pending' | 'repaid';
    repaid_date: string | null;
};

type BankAccountLite = {
    id: string;
    name: string;
    bank_name: string;
    color: string;
    current_balance: number;
};

// --- EXAMPLE PROJECTS ---
const EXAMPLE_PROJECTS = [
    { name: 'Vacaciones Verano', icon: '🏖️', color: '#f59e0b' },
    { name: 'Vacaciones Invierno', icon: '🏔️', color: '#3b82f6' },
    { name: 'Navidad', icon: '🎄', color: '#ef4444' },
    { name: 'Reformas Casa', icon: '🏠', color: '#8b5cf6' },
    { name: 'Tecnología', icon: '💻', color: '#06b6d4' },
    { name: 'Regalos', icon: '🎁', color: '#ec4899' },
    { name: 'Otros', icon: '📁', color: '#64748b' },
];

interface PendingBalanceTabProps {
    userId: string;
    accounts: BankAccountLite[];
    onBalanceChange?: () => void;
}

export default function PendingBalanceTab({ userId, accounts, onBalanceChange }: PendingBalanceTabProps) {
    const [projects, setProjects] = useState<PendingProject[]>([]);
    const [expenses, setExpenses] = useState<PendingExpense[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialog states
    const [isAddProjectOpen, setIsAddProjectOpen] = useState(false);
    const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

    // Forms
    const [newProject, setNewProject] = useState({ name: '', icon: '📁', color: '#6366f1' });
    const [newExpense, setNewExpense] = useState({
        concept: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'),
        merchant: '', projectId: 'none', accountId: 'none'
    });

    // Filter
    const [filterProject, setFilterProject] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'repaid'>('all');

    // Animation variants
    const containerVariants: Variants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };
    const itemVariants: Variants = {
        hidden: { y: 15, opacity: 0 },
        visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120 } }
    };

    useEffect(() => {
        if (userId) fetchAll();
    }, [userId]);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [{ data: projs }, { data: exps }] = await Promise.all([
                supabase.from('pending_balance_projects').select('*').eq('user_id', userId).order('created_at'),
                supabase.from('pending_balance_expenses').select('*').eq('user_id', userId).order('date', { ascending: false })
            ]);
            setProjects(projs || []);
            setExpenses(exps || []);
        } catch (err) {
            console.error(err);
            toast.error('Error al cargar Balance Pendiente');
        } finally {
            setLoading(false);
        }
    };

    // --- CALCULATIONS ---
    const totalPending = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);
    const totalRepaid = expenses.filter(e => e.status === 'repaid').reduce((s, e) => s + e.amount, 0);
    const totalAll = expenses.reduce((s, e) => s + e.amount, 0);

    const getProjectStats = (projectId: string) => {
        const projExpenses = expenses.filter(e => e.project_id === projectId);
        return {
            total: projExpenses.reduce((s, e) => s + e.amount, 0),
            pending: projExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0),
            repaid: projExpenses.filter(e => e.status === 'repaid').reduce((s, e) => s + e.amount, 0),
            count: projExpenses.length
        };
    };

    // --- ACTIONS ---
    const handleCreateProject = async () => {
        if (!newProject.name.trim()) return toast.error('Nombre obligatorio');
        try {
            const { error } = await supabase.from('pending_balance_projects').insert({
                user_id: userId, name: newProject.name, icon: newProject.icon, color: newProject.color
            });
            if (error) throw error;
            toast.success('Proyecto creado');
            setIsAddProjectOpen(false);
            setNewProject({ name: '', icon: '📁', color: '#6366f1' });
            fetchAll();
        } catch (err) {
            toast.error('Error al crear proyecto');
        }
    };

    const handleDeleteProject = async (id: string) => {
        if (!window.confirm('¿Eliminar proyecto? Los gastos asociados perderán su proyecto.')) return;
        try {
            await supabase.from('pending_balance_projects').delete().eq('id', id);
            toast.success('Proyecto eliminado');
            fetchAll();
        } catch { toast.error('Error al eliminar'); }
    };

    const handleCreateExpense = async () => {
        if (!newExpense.concept || !newExpense.amount) return toast.error('Concepto e importe son obligatorios');
        try {
            const amount = parseFloat(newExpense.amount);
            const payload: any = {
                user_id: userId,
                concept: newExpense.concept,
                amount,
                date: newExpense.date,
                merchant: newExpense.merchant || null,
                project_id: newExpense.projectId === 'none' ? null : newExpense.projectId,
                source_account_id: newExpense.accountId === 'none' ? null : newExpense.accountId,
                status: 'pending'
            };

            const { error } = await supabase.from('pending_balance_expenses').insert(payload);
            if (error) throw error;

            // If linked to account, subtract from balance
            if (newExpense.accountId !== 'none') {
                const acc = accounts.find(a => a.id === newExpense.accountId);
                if (acc) {
                    await supabase.from('savings_accounts').update({
                        current_balance: acc.current_balance - amount
                    }).eq('id', acc.id);

                    // Also record as transaction
                    await supabase.from('savings_account_transactions').insert({
                        account_id: acc.id,
                        amount: -amount,
                        date: newExpense.date,
                        description: `Balance Pendiente: ${newExpense.concept}`
                    });
                }
            }

            toast.success('Gasto registrado en Balance Pendiente');
            setIsAddExpenseOpen(false);
            setNewExpense({
                concept: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'),
                merchant: '', projectId: 'none', accountId: 'none'
            });
            fetchAll();
            onBalanceChange?.();
        } catch (err) {
            console.error(err);
            toast.error('Error al registrar gasto');
        }
    };

    const handleMarkRepaid = async (expense: PendingExpense) => {
        try {
            const { error } = await supabase.from('pending_balance_expenses').update({
                status: 'repaid',
                repaid_date: format(new Date(), 'yyyy-MM-dd')
            }).eq('id', expense.id);
            if (error) throw error;

            // If it was linked to an account, add money back
            if (expense.source_account_id) {
                const acc = accounts.find(a => a.id === expense.source_account_id);
                if (acc) {
                    await supabase.from('savings_accounts').update({
                        current_balance: acc.current_balance + expense.amount
                    }).eq('id', expense.source_account_id);

                    await supabase.from('savings_account_transactions').insert({
                        account_id: expense.source_account_id,
                        amount: expense.amount,
                        date: format(new Date(), 'yyyy-MM-dd'),
                        description: `Reposición: ${expense.concept}`
                    });
                }
            }

            toast.success('¡Gasto repuesto! 💪');
            fetchAll();
            onBalanceChange?.();
        } catch (err) {
            toast.error('Error al marcar como repuesto');
        }
    };

    const handleDeleteExpense = async (id: string) => {
        if (!window.confirm('¿Eliminar este gasto pendiente?')) return;
        try {
            await supabase.from('pending_balance_expenses').delete().eq('id', id);
            toast.success('Gasto eliminado');
            fetchAll();
        } catch { toast.error('Error al eliminar'); }
    };

    // --- FILTERED EXPENSES ---
    const filteredExpenses = expenses.filter(e => {
        if (filterProject !== 'all' && e.project_id !== filterProject) return false;
        if (filterStatus !== 'all' && e.status !== filterStatus) return false;
        return true;
    });

    if (loading) {
        return (
            <div className="flex h-[300px] items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
            </div>
        );
    }

    return (
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
            {/* SUMMARY CARDS */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-none shadow-lg bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 mb-2">
                            <Clock className="w-4 h-4" />
                            <span className="text-sm font-medium">Pendiente de Reponer</span>
                        </div>
                        <p className="text-3xl font-bold text-orange-700 dark:text-orange-300">
                            {totalPending.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {expenses.filter(e => e.status === 'pending').length} gastos pendientes
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-green-50 to-green-50 dark:from-green-800-950/20 dark:to-green-950/20">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-2 text-green-800 dark:text-green-400 mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">Ya Repuesto</span>
                        </div>
                        <p className="text-3xl font-bold text-green-900 dark:text-green-300">
                            {totalRepaid.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-lg bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/20 dark:to-violet-950/20">
                    <CardContent className="p-5">
                        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                            <Receipt className="w-4 h-4" />
                            <span className="text-sm font-medium">Total Gastado</span>
                        </div>
                        <p className="text-3xl font-bold text-indigo-700 dark:text-indigo-300">
                            {totalAll.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                        </p>
                        {totalAll > 0 && (
                            <div className="mt-2">
                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Progreso reposición</span>
                                    <span>{Math.round((totalRepaid / totalAll) * 100)}%</span>
                                </div>
                                <Progress value={(totalRepaid / totalAll) * 100} className="h-1.5" />
                            </div>
                        )}
                    </CardContent>
                </Card>
            </motion.div>

            {/* PROJECTS SECTION */}
            <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-orange-500" /> Proyectos
                    </h3>
                    <Button onClick={() => setIsAddProjectOpen(true)} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2 rounded-full px-4">
                        <Plus className="w-4 h-4" /> Nuevo
                    </Button>
                </div>

                {projects.length === 0 ? (
                    <Card className="border-2 border-dashed border-orange-200 dark:border-orange-800/50 bg-orange-50/30 dark:bg-orange-950/10">
                        <CardContent className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/40 rounded-full flex items-center justify-center mb-5 relative">
                                <FolderOpen className="w-10 h-10 text-orange-400 dark:text-orange-500" />
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center">
                                    <Sparkles className="w-3 h-3 text-orange-500" />
                                </div>
                            </div>
                            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No hay proyectos todavía</p>
                            <p className="text-sm text-muted-foreground max-w-sm">
                                Los proyectos te ayudan a agrupar tus gastos pendientes. Crea uno como <span className="font-medium text-slate-900 dark:text-white">Vacaciones</span> o <span className="font-medium text-slate-900 dark:text-white">Navidad</span>.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {projects.map(proj => {
                            const stats = getProjectStats(proj.id);
                            return (
                                <motion.div key={proj.id} variants={itemVariants}>
                                    <Card className="border-none shadow-md hover:shadow-lg transition-shadow cursor-pointer group overflow-hidden"
                                        onClick={() => setFilterProject(filterProject === proj.id ? 'all' : proj.id)}
                                    >
                                        <CardContent className="p-4 relative">
                                            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: proj.color }} />
                                            <div className={`ring-2 ring-transparent ${filterProject === proj.id ? 'ring-orange-400' : ''} rounded-lg`}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xl">{proj.icon}</span>
                                                    <span className="font-semibold text-sm truncate">{proj.name}</span>
                                                </div>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex justify-between">
                                                        <span className="text-orange-600">Pendiente</span>
                                                        <span className="font-bold">{stats.pending.toFixed(0)}€</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-green-800">Repuesto</span>
                                                        <span className="font-bold">{stats.repaid.toFixed(0)}€</span>
                                                    </div>
                                                    {stats.total > 0 && (
                                                        <Progress value={(stats.repaid / stats.total) * 100} className="h-1 mt-1" />
                                                    )}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
                                                onClick={(e) => { e.stopPropagation(); handleDeleteProject(proj.id); }}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* EXPENSES LIST */}
            <motion.div variants={itemVariants}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <ShoppingBag className="w-5 h-5 text-orange-500" /> Gastos
                    </h3>
                    <div className="flex items-center gap-2">
                        {/* Status Filter */}
                        <div className="flex rounded-lg border p-0.5 gap-0.5 text-xs">
                            {(['all', 'pending', 'repaid'] as const).map(s => (
                                <button key={s} onClick={() => setFilterStatus(s)}
                                    className={`px-3 py-1.5 rounded-md font-medium transition-colors ${filterStatus === s
                                        ? s === 'pending' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                            : s === 'repaid' ? 'bg-green-100 text-green-900 dark:bg-green-950/30 dark:text-green-300'
                                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                        : 'text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-800'
                                        }`}
                                >
                                    {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendientes' : 'Repuestos'}
                                </button>
                            ))}
                        </div>
                        <Button onClick={() => setIsAddExpenseOpen(true)} size="sm" className="bg-orange-500 hover:bg-orange-600 text-white gap-2 rounded-full px-4">
                            <Plus className="w-4 h-4" /> Añadir Gasto
                        </Button>
                    </div>
                </div>

                {filterProject !== 'all' && (
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm text-muted-foreground">Filtrando por:</span>
                        <span className="text-sm font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-0.5 rounded-full">
                            {projects.find(p => p.id === filterProject)?.icon} {projects.find(p => p.id === filterProject)?.name}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setFilterProject('all')}>Quitar filtro</Button>
                    </div>
                )}

                {filteredExpenses.length === 0 ? (
                    <Card className="border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
                        <CardContent className="p-16 text-center flex flex-col items-center justify-center">
                            <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6 relative">
                                <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600" />
                                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-slate-950">
                                    <Plus className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                </div>
                            </div>
                            <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                No tienes gastos {filterStatus === 'pending' ? 'pendientes' : filterStatus === 'repaid' ? 'repuestos' : 'registrados aún'}
                            </p>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Cuando uses dinero de tus ahorros en lugar de la cuenta corriente, regístralo aquí para llevar la cuenta visual de lo que te "autodebes".
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-2">
                        {filteredExpenses.map(expense => {
                            const project = projects.find(p => p.id === expense.project_id);
                            const account = accounts.find(a => a.id === expense.source_account_id);
                            return (
                                <motion.div key={expense.id} variants={itemVariants}
                                    className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${expense.status === 'repaid'
                                        ? 'bg-green-50/50 dark:bg-green-800-950/10 border-green-100 dark:border-green-950/30'
                                        : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 shadow-sm'
                                        }`}
                                >
                                    {/* Icon */}
                                    <div className={`p-2.5 rounded-xl shrink-0 ${expense.status === 'repaid'
                                        ? 'bg-green-100 dark:bg-green-950/30 text-green-800'
                                        : 'bg-orange-100 dark:bg-orange-900/30 text-orange-600'
                                        }`}>
                                        {expense.status === 'repaid'
                                            ? <CheckCircle2 className="w-5 h-5" />
                                            : <Clock className="w-5 h-5" />
                                        }
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className={`font-medium truncate ${expense.status === 'repaid' ? 'line-through text-muted-foreground' : ''}`}>
                                                {expense.concept}
                                            </p>
                                            {project && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                                                    style={{ backgroundColor: project.color + '20', color: project.color }}>
                                                    {project.icon} {project.name}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                            <span>{format(new Date(expense.date), 'd MMM yyyy', { locale: es })}</span>
                                            {expense.merchant && <span>• {expense.merchant}</span>}
                                            {account && <span>• {account.name}</span>}
                                            {expense.status === 'repaid' && expense.repaid_date && (
                                                <span className="text-green-800">• Repuesto el {format(new Date(expense.repaid_date), 'd MMM', { locale: es })}</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Amount */}
                                    <span className={`font-bold text-base shrink-0 ${expense.status === 'repaid' ? 'text-green-800' : 'text-orange-600'}`}>
                                        {expense.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}
                                    </span>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                        {expense.status === 'pending' && (
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 hover:text-green-900 hover:bg-green-50"
                                                onClick={() => handleMarkRepaid(expense)} title="Marcar como repuesto">
                                                <RotateCcw className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500"
                                            onClick={() => handleDeleteExpense(expense.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* --- DIALOGS --- */}

            {/* Add Project Dialog */}
            <Dialog open={isAddProjectOpen} onOpenChange={setIsAddProjectOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-orange-500" /> Nuevo Proyecto
                        </DialogTitle>
                        <DialogDescription>Agrupa tus gastos por proyecto para un mejor seguimiento.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Nombre del proyecto</Label>
                            <Input placeholder="Ej: Vacaciones Verano 2026" value={newProject.name}
                                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Icono</Label>
                                <Input placeholder="Emoji" value={newProject.icon} className="text-center text-xl"
                                    onChange={(e) => setNewProject({ ...newProject, icon: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Color</Label>
                                <input type="color" className="h-9 w-full p-1 rounded border cursor-pointer" value={newProject.color}
                                    onChange={(e) => setNewProject({ ...newProject, color: e.target.value })} />
                            </div>
                        </div>

                        {/* Example suggestions */}
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Ideas de proyectos</Label>
                            <div className="flex flex-wrap gap-2">
                                {EXAMPLE_PROJECTS.map(ex => (
                                    <button key={ex.name}
                                        onClick={() => setNewProject({ name: ex.name, icon: ex.icon, color: ex.color })}
                                        className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                                    >
                                        <span>{ex.icon}</span> {ex.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateProject} className="bg-orange-500 hover:bg-orange-600 text-white">Crear Proyecto</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Add Expense Dialog */}
            <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 text-orange-500" /> Registrar Gasto
                        </DialogTitle>
                        <DialogDescription>Registra un gasto hecho con dinero ahorrado. Se añadirá como pendiente de reposición.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <PendingBalanceImageScanner 
                            onScanSuccess={(data) => {
                                setNewExpense({
                                    ...newExpense,
                                    amount: data.amount,
                                    concept: data.concept,
                                    merchant: data.merchant,
                                    date: data.date
                                });
                            }} 
                        />
                        <div className="flex items-center gap-4 py-2">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">o manual</span>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                        </div>

                        <div className="space-y-2">
                            <Label>Concepto</Label>
                            <Input placeholder="Ej: Hotel Mallorca, Regalos navidad..." value={newExpense.concept}
                                onChange={(e) => setNewExpense({ ...newExpense, concept: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Importe (€)</Label>
                                <Input type="number" placeholder="Ej: 250" value={newExpense.amount}
                                    onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Fecha</Label>
                                <Input type="date" value={newExpense.date}
                                    onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Comercio (Opcional)</Label>
                            <Input placeholder="Ej: Booking, Amazon, El Corte Inglés..." value={newExpense.merchant}
                                onChange={(e) => setNewExpense({ ...newExpense, merchant: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <Label>Proyecto</Label>
                            <Select value={newExpense.projectId} onValueChange={(v) => setNewExpense({ ...newExpense, projectId: v })}>
                                <SelectTrigger><SelectValue placeholder="Sin proyecto" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Sin proyecto</SelectItem>
                                    {projects.map(p => (
                                        <SelectItem key={p.id} value={p.id}>
                                            <span className="flex items-center gap-2">{p.icon} {p.name}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-100 dark:border-orange-900">
                            <Label className="text-orange-700 dark:text-orange-400 font-semibold flex items-center gap-2">
                                <ArrowDownRight className="w-4 h-4" /> Cuenta origen (Opcional)
                            </Label>
                            <p className="text-xs text-muted-foreground mb-2">Si seleccionas una cuenta, el importe se restará automáticamente de su saldo.</p>
                            <Select value={newExpense.accountId} onValueChange={(v) => setNewExpense({ ...newExpense, accountId: v })}>
                                <SelectTrigger><SelectValue placeholder="No descontar de ninguna cuenta" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No descontar</SelectItem>
                                    {accounts.map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.bank_name}) — {acc.current_balance.toFixed(0)}€
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateExpense} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
                            <ShoppingBag className="w-4 h-4" /> Registrar Gasto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}

