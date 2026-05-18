'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    ArrowLeft,
    ArrowUpDown,
    AlertTriangle,
    Bell,
    BellRing,
    Building2,
    CalendarClock,
    Clock3,
    Download,
    ExternalLink,
    Eye,
    FileBadge2,
    FileText,
    Files,
    Flag,
    History,
    Lock,
    NotebookPen,
    RefreshCcw,
    ScrollText,
    Search,
    Settings,
    Shield,
    ShieldCheck,
    Sparkles,
    Star,
    Tags,
    Trash2,
    Home,
    ShoppingBag,
    Plus,
    LayoutGrid,
    HeartPulse,
    Wallet,
    Activity,
    UserCircle,
    Car,
    FileSignature,
    Clock,
    CheckCircle2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { nanoid } from 'nanoid';
import Link from 'next/link';
import { differenceInDays, format, parseISO, startOfDay, subDays } from 'date-fns';
import dynamic from 'next/dynamic';
import type { DocumentAnalysisResult, DocumentForm, DocumentMetadata } from '@/components/apps/mi-hogar/documents/document-dialog';
import type { DocumentReminder } from '@/components/apps/mi-hogar/documents/reminder-dialog';

const DocumentDialog = dynamic(() => import('@/components/apps/mi-hogar/documents/document-dialog').then(mod => mod.DocumentDialog), { ssr: false });
const DocumentReminderDialog = dynamic(() => import('@/components/apps/mi-hogar/documents/reminder-dialog').then(mod => mod.DocumentReminderDialog), { ssr: false });
const DocumentVersionHistoryDialog = dynamic(() => import('@/components/apps/mi-hogar/documents/version-history-dialog').then(mod => mod.DocumentVersionHistoryDialog), { ssr: false });
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetFooter,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { getApiUrl } from '@/lib/api-utils';

type SecureDocument = {
    id: string;
    title: string;
    category: string;
    expiration_date?: string | null;
    file_url: string;
    file_type?: string | null;
    is_favorite: boolean;
    created_at: string;
    updated_at?: string;
    tags?: string[];
    notes?: string | null;
    issuer?: string | null;
    summary?: string | null;
    document_type?: string | null;
    metadata?: DocumentMetadata | null;
    lifecycle_status: string;
    renewal_of?: string | null;
    is_secure?: boolean;
};

type SortOption = 'recent' | 'title' | 'expiry';
type DocumentStateTone = 'muted' | 'active' | 'warning' | 'expired';
type AlertSeverity = 'high' | 'medium' | 'low';
type AlertType = 'expiring' | 'expired' | 'missing_expiration' | 'missing_back' | 'lifecycle' | 'reminder';

type DocumentAlert = {
    id: string;
    documentId: string;
    documentTitle: string;
    title: string;
    description: string;
    severity: AlertSeverity;
    dueDate?: string | null;
    category: string;
    type: AlertType;
};

type DocumentAlertSettings = {
    expiring: boolean;
    expired: boolean;
    missing_expiration: boolean;
    missing_back: boolean;
    lifecycle: boolean;
    reminder: boolean;
    sync_to_tasks: boolean;
};

const DOCUMENTS_BUCKET = 'secure-docs';
const DOCUMENT_SETTINGS_KEY = 'quioba_document_alert_settings_v1';
const STORAGE_UPLOAD_TIMEOUT_MS = 45000;
const STORAGE_NOT_FOUND_MARKERS = ['not found', 'bucket not found', 'object not found'];
const CATEGORIES = ['Todos', 'Identidad', 'Vehiculo', 'Seguro', 'Hogar', 'Salud', 'Finanzas'];
const SMART_VIEWS = ['Todos', 'Urgentes', 'Caducados', 'Favoritos', 'Pendientes'];

const CATEGORY_ICONS: Record<string, any> = {
    'Todos': LayoutGrid,
    'Identidad': UserCircle,
    'Vehiculo': Car,
    'Seguro': ShieldCheck,
    'Hogar': Home,
    'Salud': HeartPulse,
    'Finanzas': Wallet
};

const VIEW_ICONS: Record<string, any> = {
    'Todos': LayoutGrid,
    'Urgentes': AlertTriangle,
    'Caducados': Clock,
    'Favoritos': Star,
    'Pendientes': FileSignature
};

const LIFECYCLE_LABELS: Record<string, string> = {
    activo: 'Activo',
    pendiente_revision: 'Pendiente de revision',
    pendiente_renovacion: 'Pendiente de renovacion',
    archivado: 'Archivado',
};
const AUTO_REMINDER_OFFSETS = [90, 30, 7, 1];
const DEFAULT_ALERT_SETTINGS: DocumentAlertSettings = {
    expiring: true,
    expired: true,
    missing_expiration: true,
    missing_back: true,
    lifecycle: true,
    reminder: true,
    sync_to_tasks: true,
};

const DEFAULT_FORM: DocumentForm = {
    title: '',
    category: '',
    tags: [],
    notes: '',
    issuer: '',
    summary: '',
    document_type: '',
    metadata: {},
    lifecycle_status: 'activo',
    renewal_of: null,
};

function loadAlertSettings(): DocumentAlertSettings {
    if (typeof window === 'undefined') return DEFAULT_ALERT_SETTINGS;
    try {
        const raw = window.localStorage.getItem(DOCUMENT_SETTINGS_KEY);
        if (!raw) return DEFAULT_ALERT_SETTINGS;
        return { ...DEFAULT_ALERT_SETTINGS, ...JSON.parse(raw) };
    } catch {
        return DEFAULT_ALERT_SETTINGS;
    }
}

function saveAlertSettings(settings: DocumentAlertSettings) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DOCUMENT_SETTINGS_KEY, JSON.stringify(settings));
}

function getDocumentState(doc: SecureDocument): { label: string; tone: DocumentStateTone; daysUntilExpiration: number | null } {
    if (doc.lifecycle_status === 'archivado') return { label: 'Archivado', tone: 'muted', daysUntilExpiration: null };
    if (doc.lifecycle_status === 'pendiente_renovacion') return { label: 'Pendiente de renovacion', tone: 'warning', daysUntilExpiration: null };
    if (doc.lifecycle_status === 'pendiente_revision') return { label: 'Pendiente de revision', tone: 'warning', daysUntilExpiration: null };
    if (!doc.expiration_date) return { label: 'Sin vencimiento', tone: 'muted', daysUntilExpiration: null };
    const daysUntilExpiration = differenceInDays(parseISO(doc.expiration_date), new Date());
    if (daysUntilExpiration < 0) return { label: 'Caducado', tone: 'expired', daysUntilExpiration };
    if (daysUntilExpiration <= 30) return { label: 'Proximo a vencer', tone: 'warning', daysUntilExpiration };
    return { label: 'Vigente', tone: 'active', daysUntilExpiration };
}

function getFileLabel(fileType?: string | null) {
    if (!fileType) return 'Archivo';
    if (fileType.includes('pdf')) return 'PDF';
    if (fileType.includes('image')) return 'Imagen';
    if (fileType.includes('word') || fileType.includes('document')) return 'Documento';
    return fileType.split('/')[1]?.toUpperCase() || 'Archivo';
}

function getDocumentFileName(doc: SecureDocument) {
    const rawExtension = doc.file_type?.split('/')[1] || doc.file_url.split('.').pop() || 'file';
    const extension = rawExtension.replace(/[^a-z0-9]/gi, '') || 'file';
    const safeTitle = doc.title.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'documento';
    return `${safeTitle}.${extension}`;
}

function formatMetadataLabel(key: string) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function metadataToSearchText(metadata?: DocumentMetadata | null) {
    if (!metadata) return '';
    return Object.entries(metadata).map(([key, value]) => `${key} ${String(value ?? '')}`).join(' ').toLowerCase();
}

function createFormFromDocument(doc: SecureDocument): DocumentForm {
    return {
        id: doc.id,
        title: doc.title,
        category: doc.category,
        expiration_date: doc.expiration_date || undefined,
        file_url: doc.file_url,
        file_type: doc.file_type || undefined,
        is_favorite: doc.is_favorite,
        tags: doc.tags || [],
        notes: doc.notes || '',
        issuer: doc.issuer || '',
        summary: doc.summary || '',
        document_type: doc.document_type || '',
        metadata: doc.metadata || {},
        lifecycle_status: doc.lifecycle_status || 'activo',
        renewal_of: doc.renewal_of || null,
    };
}

function buildManualTitle(file: File) {
    const rawTitle = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim();
    if (!rawTitle) return 'Documento manual';
    return rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string) {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        promise.then((value) => { clearTimeout(timer); resolve(value); }).catch((error) => { clearTimeout(timer); reject(error); });
    });
}

function normalizeSupabaseError(error: any) {
    const message = typeof error?.message === 'string' ? error.message : '';
    const statusCode = error?.statusCode ?? error?.status ?? null;
    const errorText = typeof error?.error === 'string' ? error.error : '';
    return { message, statusCode, errorText, fullText: `${message} ${errorText}`.trim().toLowerCase() };
}

function needsExpiration(doc: SecureDocument) {
    return ['Identidad', 'Vehiculo', 'Seguro', 'Salud'].includes(doc.category);
}

function buildSystemTags(doc: SecureDocument) {
    const state = getDocumentState(doc);
    const tags: string[] = [];
    if (state.tone === 'expired') tags.push('Critico');
    if (state.daysUntilExpiration !== null && state.daysUntilExpiration >= 0 && state.daysUntilExpiration <= 30) tags.push('Este mes');
    if (doc.lifecycle_status === 'pendiente_revision' || doc.lifecycle_status === 'pendiente_renovacion') tags.push('Pendiente');
    if (doc.metadata?.requiere_doble_cara === true) tags.push('Falta reverso');
    if (needsExpiration(doc) && !doc.expiration_date) tags.push('Falta fecha');
    return tags;
}

function buildAlerts(documents: SecureDocument[], reminders: DocumentReminder[], settings: DocumentAlertSettings) {
    const alerts: DocumentAlert[] = [];
    const reminderDocs = new Map(documents.map((doc) => [doc.id, doc]));

    documents.forEach((doc) => {
        const state = getDocumentState(doc);
        if (settings.expired && state.tone === 'expired') {
            alerts.push({ id: `expired-${doc.id}`, documentId: doc.id, documentTitle: doc.title, title: 'Documento caducado', description: `${doc.title} necesita renovacion inmediata.`, severity: 'high', dueDate: doc.expiration_date || null, category: doc.category, type: 'expired' });
        } else if (settings.expiring && state.daysUntilExpiration !== null && state.daysUntilExpiration >= 0 && state.daysUntilExpiration <= 30) {
            alerts.push({ id: `soon-${doc.id}`, documentId: doc.id, documentTitle: doc.title, title: state.daysUntilExpiration <= 7 ? 'Caduca esta semana' : 'Caduca este mes', description: `${doc.title} vence en ${state.daysUntilExpiration} dias.`, severity: state.daysUntilExpiration <= 7 ? 'high' : 'medium', dueDate: doc.expiration_date || null, category: doc.category, type: 'expiring' });
        }
        if (settings.missing_expiration && needsExpiration(doc) && !doc.expiration_date) {
            alerts.push({ id: `missing-expiry-${doc.id}`, documentId: doc.id, documentTitle: doc.title, title: 'Falta fecha de validez', description: `${doc.title} deberia tener una fecha de caducidad o revision.`, severity: 'medium', dueDate: null, category: doc.category, type: 'missing_expiration' });
        }
        if (settings.missing_back && doc.metadata?.requiere_doble_cara === true) {
            alerts.push({ id: `missing-back-${doc.id}`, documentId: doc.id, documentTitle: doc.title, title: 'Falta la parte trasera', description: `${doc.title} parece necesitar anverso y reverso para quedar completo.`, severity: 'medium', dueDate: null, category: doc.category, type: 'missing_back' });
        }
        if (settings.lifecycle && (doc.lifecycle_status === 'pendiente_revision' || doc.lifecycle_status === 'pendiente_renovacion')) {
            alerts.push({ id: `lifecycle-${doc.id}`, documentId: doc.id, documentTitle: doc.title, title: LIFECYCLE_LABELS[doc.lifecycle_status] || 'Pendiente', description: `${doc.title} esta marcado para seguimiento manual.`, severity: 'low', dueDate: doc.expiration_date || null, category: doc.category, type: 'lifecycle' });
        }
    });

    if (settings.reminder) {
        reminders.forEach((reminder) => {
            if (!reminder.is_active) return;
            const document = reminderDocs.get(reminder.document_id);
            if (!document) return;
            const daysUntil = differenceInDays(parseISO(reminder.next_date), new Date());
            alerts.push({
                id: `reminder-${reminder.id}`,
                documentId: document.id,
                documentTitle: document.title,
                title: reminder.title,
                description: reminder.description || `Aviso programado para ${document.title}.`,
                severity: daysUntil <= 7 ? 'high' : daysUntil <= 30 ? 'medium' : 'low',
                dueDate: reminder.next_date,
                category: document.category,
                type: 'reminder',
            });
        });
    }

    return alerts.sort((a, b) => {
        const severityWeight = { high: 0, medium: 1, low: 2 };
        if (severityWeight[a.severity] !== severityWeight[b.severity]) return severityWeight[a.severity] - severityWeight[b.severity];
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return parseISO(a.dueDate).getTime() - parseISO(b.dueDate).getTime();
    });
}

type DocumentAlertSettingsDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    settings: DocumentAlertSettings;
    onChange: (settings: DocumentAlertSettings) => void;
};

function DocumentAlertSettingsDialog({ open, onOpenChange, settings, onChange }: DocumentAlertSettingsDialogProps) {
    const setToggle = (key: keyof DocumentAlertSettings, value: boolean) => onChange({ ...settings, [key]: value });
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden border-none shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500" />
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2 font-black tracking-tight text-xl">
                        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-600">
                            <Settings className="w-5 h-5" />
                        </div>
                        Ajustes de Alertas
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium text-slate-500">
                        Configura las notificaciones proactivas de Quioba IA.
                    </DialogDescription>
                </DialogHeader>
                <div className="px-6 py-2 space-y-2">
                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2.5 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Caducidad próxima</Label>
                            <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500">Documentos que vencen en 30 días o menos.</p>
                        </div>
                        <Switch checked={settings.expiring} onCheckedChange={(value) => setToggle('expiring', value)} className="data-[state=checked]:bg-amber-500" />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2.5 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Documentos caducados</Label>
                            <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500">Seguimiento urgente para documentos vencidos.</p>
                        </div>
                        <Switch checked={settings.expired} onCheckedChange={(value) => setToggle('expired', value)} className="data-[state=checked]:bg-amber-500" />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2.5 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Datos Faltantes</Label>
                            <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500">Detecta falta de fechas o imágenes (reverso).</p>
                        </div>
                        <div className="flex gap-2">
                            <Switch checked={settings.missing_expiration} onCheckedChange={(value) => setToggle('missing_expiration', value)} className="data-[state=checked]:bg-amber-500" />
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-4 py-2.5 hover:bg-white dark:hover:bg-slate-800 transition-colors group">
                        <div className="space-y-0.5">
                            <Label className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Estados y Avisos</Label>
                            <p className="text-[10px] font-bold text-slate-400 group-hover:text-slate-500">Recordatorios manuales y cambios de estado.</p>
                        </div>
                        <Switch checked={settings.reminder} onCheckedChange={(value) => setToggle('reminder', value)} className="data-[state=checked]:bg-amber-500" />
                    </div>

                    <div className="flex items-center justify-between rounded-2xl border border-amber-100 dark:border-amber-900/30 bg-amber-50/30 dark:bg-amber-900/10 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-all border-dashed shadow-sm">
                        <div className="space-y-0.5">
                            <Label className="text-[11px] font-black uppercase tracking-[0.1em] text-amber-700 dark:text-amber-400">Sincronización Total</Label>
                            <p className="text-[10px] font-bold text-amber-600/70">Muestra los avisos en tu panel de tareas y calendario.</p>
                        </div>
                        <Switch checked={settings.sync_to_tasks} onCheckedChange={(value) => setToggle('sync_to_tasks', value)} className="data-[state=checked]:bg-amber-600" />
                    </div>
                </div>
                <DialogFooter className="p-6 pt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-slate-100">
                        Finalizar Ajustes
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<SecureDocument[]>([]);
    const [reminders, setReminders] = useState<DocumentReminder[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAlertsSheetOpen, setIsAlertsSheetOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<SecureDocument | null>(null);

    // Vault State
    const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
    const [isVaultDialogOpen, setIsVaultDialogOpen] = useState(false);
    const [vaultPin, setVaultPin] = useState('');
    const [isVerifyingVault, setIsVerifyingVault] = useState(false);

    // Mobile Scan State
    const [isMobileScanDialogOpen, setIsMobileScanDialogOpen] = useState(false);
    const [bridgeStatus, setBridgeStatus] = useState<'waiting' | 'scanning' | 'received'>('waiting');
    const [bridgeSessionCode, setBridgeSessionCode] = useState<string | null>(null);
    const [isProcessingBridgeFile, setIsProcessingBridgeFile] = useState(false);

    // Chat with Document State
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleChatSubmit = async () => {
        if (!chatInput.trim() || !selectedDocument) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsChatLoading(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('No session');

            const response = await fetch(getApiUrl('api/documents/chat'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    document_id: selectedDocument.id,
                    question: userMessage,
                    chat_history: chatMessages
                })
            });

            if (!response.ok) throw new Error('Respuesta fallida');
            const data = await response.json();

            setChatMessages(prev => [...prev, { role: 'assistant', content: data.answer }]);
        } catch (error) {
            console.error('Chat error:', error);
            setChatMessages(prev => [...prev, { role: 'assistant', content: "Lo siento, ha ocurrido un error al procesar tu pregunta. Por favor, inténtalo de nuevo." }]);
        } finally {
            setIsChatLoading(false);
        }
    };

    const handleVaultUnlock = async () => {
        if (vaultPin === '1234') {
            setIsVerifyingVault(true);
            // Simulate FaceID/Biometric with a delay
            await new Promise(r => setTimeout(r, 2000));
            setIsVaultUnlocked(true);
            setIsVaultDialogOpen(false);
            setIsVerifyingVault(false);
            setVaultPin('');
            toast.success("Bóveda Desbloqueada", {
                description: "Acceso a documentos sensibles concedido.",
                icon: <ShieldCheck className="w-4 h-4 text-green-500" />
            });
        } else {
            toast.error("PIN Incorrecto", { description: "Prueba con '1234' para la demo." });
            setVaultPin('');
        }
    };


    function handleOpenDetail(doc: SecureDocument) {
        setSelectedDocument(doc);
        setChatMessages([]); // Reset chat when switching documents
        setIsDetailOpen(true);
    }

    useEffect(() => {
        if (isDetailOpen) {
            scrollToBottom();
        }
    }, [chatMessages, isDetailOpen]);
    const [reminderTarget, setReminderTarget] = useState<SecureDocument | null>(null);
    const [versionTarget, setVersionTarget] = useState<SecureDocument | null>(null);
    const [formData, setFormData] = useState<DocumentForm>(DEFAULT_FORM);
    const [uploading, setUploading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState('Todos');
    const [smartView, setSmartView] = useState('Todos');
    const [sortBy, setSortBy] = useState<SortOption>('recent');
    const [analysisPreview, setAnalysisPreview] = useState<DocumentAnalysisResult | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [analyzingDocument, setAnalyzingDocument] = useState(false);
    const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
    const [alertSettings, setAlertSettings] = useState<DocumentAlertSettings>(DEFAULT_ALERT_SETTINGS);
    const initialLoadRef = useRef(false);

    useEffect(() => {
        if (initialLoadRef.current) return;
        initialLoadRef.current = true;
        setAlertSettings(loadAlertSettings());
        void Promise.all([fetchDocuments(), fetchReminders()]).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        saveAlertSettings(alertSettings);
    }, [alertSettings]);

    useEffect(() => {
        if (loading || !initialLoadRef.current) return;
        void syncDocumentTasks(documents, reminders, alertSettings);
    }, [documents, reminders, alertSettings, loading]);

    // Lógica del Puente de Escaneo Móvil (Fase 5)
    useEffect(() => {
        let subscription: any = null;

        const startBridge = async () => {
            if (isMobileScanDialogOpen) {
                const code = Math.random().toString(36).substring(2, 8).toUpperCase();
                setBridgeSessionCode(code);
                setBridgeStatus('waiting');

                // 1. Crear la sesión en la base de datos
                const { error } = await supabase
                    .from('document_ingestion_bridge')
                    .insert([{ session_code: code, status: 'pending' }]);

                if (error) {
                    console.error('Error creating bridge session:', error);
                    return;
                }

                // 2. Suscribirse a cambios en tiempo real
                subscription = supabase
                    .channel(`bridge:${code}`)
                    .on(
                        'postgres_changes',
                        {
                            event: 'UPDATE',
                            schema: 'public',
                            table: 'document_ingestion_bridge',
                            filter: `session_code=eq.${code}`
                        },
                        async (payload) => {
                            const newData = payload.new;
                            if (newData.status === 'uploaded' && newData.file_url) {
                                setBridgeStatus('scanning');
                                setIsProcessingBridgeFile(true);

                                // 1. INSERTAR EL DOCUMENTO REAL EN LA TABLA
                                const { error: insertError } = await supabase
                                    .from('documents')
                                    .insert([{
                                        title: newData.file_name || 'Nuevo Escaneo Móvil',
                                        file_url: newData.file_url,
                                        category: 'Otros',
                                        lifecycle_status: 'activo',
                                        issuer: 'Quioba Mobile',
                                        tags: ['escaneo-movil'],
                                        is_favorite: false
                                    }]);

                                if (insertError) {
                                    console.error('Error saving bridge document:', insertError);
                                    toast.error('Error al guardar el archivo en tu biblioteca');
                                }

                                // 2. Simular un pequeño tiempo de "análisis"
                                setTimeout(() => {
                                    setBridgeStatus('received');
                                    setIsProcessingBridgeFile(false);

                                    if (!insertError) {
                                        toast.success(`¡Documento "${newData.file_name}" recibido y guardado!`);
                                        refreshDataAndSync(); // Recargar la lista
                                    }
                                }, 2000);
                            }
                        }
                    )
                    .subscribe();
            } else {
                setBridgeSessionCode(null);
                if (subscription) supabase.removeChannel(subscription);
            }
        };

        startBridge();

        return () => {
            if (subscription) supabase.removeChannel(subscription);
        };
    }, [isMobileScanDialogOpen]);

    const fetchDocuments = async () => {
        const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
        if (error) {
            console.error('Error fetching documents:', error);
            toast.error('Error al cargar el centro de documentos');
            return;
        }
        setDocuments(((data || []) as SecureDocument[]).map((doc, idx) => ({
            ...doc,
            is_secure: idx === 0 // Mock: first doc is secure
        })));
    };

    const fetchReminders = async () => {
        const { data, error } = await supabase.from('document_reminders').select('*').order('next_date');
        if (error) {
            console.error('Error fetching document reminders:', error);
            setReminders([]);
            return;
        }
        setReminders((data || []) as DocumentReminder[]);
    };

    const getOrCreateTaskListId = async () => {
        const { data: membershipRows } = await supabase
            .from('task_list_members')
            .select('list_id')
            .limit(1);

        const existingListId = membershipRows?.[0]?.list_id;
        if (existingListId) return existingListId as string;

        const { data: createdListId, error } = await supabase.rpc('create_default_task_list_for_user');
        if (error) {
            console.error('Error creating default task list:', error);
            return null;
        }
        return createdListId as string | null;
    };

    const syncAutomaticReminders = async (documentId: string, title: string, expirationDate?: string | null) => {
        const deleteResponse = await supabase.from('document_reminders').delete().eq('document_id', documentId).eq('kind', 'expiry');
        if (deleteResponse.error) console.error('Error clearing automatic reminders:', deleteResponse.error);
        if (!expirationDate) return;
        const expiryDate = parseISO(expirationDate);
        const today = startOfDay(new Date());
        if (expiryDate < today) return;
        const automaticRows = AUTO_REMINDER_OFFSETS
            .map((offset) => {
                const reminderDate = subDays(expiryDate, offset);
                if (reminderDate < subDays(today, 1)) return null;
                return {
                    document_id: documentId,
                    title: `${title} · aviso ${offset} dias antes`,
                    description: `Recordatorio automatico para revisar ${title} antes de su vencimiento.`,
                    kind: 'expiry',
                    offset_days: offset,
                    interval_months: null,
                    next_date: format(reminderDate, 'yyyy-MM-dd'),
                    channel: 'in_app',
                    is_active: true,
                };
            })
            .filter(Boolean);
        if (automaticRows.length === 0) return;
        const { error } = await supabase.from('document_reminders').insert(automaticRows as any[]);
        if (error) console.error('Error creating automatic reminders:', error);
    };

    const syncDocumentTasks = async (allDocuments: SecureDocument[], allReminders: DocumentReminder[], settings: DocumentAlertSettings) => {
        const taskMarkerPrefix = '[QUIOBA_DOCUMENT]';
        const alerts = buildAlerts(allDocuments, allReminders, settings);
        const actionableAlerts = settings.sync_to_tasks ? alerts.filter((alert) => ['expired', 'lifecycle', 'reminder'].includes(alert.type)) : [];
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user;
        if (!user) return;

        const { data: existingTasks, error: fetchError } = await supabase
            .from('tasks')
            .select('id, title, description, due_date, is_completed, list_id')
            .eq('user_id', user.id)
            .ilike('description', `${taskMarkerPrefix}%`);
        if (fetchError) {
            console.error('Error fetching document tasks:', fetchError);
            return;
        }

        const listId = actionableAlerts.length > 0 ? await getOrCreateTaskListId() : null;
        const existingByMarker = new Map<string, any>();
        (existingTasks || []).forEach((task: any) => {
            const description = String(task.description || '');
            const markerLine = description.split('\n')[0] || '';
            existingByMarker.set(markerLine.trim(), task);
        });

        const desiredMarkers = new Set<string>();
        let shouldRefreshCalendar = false;
        for (const alert of actionableAlerts) {
            const marker = alert.type === 'reminder'
                ? `${taskMarkerPrefix}:${alert.type}:${alert.id}`
                : `${taskMarkerPrefix}:${alert.type}:${alert.documentId}`;
            desiredMarkers.add(marker);
            const dueDateIso = alert.dueDate ? `${alert.dueDate}T09:00:00.000Z` : null;
            const title = `Documento: ${alert.title} · ${alert.documentTitle}`;
            const description = `${marker}\n${alert.description}`;
            const existing = existingByMarker.get(marker);
            if (existing) {
                const { error } = await supabase
                    .from('tasks')
                    .update({
                        title,
                        description,
                        due_date: dueDateIso,
                        has_alarm: true,
                        priority: alert.severity === 'high' ? 'high' : alert.severity === 'medium' ? 'medium' : 'low',
                        is_completed: false,
                    })
                    .eq('id', existing.id);
                if (error) {
                    console.error('Error updating document task:', error);
                } else {
                    shouldRefreshCalendar = true;
                }
            } else {
                const { error } = await supabase
                    .from('tasks')
                    .insert([{
                        user_id: user.id,
                        list_id: listId,
                        title,
                        description,
                        due_date: dueDateIso,
                        has_alarm: true,
                        is_completed: false,
                        priority: alert.severity === 'high' ? 'high' : alert.severity === 'medium' ? 'medium' : 'low',
                    }]);
                if (error) {
                    console.error('Error inserting document task:', error);
                } else {
                    shouldRefreshCalendar = true;
                }
            }
        }

        for (const task of existingTasks || []) {
            const description = String(task.description || '');
            const markerLine = (description.split('\n')[0] || '').trim();
            if (markerLine.startsWith(taskMarkerPrefix) && !desiredMarkers.has(markerLine)) {
                const { error } = await supabase.from('tasks').delete().eq('id', task.id);
                if (error) {
                    console.error('Error deleting stale document task:', error);
                } else {
                    shouldRefreshCalendar = true;
                }
            }
        }

        if (typeof window !== 'undefined' && shouldRefreshCalendar) {
            window.dispatchEvent(new Event('quioba-calendar-refresh'));
        }
    };

    const refreshDataAndSync = async (nextSettings = alertSettings) => {
        const { data, error } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        const nextDocuments = (data || []) as SecureDocument[];
        setDocuments(nextDocuments);
        const { data: reminderData } = await supabase.from('document_reminders').select('*').order('next_date');
        const nextReminders = (reminderData || []) as DocumentReminder[];
        setReminders(nextReminders);
        await syncDocumentTasks(nextDocuments, nextReminders, nextSettings);
        return { nextDocuments, nextReminders };
    };

    const finalizeDocumentSave = async (documentId: string, title: string, expirationDate: string | null, nextSettings = alertSettings) => {
        try {
            await syncAutomaticReminders(documentId, title, expirationDate);
            await refreshDataAndSync(nextSettings);
        } catch (error) {
            console.error('Post-save sync error:', error);
            toast.error('El documento se ha guardado, pero no se pudieron actualizar recordatorios o calendario al momento.');
        }
    };

    const handleAnalyzeDocument = async (file: File) => {
        setAnalyzingDocument(true);
        setAnalysisPreview(null);
        setAnalysisError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error('Necesitas iniciar sesion para analizar documentos.');
            const body = new FormData();
            body.append('file', file);
            const response = await fetch(getApiUrl('api/documents/analyze'), { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` }, body });
            const responseText = await response.text();
            let data: any = null;
            try { data = responseText ? JSON.parse(responseText) : null; } catch {
                if (!response.ok) throw new Error('El analisis devolvio una respuesta invalida del servidor. Reinicia next dev y prueba de nuevo.');
                throw new Error('La respuesta del analisis no tenia un formato valido.');
            }
            if (!response.ok) throw new Error(data?.error || 'No se pudo analizar el documento');
            const analysis = data.analysis as DocumentAnalysisResult;
            setAnalysisPreview(analysis);
            setFormData((current) => ({
                ...current,
                title: analysis.title || current.title,
                category: analysis.category || current.category,
                expiration_date: analysis.expiration_date || current.expiration_date,
                tags: current.tags.length > 0 ? current.tags : analysis.tags,
                issuer: analysis.issuer || current.issuer,
                summary: analysis.summary || current.summary,
                document_type: analysis.document_type || current.document_type,
                metadata: Object.keys(current.metadata || {}).length > 0 ? current.metadata : analysis.metadata,
            }));
            toast.success('Documento analizado y formulario autocompletado');
            return analysis;
        } catch (error: any) {
            console.error('Document analysis error:', error);
            const fallbackMessage = error?.message || 'No se pudo analizar el documento';
            setAnalysisError(fallbackMessage);
            setFormData((current) => ({ ...current, title: current.title || buildManualTitle(file), summary: current.summary || 'Documento subido sin analisis automatico. Datos completados manualmente.', metadata: current.metadata || {} }));
            toast.error(`${fallbackMessage} Puedes completar los datos manualmente y guardar el archivo igualmente.`);
            return null;
        } finally {
            setAnalyzingDocument(false);
        }
    };

    const handleSave = async (file?: File) => {
        setUploading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');
            let finalFilePath = formData.file_url;
            if (file) {
                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;
                const { error: uploadError } = await withTimeout(supabase.storage.from(DOCUMENTS_BUCKET).upload(filePath, file), STORAGE_UPLOAD_TIMEOUT_MS, 'La subida del archivo ha tardado demasiado. Revisa tu conexion e intentalo de nuevo.');
                if (uploadError) throw uploadError;
                finalFilePath = filePath;
            }

            const inferredExpirationDate = formData.expiration_date
                || (typeof formData.metadata?.fecha_validez === 'string' ? formData.metadata.fecha_validez : null)
                || analysisPreview?.expiration_date
                || null;

            const payload = {
                user_id: user.id,
                title: formData.title,
                category: formData.category,
                expiration_date: inferredExpirationDate,
                file_url: finalFilePath,
                file_type: file ? file.type : formData.file_type,
                tags: formData.tags || [],
                notes: formData.notes?.trim() || null,
                issuer: formData.issuer?.trim() || null,
                summary: formData.summary?.trim() || null,
                document_type: formData.document_type?.trim() || null,
                metadata: formData.metadata || {},
                lifecycle_status: formData.lifecycle_status || 'activo',
                renewal_of: formData.renewal_of || null,
            };

            let savedDocumentId: string | null = formData.id || null;

            if (formData.id) {
                const { data: updatedDocument, error } = await supabase
                    .from('documents')
                    .update(payload)
                    .eq('id', formData.id)
                    .select('id')
                    .single();
                if (error) throw error;
                savedDocumentId = updatedDocument?.id || formData.id;
                toast.success('Documento actualizado');
            } else {
                const { data: insertedDocument, error } = await supabase
                    .from('documents')
                    .insert([payload])
                    .select('id')
                    .single();
                if (error) throw error;
                savedDocumentId = insertedDocument?.id || null;
                toast.success('Documento guardado');
            }

            setIsDialogOpen(false);
            setFormData(DEFAULT_FORM);
            setSelectedUploadFile(null);
            setAnalysisPreview(null);
            setAnalysisError(null);

            if (savedDocumentId) {
                void finalizeDocumentSave(savedDocumentId, payload.title, payload.expiration_date, alertSettings);
            } else {
                void refreshDataAndSync(alertSettings);
            }
        } catch (error: any) {
            console.error('Save error:', error);
            const { message, statusCode, fullText } = normalizeSupabaseError(error);
            if (fullText.includes('row-level security')) {
                toast.error('Supabase esta bloqueando la subida al bucket secure-docs. Ejecuta la migracion create_secure_docs_storage.sql.');
            } else if (statusCode === 404 || fullText.includes('bucket not found') || fullText.includes('not found')) {
                toast.error('El bucket secure-docs no existe o no esta accesible en produccion. Ejecuta create_secure_docs_storage.sql en ese proyecto de Supabase.');
            } else if (fullText.includes('column') || fullText.includes('document_reminders') || fullText.includes('document_versions')) {
                toast.error('Falta la migracion avanzada de documentos. Ejecuta alter_documents_add_tracking.sql y alter_documents_add_smart_fields.sql en Supabase.');
            } else if (message.includes('ha tardado demasiado')) {
                toast.error(message);
            } else {
                toast.error(message || 'Error al guardar. Verifica el bucket secure-docs y las migraciones SQL.');
            }
        } finally {
            setUploading(false);
        }
    };

    const handleViewFile = async (doc: SecureDocument) => {
        try {
            const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.file_url, 60);
            if (error) throw error;
            if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        } catch (error) {
            console.error('Error signing URL:', error);
            toast.error('No se pudo acceder al archivo');
        }
    };

    const handleDownload = async (doc: SecureDocument) => {
        try {
            const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.file_url, 60);
            if (error) throw error;
            if (!data?.signedUrl) throw new Error('No se pudo generar la descarga');
            const response = await fetch(data.signedUrl);
            if (!response.ok) throw new Error('No se pudo descargar el archivo');
            const blob = await response.blob();
            const objectUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = getDocumentFileName(doc);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(objectUrl);
            toast.success('Descarga iniciada');
        } catch (error) {
            console.error('Download error:', error);
            toast.error('No se pudo descargar el archivo');
        }
    };

    const handleDelete = async (id: string, filePath: string) => {
        if (!confirm('Estas seguro de eliminar este documento?')) return;
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('No user');
            const { data: deletedRow, error } = await supabase.from('documents').delete().eq('id', id).eq('user_id', user.id).select('id, file_url').maybeSingle();
            if (error) throw error;
            if (!deletedRow) throw new Error('No se encontro el documento o no tienes permisos para borrarlo.');
            const storagePath = deletedRow.file_url || filePath;
            if (storagePath) {
                const { error: storageError } = await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
                if (storageError) {
                    const storageMessage = String(storageError.message || '').toLowerCase();
                    const isMissingObject = STORAGE_NOT_FOUND_MARKERS.some((marker) => storageMessage.includes(marker));
                    if (!isMissingObject) console.error('Storage delete error:', storageError);
                }
            }
            setDocuments((current) => current.filter((item) => item.id !== id));
            setReminders((current) => current.filter((item) => item.document_id !== id));
            if (selectedDocument?.id === id) {
                setSelectedDocument(null);
                setIsDetailOpen(false);
            }
            await refreshDataAndSync();
            toast.success('Documento eliminado');
        } catch (error) {
            console.error('Delete error:', error);
            toast.error(error instanceof Error ? error.message : 'Error al eliminar');
        }
    };

    const toggleFavorite = async (doc: SecureDocument) => {
        const nextValue = !doc.is_favorite;
        setDocuments((current) => current.map((item) => (item.id === doc.id ? { ...item, is_favorite: nextValue } : item)));
        const { error } = await supabase.from('documents').update({ is_favorite: nextValue }).eq('id', doc.id);
        if (error) {
            setDocuments((current) => current.map((item) => (item.id === doc.id ? { ...item, is_favorite: doc.is_favorite } : item)));
            toast.error('No se pudo actualizar el favorito');
            return;
        }
        toast.success(nextValue ? 'Anadido a favoritos' : 'Quitado de favoritos');
    };

    const handleRenewDocument = (doc: SecureDocument) => {
        setFormData({ ...createFormFromDocument(doc), lifecycle_status: 'pendiente_renovacion' });
        setSelectedUploadFile(null);
        setAnalysisPreview(null);
        setAnalysisError(null);
        setIsDetailOpen(false);
        setIsDialogOpen(true);
    };

    const filteredDocs = documents
        .filter((doc) => {
            const state = getDocumentState(doc);
            const normalizedSearch = searchTerm.toLowerCase();
            const matchesSearch = doc.title.toLowerCase().includes(normalizedSearch) || doc.category.toLowerCase().includes(normalizedSearch) || getFileLabel(doc.file_type).toLowerCase().includes(normalizedSearch) || (doc.document_type || '').toLowerCase().includes(normalizedSearch) || (doc.issuer || '').toLowerCase().includes(normalizedSearch) || (doc.summary || '').toLowerCase().includes(normalizedSearch) || (doc.notes || '').toLowerCase().includes(normalizedSearch) || (doc.tags || []).join(' ').toLowerCase().includes(normalizedSearch) || buildSystemTags(doc).join(' ').toLowerCase().includes(normalizedSearch) || metadataToSearchText(doc.metadata).includes(normalizedSearch);
            const matchesCategory = activeTab === 'Todos' || doc.category === activeTab;
            const matchesSmartView = smartView === 'Todos' || (smartView === 'Urgentes' && state.daysUntilExpiration !== null && state.daysUntilExpiration >= 0 && state.daysUntilExpiration <= 30) || (smartView === 'Caducados' && state.tone === 'expired') || (smartView === 'Favoritos' && doc.is_favorite) || (smartView === 'Pendientes' && (doc.lifecycle_status === 'pendiente_revision' || doc.lifecycle_status === 'pendiente_renovacion'));
            const matchesVault = isVaultUnlocked || !doc.is_secure;
            return matchesSearch && matchesCategory && matchesSmartView && matchesVault;
        })
        .sort((a, b) => {
            if (sortBy === 'title') return a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
            if (sortBy === 'expiry') {
                if (!a.expiration_date && !b.expiration_date) return 0;
                if (!a.expiration_date) return 1;
                if (!b.expiration_date) return -1;
                return parseISO(a.expiration_date).getTime() - parseISO(b.expiration_date).getTime();
            }
            return parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime();
        });

    const alerts = useMemo(() => buildAlerts(documents, reminders, alertSettings), [documents, reminders, alertSettings]);
    const totalDocuments = documents.length;
    const favoritesCount = documents.filter((doc) => doc.is_favorite).length;
    const expiredCount = documents.filter((doc) => getDocumentState(doc).tone === 'expired').length;
    const urgentCount = documents.filter((doc) => {
        const state = getDocumentState(doc);
        return state.daysUntilExpiration !== null && state.daysUntilExpiration >= 0 && state.daysUntilExpiration <= 30;
    }).length;
    const pendingCount = documents.filter((doc) => doc.lifecycle_status === 'pendiente_revision' || doc.lifecycle_status === 'pendiente_renovacion').length;

    const summaryCards = [
        { label: 'Total', value: totalDocuments, description: 'Documentos guardados', icon: Files, accent: 'text-slate-700 bg-slate-100 dark:text-slate-200 dark:bg-slate-800' },
        { label: 'Urgentes', value: urgentCount, description: 'Vencen en 30 dias o menos', icon: Clock3, accent: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-950/40' },
        { label: 'Caducados', value: expiredCount, description: 'Necesitan renovacion', icon: AlertTriangle, accent: 'text-rose-700 bg-rose-100 dark:text-rose-300 dark:bg-rose-950/40' },
        { label: 'Pendientes', value: pendingCount, description: 'Revision o renovacion en curso', icon: Flag, accent: 'text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-950/40' },
    ];

    const selectedMetadataEntries = useMemo(() => Object.entries(selectedDocument?.metadata || {}).filter(([, value]) => value !== null && value !== ''), [selectedDocument]);

    return (
        <div className="min-h-screen bg-[#fafafa] dark:bg-[#020617] p-4 md:p-8 pb-nav relative overflow-hidden font-sans">
            {/* Premium Background Decor */}
            <div className="absolute top-0 right-0 w-2/3 h-2/3 bg-amber-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-indigo-500/5 blur-[100px] pointer-events-none" />

            <div className="max-w-6xl mx-auto space-y-8 relative z-10">
                {/* Premium Navigation */}
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <Link href="/">
                            <Button
                                variant="outline"
                                size="sm"
                                className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-full px-4 h-9 shadow-sm hover:shadow-md transition-all flex items-center gap-2 group"
                            >
                                <Home className="h-4 w-4 text-slate-500 group-hover:text-amber-500 transition-colors" />
                                <span className="hidden sm:inline font-bold text-[10px] uppercase tracking-wider">Inicio</span>
                            </Button>
                        </Link>
                        <Link href="/apps/mi-hogar">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="bg-slate-100/30 dark:bg-slate-800/20 hover:bg-slate-100/50 dark:hover:bg-slate-800/40 rounded-full px-4 h-9 flex items-center gap-2 transition-all group"
                            >
                                <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:-translate-x-1 transition-transform" />
                                <span className="font-bold text-[10px] uppercase tracking-wider">Mi Hogar</span>
                            </Button>
                        </Link>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => isVaultUnlocked ? setIsVaultUnlocked(false) : setIsVaultDialogOpen(true)}
                            className={cn(
                                "rounded-full px-4 h-9 flex items-center gap-2 transition-all group overflow-hidden relative",
                                isVaultUnlocked
                                    ? "bg-green-500/10 text-green-800 hover:bg-green-500/20 border border-green-500/20"
                                    : "bg-slate-100/50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800"
                            )}
                        >
                            <AnimatePresence mode="wait">
                                {isVaultUnlocked ? (
                                    <motion.div
                                        key="unlocked"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: -20, opacity: 0 }}
                                        className="flex items-center gap-2"
                                    >
                                        <ShieldCheck className="h-4 w-4" />
                                        <span className="font-bold text-[10px] uppercase tracking-wider">Bóveda Abierta</span>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="locked"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        exit={{ y: -20, opacity: 0 }}
                                        className="flex items-center gap-2"
                                    >
                                        <Lock className="h-4 w-4 text-slate-500 group-hover:text-amber-600 transition-colors" />
                                        <span className="hidden sm:inline font-bold text-[10px] uppercase tracking-wider">Modo Bóveda</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSettingsOpen(true)}
                            className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-slate-200 dark:border-slate-800 rounded-full h-9 px-4 flex items-center gap-2 group"
                        >
                            <Settings className="h-4 w-4 text-slate-500 group-hover:rotate-45 transition-transform" />
                            <span className="hidden sm:inline font-bold text-[10px] uppercase tracking-wider">Ajustes</span>
                        </Button>
                    </div>
                </motion.div>

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl shadow-xl shadow-amber-500/20">
                                <ShieldCheck className="w-6 h-6 text-white" />
                            </div>
                            <h1 className="text-3xl md:text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
                                Centro de <span className="text-amber-500">Documentos</span>
                            </h1>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-base font-medium ml-1 flex items-center gap-2">
                            <span className="w-8 h-[2px] bg-amber-500/30 rounded-full" />
                            Garantiza la validez y seguridad de tu documentación personal.
                        </p>
                    </motion.div>
                </div>

                {/* Info Bar / Sync Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <Card className="border-white/10 dark:border-white/5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl overflow-hidden relative border-none shadow-2xl group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                            <BellRing className="w-24 h-24 text-amber-500" />
                        </div>
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 relative z-10">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <CardTitle className="text-sm font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                                        Sincronización Activa de IA
                                    </CardTitle>
                                </div>
                                <CardDescription className="text-slate-600 dark:text-slate-300 font-semibold text-xs max-w-2xl leading-relaxed">
                                    {alertSettings.sync_to_tasks
                                        ? `Quioba está monitoreando tus archivos. Actualmente hay ${alerts.length} alertas sincronizadas con tu calendario y tareas.`
                                        : 'La sincronización automática está en pausa. Actívala en ajustes para recibir avisos proactivos.'}
                                </CardDescription>
                            </div>
                            {alerts.length > 0 && (
                                <Button
                                    onClick={() => setIsAlertsSheetOpen(true)}
                                    className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-xl px-6 font-black text-[10px] uppercase tracking-widest transition-all hover:scale-105"
                                >
                                    <Bell className="w-3.5 h-3.5 mr-2" /> VER LOS {alerts.length} AVISOS
                                </Button>
                            )}
                        </CardHeader>
                    </Card>
                </motion.div>

                <div className="flex flex-col lg:flex-row gap-4 justify-between items-center">
                    <div className="relative flex-1 w-full lg:max-w-md"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por titulo, categoria, tipo, emisor, etiqueta, nota o metadato..." className="pl-9" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div>
                    <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                        <Button
                            onClick={() => setIsMobileScanDialogOpen(true)}
                            variant="outline"
                            className="bg-white/80 dark:bg-slate-900/80 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 hover:text-amber-600 transition-all font-bold text-xs"
                        >
                            <CalendarClock className="w-4 h-4 mr-2" /> ESCANEAR CON MÓVIL
                        </Button>
                        <Button
                            onClick={() => { setFormData(DEFAULT_FORM); setSelectedUploadFile(null); setAnalysisPreview(null); setAnalysisError(null); setIsDialogOpen(true); }}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                        >
                            <Plus className="w-4 h-4 mr-2" /> NUEVO DOCUMENTO
                        </Button>
                    </div>
                </div>

                <Card className="p-3 sm:p-5 bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border-white/40 dark:border-slate-800/60 shadow-xl rounded-[2rem] w-full flex flex-col gap-4">
                    {/* Primary Categories */}
                    <div className="flex flex-wrap items-center gap-2">
                        {CATEGORIES.map((cat) => {
                            const Icon = CATEGORY_ICONS[cat] || FileText;
                            const isActive = activeTab === cat;
                            const count = cat !== 'Todos' ? documents.filter((doc) => doc.category === cat).length : documents.length;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setActiveTab(cat)}
                                    className={cn(
                                        "relative px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold uppercase tracking-widest transition-all duration-300",
                                        isActive ? "text-white shadow-md" : "text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100"
                                    )}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeCategory"
                                            className="absolute inset-0 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-2">
                                        <Icon className="w-4 h-4" />
                                        {cat}
                                        <span className={cn(
                                            "px-1.5 py-0.5 rounded-md text-[9px]",
                                            isActive ? "bg-white/20" : "bg-slate-200 dark:bg-slate-800"
                                        )}>
                                            {count}
                                        </span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-800/50 to-transparent" />

                    {/* Secondary Filters and Sort */}
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {SMART_VIEWS.map((view) => {
                                const IconView = VIEW_ICONS[view] || Activity;
                                const isActive = smartView === view;
                                return (
                                    <button
                                        key={view}
                                        onClick={() => setSmartView(view)}
                                        className={cn(
                                            "relative px-3 py-1.5 rounded-xl flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
                                            isActive ? "bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 shadow-sm" : "bg-white/50 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        )}
                                    >
                                        <IconView className="w-3 h-3" />
                                        {view}
                                    </button>
                                );
                            })}
                        </div>
                        <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                            <SelectTrigger className="w-full sm:w-[200px] h-9 bg-white/50 dark:bg-slate-900/50 border-none rounded-xl ml-auto text-[10px] font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 focus:ring-0">
                                <ArrowUpDown className="w-3 h-3 mr-2 text-amber-500" />
                                <SelectValue placeholder="ORDENAR POR" />
                            </SelectTrigger>
                            <SelectContent className="rounded-2xl border-none shadow-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl">
                                <SelectItem value="recent" className="text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">Más recientes</SelectItem>
                                <SelectItem value="title" className="text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">Nombre</SelectItem>
                                <SelectItem value="expiry" className="text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">Próximo Vencimiento</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence mode="popLayout">
                        {filteredDocs.map((doc, idx) => {
                            const state = getDocumentState(doc);
                            const isExpired = state.tone === 'expired';
                            const metadataEntries = Object.entries(doc.metadata || {}).filter(([, value]) => value !== null && value !== '');
                            const reminderCount = reminders.filter((reminder) => reminder.document_id === doc.id && reminder.is_active).length;
                            const systemTags = buildSystemTags(doc);

                            return (
                                <motion.div
                                    key={doc.id}
                                    layout
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group"
                                >
                                    <Card className="h-full border-white/20 dark:border-slate-800/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl hover:bg-white/60 dark:hover:bg-slate-900/60 transition-all duration-500 overflow-hidden relative flex flex-col hover:shadow-2xl hover:shadow-amber-500/10 hover:-translate-y-1">
                                        {/* Holographic accent */}
                                        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-500/10 to-transparent blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />

                                        <CardContent className="p-6 flex-1 flex flex-col">
                                            <div className="flex justify-between items-start gap-4 mb-6">
                                                <div className="p-3 bg-amber-500/10 dark:bg-amber-400/10 rounded-2xl text-amber-600 dark:text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {doc.is_favorite && (
                                                        <Star className="w-5 h-5 text-amber-500 fill-current" />
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); void toggleFavorite(doc); }}
                                                        className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                                    >
                                                        <Star className={cn("w-4 h-4", !doc.is_favorite && "text-slate-400")} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="space-y-4 flex-1">
                                                <div>
                                                    <h3 className="font-black text-xl tracking-tight text-slate-900 dark:text-white line-clamp-1 group-hover:text-amber-600 transition-colors">
                                                        {doc.title}
                                                    </h3>
                                                    <div className="flex flex-wrap gap-2 mt-3">
                                                        <Badge className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-none px-3 font-bold text-[10px] tracking-wider uppercase">
                                                            {doc.category}
                                                        </Badge>
                                                        <Badge className={cn(
                                                            "border-none px-3 font-bold text-[10px] tracking-wider uppercase",
                                                            state.tone === 'expired' ? "bg-rose-500 text-white" :
                                                                state.tone === 'warning' ? "bg-amber-500 text-white" :
                                                                    state.tone === 'active' ? "bg-green-500 text-white" :
                                                                        "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                                        )}>
                                                            {state.label}
                                                        </Badge>
                                                    </div>
                                                </div>

                                                <div className="space-y-2 p-4 bg-slate-500/5 dark:bg-slate-400/5 rounded-2xl border border-white/10 dark:border-white/5">
                                                    {doc.issuer && (
                                                        <div className="flex items-center justify-between text-xs font-medium">
                                                            <span className="text-slate-400 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> EMISOR</span>
                                                            <span className="text-slate-700 dark:text-slate-200 truncate max-w-[120px]">{doc.issuer}</span>
                                                        </div>
                                                    )}
                                                    <div className="flex items-center justify-between text-xs font-medium">
                                                        <span className="text-slate-400 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> VENCIMIENTO</span>
                                                        <span className={cn("text-slate-700 dark:text-slate-200", isExpired && "text-rose-500 font-black")}>
                                                            {doc.expiration_date ? format(parseISO(doc.expiration_date), 'dd/MM/yyyy') : 'N/A'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {(doc.tags && doc.tags.length > 0) && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {doc.tags.slice(0, 3).map(tag => (
                                                            <span key={tag} className="text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-lg">
                                                                #{tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleOpenDetail(doc)}
                                                    className="flex-1 bg-amber-500/5 hover:bg-amber-500 text-amber-600 hover:text-white transition-all font-bold rounded-xl h-10"
                                                >
                                                    <Eye className="w-4 h-4 mr-2" /> VER DETALLES
                                                </Button>
                                                <div className="flex gap-1">
                                                    <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} className="h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => { setFormData(createFormFromDocument(doc)); setIsDialogOpen(true); }} className="h-10 w-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800">
                                                        <ExternalLink className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {filteredDocs.length === 0 && !loading ? <div className="text-center py-16 border-2 border-dashed border-amber-200 dark:border-amber-900 rounded-xl bg-amber-50/50 dark:bg-amber-900/10"><Shield className="w-16 h-16 mx-auto text-amber-300 dark:text-amber-800 mb-4" /><h3 className="text-xl font-medium text-slate-800 dark:text-slate-200">No hay documentos para esta vista</h3><p className="text-muted-foreground mb-6 max-w-sm mx-auto">Prueba otra categoria, ajusta la busqueda o guarda tu primer documento importante.</p><Button onClick={() => { setFormData(DEFAULT_FORM); setSelectedUploadFile(null); setAnalysisPreview(null); setAnalysisError(null); setIsDialogOpen(true); }} className="bg-amber-600 hover:bg-amber-700"><Lock className="w-4 h-4 mr-2" /> Guardar Documento</Button></div> : null}

                <DocumentDialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) { setSelectedUploadFile(null); setAnalysisPreview(null); setAnalysisError(null); setFormData(DEFAULT_FORM); } }} form={formData} setForm={setFormData} onSave={handleSave} onAnalyze={async (file) => { setSelectedUploadFile(file); return handleAnalyzeDocument(file); }} selectedFile={selectedUploadFile} setSelectedFile={setSelectedUploadFile} analysis={analysisPreview} analysisError={analysisError} analyzing={analyzingDocument} uploading={uploading} />
                <DocumentAlertSettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} settings={alertSettings} onChange={(settings) => { setAlertSettings(settings); }} />
            </div>

            <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
                <SheetContent className="sm:max-w-[500px] w-full p-0 flex flex-col border-white/20 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl shadow-2xl">
                    {selectedDocument ? (
                        <>
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/0 via-amber-500 to-amber-500/0 animate-pulse" />

                            <SheetHeader className="p-6 pb-2">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 border-none font-bold text-[10px] uppercase tracking-widest text-slate-500">
                                        FICHA TÉCNICA INTELIGENTE
                                    </Badge>
                                </div>
                                <SheetTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
                                    {selectedDocument.title}
                                </SheetTitle>
                                <SheetDescription className="text-slate-500 dark:text-slate-400 font-medium italic">
                                    Extraído y analizado por Quioba IA
                                </SheetDescription>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto px-6 py-4">
                                <Tabs defaultValue="intel" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 mb-6 bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-1">
                                        <TabsTrigger value="intel" className="rounded-lg text-[10px] font-black uppercase tracking-wider h-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-sm transition-all border-none">
                                            Inteligencia Quioba
                                        </TabsTrigger>
                                        <TabsTrigger value="versions" className="rounded-lg text-[10px] font-black uppercase tracking-wider h-8 data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900 shadow-sm transition-all border-none">
                                            Versiones y Renovación
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="intel" className="space-y-8 mt-0 focus-visible:outline-none">
                                        {/* Insights Panel */}
                                        {selectedDocument.summary && (
                                            <section className="relative p-6 rounded-3xl border border-amber-200/50 dark:border-amber-500/20 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/10 dark:to-orange-950/10">
                                                <Sparkles className="absolute top-4 right-4 w-5 h-5 text-amber-500 opacity-20" />
                                                <h4 className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <ScrollText className="w-4 h-4" /> Resumen de Inteligencia
                                                </h4>
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed italic">
                                                    "{selectedDocument.summary}"
                                                </p>
                                            </section>
                                        )}

                                        {/* Metadata Grid */}
                                        <section className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Datos Estructurados</h4>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                    <span className="block text-[10px] font-bold text-slate-400 mb-1">EMISOR</span>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                                        <Building2 className="w-3 h-3 text-amber-500" /> {selectedDocument.issuer || 'Desconocido'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                    <span className="block text-[10px] font-bold text-slate-400 mb-1">TIPO</span>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                                        <FileBadge2 className="w-3 h-3 text-amber-500" /> {selectedDocument.document_type || 'General'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                    <span className="block text-[10px] font-bold text-slate-400 mb-1">VENCIMIENTO</span>
                                                    <span className={cn(
                                                        "text-xs font-black truncate flex items-center gap-1.5",
                                                        getDocumentState(selectedDocument).tone === 'expired' ? "text-rose-500" : "text-slate-800 dark:text-slate-100"
                                                    )}>
                                                        <CalendarClock className="w-3 h-3 text-amber-500" />
                                                        {selectedDocument.expiration_date ? format(parseISO(selectedDocument.expiration_date), 'dd MMM yyyy') : 'No aplica'}
                                                    </span>
                                                </div>
                                                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                                    <span className="block text-[10px] font-bold text-slate-400 mb-1">ESTADO</span>
                                                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                                        <Flag className="w-3 h-3 text-amber-500" /> {LIFECYCLE_LABELS[selectedDocument.lifecycle_status] || 'Activo'}
                                                    </span>
                                                </div>
                                            </div>

                                            {selectedMetadataEntries.length > 0 && (
                                                <div className="pt-2">
                                                    <div className="space-y-2">
                                                        {selectedMetadataEntries.map(([key, value]) => (
                                                            <div key={key} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{formatMetadataLabel(key)}</span>
                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{String(value)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </section>

                                        {/* Chat Section */}
                                        <section className="flex flex-col h-[400px] rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 overflow-hidden">
                                            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                                                <h4 className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Plus className="w-3 h-3" /> Chatear con el documento
                                                </h4>
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                {chatMessages.length === 0 ? (
                                                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                                                        <div className="p-4 bg-amber-500/10 rounded-full">
                                                            <Plus className="w-6 h-6 text-amber-500" />
                                                        </div>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                                            ¿Tienes dudas sobre el documento? <br />
                                                            Pregúntame lo que quieras.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    chatMessages.map((msg, idx) => (
                                                        <div key={idx} className={cn(
                                                            "flex flex-col gap-1.5",
                                                            msg.role === 'user' ? "items-end" : "items-start"
                                                        )}>
                                                            <div className={cn(
                                                                "px-4 py-2 rounded-2xl text-xs font-medium max-w-[85%]",
                                                                msg.role === 'user'
                                                                    ? "bg-amber-500 text-white rounded-tr-none"
                                                                    : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none border border-slate-200/50 dark:border-slate-700/50"
                                                            )}>
                                                                {msg.content}
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                                {isChatLoading && (
                                                    <div className="flex justify-start">
                                                        <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-2xl rounded-tl-none animate-pulse">
                                                            <div className="flex gap-1">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" />
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.2s]" />
                                                                <div className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0.4s]" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div ref={chatEndRef} />
                                            </div>

                                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50">
                                                <div className="flex gap-2 relative">
                                                    <Input
                                                        placeholder="Ej. ¿Cuándo caduca exactamente?"
                                                        value={chatInput}
                                                        onChange={(e) => setChatInput(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                                                        className="bg-transparent border-slate-200 dark:border-slate-800 pr-10 focus-visible:ring-amber-500 h-10 rounded-xl"
                                                    />
                                                    <Button
                                                        size="icon"
                                                        onClick={() => handleChatSubmit()}
                                                        disabled={!chatInput.trim() || isChatLoading}
                                                        className="absolute right-1 top-1 h-8 w-8 bg-amber-500 hover:bg-amber-600 rounded-lg"
                                                    >
                                                        <Plus className="w-4 h-4 text-white" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </section>

                                        {/* Notes Section */}
                                        {selectedDocument.notes && (
                                            <section className="space-y-3">
                                                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Notas Personales</h4>
                                                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 text-sm italic text-slate-600 dark:text-slate-400 leading-relaxed shadow-sm">
                                                    "{selectedDocument.notes}"
                                                </div>
                                            </section>
                                        )}
                                    </TabsContent>

                                    <TabsContent value="versions" className="space-y-8 mt-0 focus-visible:outline-none">
                                        <section className="space-y-6">
                                            {getDocumentState(selectedDocument).tone === 'expired' && (
                                                <div className="p-5 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 space-y-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="p-3 bg-rose-500 rounded-2xl shadow-lg shadow-rose-500/30">
                                                            <AlertTriangle className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <h4 className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-widest">Renovación Crítica</h4>
                                                            <p className="text-[10px] font-bold text-rose-600/70 uppercase tracking-tight">El documento ha caducado. Quioba puede ayudarte.</p>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        onClick={() => window.open('https://www.citapreviadnie.es/', '_blank')}
                                                        className="w-full bg-rose-500 hover:bg-rose-600 text-white font-black text-[10px] uppercase tracking-widest h-12 rounded-2xl shadow-lg transition-transform active:scale-95 flex items-center gap-2 border-none"
                                                    >
                                                        <ExternalLink className="w-4 h-4" /> Tramitar Renovación Oficial
                                                    </Button>
                                                </div>
                                            )}

                                            <div className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 px-2">
                                                    <History className="w-3 h-3" /> Historial de Versiones
                                                </h4>

                                                <div className="space-y-2">
                                                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between group hover:border-amber-500/50 transition-all cursor-pointer" onClick={() => setVersionTarget(selectedDocument)}>
                                                        <div className="flex items-center gap-3">
                                                            <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg group-hover:bg-amber-500/10 transition-colors">
                                                                <FileText className="w-4 h-4 text-slate-500 group-hover:text-amber-500" />
                                                            </div>
                                                            <div>
                                                                <h5 className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tight">Versión 1 (Actual)</h5>
                                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Actualizado el {selectedDocument.created_at ? format(parseISO(selectedDocument.created_at), 'dd/MM/yyyy') : 'Hoy'}</p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="text-[8px] font-black uppercase tracking-widest bg-green-500/10 text-green-800 border-none">Vigente</Badge>
                                                    </div>

                                                    <p className="text-center py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic opacity-50">
                                                        No hay versiones anteriores registradas.
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="p-6 rounded-[2.5rem] bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-300 dark:border-slate-800 flex flex-col items-center justify-center text-center space-y-3">
                                                <div className="w-10 h-10 rounded-full bg-slate-200/50 dark:bg-slate-800 flex items-center justify-center">
                                                    <RefreshCcw className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-relaxed px-4">
                                                    Cuando subas una renovación, Quioba detectará automáticamente el encadenamiento de versiones.
                                                </p>
                                            </div>
                                        </section>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <SheetFooter className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col sm:flex-row gap-2">
                                <Button
                                    variant="outline"
                                    className="flex-1 rounded-xl h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-xs"
                                    onClick={() => handleViewFile(selectedDocument)}
                                >
                                    <Eye className="w-4 h-4 mr-2" /> ABRIR
                                </Button>
                                <Button
                                    className="flex-1 rounded-xl h-11 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20"
                                    onClick={() => {
                                        setFormData(createFormFromDocument(selectedDocument));
                                        setSelectedUploadFile(null);
                                        setAnalysisPreview(null);
                                        setAnalysisError(null);
                                        setIsDetailOpen(false);
                                        setIsDialogOpen(true);
                                    }}
                                >
                                    <ExternalLink className="w-4 h-4 mr-2" /> EDITAR
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="rounded-xl h-11 w-11 hover:bg-rose-500/10 hover:text-rose-500"
                                    onClick={() => handleDelete(selectedDocument.id, selectedDocument.file_url)}
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </SheetFooter>
                        </>
                    ) : null}
                </SheetContent>
            </Sheet>

            <Sheet open={isAlertsSheetOpen} onOpenChange={setIsAlertsSheetOpen}>
                <SheetContent className="sm:max-w-[440px] w-full p-0 flex flex-col border-white/20 dark:border-slate-800/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl shadow-2xl">
                    <SheetHeader className="p-6">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-500/20">
                                <BellRing className="w-5 h-5" />
                            </div>
                            <Badge variant="outline" className="bg-amber-100 dark:bg-amber-900/40 border-none font-bold text-[10px] uppercase tracking-widest text-amber-600">
                                ALERTAS ACTIVAS
                            </Badge>
                        </div>
                        <SheetTitle className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                            Sincronización Quioba
                        </SheetTitle>
                        <SheetDescription className="text-slate-500 dark:text-slate-400 font-medium">
                            Estas notificaciones se han generado automáticamente tras analizar tus documentos.
                        </SheetDescription>
                    </SheetHeader>

                    <div className="flex-1 overflow-y-auto px-6 space-y-4 py-4">
                        {alerts.map((alert, idx) => (
                            <motion.div
                                key={alert.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.05 * idx }}
                                className="p-4 rounded-2xl bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex gap-4 items-start group hover:bg-white dark:hover:bg-slate-800 transition-all cursor-default"
                            >
                                <div className={cn(
                                    "p-2 rounded-xl mt-0.5",
                                    alert.severity === 'high' ? "bg-rose-100 text-rose-600" :
                                        alert.severity === 'medium' ? "bg-amber-100 text-amber-600" :
                                            "bg-slate-100 text-slate-600"
                                )}>
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{alert.category || 'General'}</span>
                                        {alert.dueDate && (
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-full">
                                                {format(parseISO(alert.dueDate), 'dd MMM')}
                                            </span>
                                        )}
                                    </div>
                                    <h5 className="text-sm font-black text-slate-800 dark:text-slate-100 leading-tight mb-1">
                                        {alert.title}
                                    </h5>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                        {alert.description}
                                    </p>
                                </div>
                            </motion.div>
                        ))}

                        {alerts.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-center p-10 space-y-4">
                                <div className="p-6 bg-green-500/10 rounded-full">
                                    <ShieldCheck className="w-10 h-10 text-green-500" />
                                </div>
                                <h4 className="text-lg font-black text-slate-900 dark:text-white">¡Todo al día!</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                    No hay alertas críticas en tus documentos. Quioba seguirá vigilando por ti.
                                </p>
                            </div>
                        )}
                    </div>

                    <SheetFooter className="p-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <Button
                            variant="outline"
                            className="w-full rounded-xl h-11 border-slate-200 dark:border-slate-800 font-bold text-xs uppercase tracking-widest"
                            onClick={() => {
                                setIsAlertsSheetOpen(false);
                                setIsSettingsOpen(true);
                            }}
                        >
                            <Settings className="w-4 h-4 mr-2" /> CONFIGURAR ALERTAS
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {
                reminderTarget && (
                    <DocumentReminderDialog
                        documentId={reminderTarget.id}
                        documentTitle={reminderTarget.title}
                        open={Boolean(reminderTarget)}
                        onOpenChange={(open) => { if (!open) setReminderTarget(null); }}
                        onRemindersChange={async () => { await refreshDataAndSync(); }}
                    />
                )
            }
            {
                versionTarget && (
                    <DocumentVersionHistoryDialog
                        documentId={versionTarget.id}
                        documentTitle={versionTarget.title}
                        open={Boolean(versionTarget)}
                        onOpenChange={(open) => { if (!open) setVersionTarget(null); }}
                        onRestore={async () => {
                            await refreshDataAndSync();
                            const { data } = await supabase.from('documents').select('*').eq('id', versionTarget.id).maybeSingle();
                            if (data) setSelectedDocument(data as SecureDocument);
                        }}
                    />
                )
            }

            {/* Vault Unlock Dialog */}
            <Dialog open={isVaultDialogOpen} onOpenChange={setIsVaultDialogOpen}>
                <DialogContent className="sm:max-w-[400px] border-none bg-slate-900 text-white p-0 overflow-hidden shadow-2xl rounded-[32px]">
                    <div className="p-8 flex flex-col items-center text-center space-y-6">
                        <div className="relative">
                            {isVerifyingVault ? (
                                <motion.div
                                    animate={{
                                        scale: [1, 1.1, 1],
                                        rotate: [0, 5, -5, 0]
                                    }}
                                    transition={{ duration: 0.5, repeat: Infinity }}
                                    className="w-24 h-24 rounded-full border-4 border-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.3)]"
                                >
                                    <ShieldCheck className="w-12 h-12 text-amber-500" />
                                </motion.div>
                            ) : (
                                <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 shadow-inner">
                                    <Lock className="w-10 h-10 text-slate-400" />
                                </div>
                            )}

                            {isVerifyingVault && (
                                <motion.div
                                    initial={{ top: '0%' }}
                                    animate={{ top: '100%' }}
                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                    className="absolute left-0 w-full h-0.5 bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.8)] z-10"
                                />
                            )}
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-xl font-black tracking-tight uppercase">
                                {isVerifyingVault ? 'ESCANEANDO BIOMETRÍA...' : 'ACCESO A BÓVEDA'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-tight">
                                {isVerifyingVault ? 'IDENTIFICANDO PERFIL SEGURO' : 'Introduce el PIN para visualizar archivos sensibles'}
                            </p>
                        </div>

                        {!isVerifyingVault && (
                            <div className="w-full space-y-4">
                                <Input
                                    type="password"
                                    placeholder="••••"
                                    maxLength={4}
                                    value={vaultPin}
                                    onChange={(e) => setVaultPin(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-center text-2xl tracking-[1em] font-black h-14 focus:ring-amber-500 focus:border-amber-500 rounded-2xl"
                                />
                                <Button
                                    onClick={handleVaultUnlock}
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold h-12 rounded-2xl transition-all active:scale-95 shadow-lg shadow-amber-500/20 uppercase tracking-widest text-xs"
                                >
                                    Desbloquear Bóveda
                                </Button>
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Demo PIN: 1234</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Mobile Scan Bridge Dialog */}
            <Dialog open={isMobileScanDialogOpen} onOpenChange={setIsMobileScanDialogOpen}>
                <DialogContent className="sm:max-w-[450px] border-none bg-white dark:bg-slate-900 p-0 overflow-hidden shadow-2xl rounded-[40px]">
                    <div className="p-10 space-y-8 flex flex-col items-center">
                        <div className="text-center space-y-2">
                            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-none px-4 py-1.5 font-black text-[10px] uppercase tracking-widest mb-2">
                                Quioba Fast-Bridge 5.0
                            </Badge>
                            <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ESCANEADO EN TIEMPO REAL</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest opacity-70">Transfiere documentos desde tu cámara</p>
                        </div>

                        <div className="relative w-full aspect-square flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-800/30 rounded-[3rem] border-2 border-slate-100 dark:border-slate-800 shadow-inner group">
                            <AnimatePresence mode="wait">
                                {bridgeStatus === 'waiting' ? (
                                    <motion.div
                                        key="waiting"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9 }}
                                        className="flex flex-col items-center space-y-6"
                                    >
                                        <div className="bg-white p-6 rounded-3xl shadow-2xl transition-transform group-hover:scale-105 duration-500">
                                            {bridgeSessionCode ? (
                                                <div className="flex flex-col items-center gap-4">
                                                    <QRCodeSVG
                                                        value={`${window.location.origin}/apps/mi-hogar/documents/bridge?code=${bridgeSessionCode}`}
                                                        size={180}
                                                        level="H"
                                                        includeMargin={true}
                                                    />
                                                    <div className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-lg tracking-[0.2em]">
                                                        {bridgeSessionCode}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="w-[180px] h-[180px] bg-slate-100 animate-pulse rounded-xl" />
                                            )}
                                        </div>
                                        <p className="text-[10px] text-center px-4 font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
                                            Escanea con tu cámara para establecer el túnel seguro.
                                        </p>
                                    </motion.div>
                                ) : bridgeStatus === 'scanning' ? (
                                    <motion.div
                                        key="scanning"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="flex flex-col items-center space-y-6"
                                    >
                                        <div className="relative">
                                            <div className="w-40 h-40 rounded-full border-4 border-amber-500/20 flex items-center justify-center">
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                                                    className="absolute inset-0 border-t-4 border-amber-500 rounded-full"
                                                />
                                                <FileText className="w-16 h-16 text-amber-500" />
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <h4 className="font-black text-slate-900 dark:text-white uppercase tracking-widest mb-1">PROCESANDO...</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">IA Sincronizando encriptación</p>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="received"
                                        initial={{ opacity: 0, scale: 0.5 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center space-y-6"
                                    >
                                        <div className="w-32 h-32 bg-green-500 rounded-[2.5rem] flex items-center justify-center shadow-xl shadow-green-500/30 rotate-12">
                                            <CheckCircle2 className="w-16 h-16 text-white -rotate-12" />
                                        </div>
                                        <div className="text-center">
                                            <h4 className="font-black text-green-800 dark:text-green-400 uppercase tracking-widest mb-1">¡RECIBIDO!</h4>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sincronizado con tu bóveda</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="w-full space-y-4">
                            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <Activity className="w-5 h-5 text-amber-500" />
                                <div className="flex-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estado del Canal</p>
                                    <p className="text-[11px] font-bold dark:text-white">
                                        {bridgeStatus === 'waiting' ? 'Esperando conexión móvil...' : bridgeStatus === 'scanning' ? 'Transfiriendo archivo...' : 'Sincronización finalizada.'}
                                    </p>
                                </div>
                            </div>

                            <Button
                                onClick={() => setIsMobileScanDialogOpen(false)}
                                className="w-full h-14 rounded-3xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black text-[11px] uppercase tracking-widest border-none shadow-xl transition-all active:scale-95"
                            >
                                {bridgeStatus === 'received' ? 'LISTO' : 'CANCELAR'}
                            </Button>

                            {bridgeStatus === 'waiting' && (
                                <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-tight leading-normal px-4 opacity-60 italic">
                                    Nota: Tu móvil y este PC deben compartir la misma red local.
                                </p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

        </div >
    );
}





