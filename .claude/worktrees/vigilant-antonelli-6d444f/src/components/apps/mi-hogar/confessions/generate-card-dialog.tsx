'use client';

import { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download, Printer, Copy, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    thought: {
        share_token: string;
        creator_name: string | null;
        is_anonymous: boolean;
    };
};

export function GenerateCardDialog({ isOpen, onClose, thought }: Props) {
    const [recipientName, setRecipientName] = useState('');
    const cardRef = useRef<HTMLDivElement>(null);
    const shareUrl = `${window.location.origin}/thought/${thought.share_token}`;

    const handleDownload = async () => {
        if (!cardRef.current) return;

        try {
            // Need to wait for fonts to load for better result
            await document.fonts.ready;

            // Import html2canvas dynamically to avoid SSR issues
            const html2canvas = (await import('html2canvas')).default;

            const scale = 2; // Higher resolution
            const canvas = await html2canvas(cardRef.current, {
                scale: scale,
                backgroundColor: null,
                logging: false,
                useCORS: true
            });

            const link = document.createElement('a');
            link.download = `tarjeta-pensamiento-${thought.share_token}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();

            toast.success('Tarjeta descargada');
        } catch (error) {
            console.error('Error downloading card:', error);
            // Fallback for SVG if html2canvas fails or is overkill
            downloadSvgAsPng();
        }
    };

    const downloadSvgAsPng = () => {
        // Fallback: Just download the QR
        const svg = document.getElementById('thought-qr');
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
                downloadLink.download = `qr-pensamiento.png`;
                downloadLink.href = pngFile;
                downloadLink.click();
                toast.success('QR descargado (Modo simple)');
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=800,height=600');
        if (printWindow && cardRef.current) {
            printWindow.document.write(`
                <html>
                    <head>
                        <title>Imprimir Tarjeta</title>
                        <style>
                            body { 
                                font-family: system-ui, -apple-system, sans-serif; 
                                display: flex; 
                                justify-content: center; 
                                align-items: center; 
                                height: 100vh;
                                margin: 0;
                            }
                            .card-container {
                                transform: scale(0.8);
                            }
                        </style>
                    </head>
                    <body>
                        <div class="card-container">
                            ${cardRef.current.outerHTML}
                        </div>
                        <script>
                            window.onload = () => { window.print(); window.close(); }
                        </script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Generar Tarjeta Física</DialogTitle>
                    <DialogDescription>
                        Crea una tarjeta personalizada para imprimir o enviar digitalmente.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label>Destinatario (Opcional)</Label>
                        <Input
                            placeholder="Ej: Para Mamá, Para mi mejor amigo..."
                            value={recipientName}
                            onChange={(e) => setRecipientName(e.target.value)}
                        />
                    </div>

                    {/* Card Preview */}
                    <div className="flex justify-center bg-muted/30 p-8 rounded-xl overflow-hidden">
                        <div
                            ref={cardRef}
                            className="relative w-[350px] aspect-[3/4] bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-xl shadow-2xl p-6 text-white flex flex-col items-center justify-between"
                            style={{
                                boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)'
                            }}
                        >
                            {/* Decorative elements */}
                            <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />

                            {/* Valid HTML2Canvas gradient fallback */}
                            <div className="relative z-10 w-full text-center space-y-2 mt-4">
                                <span className="text-4xl filter drop-shadow-md">✨</span>
                                <h3 className="text-xs uppercase tracking-[0.2em] font-medium opacity-80">
                                    Un pensamiento para ti
                                </h3>
                            </div>

                            <div className="relative z-10 flex flex-col items-center gap-4 my-auto">
                                <div className="bg-white/10 backdrop-blur-sm p-4 rounded-2xl border border-white/20 shadow-inner">
                                    <div className="bg-white p-3 rounded-xl">
                                        <QRCodeSVG
                                            id="thought-qr"
                                            value={shareUrl}
                                            size={160}
                                            level="H"
                                            includeMargin={false}
                                        />
                                    </div>
                                </div>

                                {recipientName && (
                                    <div className="text-center">
                                        <p className="text-sm opacity-70">Para:</p>
                                        <p className="font-serif text-2xl font-bold tracking-wide text-white drop-shadow-sm">
                                            {recipientName}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="relative z-10 w-full text-center border-t border-white/20 pt-4 pb-2">
                                <p className="text-sm font-medium opacity-90">
                                    De: {thought.is_anonymous ? 'Anónimo 🤫' : (thought.creator_name || 'Alguien especial')}
                                </p>
                                <p className="text-[10px] mt-1 opacity-60 font-mono tracking-wider">
                                    Escanea para leer
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" />
                            Imprimir
                        </Button>
                        <Button onClick={handleDownload}>
                            <Download className="w-4 h-4 mr-2" />
                            Descargar Imagen
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
