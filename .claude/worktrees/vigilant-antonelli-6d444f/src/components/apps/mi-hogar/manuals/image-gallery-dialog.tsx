'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Trash2, Download, ZoomIn, ZoomOut, RotateCcw, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

interface Image {
    id: string;
    image_url: string;
    caption?: string;
    image_order: number;
}

interface ImageGalleryDialogProps {
    images: Image[];
    initialIndex?: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDelete?: (imageId: string) => void;
    canEdit?: boolean;
}

export function ImageGalleryDialog({
    images,
    initialIndex = 0,
    open,
    onOpenChange,
    onDelete,
    canEdit = false
}: ImageGalleryDialogProps) {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
        setCurrentIndex(initialIndex);
        setRotation(0);
    }, [initialIndex, open]);

    const handlePrevious = () => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setRotation(0);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setRotation(0);
    };

    const handleDelete = () => {
        if (!canEdit || !onDelete) return;

        const image = images[currentIndex];
        if (confirm('¿Eliminar esta imagen?')) {
            onDelete(image.id);
            if (currentIndex >= images.length - 1) {
                setCurrentIndex(Math.max(0, currentIndex - 1));
            }
        }
    };

    const handleDownload = () => {
        const image = images[currentIndex];
        const link = document.createElement('a');
        link.href = image.image_url;
        link.download = `image-${currentIndex + 1}.jpg`;
        link.click();
    };

    if (images.length === 0) return null;

    const currentImage = images[currentIndex];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[95vh] p-0 flex flex-col bg-black/95 border-slate-800">
                <div className="relative flex flex-col h-full w-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-black/50 backdrop-blur-sm absolute top-0 left-0 right-0 z-10">
                        <div>
                            <h3 className="font-semibold text-white">
                                Imagen {currentIndex + 1} de {images.length}
                            </h3>
                            {currentImage.caption && (
                                <p className="text-sm text-slate-400">{currentImage.caption}</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={handleDownload}
                                className="text-white hover:bg-white/10"
                            >
                                <Download className="h-4 w-4" />
                            </Button>
                            {canEdit && onDelete && (
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={handleDelete}
                                    className="text-white hover:bg-white/10 hover:text-red-400"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                            <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                className="text-white hover:bg-white/10"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>

                    {/* Image */}
                    <div className="flex-1 w-full h-full flex items-center justify-center p-4 pt-16 pb-4 overflow-hidden">
                        <TransformWrapper
                            initialScale={1}
                            minScale={0.5}
                            maxScale={4}
                            centerOnInit={true}
                        >
                            {({ zoomIn, zoomOut, resetTransform }) => (
                                <React.Fragment>
                                    <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-1 border border-white/10">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                                            onClick={() => zoomIn()}
                                            title="Acercar"
                                        >
                                            <ZoomIn className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                                            onClick={() => zoomOut()}
                                            title="Alejar"
                                        >
                                            <ZoomOut className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                                            onClick={() => setRotation(r => r - 90)}
                                            title="Rotar izquierda"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
                                            onClick={() => {
                                                resetTransform();
                                                setRotation(0);
                                            }}
                                            title="Restablecer vista"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                        </Button>
                                    </div>
                                    <TransformComponent
                                        wrapperClass="!w-full !h-full flex items-center justify-center p-4"
                                        contentClass="!w-full !h-full flex items-center justify-center"
                                    >
                                        <img
                                            src={currentImage.image_url}
                                            alt={currentImage.caption || `Imagen ${currentIndex + 1}`}
                                            className="max-w-full max-h-full object-contain shadow-2xl transition-transform duration-300 ease-in-out"
                                            style={{ transform: `rotate(${rotation}deg)` }}
                                        />
                                    </TransformComponent>
                                </React.Fragment>
                            )}
                        </TransformWrapper>

                        {/* Navigation Arrows */}
                        {images.length > 1 && (
                            <>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white z-20"
                                    onClick={handlePrevious}
                                >
                                    <ChevronLeft className="h-6 w-6" />
                                </Button>
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white z-20"
                                    onClick={handleNext}
                                >
                                    <ChevronRight className="h-6 w-6" />
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Thumbnails */}
                    {images.length > 1 && (
                        <div className="flex gap-2 p-4 overflow-x-auto border-t border-slate-800 bg-black/50 backdrop-blur-sm z-10 w-full">
                            {images.map((image, index) => (
                                <button
                                    key={image.id}
                                    onClick={() => setCurrentIndex(index)}
                                    className={`flex-shrink-0 w-16 h-16 rounded border-2 transition-all ${index === currentIndex
                                        ? 'border-green-500 scale-110'
                                        : 'border-transparent opacity-50 hover:opacity-100'
                                        }`}
                                >
                                    <img
                                        src={image.image_url}
                                        alt={`Thumbnail ${index + 1}`}
                                        className="w-full h-full object-cover rounded"
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

