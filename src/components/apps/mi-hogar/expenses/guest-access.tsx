import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert, Key, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function GuestExpensesAccess({ onSuccess }: { onSuccess: () => void }) {
    const [code, setCode] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [registerEmail, setRegisterEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) setUserEmail(data.user.email);
        });
    }, []);

    const handleJoin = async () => {
        if (code.length < 6) return toast.error('El código debe tener 6 dígitos');
        setLoading(true);

        try {
            // If NOT logged in, Register first
            if (!userEmail) {
                if (!registerEmail || !password) return toast.error('Rellena todos los campos');

                // 1. Try Sign Up
                let { data: authData, error: authError } = await supabase.auth.signUp({
                    email: registerEmail,
                    password: password
                });

                // If SignUp didn't give a session (maybe user exists?), try Sign In
                if (!authError && !authData.session) {
                    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
                        email: registerEmail,
                        password: password
                    });
                    if (!signInError && signInData.session) {
                        authData = signInData; // Use the sign-in session
                    }
                }

                if (authError) throw authError;

                if (authData.session) {
                    // Session established. Wait a moment for client to update.
                    await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                    throw new Error('No se pudo iniciar sesión automática. ¿El usuario ya existe o requiere confirmar email?');
                }
            }

            // Check session before RPC
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) throw new Error('No hay sesión activa.');

            // Redeem Code
            const { error: rpcError } = await supabase.rpc('redeem_connection_code', { p_code: code });
            if (rpcError) throw rpcError;

            toast.success('¡Bienvenido a Gastos Compartidos!');
            toast.info('Configurando tu entorno...');

            // Wait for propagation
            await new Promise(resolve => setTimeout(resolve, 2000));

            onSuccess();
            window.location.reload();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || 'Error al conectar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                        <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <CardTitle className="text-xl">Acceso Restringido</CardTitle>
                    <CardDescription>
                        Esta sección es exclusiva para usuarios Premium o invitados con código.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {userEmail ? (
                        <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md text-sm text-center mb-4">
                            <p className="text-muted-foreground text-xs">Conectado como:</p>
                            <p className="font-medium">{userEmail}</p>
                        </div>
                    ) : (
                        <div className="space-y-3 mb-4 p-3 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                            <p className="text-sm font-semibold text-center mb-2">Registro de Nuevo Miembro</p>
                            <div>
                                <label className="text-xs font-medium">Email</label>
                                <Input
                                    type="email"
                                    placeholder="tu@email.com"
                                    value={registerEmail}
                                    onChange={(e) => setRegisterEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium">Contraseña</label>
                                <Input
                                    type="password"
                                    placeholder="******"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Introduce tu código de invitado:</label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="123456"
                                className="text-center font-mono text-lg tracking-widest uppercase"
                                maxLength={6}
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                            />
                            <Button onClick={handleJoin} disabled={loading || code.length < 6}>
                                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Entrar
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground text-center pt-2">
                            Pide el código al administrador de Gastos.
                        </p>
                    </div>

                    <div className="text-center">
                        <Button variant="link" className="text-red-500 text-xs" onClick={() => supabase.auth.signOut()}>
                            No soy yo (Cerrar Sesión)
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
