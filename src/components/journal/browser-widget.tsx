'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Globe, ChevronLeft, ChevronRight, RotateCw, ExternalLink, Pin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useJournal } from '@/context/JournalContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function BrowserWidget() {
    const { isBrowserOpen, setBrowserOpen, isBrowserPinned, setBrowserPinned, browserUrl, setBrowserUrl, browserWindow, setBrowserWindow, width } = useJournal();
    const [urlInput, setUrlInput] = useState(browserUrl);
    const [isLoading, setIsLoading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Initial position logic could be handled by framer-motion layoutId or simple generic centering
    // We'll use fixed positioning with drag

    // Only show internal widget if Open AND Pinned
    if (!isBrowserOpen || !isBrowserPinned) return null;

    const handleNavigate = (e?: React.FormEvent) => {
        e?.preventDefault();
        let target = urlInput;
        if (!target.startsWith('http')) {
            // Simple search if not url
            if (!target.includes('.')) {
                target = `https://www.google.com/search?igu=1&q=${encodeURIComponent(target)}`;
            } else {
                target = `https://${target}`;
            }
        }
        setBrowserUrl(target);
        setIsLoading(true);
    };

    const refresh = () => {
        if (iframeRef.current) {
            iframeRef.current.src = iframeRef.current.src;
            setIsLoading(true);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag
            dragMomentum={false}
            className="fixed z-[80] flex flex-col bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
            style={{
                top: '80px', // More reasonable top margin
            }}
            animate={{
                opacity: 1, scale: 1, y: 0,
                width: `calc(100% - ${width}% - 30px)`, // Dynamic width based on journal
                height: `calc(100vh - 100px)`, // Full height minus header/margins
                left: '15px' // Fixed left margin
            }}
        >
            {/* Header / Toolbar */}
            <div className="flex items-center gap-2 p-2 border-b border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 cursor-move">
                <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-red-400 cursor-pointer hover:bg-red-500" onClick={() => setBrowserOpen(false)} />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>

                <form onSubmit={handleNavigate} className="flex-1 flex items-center gap-2 ml-2">
                    <div className="relative flex-1">
                        <Globe className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            className="h-8 pl-8 text-xs bg-white dark:bg-zinc-900"
                            placeholder="Buscar o escribir URL..."
                        />
                    </div>
                </form>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={refresh}>
                        <RotateCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                    </Button>
                    <Button
                        variant={isBrowserPinned ? "secondary" : "ghost"}
                        size="icon"
                        className={cn("h-7 w-7", isBrowserPinned ? "text-primary bg-primary/10" : "text-muted-foreground")}
                        onClick={() => {
                            setBrowserPinned(false);
                            // Switch to Native Mode manually
                            const screenWidth = window.screen.availWidth;
                            const screenHeight = window.screen.availHeight;
                            const browserWidth = Math.min(800, screenWidth * 0.6);
                            const left = screenWidth - browserWidth;

                            const newWindow = window.open(
                                browserUrl,
                                'QuiobaBrowser',
                                `width=${browserWidth},height=${screenHeight},left=${left},top=0,resizable=yes,scrollbars=yes,status=yes`
                            );
                            if (newWindow) setBrowserWindow(newWindow);
                            toast.info("Desanclado: Ventana Externa");
                        }}
                        title="Anclar ventana"
                    >
                        <Pin className="w-3.5 h-3.5 fill-current" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground"
                        onClick={() => window.open(browserUrl, '_blank')}
                        title="Abrir en navegador externo"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-red-500"
                        onClick={() => setBrowserOpen(false)}
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Browser Content */}
            <div className="flex-1 relative bg-white">
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
                <iframe
                    ref={iframeRef}
                    src={browserUrl}
                    className="w-full h-full border-none"
                    onLoad={() => setIsLoading(false)}
                    onError={() => {
                        setIsLoading(false);
                        toast.error('No se pudo cargar la web. Puede que tenga restricciones de seguridad (X-Frame). Prueba abrir en externo.');
                    }}
                    title="Navegador Integrado"
                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
            </div>

            {/* Warning Footer if likely blocked */}
            {!browserUrl.includes('google.com/search') && !browserUrl.includes('bing') && (
                <div className="px-2 py-1 bg-yellow-50 dark:bg-yellow-900/10 text-[10px] text-yellow-600 text-center border-t border-yellow-100">
                    Si la página no carga (pantalla blanca/gris), es por seguridad del sitio. Usa el botón <ExternalLink className="inline w-3 h-3" /> para verla fuera.
                </div>
            )}
        </motion.div>
    );
}
