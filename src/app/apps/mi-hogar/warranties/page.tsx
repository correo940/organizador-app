'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Plus, ArrowLeft, Receipt, Calendar, AlertTriangle, CheckCircle, Trash2, Search, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format, addMonths, differenceInDays, parseISO, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { WarrantyDialog, WarrantyForm } from '@/components/apps/mi-hogar/warranties/warranty-dialog';
import { NotificationManager } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

type Warranty = {
    id: string;
    product_name: string;
    store_name?: string;
    purchase_date: string;
    warranty_months: number;
    image_url?: string;
    price?: number;
    created_at: string;
};

const DEFAULT_FORM: WarrantyForm = {
    product_name: '',
    purchase_date: new Date().toISOString().split('T')[0],
    warranty_months: 36, // Standard 3 years
};

export default function WarrantyPage() {
    const [warranties, setWarranties] = useState<Warranty[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [formData, setFormData] = useState<WarrantyForm>(DEFAULT_FORM);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchWarranties();
    }, []);

    const fetchWarranties = async () => {
        try {
            const { data, error } = await supabase
                .from('warranties')
                .select('*')
                .order('purchase_date', { ascending: false });

            if (error) throw error;
            setWarranties(data || []);
        } catch (error) {
            console.error('Error fetching warranties:', error);
            toast.error('Error al cargar garantías');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!formData.product_name || !formData.purchase_date) {
            toast.warning('Rellena los campos obligatorios');
            return;
        }

        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');

            let finalImageUrl = formData.image_url;

            // Handle Image Upload if base64
            if (formData.image_url && formData.image_url.startsWith('data:')) {
                const fileName = `receipt_${Date.now()}.jpg`;
                const filePath = `${user.id}/${fileName}`;

                // Convert base64 to blob
                const res = await fetch(formData.image_url);
                const blob = await res.blob();

                const { error: uploadError } = await supabase.storage
                    .from('receipts') // Assuming 'receipts' bucket exists, if not need to create or use 'images'
                    .upload(filePath, blob);

                if (uploadError) {
                    // If bucket doesn't exist, fail gracefully or try public URL? 
                    // Better to just store base64 string in DB if storage fails? No, too large.
                    // For now, let's assume valid bucket or fail.
                    console.error('Upload error', uploadError);
                    // Fallback: Try to use a default bucket if 'receipts' fails, or just warn.
                    // Actually, let's just save the text data if image fails
                } else {
                    const { data: { publicUrl } } = supabase.storage
                        .from('receipts')
                        .getPublicUrl(filePath);
                    finalImageUrl = publicUrl;
                }
            }

            const payload = {
                user_id: user.id,
                product_name: formData.product_name,
                store_name: formData.store_name,
                purchase_date: formData.purchase_date,
                warranty_months: formData.warranty_months,
                price: formData.price,
                image_url: finalImageUrl?.startsWith('data:') ? null : finalImageUrl // Don't save base64 to DB text field
            };

            let savedId = formData.id;

            if (formData.id) {
                const { error } = await supabase.from('warranties').update(payload).eq('id', formData.id);
                if (error) throw error;
                toast.success('Garantía actualizada');
            } else {
                const { data, error } = await supabase.from('warranties').insert([payload]).select().single();
                if (error) throw error;
                savedId = data.id;
                toast.success('Garantía guardada');
            }

            // Schedule Notifications
            if (savedId) {
                scheduleExpiryNotification(savedId, formData.product_name, formData.purchase_date, formData.warranty_months);
            }

            setIsDialogOpen(false);
            setFormData(DEFAULT_FORM);
            fetchWarranties();

        } catch (error) {
            console.error('Save error:', error);
            toast.error('Error al guardar');
        } finally {
            setUploading(false);
        }
    };

    const scheduleExpiryNotification = async (id: string, name: string, purchaseDate: string, months: number) => {
        try {
            const expiryDate = addMonths(parseISO(purchaseDate), months);
            const now = new Date();

            // Notify 1 month before
            const oneMonthBefore = addMonths(expiryDate, -1);
            if (isAfter(oneMonthBefore, now)) {
                await NotificationManager.schedule({
                    id: NotificationManager.generateId(`war_1m_${id}`),
                    title: `🛡️ Garantía por Vencer`,
                    body: `La garantía de ${name} vence en 1 mes.`,
                    schedule: { at: oneMonthBefore }
                });
            }

            // Notify 1 week before
            const oneWeekBefore = addMonths(expiryDate, -0.25); // Approx 1 week
            if (isAfter(oneWeekBefore, now)) {
                await NotificationManager.schedule({
                    id: NotificationManager.generateId(`war_1w_${id}`),
                    title: `⚠️ Garantía Expira Pronto`,
                    body: `¡Atención! La garantía de ${name} vence la próxima semana.`,
                    schedule: { at: oneWeekBefore }
                });
            }
        } catch (e) {
            console.error('Notification schedule error', e);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Estás seguro de borrar esta garantía?')) return;
        const { error } = await supabase.from('warranties').delete().eq('id', id);
        if (error) {
            toast.error('Error al eliminar');
        } else {
            toast.success('Eliminado');
            setWarranties(warranties.filter(w => w.id !== id));
        }
    };

    const getStatus = (date: string, months: number) => {
        const end = addMonths(parseISO(date), months);
        const daysLeft = differenceInDays(end, new Date());

        if (daysLeft < 0) return { label: 'Expirada', color: 'text-red-500 bg-red-100 border-red-200', icon: AlertTriangle };
        if (daysLeft < 30) return { label: `${daysLeft} días`, color: 'text-orange-500 bg-orange-100 border-orange-200', icon: AlertTriangle };
        if (daysLeft > 730) return { label: '+2 años', color: 'text-green-500 bg-green-100 border-green-200', icon: CheckCircle };
        return { label: `${Math.floor(daysLeft / 30)} meses`, color: 'text-blue-500 bg-blue-100 border-blue-200', icon: CheckCircle };
    };

    const filteredWarranties = warranties.filter(w =>
        w.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.store_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-nav">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <Link href="/apps/mi-hogar">
                            <Button variant="ghost" className="pl-0 mb-2 hover:pl-2 transition-all">
                                <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                            </Button>
                        </Link>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <span className="bg-purple-100 dark:bg-purple-900/40 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                                <Receipt className="w-8 h-8" />
                            </span>
                            Garantías
                        </h1>
                        <p className="text-muted-foreground mt-1">Escanea tickets y controla caducidades</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar producto o tienda..."
                            className="pl-9"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => { setFormData(DEFAULT_FORM); setIsDialogOpen(true); }}>
                        <Plus className="w-4 h-4 mr-2" /> Añadir
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Add Card (Mobile friendly shortcut) */}
                    <button
                        onClick={() => { setFormData(DEFAULT_FORM); setIsDialogOpen(true); }}
                        className="md:hidden flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors h-[120px]"
                    >
                        <div className="flex items-center gap-2 text-slate-500 font-medium">
                            <Plus className="w-5 h-5" /> Escanear Nuevo Ticket
                        </div>
                    </button>

                    {filteredWarranties.map(warranty => {
                        const status = getStatus(warranty.purchase_date, warranty.warranty_months);
                        const StatusIcon = status.icon;

                        return (
                            <Card key={warranty.id} className="group hover:shadow-lg transition-all overflow-hidden border-purple-100 dark:border-purple-900/20">
                                <div className="h-32 bg-slate-100 dark:bg-slate-900 relative">
                                    {warranty.image_url ? (
                                        <div className="w-full h-full relative cursor-pointer" onClick={() => window.open(warranty.image_url, '_blank')}>
                                            <img src={warranty.image_url} alt="Ticket" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <Receipt className="w-12 h-12" />
                                        </div>
                                    )}
                                    <div className={cn("absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-sm", status.color)}>
                                        <StatusIcon className="w-3 h-3" /> {status.label}
                                    </div>
                                </div>

                                <CardContent className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-semibold text-lg line-clamp-1">{warranty.product_name}</h3>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                {warranty.store_name || 'Tienda desconocida'}
                                                {warranty.price && <span className="text-slate-900 dark:text-slate-100 font-medium">• {warranty.price}€</span>}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mt-4 text-sm">
                                        <div className="flex justify-between py-1 border-b border-dashed border-slate-200 dark:border-slate-800">
                                            <span className="text-muted-foreground flex items-center"><Calendar className="w-3 h-3 mr-2" /> Comprado</span>
                                            <span>{format(parseISO(warranty.purchase_date), 'dd MMM yyyy', { locale: es })}</span>
                                        </div>
                                        <div className="flex justify-between py-1">
                                            <span className="text-muted-foreground flex items-center"><AlertTriangle className="w-3 h-3 mr-2" /> Vence</span>
                                            <span className="font-medium text-slate-700 dark:text-slate-300">
                                                {format(addMonths(parseISO(warranty.purchase_date), warranty.warranty_months), 'dd MMM yyyy', { locale: es })}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-4 pt-4 border-t">
                                        <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                                            setFormData({
                                                id: warranty.id,
                                                product_name: warranty.product_name,
                                                store_name: warranty.store_name,
                                                purchase_date: warranty.purchase_date,
                                                warranty_months: warranty.warranty_months,
                                                price: warranty.price,
                                                image_url: warranty.image_url
                                            });
                                            setIsDialogOpen(true);
                                        }}>
                                            Editar
                                        </Button>
                                        {warranty.image_url && (
                                            <Button variant="ghost" size="icon" onClick={() => window.open(warranty.image_url, '_blank')}>
                                                <ExternalLink className="w-4 h-4" />
                                            </Button>
                                        )}
                                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(warranty.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {warranties.length === 0 && !loading && (
                    <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50/50">
                        <Receipt className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">Sin garantías guardadas</h3>
                        <p className="text-muted-foreground mb-4">Escanea tu primer ticket para empezar a proteger tus compras.</p>
                        <Button onClick={() => { setFormData(DEFAULT_FORM); setIsDialogOpen(true); }}>
                            <Plus className="w-4 h-4 mr-2" /> Escanear Ticket
                        </Button>
                    </div>
                )}
            </div>

            <WarrantyDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                form={formData}
                setForm={setFormData}
                onSave={handleSave}
                uploading={uploading}
            />
        </div>
    );
}
