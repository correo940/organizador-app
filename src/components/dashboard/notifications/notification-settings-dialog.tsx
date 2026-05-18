'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bell, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface DailyNotificationSettings {
    enabled: boolean;
    time: string; // HH:mm format
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

export default function NotificationSettingsDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<DailyNotificationSettings>({
        enabled: false,
        time: '08:00',
        categories: {
            tasks: true,
            shifts: true,
            vehicles: true,
            shopping: true,
            money: true,
            medicines: true,
            insurances: true,
            warranties: true,
            expenses: true
        }
    });

    // Load settings on mount
    useEffect(() => {
        const saved = localStorage.getItem('dailyNotificationSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure new keys exist
                setSettings({
                    ...parsed,
                    categories: {
                        tasks: true,
                        shifts: true,
                        vehicles: true,
                        shopping: true,
                        money: true,
                        medicines: true,
                        insurances: true,
                        warranties: true,
                        expenses: true,
                        ...(parsed.categories || {})
                    }
                });
            } catch (e) {
                console.error("Error parsing notification settings", e);
            }
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('dailyNotificationSettings', JSON.stringify(settings));

        // Trigger a custom event so other components (logic hook) can update immediately
        window.dispatchEvent(new Event('notificationSettingsChanged'));

        toast.success(settings.enabled
            ? `Notificaciones activadas para las ${settings.time}`
            : 'Notificaciones desactivadas'
        );
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                    <Bell className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Configurar Resumen Diario
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-1">
                            <Label htmlFor="notifications-enabled" className="text-base">Activar Notificaciones</Label>
                            <p className="text-sm text-muted-foreground">
                                Recibe un resumen diario con tus tareas y eventos.
                            </p>
                        </div>
                        <Switch
                            id="notifications-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
                        />
                    </div>

                    {settings.enabled && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                            <Label htmlFor="notification-time" className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                Hora del Resumen (Mañana siguiente)
                            </Label>
                            <Input
                                id="notification-time"
                                type="time"
                                value={settings.time}
                                onChange={(e) => setSettings(prev => ({ ...prev, time: e.target.value }))}
                                className="w-full text-lg p-3"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Se enviará una notificación con la agenda para el día siguiente.
                            </p>
                        </div>
                    )}

                    {settings.enabled && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-3 delay-100">
                            <Label className="text-sm font-medium">Contenido del Resumen</Label>
                            <div className="space-y-2 border rounded-lg p-3 bg-slate-50 dark:bg-slate-900/50">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-tasks" className="text-sm font-normal cursor-pointer">Tareas Pendientes</Label>
                                    <Switch
                                        id="cat-tasks"
                                        checked={settings.categories?.tasks ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, tasks: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-shifts" className="text-sm font-normal cursor-pointer">Turnos de Trabajo</Label>
                                    <Switch
                                        id="cat-shifts"
                                        checked={settings.categories?.shifts ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, shifts: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-shopping" className="text-sm font-normal cursor-pointer">Lista de Compra</Label>
                                    <Switch
                                        id="cat-shopping"
                                        checked={settings.categories?.shopping ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, shopping: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-medicines" className="text-sm font-normal cursor-pointer">Botiquín (Tomas y Caducidad)</Label>
                                    <Switch
                                        id="cat-medicines"
                                        checked={settings.categories?.medicines ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, medicines: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-vehicles" className="text-sm font-normal cursor-pointer">Garaje (Vehículos)</Label>
                                    <Switch
                                        id="cat-vehicles"
                                        checked={settings.categories?.vehicles ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, vehicles: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-insurances" className="text-sm font-normal cursor-pointer">Seguros</Label>
                                    <Switch
                                        id="cat-insurances"
                                        checked={settings.categories?.insurances ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, insurances: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-warranties" className="text-sm font-normal cursor-pointer">Garantías</Label>
                                    <Switch
                                        id="cat-warranties"
                                        checked={settings.categories?.warranties ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, warranties: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-expenses" className="text-sm font-normal cursor-pointer">Gastos Compartidos (Deudas)</Label>
                                    <Switch
                                        id="cat-expenses"
                                        checked={settings.categories?.expenses ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, expenses: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="cat-money" className="text-sm font-normal cursor-pointer">Mi Economía (Cuentas)</Label>
                                    <Switch
                                        id="cat-money"
                                        checked={settings.categories?.money ?? true}
                                        onCheckedChange={(c) => setSettings(prev => ({ ...prev, categories: { ...prev.categories, money: c } }))}
                                        className="scale-75"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button className="flex-1" variant="outline" onClick={() => {
                            router.push('/apps/resumen-diario');
                            setOpen(false);
                        }}>
                            Ver Resumen
                        </Button>
                        <Button className="flex-1" onClick={handleSave}>
                            Guardar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
