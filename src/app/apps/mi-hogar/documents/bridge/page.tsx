'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, FileUp, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

function BridgeContent() {
    const searchParams = useSearchParams();
    const sessionCode = searchParams ? searchParams.get('code') : null;
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Verificar si la sesión es válida
    useEffect(() => {
        if (!sessionCode) {
            setError('Código de sesión no encontrado. Por favor, escanea el QR de nuevo.');
        }
    }, [sessionCode]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setError(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !sessionCode) return;

        setIsUploading(true);
        setError(null);

        try {
            // 1. Subir a un bucket temporal o al principal
            const fileExt = file.name.split('.').pop();
            const fileName = `${sessionCode}_${Math.random().toString(36).substring(2)}.${fileExt}`;
            const filePath = `bridge-uploads/${fileName}`;

            const { error: uploadError, data } = await supabase.storage
                .from('secure-docs')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Obtener URL pública
            const { data: { publicUrl } } = supabase.storage
                .from('secure-docs')
                .getPublicUrl(filePath);

            // 3. Notificar a la tabla de bridge (esto activará el Realtime en el PC)
            const { error: bridgeError } = await supabase
                .from('document_ingestion_bridge')
                .update({
                    file_url: publicUrl,
                    file_name: file.name,
                    content_type: file.type,
                    status: 'uploaded'
                })
                .eq('session_code', sessionCode);

            if (bridgeError) throw bridgeError;

            setIsSuccess(true);
            toast.success('Documento enviado con éxito');

        } catch (err: any) {
            console.error('Error in bridge upload:', err);
            setError(err.message || 'Error al subir el archivo');
        } finally {
            setIsUploading(false);
        }
    };

    if (error && !file) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <Card className="w-full max-w-md border-rose-100 shadow-xl">
                    <CardHeader className="text-center">
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                        <CardTitle className="text-rose-600">Ops! Algo ha fallado</CardTitle>
                        <CardDescription>{error}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/20 rotate-12">
                        <Camera className="w-10 h-10 text-white -rotate-12" />
                    </div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">QUIOVA <span className="text-amber-500 underline underline-offset-4 decoration-2">BRIDGE</span></h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Envía documentos a tu ordenador al instante</p>
                </div>

                <Card className="border-none shadow-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-none px-3 py-1 font-bold">SESIÓN: {sessionCode}</Badge>
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-slate-400">Canal Seguro</span>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <AnimatePresence mode="wait">
                            {isSuccess ? (
                                <motion.div
                                    key="success"
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="text-center py-8 space-y-4"
                                >
                                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto">
                                        <CheckCircle2 className="w-10 h-10 text-green-500" />
                                    </div>
                                    <h2 className="text-xl font-bold dark:text-white">¡Enviado con éxito!</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Ya puedes cerrar esta ventana. Tu ordenador está procesando el archivo.</p>
                                    <Button
                                        variant="outline"
                                        onClick={() => { setIsSuccess(false); setFile(null); }}
                                        className="rounded-xl"
                                    >
                                        Subir otro documento
                                    </Button>
                                </motion.div>
                            ) : (
                                <motion.div key="upload" className="space-y-6">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            id="mobile-upload"
                                            className="hidden"
                                            accept="image/*,application/pdf"
                                            onChange={handleFileChange}
                                            disabled={isUploading}
                                        />
                                        <label
                                            htmlFor="mobile-upload"
                                            className={cn(
                                                "flex flex-col items-center justify-center w-full aspect-square rounded-[3rem] border-4 border-dashed cursor-pointer transition-all active:scale-95",
                                                file
                                                    ? "bg-amber-50 border-amber-200 dark:bg-amber-500/5 dark:border-amber-500/20"
                                                    : "bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-800"
                                            )}
                                        >
                                            {file ? (
                                                <div className="text-center px-4">
                                                    <FileUp className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                                                    <p className="text-xs font-black uppercase text-amber-600 truncate max-w-[200px]">{file.name}</p>
                                                    <p className="text-[10px] text-amber-400 mt-1">Pulsa para cambiar</p>
                                                </div>
                                            ) : (
                                                <div className="text-center">
                                                    <div className="w-16 h-16 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
                                                        <Camera className="w-8 h-8 text-slate-400" />
                                                    </div>
                                                    <p className="font-black text-slate-400 dark:text-slate-500 text-xs uppercase tracking-widest">Hacer foto o subir</p>
                                                </div>
                                            )}
                                        </label>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                            {error}
                                        </div>
                                    )}

                                    <Button
                                        className="w-full h-14 rounded-[1.5rem] bg-amber-500 hover:bg-amber-600 shadow-xl shadow-amber-500/20 text-white font-black uppercase tracking-widest text-xs gap-2"
                                        disabled={!file || isUploading}
                                        onClick={handleUpload}
                                    >
                                        {isUploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" /> ENVIANDO...
                                            </>
                                        ) : (
                                            <>
                                                <FileUp className="w-4 h-4" /> ENVIAR A QUIOVA
                                            </>
                                        )}
                                    </Button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </CardContent>
                </Card>

                <p className="text-center text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mt-8 flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> Encriptación de Extremo a Extremo
                </p>
            </motion.div>
        </div>
    );
}

export default function MobileBridgePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            </div>
        }>
            <BridgeContent />
        </Suspense>
    );
}

