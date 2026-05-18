import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { UploadCloud, Wand2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface AssetAnalysisData {
    title: string;
    category: string;
    price: number | null;
    date: string | null;
    store: string | null;
    warranty_years: number;
    summary: string;
}

interface MagicAssetScannerProps {
    onScanComplete: (data: AssetAnalysisData, file: File) => void;
}

export function MagicAssetScanner({ onScanComplete }: MagicAssetScannerProps) {
    const [isScanning, setIsScanning] = useState(false);
    const [progressStep, setProgressStep] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        await processFile(file);

        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const processFile = async (file: File) => {
        try {
            setIsScanning(true);
            setProgressStep('Extrayendo texto del documento...');

            const formData = new FormData();
            formData.append('file', file);

            const res = await fetch('/api/mi-hogar/parse-asset', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Error HTTP ${res.status}`);
            }

            setProgressStep('Analizando modelo y garantías con Llama-3.3...');
            const result = await res.json();

            toast.success('¡Activo detectado mágicamente!');
            onScanComplete(result.analysis as AssetAnalysisData, file);

        } catch (error: any) {
            console.error('Scan error:', error);
            toast.error(error.message || 'Error al escanear el ticket/pegatina');
        } finally {
            setIsScanning(false);
            setProgressStep('');
        }
    };

    return (
        <div className="w-full">
            <Card
                className={`relative overflow-hidden border-2 border-dashed transition-all duration-300 ${isScanning
                        ? 'border-green-500 bg-green-50/50 dark:bg-green-800-950/20'
                        : 'border-slate-300 hover:border-green-400 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer'
                    }`}
                onClick={() => !isScanning && fileInputRef.current?.click()}
            >
                <div className="p-10 flex flex-col items-center justify-center text-center space-y-4">
                    {isScanning ? (
                        <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                            <div className="relative">
                                <ScanSpinner />
                            </div>
                            <h3 className="mt-6 text-lg font-bold text-green-800">Escáner IA Trabajando</h3>
                            <p className="text-sm text-green-800/80 mt-1 font-medium animate-pulse">{progressStep}</p>
                        </div>
                    ) : (
                        <>
                            <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-950/50 flex items-center justify-center mb-2 shadow-inner">
                                <Wand2 className="w-8 h-8 text-green-800 drop-shadow-sm" />
                            </div>
                            <div>
                                <h3 className="text-xl font-extrabold text-slate-800 dark:text-slate-100">Bóveda Mágica</h3>
                                <p className="text-sm text-slate-500 max-w-sm mt-2">
                                    Sube un <strong className="text-green-800">ticket de compra</strong>, foto de caja o <strong className="text-green-800">pegatina de características</strong>. La IA extraerá la marca, modelo y calculará las garantías.
                                </p>
                            </div>
                            <Button className="mt-4 bg-slate-900 text-white hover:bg-green-800 shadow-md">
                                <UploadCloud className="mr-2 h-4 w-4" /> Seleccionar Archivo
                            </Button>
                        </>
                    )}
                </div>

                {/* Visual Scanner Line Effect */}
                {isScanning && (
                    <div className="absolute top-0 left-0 w-full h-1 bg-green-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-scanner-beam" />
                )}
            </Card>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                disabled={isScanning}
            />

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes scan-beam {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scanner-beam {
                    animation: scan-beam 2s infinite ease-in-out;
                }
            `}} />
        </div>
    );
}

function ScanSpinner() {
    return (
        <div className="relative flex items-center justify-center w-24 h-24">
            <div className="absolute inset-0 rounded-full border-t-4 border-green-500 animate-spin opacity-80" />
            <div className="absolute inset-2 rounded-full border-r-4 border-green-400 animate-spin opacity-60" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
            <Wand2 className="w-8 h-8 text-green-800 animate-pulse" />
        </div>
    );
}

