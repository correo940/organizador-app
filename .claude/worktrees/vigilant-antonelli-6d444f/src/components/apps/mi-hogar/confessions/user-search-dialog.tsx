'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type User = {
    id: string;
    email: string;
};

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (userId: string) => void;
};

export function UserSearchDialog({ isOpen, onClose, onSelect }: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<User[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setUsers([]);
        }
    }, [isOpen]);

    const handleSearch = async () => {
        if (!searchQuery.trim()) {
            toast.error('Escribe un email para buscar');
            return;
        }

        setIsSearching(true);

        // Search users by email
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email')
            .ilike('email', `%${searchQuery.trim()}%`)
            .limit(10);

        if (error) {
            toast.error('Error al buscar usuarios');
            setUsers([]);
        } else {
            setUsers(data || []);
            if (!data || data.length === 0) {
                toast.info('No se encontraron usuarios');
            }
        }

        setIsSearching(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Nueva Conversación</DialogTitle>
                    <DialogDescription>
                        Busca un usuario de Quioba para empezar a compartir pensamientos
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="flex gap-2">
                        <Input
                            placeholder="Buscar por email..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                        <Button onClick={handleSearch} disabled={isSearching}>
                            <Search className="w-4 h-4" />
                        </Button>
                    </div>

                    <ScrollArea className="h-[300px] rounded-md border p-2">
                        {users.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                                <Search className="w-12 h-12 opacity-50 mb-2" />
                                <p className="text-sm">Busca usuarios por email</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <div
                                        key={user.id}
                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                                        onClick={() => {
                                            onSelect(user.id);
                                            onClose();
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Avatar className="w-10 h-10">
                                                <AvatarFallback className="bg-primary/10 text-primary">
                                                    {user.email.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="font-medium text-sm">
                                                {user.email}
                                            </span>
                                        </div>
                                        <Button size="sm" variant="ghost">
                                            <UserPlus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </DialogContent>
        </Dialog>
    );
}
