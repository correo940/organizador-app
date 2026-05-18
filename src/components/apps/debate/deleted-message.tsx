import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EyeOff } from 'lucide-react';

interface DeletedMessageProps {
    isAdmin: boolean;
    originalContent?: string;
    deletedBy?: string;
    deletedAt?: string;
}

export function DeletedMessage({
    isAdmin,
    originalContent,
    deletedBy,
    deletedAt,
}: DeletedMessageProps) {
    if (isAdmin && originalContent) {
        // Admins can see deleted content
        return (
            <Card className="p-3 border-dashed border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <EyeOff className="w-3 h-3" />
                    <span>Mensaje eliminado (solo visible para admins)</span>
                </div>
                <p className="text-sm opacity-70">{originalContent}</p>
                {deletedBy && (
                    <p className="text-xs text-muted-foreground mt-2">
                        Eliminado {deletedAt && `el ${new Date(deletedAt).toLocaleString()}`}
                    </p>
                )}
            </Card>
        );
    }

    // Regular users see placeholder
    return (
        <Card className="p-3 border-dashed bg-muted/30">
            <div className="flex items-center gap-2 text-sm text-muted-foreground italic">
                <EyeOff className="w-4 h-4" />
                [Mensaje eliminado]
            </div>
        </Card>
    );
}
