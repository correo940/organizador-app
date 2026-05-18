'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, Clock, Smartphone, Globe, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

export interface SavingsNotificationSettings {
    enabled: boolean;
    frequency: 'daily' | 'weekly' | 'monthly' | 'disabled';
    weekDays: number[];  // 0=Dom, 1=Lun... 6=Sab
    monthDay: number;    // 1-31
    time: string;        // HH:mm
    channels: ('app' | 'web')[];  // Puede incluir ambos
}

const DAYS_OF_WEEK = [
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
    { value: 0, label: 'Domingo' },
];

const DEFAULT_SETTINGS: SavingsNotificationSettings = {
    enabled: false,
    frequency: 'weekly',
    weekDays: [4], // Jueves por defecto
    monthDay: 1,
    time: '09:00',
    channels: ['app'] // Por defecto solo APK
};

export default function SavingsNotificationSettings() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState<SavingsNotificationSettings>(DEFAULT_SETTINGS);

    // Load settings on mount
    useEffect(() => {
        const saved = localStorage.getItem('savingsNotificationSettings');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setSettings({ ...DEFAULT_SETTINGS, ...parsed });
            } catch (e) {
                console.error("Error parsing savings notification settings", e);
            }
        }
    }, []);

    const handleSave = () => {
        const settingsToSave = {
            ...settings,
            enabled: settings.frequency !== 'disabled' && settings.enabled
        };

        localStorage.setItem('savingsNotificationSettings', JSON.stringify(settingsToSave));

        // Trigger event for notification scheduling
        window.dispatchEvent(new CustomEvent('savingsNotificationSettingsChanged', { detail: settingsToSave }));

        if (settingsToSave.enabled) {
            let freqText = '';
            if (settings.frequency === 'daily') {
                freqText = 'todos los días';
            } else if (settings.frequency === 'weekly') {
                const dayNames = settings.weekDays.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.label).join(', ');
                freqText = `los ${dayNames}`;
            } else if (settings.frequency === 'monthly') {
                freqText = `el día ${settings.monthDay} de cada mes`;
            }

            const channelTexts: string[] = [];
            if (settings.channels.includes('app')) channelTexts.push('APK');
            if (settings.channels.includes('web')) channelTexts.push('Web');
            const channelText = channelTexts.join(' y ');
            toast.success(`Notificaciones activadas ${freqText} a las ${settings.time} en ${channelText}`);
        } else {
            toast.success('Notificaciones de ahorros desactivadas');
        }

        setOpen(false);
    };

    const toggleWeekDay = (day: number) => {
        setSettings(prev => ({
            ...prev,
            weekDays: prev.weekDays.includes(day)
                ? prev.weekDays.filter(d => d !== day)
                : [...prev.weekDays, day].sort()
        }));
    };

    const toggleChannel = (channel: 'app' | 'web') => {
        setSettings(prev => ({
            ...prev,
            channels: prev.channels.includes(channel)
                ? prev.channels.filter(c => c !== channel)
                : [...prev.channels, channel]
        }));
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Bell className="h-4 w-4" />
                    Notificaciones
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bell className="h-5 w-5" />
                        Notificaciones de Mi Economía
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Enable/Disable */}
                    <div className="flex items-center justify-between space-x-2">
                        <div className="space-y-1">
                            <Label htmlFor="savings-notifications-enabled" className="text-base">Activar Notificaciones</Label>
                            <p className="text-sm text-muted-foreground">
                                Recibe resúmenes de tu economía según tu preferencia.
                            </p>
                        </div>
                        <Switch
                            id="savings-notifications-enabled"
                            checked={settings.enabled}
                            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enabled: checked }))}
                        />
                    </div>

                    {settings.enabled && (
                        <>
                            {/* Frequency Selection */}
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <Label className="flex items-center gap-2">
                                    <Calendar className="h-4 w-4" />
                                    Frecuencia
                                </Label>
                                <Select
                                    value={settings.frequency}
                                    onValueChange={(v: 'daily' | 'weekly' | 'monthly') => setSettings(prev => ({ ...prev, frequency: v }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily">Diaria (todos los días)</SelectItem>
                                        <SelectItem value="weekly">Semanal (días específicos)</SelectItem>
                                        <SelectItem value="monthly">Mensual (un día al mes)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Weekly Days Selection */}
                            {settings.frequency === 'weekly' && (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <Label>Días de la semana</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {DAYS_OF_WEEK.map(day => (
                                            <div key={day.value} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`day-${day.value}`}
                                                    checked={settings.weekDays.includes(day.value)}
                                                    onCheckedChange={() => toggleWeekDay(day.value)}
                                                />
                                                <Label htmlFor={`day-${day.value}`} className="text-sm font-normal cursor-pointer">
                                                    {day.label}
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                    {settings.weekDays.length === 0 && (
                                        <p className="text-xs text-red-500">Selecciona al menos un día</p>
                                    )}
                                </div>
                            )}

                            {/* Monthly Day Selection */}
                            {settings.frequency === 'monthly' && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                    <Label>Día del mes</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="31"
                                        value={settings.monthDay}
                                        onChange={(e) => setSettings(prev => ({
                                            ...prev,
                                            monthDay: Math.max(1, Math.min(31, parseInt(e.target.value) || 1))
                                        }))}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Si el mes no tiene ese día, se enviará el último día del mes.
                                    </p>
                                </div>
                            )}

                            {/* Time Selection */}
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label htmlFor="savings-notification-time" className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Hora de la notificación
                                </Label>
                                <Input
                                    id="savings-notification-time"
                                    type="time"
                                    value={settings.time}
                                    onChange={(e) => setSettings(prev => ({ ...prev, time: e.target.value }))}
                                    className="w-full"
                                />
                            </div>

                            {/* Channel Selection */}
                            <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                <Label>¿Dónde recibir la notificación?</Label>
                                <div className="space-y-2">
                                    <div
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${settings.channels.includes('app')
                                            ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                                            }`}
                                        onClick={() => toggleChannel('app')}
                                    >
                                        <Checkbox
                                            checked={settings.channels.includes('app')}
                                            onCheckedChange={() => toggleChannel('app')}
                                        />
                                        <Smartphone className={`h-5 w-5 ${settings.channels.includes('app') ? 'text-green-800' : 'text-muted-foreground'}`} />
                                        <div>
                                            <p className="font-medium text-sm">APK (Android / iOS)</p>
                                            <p className="text-xs text-muted-foreground">
                                                Notificación push en tu móvil
                                            </p>
                                        </div>
                                    </div>
                                    <div
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${settings.channels.includes('web')
                                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                                            : 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                                            }`}
                                        onClick={() => toggleChannel('web')}
                                    >
                                        <Checkbox
                                            checked={settings.channels.includes('web')}
                                            onCheckedChange={() => toggleChannel('web')}
                                        />
                                        <Globe className={`h-5 w-5 ${settings.channels.includes('web') ? 'text-blue-600' : 'text-muted-foreground'}`} />
                                        <div>
                                            <p className="font-medium text-sm">Web (quioba.com)</p>
                                            <p className="text-xs text-muted-foreground">
                                                Banner al entrar a la aplicación web
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {settings.channels.length === 0 && (
                                    <p className="text-xs text-red-500">Selecciona al menos un canal</p>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleSave}
                        disabled={settings.enabled && (settings.frequency === 'weekly' && settings.weekDays.length === 0 || settings.channels.length === 0)}
                    >
                        Guardar Configuración
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

