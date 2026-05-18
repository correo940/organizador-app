'use client';

import { useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';

type Props = {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (durationHours: number, reason?: string) => void;
};

const DURATION_OPTIONS = [
    { value: 1, label: '1 hora' },
    { value: 6, label: '6 horas' },
    { value: 24, label: '1 día' },
    { value: 72, label: '3 días' },
    { value: 168, label: '1 semana' }
];

export function PauseDialog({ isOpen, onClose, onConfirm }: Props) {
    const [duration, setDuration] = useState<number>(24);
    const [reason, setReason] = useState('');

    const handleConfirm = () => {
        onConfirm(duration, reason.trim() || undefined);
        setReason('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-500" />
                        Pausar Conversación
                    </DialogTitle>
                    <DialogDescription>
                        Pausa temporalmente esta conversación. Ninguno podrá enviar mensajes hasta que expire el tiempo.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="duration">Duración de la pausa</Label>
                        <Select
                            value={duration.toString()}
                            onValueChange={(v) => setDuration(Number(v))}
                        >
                            <SelectTrigger id="duration">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DURATION_OPTIONS.map(opt => (
                                    <SelectItem key={opt.value} value={opt.value.toString()}>
                                        {opt.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="reason">Motivo (opcional)</Label>
                        <Textarea
                            id="reason"
                            placeholder="Ej: Necesito tiempo para pensar..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-orange-900">
                            Ambos veréis que la conversación está pausada y el tiempo restante.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} className="bg-orange-600 hover:bg-orange-700">
                        <Clock className="w-4 h-4 mr-2" />
                        Pausar {DURATION_OPTIONS.find(o => o.value === duration)?.label.toLowerCase()}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
