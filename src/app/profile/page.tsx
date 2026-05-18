'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Capacitor } from '@capacitor/core';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LogOut, Camera, UserPlus, Star, Crown, Shield, Users, Sparkles, Wand2, RefreshCw, Loader2, Check, Package, Clock, ToggleLeft, ToggleRight, Bot, Bell, BellOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LogoLoader from '@/components/ui/logo-loader';
import { ProfileSkeleton } from '@/components/ui/skeleton-loaders';
import { Switch } from '@/components/ui/switch';
import {
    getSecretarySettings, saveSecretarySettings, SECRETARY_AVATARS,
    type SecretarySettings, type SecretaryPersonality, type SecretaryAvatarId
} from '@/lib/secretary-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NotificationManager } from '@/lib/notifications';

interface Subscription {
    id: string;
    app_id: string;
    app_name: string;
    app_icon: string;
    amount_paid: number;
    purchased_at: string;
    expires_at: string;
    auto_renew: boolean;
    status: string;
}

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [contacts, setContacts] = useState<any[]>([]);
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [avatarSeed, setAvatarSeed] = useState('');
    const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState('');
    const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
    const [isPremiumDialogOpen, setIsPremiumDialogOpen] = useState(false);
    const [upgradingPremium, setUpgradingPremium] = useState(false);
    const router = useRouter();

    const isPremium = profile?.subscription_tier === 'premium';

    useEffect(() => {
        // Safety timeout — never stay loading more than 5 seconds
        const safetyTimer = setTimeout(() => {
            setLoading(false);
        }, 5000);

        const getProfile = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();

                // Allow mobile users to view profile (guest mode)
                const isMobile = Capacitor.isNativePlatform();

                if (!session && !isMobile) {
                    router.push('/login');
                    return;
                }
                if (session) {
                    setUser(session.user);

                    // Fetch Profile
                    const { data: profileData, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', session.user.id)
                        .single();

                    if (profileError && profileError.code !== 'PGRST116') {
                        console.error('Error fetching profile:', profileError);
                    }
                    setProfile(profileData || {});

                    // Fetch Contacts
                    const { data: contactsData, error: contactsError } = await supabase
                        .from('contacts')
                        .select('*, contact:profiles!contact_id(*)')
                        .eq('user_id', session.user.id);

                    if (contactsError) {
                        console.error('Error fetching contacts:', contactsError);
                    } else {
                        setContacts(contactsData || []);
                    }

                    // Fetch Subscriptions
                    await fetchSubscriptions(session.user.id);
                }

            } catch (error) {
                console.error(error);
            } finally {
                setLoading(false);
                clearTimeout(safetyTimer);
            }
        };

        getProfile();

        return () => clearTimeout(safetyTimer);
    }, [router]);

    const fetchSubscriptions = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('user_app_purchases')
                .select('id, app_id, amount_paid, purchased_at, expires_at, auto_renew, status, marketplace_apps(name, icon_key)')
                .eq('user_id', userId)
                .eq('status', 'active');

            if (error) {
                console.error('Error fetching subscriptions:', error);
                return;
            }

            const subs: Subscription[] = (data || []).map((s: any) => ({
                id: s.id,
                app_id: s.app_id,
                app_name: s.marketplace_apps?.name || 'App',
                app_icon: s.marketplace_apps?.icon_key || 'Package',
                amount_paid: s.amount_paid,
                purchased_at: s.purchased_at,
                expires_at: s.expires_at,
                auto_renew: s.auto_renew ?? true,
                status: s.status,
            }));

            setSubscriptions(subs);
        } catch (err) {
            console.error('Subscriptions fetch error:', err);
        }
    };

    const toggleAutoRenew = async (subId: string, currentValue: boolean) => {
        const newValue = !currentValue;
        const { error } = await supabase
            .from('user_app_purchases')
            .update({ auto_renew: newValue })
            .eq('id', subId);

        if (error) {
            toast.error('Error al actualizar la renovación');
            return;
        }

        setSubscriptions(prev =>
            prev.map(s => s.id === subId ? { ...s, auto_renew: newValue } : s)
        );

        toast.success(newValue ? 'Renovación automática activada' : 'Renovación automática desactivada');
    };

    const handleUpgradePremium = async () => {
        setUpgradingPremium(true);
        try {
            // Mock payment
            await new Promise(resolve => setTimeout(resolve, 1500));

            const { error } = await supabase
                .from('profiles')
                .update({ subscription_tier: 'premium' })
                .eq('id', user.id);

            if (error) throw error;

            setProfile({ ...profile, subscription_tier: 'premium' });
            toast.success('¡Bienvenido a Premium! Todas las apps desbloqueadas');
            setIsPremiumDialogOpen(false);
        } catch (err) {
            console.error(err);
            toast.error('Error al activar Premium');
        } finally {
            setUpgradingPremium(false);
        }
    };

    const handleCancelPremium = async () => {
        const { error } = await supabase
            .from('profiles')
            .update({ subscription_tier: 'free' })
            .eq('id', user.id);

        if (error) {
            toast.error('Error al cancelar Premium');
            return;
        }

        setProfile({ ...profile, subscription_tier: 'free' });
        toast.success('Plan Premium cancelado');
    };

    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date();
        const expiry = new Date(expiresAt);
        const diffMs = expiry.getTime() - now.getTime();

        if (diffMs <= 0) return { text: 'Caducada', color: 'text-red-500', expired: true };

        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        const months = Math.floor(days / 30);

        if (months > 0) {
            const remainingDays = days % 30;
            return { text: `${months} mes${months > 1 ? 'es' : ''} y ${remainingDays}d`, color: 'text-green-800', expired: false };
        }
        if (days > 7) return { text: `${days} días`, color: 'text-green-800', expired: false };
        if (days > 0) return { text: `${days} día${days > 1 ? 's' : ''}`, color: 'text-amber-500', expired: false };

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        return { text: `${hours}h restantes`, color: 'text-red-500', expired: false };
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/login');
        toast.success('Sesión cerrada correctamente');
    };

    const handleUpdateAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            if (!e.target.files || e.target.files.length === 0) {
                return;
            }

            const file = e.target.files[0];
            const fileExt = file.name.split('.').pop();
            const filePath = `${user.id}/${Math.random()}.${fileExt}`;

            // Upload image
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            await updateUserAvatar(publicUrl);
            toast.success("Foto de perfil actualizada");
        } catch (error) {
            console.error(error);
            toast.error("Error al subir la imagen");
        } finally {
            setUploading(false);
        }
    };

    const generateRandomAvatar = () => {
        const seed = Math.random().toString(36).substring(7);
        setAvatarSeed(seed);
        setGeneratedAvatarUrl(`https://api.dicebear.com/9.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9`);
    };

    const saveGeneratedAvatar = async () => {
        try {
            setUploading(true);
            await updateUserAvatar(generatedAvatarUrl);
            toast.success("Avatar creado y guardado");
            setIsAvatarDialogOpen(false);
        } catch (error) {
            toast.error("Error al guardar avatar");
        } finally {
            setUploading(false);
        }
    };

    const updateUserAvatar = async (url: string) => {
        const { error } = await supabase
            .from('profiles')
            .update({ custom_avatar_url: url })
            .eq('id', user.id);

        if (error) throw error;

        // Update local state
        setProfile({ ...profile, custom_avatar_url: url });

        // Force router refresh to update other components
        router.refresh();
    };

    const getSubscriptionBadge = () => {
        const tier = profile?.subscription_tier || 'free';
        switch (tier) {
            case 'premium':
                return <Badge className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white border-0 gap-1"><Crown className="w-3 h-3" /> Premium</Badge>;
            case 'family':
                return <Badge className="bg-gradient-to-r from-purple-500 to-pink-600 text-white border-0 gap-1"><Users className="w-3 h-3" /> Familiar</Badge>;
            default:
                return <Badge variant="secondary" className="gap-1"><Star className="w-3 h-3" /> Gratuito</Badge>;
        }
    };

    if (loading) {
        return <ProfileSkeleton />;
    }

    return (
        <div className="container max-w-2xl mx-auto py-8 px-4 pb-32">
            <div className="flex flex-col items-center mb-8 gap-4">
                <div className="relative group">
                    <Avatar className="w-32 h-32 border-4 border-white dark:border-black shadow-xl ring-4 ring-primary/10">
                        <AvatarImage src={profile?.custom_avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                        <AvatarFallback className="text-4xl">{profile?.nickname?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>

                    {/* Photo Upload */}
                    <label className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform z-10" title="Subir foto real">
                        {uploading ? <LogoLoader size="sm" className="gap-0" /> : <Camera className="w-5 h-5" />}
                        <input type="file" accept="image/*" className="hidden" onChange={handleUpdateAvatar} disabled={uploading} />
                    </label>

                    {/* Create Avatar */}
                    <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
                        <DialogTrigger asChild>
                            <button
                                className="absolute bottom-0 left-0 p-2 bg-violet-600 text-white rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform z-10"
                                title="Crear Avatar"
                                onClick={() => {
                                    generateRandomAvatar();
                                    setIsAvatarDialogOpen(true);
                                }}
                            >
                                <Wand2 className="w-5 h-5" />
                            </button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Crear tu Avatar</DialogTitle>
                                <DialogDescription>
                                    Genera un avatar único para tu perfil.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center gap-6 py-4">
                                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-violet-100 shadow-inner bg-slate-50">
                                    <img src={generatedAvatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={generateRandomAvatar} disabled={uploading}>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        Aleatorio
                                    </Button>
                                    <Button onClick={saveGeneratedAvatar} disabled={uploading} className="bg-violet-600 hover:bg-violet-700">
                                        <Check className="w-4 h-4 mr-2" />
                                        Guardar Avatar
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                <div className="text-center">
                    <h1 className="text-3xl font-bold">{profile?.nickname || user?.email?.split('@')[0]}</h1>
                    <p className="text-muted-foreground mb-2">{user?.email}</p>
                    {getSubscriptionBadge()}
                </div>
            </div>

            <div className="grid gap-6">
                {/* Account Status Card — se queda fuera de las pestañas */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="w-5 h-5 text-primary" />
                            Estado de la Cuenta
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-xl mb-4">
                            <div>
                                <p className="font-medium">Plan Actual</p>
                                <p className="text-sm text-muted-foreground capitalize">
                                    {isPremium ? 'Premium — 10€/mes' : 'Gratuito'}
                                </p>
                            </div>
                            {isPremium ? (
                                <Button variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50" onClick={handleCancelPremium}>
                                    Cancelar Plan
                                </Button>
                            ) : (
                                <Dialog open={isPremiumDialogOpen} onOpenChange={setIsPremiumDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white gap-1">
                                            <Crown className="w-3.5 h-3.5" />
                                            Mejorar Plan
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle className="flex items-center gap-2 text-xl">
                                                <Crown className="w-5 h-5 text-amber-500" />
                                                Quioba Premium
                                            </DialogTitle>
                                            <DialogDescription>
                                                Desbloquea todas las aplicaciones por un único precio.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="py-4 space-y-4">
                                            <div className="text-center p-4 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 rounded-2xl border border-amber-200 dark:border-amber-800/40">
                                                <p className="text-3xl font-extrabold text-amber-600">10€<span className="text-base font-medium text-slate-500">/mes</span></p>
                                                <p className="text-xs text-slate-500 mt-1">Todas las apps incluidas</p>
                                            </div>
                                            <ul className="space-y-2">
                                                {[
                                                    'Acceso a TODAS las aplicaciones',
                                                    'Sin límites ni restricciones',
                                                    'Actualizaciones prioritarias',
                                                    'Soporte preferente',
                                                    'Cancela cuando quieras',
                                                ].map((benefit, i) => (
                                                    <li key={i} className="flex items-center gap-2 text-sm">
                                                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                                                        <span>{benefit}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <Button
                                                onClick={handleUpgradePremium}
                                                disabled={upgradingPremium}
                                                className="w-full h-12 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white rounded-2xl font-bold text-base shadow-lg"
                                            >
                                                {upgradingPremium ? (
                                                    <LogoLoader size="sm" className="gap-0" />
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <Crown className="w-4 h-4" />
                                                        <span>Activar Premium</span>
                                                    </div>
                                                )}
                                            </Button>
                                            <p className="text-[10px] text-center text-slate-400">Pago seguro procesado por Quioba Pay</p>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                        {user ? (
                            <Button
                                variant="destructive"
                                className="w-full gap-2"
                                onClick={handleLogout}
                            >
                                <LogOut className="w-4 h-4" />
                                Cerrar Sesión
                            </Button>
                        ) : (
                            <Button
                                className="w-full gap-2 bg-green-800 hover:bg-green-900 font-bold"
                                onClick={() => router.push('/login')}
                            >
                                <UserPlus className="w-4 h-4" />
                                Iniciar Sesión / Registrarse
                            </Button>
                        )}
                    </CardContent>
                </Card>

                {/* Las 3 pestañas */}
                <Tabs defaultValue="suscripciones" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 rounded-2xl h-12">
                        <TabsTrigger value="suscripciones" className="rounded-xl text-xs flex items-center gap-2">
                            <Package className="w-4 h-4" /> Suscripciones
                        </TabsTrigger>
                        <TabsTrigger value="amigos" className="rounded-xl text-xs flex items-center gap-2">
                            <Users className="w-4 h-4" /> Mis Amigos
                        </TabsTrigger>
                        <TabsTrigger value="agente" className="rounded-xl text-xs flex items-center gap-2">
                            <Bot className="w-4 h-4" /> Mi Agente
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="suscripciones" className="mt-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Package className="w-5 h-5 text-green-800" />
                                    Mis Suscripciones
                                </CardTitle>
                                <CardDescription>Gestiona tus apps activas y su renovación</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {subscriptions.length > 0 ? (
                                    <div className="space-y-3">
                                        {subscriptions.map((sub) => {
                                            const timeInfo = getTimeRemaining(sub.expires_at);
                                            return (
                                                <div
                                                    key={sub.id}
                                                    className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${timeInfo.expired
                                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                                                        : 'bg-green-50/50 dark:bg-green-950/10 border-green-100 dark:border-green-950/30'
                                                        }`}
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                                            {sub.app_name}
                                                        </p>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <Clock className={`w-3 h-3 ${timeInfo.color}`} />
                                                            <span className={`text-xs font-medium ${timeInfo.color}`}>
                                                                {timeInfo.expired ? 'Caducada' : `Caduca en ${timeInfo.text}`}
                                                            </span>
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                                            {sub.amount_paid === 0 ? 'Gratuita' : `${sub.amount_paid}€/año`}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => toggleAutoRenew(sub.id, sub.auto_renew)}
                                                        className="flex items-center gap-1.5 shrink-0 ml-3"
                                                        title={sub.auto_renew ? 'Desactivar renovación' : 'Activar renovación'}
                                                    >
                                                        {sub.auto_renew ? (
                                                            <ToggleRight className="w-8 h-8 text-green-500" />
                                                        ) : (
                                                            <ToggleLeft className="w-8 h-8 text-slate-300" />
                                                        )}
                                                    </button>
                                                </div>
                                            );
                                        })}
                                        <p className="text-[10px] text-center text-slate-400 mt-2">
                                            Activa/desactiva la renovación automática de cada app
                                        </p>
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                                        <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                                        <p>No tienes suscripciones activas.</p>
                                        <p className="text-xs mt-1">Explora las apps desde el menú principal.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="amigos" className="mt-4">
                        <Card>
                            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Users className="w-5 h-5 text-primary" />
                                        Mis Amigos
                                    </CardTitle>
                                    <CardDescription>Gente con la que compartes apps</CardDescription>
                                </div>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button size="sm" variant="secondary" className="gap-2">
                                            <UserPlus className="w-4 h-4" /> Añadir
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Añadir Amigo</DialogTitle>
                                            <DialogDescription>
                                                Invita a alguien a usar Quioba Apps contigo.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-4">
                                            <div className="space-y-2">
                                                <Label>Email o Código de Usuario</Label>
                                                <Input placeholder="usuario@ejemplo.com" />
                                            </div>
                                            <Button className="w-full">Enviar Invitación</Button>
                                            <p className="text-xs text-muted-foreground text-center">
                                                También puedes añadir amigos directamente desde cada aplicación.
                                            </p>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </CardHeader>
                            <CardContent>
                                {contacts.length > 0 ? (
                                    <ScrollArea className="h-[200px]">
                                        <div className="space-y-2">
                                            {contacts.map((contact) => (
                                                <div key={contact.id} className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="w-8 h-8">
                                                            <AvatarImage src={contact.contact?.custom_avatar_url} />
                                                            <AvatarFallback>{contact.contact?.nickname?.[0] || '?'}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <p className="text-sm font-medium">{contact.contact?.nickname || 'Usuario'}</p>
                                                            <p className="text-xs text-muted-foreground">En tus contactos</p>
                                                        </div>
                                                    </div>
                                                    <Button variant="ghost" size="sm">Invitar a...</Button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                ) : (
                                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                                        <p>No tienes amigos añadidos aún.</p>
                                        <p className="text-xs mt-1">Invita a gente a tus listas o grupos.</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="agente" className="mt-4">
                        <SecretariaSettingsCard />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// ── Quioba Secretaria Card ────────────────────────────────────────────────────

function SecretariaSettingsCard() {
    const router = useRouter();
    const [settings, setSettings] = useState<SecretarySettings>(() => getSecretarySettings());
    const [saving, setSaving] = useState(false);

    const update = (patch: Partial<SecretarySettings>) =>
        setSettings(prev => ({ ...prev, ...patch }));

    const updateModule = (key: keyof SecretarySettings['modules'], val: boolean) =>
        setSettings(prev => ({ ...prev, modules: { ...prev.modules, [key]: val } }));

    const handleSave = async () => {
        setSaving(true);
        try {
            saveSecretarySettings(settings);
            if (settings.enabled) {
                await NotificationManager.requestPermissions();
                await NotificationManager.scheduleSecretary(
                    settings.syncTime,
                    settings.briefingTime,
                    settings.personality
                );
                toast.success('¡Secretaria activada! Recibirás tus notificaciones diarias.');
            } else {
                await NotificationManager.cancelSecretary();
                toast.success('Secretaria desactivada.');
            }
        } catch (e) {
            toast.error('Error al guardar la configuración.');
        } finally {
            setSaving(false);
        }
    };

    const personalities: { id: SecretaryPersonality; label: string; emoji: string; desc: string }[] = [
        { id: 'formal', label: 'Formal', emoji: '🎩', desc: 'Tono profesional y ejecutivo' },
        { id: 'friendly', label: 'Amigable', emoji: '😊', desc: 'Cercana y motivadora' },
        { id: 'sergeant', label: 'Sargento', emoji: '💪', desc: 'Directa, al grano, sin rodeos' },
    ];

    const modulesList: { key: keyof SecretarySettings['modules']; label: string; emoji: string }[] = [
        { key: 'tasks', label: 'Tareas', emoji: '✅' },
        { key: 'shopping', label: 'Compras', emoji: '🛒' },
        { key: 'medicines', label: 'Medicación', emoji: '💊' },
        { key: 'finances', label: 'Finanzas', emoji: '💶' },
        { key: 'shifts', label: 'Turnos', emoji: '💼' },
    ];

    return (
        <Card className="border-indigo-200 dark:border-indigo-800/40">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Bot className="w-5 h-5 text-indigo-600" />
                    Mi Agente Quioba
                    {settings.enabled && (
                        <Badge className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border-0 text-xs ml-1">
                            Activa
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription>Tu asistente personal de planificación diaria</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

                {/* Enable toggle */}
                <div className="flex items-center justify-between p-3 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                    <div className="flex items-center gap-2">
                        {settings.enabled ? <Bell className="w-4 h-4 text-indigo-600" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                        <div>
                            <p className="font-medium text-sm">Notificaciones diarias</p>
                            <p className="text-xs text-muted-foreground">{settings.enabled ? 'Sync + Briefing activados' : 'Desactivado'}</p>
                        </div>
                    </div>
                    <Switch
                        checked={settings.enabled}
                        onCheckedChange={(v) => update({ enabled: v })}
                    />
                </div>

                {/* Avatar selection */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Elige tu secretaria/o</Label>
                    <div className="grid grid-cols-4 gap-2">
                        {SECRETARY_AVATARS.map(av => (
                            <button
                                key={av.id}
                                onClick={() => update({ avatarId: av.id })}
                                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${settings.avatarId === av.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                        : 'border-transparent hover:border-indigo-200 dark:hover:border-indigo-700'
                                    }`}
                            >
                                <span className="text-2xl">{av.emoji}</span>
                                <span className="text-[10px] font-medium text-muted-foreground">{av.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Horarios */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">🌙 Sync nocturno</Label>
                        <Input
                            type="time"
                            value={settings.syncTime}
                            onChange={e => update({ syncTime: e.target.value })}
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">☀️ Briefing matinal</Label>
                        <Input
                            type="time"
                            value={settings.briefingTime}
                            onChange={e => update({ briefingTime: e.target.value })}
                            className="rounded-xl"
                        />
                    </div>
                </div>

                {/* Personality */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Personalidad</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {personalities.map(p => (
                            <button
                                key={p.id}
                                onClick={() => update({ personality: p.id })}
                                className={`p-3 rounded-xl border-2 text-center transition-all ${settings.personality === p.id
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                        : 'border-muted hover:border-indigo-200 dark:hover:border-indigo-700'
                                    }`}
                            >
                                <span className="text-xl block">{p.emoji}</span>
                                <span className="text-xs font-medium mt-1 block">{p.label}</span>
                            </button>
                        ))}
                    </div>
                    {personalities.find(p => p.id === settings.personality) && (
                        <p className="text-xs text-muted-foreground text-center">
                            {personalities.find(p => p.id === settings.personality)?.desc}
                        </p>
                    )}
                </div>

                {/* Modules */}
                <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Módulos incluidos</Label>
                    <div className="space-y-2">
                        {modulesList.map(m => (
                            <div key={m.key} className="flex items-center justify-between py-1.5">
                                <span className="text-sm flex items-center gap-2">
                                    <span>{m.emoji}</span> {m.label}
                                </span>
                                <Switch
                                    checked={settings.modules[m.key]}
                                    onCheckedChange={(v) => updateModule(m.key, v)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                        {settings.enabled ? 'Guardar y activar' : 'Guardar'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => router.push('/apps/organizador/sync')}
                        className="rounded-xl"
                    >
                        Probar Sync
                    </Button>
                </div>

            </CardContent>
        </Card>
    );
}

