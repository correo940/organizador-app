'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { History, RotateCcw, Eye } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Version {
    id: string;
    version_number: number;
    title: string;
    category: string;
    description: string;
    content: string;
    created_at: string;
    change_description?: string;
}

interface VersionHistoryDialogProps {
    manualId: string;
    manualTitle: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRestore?: (version: Version) => void;
}

export function VersionHistoryDialog({ manualId, manualTitle, open, onOpenChange, onRestore }: VersionHistoryDialogProps) {
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);

    useEffect(() => {
        if (open) {
            fetchVersions();
        }
    }, [open]);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('manual_versions')
                .select('*')
                .eq('manual_id', manualId)
                .order('version_number', { ascending: false });

            if (error) {
                console.log('Versions table not available yet');
                return;
            }

            setVersions(data || []);
        } catch (error) {
            console.error('Error fetching versions:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (version: Version) => {
        if (!confirm(`¿Restaurar la versión ${version.version_number}? Esto creará una nueva versión con ese contenido.`)) {
            return;
        }

        try {
            const { error } = await supabase
                .from('manuals')
                .update({
                    title: version.title,
                    category: version.category,
                    description: version.description,
                    content: version.content
                })
                .eq('id', manualId);

            if (error) throw error;

            toast.success(`Versión ${version.version_number} restaurada`);
            onOpenChange(false);
            if (onRestore) onRestore(version);
        } catch (error) {
            console.error('Error restoring version:', error);
            toast.error('Error al restaurar versión');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-5 w-5" />
                        Historial de Versiones
                    </DialogTitle>
                    <DialogDescription>
                        Versiones anteriores de "{manualTitle}"
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                    {loading ? (
                        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
                    ) : versions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <History className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No hay versiones anteriores</p>
                            <p className="text-xs mt-1">Las versiones se guardan automáticamente al editar</p>
                        </div>
                    ) : (
                        versions.map(version => (
                            <div
                                key={version.id}
                                className={`p-4 border rounded-lg transition-colors ${selectedVersion?.id === version.id ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline">v{version.version_number}</Badge>
                                        <span className="text-sm text-muted-foreground">
                                            {formatDistanceToNow(new Date(version.created_at), {
                                                addSuffix: true,
                                                locale: es
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setSelectedVersion(
                                                selectedVersion?.id === version.id ? null : version
                                            )}
                                        >
                                            <Eye className="h-4 w-4 mr-1" />
                                            {selectedVersion?.id === version.id ? 'Ocultar' : 'Ver'}
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleRestore(version)}
                                        >
                                            <RotateCcw className="h-4 w-4 mr-1" />
                                            Restaurar
                                        </Button>
                                    </div>
                                </div>

                                <h4 className="font-medium mb-1">{version.title}</h4>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                    <span>Categoría: {version.category}</span>
                                </div>

                                {version.change_description && (
                                    <p className="text-sm text-muted-foreground mt-2 italic">
                                        {version.change_description}
                                    </p>
                                )}

                                {/* Expandable content preview */}
                                {selectedVersion?.id === version.id && (
                                    <div className="mt-3 p-3 bg-muted rounded-md space-y-2">
                                        <div>
                                            <span className="text-xs font-semibold uppercase text-muted-foreground">Descripción:</span>
                                            <p className="text-sm mt-1">{version.description || 'Sin descripción'}</p>
                                        </div>
                                        <div>
                                            <span className="text-xs font-semibold uppercase text-muted-foreground">Vista previa del contenido:</span>
                                            <p className="text-sm mt-1 line-clamp-4">
                                                {(() => {
                                                    try {
                                                        if (version.content.startsWith('{')) {
                                                            const parsed = JSON.parse(version.content);
                                                            return parsed.text || 'Contenido multimedia (ver manual completo)';
                                                        }
                                                        return version.content.substring(0, 200) + (version.content.length > 200 ? '...' : '');
                                                    } catch {
                                                        return version.content.substring(0, 200) + (version.content.length > 200 ? '...' : '');
                                                    }
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))
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
