"use client";

import { useState, useEffect } from "react";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Trash2, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

type GlobalLimit = {
    id: string;
    endpoint: string;
    monthly_limit: number;
    enabled: boolean;
    description: string;
};

type CustomLimit = {
    id: string;
    user_id: string;
    endpoint: string;
    monthly_limit: number;
    created_at: string;
    user_email?: string;
};

type User = {
    id: string;
    email: string;
};

export default function ApiLimitsManager() {
    const [globalLimits, setGlobalLimits] = useState<GlobalLimit[]>([]);
    const [customLimits, setCustomLimits] = useState<CustomLimit[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    // Edit states
    const [editingGlobalId, setEditingGlobalId] = useState<string | null>(null);
    const [editLimitValue, setEditLimitValue] = useState<number>(0);

    // Form states
    const [newUser, setNewUser] = useState<string>("");
    const [newEndpoint, setNewEndpoint] = useState<string>("");
    const [newLimit, setNewLimit] = useState<number>(0);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch users
            const usersRes = await fetch('/api/admin/users');
            const usersData = await usersRes.json();
            const userList = usersData.users || [];
            if (userList) setUsers(userList);

            // Fetch limits
            const limitsRes = await fetch('/api/admin/api-limits');
            const limitsData = await limitsRes.json();

            if (limitsData.globalLimits) setGlobalLimits(limitsData.globalLimits);

            if (limitsData.customLimits) {
                // Map user_id to email for display
                const mappedCustoms = limitsData.customLimits.map((cl: CustomLimit) => {
                    const foundUser = userList.find((u: User) => u.id === cl.user_id);
                    return { ...cl, user_email: foundUser?.email || cl.user_id };
                });
                setCustomLimits(mappedCustoms);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Error al cargar los datos");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSaveGlobal = async (id: string, enabled: boolean) => {
        try {
            const res = await fetch('/api/admin/api-limits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: 'global', id, monthly_limit: editLimitValue, enabled })
            });
            if (!res.ok) throw new Error("Error guardando");
            toast.success("Límite global actualizado");
            setEditingGlobalId(null);
            fetchData();
        } catch (e) {
            toast.error("Falló la actualización");
        }
    };

    const handleAddCustom = async () => {
        if (!newUser || !newEndpoint || newLimit < 0) {
            toast.error("Rellena todos los campos correctamente");
            return;
        }

        try {
            const res = await fetch('/api/admin/api-limits', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'custom',
                    user_id: newUser,
                    endpoint: newEndpoint,
                    monthly_limit: newLimit
                })
            });
            if (!res.ok) throw new Error("Error añadiendo");
            toast.success("Límite personalizado asignado");
            setNewUser("");
            setNewEndpoint("");
            setNewLimit(0);
            fetchData();
        } catch (e) {
            toast.error("Error al asignar límite");
        }
    };

    const handleDeleteCustom = async (id: string) => {
        if (!confirm("¿Eliminar este límite personalizado? El usuario volverá al límite global.")) return;
        try {
            const res = await fetch(`/api/admin/api-limits?id=${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Error borrando");
            toast.success("Límite eliminado");
            fetchData();
        } catch (e) {
            toast.error("Error al eliminar");
        }
    };

    if (loading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>;
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-indigo-500" />
                    Gestión de Límites de APIs
                </CardTitle>
                <CardDescription>
                    Controla cuántos usos mensuales tiene cada API. Puedes asignar límites especiales a usuarios concretos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs defaultValue="global" className="w-full">
                    <TabsList className="mb-4">
                        <TabsTrigger value="global">Límites Globales (Por defecto)</TabsTrigger>
                        <TabsTrigger value="users">Límites Personalizados por Usuario</TabsTrigger>
                    </TabsList>

                    {/* GLOBAL LIMITS */}
                    <TabsContent value="global" className="space-y-4">
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                    <TableRow>
                                        <TableHead>Endpoint / API</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead className="w-32">Límite Mensual</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {globalLimits.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center">No hay límites configurados.</TableCell></TableRow>
                                    ) : globalLimits.map((l) => (
                                        <TableRow key={l.id}>
                                            <TableCell className="font-mono text-xs font-semibold">{l.endpoint}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{l.description}</TableCell>
                                            <TableCell>
                                                {l.enabled ? <Badge variant="default" className="bg-green-500 hover:bg-green-800">Activo</Badge> : <Badge variant="secondary">Inactivo</Badge>}
                                            </TableCell>
                                            <TableCell>
                                                {editingGlobalId === l.id ? (
                                                    <Input
                                                        type="number"
                                                        value={editLimitValue}
                                                        onChange={(e) => setEditLimitValue(parseInt(e.target.value) || 0)}
                                                        className="h-8 max-w-[100px]"
                                                    />
                                                ) : l.monthly_limit}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {editingGlobalId === l.id ? (
                                                    <div className="flex justify-end gap-1">
                                                        <Button size="sm" onClick={() => handleSaveGlobal(l.id, l.enabled)} variant="default" className="h-8 px-2"><Save className="w-4 h-4" /></Button>
                                                        <Button size="sm" onClick={() => setEditingGlobalId(null)} variant="outline" className="h-8 px-2">X</Button>
                                                    </div>
                                                ) : (
                                                    <Button size="sm" variant="outline" onClick={() => { setEditingGlobalId(l.id); setEditLimitValue(l.monthly_limit); }}>Editar</Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>

                    {/* CUSTOM LIMITS */}
                    <TabsContent value="users" className="space-y-6">
                        {/* Custom Assign Form */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-lg border flex flex-col md:flex-row gap-4 items-end">
                            <div className="space-y-1 flex-1 min-w-[200px]">
                                <label className="text-xs font-medium">Usuario (Email)</label>
                                <Select value={newUser} onValueChange={setNewUser}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                    <SelectContent>
                                        {users.map(u => <SelectItem key={u.id} value={u.id}>{u.email}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 flex-1 min-w-[200px]">
                                <label className="text-xs font-medium">API Endpoint</label>
                                <Select value={newEndpoint} onValueChange={setNewEndpoint}>
                                    <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                                    <SelectContent>
                                        {globalLimits.map(l => <SelectItem key={l.endpoint} value={l.endpoint}>{l.endpoint} ({l.description})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1 w-[120px]">
                                <label className="text-xs font-medium">Nuevo Límite</label>
                                <Input type="number" value={newLimit} onChange={(e) => setNewLimit(parseInt(e.target.value) || 0)} />
                            </div>
                            <Button onClick={handleAddCustom} className="gap-2 shrink-0">
                                <Plus className="w-4 h-4" /> Asignar
                            </Button>
                        </div>

                        {/* Custom Limits Table */}
                        <div className="border rounded-md overflow-hidden">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                                    <TableRow>
                                        <TableHead>Email de Usuario</TableHead>
                                        <TableHead>Endpoint</TableHead>
                                        <TableHead className="w-32">Límite Personalizado</TableHead>
                                        <TableHead className="text-right">Quitar Excepción</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customLimits.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No hay usuarios con límites especiales configurados.</TableCell></TableRow>
                                    ) : customLimits.map((c) => (
                                        <TableRow key={c.id}>
                                            <TableCell className="font-medium">{c.user_email}</TableCell>
                                            <TableCell className="font-mono text-xs">{c.endpoint}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="border-indigo-200 text-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-xs">{c.monthly_limit} usos/mes</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => handleDeleteCustom(c.id)}>
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
    );
}

