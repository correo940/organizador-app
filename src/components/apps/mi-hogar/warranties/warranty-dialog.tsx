'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { extractReceiptData } from '@/lib/ai-service';
import { Loader2, Camera as CameraIcon, Save, Sparkles, Image as ImageIcon, ChevronDown } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format, addMonths } from 'date-fns';

export type WarrantyForm = {
    id?: string;
    product_name: string;
    store_name?: string;
    purchase_date: string;
    warranty_months: number;
    price?: number;
    image_url?: string;
};

interface WarrantyDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    form: WarrantyForm;
    setForm: (form: WarrantyForm) => void;
    onSave: () => void;
    uploading?: boolean;
}

export function WarrantyDialog({ open, onOpenChange, form, setForm, onSave, uploading }: WarrantyDialogProps) {
    const [analyzing, setAnalyzing] = useState(false);

    const takePhoto = async (source: CameraSource) => {
        try {
            const image = await Camera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: source,
            });

            if (image.base64String) {
                // 1. Set image for preview (basic) - efficiently we would upload to storage first or keep base64 
                // For now, let's keep base64 in form for preview, but parent needs to handle upload logic or we do it here?
                // Parent handling upload is better for separation. We just pass the base64 string "temporarily" in image_url or a separate field?
                // Let's assume parent handles 'image_file' or we pass base64 to parent via a callback. 
                // BUT current form structure suggests image_url is a string (url). 
                // Let's add a temporary field for the file/base64 to the form or just update the form with a data URI.
                const dataUrl = `data:image/jpeg;base64,${image.base64String}`;
                setForm({ ...form, image_url: dataUrl });

                // 2. Analyze with IA
                setAnalyzing(true);
                toast.info('La IA está leyendo el ticket... 🤖');

                const data = await extractReceiptData(dataUrl);

                if (data) {
                    toast.success('¡Datos extraídos!');
                    setForm({
                        ...form,
                        image_url: dataUrl, // Keep the image
                        product_name: data.product_name || form.product_name,
                        store_name: data.store_name || form.store_name,
                        purchase_date: data.purchase_date || form.purchase_date,
                        price: data.price ? parseFloat(data.price) : form.price
                    });
                } else {
                    toast.warning('No se pudo leer el ticket automáticamente');
                }
            }
        } catch (error) {
            console.error('Camera/IA Error:', error);
            // Ignore user cancellation errors
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] flex flex-col p-0 gap-0 sm:rounded-lg overflow-hidden">
                <DialogHeader className="p-6 pb-2 bg-slate-50 dark:bg-slate-900 border-b">
                    <DialogTitle>{form.id ? 'Editar Garantía' : 'Nueva Garantía'}</DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Image Preview / Camera Button */}
                    <div className="flex flex-col items-center justify-center space-y-4">
                        {form.image_url ? (
                            <div className="relative w-full h-48 bg-slate-100 rounded-lg overflow-hidden border">
                                <img src={form.image_url} alt="Ticket" className="w-full h-full object-contain" />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="absolute bottom-2 right-2 shadow-lg"
                                        >
                                            <CameraIcon className="w-4 h-4 mr-2" /> Retomar
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => takePhoto(CameraSource.Camera)}>
                                            <CameraIcon className="w-4 h-4 mr-2" /> Hacer Foto
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => takePhoto(CameraSource.Photos)}>
                                            <ImageIcon className="w-4 h-4 mr-2" /> Galería
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        ) : (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="w-full h-32 border-dashed border-2 flex flex-col gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 group"
                                    >
                                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:scale-110 transition-transform">
                                            <CameraIcon className="w-8 h-8 text-indigo-500" />
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="font-medium text-lg">Escanear Ticket</span>
                                            <span className="text-xs text-muted-foreground">Toca para elegir cámara o galería</span>
                                        </div>
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-56">
                                    <DropdownMenuItem onClick={() => takePhoto(CameraSource.Camera)} className="cursor-pointer">
                                        <CameraIcon className="w-4 h-4 mr-2" /> Usar Cámara
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => takePhoto(CameraSource.Photos)} className="cursor-pointer">
                                        <ImageIcon className="w-4 h-4 mr-2" /> Subir desde Galería
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}

                        {analyzing && (
                            <div className="flex items-center gap-2 text-indigo-600 animate-pulse font-medium text-sm">
                                <Sparkles className="w-4 h-4" /> Analizando con IA...
                            </div>
                        )}
                    </div>

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 gap-4">
                            <div className="space-y-2">
                                <Label>Producto</Label>
                                <Input
                                    placeholder="Ej. Lavadora Samsung"
                                    value={form.product_name}
                                    onChange={e => setForm({ ...form, product_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tienda</Label>
                                <Input
                                    placeholder="Ej. Amazon"
                                    value={form.store_name || ''}
                                    onChange={e => setForm({ ...form, store_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Precio (€)</Label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={form.price || ''}
                                    onChange={e => setForm({ ...form, price: parseFloat(e.target.value) })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Fecha Compra</Label>
                                <Input
                                    type="date"
                                    value={form.purchase_date}
                                    onChange={e => setForm({ ...form, purchase_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Garantía (Meses)</Label>
                                <Input
                                    type="number"
                                    value={form.warranty_months}
                                    onChange={e => setForm({ ...form, warranty_months: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>

                        {form.purchase_date && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                                <span className="font-medium">Vence el:</span>
                                <span>
                                    {format(addMonths(new Date(form.purchase_date), form.warranty_months || 36), 'dd MMM yyyy')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-slate-50 dark:bg-slate-900">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={analyzing || uploading}>
                        Cancelar
                    </Button>
                    <Button onClick={onSave} disabled={analyzing || uploading || !form.product_name}>
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        {uploading ? 'Guardando...' : 'Guardar Garantía'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
