'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Car, Bike, Plus, Calendar, AlertTriangle, Droplets, Wrench, ArrowLeft, Trash2, Fuel, Gauge, CheckCircle, Settings } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format, differenceInDays, parseISO, addYears, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { VehicleDialog } from '@/components/apps/mi-hogar/garage/vehicle-dialog';

export type Vehicle = {
    id: string;
    name: string; // Used as display name or nickname
    brand?: string;
    model?: string;
    year?: number;
    type: 'car' | 'moto';
    license_plate: string;
    next_itv_date?: string;
    insurance_expiry_date?: string;
    oil_type?: string;
    tire_pressure?: string;
    image_url?: string;
    current_kilometers?: number;
    last_oil_change_km?: number;
    last_tire_change_km?: number;
    oil_change_interval_km?: number;
    tire_change_interval_km?: number;
    notify_km_before?: number; // Configurable threshold for mileage alerts
    notify_days_before?: number; // Configurable threshold for date alerts
    last_oil_change_date?: string;
    last_tire_change_date?: string;
    oil_change_interval_months?: number;
    tire_change_interval_months?: number;
};

type VehicleEvent = {
    id: string;
    vehicle_id: string;
    type: 'repair' | 'maintenance' | 'oil_change' | 'other';
    date: string;
    cost: number;
    description: string;
    kilometers?: number;
    maintenance_items?: string[];
};

const MAINTENANCE_ITEMS = [
    { id: 'oil_filter', label: 'Filtro de Aceite' },
    { id: 'air_filter', label: 'Filtro de Aire' },
    { id: 'cabin_filter', label: 'Filtro de Habitáculo' },
    { id: 'fuel_filter', label: 'Filtro de Combustible' },
    { id: 'spark_plugs', label: 'Bujías' },
    { id: 'brake_fluid', label: 'Líquido de Frenos' },
    { id: 'coolant', label: 'Refrigerante' },
    { id: 'tires', label: 'Neumáticos' },
    { id: 'brake_pads', label: 'Pastillas de Freno' },
];

export default function GaragePage() {
    const { user, loading: authLoading } = useAuth();
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
    const [events, setEvents] = useState<VehicleEvent[]>([]);
    const [loading, setLoading] = useState(true);

    // Dialogs
    const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
    const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

    // Forms
    const [vehicleForm, setVehicleForm] = useState<Partial<Vehicle>>({ type: 'car' });
    const [eventForm, setEventForm] = useState<Partial<VehicleEvent>>({ type: 'maintenance', date: new Date().toISOString().split('T')[0], maintenance_items: [] });

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setVehicles([]);
            setSelectedVehicle(null);
            setEvents([]);
            setLoading(false);
            return;
        }

        fetchVehicles();
    }, [user, authLoading]);

    useEffect(() => {
        if (selectedVehicle) fetchEvents(selectedVehicle.id);
    }, [selectedVehicle]);

    const fetchVehicles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            setVehicles(data || []);
        } catch (e) {
            toast.error('Error al cargar vehículos');
        } finally {
            setLoading(false);
        }
    };

    const fetchEvents = async (vehicleId: string) => {
        const { data, error } = await supabase
            .from('vehicle_events')
            .select('*')
            .eq('vehicle_id', vehicleId)
            .order('date', { ascending: false });

        if (error) toast.error('Error al cargar historial');
        else setEvents(data || []);
    };

    const saveVehicle = async () => {
        toast.info('DEBUG: Iniciando proceso de guardado...'); // Debug feedback
        console.log('DEBUG: Button clicked, form:', vehicleForm);

        if (!user || !vehicleForm.license_plate) {
            toast.warning('La matrícula es obligatoria');
            return;
        }

        // Auto-generate name if not provided
        const displayName = vehicleForm.name || `${vehicleForm.brand || ''} ${vehicleForm.model || ''}`.trim() || 'Mi Vehículo';

        try {
            if (vehicleForm.id) {
                // Update - Sanitize payload
                const { id, user_id, created_at, ...updates } = vehicleForm as any;

                console.log('UPDATING VEHICLE:', vehicleForm.id);

                const { error } = await supabase
                    .from('vehicles')
                    .update({ ...updates, name: displayName })
                    .eq('id', vehicleForm.id);

                if (error) {
                    console.error('SUPABASE ERROR:', error);
                    throw error;
                }
                toast.success('Vehículo actualizado');

                // If we are editing the currently selected vehicle, update it in view
                if (selectedVehicle && selectedVehicle.id === vehicleForm.id) {
                    setSelectedVehicle({ ...selectedVehicle, ...vehicleForm, name: displayName } as Vehicle);
                }
            } else {
                // Insert
                const { error } = await supabase.from('vehicles').insert([{ ...vehicleForm, name: displayName, user_id: user.id }]);
                if (error) {
                    console.error('INSERT ERROR:', error);
                    throw error;
                }
                toast.success('Vehículo añadido');
            }

            setIsVehicleDialogOpen(false);
            setVehicleForm({ type: 'car' });
            fetchVehicles();
        } catch (e: any) {
            console.error('FINAL ERROR:', e);
            toast.error(`Error: ${e.message || e.error_description || 'No se pudo guardar'}`);
        }
    };

    const saveEvent = async () => {
        if (!user || !selectedVehicle || !eventForm.description) {
            toast.warning('Añade una descripción');
            return;
        }

        try {
            // 1. Insert Event
            const { error: eventError } = await supabase.from('vehicle_events').insert([{
                ...eventForm,
                user_id: user.id,
                vehicle_id: selectedVehicle.id
            }]);
            if (eventError) throw eventError;

            // 2. Update Vehicle Stats based on Event
            const updates: any = {};
            if (eventForm.kilometers && eventForm.kilometers > (selectedVehicle.current_kilometers || 0)) {
                updates.current_kilometers = eventForm.kilometers;
            }

            if (eventForm.type === 'oil_change' && eventForm.kilometers) {
                updates.last_oil_change_km = eventForm.kilometers;
            }

            // Check maintenance items for tires
            if (eventForm.maintenance_items?.includes('tires') && eventForm.kilometers) {
                updates.last_tire_change_km = eventForm.kilometers;
            }

            if (Object.keys(updates).length > 0) {
                const { error: vehicleError } = await supabase
                    .from('vehicles')
                    .update(updates)
                    .eq('id', selectedVehicle.id);

                if (vehicleError) throw vehicleError;

                // Update local state immediately
                setSelectedVehicle({ ...selectedVehicle, ...updates });
            }

            toast.success('Evento registrado y vehículo actualizado');
            setIsEventDialogOpen(false);
            setEventForm({ type: 'maintenance', date: new Date().toISOString().split('T')[0], maintenance_items: [] });
            fetchEvents(selectedVehicle.id);
            fetchVehicles(); // Refresh main list too
        } catch (e) {
            console.error(e);
            toast.error('Error al guardar evento');
        }
    };

    const deleteVehicle = async (id: string) => {
        if (!confirm('¿Borrar vehículo y su historial?')) return;
        try {
            await supabase.from('vehicles').delete().eq('id', id);
            setVehicles(vehicles.filter(v => v.id !== id));
            setSelectedVehicle(null);
            toast.success('Vehículo eliminado');
        } catch (e) {
            toast.error('Error al eliminar');
        }
    };

    const toggleMaintenanceItem = (item: string) => {
        const currentItems = eventForm.maintenance_items || [];
        if (currentItems.includes(item)) {
            setEventForm({ ...eventForm, maintenance_items: currentItems.filter(i => i !== item) });
        } else {
            setEventForm({ ...eventForm, maintenance_items: [...currentItems, item] });
        }
    };

    // Status Helpers
    const getStatusColor = (dateStr?: string) => {
        if (!dateStr) return 'text-gray-500 bg-gray-100';
        const days = differenceInDays(parseISO(dateStr), new Date());
        if (days < 0) return 'text-red-600 bg-red-100 border-red-200';
        if (days < 30) return 'text-orange-600 bg-orange-100 border-orange-200';
        return 'text-green-600 bg-green-100 border-green-200';
    };

    const getStatusText = (dateStr?: string) => {
        if (!dateStr) return 'Sin fecha';
        const days = differenceInDays(parseISO(dateStr), new Date());
        if (days < 0) return 'CADUCADO';
        if (days < 30) return `Caduca en ${days} días`;
        return format(parseISO(dateStr), 'dd MMM yyyy', { locale: es });
    };

    if (selectedVehicle) {
        // DETAIL VIEW
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-nav">
                <div className="max-w-5xl mx-auto space-y-6">
                    <Button variant="ghost" onClick={() => setSelectedVehicle(null)} className="pl-0 gap-2">
                        <ArrowLeft className="w-4 h-4" /> Volver al Garaje
                    </Button>

                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-xl shadow-sm border">
                                {selectedVehicle.type === 'moto' ? <Bike className="w-10 h-10 text-indigo-500" /> : <Car className="w-10 h-10 text-indigo-500" />}
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold">{selectedVehicle.brand} {selectedVehicle.model}</h1>
                                <div className="flex gap-2 items-center text-muted-foreground mt-1">
                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-sm border">{selectedVehicle.license_plate}</span>
                                    {selectedVehicle.year && <span>• {selectedVehicle.year}</span>}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => {
                                console.log('DEBUG: Edit button clicked');
                                toast.info('Abriendo editor...');
                                setVehicleForm(selectedVehicle);
                                setIsVehicleDialogOpen(true);
                            }}>
                                <Settings className="w-4 h-4 mr-2" /> Editar
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => deleteVehicle(selectedVehicle.id)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar Vehículo
                            </Button>
                        </div>
                    </div>

                    {/* Tech Specs Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Próxima ITV</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className={`inline-flex items-center text-sm font-medium ${getStatusColor(selectedVehicle.next_itv_date).split(' ')[0]}`}>
                                    <AlertTriangle className="w-4 h-4 mr-2" />
                                    {selectedVehicle.next_itv_date ? format(parseISO(selectedVehicle.next_itv_date), 'dd/MM/yy') : '-'}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Seguro</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className={`inline-flex items-center text-sm font-medium ${getStatusColor(selectedVehicle.insurance_expiry_date).split(' ')[0]}`}>
                                    <Calendar className="w-4 h-4 mr-2" />
                                    {selectedVehicle.insurance_expiry_date ? format(parseISO(selectedVehicle.insurance_expiry_date), 'dd/MM/yy') : '-'}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Aceite Motor</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className="inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <Droplets className="w-4 h-4 mr-2 text-amber-500" />
                                    {selectedVehicle.oil_type || 'No especificado'}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="p-4 pb-2"><CardTitle className="text-xs font-medium text-muted-foreground uppercase">Presión Ruedas</CardTitle></CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className="inline-flex items-center text-sm font-medium text-slate-700 dark:text-slate-300">
                                    <Gauge className="w-4 h-4 mr-2 text-blue-500" />
                                    {selectedVehicle.tire_pressure || '-'}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Maintenance Status Grid */}
                    <h2 className="text-lg font-semibold mt-6 mb-2">Mantenimiento</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Oil Status */}
                        {/* Oil Status */}
                        <Card className={cn(
                            "border-l-4",
                            (() => {
                                const kmDue = (selectedVehicle.current_kilometers || 0) - (selectedVehicle.last_oil_change_km || 0) >= (selectedVehicle.oil_change_interval_km || 15000);
                                const dateDue = selectedVehicle.last_oil_change_date ?
                                    differenceInDays(new Date(), addMonths(parseISO(selectedVehicle.last_oil_change_date), selectedVehicle.oil_change_interval_months || 12)) >= 0
                                    : false;
                                return (kmDue || dateDue) ? "border-l-red-500" : "border-l-green-500";
                            })()
                        )}>
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Aceite Motor</CardTitle>
                                <Droplets className={cn("w-4 h-4",
                                    (() => {
                                        const kmDue = (selectedVehicle.current_kilometers || 0) - (selectedVehicle.last_oil_change_km || 0) >= (selectedVehicle.oil_change_interval_km || 15000);
                                        const dateDue = selectedVehicle.last_oil_change_date ?
                                            differenceInDays(new Date(), addMonths(parseISO(selectedVehicle.last_oil_change_date), selectedVehicle.oil_change_interval_months || 12)) >= 0
                                            : false;
                                        return (kmDue || dateDue) ? "text-red-500" : "text-green-500";
                                    })()
                                )} />
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className="text-2xl font-bold">
                                    {Math.max(0, (selectedVehicle.oil_change_interval_km || 15000) - ((selectedVehicle.current_kilometers || 0) - (selectedVehicle.last_oil_change_km || 0))).toLocaleString()} km
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    restantes (o fecha: {selectedVehicle.last_oil_change_date ? format(addMonths(parseISO(selectedVehicle.last_oil_change_date), selectedVehicle.oil_change_interval_months || 12), 'dd/MM/yy') : '-'})
                                </p>
                            </CardContent>
                        </Card>

                        {/* Tires Status */}
                        {/* Tires Status */}
                        <Card className={cn(
                            "border-l-4",
                            (() => {
                                const kmDue = (selectedVehicle.current_kilometers || 0) - (selectedVehicle.last_tire_change_km || 0) >= (selectedVehicle.tire_change_interval_km || 40000);
                                const dateDue = selectedVehicle.last_tire_change_date ?
                                    differenceInDays(new Date(), addMonths(parseISO(selectedVehicle.last_tire_change_date), selectedVehicle.tire_change_interval_months || 48)) >= 0
                                    : false;
                                return (kmDue || dateDue) ? "border-l-red-500" : "border-l-green-500";
                            })()
                        )}>
                            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-sm font-medium uppercase text-muted-foreground">Neumáticos</CardTitle>
                                <Gauge className={cn("w-4 h-4",
                                    (() => {
                                        const kmDue = (selectedVehicle.current_kilometers || 0) - (selectedVehicle.last_tire_change_km || 0) >= (selectedVehicle.tire_change_interval_km || 40000);
                                        const dateDue = selectedVehicle.last_tire_change_date ?
                                            differenceInDays(new Date(), addMonths(parseISO(selectedVehicle.last_tire_change_date), selectedVehicle.tire_change_interval_months || 48)) >= 0
                                            : false;
                                        return (kmDue || dateDue) ? "text-red-500" : "text-green-500";
                                    })()
                                )} />
                            </CardHeader>
                            <CardContent className="p-4 pt-1">
                                <div className="text-2xl font-bold">
                                    {Math.max(0, (selectedVehicle.tire_change_interval_km || 40000) - ((selectedVehicle.current_kilometers || 0) - (selectedVehicle.last_tire_change_km || 0))).toLocaleString()} km
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    restantes (o fecha: {selectedVehicle.last_tire_change_date ? format(addMonths(parseISO(selectedVehicle.last_tire_change_date), selectedVehicle.tire_change_interval_months || 48), 'dd/MM/yy') : '-'})
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <h2 className="text-xl font-semibold">Historial de Mantenimiento</h2>
                            <Button onClick={() => setIsEventDialogOpen(true)}>
                                <Plus className="w-4 h-4 mr-2" /> Añadir Registro
                            </Button>
                        </div>

                        <div className="space-y-4">
                            {events.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg bg-white/50">
                                    No hay registros. Añade la última revisión o reparación.
                                </div>
                            ) : (
                                events.map(event => (
                                    <div key={event.id} className="bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-start">
                                        <div className="flex gap-4 w-full md:w-auto">
                                            <div className={cn("p-2 rounded-full h-fit",
                                                event.type === 'repair' ? "bg-red-100 text-red-600" :
                                                    event.type === 'oil_change' ? "bg-amber-100 text-amber-600" :
                                                        "bg-blue-100 text-blue-600"
                                            )}>
                                                {event.type === 'repair' ? <Wrench className="w-5 h-5" /> :
                                                    event.type === 'oil_change' ? <Droplets className="w-5 h-5" /> :
                                                        <Settings className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 md:w-48">
                                                <h3 className="font-medium">{event.description}</h3>
                                                <span className="text-sm text-muted-foreground">{format(parseISO(event.date), 'd MMM yyyy', { locale: es })}</span>
                                            </div>
                                        </div>

                                        <div className="flex-1 w-full border-t md:border-t-0 md:border-l border-slate-100 dark:border-slate-800 pt-2 md:pt-0 md:pl-4">
                                            {event.maintenance_items && event.maintenance_items.length > 0 && (
                                                <div className="flex flex-wrap gap-2 mb-2">
                                                    {event.maintenance_items.map(item => {
                                                        const label = MAINTENANCE_ITEMS.find(i => i.id === item)?.label || item;
                                                        return (
                                                            <span key={item} className="text-xs bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded-full flex items-center">
                                                                <CheckCircle className="w-3 h-3 mr-1" /> {label}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            <div className="flex gap-6 text-sm text-muted-foreground">
                                                {event.cost > 0 && <span className="flex items-center"><span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">{event.cost}€</span></span>}
                                                {event.kilometers && <span className="flex items-center"><Gauge className="w-3 h-3 mr-1" /> {event.kilometers.toLocaleString()} km</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Event Dialog */}
                <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader><DialogTitle>Registrar Mantenimiento</DialogTitle></DialogHeader>
                        <Tabs defaultValue="details" className="w-full">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="details">Detalles</TabsTrigger>
                                <TabsTrigger value="checklist">Checklist</TabsTrigger>
                            </TabsList>
                            <TabsContent value="details" className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Tipo</Label>
                                        <Select
                                            value={eventForm.type}
                                            onValueChange={(val: any) => setEventForm({ ...eventForm, type: val })}
                                        >
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="maintenance">Mantenimiento</SelectItem>
                                                <SelectItem value="repair">Reparación/Avería</SelectItem>
                                                <SelectItem value="oil_change">Cambio de Aceite</SelectItem>
                                                <SelectItem value="other">Otro</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Fecha</Label>
                                        <Input type="date" value={eventForm.date} onChange={e => setEventForm({ ...eventForm, date: e.target.value })} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Descripción</Label>
                                    <Input placeholder="Ej. Revisión anual" value={eventForm.description || ''} onChange={e => setEventForm({ ...eventForm, description: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Coste (€)</Label>
                                        <Input type="number" placeholder="0.00" value={eventForm.cost || ''} onChange={e => setEventForm({ ...eventForm, cost: parseFloat(e.target.value) })} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Kilómetros</Label>
                                        <Input type="number" placeholder="Ej. 120000" value={eventForm.kilometers || ''} onChange={e => setEventForm({ ...eventForm, kilometers: parseInt(e.target.value) })} />
                                    </div>
                                </div>
                            </TabsContent>
                            <TabsContent value="checklist" className="py-4">
                                <div className="grid grid-cols-2 gap-3">
                                    {MAINTENANCE_ITEMS.map(item => (
                                        <div key={item.id} className="flex items-center space-x-2 border p-3 rounded-lg hover:bg-slate-50 cursor-pointer" onClick={() => toggleMaintenanceItem(item.id)}>
                                            <input
                                                type="checkbox"
                                                id={item.id}
                                                checked={(eventForm.maintenance_items || []).includes(item.id)}
                                                onChange={() => toggleMaintenanceItem(item.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <Label htmlFor={item.id} className="cursor-pointer font-normal">{item.label}</Label>
                                        </div>
                                    ))}
                                </div>
                            </TabsContent>
                        </Tabs>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={saveEvent}>Guardar Registro</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Modal Añadir/Editar Vehículo (In Detail View) */}

                <VehicleDialog
                    open={isVehicleDialogOpen}
                    onOpenChange={setIsVehicleDialogOpen}
                    form={vehicleForm as any}
                    setForm={(f) => setVehicleForm(f as any)}
                    onSave={saveVehicle}
                />
            </div>
        );
    }

    // MAIN LIST
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-nav">
            <div className="max-w-5xl mx-auto space-y-6">
                <div>
                    <Link href="/apps/mi-hogar">
                        <Button variant="ghost" className="pl-0 mb-2 hover:pl-2 transition-all">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                        </Button>
                    </Link>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <span className="bg-blue-100 dark:bg-blue-900/40 p-2 rounded-xl text-blue-600 dark:text-blue-400">
                            <Car className="w-8 h-8" />
                        </span>
                        Garaje
                    </h1>
                    <p className="text-muted-foreground mt-1">Gestiona tus vehículos y su mantenimiento</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add Card */}
                    <button
                        onClick={() => setIsVehicleDialogOpen(true)}
                        className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group h-[200px]"
                    >
                        <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4 group-hover:scale-110 transition-transform">
                            <Plus className="w-8 h-8 text-slate-400" />
                        </div>
                        <span className="font-medium text-slate-600 dark:text-slate-400">Añadir Vehículo</span>
                    </button>

                    {vehicles.map(vehicle => (
                        <Card
                            key={vehicle.id}
                            onClick={() => setSelectedVehicle(vehicle)}
                            className="cursor-pointer hover:shadow-lg transition-all group border-blue-100 dark:border-blue-900/20"
                        >
                            <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                            {vehicle.type === 'moto' ? <Bike className="w-6 h-6 text-blue-600" /> : <Car className="w-6 h-6 text-blue-600" />}
                                        </div>
                                        <div>
                                            <CardTitle className="text-lg">{vehicle.brand ? `${vehicle.brand} ${vehicle.model}` : vehicle.name}</CardTitle>
                                            <CardDescription className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded w-fit text-xs mt-1">{vehicle.license_plate}</CardDescription>
                                        </div>
                                    </div>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500">
                                        <Settings className="w-4 h-4" />
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> ITV</span>
                                    <span className={cn("font-medium", getStatusColor(vehicle.next_itv_date).split(' ')[0])}>
                                        {vehicle.next_itv_date ? format(parseISO(vehicle.next_itv_date), 'dd/MM/yy') : '-'}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Seguro</span>
                                    <span className={cn("font-medium", getStatusColor(vehicle.insurance_expiry_date).split(' ')[0])}>
                                        {vehicle.insurance_expiry_date ? format(parseISO(vehicle.insurance_expiry_date), 'dd/MM/yy') : '-'}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>


            {/* Modal Añadir/Editar Vehículo */}
            <VehicleDialog
                open={isVehicleDialogOpen}
                onOpenChange={setIsVehicleDialogOpen}
                form={vehicleForm as any}
                setForm={(f) => setVehicleForm(f as any)}
                onSave={saveVehicle}
            />
        </div>
    );
}


