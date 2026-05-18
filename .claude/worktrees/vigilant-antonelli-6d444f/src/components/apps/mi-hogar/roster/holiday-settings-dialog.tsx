'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SPANISH_REGIONS } from '@/lib/holidays';
import { MapPin, Plus, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';

interface HolidaySettingsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRegionChange: (region: string) => void;
    onSave?: () => void;
}

interface CustomHoliday {
    id: string;
    day: number;
    month: number; // 1-12
    name: string;
}

export default function HolidaySettingsDialog({ open, onOpenChange, onRegionChange, onSave }: HolidaySettingsDialogProps) {
    const [selectedRegion, setSelectedRegion] = useState('');
    const [customHolidays, setCustomHolidays] = useState<CustomHoliday[]>([]);

    // New Holiday Inputs
    const [newDay, setNewDay] = useState('');
    const [newMonth, setNewMonth] = useState('');
    const [newName, setNewName] = useState('');

    useEffect(() => {
        if (open) {
            const savedRegion = localStorage.getItem('holiday_region_es');
            if (savedRegion) setSelectedRegion(savedRegion);

            const savedCustom = localStorage.getItem('custom_holidays_es');
            if (savedCustom) {
                try {
                    setCustomHolidays(JSON.parse(savedCustom));
                } catch (e) {
                    console.error("Error parsing custom holidays", e);
                }
            }
        }
    }, [open]);

    const handleAddCustom = () => {
        if (!newDay || !newMonth || !newName) {
            toast.error("Rellena día, mes y nombre.");
            return;
        }
        const d = parseInt(newDay);
        const m = parseInt(newMonth);

        if (isNaN(d) || d < 1 || d > 31) {
            toast.error("Día inválido");
            return;
        }

        const newHoliday: CustomHoliday = {
            id: Date.now().toString(),
            day: d,
            month: m,
            name: newName
        };

        setCustomHolidays([...customHolidays, newHoliday]);
        setNewName('');
        setNewDay('');
        // Keep month selected for convenience
    };

    const handleDeleteCustom = (id: string) => {
        setCustomHolidays(prev => prev.filter(h => h.id !== id));
    };

    const handleSave = () => {
        // Save Region
        if (selectedRegion) {
            localStorage.setItem('holiday_region_es', selectedRegion);
            onRegionChange(selectedRegion);
        }

        // Save Custom Holidays
        localStorage.setItem('custom_holidays_es', JSON.stringify(customHolidays));

        toast.success("Preferencias y festivos locales guardados.");
        if (onSave) onSave(); // Trigger parent refresh
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-primary" />
                        Configurar Festivos
                    </DialogTitle>
                    <DialogDescription>
                        Configura tu región y añade festivos locales.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-6 py-4 px-1">
                    {/* Region Selector */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium block flex items-center gap-2">
                            <MapPin className="h-3 w-3" /> Comunidad Autónoma
                        </label>
                        <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona una región" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Solo Nacionales</SelectItem>
                                {SPANISH_REGIONS.map(region => (
                                    <SelectItem key={region.code} value={region.code}>
                                        {region.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-[11px] text-muted-foreground">
                            Incluye los festivos oficiales de la comunidad seleccionada.
                        </p>
                    </div>

                    <hr className="border-muted" />

                    {/* Custom Holidays */}
                    <div className="space-y-3">
                        <label className="text-sm font-medium block flex items-center gap-2">
                            <CalendarDays className="h-3 w-3" /> Festivos Locales / Propios
                        </label>
                        <div className="bg-muted/30 p-3 rounded-lg space-y-3 border">
                            <div className="flex gap-2">
                                <div className="w-16">
                                    <Input
                                        type="number"
                                        placeholder="Día"
                                        min={1}
                                        max={31}
                                        value={newDay}
                                        onChange={e => setNewDay(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <div className="w-28">
                                    <Select value={newMonth} onValueChange={setNewMonth}>
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue placeholder="Mes" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((m, i) => (
                                                <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1">
                                    <Input
                                        placeholder="Nombre (ej. San Roque)"
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        className="h-8 text-xs"
                                    />
                                </div>
                                <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleAddCustom}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            <p className="text-[10px] text-muted-foreground text-center">
                                Añade los 2 festivos de tu localidad aquí.<br />Se repetirán automáticamente cada año.
                            </p>

                            {/* List */}
                            {customHolidays.length > 0 && (
                                <div className="space-y-1 mt-2">
                                    {customHolidays.map(h => (
                                        <div key={h.id} className="flex items-center justify-between bg-background border p-2 rounded text-sm group">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1 rounded">
                                                    {h.day.toString().padStart(2, '0')}/{h.month.toString().padStart(2, '0')}
                                                </span>
                                                <span className="truncate max-w-[150px] font-medium" title={h.name}>{h.name}</span>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-500" onClick={() => handleDeleteCustom(h.id)}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="py-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={handleSave}>Guardar Todo</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
