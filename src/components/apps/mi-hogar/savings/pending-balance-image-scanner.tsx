import React, { useState, useRef } from 'react';
import { Camera, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getApiUrl } from '@/lib/api-utils';

interface PendingBalanceImageScannerProps {
    onScanSuccess: (data: { amount: string, concept: string, date: string, merchant: string }) => void;
}

export function PendingBalanceImageScanner({ onScanSuccess }: PendingBalanceImageScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (!file.type.startsWith('image/')) {
            toast.error('Por favor, selecciona una imagen');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('La imagen es demasiado grande (máx 5MB)');
            return;
        }

        setIsScanning(true);
        const toastId = toast.loading('Analizando recibo con IA...', { duration: Infinity });

        try {
            // Convert to base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const apiUrl = getApiUrl('api/scan-receipt');
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: base64 })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Error al analizar el recibo');
            }

            const data = await response.json();
            
            toast.success('¡Recibo analizado con éxito!', { id: toastId });
            
            // Format data
            onScanSuccess({
                amount: data.amount ? String(data.amount) : '',
                concept: (data.merchant ? `Compra en ${data.merchant}` : 'Suministros varios'),
                date: data.date ? data.date : new Date().toISOString().split('T')[0],
                merchant: data.merchant || ''
            });

        } catch (error: any) {
            console.error('Scan error:', error);
            toast.error(error.message || 'Error al procesar la imagen', { id: toastId });
        } finally {
            setIsScanning(false);
        }
    };

    return (
        <div>
            <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileSelect}
            />
            
            <Button 
                variant="outline" 
                type="button" 
                className="w-full border-orange-200 dark:border-orange-800/50 hover:bg-orange-50 dark:hover:bg-orange-950/20 text-orange-600 dark:text-orange-400 gap-2 h-12"
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
            >
                {isScanning ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                    <Camera className="w-5 h-5" />
                )}
                {isScanning ? 'Analizando...' : 'Escanear Ticket con IA'}
            </Button>
            <p className="text-[10px] text-center text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                <ImageIcon className="w-3 h-3" /> Auto-rellena importe y comercio
            </p>
        </div>
    );
}
