import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Vehicle } from '@/app/apps/mi-hogar/garage/page'; // We'll need to export this or redefine it
import { Car, Bike, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

// Redefining here to avoid circular dependencies if not exported properly yet, 
// strictly speaking we should move types to a shared file, but for now:
type VehicleForm = {
    id?: string;
    type: 'car' | 'moto';
    brand?: string;
    model?: string;
    year?: number;
    license_plate?: string;
    oil_type?: string;
    tire_pressure?: string;
    next_itv_date?: string;
    insurance_expiry_date?: string;
    current_kilometers?: number;
    oil_change_interval_km?: number;
    tire_change_interval_km?: number;
    notify_km_before?: number;
    notify_days_before?: number;
    last_oil_change_date?: string;
    last_tire_change_date?: string;
    oil_change_interval_months?: number;
    tire_change_interval_months?: number;
};

interface VehicleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: VehicleForm;
    setForm: (form: VehicleForm) => void;
    onSave: () => void;
}

export function VehicleDialog({ open, onOpenChange, form, setForm, onSave }: VehicleDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>{form.id ? 'Editar Vehículo' : 'Nuevo Vehículo'}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 py-2">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Tipo</Label>
                            <div className="flex gap-4">
                                <button
                                    className={cn("flex-1 p-4 rounded-lg border-2 flex flex-col items-center gap-2", form.type === 'car' ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-slate-200 dark:border-slate-800")}
                                    onClick={() => setForm({ ...form, type: 'car' })}
                                >
                                    <Car className="w-8 h-8" /> <span>Coche</span>
                                </button>
                                <button
                                    className={cn("flex-1 p-4 rounded-lg border-2 flex flex-col items-center gap-2", form.type === 'moto' ? "border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-slate-200 dark:border-slate-800")}
                                    onClick={() => setForm({ ...form, type: 'moto' })}
                                >
                                    <Bike className="w-8 h-8" /> <span>Moto</span>
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Marca ({form.type === 'moto' ? 'Yamaha...' : 'Ford...'})</Label>
                                <Input placeholder="Marca" value={form.brand || ''} onChange={e => setForm({ ...form, brand: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Modelo</Label>
                                <Input placeholder="Fiesta" value={form.model || ''} onChange={e => setForm({ ...form, model: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Matrícula</Label>
                                <Input placeholder="1234 ABC" value={form.license_plate || ''} onChange={e => setForm({ ...form, license_plate: e.target.value.toUpperCase() })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Año</Label>
                                <Input type="number" placeholder="2020" value={form.year || ''} onChange={e => setForm({ ...form, year: parseInt(e.target.value) })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Aceite Motor</Label>
                                <Input placeholder="5W-30" value={form.oil_type || ''} onChange={e => setForm({ ...form, oil_type: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Presión Ruedas</Label>
                                <Input placeholder="2.5 bar" value={form.tire_pressure || ''} onChange={e => setForm({ ...form, tire_pressure: e.target.value })} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Próxima ITV</Label>
                                <Input type="date" value={form.next_itv_date || ''} onChange={e => setForm({ ...form, next_itv_date: e.target.value })} />
                            </div>
                            <div className="space-y-2">
                                <Label>Vencimiento Seguro</Label>
                                <Input type="date" value={form.insurance_expiry_date || ''} onChange={e => setForm({ ...form, insurance_expiry_date: e.target.value })} />
                            </div>
                        </div>

                        <div className="border-t pt-4 mt-4">
                            <h3 className="font-semibold mb-3 flex items-center gap-2">
                                <Wrench className="w-4 h-4" /> Mantenimiento & Notificaciones
                            </h3>
                            <div className="grid grid-cols-1 gap-4 mb-4">
                                <div className="space-y-2">
                                    <Label>Kilómetros Actuales</Label>
                                    <Input type="number" placeholder="Ej. 125000" value={form.current_kilometers || ''} onChange={e => setForm({ ...form, current_kilometers: parseInt(e.target.value) })} />
                                    <p className="text-xs text-muted-foreground">Actualízalo registrando eventos o editando aquí.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Cambio Aceite (cada km)</Label>
                                    <Input type="number" placeholder="Ej. 15000" value={form.oil_change_interval_km || ''} onChange={e => setForm({ ...form, oil_change_interval_km: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cambio Ruedas (cada km)</Label>
                                    <Input type="number" placeholder="Ej. 40000" value={form.tire_change_interval_km || ''} onChange={e => setForm({ ...form, tire_change_interval_km: parseInt(e.target.value) })} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="space-y-2">
                                    <Label>Cambio Aceite (cada meses)</Label>
                                    <Input type="number" placeholder="Ej. 12" value={form.oil_change_interval_months || ''} onChange={e => setForm({ ...form, oil_change_interval_months: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Cambio Ruedas (cada meses)</Label>
                                    <Input type="number" placeholder="Ej. 48" value={form.tire_change_interval_months || ''} onChange={e => setForm({ ...form, tire_change_interval_months: parseInt(e.target.value) })} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2 border-t border-dashed pt-2">
                                <div className="space-y-2">
                                    <Label>Fecha Último Cambio Aceite</Label>
                                    <Input type="date" value={form.last_oil_change_date || ''} onChange={e => setForm({ ...form, last_oil_change_date: e.target.value })} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Último Cambio Ruedas</Label>
                                    <Input type="date" value={form.last_tire_change_date || ''} onChange={e => setForm({ ...form, last_tire_change_date: e.target.value })} />
                                </div>
                            </div>

                            {/* Nuevos campos de notificación */}
                            <div className="grid grid-cols-2 gap-4 mt-4 bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/20">
                                <div className="space-y-2">
                                    <Label className="text-yellow-700 dark:text-yellow-500">Avisar (km antes)</Label>
                                    <Input className="bg-white dark:bg-black" type="number" placeholder="Ej. 1000" value={form.notify_km_before || ''} onChange={e => setForm({ ...form, notify_km_before: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-yellow-700 dark:text-yellow-500">Avisar (días antes)</Label>
                                    <Input className="bg-white dark:bg-black" type="number" placeholder="Ej. 30" value={form.notify_days_before || ''} onChange={e => setForm({ ...form, notify_days_before: parseInt(e.target.value) })} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={onSave}>{form.id ? 'Guardar Cambios' : 'Crear Vehículo'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
