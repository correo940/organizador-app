'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Loader2, Mail, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function LoginSection() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setIsLoggedIn(!!session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setIsLoggedIn(!!session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
            toast.success('¡Bienvenido de nuevo!');
        } catch (error: any) {
            toast.error(error.message || 'Error al iniciar sesión');
        } finally {
            setLoading(false);
        }
    };

    if (isLoggedIn) return null;

    return (
        <section className="container mx-auto px-4 py-12">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
            >
                <Card className="max-w-md mx-auto overflow-hidden border-primary/20 shadow-lg">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 pointer-events-none" />
                    <CardHeader className="text-center relative">
                        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
                            <LogIn className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Acceso Mi Hogar</CardTitle>
                        <CardDescription>
                            Inicia sesión para ver tu resumen personal
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="relative">
                        <form onSubmit={handleLogin} className="space-y-4">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="email"
                                        placeholder="Email"
                                        className="pl-9"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="relative">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        type="password"
                                        placeholder="Contraseña"
                                        className="pl-9"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <Button
                                type="submit"
                                className="w-full"
                                size="lg"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                Iniciar Sesión
                            </Button>
                        </form>
                        <div className="mt-4 text-center">
                            <p className="text-sm text-muted-foreground">
                                ¿No tienes cuenta?{' '}
                                <a href="/apps/mi-hogar/login" className="text-primary hover:underline font-medium">
                                    Regístrate aquí
                                </a>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </section>
    );
}
