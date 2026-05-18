import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReportMessageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    debateId: string;
    messageId: string;
    messageContent: string;
}

const REPORT_CATEGORIES = [
    { value: 'insult', label: 'Insultos o lenguaje ofensivo' },
    { value: 'spam', label: 'Spam o publicidad' },
    { value: 'offtopic', label: 'Fuera de tema' },
    { value: 'harassment', label: 'Acoso o intimidación' },
    { value: 'other', label: 'Otro' },
];

export function ReportMessageDialog({
    open,
    onOpenChange,
    debateId,
    messageId,
    messageContent,
}: ReportMessageDialogProps) {
    const [category, setCategory] = useState('');
    const [details, setDetails] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!category) {
            toast.error('Selecciona una categoría');
            return;
        }

        setLoading(true);

        try {
            const reason = `${REPORT_CATEGORIES.find(c => c.value === category)?.label}: ${details || 'Sin detalles adicionales'}`;

            const { data, error } = await supabase.rpc('report_message', {
                p_debate_id: debateId,
                p_message_id: messageId,
                p_reason: reason,
            });

            if (error) throw error;

            if (data?.success) {
                toast.success('Reporte enviado', {
                    description: 'Un moderador revisará este mensaje pronto',
                });
                onOpenChange(false);
                setCategory('');
                setDetails('');
            } else {
                throw new Error(data?.error || 'Error al enviar reporte');
            }
        } catch (error: any) {
            console.error('Error reporting message:', error);
            toast.error('Error al enviar reporte', {
                description: error.message,
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        Reportar Mensaje
                    </DialogTitle>
                    <DialogDescription>
                        Este reporte será revisado por los moderadores del debate.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Mostrar fragmento del mensaje */}
                    <div className="p-3 bg-muted rounded-lg border">
                        <p className="text-xs text-muted-foreground mb-1">Mensaje reportado:</p>
                        <p className="text-sm line-clamp-3">{messageContent}</p>
                    </div>

                    {/* Categoría */}
                    <div className="space-y-2">
                        <Label>Motivo del reporte *</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona un motivo" />
                            </SelectTrigger>
                            <SelectContent>
                                {REPORT_CATEGORIES.map((cat) => (
                                    <SelectItem key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Detalles adicionales */}
                    <div className="space-y-2">
                        <Label htmlFor="details">Detalles adicionales (opcional)</Label>
                        <Textarea
                            id="details"
                            placeholder="Proporciona más contexto si lo deseas..."
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            rows={3}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!category || loading}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Enviando...
                            </>
                        ) : (
                            'Enviar Reporte'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
