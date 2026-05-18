'use client';

import { useState, useEffect } from 'react';
import TaskManager from '@/components/apps/mi-hogar/tasks/task-manager';
import ScreenshotToTaskDialog from '@/components/apps/mi-hogar/tasks/screenshot-to-task-dialog';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useShareTarget } from '@/context/ShareTargetContext';

export default function MiHogarTasksPage() {
    const [sharedImage, setSharedImage] = useState<string | null>(null);
    const [showSharedDialog, setShowSharedDialog] = useState(false);
    const { consumeSharedImage, sharedImageBase64 } = useShareTarget();

    // Check if there's a shared image when this page mounts
    useEffect(() => {
        if (sharedImageBase64) {
            const img = consumeSharedImage();
            if (img) {
                setSharedImage(img);
                setShowSharedDialog(true);
            }
        }
    }, [sharedImageBase64, consumeSharedImage]);

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-nav">
            <div className="max-w-6xl mx-auto mb-6">
                <Link href="/apps/mi-hogar">
                    <Button variant="ghost" className="pl-0 hover:pl-2 transition-all">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver a Mi Hogar
                    </Button>
                </Link>
                <h1 className="text-2xl md:text-3xl font-bold mt-4">Tareas y Alarmas</h1>
                <p className="text-muted-foreground">Organiza las tareas del hogar y no olvides nada.</p>
            </div>
            <TaskManager />

            {/* Share Target Dialog - opens automatically when image is shared to Quioba */}
            <ScreenshotToTaskDialog
                open={showSharedDialog}
                onOpenChange={(open) => {
                    setShowSharedDialog(open);
                    if (!open) setSharedImage(null);
                }}
                onSuccess={() => {
                    window.location.reload();
                }}
                sharedImageBase64={sharedImage}
            />
        </div>
    );
}
