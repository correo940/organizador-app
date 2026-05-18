'use client';

import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface QrCodeDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    manualTitle: string;
    manualId: string;
}

export function QrCodeDialog({ open, onOpenChange, manualTitle, manualId }: QrCodeDialogProps) {
    const qrValue = `${window.location.origin}/apps/mi-hogar/manuals?id=${manualId}`;

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=600,height=600');
        if (printWindow) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>QR - ${manualTitle}</title>
                        <style>
                            body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; }
                            h1 { margin-bottom: 10px; font-size: 24px; }
                            p { color: #666; margin-bottom: 30px; }
                            .qr { border: 4px solid #000; padding: 20px; border-radius: 20px; }
                        </style>
                    </head>
                    <body>
                        <h1>${manualTitle}</h1>
                        <p>Escanea para ver manual y mantenimiento</p>
                        <div class="qr">${document.getElementById('qr-code-svg')?.outerHTML}</div>
                        <p style="margin-top: 40px; font-size: 12px;">© Quioba App</p>
                        <script>
                            window.onload = () => { window.print(); window.close(); }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    const handleDownload = () => {
        const svg = document.getElementById('qr-code-svg');
        if (svg) {
            const svgData = new XMLSerializer().serializeToString(svg);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx?.drawImage(img, 0, 0);
                const pngFile = canvas.toDataURL('image/png');
                const downloadLink = document.createElement('a');
                downloadLink.download = `qr-${manualTitle}.png`;
                downloadLink.href = pngFile;
                downloadLink.click();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
            toast.success('Código QR descargado');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Código QR de Mantenimiento</DialogTitle>
                    <DialogDescription>
                        Imprime este código y pégalo en tu {manualTitle} para acceder rápidamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center justify-center p-6 bg-white rounded-xl border-2 border-dashed border-slate-200 my-4">
                    <div className="p-4 bg-white rounded-xl shadow-sm border border-slate-100">
                        <QRCodeSVG
                            id="qr-code-svg"
                            value={qrValue}
                            size={200}
                            level="H"
                            includeMargin={true}
                        />
                    </div>
                </div>

                <DialogFooter className="flex gap-2 sm:justify-center">
                    <Button variant="outline" onClick={handlePrint} className="gap-2">
                        <Printer className="h-4 w-4" />
                        Imprimir
                    </Button>
                    <Button onClick={handleDownload} className="gap-2">
                        <Download className="h-4 w-4" />
                        Descargar PNG
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
