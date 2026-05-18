'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ScanLine, ChevronLeft, ChevronRight, Users, ClipboardList, Trash2, Settings, MapPin, PieChart, Printer } from 'lucide-react';
import { es } from 'date-fns/locale';
import { supabase } from '@/lib/supabase';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    addMonths,
    subMonths,
    isSameMonth,
    isSameDay,
    isToday
} from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import '@/app/globals.css'; // Ensure print styles are available if added there, but we will use tailwind classes mainly.
import BulkImportDialog from './bulk-import-dialog';
import HolidaySettingsDialog from './holiday-settings-dialog';
import RosterStatisticsDialog from './roster-statistics-dialog';
import ShiftSettingsDialog from './shift-settings-dialog';
import { fetchHolidays, PublicHoliday } from '@/lib/holidays';

interface WorkShift {
    id: string;
    start_time: string;
    end_time: string;
    title: string;
    description?: string;
    color?: string;
    style?: string;
}

interface RosterCalendarProps {
    onAddClick: () => void;
    onScanClick: () => void;
    refreshTrigger: number;
}

export default function RosterCalendar({ onAddClick, onScanClick, refreshTrigger }: RosterCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [shifts, setShifts] = useState<WorkShift[]>([]);
    const [selectedDayShifts, setSelectedDayShifts] = useState<WorkShift[] | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
    const [holidayRegion, setHolidayRegion] = useState('');

    // New Features States

    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [isHolidaySettingsOpen, setIsHolidaySettingsOpen] = useState(false);
    const [isStatsOpen, setIsStatsOpen] = useState(false);
    const [isShiftSettingsOpen, setIsShiftSettingsOpen] = useState(false);

    useEffect(() => {
        fetchShifts();
    }, [refreshTrigger, currentDate]);

    // Handle Escape key for fullscreen


    useEffect(() => {
        const loadHolidays = async () => {
            const region = localStorage.getItem('holiday_region_es') || '';
            setHolidayRegion(region);

            // Calculate grid range to know which years to fetch
            const viewStart = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
            const viewEnd = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });

            const startYear = viewStart.getFullYear();
            const endYear = viewEnd.getFullYear();
            const yearsToFetch = Array.from(new Set([startYear, endYear])); // Unique years

            try {
                const promises = yearsToFetch.map(y => fetchHolidays(y, region === 'ALL' ? undefined : region));
                const results = await Promise.all(promises);
                let allHolidays = results.flat();

                // Load custom holidays
                const savedCustom = localStorage.getItem('custom_holidays_es');
                if (savedCustom) {
                    try {
                        const customs: any[] = JSON.parse(savedCustom);
                        // For each year we are fetching, add the custom holidays
                        yearsToFetch.forEach(year => {
                            const mappedCustoms = customs.map(c => {
                                // Simple date construction YYYY-MM-DD
                                const dateStr = `${year}-${c.month.toString().padStart(2, '0')}-${c.day.toString().padStart(2, '0')}`;
                                return {
                                    id: `custom-${year}-${c.id}`,
                                    startDate: dateStr,
                                    endDate: dateStr,
                                    type: "Local",
                                    name: [{ text: c.name, language: "es" }],
                                    nationwide: false,
                                    isCustom: true // Optional marker
                                };
                            });
                            allHolidays = [...allHolidays, ...mappedCustoms];
                        });
                    } catch (e) {
                        console.error("Error loading custom holidays", e);
                    }
                }

                setHolidays(allHolidays);
            } catch (error) {
                console.error("Error loading holidays", error);
            }
        };
        loadHolidays();
    }, [currentDate, holidayRegion]); // Re-fetch on date or region change

    const fetchShifts = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;

        // Fetch range: First day of start week - Last day of end week
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });

        const { data, error } = await supabase
            .from('work_shifts')
            .select('*')
            .eq('user_id', session.user.id)
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString());

        if (data) {
            setShifts(data);
        }
    };

    const handleDelete = async (id: string) => {
        const { error } = await supabase.from('work_shifts').delete().eq('id', id);
        if (!error) {
            fetchShifts();
            setIsDetailOpen(false);
        }
    };

    const handleClearMonth = async () => {
        const start = startOfMonth(currentDate);
        const end = endOfMonth(currentDate);

        // Delete shifts strictly within this month
        // We use >= start AND <= end of month to only clear the viewed month.
        const { error } = await supabase.from('work_shifts')
            .delete()
            .gte('start_time', start.toISOString())
            .lte('start_time', end.toISOString())
            .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

        if (error) {
            console.error("Error clearing month:", error);
        } else {
            fetchShifts();
            setIsDeleteAlertOpen(false);
        }
    };

    // Calendar Generation
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = eachDayOfInterval({
        start: startDate,
        end: endDate
    });

    const totalWeeks = Math.ceil(calendarDays.length / 7);

    const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleDayClick = (day: Date, dayShifts: WorkShift[]) => {
        if (dayShifts.length > 0) {
            setSelectedDayShifts(dayShifts);
            setIsDetailOpen(true);
        }
    };

    // Sub-components for cleaner render
    const CalendarGrid = () => (
        <div className="flex flex-col h-full">
            {/* Weekday Header */}
            <div className="hidden md:grid grid-cols-7 mb-2 text-center text-sm text-muted-foreground shrink-0 border-b pb-2 print:grid print:border-b-black print:mb-1 print:text-xs print:pb-1">
                {weekDays.map(day => (<div key={day} className="py-2 font-bold text-black print:py-1">{day}</div>))}
            </div>

            {/* Days Grid */}
            <div
                className="grid grid-cols-1 md:grid-cols-7 print:grid-cols-7 gap-y-2 md:gap-px bg-muted/20 md:border rounded-lg overflow-y-auto md:overflow-hidden flex-1 print:gap-0 print:border-black"
            >
                {calendarDays.map((day, idx) => {
                    const dayShifts = shifts.filter(s => isSameDay(new Date(s.start_time), day));
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isTodayDate = isToday(day);

                    const holiday = holidays.find(h => isSameDay(new Date(h.startDate), day));
                    const isHoliday = !!holiday;

                    return (
                        <div
                            key={day.toString()}
                            onClick={() => handleDayClick(day, dayShifts)}
                            className={`
                                min-h-[100px] p-2 relative group transition-colors
                                border border-border/50
                                ${isCurrentMonth ? 'bg-background' : 'bg-muted/10'}
                                ${!isCurrentMonth ? 'hidden md:block' : ''}
                                ${isTodayDate ? 'bg-accent/5' : ''}
                                hover:bg-accent/5 cursor-pointer
                                flex flex-col justify-start gap-2 overflow-hidden
                                print:border-black print:bg-white print:min-h-[90px] print:p-1 print:break-inside-avoid
                            `}
                        >
                            {/* Date Number */}

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className={`
                                            text-sm font-bold h-8 w-8 flex items-center justify-center rounded-full shrink-0
                                            ${isTodayDate ? 'bg-primary text-primary-foreground' : (isHoliday ? 'text-red-500 bg-red-50' : 'text-foreground/70')}
                                        `}>
                                            {format(day, 'd')}
                                            <span className="md:hidden ml-2 text-xs font-normal text-muted-foreground opacity-70">
                                                {format(day, 'EEE', { locale: es })}
                                            </span>
                                        </div>
                                    </TooltipTrigger>
                                    {isHoliday && (
                                        <TooltipContent className="flex flex-col gap-1 text-center">
                                            <p className="font-semibold text-sm">{holiday?.name[0].text}</p>
                                            <Badge variant={holiday?.nationwide ? "default" : "secondary"} className="text-[10px] h-5 px-1.5 w-fit mx-auto">
                                                {holiday?.nationwide ? "Festivo Nacional" : "Festivo Autonómico"}
                                            </Badge>
                                        </TooltipContent>
                                    )}
                                </Tooltip>
                            </TooltipProvider>

                            {/* Shifts */}
                            <div className="flex-1 w-full space-y-1.5 mt-1 overflow-y-auto no-scrollbar min-h-0">
                                {dayShifts.map((shift) => {
                                    const isDotStyle = shift.style === 'dot';

                                    return (
                                        <div
                                            key={shift.id}
                                            className={`
                                                text-xs rounded-md truncate flex items-center gap-1.5 print:whitespace-normal print:overflow-visible print:h-auto print:flex-col print:items-start print:gap-0.5
                                                ${isDotStyle ? 'bg-transparent px-1 py-0.5' : 'px-2 py-1.5 border shadow-sm'}
                                            `}
                                            style={!isDotStyle ? {
                                                backgroundColor: shift.color ? `${shift.color}20` : '#e2e8f0',
                                                borderColor: shift.color ? `${shift.color}40` : '#cbd5e1',
                                                color: shift.color ? shift.color : 'inherit',
                                                pageBreakInside: 'avoid'
                                            } : {}}
                                        >
                                            <div className="flex items-center gap-1.5 w-full">
                                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: shift.color || 'gray' }} />
                                                <span className={`font-semibold truncate flex-1 print:whitespace-normal print:text-[10px] print:leading-tight ${isDotStyle ? 'text-foreground' : ''}`}>
                                                    {shift.title.replace('Turno: ', '')}
                                                </span>
                                                {shift.description && <Users className="w-3 h-3 opacity-50 shrink-0 print:hidden" />}
                                            </div>

                                            {shift.description && !isDotStyle && (
                                                <span className="hidden print:block text-[9px] opacity-80 pl-3 leading-tight mt-0.5">
                                                    {shift.description}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const HeaderControls = () => (
        <div className="flex flex-col md:flex-row items-center justify-between p-4 space-y-4 md:space-y-0 bg-background/50 backdrop-blur-sm shrink-0 print:hidden">
            <div className="flex items-center space-x-4">
                <Button variant="outline" size="icon" onClick={prevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="flex flex-col items-center">
                    <h2 className="text-xl font-bold capitalize w-48 text-center select-none">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground hover:text-destructive"
                        onClick={() => setIsDeleteAlertOpen(true)}
                    >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Borrar Mes
                    </Button>
                </div>
                <Button variant="outline" size="icon" onClick={nextMonth}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex gap-2 w-full md:w-auto items-center">
                <Button variant="ghost" size="icon" onClick={() => setIsStatsOpen(true)} title="Estadísticas">
                    <PieChart className="h-5 w-5 text-muted-foreground" />
                </Button>

                <Button variant="ghost" size="icon" onClick={() => setIsHolidaySettingsOpen(true)} title="Configurar Festivos">
                    <MapPin className={`h-5 w-5 ${holidayRegion ? 'text-green-600' : 'text-muted-foreground'}`} />
                </Button>

                <Button variant="ghost" size="icon" onClick={() => setIsShiftSettingsOpen(true)} title="Configurar Turnos">
                    <Settings className={`h-5 w-5 ${isShiftSettingsOpen ? 'text-primary' : 'text-muted-foreground'}`} />
                </Button>

                <Button variant="ghost" size="icon" onClick={() => window.print()} title="Imprimir / Guardar PDF">
                    <Printer className="h-5 w-5 text-muted-foreground" />
                </Button>



                <div className="h-6 w-px bg-border hidden md:block mx-1" />

                <Button variant="outline" size="sm" onClick={() => setIsBulkImportOpen(true)} className="flex-1 md:flex-none text-xs">
                    <ClipboardList className="mr-2 h-3.5 w-3.5" />
                    Insertar Cuadrante
                </Button>

                <Button variant="outline" size="sm" className="flex-1 md:flex-none text-xs" onClick={onScanClick}>
                    <ScanLine className="mr-2 h-3.5 w-3.5" />
                    Escanea tu turno
                </Button>
                <Button size="sm" className="flex-1 md:flex-none text-xs" onClick={onAddClick}>
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Añadir turno
                </Button>
            </div>
        </div>
    );

    function renderShiftDetailsDialog() {
        return (
            <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detalles del Turno</DialogTitle>
                        <DialogDescription>
                            {selectedDayShifts && selectedDayShifts.length > 0 && format(new Date(selectedDayShifts[0].start_time), "EEEE, d 'de' MMMM", { locale: es })}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {selectedDayShifts?.map(shift => (
                            <div key={shift.id} className="p-4 rounded-lg border bg-card">
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-bold text-lg">{shift.title}</h3>
                                    <Badge variant="outline">
                                        {format(new Date(shift.start_time), 'HH:mm')} - {format(new Date(shift.end_time), 'HH:mm')}
                                    </Badge>
                                </div>

                                {shift.description && (
                                    <div className="mb-4 text-sm text-muted-foreground bg-muted/50 p-3 rounded flex items-start gap-2">
                                        <Users className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>{shift.description}</span>
                                    </div>
                                )}

                                <div className="flex justify-end pt-2 border-t">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(shift.id)}
                                        className="h-8"
                                    >
                                        Eliminar Turno
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDetailOpen(false)}>Cerrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }
    // Vista de Impresión Elegante y Compacta (Una sola página)
    const PrintView = () => (
        <div className="hidden print:flex flex-col w-full h-screen bg-white text-slate-800 p-0 overflow-hidden">
            {/* Cabecera Compacta */}
            <div className="flex justify-between items-end mb-4 border-b border-slate-200 pb-2">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-slate-900 capitalize leading-none">
                        {format(currentDate, 'MMMM yyyy', { locale: es })}
                    </h1>
                    <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-medium">Cuadrante de Turnos</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-slate-400">Quioba</span>
                </div>
            </div>

            {/* Grid Principal - Flex Grow para ocupar el espacio restante equitativamente */}
            <div className="flex flex-col flex-1 border border-slate-200 rounded-lg overflow-hidden">
                {/* Header Días */}
                <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
                    {weekDays.map(day => (
                        <div key={day} className="py-1.5 text-center text-[10px] font-bold uppercase text-slate-600 tracking-wider border-r border-slate-200 last:border-r-0">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Cuerpo del Calendario */}
                <div className="flex-1 grid grid-cols-7 grid-rows-[repeat(auto-fill,minmax(0,1fr))]" style={{ gridTemplateRows: `repeat(${totalWeeks}, 1fr)` }}>
                    {calendarDays.map((day, idx) => {
                        const dayShifts = shifts.filter(s => isSameDay(new Date(s.start_time), day));
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const holiday = holidays.find(h => isSameDay(new Date(h.startDate), day));
                        // isToday is imported
                        const isTodayDate = isToday(day);

                        // Determinar bordes (la última columna no lleva borde derecho, la última fila no lleva borde inferior idealmente, pero grid lo maneja)
                        const isLastCol = (idx + 1) % 7 === 0;
                        // Simplificación de bordes para grid: border-r y border-b en cada celda

                        return (
                            <div
                                key={`print-${day.toString()}`}
                                className={`
                                    border-b border-slate-200 p-1.5 relative flex flex-col gap-1
                                    ${!isLastCol ? 'border-r' : ''}
                                    ${!isCurrentMonth ? 'bg-slate-50/40 text-slate-400' : 'bg-white text-slate-700'}
                                `}
                            >
                                {/* Número y Festivo */}
                                <div className="flex justify-between items-start">
                                    <span className={`text-xs font-semibold leading-none ${isTodayDate ? 'text-slate-900' : (holiday ? 'text-red-500' : '')}`}>
                                        {format(day, 'd')}
                                    </span>
                                    {holiday && (
                                        <span className="text-[8px] text-red-500 font-medium text-right leading-none max-w-[65px] truncate">
                                            {holiday.name[0].text}
                                        </span>
                                    )}
                                </div>

                                {/* Lista de Turnos - Compacta */}
                                <div className="space-y-1">
                                    {dayShifts.map(shift => (
                                        <div key={shift.id} className="flex flex-col relative pl-1.5">
                                            {/* Indicador visual de color */}
                                            <div
                                                className="absolute left-0 top-0.5 bottom-0.5 w-0.5 rounded-full"
                                                style={{ backgroundColor: shift.color || '#334155' }}
                                            />
                                            <span className="text-[9px] font-bold leading-tight">
                                                {format(new Date(shift.start_time), 'HH:mm')}-{format(new Date(shift.end_time), 'HH:mm')}
                                            </span>
                                            <span className="text-[9px] leading-tight truncate opacity-90">
                                                {shift.title.replace('Turno: ', '')}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );

    // Standard Render
    return (
        <>
            <PrintView />

            <Card className="print:hidden h-full border-none shadow-none md:border md:shadow-sm flex flex-col bg-transparent md:bg-card">
                <HeaderControls />
                <CardContent className="p-0 md:p-4 flex-1 overflow-hidden">
                    <CalendarGrid />
                </CardContent>

                <BulkImportDialog
                    open={isBulkImportOpen}
                    onOpenChange={setIsBulkImportOpen}
                    onSuccess={fetchShifts}
                />

                <HolidaySettingsDialog
                    open={isHolidaySettingsOpen}
                    onOpenChange={setIsHolidaySettingsOpen}
                    onRegionChange={setHolidayRegion}
                />

                <RosterStatisticsDialog
                    open={isStatsOpen}
                    onOpenChange={setIsStatsOpen}
                    currentMonthShifts={shifts.filter(s => {
                        const d = new Date(s.start_time);
                        return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
                    })}
                    currentMonthDate={currentDate}
                />

                {renderShiftDetailsDialog()}


                <BulkImportDialog
                    open={isBulkImportOpen}
                    onOpenChange={setIsBulkImportOpen}
                    onSuccess={fetchShifts}
                />

                <HolidaySettingsDialog
                    open={isHolidaySettingsOpen}
                    onOpenChange={setIsHolidaySettingsOpen}
                    onRegionChange={setHolidayRegion}
                    onSave={() => {
                        // Force re-fetch logic is in useEffect dependency
                        if (currentDate) setCurrentDate(new Date(currentDate));
                    }}
                />

                <ShiftSettingsDialog
                    open={isShiftSettingsOpen}
                    onOpenChange={setIsShiftSettingsOpen}
                />

                <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Borrar todos los turnos de {format(currentDate, 'MMMM', { locale: es })}?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción eliminará todos los turnos visibles en este mes. No se puede deshacer.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleClearMonth} className="bg-destructive hover:bg-destructive/90">
                                Sí, borrar todo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </Card>
        </>
    );
}
