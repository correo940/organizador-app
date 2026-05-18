'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Home, Camera, Search, Loader2, Calendar, Clock, MapPin, Users, AlertCircle, CheckCircle, Upload } from 'lucide-react';
import Link from 'next/link';
import { Camera as CapCamera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { getApiUrl } from '@/lib/api-utils';

type ShiftInfo = {
    name: string;
    date: string;
    shift: string;
    location: string;
    coworkers: string[];
};

export default function CuadrantePage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [scheduleData, setScheduleData] = useState<any>(null);
    const [searchName, setSearchName] = useState('');
    const [myShifts, setMyShifts] = useState<ShiftInfo[] | null>(null);
    const [step, setStep] = useState<'capture' | 'search' | 'results'>('capture');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handle Android hardware back button
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        let mounted = true;
        const handler = App.addListener('backButton', () => {
            if (mounted) {
                // If we are deep in steps, go back one step instead of exiting
                if (step === 'results') {
                    setStep('search');
                } else if (step === 'search') {
                    setStep('capture');
                } else {
                    router.back();
                }
            }
        });

        return () => {
            mounted = false;
            handler.then(h => h.remove());
        };
    }, [router, step]);

    // Resize image before sending
    const resizeImage = async (base64Str: string): Promise<string> => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 1200;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                } else {
                    if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                }

                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
            };
            img.src = `data:image/jpeg;base64,${base64Str}`;
        });
    };

    // Analyze image (shared logic)
    const analyzeImage = async (base64Data: string) => {
        const resizedBase64 = await resizeImage(base64Data);

        const response = await fetch(getApiUrl('api/cuadrante/analyze'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Image: resizedBase64 })
        });

        const data = await response.json();

        if (data.success) {
            setScheduleData(data.schedule);
            setStep('search');
        } else {
            setError(data.error || 'No se pudo analizar el cuadrante');
        }
    };

    // Take photo with CAMERA
    const captureWithCamera = async () => {
        try {
            setLoading(true);
            setError(null);

            const image = await CapCamera.getPhoto({
                quality: 95,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Camera
            });

            if (image.base64String) {
                setCapturedImage(`data:image/jpeg;base64,${image.base64String}`);
                await analyzeImage(image.base64String);
            }
        } catch (err: any) {
            if (!err.message?.includes('cancelled')) {
                setError(`Error: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Upload from GALLERY
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            setError(null);

            // Convert file to base64
            const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            setCapturedImage(base64);

            // Extract base64 data without prefix
            const base64Data = base64.split(',')[1];
            await analyzeImage(base64Data);
        } catch (err: any) {
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Search for person in schedule
    const searchPerson = async () => {
        if (!searchName.trim() || !scheduleData) return;

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(getApiUrl('api/cuadrante/search'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: searchName.trim(),
                    scheduleData
                })
            });

            const data = await response.json();

            if (data.success && data.shifts) {
                setMyShifts(data.shifts);
                setStep('results');
            } else {
                setError(data.error || `No se encontró a "${searchName}" en el cuadrante`);
            }
        } catch (err: any) {
            setError(`Error: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Reset to start
    const reset = () => {
        setCapturedImage(null);
        setScheduleData(null);
        setSearchName('');
        setMyShifts(null);
        setError(null);
        setStep('capture');
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4">
            <div className="max-w-2xl mx-auto">
                {/* Navigation */}
                <div className="flex items-center gap-2 mb-6">
                    <Link href="/">
                        <Button variant="outline" size="sm" className="flex items-center gap-2">
                            <Home className="h-4 w-4" />
                        </Button>
                    </Link>
                    <h1 className="text-2xl font-bold text-slate-900">Cuadrante</h1>
                </div>

                {/* Main Content */}
                <Card className="shadow-lg">
                    <CardHeader className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            {step === 'capture' && 'Añadir Cuadrante'}
                            {step === 'search' && 'Buscar tu Horario'}
                            {step === 'results' && 'Tus Turnos'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">

                        {/* Error Message */}
                        {error && (
                            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-600" />
                                <span className="text-red-700">{error}</span>
                            </div>
                        )}

                        {/* Step 1: Select Method */}
                        {step === 'capture' && (
                            <div className="space-y-6">
                                <p className="text-center text-slate-600 mb-4">
                                    ¿Cómo quieres añadir tu cuadrante?
                                </p>

                                <div className="grid grid-cols-2 gap-4">
                                    {/* Option 1: Upload from Gallery */}
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={loading}
                                        className="p-6 bg-slate-50 hover:bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 transition-all flex flex-col items-center gap-3 disabled:opacity-50"
                                    >
                                        <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center">
                                            <Upload className="w-7 h-7 text-indigo-600" />
                                        </div>
                                        <span className="font-semibold text-slate-700">Subir Foto</span>
                                        <span className="text-xs text-slate-500">Desde galería</span>
                                    </button>

                                    {/* Option 2: Take Photo with Camera */}
                                    <button
                                        onClick={captureWithCamera}
                                        disabled={loading}
                                        className="p-6 bg-slate-50 hover:bg-slate-100 rounded-2xl border-2 border-dashed border-slate-200 hover:border-purple-300 transition-all flex flex-col items-center gap-3 disabled:opacity-50"
                                    >
                                        <div className="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center">
                                            <Camera className="w-7 h-7 text-purple-600" />
                                        </div>
                                        <span className="font-semibold text-slate-700">Hacer Foto</span>
                                        <span className="text-xs text-slate-500">Con la cámara</span>
                                    </button>
                                </div>

                                {/* Hidden file input for gallery upload */}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />

                                {/* Loading overlay */}
                                {loading && (
                                    <div className="flex flex-col items-center gap-2 py-4">
                                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                                        <p className="text-slate-600">Analizando cuadrante...</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Search */}
                        {step === 'search' && (
                            <div className="space-y-6">
                                {capturedImage && (
                                    <div className="relative">
                                        <img
                                            src={capturedImage}
                                            alt="Cuadrante capturado"
                                            className="w-full rounded-xl border shadow-sm max-h-48 object-cover"
                                        />
                                        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Analizado
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-4">
                                    <label className="block font-medium text-slate-700">
                                        ¿Cuál es tu nombre en el cuadrante?
                                    </label>
                                    <div className="flex gap-2">
                                        <Input
                                            value={searchName}
                                            onChange={(e) => setSearchName(e.target.value)}
                                            placeholder="Ej: Juan García"
                                            className="flex-1"
                                            onKeyDown={(e) => e.key === 'Enter' && searchPerson()}
                                        />
                                        <Button
                                            onClick={searchPerson}
                                            disabled={loading || !searchName.trim()}
                                            className="bg-indigo-600 hover:bg-indigo-700"
                                        >
                                            {loading ? (
                                                <Loader2 className="w-5 h-5 animate-spin" />
                                            ) : (
                                                <Search className="w-5 h-5" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                <Button variant="outline" onClick={reset} className="w-full">
                                    Subir otra foto
                                </Button>
                            </div>
                        )}

                        {/* Step 3: Results */}
                        {step === 'results' && myShifts && (
                            <div className="space-y-4">
                                <div className="bg-green-50 p-4 rounded-xl border border-green-200 mb-4">
                                    <p className="text-green-800 font-medium flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5" />
                                        Horarios encontrados para {searchName}
                                    </p>
                                </div>

                                {myShifts.map((shift, index) => (
                                    <div
                                        key={index}
                                        className="p-4 bg-white rounded-xl border shadow-sm space-y-3"
                                    >
                                        <div className="flex items-center gap-2 text-indigo-600 font-semibold">
                                            <Calendar className="w-4 h-4" />
                                            {shift.date}
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <Clock className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium">{shift.shift}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-700">
                                            <MapPin className="w-4 h-4 text-slate-400" />
                                            {shift.location}
                                        </div>
                                        {shift.coworkers.length > 0 && (
                                            <div className="flex items-start gap-2 text-slate-700">
                                                <Users className="w-4 h-4 text-slate-400 mt-0.5" />
                                                <span className="text-sm">{shift.coworkers.join(', ')}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <div className="flex gap-2 mt-4">
                                    <Button variant="outline" onClick={() => setStep('search')} className="flex-1">
                                        Buscar otro
                                    </Button>
                                    <Button variant="outline" onClick={reset} className="flex-1">
                                        Nueva foto
                                    </Button>
                                </div>
                            </div>
                        )}

                    </CardContent>
                </Card>

                {/* Instructions */}
                <div className="mt-6 text-center text-sm text-slate-500">
                    <p>Soporta cuadrantes de turnos estándar en formato tabla</p>
                </div>
            </div>
        </div>
    );
}
