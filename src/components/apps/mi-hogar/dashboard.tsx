'use client';

import { motion } from 'framer-motion';
import {
    Lock,
    ShoppingCart,
    CheckSquare,
    Shield,
    Home,
    LogOut,
    Receipt,
    ShieldCheck,
    PiggyBank,
    Calendar,
    Sword,
    Wallet,
    BookOpen,
    MessageCircle,
    Leaf,
    Brain
} from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

const modules = [
    {
        title: 'Asistente Quioba',
        description: 'Pregunta sobre tus datos personales',
        icon: MessageCircle,
        href: '/apps/mi-hogar/asistente',
        color: 'text-violet-500',
        bg: 'bg-violet-500/10',
    },
    {
        title: 'Contraseñas',
        description: 'Gestor seguro de claves WiFi y cuentas',
        icon: Lock,
        href: '/apps/mi-hogar/passwords',
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
    },
    {
        title: 'Lista de Compra',
        description: 'Gestiona productos y reposiciones',
        icon: ShoppingCart,
        href: '/apps/mi-hogar/shopping',
        color: 'text-green-800',
        bg: 'bg-green-800/10',
    },
    {
        title: 'Manual y Mantenimiento',
        description: 'Guías, garantías y checklists',
        icon: BookOpen,
        href: '/apps/mi-hogar/manuals',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
    },
    {
        title: 'Tareas y Alarmas',
        description: 'Organización y recordatorios',
        icon: CheckSquare,
        href: '/apps/mi-hogar/tasks',
        color: 'text-purple-500',
        bg: 'bg-purple-500/10',
    },
    {
        title: 'Seguros',
        description: 'Pólizas y vencimientos',
        icon: Shield,
        href: '/apps/mi-hogar/insurance',
        color: 'text-rose-500',
        bg: 'bg-rose-500/10',
    },
    {
        title: 'Garantías',
        description: 'Tus tickets escaneados y alertas',
        icon: Receipt,
        href: '/apps/mi-hogar/warranties',
        color: 'text-pink-500',
        bg: 'bg-pink-500/10',
    },
    {
        title: 'Caja Fuerte',
        description: 'Documentos seguros y encriptados',
        icon: ShieldCheck,
        href: '/apps/mi-hogar/documents',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
    },
    {
        title: 'Gastos Compartidos',
        description: 'Gastos compartidos 50/50',
        icon: Wallet,
        href: '/apps/mi-hogar/expenses',
        color: 'text-green-800',
        bg: 'bg-green-800/10',
    },
    {
        title: 'Mi Economía',
        description: 'Control de tus finanzas y metas',
        icon: PiggyBank,
        href: '/apps/mi-hogar/savings',
        color: 'text-amber-500',
        bg: 'bg-amber-500/10',
    },
    {
        title: 'Cuadrante',
        description: 'Gestión de turnos de trabajo',
        icon: Calendar,
        href: '/apps/mi-hogar/roster',
        color: 'text-cyan-500',
        bg: 'bg-cyan-500/10',
    },
    {
        title: 'Mi Huerto',
        description: 'Identifica plantas y automatiza riegos con IA',
        icon: Leaf,
        href: '/apps/huerto',
        color: 'text-green-800',
        bg: 'bg-green-800/10',
    },
    {
        title: 'Pausa',
        description: 'Meditacion breve, respiracion y espacio mental',
        icon: Brain,
        href: '/apps/mi-hogar/meditation',
        color: 'text-green-800',
        bg: 'bg-green-800/10',
    },
    {
        title: 'El Debate',
        description: 'Discute y vota en el ring virtual',
        icon: Sword,
        href: '/apps/debate',
        color: 'text-red-600',
        bg: 'bg-red-500/10',
    }
];

export default function MiHogarDashboard() {
    const { signOut } = useAuth();

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex items-center justify-between mb-8">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-xl bg-primary/10">
                            <Home className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight">Mi Quioba</h1>
                            <p className="text-muted-foreground">Centro de control doméstico inteligente</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => signOut()} title="Cerrar sesión">
                        <LogOut className="w-5 h-5" />
                    </Button>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {modules.map((module, index) => (
                        <Link key={module.title} href={module.href}>
                            <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                            >
                                <Card className="h-full border-2 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden group">
                                    <CardHeader className="pb-4">
                                        <div className={`w-12 h-12 rounded-lg ${module.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                                            <module.icon className={`w-6 h-6 ${module.color}`} />
                                        </div>
                                        <CardTitle className="text-xl">{module.title}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <CardDescription className="text-base">
                                            {module.description}
                                        </CardDescription>
                                    </CardContent>
                                </Card>
                            </motion.div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}
