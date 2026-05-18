'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow, isBefore } from 'date-fns';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/apps/mi-hogar/auth-context';
import { useAi } from '@/context/AiContext';
import { Plus, Search, FileText, Image as ImageIcon, Video, Trash2, ExternalLink, AlertCircle, Loader2, Mic, Square, Pencil, Grid3x3, List, Filter, X, Home, ChefHat, Droplet, Tv, Bed, Car, FolderOpen, Tag as TagIcon, SortAsc, Download, Share2, Bell, History, CloudOff, QrCode, Scan, Settings, Star, Images, StickyNote, Upload, Database, ListChecks, Zap, File, BookOpen, ShieldCheck, Wand2, Bot } from 'lucide-react';
import { es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';
import { exportManualToPDF } from '@/lib/export-manual-pdf';
import { ShareManualDialog } from './share-manual-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ReminderDialog } from './reminder-dialog';
import { VersionHistoryDialog } from './version-history-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { offlineStorage } from '@/lib/offline-storage';
import { QRScannerDialog } from './qr-scanner-dialog';
import { extractTextFromImage } from '@/lib/ocr-extract';
import { ManageRoomsDialog } from './manage-rooms-dialog';
import { ManualsDashboard } from './manuals-dashboard';
import { NotesDialog } from './notes-dialog';
import { ImageGalleryDialog } from './image-gallery-dialog';
import { MagicAssetScanner, AssetAnalysisData } from './magic-asset-scanner';
import { exportBackup, importBackup, exportManualsCsv } from '@/lib/backup-restore';
import { ChecklistDialog } from './checklist-dialog';
import { EnergyDialog } from './energy-dialog';
import { QrCodeDialog } from './qr-code-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type Manual = {
    id: string;
    title: string;
    category: string;
    description: string;
    type: 'text' | 'image' | 'video' | 'link' | 'audio';
    content: string;
    date: string;
    room_id?: string;
    updated_at?: string;
    tags?: string[];
    purchase_store?: string;
    purchase_date?: string;
    purchase_price?: number;
    spare_parts_url?: string;
    warranty_expires?: string;
    is_favorite?: boolean;
    room?: Room | null;
};

type Room = {
    id: string;
    name: string;
    icon: string;
    parent_id?: string;
};

const ROOM_ICONS: Record<string, any> = {
    'ChefHat': ChefHat,
    'Droplet': Droplet,
    'Tv': Tv,
    'Bed': Bed,
    'Car': Car,
    'Home': Home,
};

export default function ManualsGallery() {
    const [manuals, setManuals] = useState<Manual[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [search, setSearch] = useState('');
    const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
    const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState<'date' | 'name' | 'category'>('date');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    const { setIsOpen, setPendingPrompt } = useAi();

    // Form states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'text' | 'image' | 'video' | 'link' | 'audio'>('text');
    const [roomId, setRoomId] = useState<string>('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');

    // Separate draft states
    const [draftText, setDraftText] = useState('');
    const [draftVideo, setDraftVideo] = useState('');
    const [draftLink, setDraftLink] = useState('');
    const [draftImage, setDraftImage] = useState('');
    const [draftAudio, setDraftAudio] = useState('');
    const [draftPdf, setDraftPdf] = useState(''); // Base64 PDF data or URL
    const [draftPdfName, setDraftPdfName] = useState('');

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Audio Recorder State
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    const [viewManual, setViewManual] = useState<Manual | null>(null);
    const [showFullMedia, setShowFullMedia] = useState(false);
    const [shareManual, setShareManual] = useState<Manual | null>(null);
    const [reminderManual, setReminderManual] = useState<Manual | null>(null);
    const [versionManual, setVersionManual] = useState<Manual | null>(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [offlineCount, setOfflineCount] = useState(0);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [ocrProcessing, setOcrProcessing] = useState(false);
    const [notesManual, setNotesManual] = useState<Manual | null>(null);
    const [galleryImages, setGalleryImages] = useState<any[]>([]);
    const [showGallery, setShowGallery] = useState(false);
    const [galleryIndex, setGalleryIndex] = useState(0);
    const [checklistManual, setChecklistManual] = useState<Manual | null>(null);
    const [energyManual, setEnergyManual] = useState<Manual | null>(null);
    const [qrManual, setQrManual] = useState<Manual | null>(null);
    const [isListening, setIsListening] = useState(false);

    // Purchase info states
    const [purchaseStore, setPurchaseStore] = useState('');
    const [purchaseDate, setPurchaseDate] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [sparePartsUrl, setSparePartsUrl] = useState('');
    const [warrantyExpires, setWarrantyExpires] = useState('');
    const [showManageRooms, setShowManageRooms] = useState(false);
    const [manualContentImages, setManualContentImages] = useState<Record<string, string[]>>({});
    const [addModalTab, setAddModalTab] = useState<'magic' | 'manual'>('magic');

    useEffect(() => {
        if (user) {
            fetchRooms();
            fetchManuals();
        } else {
            setManuals([]);
            setRooms([]);
            setLoading(false);
        }
    }, [user]);

    const fetchRooms = async () => {
        try {
            const { data, error } = await supabase
                .from('rooms')
                .select('*')
                .order('name');

            if (error) {
                // If table doesn't exist yet, just silently ignore
                console.log('Rooms table not available yet (run migrations)');
                return;
            }
            setRooms(data || []);
        } catch (error) {
            console.error('Error fetching rooms:', error);
            // Don't throw, just continue without rooms
        }
    };

    const fetchManuals = async () => {
        try {
            setLoading(true);

            // Try to fetch with tags first
            let { data, error } = await supabase
                .from('manuals')
                .select(`
                    *,
                    manual_tags (tag)
                `)
                .order('created_at', { ascending: false });

            // If tags table doesn't exist, fetch without it
            if (error && error.message?.includes('manual_tags')) {
                console.log('Manual tags table not available yet, fetching without tags');
                const result = await supabase
                    .from('manuals')
                    .select('*')
                    .order('created_at', { ascending: false });

                data = result.data;
                error = result.error;
            }

            if (error) throw error;
            if (!data) {
                setManuals([]);
                return;
            }

            const mappedManuals: Manual[] = data.map((item: any) => ({
                id: item.id,
                title: item.title,
                category: item.category || '',
                description: item.description || '',
                type: item.type as any,
                content: item.content || '',
                date: new Date(item.created_at).toLocaleDateString(),
                room_id: item.room_id,
                updated_at: item.updated_at,
                tags: item.manual_tags?.map((t: any) => t.tag) || [],
                room: rooms.find((room) => room.id === item.room_id) || null
            }));

            setManuals(mappedManuals);

            // Extract images for gallery preview
            const imagesMap: Record<string, string[]> = {};
            mappedManuals.forEach(m => {
                try {
                    const images: string[] = [];
                    // Check if content is JSON
                    if (m.content && m.content.startsWith('{')) {
                        const json = JSON.parse(m.content);
                        if (json.image) images.push(json.image);
                        // Future: if we support multiple images in JSON
                        if (json.images && Array.isArray(json.images)) images.push(...json.images);
                    }
                    // Check if type is image and content is URL
                    else if (m.type === 'image' && m.content) {
                        images.push(m.content);
                    }

                    if (images.length > 0) {
                        imagesMap[m.id] = images;
                    }
                } catch (e) {
                    console.warn('Error parsing manual content for images:', m.id);
                }
            });
            setManualContentImages(imagesMap);
        } catch (error) {
            console.error('Error fetching manuals:', error);
            toast.error('Error al cargar los manuales');
        } finally {
            setLoading(false);
        }
    };

    const handlePdfChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            toast.error('Por favor sube un archivo PDF válido');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            toast.error('El PDF es demasiado grande (max 5MB)');
            return;
        }

        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                const pdfData = event.target?.result as string;
                setDraftPdf(pdfData);
                setDraftPdfName(file.name);
                toast.success('PDF cargado correctamente');
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('Error reading PDF:', error);
            toast.error('Error al leer el PDF');
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            // Compress image automatically
            const compressedFile = await imageCompression(file, {
                maxSizeMB: 0.5,
                maxWidthOrHeight: 1920,
                useWebWorker: true
            });

            const reader = new FileReader();
            reader.onload = async (event) => {
                const imageData = event.target?.result as string;
                setDraftImage(imageData);
                toast.success('Imagen comprimida y cargada');

                // Auto-extract text via OCR if text field is empty
                if (!draftText && !ocrProcessing) {
                    setOcrProcessing(true);
                    const extractedText = await extractTextFromImage(imageData);
                    if (extractedText) {
                        setDraftText(extractedText);
                    }
                    setOcrProcessing(false);
                }
            };
            reader.readAsDataURL(compressedFile);
        } catch (error) {
            console.error('Error compressing image:', error);
            toast.error('Error al procesar la imagen');
        }
    };

    const addTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const saveManualTags = async (manualId: string, tagsList: string[]) => {
        try {
            // Delete existing tags
            await supabase
                .from('manual_tags')
                .delete()
                .eq('manual_id', manualId);

            // Insert new tags
            if (tagsList.length > 0) {
                const tagInserts = tagsList.map(tag => ({
                    manual_id: manualId,
                    tag: tag
                }));

                await supabase
                    .from('manual_tags')
                    .insert(tagInserts);
            }
        } catch (error) {
            console.error('Error saving tags:', error);
        }
    };

    const handleScanComplete = (data: AssetAnalysisData, file: File) => {
        setTitle(data.title || '');
        setCategory(data.category || '');
        setPurchasePrice(data.price ? data.price.toString() : '');
        setPurchaseDate(data.date || '');
        setPurchaseStore(data.store || '');
        setDescription(data.summary || '');

        if (data.date && data.warranty_years) {
            const d = new Date(data.date);
            d.setFullYear(d.getFullYear() + data.warranty_years);
            setWarrantyExpires(d.toISOString().split('T')[0]);
        }

        // Cargar imagen extraída
        const reader = new FileReader();
        reader.onloadend = () => {
            setDraftImage(reader.result as string);
            setType('image');
        };
        reader.readAsDataURL(file);

        setAddModalTab('manual'); // cambiar al editor para poder verificar
    };

    const addManual = async () => {
        if (!title || !category || !user) {
            toast.error('Título y categoría son obligatorios');
            return;
        }

        const contentObj = {
            text: draftText,
            video: draftVideo,
            link: draftLink,
            image: draftImage,
            audio: draftAudio,
            pdf: draftPdf,
            pdfName: draftPdfName
        };

        const finalContent = JSON.stringify(contentObj);

        try {
            if (editingId) {
                const { data, error } = await supabase
                    .from('manuals')
                    .update({
                        title,
                        category,
                        description,
                        type,
                        content: finalContent,
                        room_id: roomId || null,
                        purchase_store: purchaseStore || null,
                        purchase_date: purchaseDate || null,
                        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
                        warranty_expires: warrantyExpires || null,
                    })
                    .eq('id', editingId)
                    .select()
                    .single();

                if (error) throw error;

                await saveManualTags(editingId, tags);

                toast.success('Activo actualizado satisfactoriamente');
            } else {
                const { data, error } = await supabase
                    .from('manuals')
                    .insert([{
                        user_id: user.id,
                        title,
                        category,
                        description,
                        type,
                        content: finalContent,
                        room_id: roomId || null,
                        purchase_store: purchaseStore || null,
                        purchase_date: purchaseDate || null,
                        purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
                        warranty_expires: warrantyExpires || null,
                    }])
                    .select()
                    .single();

                if (error) throw error;

                await saveManualTags(data.id, tags);

                toast.success('Manual añadido correctamente');
            }

            setIsDialogOpen(false);
            resetForm();
            fetchManuals();
        } catch (error) {
            console.error('Error saving manual:', error);
            toast.error('Error al guardar el manual');
        }
    };

    const handleEdit = (manual: Manual, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setEditingId(manual.id);
        setTitle(manual.title);
        setCategory(manual.category);
        setDescription(manual.description);
        setType(manual.type);
        setRoomId(manual.room_id || '');
        setTags(manual.tags || []);

        setPurchaseStore(manual.purchase_store || '');
        setPurchaseDate(manual.purchase_date || '');
        setPurchasePrice(manual.purchase_price ? manual.purchase_price.toString() : '');
        setWarrantyExpires(manual.warranty_expires || '');

        setAddModalTab('manual');

        try {
            if (manual.content.startsWith('{')) {
                const parsed = JSON.parse(manual.content);
                setDraftText(parsed.text || '');
                setDraftVideo(parsed.video || '');
                setDraftLink(parsed.link || '');
                setDraftImage(parsed.image || '');
                setDraftAudio(parsed.audio || '');
            } else {
                resetForm();
                setEditingId(manual.id);
                setTitle(manual.title);
                setCategory(manual.category);
                setDescription(manual.description);
                setType(manual.type);
                setRoomId(manual.room_id || '');
                setTags(manual.tags || []);

                switch (manual.type) {
                    case 'text': setDraftText(manual.content); break;
                    case 'video': setDraftVideo(manual.content); break;
                    case 'link': setDraftLink(manual.content); break;
                    case 'image': setDraftImage(manual.content); break;
                    case 'audio': setDraftAudio(manual.content); break;
                }
            }
        } catch (e) {
            setDraftText(manual.content);
        }

        setIsDialogOpen(true);
    };

    const toggleFavorite = async (id: string, currentState: boolean, e?: React.MouseEvent) => {
        e?.stopPropagation();

        try {
            const { error } = await supabase
                .from('manuals')
                .update({ is_favorite: !currentState })
                .eq('id', id);

            if (error) throw error;

            setManuals(manuals.map(m =>
                m.id === id ? { ...m, is_favorite: !currentState } : m
            ));

            toast.success(!currentState ? 'Añadido a favoritos' : 'Eliminado de favoritos');
        } catch (error) {
            console.error('Error toggling favorite:', error);
            toast.error('Error al actualizar favorito');
        }
    };

    const deleteManual = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (!confirm('¿Eliminar este manual?')) return;

        try {
            const { error } = await supabase
                .from('manuals')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setManuals(manuals.filter(m => m.id !== id));
            toast.success('Manual eliminado');
        } catch (error) {
            console.error('Error deleting manual:', error);
            toast.error('Error al eliminar el manual');
        }
    };

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setCategory('');
        setDescription('');
        setType('text');
        setRoomId('');
        setTags([]);
        setTagInput('');
        setDraftText('');
        setDraftVideo('');
        setDraftLink('');
        setDraftImage('');
        setDraftAudio('');
        setDraftPdf('');
        setDraftPdfName('');
        setPurchaseStore('');
        setPurchaseDate('');
        setPurchasePrice('');
        setSparePartsUrl('');
        setWarrantyExpires('');
        setAddModalTab('magic');
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Audio = reader.result as string;
                    setDraftAudio(base64Audio);
                };
                reader.readAsDataURL(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            toast.error('No se pudo acceder al micrófono');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const toggleTypeFilter = (filterType: string) => {
        if (selectedTypes.includes(filterType)) {
            setSelectedTypes(selectedTypes.filter(t => t !== filterType));
        } else {
            setSelectedTypes([...selectedTypes, filterType]);
        }
    };

    // Enhanced search and filter logic
    const filteredManuals = manuals
        .filter(m => {
            // Filter by favorites
            if (showFavoritesOnly && !m.is_favorite) {
                return false;
            }

            // Room filter
            if (selectedRoom && m.room_id !== selectedRoom) return false;

            // Type filter
            if (selectedTypes.length > 0 && !selectedTypes.includes(m.type)) return false;

            // Search filter (enhanced)
            if (search) {
                const searchLower = search.toLowerCase();
                const matchesTitle = m.title.toLowerCase().includes(searchLower);
                const matchesDescription = m.description.toLowerCase().includes(searchLower);
                const matchesCategory = m.category.toLowerCase().includes(searchLower);
                const matchesTags = m.tags?.some(tag => tag.toLowerCase().includes(searchLower));

                // Search in text content
                let matchesContent = false;
                try {
                    if (m.content.startsWith('{')) {
                        const parsed = JSON.parse(m.content);
                        matchesContent = parsed.text?.toLowerCase().includes(searchLower);
                    } else if (m.type === 'text') {
                        matchesContent = m.content.toLowerCase().includes(searchLower);
                    }
                } catch (e) { }

                if (!matchesTitle && !matchesDescription && !matchesCategory && !matchesTags && !matchesContent) {
                    return false;
                }
            }

            return true;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case 'name':
                    return a.title.localeCompare(b.title);
                case 'category':
                    return a.category.localeCompare(b.category);
                case 'date':
                default:
                    return new Date(b.updated_at || b.date).getTime() - new Date(a.updated_at || a.date).getTime();
            }
        });

    const startVoiceSearch = () => {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
            const recognition = new SpeechRecognition();
            recognition.lang = 'es-ES';
            recognition.continuous = false;
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);

            recognition.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setSearch(transcript);
                toast.success(`Buscando: ${transcript}`);
            };

            recognition.start();
        } else {
            toast.error('Tu navegador no soporta búsqueda por voz');
        }
    };

    // Get content type indicators
    // Helper for content type icons
    const getContentTypeIcon = (type: string) => {
        switch (type) {
            case 'video': return <Video className="h-4 w-4" />;
            case 'image': return <ImageIcon className="h-4 w-4" />;
            case 'text': return <FileText className="h-4 w-4" />;
            case 'audio': return <Mic className="h-4 w-4" />;
            case 'link': return <ExternalLink className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    // Helper for room icons
    const getRoomIcon = (iconName: string | undefined) => {
        if (!iconName) return '🏠'; // Default
        const icons: Record<string, string> = {
            'ChefHat': '🍳',
            'Utensils': '🍽️',
            'Sofa': '🛋️',
            'Tv': '📺',
            'Bed': '🛏️',
            'Bath': '🛁',
            'Droplet': '💧',
            'Briefcase': '💼',
            'Monitor': '🖥️',
            'Car': '🚗',
            'Wrench': '🔧',
            'Flower': '🌻',
            'Sun': '☀️',
            'Warehouse': '📦',
            'Box': '📦',
            'Gamepad': '🎮',
            'Music': '🎵',
            'Book': '📚',
            'Dumbbell': '🏋️',
            'Zap': '⚡'
        };
        return icons[iconName] || '🏠';
    };

    const getContentTypes = (manual: Manual): string[] => {
        const types: string[] = [];
        try {
            if (manual.content.startsWith('{')) {
                const parsed = JSON.parse(manual.content);
                if (parsed.text) types.push('text');
                if (parsed.image) types.push('image');
                if (parsed.video) types.push('video');
                if (parsed.audio) types.push('audio');
                if (parsed.link) types.push('link');
            } else {
                types.push(manual.type);
            }
        } catch (e) {
            types.push(manual.type);
        }
        return types;
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Statistics Dashboard / Bento Grid */}
            <ManualsDashboard selectedRoom={selectedRoom} onSelectRoom={setSelectedRoom} />

            {/* Search and Filters Bar */}
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="relative flex-1 max-w-md group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500 group-focus-within:scale-110 transition-transform" />
                    <Input
                        placeholder="Buscar en manuales..."
                        className="pl-11 h-12 border-2 border-slate-200 focus:border-green-500 focus:ring-2 focus:ring-green-200 transition-all shadow-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className={`absolute right-2 top-1/2 -translate-y-1/2 hover:bg-green-50 ${isListening ? 'text-red-500 animate-pulse' : 'text-slate-400'}`}
                        onClick={startVoiceSearch}
                        title="Búsqueda por voz"
                    >
                        <Mic className="h-5 w-5" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Toggle */}
                    <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            className={`h-8 px-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-green-800 shadow-sm' : 'text-slate-500 hover:text-green-800'}`}
                            title="Vista Cuadrícula"
                        >
                            <Grid3x3 className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewMode('list')}
                            className={`h-8 px-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-green-800 shadow-sm' : 'text-slate-500 hover:text-green-800'}`}
                            title="Vista Lista"
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Type Filters */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <Filter className="h-4 w-4" />
                                Filtrar
                                {selectedTypes.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                                        {selectedTypes.length}
                                    </Badge>
                                )}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Tipo de Contenido</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleTypeFilter('text')}>
                                <FileText className="h-4 w-4 mr-2" />
                                Texto {selectedTypes.includes('text') && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleTypeFilter('image')}>
                                <ImageIcon className="h-4 w-4 mr-2" />
                                Imagen {selectedTypes.includes('image') && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleTypeFilter('video')}>
                                <Video className="h-4 w-4 mr-2" />
                                Vídeo {selectedTypes.includes('video') && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleTypeFilter('audio')}>
                                <Mic className="h-4 w-4 mr-2" />
                                Audio {selectedTypes.includes('audio') && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleTypeFilter('link')}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Enlace {selectedTypes.includes('link') && '✓'}
                            </DropdownMenuItem>
                            {selectedTypes.length > 0 && (
                                <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => setSelectedTypes([])}>
                                        <X className="h-4 w-4 mr-2" />
                                        Limpiar filtros
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <SortAsc className="h-4 w-4" />
                                Ordenar
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSortBy('date')}>
                                Fecha {sortBy === 'date' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('name')}>
                                Nombre {sortBy === 'name' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSortBy('category')}>
                                Categoría {sortBy === 'category' && '✓'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel>Backup</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => exportBackup()}>
                                <Database className="h-4 w-4 mr-2" />
                                Exportar Backup (JSON)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportManualsCsv()}>
                                <Download className="h-4 w-4 mr-2" />
                                Exportar CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => document.getElementById('backup-file-input')?.click()}>
                                <Upload className="h-4 w-4 mr-2" />
                                Importar Backup
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>



                    {/* Add Asset Modal */}
                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button onClick={resetForm} className="bg-green-800 hover:bg-green-900 text-white shadow-lg shadow-green-200 hover:shadow-xl hover:shadow-green-300 transition-all">
                                <Plus className="mr-2 h-4 w-4" /> Añadir a tu Guía
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900 border-none shadow-2xl rounded-3xl">
                            <DialogHeader className="px-6 pt-6 pb-2">
                                <DialogTitle className="text-2xl font-black flex items-center gap-3 text-slate-900 dark:text-white">
                                    <div className="p-2 bg-green-500/10 rounded-xl">
                                        <BookOpen className="h-6 w-6 text-green-500" />
                                    </div>
                                    {editingId ? 'Editar entrada' : '¿Qué quieres documentar?'}
                                </DialogTitle>
                                {!editingId && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 ml-14">
                                        Piscina, lavadora, caldera, jardín, coche... cualquier cosa de tu hogar.
                                    </p>
                                )}
                            </DialogHeader>

                            <div className="flex-1 overflow-y-auto w-full p-2">
                                <Tabs value={addModalTab} onValueChange={(val: any) => setAddModalTab(val)}>
                                    {!editingId && (
                                        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 p-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-xl">
                                            <TabsTrigger value="magic" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-green-800 font-bold transition-all data-[state=active]:shadow-sm">
                                                <Wand2 className="h-4 w-4 mr-2" /> Tengo el ticket/factura
                                            </TabsTrigger>
                                            <TabsTrigger value="manual" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-slate-900 font-bold transition-all data-[state=active]:shadow-sm">
                                                <ListChecks className="h-4 w-4 mr-2" /> Lo describo yo
                                            </TabsTrigger>
                                        </TabsList>
                                    )}

                                    <TabsContent value="magic" className="m-0 mt-2">
                                        <div className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-950 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                            <MagicAssetScanner onScanComplete={handleScanComplete} />
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="manual" className="space-y-6 m-0">
                                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-6">
                                            <h4 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <FileText className="h-4 w-4" /> Datos Principales
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">¿Cómo se llama? *</Label>
                                                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Piscina, Lavadora Bosch, Caldera..." className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">¿Qué tipo de cosa es? *</Label>
                                                    <Select value={category} onValueChange={setCategory}>
                                                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner">
                                                            <SelectValue placeholder="Selecciona..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="Electrodoméstico">🍽️ Electrodoméstico (lavadora, lavavajillas...)</SelectItem>
                                                            <SelectItem value="Climatización">❄️ Climatización (caldera, AA, calefacción...)</SelectItem>
                                                            <SelectItem value="Piscina/Jardín">🏊 Piscina / Jardín</SelectItem>
                                                            <SelectItem value="Vehículo">🚗 Vehículo / Coche</SelectItem>
                                                            <SelectItem value="Tecnología">💻 Tecnología (TV, router, PC...)</SelectItem>
                                                            <SelectItem value="Instalación">🔧 Instalación (fontanería, electricidad...)</SelectItem>
                                                            <SelectItem value="Mueble">🪑 Mueble / Equipamiento</SelectItem>
                                                            <SelectItem value="Otro">📦 Otro</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">¿En qué espacio está?</Label>
                                                    <Select value={roomId} onValueChange={setRoomId}>
                                                        <SelectTrigger className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner">
                                                            <SelectValue placeholder="Asignar al espacio..." />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Sin habitación</SelectItem>
                                                            {rooms.map(room => {
                                                                const Icon = ROOM_ICONS[room.icon] || Home;
                                                                return (
                                                                    <SelectItem key={room.id} value={room.id}>
                                                                        <div className="flex items-center gap-2">
                                                                            <Icon className="h-4 w-4 text-green-800" />
                                                                            {room.name}
                                                                        </div>
                                                                    </SelectItem>
                                                                );
                                                            })}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">Descripción breve</Label>
                                                    <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. Bomba de calor, 8kg, A+++..." className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">Fecha de Compra</Label>
                                                    <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">Precio / Valor (€)</Label>
                                                    <Input type="number" step="0.01" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="0.00" className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold">Tienda</Label>
                                                    <Input value={purchaseStore} onChange={(e) => setPurchaseStore(e.target.value)} placeholder="MediaMarkt, Amazon..." className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-slate-600 dark:text-slate-400 font-bold text-green-800">Fin de Garantía</Label>
                                                    <Input type="date" value={warrantyExpires} onChange={(e) => setWarrantyExpires(e.target.value)} className="bg-green-50 dark:bg-green-950/20 border-none shadow-inner text-green-900" />
                                                </div>
                                            </div>

                                            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                                                <Label className="text-slate-600 dark:text-slate-400 font-bold">Etiquetas Rápidas</Label>
                                                <div className="flex gap-2">
                                                    <Input
                                                        value={tagInput}
                                                        onChange={(e) => setTagInput(e.target.value)}
                                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                                        placeholder="Cargador, A+++, Regalo..."
                                                        className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner flex-1"
                                                    />
                                                    <Button type="button" onClick={addTag} size="icon" className="bg-green-100 hover:bg-green-200 text-green-900 shrink-0">
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                {tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {tags.map(tag => (
                                                            <Badge key={tag} variant="secondary" className="gap-1 bg-white dark:bg-slate-800 shadow-sm border border-slate-200">
                                                                <TagIcon className="h-3 w-3 text-slate-400" />
                                                                {tag}
                                                                <X
                                                                    className="h-3 w-3 cursor-pointer hover:text-destructive text-slate-400"
                                                                    onClick={() => removeTag(tag)}
                                                                />
                                                            </Badge>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                                            <div className="flex items-center gap-2">
                                                <StickyNote className="h-4 w-4 text-green-500" />
                                                <Label className="text-sm font-black text-slate-700 dark:text-slate-300">Instrucciones / Cómo funciona</Label>
                                            </div>
                                            <p className="text-xs text-slate-500">
                                                Escribe aquí cómo usar esto, qué hay que hacer para el mantenimiento, pasos a seguir... Para que tú o cualquier miembro del hogar lo sepa.
                                            </p>
                                        </div>

                                        {/* TABS MULTIMEDIA (Ticket/Manual PDF) */}
                                        <div className="bg-white dark:bg-slate-950 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                                            <h4 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                                                <Images className="h-4 w-4" /> Adjuntar Foto o Instrucciones
                                            </h4>

                                            <Tabs defaultValue="image" value={type} onValueChange={(v: any) => setType(v as any)}>
                                                <TabsList className="grid w-full grid-cols-5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                                                    <TabsTrigger value="image" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Foto</TabsTrigger>
                                                    <TabsTrigger value="text" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Ayuda</TabsTrigger>
                                                    <TabsTrigger value="video" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Vídeo</TabsTrigger>
                                                    <TabsTrigger value="audio" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Voz</TabsTrigger>
                                                    <TabsTrigger value="link" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm">Link</TabsTrigger>
                                                </TabsList>

                                                <TabsContent value="image" className="pt-4 space-y-4">
                                                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group" onClick={() => fileInputRef.current?.click()}>
                                                        <ImageIcon className="mx-auto h-12 w-12 text-slate-400 group-hover:text-green-500 transition-colors mb-3" />
                                                        <p className="text-sm text-slate-500 font-medium">Click para adjuntar Ticket o Manual 📸</p>
                                                        <input
                                                            type="file"
                                                            ref={fileInputRef}
                                                            className="hidden"
                                                            accept="image/*"
                                                            onChange={handleFileChange}
                                                        />
                                                    </div>
                                                    {draftImage && (
                                                        <div className="relative aspect-video rounded-xl overflow-hidden border shadow-sm group">
                                                            <img src={draftImage} alt="Preview" className="object-cover w-full h-full" />
                                                            <Button size="icon" variant="destructive" className="absolute top-2 right-2 h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); setDraftImage(''); }}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TabsContent>

                                                <TabsContent value="text" className="pt-4">
                                                    <Textarea
                                                        className="min-h-[150px] bg-slate-50 dark:bg-slate-900 border-none shadow-inner"
                                                        value={draftText}
                                                        onChange={(e) => setDraftText(e.target.value)}
                                                        placeholder="Explica cómo funciona, cómo arrancar, dónde está la llave de paso, qué hay que revisar cada año... Cualquier cosa que quieras recordar."
                                                    />
                                                </TabsContent>

                                                <TabsContent value="video" className="pt-4 space-y-4">
                                                    <div className="space-y-2">
                                                        <Label>URL del Vídeo de Youtube de Soporte</Label>
                                                        <Input value={draftVideo} onChange={(e) => setDraftVideo(e.target.value)} placeholder="https://youtube.com/..." className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                    </div>
                                                    <p className="text-xs text-muted-foreground flex items-center">
                                                        <AlertCircle className="h-3 w-3 mr-1" />
                                                        Solo enlaces externos soportados por ahora.
                                                    </p>
                                                </TabsContent>

                                                <TabsContent value="audio" className="pt-4 space-y-4">
                                                    <div className="flex flex-col items-center justify-center space-y-4 border-2 border-dashed rounded-xl p-8 bg-slate-50 border-slate-200">
                                                        {!isRecording ? (
                                                            <Button
                                                                variant="outline"
                                                                className="h-16 w-16 rounded-full border-green-500 hover:bg-green-50 hover:text-green-800 shadow-md"
                                                                onClick={startRecording}
                                                            >
                                                                <Mic className="h-8 w-8 text-green-500" />
                                                            </Button>
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2">
                                                                <div className="animate-pulse text-rose-500 font-bold mb-2">Grabando...</div>
                                                                <Button
                                                                    variant="destructive"
                                                                    className="h-16 w-16 rounded-full shadow-lg shadow-rose-200"
                                                                    onClick={stopRecording}
                                                                >
                                                                    <Square className="h-8 w-8 fill-current" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                        <p className="text-sm font-medium text-slate-500">
                                                            {isRecording ? 'Pulsa para detener' : 'Pulsa para grabar nota de voz'}
                                                        </p>
                                                    </div>
                                                    {draftAudio && (
                                                        <div className="w-full bg-slate-100 p-4 rounded-xl flex items-center justify-between gap-4 border border-slate-200 shadow-sm">
                                                            <div className="flex-1">
                                                                <audio controls src={draftAudio} className="w-full h-10" />
                                                            </div>
                                                            <Button size="icon" variant="ghost" className="h-10 w-10 shrink-0 text-rose-500 hover:bg-rose-100 rounded-full" onClick={(e) => { e.stopPropagation(); setDraftAudio(''); }}>
                                                                <Trash2 className="h-5 w-5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TabsContent>

                                                <TabsContent value="link" className="pt-4 space-y-4">
                                                    <div className="space-y-2">
                                                        <Label>Enlace al Manual del Fabricante</Label>
                                                        <Input value={draftLink} onChange={(e) => setDraftLink(e.target.value)} placeholder="https://..." className="bg-slate-50 dark:bg-slate-900 border-none shadow-inner" />
                                                    </div>
                                                </TabsContent>
                                            </Tabs>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>

                            <DialogFooter className="bg-white dark:bg-slate-950 p-4 border-t border-slate-100 dark:border-slate-800 rounded-b-3xl">
                                {addModalTab === 'manual' ? (
                                    <div className="flex w-full justify-between items-center">
                                        <Button variant="ghost" className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl px-6 font-bold" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                                        <Button className="bg-green-800 hover:bg-green-900 text-white shadow-lg shadow-green-200 rounded-xl px-8 font-bold text-md" onClick={addManual}>
                                            <Zap className="h-4 w-4 mr-2" />
                                            {editingId ? 'Guardar Cambios' : 'Guardar en mi Guía'}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex w-full justify-start mt-2">
                                        <Button variant="ghost" className="text-slate-500" onClick={() => setIsDialogOpen(false)}>Cancelar Carga</Button>
                                    </div>
                                )}
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* Manuals Display */}
            {
                loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-16 w-16 rounded-full border-4 border-green-200 border-t-green-800 animate-spin"></div>
                            <p className="text-muted-foreground font-medium">Cargando manuales...</p>
                        </div>
                    </div>
                ) : filteredManuals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4">
                        <div className="rounded-full bg-green-50 p-6 mb-6">
                            <FileText className="h-16 w-16 text-green-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-2">No hay manuales</h3>
                        <p className="text-muted-foreground text-center mb-6 max-w-md">
                            {search || selectedRoom || selectedTypes.length > 0
                                ? '¡No se encontraron manuales con estos filtros'
                                : '¡Comienza añadiendo tu primer manual!'}
                        </p>
                        {!search && !selectedRoom && selectedTypes.length === 0 && (
                            <Button
                                onClick={() => setIsDialogOpen(true)}
                                className="bg-gradient-to-r from-green-800 to-green-500 hover:from-green-900 hover:to-green-800 text-white shadow-lg shadow-green-200 hover:shadow-xl transition-all"
                                size="lg"
                            >
                                <Plus className="mr-2 h-5 w-5" />
                                Crear Primer Manual
                            </Button>
                        )}
                    </div>
                ) : viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredManuals.map(manual => {
                                const isExpiredWarranty = manual.warranty_expires && isBefore(new Date(manual.warranty_expires), new Date());
                                return (
                                    <motion.div
                                        key={manual.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        className="group relative rounded-3xl overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-white/20 dark:border-slate-800/40 hover:border-green-400/50 dark:hover:border-green-500/30 shadow-[0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 flex flex-col"
                                    >
                                        <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 group/image flex items-center justify-center overflow-hidden">
                                            {/* Preview Content */}
                                            {manual.type === 'image' && manual.content ? (
                                                <img
                                                    src={manual.content}
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover/image:scale-110"
                                                    onError={(e) => {
                                                        e.currentTarget.style.display = 'none';
                                                        e.currentTarget.parentElement?.classList.add('fallback-icon');
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex flex-col items-center justify-center text-slate-400 group-hover/image:text-green-500/50 transition-colors drop-shadow-sm">
                                                    {manual.type === 'video' && <Video className="h-16 w-16" />}
                                                    {manual.type === 'audio' && <Mic className="h-16 w-16" />}
                                                    {(manual.type === 'text' || manual.type === 'link') && <FileText className="h-16 w-16" />}
                                                    {manual.type === 'image' && !manual.content && <ImageIcon className="h-16 w-16" />}
                                                </div>
                                            )}

                                            {/* Status Overlays */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 pointer-events-none" />

                                            {/* Action Buttons Top Right */}
                                            <div className="absolute top-3 right-3 flex flex-col gap-2 transform translate-x-12 opacity-0 group-hover/image:translate-x-0 group-hover/image:opacity-100 transition-all duration-300">
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full bg-white/95 dark:bg-slate-800/95 hover:bg-green-50 dark:hover:bg-green-950/50 hover:text-green-800 shadow-xl backdrop-blur transition-transform hover:scale-110 border-none"
                                                    onClick={(e) => { e.stopPropagation(); handleEdit(manual); }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-9 w-9 rounded-full bg-white/95 dark:bg-slate-800/95 hover:bg-rose-50 dark:hover:bg-rose-900/50 hover:text-rose-600 shadow-xl backdrop-blur text-rose-500 transition-transform hover:scale-110 border-none"
                                                    onClick={(e) => deleteManual(manual.id, e)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>

                                            {/* Badges Overlay Top Left */}
                                            <div className="absolute top-3 left-3 flex flex-col gap-2 items-start">
                                                {manual.warranty_expires && (
                                                    <Badge className={`shadow-md px-2.5 py-0.5 text-[10px] uppercase font-black tracking-wider backdrop-blur border border-white/20 ${isExpiredWarranty ? 'bg-rose-500/90 hover:bg-rose-500 text-white shadow-rose-500/20' : 'bg-green-500/90 hover:bg-green-500 text-white shadow-green-500/20'}`}>
                                                        {isExpiredWarranty ? 'Garantía Expirada' : `Garantía: ${new Date(manual.warranty_expires).getFullYear()}`}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Quick Actions Bottom */}
                                            <div className="absolute bottom-3 right-3 flex gap-2">
                                                <Button
                                                    className="h-9 w-9 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-lg hover:scale-105 transition-all opacity-0 group-hover/image:opacity-100 transform translate-y-2 group-hover/image:translate-y-0 duration-300 delay-75 border-none"
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => { e.stopPropagation(); setQrManual(manual); }}
                                                >
                                                    <QrCode className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    className={`h-9 w-9 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 shadow-lg transition-all transform border-none ${manual.is_favorite ? 'opacity-100 text-yellow-500' : 'opacity-0 text-slate-400 dark:text-slate-300 group-hover/image:opacity-100 group-hover/image:translate-y-0 translate-y-2'}`}
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => toggleFavorite(manual.id, !!manual.is_favorite, e)}
                                                >
                                                    <Star className={`h-4 w-4 ${manual.is_favorite ? 'fill-current' : ''}`} />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="p-5 flex-1 flex flex-col relative z-20">
                                            <div className="flex justify-between items-start gap-4 mb-2">
                                                <h3 className="font-black text-[1.1rem] leading-tight line-clamp-1 text-slate-800 dark:text-white group-hover:text-green-500 transition-colors drop-shadow-sm tracking-tight">
                                                    {manual.title}
                                                </h3>
                                                <Badge variant="outline" className="shrink-0 bg-slate-100/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold tracking-wider text-[9px] uppercase shadow-sm">
                                                    {manual.category}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-bold mb-4">
                                                <span className="text-sm">{manual.room?.icon ? getRoomIcon(manual.room.icon) : '🏠'}</span>
                                                <span className="uppercase tracking-wider">{manual.room?.name || 'Inventario General'}</span>
                                            </div>

                                            <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800/50 flex gap-2">
                                                <Button
                                                    className="flex-1 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-green-950/40 text-slate-700 dark:text-slate-300 hover:text-green-900 dark:hover:text-green-400 font-bold shadow-sm transition-all h-10 border border-slate-100 dark:border-slate-700 active:scale-95"
                                                    onClick={() => setViewManual(manual)}
                                                >
                                                    Visualizar
                                                </Button>
                                                {manualContentImages[manual.id] && manualContentImages[manual.id].length > 0 && (
                                                    <Button
                                                        variant="secondary"
                                                        size="icon"
                                                        className="shrink-0 h-10 w-10 rounded-xl bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-400 hover:bg-green-100 border border-green-100 dark:border-green-950"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setGalleryImages(manualContentImages[manual.id].map((img, idx) => ({
                                                                id: `${manual.id}-img-${idx}`,
                                                                image_url: img,
                                                                image_order: idx,
                                                                caption: manual.title
                                                            })));
                                                            setGalleryIndex(0);
                                                            setShowGallery(true);
                                                        }}
                                                    >
                                                        <Images className="h-4 w-4 text-green-800 dark:text-green-400" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50 hover:bg-slate-50">
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Habitación</TableHead>
                                    <TableHead className="hidden md:table-cell">Categoría</TableHead>
                                    <TableHead className="hidden lg:table-cell">Garantía</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredManuals.map((manual) => (
                                    <TableRow key={manual.id} className="hover:bg-slate-50/50">
                                        <TableCell>
                                            <div className="p-2 rounded-lg bg-green-50 text-green-800 w-fit">
                                                {getContentTypeIcon(manual.type)}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span className="text-base text-slate-900">{manual.title}</span>
                                                <div className="flex items-center gap-2 md:hidden text-xs text-muted-foreground">
                                                    <span>{manual.room?.name}</span>
                                                    {manual.is_favorite && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{manual.room?.icon ? getRoomIcon(manual.room.icon) : '🏠'}</span>
                                                <span className="text-sm">{manual.room?.name || '---'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            <Badge variant="outline">{manual.category}</Badge>
                                        </TableCell>
                                        <TableCell className="hidden lg:table-cell">
                                            {manual.warranty_expires ? (
                                                <div className={`flex items-center gap-1.5 text-sm ${isBefore(new Date(manual.warranty_expires), new Date()) ? 'text-red-600' : 'text-green-800'}`}>
                                                    <ShieldCheck className="h-4 w-4" />
                                                    <span>{new Date(manual.warranty_expires).toLocaleDateString()}</span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setQrManual(manual)}
                                                    title="Generar QR"
                                                >
                                                    <QrCode className="h-4 w-4 text-slate-500 hover:text-slate-900" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => toggleFavorite(manual.id, !!manual.is_favorite, e)}
                                                >
                                                    <Star className={`h-4 w-4 ${manual.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-slate-400'}`} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setViewManual(manual)}
                                                >
                                                    <FileText className="h-4 w-4 text-green-800" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={(e) => handleEdit(manual, e)}
                                                >
                                                    <Pencil className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-4 w-4 text-red-600" onClick={(e) => deleteManual(manual.id, e)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )
            }

            {/* View Manual Dialog - Modo Wiki */}
            {
                viewManual && (
                    <Dialog open={!!viewManual} onOpenChange={(open) => !open && setViewManual(null)}>
                        <DialogContent className="sm:max-w-[640px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-3xl border-none shadow-2xl bg-white dark:bg-slate-900">
                            {/* Header tipo wiki */}
                            <div className="px-6 pt-6 pb-4 bg-gradient-to-r from-green-50 to-slate-50 dark:from-green-800-950/30 dark:to-slate-900 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-2">
                                            <Badge className="bg-green-500/10 text-green-900 dark:text-green-400 border-green-200 dark:border-green-950 font-bold text-xs">
                                                {viewManual.category}
                                            </Badge>
                                            {viewManual.room && (
                                                <Badge variant="outline" className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                                    {getRoomIcon(viewManual.room.icon)} {viewManual.room.name}
                                                </Badge>
                                            )}
                                            {viewManual.warranty_expires && (
                                                <Badge className={`text-xs font-bold ${isBefore(new Date(viewManual.warranty_expires), new Date()) ? 'bg-rose-100 text-rose-700 border-rose-200' : 'bg-green-100 text-green-900 border-green-200'}`}>
                                                    🛡️ Garantía: {new Date(viewManual.warranty_expires).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </Badge>
                                            )}
                                        </div>
                                        <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                                            {viewManual.title}
                                        </DialogTitle>
                                        {viewManual.description && (
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                                {viewManual.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {viewManual.tags && viewManual.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1.5 mt-3">
                                        {viewManual.tags.map(tag => (
                                            <Badge key={tag} variant="outline" className="text-[10px] font-medium bg-white dark:bg-slate-800">
                                                <TagIcon className="h-2.5 w-2.5 mr-1" />
                                                {tag}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 overflow-y-auto py-5 px-6 space-y-5">
                                {/* 📖 Instrucciones / Contenido principal */}
                                {(() => {
                                    let contentData = { text: '', image: '', video: '', audio: '', link: '', pdf: '' };
                                    let isMixed = false;
                                    try {
                                        if (viewManual?.content.startsWith('{')) {
                                            contentData = JSON.parse(viewManual.content);
                                            isMixed = true;
                                        }
                                    } catch { }

                                    if (!isMixed && viewManual) {
                                        if (viewManual.type === 'text') contentData.text = viewManual.content;
                                        if (viewManual.type === 'image') contentData.image = viewManual.content;
                                        if (viewManual.type === 'video') contentData.video = viewManual.content;
                                        if (viewManual.type === 'audio') contentData.audio = viewManual.content;
                                        if (viewManual.type === 'link') contentData.link = viewManual.content;
                                    }

                                    const hasInstructions = contentData.text && contentData.text.trim();
                                    const hasMedia = contentData.image || contentData.video || contentData.audio || contentData.link;

                                    return (
                                        <div className="space-y-4">
                                            {/* Instrucciones texto — parte principal */}
                                            {hasInstructions ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-green-500/10 rounded-lg">
                                                            <StickyNote className="h-4 w-4 text-green-500" />
                                                        </div>
                                                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Instrucciones</span>
                                                    </div>
                                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800">
                                                        {/* Renderizar como pasos si hay líneas numeradas o guiones */}
                                                        {contentData.text.includes('\n') ? (
                                                            <div className="space-y-2">
                                                                {contentData.text.split('\n').filter(Boolean).map((line, idx) => {
                                                                    const isStep = /^(\d+\.|-|\*)/.test(line.trim());
                                                                    return isStep ? (
                                                                        <div key={idx} className="flex gap-3 items-start">
                                                                            <div className="flex-shrink-0 w-5 h-5 bg-green-500 text-white text-[10px] font-black rounded-full flex items-center justify-center mt-0.5">{idx + 1}</div>
                                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{line.replace(/^(\d+\.|-|\*)\s*/, '')}</p>
                                                                        </div>
                                                                    ) : (
                                                                        <p key={idx} className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{line}</p>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{contentData.text}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-100 dark:border-amber-900/50 flex items-start gap-3">
                                                    <StickyNote className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-sm font-bold text-amber-800 dark:text-amber-300">Sin instrucciones aún</p>
                                                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Edita esta entrada para añadir cómo usar esto, qué hay que mantener...</p>
                                                        <Button size="sm" variant="outline" className="mt-2 h-7 text-xs border-amber-200 hover:bg-amber-100 text-amber-700" onClick={() => { setViewManual(null); handleEdit(viewManual); }}>
                                                            <Pencil className="h-3 w-3 mr-1" /> Añadir instrucciones
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Adjuntos multimedia */}
                                            {hasMedia && (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 bg-slate-500/10 rounded-lg">
                                                            <Images className="h-4 w-4 text-slate-500" />
                                                        </div>
                                                        <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Adjuntos</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3">
                                                        {contentData.image && (
                                                            <div className="rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-800 shadow-sm">
                                                                {!showFullMedia ? (
                                                                    <img src={contentData.image} alt="Adjunto" className="w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setShowFullMedia(true)} />
                                                                ) : (
                                                                    <div className="relative">
                                                                        <img src={contentData.image} alt="Adjunto" className="w-full h-auto" />
                                                                        <Button size="sm" variant="secondary" className="absolute top-2 right-2" onClick={() => setShowFullMedia(false)}>Reducir</Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        {contentData.video && (
                                                            <a href={contentData.video} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900/50 hover:bg-red-100 transition-colors">
                                                                <div className="p-2 bg-red-500/10 rounded-lg"><Video className="h-4 w-4 text-red-500" /></div>
                                                                <div><p className="text-sm font-bold text-red-700 dark:text-red-400">Vídeo de apoyo</p><p className="text-xs text-red-500">Abrir en YouTube</p></div>
                                                                <ExternalLink className="h-4 w-4 text-red-400 ml-auto" />
                                                            </a>
                                                        )}
                                                        {contentData.link && (
                                                            <a href={contentData.link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 transition-colors">
                                                                <div className="p-2 bg-blue-500/10 rounded-lg"><ExternalLink className="h-4 w-4 text-blue-500" /></div>
                                                                <div><p className="text-sm font-bold text-blue-700 dark:text-blue-400">Enlace externo</p><p className="text-xs text-blue-500 truncate max-w-[280px]">{contentData.link}</p></div>
                                                            </a>
                                                        )}
                                                        {contentData.audio && (
                                                            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                                                                <p className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1"><Mic className="h-3 w-3" /> Nota de voz</p>
                                                                <audio controls src={contentData.audio} className="w-full h-8" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* Footer de acciones */}
                            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                                {/* Botón principal: Recordatorios */}
                                <Button
                                    className="w-full h-12 bg-green-800 hover:bg-green-900 text-white font-bold rounded-2xl shadow-md shadow-green-200 dark:shadow-green-950/30 mb-3 text-base"
                                    onClick={(e) => { e.stopPropagation(); setReminderManual(viewManual); }}
                                >
                                    <Bell className="h-5 w-5 mr-2" />
                                    Añadir / Ver Recordatorios de Mantenimiento
                                </Button>
                                {/* Acciones secundarias */}
                                <div className="flex gap-2 flex-wrap">
                                    <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={(e) => { e.stopPropagation(); handleEdit(viewManual); setViewManual(null); }}>
                                        <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                                    </Button>
                                    <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={(e) => { e.stopPropagation(); setNotesManual(viewManual); }}>
                                        <StickyNote className="h-3.5 w-3.5 mr-1.5" /> Notas
                                    </Button>
                                    <Button variant="outline" size="sm" className="rounded-xl flex-1 bg-green-50/50 hover:bg-green-100 text-green-900 border-green-200" onClick={(e) => {
                                        e.stopPropagation();
                                        let cleanText = 'Sin instrucciones guardadas.';
                                        if (viewManual?.content) {
                                            try {
                                                const parsed = JSON.parse(viewManual.content);
                                                if (parsed.text) cleanText = parsed.text;
                                            } catch {
                                                cleanText = viewManual.content;
                                            }
                                        }
                                        setPendingPrompt(`¿Me puedes explicar paso a paso cómo hacer el mantenimiento de: ${viewManual.title}? Aquí tienes las instrucciones de mi manual:\n\n${cleanText}`);
                                        setIsOpen(true);
                                    }}>
                                        <Bot className="h-3.5 w-3.5 mr-1.5" /> ¿Cómo lo hago? (IA)
                                    </Button>
                                    <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={(e) => { e.stopPropagation(); setChecklistManual(viewManual); }}>
                                        <ListChecks className="h-3.5 w-3.5 mr-1.5" /> Checklist
                                    </Button>
                                    <Button variant="outline" size="sm" className="rounded-xl flex-1" onClick={(e) => { e.stopPropagation(); setVersionManual(viewManual); }}>
                                        <History className="h-3.5 w-3.5 mr-1.5" /> Historial
                                    </Button>
                                    <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => setViewManual(null)}>
                                        Cerrar
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            }

            {/* Share Manual Dialog */}
            {
                shareManual && (
                    <ShareManualDialog
                        manual={shareManual}
                        open={!!shareManual}
                        onOpenChange={(open) => !open && setShareManual(null)}
                    />
                )
            }

            {/* Reminder Dialog */}
            {
                reminderManual && (
                    <ReminderDialog
                        manualId={reminderManual.id}
                        manualTitle={reminderManual.title}
                        open={!!reminderManual}
                        onOpenChange={(open) => !open && setReminderManual(null)}
                    />
                )
            }

            {/* Version History Dialog */}
            {
                versionManual && (
                    <VersionHistoryDialog
                        manualId={versionManual.id}
                        manualTitle={versionManual.title}
                        open={!!versionManual}
                        onOpenChange={(open) => !open && setVersionManual(null)}
                        onRestore={() => fetchManuals()}
                    />
                )
            }

            {/* QR Scanner Dialog */}
            <QRScannerDialog
                open={showQRScanner}
                onOpenChange={setShowQRScanner}
                onScan={(url) => {
                    // Auto-populate link field with scanned URL
                    setDraftLink(url);
                    setType('link');
                    toast.success('QR escaneado - enlace añadido');
                }}
            />

            {/* Notes Dialog */}
            {
                notesManual && (
                    <NotesDialog
                        manualId={notesManual.id}
                        manualTitle={notesManual.title}
                        open={!!notesManual}
                        onOpenChange={(open) => !open && setNotesManual(null)}
                    />
                )
            }

            {/* Checklist Dialog */}
            {
                checklistManual && (
                    <ChecklistDialog
                        manualId={checklistManual.id}
                        manualTitle={checklistManual.title}
                        open={!!checklistManual}
                        onOpenChange={(open) => !open && setChecklistManual(null)}
                    />
                )
            }

            {/* Energy Dialog */}
            {
                energyManual && (
                    <EnergyDialog
                        manualId={energyManual.id}
                        manualTitle={energyManual.title}
                        open={!!energyManual}
                        onOpenChange={(open) => !open && setEnergyManual(null)}
                    />
                )
            }

            {/* Image Gallery Dialog */}
            <ImageGalleryDialog
                images={galleryImages}
                initialIndex={galleryIndex}
                open={showGallery}
                onOpenChange={setShowGallery}
            />

            {/* Manage Rooms Dialog */}
            <ManageRoomsDialog
                open={showManageRooms}
                onOpenChange={setShowManageRooms}
                onRoomsChanged={() => {
                    fetchRooms();
                    fetchManuals();
                }}
            />

            {/* Hidden file input for backup import */}
            <input
                id="backup-file-input"
                type="file"
                accept=".json"
                className="hidden"
                onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                        const success = await importBackup(file);
                        if (success) {
                            fetchManuals();
                            fetchRooms();
                        }
                        e.target.value = ''; // Reset
                    }
                }}
            />
            {/* Qr Code Dialog */}
            {qrManual && (
                <QrCodeDialog
                    open={!!qrManual}
                    onOpenChange={(open) => !open && setQrManual(null)}
                    manualTitle={qrManual.title}
                    manualId={qrManual.id}
                />
            )}
        </div >
    );
}

