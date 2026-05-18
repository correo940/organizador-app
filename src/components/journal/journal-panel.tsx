'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useJournal } from '@/context/JournalContext';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { supabase } from '@/lib/supabase';

import { usePathname, useRouter } from 'next/navigation';
import { X, Save, Bold, Italic, Underline as UnderlineIcon, Highlighter, Palette, Loader2, Settings, Heading1, Heading2, Heading3, ExternalLink, Quote, Plus, Tag, Image as ImageIcon, Mic, Globe, ArrowLeft, ArrowRight, RotateCw, Search, Clipboard, Link as LinkIcon, MoveUpRight, Pin, HelpCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import ImageExtension from '@tiptap/extension-image';
import { AudioExtension } from './extensions/audio-extension';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface JournalPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function JournalPanel({ isOpen, onClose }: JournalPanelProps) {
    const pathname = usePathname();
    const router = useRouter();
    const { selectedDate, width, setWidth, isBrowserPinned, setBrowserPinned, browserWindow, setBrowserWindow, setBrowserOpen } = useJournal();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [opacity, setOpacity] = useState(1);
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
    const recordingInterval = React.useRef<NodeJS.Timeout | null>(null);
    const popupRef = React.useRef<Window | null>(null);
    const [pipWindow, setPipWindow] = useState<Window | null>(null);

    const togglePiP = async () => {
        if (pipWindow) {
            pipWindow.close();
            setPipWindow(null);
            return;
        }

        // Check API support
        if (!('documentPictureInPicture' in window)) {
            toast.error('Tu navegador no soporta el modo "Notas Flotantes" (Picture-in-Picture). Prueba en Chrome o Edge.');
            return;
        }

        try {
            // Request PiP Window
            const pip = await (window as any).documentPictureInPicture.requestWindow({
                width: 400,
                height: 600,
            });

            // Copy Styles
            Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).forEach((style) => {
                pip.document.head.appendChild(style.cloneNode(true));
            });

            // Add dark mode
            if (document.documentElement.classList.contains('dark')) {
                pip.document.documentElement.classList.add('dark');
            }
            if (document.body.classList.contains('dark')) {
                pip.document.body.classList.add('dark');
            }
            pip.document.body.className = document.body.className;

            // Handle closing
            pip.addEventListener('pagehide', () => {
                setPipWindow(null);
            });

            setPipWindow(pip);

        } catch (err) {
            console.error('Failed to open PiP:', err);
            toast.error('Error al abrir notas flotantes.');
        }
    };

    // Browser State
    const windowRef = React.useRef(browserWindow);

    useEffect(() => {
        windowRef.current = browserWindow;
    }, [browserWindow]);

    const openBrowserPopup = () => {
        const screenWidth = window.screen.availWidth;
        const screenHeight = window.screen.availHeight;
        const screenLeft = (window.screen as any).availLeft || 0;
        const screenTop = (window.screen as any).availTop || 0;

        // Calculate remaining width (100% - Journal Width%)
        const journalWidthPercent = width || 33;
        const availableWidth = Math.floor(screenWidth * ((100 - journalWidthPercent) / 100));

        const browserWidth = availableWidth - 12;
        const height = screenHeight - 60;

        const newWindow = window.open(
            'https://www.google.com/search?igu=1',
            'QuiobaBrowser',
            `width=${browserWidth},height=${height},left=${screenLeft},top=${screenTop},resizable=yes,scrollbars=yes,status=yes`
        );

        if (newWindow) {
            setBrowserWindow(newWindow);
            newWindow.focus();
        } else {
            toast.error('Revisa el bloqueador de ventanas emergentes.');
        }
    };

    // Keep track of pinned state in a ref for the cleanup function
    const isPinnedRef = React.useRef(isBrowserPinned);

    // Update ref when state changes
    useEffect(() => {
        isPinnedRef.current = isBrowserPinned;
    }, [isBrowserPinned]);

    // Auto-close on unmount if NOT pinned
    useEffect(() => {
        return () => {
            if (!isPinnedRef.current && windowRef.current && !windowRef.current.closed) {
                windowRef.current.close();
                setBrowserWindow(null);
            }
        };
    }, []);


    const editor = useEditor({
        extensions: [
            StarterKit,
            TextStyle,
            FontFamily,
            // Underline,
            Color,
            Highlight.configure({ multicolor: true }),
            ImageExtension,
            AudioExtension,
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] p-4',
            },
        },
        onUpdate: ({ editor }) => {
            // Auto-save logic could go here (debounced)
        },
        immediatelyRender: false,
    });

    // Fetch user and subscribe to auth changes
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Click outside to close (DISABLED by user request)
    const panelRef = React.useRef<HTMLDivElement>(null);
    /*
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && panelRef.current && !panelRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);
    */

    // Load content when pathname, user, or selectedDate changes
    useEffect(() => {
        if (!user || !editor) return;

        const loadContent = async () => {
            setIsLoading(true);

            let query: any = supabase
                .from('journal_entries')
                .select('content, context_id, tags')
                .eq('user_id', user.id);

            if (selectedDate) {
                // Fetch by date
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);

                query = query
                    .gte('updated_at', startOfDay.toISOString())
                    .lte('updated_at', endOfDay.toISOString())
                    .order('updated_at', { ascending: false })
                    .limit(1);
            } else {
                // Fetch by context (current page)
                const contextId = pathname || '/';
                query = query.eq('context_id', contextId).maybeSingle();
            }

            const { data, error } = await query;

            // Handle array result from date query or single object from context query
            const entry = Array.isArray(data) ? data[0] : data;

            if (entry?.content) {
                editor.commands.setContent(entry.content);
                setTags(entry.tags || []);
            } else {
                // Auto-Title Capture for new notes
                let initialContent = '';
                if (!selectedDate && typeof document !== 'undefined') {
                    const pageTitle = document.title || '';
                    // Try to find H1 if title is generic
                    const h1 = document.querySelector('h1')?.innerText;
                    const titleToUse = h1 || pageTitle;

                    if (titleToUse) {
                        initialContent = `<h1>${titleToUse}</h1><p></p>`;
                    }
                }
                editor.commands.setContent(initialContent);
            }
            setIsLoading(false);
        };

        loadContent();
    }, [pathname, selectedDate, editor]);

    // Handle pending quotes from context
    const { pendingQuote, clearPendingQuote } = useJournal();
    useEffect(() => {
        if (editor && pendingQuote) {
            editor.chain().focus().setBlockquote().insertContent(pendingQuote).run();
            clearPendingQuote();
        }
    }, [editor, pendingQuote, clearPendingQuote]);

    const handleSave = async () => {
        if (!user || !editor) return;
        setIsSaving(true);
        const contextId = pathname || '/';
        const content = editor.getJSON();

        const { error } = await supabase
            .from('journal_entries')
            .upsert({
                user_id: user.id,
                context_id: contextId,
                content: content,
                tags: tags,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id, context_id' });

        setIsSaving(false);
        if (error) {
            console.error('Error saving journal entry:', error);
            toast.error(`Error al guardar: ${error.message}`);
        } else {
            toast.success('Guardado');
        }
    };

    if (!editor) return null;

    const handleQuote = () => {
        if (!editor) return;

        const selection = window.getSelection();
        const text = selection?.toString();

        if (text) {
            editor.chain().focus().setBlockquote().insertContent(text).run();
        } else {
            // If no text selected on page, just toggle blockquote for current line
            editor.chain().focus().toggleBlockquote().run();
        }
    };

    const handleAddTag = () => {
        if (newTag.trim() && !tags.includes(newTag.trim())) {
            setTags([...tags, newTag.trim()]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleImageUpload = async (file: File) => {
        if (!user) {
            toast.error('Debes iniciar sesión para subir imágenes');
            return;
        }
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        const { data, error } = await supabase.storage
            .from('journal-media')
            .upload(fileName, file);

        if (error) {
            console.error('Error uploading image:', error);
            toast.error(`Error al subir imagen: ${error.message}`);
            return;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('journal-media')
            .getPublicUrl(fileName);

        editor?.chain().focus().setImage({ src: publicUrl }).run();
    };

    const handleDrop = async (e: React.DragEvent) => {
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            e.preventDefault();
            e.stopPropagation();
            await handleImageUpload(file);
        }
    };

    const handleSmartPaste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;

            // Simple URL detection
            const isUrl = /^(http|https):\/\/[^ "]+$/.test(text);

            if (isUrl) {
                // If it's a URL, suggest linking context or inserting link
                editor.chain().focus().setLink({ href: text }).insertContent(text).run();
                toast.success('Enlace insertado');
            } else {
                // If text, insert as blockquote
                editor.chain().focus().setBlockquote().insertContent(text).run();
                toast.success('Texto pegado como cita');
            }
        } catch (err) {
            console.error('Clipboard error:', err);
            toast.error('No se pudo acceder al portapapeles');
        }
    };

    const startRecording = async () => {
        if (!user) {
            toast.error('Debes iniciar sesión para grabar audio');
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            toast.error('Tu navegador no soporta grabación de audio.');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Determine supported mime type
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            }

            const recorder = new MediaRecorder(stream, { mimeType });
            const chunks: BlobPart[] = [];

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunks.push(e.data);
                }
            };

            recorder.onstop = async () => {
                // Clear timer
                if (recordingInterval.current) {
                    clearInterval(recordingInterval.current);
                    recordingInterval.current = null;
                }
                setRecordingTime(0);

                const blob = new Blob(chunks, { type: mimeType });

                if (blob.size === 0) {
                    toast.error('La grabación está vacía. Intenta hablar más fuerte o verifica tu micrófono.');
                    return;
                }

                console.log(`Recording finished. Type: ${mimeType}, Size: ${blob.size} bytes`);

                const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
                const file = new File([blob], `voice-${Date.now()}.${fileExt}`, { type: mimeType });

                // Upload audio
                if (!user) {
                    console.error('User not found in onstop');
                    toast.error('Usuario no autenticado al finalizar grabación');
                    return;
                }

                const fileName = `${user.id}/${file.name}`;
                const { error } = await supabase.storage
                    .from('journal-media')
                    .upload(fileName, file);

                if (error) {
                    console.error('Error uploading audio:', error);
                    toast.error(`Error al guardar audio: ${error.message}`);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('journal-media')
                    .getPublicUrl(fileName);

                // Insert audio player using custom extension
                editor?.chain().focus().setAudio({ src: publicUrl }).run();

                stream.getTracks().forEach(track => track.stop());
            };

            recorder.start(100); // Collect chunks every 100ms
            setMediaRecorder(recorder);
            setIsRecording(true);

            // Start timer
            setRecordingTime(0);
            recordingInterval.current = setInterval(() => {
                setRecordingTime(prev => prev + 1);
            }, 1000);

        } catch (err: any) {
            console.error('Error accessing microphone:', err);
            let errorMessage = 'No se pudo acceder al micrófono.';

            if (err.name === 'NotAllowedError') {
                errorMessage = 'Permiso denegado. Por favor permite el acceso al micrófono en tu navegador.';
            } else if (err.name === 'NotFoundError') {
                errorMessage = 'No se encontró ningún micrófono.';
            } else if (err.name === 'NotReadableError') {
                errorMessage = 'El micrófono está siendo usado por otra aplicación.';
            } else {
                errorMessage = `Error: ${err.message || err.name || 'Desconocido'}`;
            }

            toast.error(errorMessage);
        }
    };

    const stopRecording = () => {
        mediaRecorder?.stop();
        setIsRecording(false);
        setMediaRecorder(null);
        if (recordingInterval.current) {
            clearInterval(recordingInterval.current);
            recordingInterval.current = null;
        }
        setRecordingTime(0);
    };

    const formatRecordingTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };


    const JournalUI = (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                <div>
                    <h2 className="font-headline font-bold text-lg flex items-center gap-2">
                        📒 Mis Apuntes
                    </h2>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="link"
                            className="p-0 h-auto text-[10px] text-blue-500 hover:underline"
                            onClick={() => {
                                if (pipWindow) {
                                    pipWindow.close();
                                    setPipWindow(null);
                                }
                                router.push('/journal');
                                onClose();
                            }}
                        >
                            Ver Biblioteca Completa
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {selectedDate ? (
                            <>
                                Del: {selectedDate.toLocaleDateString()}
                            </>
                        ) : (
                            <>Sobre: {pathname === '/' ? 'Inicio' : pathname}</>
                        )}
                    </p>
                    {selectedDate && (
                        <Button
                            variant="link"
                            className="h-auto p-0 text-xs text-blue-500"
                            onClick={async () => {
                                const startOfDay = new Date(selectedDate);
                                startOfDay.setHours(0, 0, 0, 0);
                                const endOfDay = new Date(selectedDate);
                                endOfDay.setHours(23, 59, 59, 999);

                                const { data } = await supabase
                                    .from('journal_entries')
                                    .select('context_id')
                                    .eq('user_id', user.id)
                                    .gte('updated_at', startOfDay.toISOString())
                                    .lte('updated_at', endOfDay.toISOString())
                                    .limit(1)
                                    .single();

                                if (data?.context_id) {
                                    router.push(data.context_id);
                                    onClose();
                                } else {
                                    toast.info('No hay entrada para esta fecha');
                                }
                            }}
                        >
                            Ir al sitio
                        </Button>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-wrap justify-end max-w-[50%]">
                    <TooltipProvider>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-muted-foreground mr-1 h-8 w-8 shrink-0">
                                    <HelpCircle className="w-4 h-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-4 text-sm z-[70]" align="end">
                                <h4 className="font-semibold mb-3">Ayuda de Navegación</h4>
                                <ul className="space-y-3">
                                    <li className="flex items-start gap-2">
                                        <div className="mt-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded">
                                            <Globe className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <span className="font-medium block text-xs">Navegador Normal</span>
                                            <span className="text-muted-foreground block text-[10px] leading-tight mt-0.5">
                                                Abre una ventana externa. Se ocultará si tocas el diario.
                                            </span>
                                        </div>
                                    </li>

                                    <li className="flex items-start gap-2">
                                        <div className="mt-0.5 p-1 bg-slate-100 dark:bg-slate-800 rounded">
                                            <MoveUpRight className="w-3 h-3" />
                                        </div>
                                        <div>
                                            <span className="font-medium block text-xs">Notas Flotantes</span>
                                            <span className="text-muted-foreground block text-[10px] leading-tight mt-0.5">
                                                Saca el diario fuera de la app (PiP).
                                            </span>
                                        </div>
                                    </li>
                                </ul>
                            </PopoverContent>
                        </Popover>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={pipWindow ? "secondary" : "ghost"}
                                    size="icon"
                                    onClick={togglePiP}
                                    className="h-8 w-8 shrink-0"
                                >
                                    <MoveUpRight className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Notas Flotantes</p></TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openBrowserPopup()}
                                    className="h-8 w-8 shrink-0"
                                >
                                    <Globe className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Abrir Navegador</p></TooltipContent>
                        </Tooltip>



                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleSmartPaste}
                                    className="h-8 w-8 shrink-0"
                                >
                                    <Clipboard className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Pegar inteligente</p></TooltipContent>
                        </Tooltip>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                    <Settings className="w-4 h-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 z-[70]" align="end">
                                <div className="grid gap-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium leading-none">Apariencia</h4>
                                        <p className="text-sm text-muted-foreground">Opciones de visualización.</p>
                                    </div>
                                    <div className="grid gap-2">
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <span className="text-sm">Opacidad</span>
                                            <Slider defaultValue={[opacity]} max={1} min={0.2} step={0.1} className="col-span-2" onValueChange={(value) => setOpacity(value[0])} />
                                        </div>
                                        <div className="grid grid-cols-3 items-center gap-4">
                                            <span className="text-sm">Ancho</span>
                                            <Slider defaultValue={[width]} max={100} min={20} step={5} className="col-span-2" onValueChange={(value) => setWidth(value[0])} />
                                        </div>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={handleSave} disabled={isSaving} className="h-8 w-8 shrink-0">
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"><p>Guardar</p></TooltipContent>
                        </Tooltip>

                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                                if (pipWindow) {
                                    pipWindow.close();
                                    setPipWindow(null);
                                }
                                onClose();
                            }}
                            className="h-8 w-8 shrink-0"
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </TooltipProvider>
                </div>
            </div>

            {/* Tags Input */}
            <div className="px-4 py-2 border-b border-border bg-background/50">
                <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                            <button onClick={() => handleRemoveTag(tag)} className="ml-1 hover:text-destructive">
                                <X className="w-3 h-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    <Input
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag();
                            }
                        }}
                        placeholder="Añadir etiqueta..."
                        className="h-7 text-xs border-none shadow-none focus-visible:ring-0 px-0"
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleAddTag}>
                        <Plus className="w-3 h-3" />
                    </Button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap gap-1 p-2 border-b border-border bg-background sticky top-0 z-10 items-center">
                <Select onValueChange={(value) => editor.chain().focus().setFontFamily(value).run()}>
                    <SelectTrigger className="w-[120px] h-8">
                        <SelectValue placeholder="Fuente" />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                        <SelectItem value="Inter">Inter</SelectItem>
                        <SelectItem value="Comic Sans MS, Comic Sans">Comic Sans</SelectItem>
                        <SelectItem value="serif">Serif</SelectItem>
                        <SelectItem value="monospace">Monospace</SelectItem>
                        <SelectItem value="cursive">Cursive</SelectItem>
                    </SelectContent>
                </Select>

                <div className="w-px h-6 bg-border mx-1" />

                <Button
                    variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleBold().run()}
                >
                    <Bold className="w-4 h-4" />
                </Button>
                <Button
                    variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                >
                    <Italic className="w-4 h-4" />
                </Button>
                <Button
                    variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleUnderline().run()}
                >
                    <UnderlineIcon className="w-4 h-4" />
                </Button>

                <div className="w-px h-6 bg-border mx-1" />

                <Button
                    variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                    <Heading1 className="w-4 h-4" />
                </Button>
                <Button
                    variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                    <Heading2 className="w-4 h-4" />
                </Button>
                <Button
                    variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                >
                    <Heading3 className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button
                    variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => editor.chain().focus().toggleHighlight().run()}
                >
                    <Highlighter className="w-4 h-4" />
                </Button>

                {/* Color Picker (Simplified) */}
                <div className="flex items-center gap-1 ml-2">
                    <button
                        className="w-4 h-4 rounded-full bg-black border border-gray-300"
                        onClick={() => editor.chain().focus().setColor('#000000').run()}
                    />
                    <button
                        className="w-4 h-4 rounded-full bg-red-500 border border-gray-300"
                        onClick={() => editor.chain().focus().setColor('#EF4444').run()}
                    />
                    <button
                        className="w-4 h-4 rounded-full bg-blue-500 border border-gray-300"
                        onClick={() => editor.chain().focus().setColor('#3B82F6').run()}
                    />
                    <button
                        className="w-4 h-4 rounded-full bg-green-500 border border-gray-300"
                        onClick={() => editor.chain().focus().setColor('#22C55E').run()}
                    />
                    <button
                        className="w-4 h-4 rounded-full bg-purple-500 border border-gray-300"
                        onClick={() => editor.chain().focus().setColor('#A855F7').run()}
                    />
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    title="Insertar Imagen"
                >
                    <ImageIcon className="w-4 h-4" />
                    <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleImageUpload(file);
                        }}
                    />
                </Button>
                <div className="flex items-center gap-2">
                    {isRecording && (
                        <span className="text-xs text-red-500 font-medium animate-pulse">
                            Grabando {formatRecordingTime(recordingTime)}...
                        </span>
                    )}
                    <Button
                        variant={isRecording ? 'destructive' : 'ghost'}
                        size="sm"
                        onClick={isRecording ? stopRecording : startRecording}
                        title={isRecording ? "Detener Grabación" : "Grabar Voz"}
                        className={isRecording ? "animate-pulse" : ""}
                    >
                        <Mic className="w-4 h-4" />
                    </Button>
                </div>

                <div className="w-px h-6 bg-border mx-1" />

                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleQuote}
                    className={editor.isActive('blockquote') ? 'bg-muted' : ''}
                    title="Citar texto seleccionado"
                >
                    <Quote className="w-4 h-4" />
                </Button>

                <div className="w-px h-4 bg-border mx-1" />
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-900">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" />
                        Cargando notas...
                    </div>
                ) : (
                    <EditorContent editor={editor} />
                )}
            </div>
        </div>
    );

    if (pipWindow) {
        return createPortal(
            JournalUI,
            pipWindow.document.body
        );
    }

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                    style={{ width: `${width}%`, opacity: opacity }}
                    className="fixed top-0 right-0 h-full bg-background border-l border-border shadow-2xl z-[60] flex flex-col"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    ref={panelRef}
                >
                    {JournalUI}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
