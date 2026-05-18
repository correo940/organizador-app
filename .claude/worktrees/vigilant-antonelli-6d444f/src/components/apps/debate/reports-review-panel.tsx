import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Report {
    id: string;
    message_id: string;
    reported_by: string;
    reason: string;
    status: 'pending' | 'reviewed' | 'dismissed';
    created_at: string;
    message: {
        content: string;
        sender_id: string;
        sender: {
            full_name: string;

        };
    };
}

interface ReportsReviewPanelProps {
    debateId: string;
}

export function ReportsReviewPanel({ debateId }: ReportsReviewPanelProps) {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchReports();

        // Subscribe to new reports
        const subscription = supabase
            .channel(`debate_reports:${debateId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'debate_reports',
                filter: `debate_id=eq.${debateId}`,
            }, () => {
                fetchReports();
            })
            .subscribe();

        return () => {
            subscription.unsubscribe();
        };
    }, [debateId]);

    const fetchReports = async () => {
        try {
            setLoading(true);

            const { data, error } = await supabase
                .from('debate_reports')
                .select(`
                    *,
                    message:debate_messages(
                        content,
                        sender_id
                    )
                `)
                .eq('debate_id', debateId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            let finalReports = (data || []) as any[];

            // Extract sender IDs
            const senderIds = new Set<string>();
            finalReports.forEach(r => {
                if (r.message?.sender_id) senderIds.add(r.message.sender_id);
            });

            if (senderIds.size > 0) {
                const { data: profiles } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', Array.from(senderIds));

                const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

                finalReports = finalReports.map(r => ({
                    ...r,
                    message: r.message ? {
                        ...r.message,
                        sender: profileMap.get(r.message.sender_id) || { full_name: 'Desconocido' }
                    } : null
                }));
            }

            setReports(finalReports);

            if (error) throw error;

            setReports(data || []);
        } catch (error) {
            console.error('Error fetching reports:', error);
            toast.error('Error al cargar reportes');
        } finally {
            setLoading(false);
        }
    };

    const handleReviewReport = async (
        reportId: string,
        action: string,
        durationMinutes?: number
    ) => {
        setProcessing(reportId);

        try {
            const { data, error } = await supabase.rpc('review_report', {
                p_report_id: reportId,
                p_action: action,
                p_duration_minutes: durationMinutes,
            });

            if (error) throw error;

            if (data?.success) {
                toast.success('Acción ejecutada correctamente');
                fetchReports();
            } else {
                throw new Error(data?.error || 'Error al procesar reporte');
            }
        } catch (error: any) {
            console.error('Error reviewing report:', error);
            toast.error('Error al procesar reporte', {
                description: error.message,
            });
        } finally {
            setProcessing(null);
        }
    };

    const pendingReports = reports.filter(r => r.status === 'pending');
    const reviewedReports = reports.filter(r => r.status !== 'pending');

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Pending Reports */}
            <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                    Reportes Pendientes ({pendingReports.length})
                </h3>

                {pendingReports.length === 0 ? (
                    <Card className="p-6 text-center text-muted-foreground">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        No hay reportes pendientes
                    </Card>
                ) : (
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                            {pendingReports.map((report) => (
                                <Card key={report.id} className="p-4">
                                    {/* Report header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium">
                                                Usuario: {report.message?.sender?.full_name || 'Desconocido'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {formatDistanceToNow(new Date(report.created_at), {
                                                    addSuffix: true,
                                                    locale: es,
                                                })}
                                            </p>
                                        </div>
                                        <Badge variant="destructive" className="ml-2">
                                            Pendiente
                                        </Badge>
                                    </div>

                                    {/* Reported message */}
                                    <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg mb-3">
                                        <p className="text-xs text-muted-foreground mb-1">Mensaje reportado:</p>
                                        <p className="text-sm">{report.message?.content}</p>
                                    </div>

                                    {/* Reason */}
                                    <div className="mb-3">
                                        <p className="text-xs text-muted-foreground mb-1">Motivo:</p>
                                        <p className="text-sm">{report.reason}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleReviewReport(report.id, 'warning')}
                                            disabled={processing === report.id}
                                        >
                                            Advertir
                                        </Button>

                                        <Select
                                            onValueChange={(value) => {
                                                const minutes = parseInt(value);
                                                handleReviewReport(report.id, 'mute', minutes);
                                            }}
                                            disabled={processing === report.id}
                                        >
                                            <SelectTrigger className="w-[110px] h-9">
                                                <SelectValue placeholder="Silenciar" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5 minutos</SelectItem>
                                                <SelectItem value="15">15 minutos</SelectItem>
                                                <SelectItem value="60">1 hora</SelectItem>
                                                <SelectItem value="1440">1 día</SelectItem>
                                                <SelectItem value="0">Permanente</SelectItem>
                                            </SelectContent>
                                        </Select>

                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            onClick={() => handleReviewReport(report.id, 'ban')}
                                            disabled={processing === report.id}
                                        >
                                            Banear
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleReviewReport(report.id, 'delete')}
                                            disabled={processing === report.id}
                                        >
                                            Eliminar Mensaje
                                        </Button>

                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleReviewReport(report.id, 'dismiss')}
                                            disabled={processing === report.id}
                                        >
                                            Desestimar
                                        </Button>
                                    </div>

                                    {processing === report.id && (
                                        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Procesando...
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                )}
            </div>

            {/* Reviewed Reports */}
            {reviewedReports.length > 0 && (
                <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                        Historial ({reviewedReports.length})
                    </h3>
                    <ScrollArea className="h-[200px]">
                        <div className="space-y-2">
                            {reviewedReports.map((report) => (
                                <Card key={report.id} className="p-3 opacity-70">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm">
                                                {report.message?.sender?.full_name || 'Desconocido'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{report.reason}</p>
                                        </div>
                                        <Badge variant={report.status === 'reviewed' ? 'default' : 'secondary'}>
                                            {report.status === 'reviewed' ? 'Revisado' : 'Desestimado'}
                                        </Badge>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </ScrollArea>
                </div>
            )}
        </div>
    );
}
