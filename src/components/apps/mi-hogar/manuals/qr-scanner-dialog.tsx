'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QrCode, Camera, X } from 'lucide-react';
import { toast } from 'sonner';
import { Scanner } from '@yudiel/react-qr-scanner';

interface QRScannerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onScan: (url: string) => void;
}

export function QRScannerDialog({ open, onOpenChange, onScan }: QRScannerDialogProps) {
    const [scanning, setScanning] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const handleScan = (result: any) => {
        if (result) {
            const text = result[0]?.rawValue || result;

            // Check if it's a URL
            if (text && (text.startsWith('http://') || text.startsWith('https://'))) {
                toast.success('QR escaneado correctamente');
                onScan(text);
                onOpenChange(false);
            } else {
                toast.info(`QR detectado: ${text}`);
                // Could still process non-URL QR codes
                onScan(text);
                onOpenChange(false);
            }
        }
    };

    const handleError = (err: any) => {
        console.error('QR Scanner Error:', err);
        setError('Error al acceder a la cámara. Verifica los permisos.');
        toast.error('No se pudo acceder a la cámara');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <QrCode className="h-5 w-5" />
                        Escanear Código QR
                    </DialogTitle>
                    <DialogDescription>
                        Apunta la cámara al código QR del manual o producto
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    {error ? (
                        <div className="text-center py-12 space-y-4">
                            <Camera className="h-16 w-16 mx-auto text-muted-foreground opacity-20" />
                            <p className="text-sm text-destructive">{error}</p>
                            <Button variant="outline" onClick={() => { setError(null); setScanning(true); }}>
                                Reintentar
                            </Button>
                        </div>
                    ) : (
                        <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                            <Scanner
                                onScan={handleScan}
                                onError={handleError}
                                styles={{ container: { width: '100%', height: '100%' }, video: { objectFit: 'cover' } }}
                            />
                            <div className="absolute inset-0 pointer-events-none">
                                {/* Scanning frame overlay */}
                                <div className="absolute inset-0 border-4 border-primary/50 rounded-lg m-12 animate-pulse" />
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
