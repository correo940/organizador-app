'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Share2, Copy, Mail } from 'lucide-react';

interface ShareManualDialogProps {
    manual: {
        id: string;
        title: string;
        description: string;
    };
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ShareManualDialog({ manual, open, onOpenChange }: ShareManualDialogProps) {
    const [email, setEmail] = useState('');
    const [sharing, setSharing] = useState(false);

    // Generate shareable link (in future could be actual shared link)
    const shareableLink = `${window.location.origin}/apps/mi-hogar/manuals?manual=${manual.id}`;

    const copyLink = () => {
        navigator.clipboard.writeText(shareableLink);
        toast.success('Enlace copiado al portapapeles');
    };

    const shareViaEmail = async () => {
        if (!email) {
            toast.error('Introduce un email válido');
            return;
        }

        setSharing(true);

        // In a real implementation, this would call an API endpoint
        // For now, we'll just open the email client
        const subject = encodeURIComponent(`Manual: ${manual.title}`);
        const body = encodeURIComponent(
            `Te comparto este manual de Quiova:\n\n` +
            `${manual.title}\n` +
            `${manual.description}\n\n` +
            `Ver manual: ${shareableLink}`
        );

        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;

        setTimeout(() => {
            setSharing(false);
            toast.success('Email preparado');
            onOpenChange(false);
        }, 1000);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Share2 className="h-5 w-5" />
                        Compartir Manual
                    </DialogTitle>
                    <DialogDescription>
                        Comparte "{manual.title}" con otros usuarios
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Copy Link */}
                    <div className="space-y-2">
                        <Label>Enlace directo</Label>
                        <div className="flex gap-2">
                            <Input
                                value={shareableLink}
                                readOnly
                                className="flex-1"
                            />
                            <Button
                                size="icon"
                                variant="outline"
                                onClick={copyLink}
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Cualquiera con este enlace podrá ver el manual
                        </p>
                    </div>

                    {/* Email Share */}
                    <div className="space-y-2">
                        <Label htmlFor="email">Compartir por email</Label>
                        <div className="flex gap-2">
                            <Input
                                id="email"
                                type="email"
                                placeholder="usuario@ejemplo.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="flex-1"
                            />
                            <Button
                                size="icon"
                                onClick={shareViaEmail}
                                disabled={sharing}
                            >
                                <Mail className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
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
