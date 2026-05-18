import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, AlertTriangle } from 'lucide-react';
import { ParticipantList } from './participant-list';
import { ReportsReviewPanel } from './reports-review-panel';
import { useDebatePermissions } from '@/lib/hooks/useDebatePermissions';

interface DebateManagementPanelProps {
    debateId: string;
    currentUserId: string;
    trigger?: React.ReactNode;
}

export function DebateManagementPanel({ debateId, currentUserId, trigger }: DebateManagementPanelProps) {
    const [open, setOpen] = useState(false);
    const permissions = useDebatePermissions(debateId);

    // Only show management panel if user has admin or moderator permissions
    if (!permissions.canDeleteMessages && !permissions.canAssignRoles) {
        return null;
    }

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                {trigger || (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Settings className="w-5 h-5" />
                    </Button>
                )}
            </SheetTrigger>
            <SheetContent side="right" className="w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Gestión del Debate
                    </SheetTitle>
                    <SheetDescription>
                        Administra participantes y moderación
                    </SheetDescription>
                </SheetHeader>

                <Tabs defaultValue="participants" className="mt-6">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="participants" className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            Participantes
                        </TabsTrigger>
                        <TabsTrigger value="moderation" className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" />
                            Moderación
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="participants" className="mt-4">
                        <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                                Gestiona los roles de los participantes en este debate.
                            </div>
                            <ParticipantList
                                debateId={debateId}
                                currentUserId={currentUserId}
                            />
                        </div>
                    </TabsContent>

                    <TabsContent value="moderation" className="mt-4">
                        <div className="space-y-4">
                            <div className="text-sm text-muted-foreground">
                                Revisa reportes y toma acciones de moderación.
                            </div>
                            <ReportsReviewPanel debateId={debateId} />
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    );
}
