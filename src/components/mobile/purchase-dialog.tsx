'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingCart, Check, Loader2, Sparkles } from 'lucide-react';
import { MarketplaceApp } from '@/types/marketplace';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

interface PurchaseDialogProps {
    app: MarketplaceApp | null;
    open: boolean;
    onClose: () => void;
    onPurchaseComplete: () => void;
}

export default function PurchaseDialog({ app, open, onClose, onPurchaseComplete }: PurchaseDialogProps) {
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    if (!open || !app) return null;

    const handlePurchase = async () => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) throw new Error('No user session');

            // Mock payment processing delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Calculate expiration (1 year from now)
            const expiresAt = new Date();
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);

            // Record subscription in DB
            const { error } = await supabase.from('user_app_purchases').insert({
                user_id: session.user.id,
                app_id: app.id,
                amount_paid: app.price,
                expires_at: expiresAt.toISOString(),
                status: 'active'
            });

            if (error) throw error;

            setSuccess(true);
            setTimeout(() => {
                onPurchaseComplete();
                onClose();
                setSuccess(false); // Reset for next time
            }, 2000);

        } catch (error) {
            console.error('Purchase failed:', error);
            alert('Error al procesar la compra. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="fixed inset-4 m-auto w-[calc(100%-2rem)] max-w-[380px] h-fit max-h-[85vh] bg-white dark:bg-slate-900 rounded-[24px] shadow-2xl z-[70] overflow-hidden border border-white/20 flex flex-col"
                    >
                        {/* Header - compact */}
                        <div className="h-28 sm:h-32 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center relative shrink-0">
                            <button
                                onClick={onClose}
                                className="absolute top-3 right-3 p-1.5 bg-black/20 hover:bg-black/40 rounded-full text-white transition-colors backdrop-blur-md"
                            >
                                <X size={18} />
                            </button>

                            <div className="bg-white/25 backdrop-blur-md p-4 rounded-[18px] shadow-lg border border-white/30">
                                <ShoppingCart className="w-9 h-9 text-white" />
                            </div>

                            <div className="absolute top-8 left-8 w-2 h-2 bg-white/40 rounded-full blur-[1px]" />
                            <div className="absolute bottom-6 right-10 w-2.5 h-2.5 bg-white/30 rounded-full blur-[2px]" />
                        </div>

                        {/* Content */}
                        <div className="p-5 flex flex-col gap-4 overflow-y-auto">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{app.name}</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-1">
                                    {app.description || 'Desbloquea esta aplicación para acceder a todas sus funcionalidades premium.'}
                                </p>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950/20 rounded-xl border border-green-100 dark:border-green-950/40">
                                <div>
                                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Suscripción anual</span>
                                    <p className="text-[10px] text-slate-400">Se renueva cada 12 meses</p>
                                </div>
                                <span className="text-xl font-extrabold text-green-800 dark:text-green-400">
                                    {app.price === 0 ? 'GRATIS' : `${app.price}€/año`}
                                </span>
                            </div>

                            {success ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-2 text-green-800"
                                >
                                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mb-2">
                                        <Check className="w-5 h-5" />
                                    </div>
                                    <p className="font-bold">¡Suscripción activada!</p>
                                    <p className="text-xs text-slate-500">Disfruta durante 12 meses</p>
                                </motion.div>
                            ) : (
                                <Button
                                    onClick={handlePurchase}
                                    disabled={loading}
                                    className="w-full h-12 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-800 hover:to-green-700 text-white rounded-2xl font-bold text-base shadow-lg shadow-green-500/30 transition-all active:scale-95 disabled:opacity-70 disabled:active:scale-100"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" />
                                            <span>Suscribirse ahora</span>
                                        </div>
                                    )}
                                </Button>
                            )}

                            <p className="text-center text-[10px] text-slate-400">
                                Pago seguro procesado por Quioba Pay
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}


