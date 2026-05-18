'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import RosterCalendar from '@/components/apps/mi-hogar/roster/roster-calendar';
import AddShiftDialog from '@/components/apps/mi-hogar/roster/add-shift-dialog';
import ScanRosterDialog from '@/components/apps/mi-hogar/roster/scan-roster-dialog';

export default function RosterPage() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isScanOpen, setIsScanOpen] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleShiftAdded = () => {
        setRefreshKey(prev => prev + 1);
        setIsAddOpen(false);
        setIsScanOpen(false);
    };

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-nav">
            <div className="max-w-6xl mx-auto space-y-6">
                <header className="flex items-center space-x-4 mb-6 print:hidden">
                    <Link href="/apps/mi-hogar">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="w-6 h-6" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Cuadrante</h1>
                        <p className="text-muted-foreground">Gestiona tus turnos de trabajo</p>
                    </div>
                </header>

                <RosterCalendar
                    onAddClick={() => setIsAddOpen(true)}
                    onScanClick={() => setIsScanOpen(true)}
                    refreshTrigger={refreshKey}
                />

                <AddShiftDialog
                    open={isAddOpen}
                    onOpenChange={setIsAddOpen}
                    onSuccess={handleShiftAdded}
                />

                <ScanRosterDialog
                    open={isScanOpen}
                    onOpenChange={setIsScanOpen}
                    onSuccess={handleShiftAdded}
                />
            </div>
        </div>
    );
}
