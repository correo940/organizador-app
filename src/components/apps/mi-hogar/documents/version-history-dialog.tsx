'use client';

import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { History, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { DocumentMetadata } from '@/components/apps/mi-hogar/documents/document-dialog';

type DocumentVersion = {
    id: string;
    document_id: string;
    version_number: number;
    title: string;
    category: string;
    file_url: string;
    file_type?: string | null;
    expiration_date?: string | null;
    tags?: string[];
    notes?: string | null;
    issuer?: string | null;
    summary?: string | null;
    document_type?: string | null;
    metadata?: DocumentMetadata | null;
    lifecycle_status: string;
    created_at: string;
};

interface DocumentVersionHistoryDialogProps {
    documentId: string;
    documentTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRestore?: () => Promise<void> | void;
}

function formatMetadataLabel(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function DocumentVersionHistoryDialog({
    documentId,
    documentTitle,
    open,
    onOpenChange,
    onRestore,
}: DocumentVersionHistoryDialogProps) {
    const [versions, setVersions] = useState<DocumentVersion[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            void fetchVersions();
        }
    }, [open, documentId]);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('document_versions')
                .select('*')
                .eq('document_id', documentId)
                .order('version_number', { ascending: false });

            if (error) {
                console.error('Error fetching document versions:', error);
                return;
            }

            setVersions((data || []) as DocumentVersion[]);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (version: DocumentVersion) => {
        if (!confirm(`Restaurar la version ${version.version_number} de este documento?`)) {
            return;
        }

        try {
            const payload = {
                title: version.title,
                category: version.category,
                file_url: version.file_url,
                file_type: version.file_type || null,
                expiration_date: version.expiration_date || null,
                tags: version.tags || [],
                notes: version.notes || null,
                issuer: version.issuer || null,
                summary: version.summary || null,
                document_type: version.document_type || null,
                metadata: version.metadata || {},
                lifecycle_status: version.lifecycle_status || 'activo',
            };

            const { error } = await supabase
                .from('documents')
                .update(payload)
                .eq('id', documentId);

            if (error) throw error;

            toast.success(`Version ${version.version_number} restaurada`);
            await onRestore?.();
            onOpenChange(false);
        } catch (error) {
            console.error('Error restoring document version:', error);
            toast.error('No se pudo restaurar la version');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-amber-600" />
                        Historial de versiones
                    </DialogTitle>
                    <DialogDescription>
                        Cambios anteriores guardados automaticamente para "{documentTitle}".
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-4">
                    {loading ? (
                        <div className="text-sm text-muted-foreground">Cargando versiones...</div>
                    ) : versions.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                            Aun no hay versiones anteriores. Se crearan automaticamente al editar o renovar el documento.
                        </div>
                    ) : (
                        versions.map((version) => {
                            const expanded = selectedVersionId === version.id;
                            const metadataEntries = Object.entries(version.metadata || {}).filter(([, value]) => value !== null && value !== '');
                            return (
                                <div key={version.id} className="rounded-xl border p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline">v{version.version_number}</Badge>
                                                <Badge variant="secondary">{version.lifecycle_status}</Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDistanceToNow(new Date(version.created_at), { addSuffix: true, locale: es })}
                                                </span>
                                            </div>
                                            <div className="font-medium mt-2">{version.title}</div>
                                            <div className="text-sm text-muted-foreground">{version.category}{version.document_type ? ` · ${version.document_type}` : ''}</div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => setSelectedVersionId(expanded ? null : version.id)}>
                                                <Eye className="h-4 w-4 mr-2" /> {expanded ? 'Ocultar' : 'Ver'}
                                            </Button>
                                            <Button size="sm" onClick={() => void handleRestore(version)}>
                                                <RotateCcw className="h-4 w-4 mr-2" /> Restaurar
                                            </Button>
                                        </div>
                                    </div>

                                    {expanded ? (
                                        <div className="rounded-xl bg-slate-50/70 p-4 space-y-3 text-sm">
                                            {version.summary ? <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Resumen</div><p className="mt-1 whitespace-pre-wrap">{version.summary}</p></div> : null}
                                            {version.notes ? <div><div className="text-xs uppercase tracking-wide text-muted-foreground">Notas</div><p className="mt-1 whitespace-pre-wrap">{version.notes}</p></div> : null}
                                            {metadataEntries.length > 0 ? (
                                                <div>
                                                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Metadatos</div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                                        {metadataEntries.map(([key, value]) => (
                                                            <div key={key} className="rounded-lg border bg-white px-3 py-2">
                                                                <div className="text-xs text-muted-foreground">{formatMetadataLabel(key)}</div>
                                                                <div className="font-medium break-words">{String(value)}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

