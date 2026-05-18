'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, PiggyBank, Euro } from 'lucide-react';
import { toast } from 'sonner';

export type ExpenseForm = {
    id?: string;
    title: string;
    amount: number;
    paid_by: string; // 'Mi' | 'Partner'
    category: string;
    date: string;
};

interface ExpenseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: ExpenseForm;
    setForm: (form: ExpenseForm) => void;
    onSave: () => void;
    saving?: boolean;
}

const CATEGORIES = ['Comida', 'Hogar', 'Facturas', 'Ocio', 'Viajes', 'Mascotas', 'Otros'];

export function ExpenseDialog({ open, onOpenChange, form, setForm, onSave, saving }: ExpenseDialogProps) {

    const handleSubmit = () => {
        if (!form.title || !form.amount || !form.category) {
            toast.warning('Rellena los campos obligatorios');
            return;
        }
        onSave();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <PiggyBank className="w-5 h-5 text-green-500" />
                        {form.id ? 'Editar Gasto' : 'Nuevo Gasto'}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="title">Concepto</Label>
                        <Input
                            id="title"
                            placeholder="Ej. Compra Mercadona"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="amount">Importe (€)</Label>
                            <div className="relative">
                                <Euro className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="amount"
                                    type="number"
                                    className="pl-9"
                                    placeholder="0.00"
                                    value={form.amount || ''}
                                    onChange={(e) => setForm({ ...form, amount: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="date">Fecha</Label>
                            <Input
                                id="date"
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label>¿Quién pagó?</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant={form.paid_by === 'Mi' ? 'default' : 'outline'}
                                className={form.paid_by === 'Mi' ? 'bg-green-800 hover:bg-green-900' : ''}
                                onClick={() => setForm({ ...form, paid_by: 'Mi' })}
                            >
                                Yo pagué
                            </Button>
                            <Button
                                type="button"
                                variant={form.paid_by === 'Partner' ? 'default' : 'outline'}
                                className={form.paid_by === 'Partner' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                                onClick={() => setForm({ ...form, paid_by: 'Partner' })}
                            >
                                Pagó Pareja/Otro
                            </Button>
                        </div>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="category">Categoría</Label>
                        <Select
                            value={form.category}
                            onValueChange={(val) => setForm({ ...form, category: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona..." />
                            </SelectTrigger>
                            <SelectContent>
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={saving} className="bg-green-800 hover:bg-green-900">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Guardar Gasto
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

