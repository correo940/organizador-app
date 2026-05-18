'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Home, Pencil, X, Check } from 'lucide-react';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';

interface Room {
    id: string;
    name: string;
    icon?: string;
}

interface ManageRoomsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRoomsChanged?: () => void;
}

const ICON_OPTIONS = ['🏠', '🍳', '🚿', '🛋️', '🛏️', '🚗', '🏡', '🏢', '🏗️', '🪴', '📦', '🔧', '🎨', '💼', '🎮', '📚', '⚙️', '🧰', '🔌'];

const getRoomIcon = (icon: string) => {
    // Map legacy Lucide icon names to emojis
    const map: Record<string, string> = {
        'Droplet': '🚿',
        'ChefHat': '🍳',
        'Tv': '🛋️',
        'Bed': '🛏️',
        'Car': '🚗',
        'FolderOpen': '💼',
        'Home': '🏠',
        'bathroom': '🚿',
        'kitchen': '🍳',
        'living': '🛋️',
        'bedroom': '🛏️',
        'garage': '🚗',
        'office': '💼',
        'other': '🏠'
    };
    return map[icon] || icon || '📦';
};

export function ManageRoomsDialog({ open, onOpenChange, onRoomsChanged }: ManageRoomsDialogProps) {
    const { user } = useAuth();
    const [rooms, setRooms] = useState<Room[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    // Form state
    const [roomName, setRoomName] = useState('');
    const [roomIcon, setRoomIcon] = useState('🏠');

    useEffect(() => {
        if (open) {
            fetchRooms();
        }
    }, [open]);

    const fetchRooms = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .order('name');

            if (error) throw error;
            setRooms(data || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            toast.error('Error al cargar habitaciones');
        } finally {
            setLoading(false);
        }
    };

    const addRoom = async () => {
        if (!roomName.trim()) {
            toast.error('El nombre es obligatorio');
            return;
        }

        try {
            const { error } = await supabase
                .from('rooms')
                .insert([{
                    user_id: user?.id,
                    name: roomName.trim(),
                    icon: roomIcon
                }]);

            if (error) throw error;

            toast.success('Habitación añadida');
            resetForm();
            fetchRooms();
            onRoomsChanged?.();
        } catch (error) {
            console.error('Error adding room:', error);
            toast.error('Error al añadir habitación');
        }
    };

    const updateRoom = async () => {
        if (!roomName.trim() || !editingId) {
            toast.error('El nombre es obligatorio');
            return;
        }

        try {
            const { error } = await supabase
                .from('rooms')
                .update({
                    name: roomName.trim(),
                    icon: roomIcon
                })
                .eq('id', editingId);

            if (error) throw error;

            toast.success('Habitación actualizada');
            resetForm();
            fetchRooms();
            onRoomsChanged?.();
        } catch (error) {
            console.error('Error updating room:', error);
            toast.error('Error al actualizar habitación');
        }
    };

    const deleteRoom = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar "${name}"? Los manuales asignados no se eliminarán.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('rooms')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Habitación eliminada');
            fetchRooms();
            onRoomsChanged?.();
        } catch (error) {
            console.error('Error deleting room:', error);
            toast.error('Error al eliminar habitación');
        }
    };

    const startEdit = (room: Room) => {
        setEditingId(room.id);
        setRoomName(room.name);
        setRoomIcon(room.icon || '🏠');
        setShowForm(true);
    };

    const resetForm = () => {
        setEditingId(null);
        setRoomName('');
        setRoomIcon('🏠');
        setShowForm(false);
    };

    const handleSubmit = () => {
        if (editingId) {
            updateRoom();
        } else {
            addRoom();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Home className="h-5 w-5" />
                        Gestionar Habitaciones
                    </DialogTitle>
                    <DialogDescription>
                        Crea habitaciones personalizadas para organizar tus manuales
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-4">
                    {/* Existing Rooms */}
                    {rooms.length > 0 && !showForm && (
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Tus habitaciones</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {rooms.map(room => (
                                    <div
                                        key={room.id}
                                        className="p-3 border rounded-lg flex items-center justify-between hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="text-2xl">{getRoomIcon(room.icon || '')}</span>
                                            <span className="font-medium">{room.name}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => startEdit(room)}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 hover:text-destructive"
                                                onClick={() => deleteRoom(room.id, room.name)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Add/Edit Form */}
                    {!showForm ? (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => setShowForm(true)}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Nueva Habitación
                        </Button>
                    ) : (
                        <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm font-semibold">
                                    {editingId ? 'Editar Habitación' : 'Nueva Habitación'}
                                </Label>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={resetForm}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                <Label>Nombre *</Label>
                                <Input
                                    value={roomName}
                                    onChange={(e) => setRoomName(e.target.value)}
                                    placeholder="Ej: Terraza, Taller, Estudio..."
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Icono</Label>
                                <div className="grid grid-cols-10 gap-2">
                                    {ICON_OPTIONS.map(icon => (
                                        <button
                                            key={icon}
                                            type="button"
                                            className={`
                                                p-2 text-2xl rounded border-2 transition-all
                                                ${roomIcon === icon
                                                    ? 'border-primary bg-primary/10 scale-110'
                                                    : 'border-transparent hover:border-muted-foreground/20'
                                                }
                                            `}
                                            onClick={() => setRoomIcon(icon)}
                                        >
                                            {icon}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="outline" onClick={resetForm}>
                                    Cancelar
                                </Button>
                                <Button onClick={handleSubmit}>
                                    <Check className="h-4 w-4 mr-2" />
                                    {editingId ? 'Actualizar' : 'Crear'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {rooms.length === 0 && !showForm && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Home className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No hay habitaciones creadas</p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
