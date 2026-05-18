import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Loader2, Key, ShieldCheck, RefreshCw, Copy, Mail, Users, Trash2, Folder } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type Partner = {
    email: string;
    id: string;
    nickname?: string;
};

// Assuming Invitation type might be needed for pending/sent invites, defining a basic one
type Invitation = {
    id: string;
    email: string;
    status: 'pending' | 'sent';
};

export function ShareExpensesDialog({ open, onOpenChange, folderId, folderName }: { open: boolean; onOpenChange: (open: boolean) => void; folderId?: string | null; folderName?: string }) {
    const [loading, setLoading] = useState(false);
    const [pendingInvites, setPendingInvites] = useState<Invitation[]>([]); // Keep for legacy/cleanup
    const [sentInvites, setSentInvites] = useState<Invitation[]>([]); // Keep for legacy/cleanup
    const [partners, setPartners] = useState<Partner[]>([]);
    const [nickname, setNickname] = useState('');
    const [generatedCode, setGeneratedCode] = useState('');
    const [inputCode, setInputCode] = useState('');

    useEffect(() => {
        if (open) {
            checkStatus();
            setGeneratedCode(''); // Reset code on open
        }
    }, [open, folderId]);

    const checkStatus = async () => {
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // 0. Fetch Nickname
            const { data: profile } = await supabase
                .from('profiles')
                .select('nickname')
                .eq('id', user.id)
                .single();
            if (profile?.nickname) setNickname(profile.nickname);

            if (folderId) {
                // --- FOLDER SPECIFIC STATUS ---
                const { data: members, error } = await supabase.rpc('get_folder_members', { p_folder_id: folderId });
                if (error) throw error;

                if (members) {
                    // Filter out myself
                    const others = members.filter((m: any) => m.member_id !== user.id).map((m: any) => ({
                        id: m.member_id,
                        email: m.email || 'Usuario invitado',
                        nickname: m.nickname || 'Usuario'
                    }));
                    setPartners(others);
                } else {
                    setPartners([]);
                }

            } else {
                // --- GLOBAL PARTNERSHIP STATUS ---
                const { data: partnersData, error: partnerError } = await supabase
                    .from('expense_partners')
                    .select('id, user_id_1, user_id_2')
                    .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`);

                if (partnerError) throw partnerError;

                if (partnersData && partnersData.length > 0) {
                    // Manual Join: extract IDs and fetch profiles
                    const partnerIds = partnersData.map(p => p.user_id_1 === user.id ? p.user_id_2 : p.user_id_1);

                    let profilesMap: Record<string, string> = {};

                    if (partnerIds.length > 0) {
                        const { data: profiles, error: profileError } = await supabase
                            .from('profiles')
                            .select('id, nickname')
                            .in('id', partnerIds);

                        if (!profileError && profiles) {
                            profiles.forEach(p => {
                                if (p.nickname) profilesMap[p.id] = p.nickname;
                            });
                        }
                    }

                    const formattedPartners = partnersData.map(p => {
                        const partnerId = p.user_id_1 === user.id ? p.user_id_2 : p.user_id_1;
                        return {
                            id: partnerId,
                            email: 'Usuario Conectado',
                            nickname: profilesMap[partnerId] || 'Usuario'
                        };
                    });
                    setPartners(formattedPartners);
                } else {
                    setPartners([]);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar el estado de vinculación.');
        } finally {
            setLoading(false);
        }
    };

    const generateCode = async () => {
        setLoading(true);
        try {
            let data, error;

            if (folderId) {
                // Folder Code
                const res = await supabase.rpc('generate_folder_code', { p_folder_id: folderId });
                data = res.data;
                error = res.error;
            } else {
                // Global Code
                const res = await supabase.rpc('generate_connection_code');
                data = res.data;
                error = res.error;
            }

            if (error) throw error;
            setGeneratedCode(data);
        } catch (error: any) {
            toast.error('Error al generar código: ' + (error.message || ''));
        } finally {
            setLoading(false);
        }
    };

    const redeemCode = async () => {
        if (inputCode.length < 6) return toast.error('Código inválido');
        setLoading(true);
        try {
            let error;

            if (folderId) {
                // Folder Redeem - NOTE: Logic implies we are inside a folder context.
                // But wait, if I am redeeming, I might not HAVE the folder yet locally in UI context if I haven't joined.
                // Actually, the user usually goes to "Share" inside the folder. 
                // If I want to JOIN a folder, I probably need a global "Join Folder" button or use the generic code input.
                // For now, let's assume this dialog is used when you are INSIDE (Creator/Member) inviting others.
                // OR if I am the one entering the code, I am already looking at the UI? 
                // Actually, to JOIN, I need to know WHERE to put the code. 
                // The PROPOSAL was: "Dependiendo de qué carpeta estés, la puedas compartir".
                // So this covers the SENDER side perfectly.
                // The RECEIVER side: They might not see the folder yet. 
                // But if they have a code, they can redeem it anywhere?
                // Currently `redeem_connection_code` is global logic. `redeem_folder_code` is specific.
                // If I use the Global "Add" button, I might not be in a folder.
                // Let's assume for this ticket, we focus on the Context: "I am in Folder X, I want to invite Y".
                // Y enters the code. Where? 
                // If Y is not in the folder, Y doesn't see the folder to open its dialog.
                // So Y must use a GLOBAL Redeem place or we update the Global logic to try folder redeem too?
                // Or we instruct: "Go to General -> Link".

                // IMPROVEMENT: Try both or use specific RPC if we know context.
                // If `folderId` is passed, we are definitely trying to link to THIS folder.
                // THIS IS WEIRD for the Receiver. Receiver shouldn't be in the folder dialog if they aren't in it.
                // So Receiver creates a "General" link usually?
                // Let's stick to the request: "Compartir CON...". This implies sending invitations.
                // The Receiver entering the code: If they are joining a folder, they probably do it from the main screen?
                // Current limitation: This dialog is the only place to redeem.
                // Let's allow redeeming folder codes here even if folderId is set (weird self-join?) 
                // OR more likely: Receiver goes to "General" (No ID) -> Redeems Code -> Code logic detects if it is folder or global?
                // The RPCs are separate. `redeem_connection_code` checks `connection_codes` table. `redeem_folder_code` checks `folder_connection_codes`.
                // We should try both if we don't know? Or separate inputs?
                // Let's try `redeem_folder_code` if `redeem_connection_code` fails?
                // OR better: Create a unified `redeem_any_code`?

                // FOR THIS TASK: I will implement `redeem_folder_code` explicitly if we think it's a folder code.
                // If we are in "General" (no folderId), we try `redeem_connection_code`.
                // If that fails, we try `redeem_folder_code`? 
                // Let's try `redeem_folder_code` here explicitly if folderId is defined (joining ANOTHER folder? No, doesn't make sense).

                // HYPOTHESIS: User B is in 'General'. User A gives code for 'Ibiza'.
                // User B opens 'General' -> 'Share' -> Enters 'Ibiza' Code.
                // User B's context is Global (folderId=null).
                // So when folderId is NULL, we should try BOTH.

                const { error: globalErr } = await supabase.rpc('redeem_connection_code', { p_code: inputCode });
                if (!globalErr) {
                    toast.success('¡Vinculación Global Correcta!');
                    checkStatus();
                    setInputCode('');
                    return;
                }

                // If global failed, try Folder
                const { data: newFolderId, error: folderErr } = await supabase.rpc('redeem_folder_code', { p_code: inputCode });
                if (!folderErr) {
                    toast.success('¡Te has unido a la carpeta!');
                    checkStatus(); // won't show the folder members here if we are in global, but updates list
                    setInputCode('');
                    onOpenChange(false); // Close so they can see new folder
                    window.location.reload(); // Quickest way to refresh folders list in parent
                    return;
                }

                throw new Error('Código no válido (ni global ni de carpeta)');

            } else {
                // Context: folderId is present (I am viewing a folder).
                // Redeeming a code inside a folder? 
                // Does it make sense to join a folder while inside another?
                // Probably not common. But if I do, I expect to join THAT folder?
                // No, I can't join a folder I am already in (RPC blocks it).
                // So if I am in Folder A, and I enter a code... maybe I am joining Folder B?
                // Let's keep the "Try Both" logic safe.

                // Actually, if I am in Folder A, I might be adding a Member by entering THEIR code? 
                // No, the system is "Generate Code" (I hold the door open) -> "Enter Code" (You walk in).
                // So if I am IN the folder, I Generate.
                // The person OUTSIDE enters.

                // So the `redeemCode` logic is mostly for the OUTSIDER.
                // The OUTSIDER is usually in Global view.
                // So the logic above (try both) handles it.

                // What if I am in Folder A and enter a code? 
                // I probably want to join whatever the code is for.
                const { error: globalErr } = await supabase.rpc('redeem_connection_code', { p_code: inputCode });
                if (!globalErr) {
                    toast.success('¡Vinculación Global Correcta!');
                    setInputCode('');
                    return;
                }

                const { error: folderErr } = await supabase.rpc('redeem_folder_code', { p_code: inputCode });
                if (!folderErr) {
                    toast.success('¡Te has unido a una nueva carpeta!');
                    setInputCode('');
                    onOpenChange(false);
                    window.location.reload();
                    return;
                }

                throw new Error('Código no válido');
            }

        } catch (error: any) {
            toast.error(error.message || 'Error al canjear código');
        } finally {
            setLoading(false);
        }
    };

    const copyCode = () => {
        navigator.clipboard.writeText(generatedCode);
        toast.success('Código copiado');
    };

    const handleSendEmail = () => {
        const subject = folderName
            ? `Únete a la carpeta "${folderName}" en Quioba`
            : "Únete a mis Gastos Compartidos en Quioba";

        const body = folderName
            ? `Hola, \n\nQuiero compartir la carpeta "${folderName}" contigo en Quioba.\n\n1. Entra en 'Gastos Compartidos'.\n2. Dale a 'Compartir' (desde General o cualquier lugar).\n3. Introduce este código: ${generatedCode} \n\n¡Acceso limitado solo a esta carpeta!`
            : `Hola, \n\nQuiero compartir gastos contigo en la app Quioba.\n\n1.Entra en la sección 'Gastos Compartidos'.\n2.Dale a 'Compartir' -> 'Tengo un código'.\n3.Introduce este código: ${generatedCode} \n\n¡Nos vemos dentro!`;

        window.open(`mailto:? subject = ${encodeURIComponent(subject)}& body=${encodeURIComponent(body)} `);
    };

    const saveNickname = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { error } = await supabase
                .from('profiles')
                .update({ nickname: nickname })
                .eq('id', user.id);

            if (error) throw error;
            toast.success('Nombre actualizado');
        } catch (e) {
            toast.error('Error al guardar nombre');
        }
    };

    const handleRemovePartner = async (partnerId: string) => {
        if (!confirm('¿Seguro que quieres eliminar a este usuario?')) return;
        setLoading(true);
        try {
            if (folderId) {
                // Remove from Folder
                const { error } = await supabase
                    .from('expense_folder_members')
                    .delete()
                    .match({ folder_id: folderId, user_id: partnerId });
                if (error) throw error;
            } else {
                // Remove Global Partner
                const { error } = await supabase.rpc('remove_partner', { p_partner_id: partnerId });
                if (error) throw error;
            }

            toast.success('Usuario eliminado');
            checkStatus();
        } catch (error) {
            toast.error('Error al eliminar');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md w-[95vw] rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {folderId ? <Folder className="w-5 h-5 text-green-800" /> : <Users className="w-5 h-5 text-green-800" />}
                        {folderName ? `Compartir "${folderName}"` : 'Vincular Gastos Globales'}
                    </DialogTitle>
                    <DialogDescription>
                        {folderName
                            ? "Invita a personas solo a esta carpeta."
                            : "Vincula tu cuenta con tu pareja para compartirlo TODO."}
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6 max-h-[60vh] overflow-y-auto px-1">
                    {/* Nickname Section */}
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border">
                        <Label className="text-xs text-muted-foreground">Tu Nombre (Visible para el grupo)</Label>
                        <div className="flex gap-2 mt-1">
                            <Input
                                placeholder="Ej: Jacho"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                                className="h-9"
                            />
                            <Button size="sm" onClick={saveNickname}>Guardar</Button>
                        </div>
                    </div>

                    {loading && partners.length === 0 && <div className="flex justify-center"><Loader2 className="animate-spin" /></div>}

                    {/* Partners List (if any) */}
                    {partners.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-100 dark:border-green-950 mb-6">
                            <div className="flex items-center gap-3 mb-3">
                                <ShieldCheck className="w-6 h-6 text-green-800" />
                                <h3 className="font-bold text-green-950 dark:text-green-100">
                                    {folderId ? 'Miembros de la Carpeta' : 'Personas Conectadas'}
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {partners.map((p, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full">
                                                <Users className="w-4 h-4 text-slate-500" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{p.nickname || 'Usuario'}</p>
                                                <p className="text-xs text-muted-foreground">{p.email}</p>
                                            </div>
                                        </div>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => handleRemovePartner(p.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                            <p className="text-xs text-green-900 dark:text-green-300 mt-3 text-center">
                                {folderId
                                    ? `Total: ${partners.length + 1} miembros.`
                                    : `Compartís gastos entre ${partners.length + 1} personas.`}
                            </p>
                        </div>
                    )}

                    {/* Always allow adding more */}
                    <div className="space-y-6">

                        {/* Option A: Generate Code */}
                        <div className="space-y-2 p-4 border rounded-xl bg-slate-50 dark:bg-slate-900">
                            <Label className="text-base font-semibold">Tengo que dar un código</Label>
                            <p className="text-sm text-muted-foreground mb-4">
                                {folderName
                                    ? "Genera un código para invitar a alguien a ESTA carpeta."
                                    : "Genera un código y dáselo a tu pareja para conectar cuentas."}
                            </p>

                            {generatedCode ? (
                                <div className="flex flex-col items-center gap-2 animate-in fade-in">
                                    <div className="text-4xl font-mono font-bold tracking-widest text-primary my-2">
                                        {generatedCode}
                                    </div>
                                    <div className="flex gap-2 w-full">
                                        <Button variant="outline" className="flex-1" onClick={copyCode}>
                                            <Copy className="w-4 h-4 mr-2" /> Copiar
                                        </Button>
                                        <Button variant="outline" className="flex-1" onClick={handleSendEmail}>
                                            <Mail className="w-4 h-4 mr-2" /> Enviar Email
                                        </Button>
                                        <Button variant="ghost" onClick={generateCode}>
                                            <RefreshCw className="w-4 h-4" />
                                        </Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Válido por 15 minutos</p>
                                </div>
                            ) : (
                                <Button onClick={generateCode} className="w-full" variant="secondary">
                                    <Key className="w-4 h-4 mr-2" />
                                    {folderName ? 'Generar Invitación de Carpeta' : 'Generar Código Global'}
                                </Button>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">O bien</span></div>
                        </div>

                        {/* Option B: Enter Code */}
                        <div className="space-y-2">
                            <Label className="text-base font-semibold">Tengo un código</Label>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Ej: 123456"
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    className="text-center font-mono text-lg tracking-widest"
                                />
                                <Button onClick={redeemCode} disabled={inputCode.length < 6}>
                                    Unirme
                                </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Sirve tanto para códigos globales como de carpetas.
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

