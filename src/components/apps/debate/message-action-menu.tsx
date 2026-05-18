import { useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, AlertTriangle, Trash2 } from 'lucide-react';
import { ReportMessageDialog } from './report-message-dialog';
import { useDebatePermissions } from '@/lib/hooks/useDebatePermissions';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface MessageActionMenuProps {
    debateId: string;
    messageId: string;
    messageContent: string;
    messageSenderId: string;
}

export function MessageActionMenu({
    debateId,
    messageId,
    messageContent,
    messageSenderId,
}: MessageActionMenuProps) {
    const [reportDialogOpen, setReportDialogOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const permissions = useDebatePermissions(debateId);

    const handleDeleteMessage = async () => {
        if (!confirm('¿Estás seguro de que quieres eliminar este mensaje?')) {
            return;
        }

        setDeleting(true);

        try {
            const { error } = await supabase
                .from('debate_messages')
                .update({
                    deleted_at: new Date().toISOString(),
                    deleted_by: (await supabase.auth.getUser()).data.user?.id,
                })
                .eq('id', messageId);

            if (error) throw error;

            toast.success('Mensaje eliminado');
        } catch (error: any) {
            console.error('Error deleting message:', error);
            toast.error('Error al eliminar mensaje', {
                description: error.message,
            });
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <MoreVertical className="h-3 w-3" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {/* Report option - available to all users */}
                    <DropdownMenuItem
                        onClick={() => setReportDialogOpen(true)}
                        className="text-orange-600 focus:text-orange-600"
                    >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Reportar
                    </DropdownMenuItem>

                    {/* Delete option - only for moderators/admins */}
                    {permissions.canDeleteMessages && (
                        <DropdownMenuItem
                            onClick={handleDeleteMessage}
                            disabled={deleting}
                            className="text-destructive focus:text-destructive"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {deleting ? 'Eliminando...' : 'Eliminar'}
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            <ReportMessageDialog
                open={reportDialogOpen}
                onOpenChange={setReportDialogOpen}
                debateId={debateId}
                messageId={messageId}
                messageContent={messageContent}
            />
        </>
    );
}
