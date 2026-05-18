'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePostItSettings } from '@/context/PostItSettingsContext';
import { Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';

import { toast } from 'sonner';

export default function PostItConfig() {
    const {
        isVisible, setIsVisible,
        visibilityMode, setVisibilityMode,
        allowedPaths, setAllowedPaths,
        colors, setColors,
        snoozeDuration, setSnoozeDuration,
        position, setPosition,
        opacity, setOpacity,
        layout, setLayout,
        daysToHideAfterExpiration, setDaysToHideAfterExpiration
    } = usePostItSettings();

    const [isOpen, setIsOpen] = React.useState(false);

    // Local State to handle changes before saving
    const [localIsVisible, setLocalIsVisible] = React.useState(isVisible);
    const [localVisibilityMode, setLocalVisibilityMode] = React.useState(visibilityMode);
    const [localAllowedPaths, setLocalAllowedPaths] = React.useState<string[]>(allowedPaths);
    const [localOpacity, setLocalOpacity] = React.useState(opacity);
    const [localSnoozeDuration, setLocalSnoozeDuration] = React.useState(snoozeDuration);
    const [localPosition, setLocalPosition] = React.useState(position);
    const [localLayout, setLocalLayout] = React.useState(layout);
    const [localColors, setLocalColors] = React.useState(colors);
    const [localDaysToHide, setLocalDaysToHide] = React.useState(daysToHideAfterExpiration);

    // Sync from context when context changes (e.g. initial load)
    // Only update if the values are actually different to avoid overwriting ongoing edits (though unlikely given context flow)
    React.useEffect(() => {
        setLocalIsVisible(isVisible);
        setLocalVisibilityMode(visibilityMode);
        setLocalAllowedPaths(allowedPaths);
        setLocalOpacity(opacity);
        setLocalSnoozeDuration(snoozeDuration);
        setLocalPosition(position);
        setLocalLayout(layout);
        setLocalColors(colors);
        setLocalDaysToHide(daysToHideAfterExpiration);
    }, [isVisible, visibilityMode, allowedPaths, opacity, snoozeDuration, position, layout, colors, daysToHideAfterExpiration]);

    const handleSave = () => {
        setIsVisible(localIsVisible);
        setVisibilityMode(localVisibilityMode);
        setAllowedPaths(localAllowedPaths);
        setOpacity(localOpacity);
        setSnoozeDuration(localSnoozeDuration);
        setPosition(localPosition);
        setLayout(localLayout);
        setColors(localColors);
        setDaysToHideAfterExpiration(localDaysToHide);

        toast.success("Configuración guardada correctamente");
        setIsOpen(false);
    };

    const handleColorChange = (key: keyof typeof colors, value: string) => {
        setLocalColors({ ...localColors, [key]: value });
    };

    // Predefined color palettes
    const colorOptions = [
        { label: 'Rojo Suave', value: 'bg-red-200 dark:bg-red-300' },
        { label: 'Verde Suave', value: 'bg-green-200 dark:bg-green-300' },
        { label: 'Azul Suave', value: 'bg-blue-200 dark:bg-blue-300' },
        { label: 'Amarillo Suave', value: 'bg-[#fef3c7] dark:bg-[#fcd34d]' },
        { label: 'Naranja Suave', value: 'bg-orange-200 dark:bg-orange-300' },
        { label: 'Violeta Suave', value: 'bg-violet-200 dark:bg-violet-300' },
        { label: 'Rosa Suave', value: 'bg-pink-200 dark:bg-pink-300' },
        { label: 'Gris Suave', value: 'bg-gray-200 dark:bg-gray-300' },
    ];

    return (
        <Card className="w-full">
            <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Settings2 className="w-4 h-4" />
                            Configurar Post-its
                        </CardTitle>
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="w-9 p-0">
                                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                <span className="sr-only">Toggle</span>
                            </Button>
                        </CollapsibleTrigger>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0">
                        {/* Visibility Configuration */}
                        <div className="space-y-3">
                            <Label>Visibilidad</Label>
                            <Select
                                value={localIsVisible ? localVisibilityMode : 'hidden'}
                                onValueChange={(v) => {
                                    if (v === 'hidden') {
                                        setLocalIsVisible(false);
                                    } else {
                                        setLocalIsVisible(true);
                                        setLocalVisibilityMode(v as 'all' | 'custom');
                                    }
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona visibilidad" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Mostrar siempre</SelectItem>
                                    <SelectItem value="custom">Personalizar (Solo en...)</SelectItem>
                                    <SelectItem value="hidden">Ocultar completamente</SelectItem>
                                </SelectContent>
                            </Select>

                            {localIsVisible && localVisibilityMode === 'custom' && (
                                <div className="space-y-2 pt-2 border-l-2 border-slate-200 pl-3 ml-1">
                                    <Label className="text-xs text-muted-foreground">Mostrar solo en:</Label>
                                    {[
                                        { path: '/', label: 'Inicio (Home)' },
                                        { path: '/journal', label: 'Diario' },
                                        { path: '/apps/debate', label: 'Debate' },
                                        { path: '/apps/mi-hogar', label: 'Mi Quioba (Resumen)' },
                                        { path: '/apps/mi-hogar/tasks', label: 'Tareas' },
                                        { path: '/apps/mi-hogar/roster', label: 'Turnos / Calendario' },
                                        { path: '/apps/mi-hogar/shopping', label: 'Lista de la Compra' },
                                        { path: '/apps/mi-hogar/savings', label: 'Mi Economía' },
                                        { path: '/apps/mi-hogar/expenses', label: 'Gastos Compartidos' },
                                        { path: '/apps/mi-hogar/garage', label: 'Garaje' },
                                        { path: '/apps/mi-hogar/pharmacy', label: 'Farmacia' },
                                        { path: '/apps/mi-hogar/recipes', label: 'Recetas' },
                                        { path: '/apps/mi-hogar/documents', label: 'Documentos' },
                                        { path: '/apps/mi-hogar/passwords', label: 'Contraseñas' },
                                        { path: '/apps/mi-hogar/manuals', label: 'Manuales' },
                                        { path: '/apps/mi-hogar/warranties', label: 'Garantías' },
                                        { path: '/apps/mi-hogar/insurance', label: 'Seguros' },
                                    ].map((app) => (
                                        <div key={app.path} className="flex items-center space-x-2">
                                            <Switch
                                                id={`app-${app.path}`}
                                                checked={localAllowedPaths.includes(app.path)}
                                                onCheckedChange={(checked) => {
                                                    if (checked) {
                                                        setLocalAllowedPaths((prev) => [...prev, app.path]);
                                                    } else {
                                                        setLocalAllowedPaths((prev) => prev.filter((p) => p !== app.path));
                                                    }
                                                }}
                                                className="scale-75"
                                            />
                                            <Label htmlFor={`app-${app.path}`} className="text-sm font-normal cursor-pointer">
                                                {app.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Opacity */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Opacidad</Label>
                                <span className="text-xs text-muted-foreground">{Math.round(localOpacity * 100)}%</span>
                            </div>
                            <Slider
                                value={[localOpacity]}
                                min={0.1}
                                max={1}
                                step={0.05}
                                onValueChange={(vals) => setLocalOpacity(vals[0])}
                            />
                        </div>

                        {/* Snooze Duration */}
                        <div className="space-y-2">
                            <Label>Tiempo de "Snooze" (al cerrar)</Label>
                            <Select
                                value={localSnoozeDuration.toString()}
                                onValueChange={(v) => setLocalSnoozeDuration(parseInt(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona duración" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1">1 minuto</SelectItem>
                                    <SelectItem value="3">3 minutos</SelectItem>
                                    <SelectItem value="5">5 minutos</SelectItem>
                                    <SelectItem value="10">10 minutos</SelectItem>
                                    <SelectItem value="30">30 minutos</SelectItem>
                                    <SelectItem value="60">1 hora</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Position */}
                        <div className="space-y-2">
                            <Label>Posición en pantalla</Label>
                            <Select
                                value={localPosition}
                                onValueChange={(v: any) => setLocalPosition(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona posición" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="top-left">Arriba Izquierda</SelectItem>
                                    <SelectItem value="top-center">Arriba Centro</SelectItem>
                                    <SelectItem value="top-right">Arriba Derecha</SelectItem>
                                    <SelectItem value="bottom-left">Abajo Izquierda</SelectItem>
                                    <SelectItem value="bottom-center">Abajo Centro</SelectItem>
                                    <SelectItem value="bottom-right">Abajo Derecha</SelectItem>
                                    <SelectItem value="center">Centro</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Layout */}
                        <div className="space-y-2">
                            <Label>Disposición</Label>
                            <Select
                                value={localLayout}
                                onValueChange={(v: any) => setLocalLayout(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona disposición" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="vertical">Vertical (Columna)</SelectItem>
                                    <SelectItem value="horizontal">Horizontal (Fila)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Expiration Configuration */}
                        <div className="space-y-2">
                            <Label>Ocultar caducadas tras</Label>
                            <Select
                                value={localDaysToHide.toString()}
                                onValueChange={(v) => setLocalDaysToHide(parseInt(v))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona días" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Inmediatamente (0 días)</SelectItem>
                                    <SelectItem value="1">1 día</SelectItem>
                                    <SelectItem value="3">3 días</SelectItem>
                                    <SelectItem value="7">1 semana</SelectItem>
                                    <SelectItem value="30">1 mes</SelectItem>
                                    <SelectItem value="-1">Nunca (Siempre visibles)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                Las tareas caducadas desaparecerán de los post-its después de este tiempo.
                            </p>
                        </div>

                        {/* Colors */}
                        <div className="space-y-3 pt-2 border-t">
                            <Label className="text-xs font-semibold uppercase text-muted-foreground">Colores por Estado</Label>

                            <div className="grid grid-cols-1 gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Caducada</Label>
                                    <Select value={localColors.overdue} onValueChange={(v) => handleColorChange('overdue', v)}>
                                        <SelectTrigger className="h-8">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-full border ${localColors.overdue.split(' ')[0]}`} />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colorOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full border ${opt.value.split(' ')[0]}`} />
                                                        {opt.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Para mañana</Label>
                                    <Select value={localColors.tomorrow} onValueChange={(v) => handleColorChange('tomorrow', v)}>
                                        <SelectTrigger className="h-8">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-full border ${localColors.tomorrow.split(' ')[0]}`} />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colorOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full border ${opt.value.split(' ')[0]}`} />
                                                        {opt.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Menos de 1 semana</Label>
                                    <Select value={localColors.upcoming} onValueChange={(v) => handleColorChange('upcoming', v)}>
                                        <SelectTrigger className="h-8">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-full border ${localColors.upcoming.split(' ')[0]}`} />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colorOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full border ${opt.value.split(' ')[0]}`} />
                                                        {opt.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs">Más de 1 semana</Label>
                                    <Select value={localColors.future} onValueChange={(v) => handleColorChange('future', v)}>
                                        <SelectTrigger className="h-8">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-4 h-4 rounded-full border ${localColors.future.split(' ')[0]}`} />
                                                <SelectValue />
                                            </div>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {colorOptions.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3 h-3 rounded-full border ${opt.value.split(' ')[0]}`} />
                                                        {opt.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-4 mt-2">
                            <Button className="w-full" onClick={handleSave}>
                                Guardar Cambios
                            </Button>
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
