'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Barcode, Mic, Loader2, CheckCircle, AlertCircle, Save, Edit3, ShoppingCart, Zap } from 'lucide-react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { SpeechRecognition } from '@capgo/capacitor-speech-recognition';
import { Camera as CapCamera } from '@capacitor/camera';
import { CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { getApiUrl } from '@/lib/api-utils';

interface SmartScannerProps {
    onClose: () => void;
    onProductAdded: (product: { name: string; barcode?: string }) => void;
}

// Local barcode cache key
const BARCODE_CACHE_KEY = 'quioba_barcode_cache';

// Helper functions for local cache
const getBarcodeCache = (): Record<string, string> => {
    try {
        const cache = localStorage.getItem(BARCODE_CACHE_KEY);
        return cache ? JSON.parse(cache) : {};
    } catch {
        return {};
    }
};

const saveBarcodeToCache = (barcode: string, productName: string) => {
    try {
        const cache = getBarcodeCache();
        cache[barcode] = productName;
        localStorage.setItem(BARCODE_CACHE_KEY, JSON.stringify(cache));
        console.log('💾 Saved to local cache:', barcode, '->', productName);
    } catch (e) {
        console.error('Error saving to cache:', e);
    }
};

const getFromCache = (barcode: string): string | null => {
    const cache = getBarcodeCache();
    return cache[barcode] || null;
};

export default function SmartScanner({ onClose, onProductAdded }: SmartScannerProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isListening, setIsListening] = useState(false);

    // Continuous scanning mode
    const [scanCount, setScanCount] = useState(0);
    const [lastScanned, setLastScanned] = useState<string | null>(null);
    const [continuousMode, setContinuousMode] = useState(false);

    // Manual entry state
    const [showManualEntry, setShowManualEntry] = useState(false);
    const [manualProductName, setManualProductName] = useState('');
    const [pendingBarcode, setPendingBarcode] = useState<string | null>(null);

    // Helper to handle success - in continuous mode, immediately scan next
    const handleSuccess = (productName: string, barcode?: string, startNextScan = false) => {
        setLastScanned(productName);
        setScanCount(prev => prev + 1);
        onProductAdded({ name: productName, barcode });

        // In continuous mode, start next scan after a short delay
        if (startNextScan && continuousMode) {
            setTimeout(() => {
                setLastScanned(null);
                handleBarcodeScan();
            }, 800);
        }
    };

    // Save manual entry
    const handleManualSave = () => {
        if (manualProductName.trim() && pendingBarcode) {
            saveBarcodeToCache(pendingBarcode, manualProductName.trim());
            handleSuccess(manualProductName.trim(), pendingBarcode, continuousMode);
            setShowManualEntry(false);
            setManualProductName('');
            setPendingBarcode(null);
        }
    };

    // Barcode Scanning with continuous mode support
    const handleBarcodeScan = async () => {
        try {
            setLoading(true);
            setError(null);
            setShowManualEntry(false);
            setLastScanned(null);

            const { camera } = await BarcodeScanner.requestPermissions();
            if (camera !== 'granted') {
                setError('Permiso de cámara denegado');
                setLoading(false);
                return;
            }

            document.querySelector('body')?.classList.add('barcode-scanner-active');

            // Scan with custom options - remove Google branding, custom colors
            const result = await BarcodeScanner.scan({
                formats: [],  // All formats
            });

            document.querySelector('body')?.classList.remove('barcode-scanner-active');

            if (result.barcodes && result.barcodes.length > 0) {
                const barcode = result.barcodes[0]?.rawValue;
                if (!barcode) {
                    setError('No se pudo leer el código escaneado');
                    return;
                }
                console.log('🔍 Scanned Barcode:', barcode);

                // 1. First check local cache
                const cachedName = getFromCache(barcode);
                if (cachedName) {
                    console.log('✅ Found in local cache:', cachedName);
                    handleSuccess(cachedName, barcode, true);
                    setLoading(false);
                    return;
                }

                // 2. Try Open Food Facts
                try {
                    const headers = {
                        'User-Agent': 'QuiovaApp/1.0 (Android; +https://quioba.com)',
                        'Accept': 'application/json'
                    };

                    let response = await fetch(`https://es.openfoodfacts.org/api/v0/product/${barcode}.json`, { headers });

                    if (!response.ok) {
                        response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`, { headers });
                    }

                    const data = await response.json();

                    if (data.status === 1 && data.product) {
                        const productName =
                            data.product.product_name_es ||
                            data.product.product_name ||
                            data.product.generic_name_es ||
                            data.product.generic_name ||
                            data.product.brands ||
                            'Producto detectado';

                        saveBarcodeToCache(barcode, productName);
                        handleSuccess(productName, barcode, true);
                    } else {
                        // Product not found - show manual entry
                        setPendingBarcode(barcode);
                        setShowManualEntry(true);
                    }
                } catch (apiError: any) {
                    console.error('❌ API Error:', apiError);
                    setPendingBarcode(barcode);
                    setShowManualEntry(true);
                }
            }
        } catch (err: any) {
            console.error('Barcode scan error:', err);
            if (!err.message?.includes('cancelled')) {
                setError(err.message || 'Error al escanear código');
            }
        } finally {
            setLoading(false);
            document.querySelector('body')?.classList.remove('barcode-scanner-active');
        }
    };

    // Start continuous mode
    const startContinuousMode = () => {
        setContinuousMode(true);
        setScanCount(0);
        handleBarcodeScan();
    };

    // Photo Recognition
    const handlePhotoCapture = async () => {
        try {
            setLoading(true);
            setError(null);
            setShowManualEntry(false);

            const image = await CapCamera.getPhoto({
                quality: 90,
                allowEditing: false,
                resultType: CameraResultType.Base64,
                source: CameraSource.Camera
            });

            if (image.base64String) {
                const apiUrl = getApiUrl('api/mi-hogar/identify-product');

                const resizeImage = async (base64Str: string): Promise<string> => {
                    return new Promise((resolve) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const MAX_SIZE = 800;
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
                            resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]);
                        };
                        img.src = `data:image/jpeg;base64,${base64Str}`;
                    });
                };

                const resizedBase64 = await resizeImage(image.base64String);

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64Image: resizedBase64 })
                });

                const data = await response.json();

                if (data.productName) {
                    handleSuccess(data.productName, undefined, false);
                    setLastScanned(data.productName);
                } else {
                    setError(`No se identificó: ${data.error || 'Intenta de nuevo'}`);
                }
            }
        } catch (err: any) {
            if (!err.message?.includes('cancelled')) {
                setError(`Error foto: ${err.message}`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Voice Input
    const handleVoiceInput = async () => {
        try {
            setError(null);
            setShowManualEntry(false);

            const { speechRecognition } = await SpeechRecognition.requestPermissions();
            if (speechRecognition !== 'granted') {
                setError('Permiso de micrófono denegado');
                return;
            }

            const { available } = await SpeechRecognition.available();
            if (!available) {
                setError('Voz no disponible');
                return;
            }

            setIsListening(true);

            const result = await SpeechRecognition.start({
                language: 'es-ES',
                maxResults: 1,
                popup: false,
                partialResults: false
            });

            if (result?.matches?.length) {
                handleSuccess(result.matches[0], undefined, false);
                setLastScanned(result.matches[0]);
            } else {
                setError('No te entendí');
            }
            setIsListening(false);

        } catch (err: any) {
            setError('Error voz');
            setIsListening(false);
        }
    };

    const stopListening = async () => {
        try {
            await SpeechRecognition.stop();
            setIsListening(false);
        } catch (err) { }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4"
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden"
                    style={{ backgroundColor: '#F8FAFC' }}
                >
                    {/* Header */}
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-slate-900">Añadir Productos</h2>
                            {scanCount > 0 && (
                                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                    <ShoppingCart className="w-4 h-4" /> {scanCount}
                                </span>
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
                            <X className="w-6 h-6 text-slate-600" />
                        </button>
                    </div>

                    {/* Last scanned feedback */}
                    {lastScanned && (
                        <motion.div
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2"
                        >
                            <CheckCircle className="w-5 h-5 text-green-800" />
                            <span className="text-green-800 font-medium truncate">{lastScanned}</span>
                        </motion.div>
                    )}

                    {/* Manual Entry Form */}
                    {showManualEntry && pendingBarcode && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Edit3 className="w-4 h-4 text-amber-600" />
                                <p className="text-amber-800 font-medium text-sm">Producto no encontrado</p>
                            </div>
                            <p className="text-xs text-amber-600 mb-2 font-mono">{pendingBarcode}</p>
                            <input
                                type="text"
                                value={manualProductName}
                                onChange={(e) => setManualProductName(e.target.value)}
                                placeholder="Nombre del producto..."
                                className="w-full p-2 border border-amber-300 rounded-lg mb-2 text-sm"
                                autoFocus
                                onKeyDown={(e) => e.key === 'Enter' && handleManualSave()}
                            />
                            <button
                                onClick={handleManualSave}
                                disabled={!manualProductName.trim()}
                                className="w-full bg-amber-500 text-white p-2 rounded-lg flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
                            >
                                <Save className="w-4 h-4" /> Guardar
                            </button>
                        </motion.div>
                    )}

                    {/* Error Message */}
                    {error && !showManualEntry && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2"
                        >
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <span className="text-red-700 text-sm">{error}</span>
                        </motion.div>
                    )}

                    {/* Options */}
                    <div className="space-y-3">
                        {/* Turbo Scan Button - Primary action */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={startContinuousMode}
                            disabled={loading || isListening}
                            className="w-full bg-gradient-to-r from-green-700 to-green-800 hover:from-green-800 hover:to-green-900 text-white p-4 rounded-2xl flex items-center justify-center gap-3 font-bold transition-all shadow-lg shadow-green-800/30 disabled:opacity-50"
                        >
                            <Zap className="w-6 h-6" />
                            Escaneo Rápido
                        </motion.button>

                        {/* Single Scan */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => { setContinuousMode(false); handleBarcodeScan(); }}
                            disabled={loading || isListening}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 p-3 rounded-xl flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-50"
                        >
                            <Barcode className="w-5 h-5" />
                            Escaneo Único
                        </motion.button>

                        <div className="flex gap-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handlePhotoCapture}
                                disabled={loading || isListening}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-3 rounded-xl flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
                            >
                                <Camera className="w-5 h-5" />
                                Foto
                            </motion.button>

                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={isListening ? stopListening : handleVoiceInput}
                                disabled={loading}
                                className={`flex-1 p-3 rounded-xl flex items-center justify-center gap-2 font-semibold disabled:opacity-50 ${isListening ? 'bg-red-500 text-white' : 'bg-purple-500 text-white'
                                    }`}
                            >
                                {isListening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                                {isListening ? '...' : 'Voz'}
                            </motion.button>
                        </div>
                    </div>

                    {/* Loading Overlay */}
                    {loading && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center z-10 rounded-3xl">
                            <Loader2 className="w-10 h-10 text-green-800 animate-spin mb-2" />
                            <p className="font-medium text-slate-600">Escaneando...</p>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
