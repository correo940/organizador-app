import React, { useState, useRef, useEffect } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import { Play, Pause, RotateCcw, Download, Trash2, Mic, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

export default function AudioComponent(props: any) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement>(null);

    const src = props.node.attrs.src;

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateProgress = () => {
            setProgress(audio.currentTime);
        };

        const updateDuration = () => {
            if (!isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(audio.duration);
            }
        };

        const onEnded = () => {
            setIsPlaying(false);
            setProgress(0);
        };

        // Initial check
        if (audio.readyState >= 1) {
            updateDuration();
        }

        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', updateDuration);
        audio.addEventListener('durationchange', updateDuration);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateProgress);
            audio.removeEventListener('loadedmetadata', updateDuration);
            audio.removeEventListener('durationchange', updateDuration);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = () => {
        if (audioRef.current) {
            if (isPlaying) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const rewind = () => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
        }
    };

    const handleSeek = (value: number[]) => {
        if (audioRef.current) {
            audioRef.current.currentTime = value[0];
            setProgress(value[0]);
        }
    };

    const downloadAudio = () => {
        const link = document.createElement('a');
        link.href = src;
        link.download = 'audio-note.webm'; // Or detect extension
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const deleteNode = () => {
        props.deleteNode();
    };

    const formatTime = (seconds: number) => {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <NodeViewWrapper as="span" className="inline-block align-middle mx-1">
            <audio ref={audioRef} src={src} preload="metadata" className="hidden" />

            {!isExpanded ? (
                <button
                    onClick={() => setIsExpanded(true)}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer select-none"
                    title="Reproducir nota de voz"
                >
                    <Mic className="w-3.5 h-3.5" />
                    <span className="text-sm font-medium">Nota de voz</span>
                </button>
            ) : (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border shadow-sm min-w-[300px] select-none">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={togglePlay}
                    >
                        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>

                    <div className="flex-1 flex flex-col gap-1 min-w-[100px]">
                        <Slider
                            value={[progress]}
                            max={duration || 100}
                            step={0.1}
                            onValueChange={handleSeek}
                            className="w-full"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                            <span>{formatTime(progress)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={rewind}
                            title="Retroceder 10s"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={downloadAudio}
                            title="Descargar"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={deleteNode}
                            title="Eliminar nota"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        <div className="w-px h-4 bg-border mx-1" />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setIsExpanded(false)}
                            title="Cerrar reproductor"
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            )}
        </NodeViewWrapper>
    );
}
