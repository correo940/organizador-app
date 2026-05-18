'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Zap, Calculator, Clock, Euro, Leaf } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface EnergyDialogProps {
    manualId: string;
    manualTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EnergyDialog({ manualId, manualTitle, open, onOpenChange }: EnergyDialogProps) {
    const [watts, setWatts] = useState<number | ''>('');
    const [hoursPerDay, setHoursPerDay] = useState<number>(0);
    const [kwhPrice, setKwhPrice] = useState<number>(0.15); // Default price approx

    useEffect(() => {
        if (open) {
            fetchEnergyData();
        }
    }, [open]);

    const fetchEnergyData = async () => {
        try {
            const { data, error } = await supabase
                .from('manuals')
                .select('content')
                .eq('id', manualId)
                .single();

            if (data && data.content) {
                try {
                    const parsed = JSON.parse(data.content);
                    if (parsed.energy) {
                        setWatts(parsed.energy.watts || '');
                        setHoursPerDay(parsed.energy.hours || 0);
                        if (parsed.energy.kwhPrice) setKwhPrice(parsed.energy.kwhPrice);
                    }
                } catch (e) {
                    // Content might not be JSON
                }
            }
        } catch (error) {
            console.error('Error fetching energy data:', error);
        }
    };

    const saveEnergyData = async () => {
        try {
            // First get current content to merge
            const { data: current, error: fetchError } = await supabase
                .from('manuals')
                .select('content')
                .eq('id', manualId)
                .single();

            if (fetchError) throw fetchError;

            let newContent = {};
            try {
                newContent = current.content ? JSON.parse(current.content) : {};
            } catch (e) {
                newContent = { text: current.content };
            }

            // Update energy part
            (newContent as any).energy = {
                watts: Number(watts),
                hours: hoursPerDay,
                kwhPrice: Number(kwhPrice)
            };

            const { error: updateError } = await supabase
                .from('manuals')
                .update({ content: JSON.stringify(newContent) })
                .eq('id', manualId);

            if (updateError) throw updateError;

            toast.success('Datos de consumo guardados');
            onOpenChange(false);
        } catch (error) {
            console.error('Error saving energy data:', error);
            toast.error('Error al guardar datos');
        }
    };

    const calculateCost = () => {
        if (!watts) return { daily: 0, monthly: 0, yearly: 0 };

        const kw = Number(watts) / 1000;
        const dailyKwh = kw * hoursPerDay;

        const daily = dailyKwh * kwhPrice;
        const monthly = daily * 30;
        const yearly = daily * 365;

        return { daily, monthly, yearly };
    };

    const costs = calculateCost();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[450px]">
                <DialogHeader className="bg-gradient-to-r from-yellow-50 to-white pb-4 border-b">
                    <DialogTitle className="flex items-center gap-2 text-yellow-700">
                        <Zap className="h-5 w-5 fill-yellow-500" />
                        Calculadora de Consumo
                    </DialogTitle>
                    <DialogDescription>
                        Estima el gasto energético de "{manualTitle}"
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="watts" className="flex items-center gap-1">
                                <Zap className="h-3 w-3" /> Potencia (Watts)
                            </Label>
                            <Input
                                id="watts"
                                type="number"
                                placeholder="Ej: 2000"
                                value={watts}
                                onChange={(e) => setWatts(Number(e.target.value))}
                                className="border-yellow-200 focus:border-yellow-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price" className="flex items-center gap-1">
                                <Euro className="h-3 w-3" /> Precio kWh (€)
                            </Label>
                            <Input
                                id="price"
                                type="number"
                                step="0.01"
                                value={kwhPrice}
                                onChange={(e) => setKwhPrice(Number(e.target.value))}
                                className="border-yellow-200 focus:border-yellow-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between">
                            <Label className="flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Uso diario
                            </Label>
                            <span className="text-sm font-bold text-yellow-700">{hoursPerDay} horas</span>
                        </div>
                        <Slider
                            value={[hoursPerDay]}
                            onValueChange={(val) => setHoursPerDay(val[0])}
                            max={24}
                            step={0.5}
                            className="py-1 cursor-pointer"
                        />
                    </div>

                    {watts !== '' && (
                        <div className="grid grid-cols-3 gap-2 mt-4">
                            <Card className="bg-yellow-50 border-yellow-200">
                                <CardContent className="p-3 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Diario</p>
                                    <p className="text-lg font-bold text-slate-700">{costs.daily.toFixed(2)}€</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-green-50 border-green-200">
                                <CardContent className="p-3 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Mensual</p>
                                    <p className="text-lg font-bold text-green-900">{costs.monthly.toFixed(2)}€</p>
                                </CardContent>
                            </Card>
                            <Card className="bg-blue-50 border-blue-200">
                                <CardContent className="p-3 text-center">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Anual</p>
                                    <p className="text-lg font-bold text-blue-700">{costs.yearly.toFixed(2)}€</p>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    <div className="text-xs text-muted-foreground bg-slate-50 p-3 rounded flex gap-2 items-start">
                        <Leaf className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                        <p>
                            El cálculo es estimado. La potencia real varía según el modo de uso (ej: una lavadora no usa 2000W todo el ciclo).
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={saveEnergyData} className="bg-yellow-500 hover:bg-yellow-600 text-white">
                        Guardar Configuración
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

