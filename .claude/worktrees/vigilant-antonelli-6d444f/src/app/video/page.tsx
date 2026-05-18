"use client";

import { useState } from "react";
import { useSVD } from "@/hooks/useSVD";
import { Loader2, Settings, Type, Video, Play, Download, HelpCircle } from "lucide-react";

export default function VideoPhantomPage() {
    const { 
        svdApiUrl, 
        saveApiUrl, 
        isGenerating, 
        error, 
        videoUrl, 
        generateVideo 
    } = useSVD();

    const [apiUrlInput, setApiUrlInput] = useState("");
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Parámetros de SD Videos (Walk)
    const [prompts, setPrompts] = useState("un gato hermoso, 4k, detallado\nun perro majestuoso, 4k, detallado");
    const [seeds, setSeeds] = useState("42, 1337");
    const [interpolationSteps, setInterpolationSteps] = useState(10);
    const [fps, setFps] = useState(15);
    const [inferenceSteps, setInferenceSteps] = useState(30);
    const [guidanceScale, setGuidanceScale] = useState(7.5);

    const handleUrlSave = () => {
        if (!apiUrlInput.trim()) return;
        saveApiUrl(apiUrlInput.trim());
    };

    const handleGenerate = async () => {
        if (!prompts.trim()) return;
        
        await generateVideo({
            prompts,
            seeds: seeds || "42,1337",
            interpolationSteps,
            fps,
            inferenceSteps,
            guidanceScale
        });
    };

    return (
        <div className="min-h-screen bg-[#050505] text-zinc-300 font-mono p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl flex flex-col gap-6 pt-10">
                {/* Header */}
                <header className="border-b border-zinc-800 pb-6 mb-4">
                    <div className="flex items-center gap-3 text-zinc-100">
                        <Video className="w-6 h-6 text-fuchsia-400" />
                        <h1 className="text-2xl font-bold tracking-tight">AI Video Walk</h1>
                    </div>
                    <p className="text-zinc-500 mt-2 text-sm max-w-xl">
                        Interpolación surrealista texto-a-video (Stable Diffusion Videos). Escribe dos o más prompts en líneas separadas para generar un video continuo morfando entre ellos.
                    </p>
                </header>

                {/* API Setup */}
                <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider flex items-center gap-2">
                            <Settings className="w-4 h-4 text-zinc-400" />
                            Render Node API
                        </h2>
                        {svdApiUrl ? (
                            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full flex items-center gap-1.5 border border-green-500/20">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                NODO ENLAZADO
                            </span>
                        ) : (
                            <span className="text-xs bg-rose-500/10 text-rose-400 px-2 py-1 rounded-full flex items-center gap-1.5 border border-rose-500/20">
                                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
                                OFFLINE
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            placeholder={svdApiUrl || "Ej: https://xxxx-xxxx.gradio.live"}
                            value={apiUrlInput}
                            onChange={(e) => setApiUrlInput(e.target.value)}
                            className="flex-1 bg-black border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-500 focus:ring-1 focus:ring-fuchsia-500/50 transition-all font-mono placeholder:text-zinc-700"
                        />
                        <button 
                            onClick={handleUrlSave}
                            className="bg-zinc-100 text-black px-4 py-2 rounded-md text-sm font-bold hover:bg-white transition-colors"
                        >
                            Vincular
                        </button>
                    </div>
                    {svdApiUrl && (
                        <p className="text-xs mt-2 text-zinc-500 truncate">
                            Endpoint actual: {svdApiUrl}
                        </p>
                    )}
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Input Panel */}
                    <div className="flex flex-col gap-6">
                        {/* Texto (Prompts) */}
                        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                            <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Type className="w-4 h-4 text-zinc-400" />
                                Prompts (Guión de Morphing)
                            </h2>
                            
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-zinc-400">Describe las escenas (una por línea)</span>
                                        <span title="Ejemplo:\nuna manzana flotando\nuna banana dorada">
                                            <HelpCircle className="w-3 h-3 text-zinc-600 cursor-help" />
                                        </span>
                                    </div>
                                    <textarea 
                                        rows={4}
                                        value={prompts}
                                        onChange={e => setPrompts(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-fuchsia-500 font-sans"
                                        placeholder="un bosque encantado\nuna ciudad ciberpunk\nel espacio exterior"
                                    />
                                </div>
                                <div>
                                    <span className="text-xs text-zinc-400 block mb-1">Semillas (Opcional, separadas por coma)</span>
                                    <input 
                                        type="text" 
                                        value={seeds}
                                        onChange={e => setSeeds(e.target.value)}
                                        className="w-full bg-black border border-zinc-800 rounded-md px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-fuchsia-500 font-mono"
                                        placeholder="42, 1234, 5555"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Configuración SVD Walk */}
                        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider">
                                    Ajustes de Animación
                                </h2>
                                <button 
                                    onClick={() => setShowAdvanced(!showAdvanced)}
                                    className="text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
                                >
                                    {showAdvanced ? "Ocultar Avanzados" : "Mostrar Avanzados"}
                                </button>
                            </div>

                            <div className="space-y-5">
                                {/* Interpolation steps */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs text-zinc-400">Suavidad de transición (Steps)</span>
                                        <span className="text-xs font-bold text-zinc-200">{interpolationSteps}</span>
                                    </div>
                                    <input type="range" min="3" max="60" value={interpolationSteps} onChange={e => setInterpolationSteps(Number(e.target.value))} className="w-full accent-fuchsia-500" />
                                    <p className="text-[10px] text-zinc-600 mt-1">Más steps = transición más suave</p>
                                </div>

                                {/* FPS */}
                                <div>
                                    <div className="flex justify-between mb-1">
                                        <span className="text-xs text-zinc-400">Frames por Segundo (FPS)</span>
                                        <span className="text-xs font-bold text-zinc-200">{fps}</span>
                                    </div>
                                    <input type="range" min="5" max="30" value={fps} onChange={e => setFps(Number(e.target.value))} className="w-full accent-fuchsia-500" />
                                </div>

                                {/* Avanzados */}
                                {showAdvanced && (
                                    <div className="pt-4 border-t border-zinc-800 space-y-4">
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-xs text-zinc-400">Calidad (Inference Steps)</span>
                                                <span className="text-xs font-bold text-zinc-200">{inferenceSteps}</span>
                                            </div>
                                            <input type="range" min="15" max="100" value={inferenceSteps} onChange={e => setInferenceSteps(Number(e.target.value))} className="w-full accent-fuchsia-500" />
                                            <p className="text-[10px] text-zinc-600 mt-1">Más alto = mejor calidad de imagen, más lento</p>
                                        </div>
                                        <div>
                                            <div className="flex justify-between mb-1">
                                                <span className="text-xs text-zinc-400">Guidance Scale (Apego al prompt)</span>
                                                <span className="text-xs font-bold text-zinc-200">{guidanceScale.toFixed(1)}</span>
                                            </div>
                                            <input type="range" min="1" max="20" step="0.5" value={guidanceScale} onChange={e => setGuidanceScale(Number(e.target.value))} className="w-full accent-fuchsia-500" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Execute Action */}
                        <button
                            onClick={handleGenerate}
                            disabled={!prompts || !svdApiUrl || isGenerating}
                            className={`w-full py-4 rounded-lg font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all
                                ${!prompts || !svdApiUrl 
                                    ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                    : isGenerating
                                        ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/50'
                                        : 'bg-fuchsia-600 text-white hover:bg-fuchsia-500 shadow-lg shadow-fuchsia-900/20'}
                            `}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    GENERANDO METAMORFOSIS...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" fill="currentColor" />
                                    INICIALIZAR RENDERIZADO
                                </>
                            )}
                        </button>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-md text-sm font-mono break-words">
                                ERROR AL RENDERIZAR: {error}
                            </div>
                        )}
                    </div>

                    {/* Output Panel */}
                    <div className="flex flex-col gap-6">
                        <section className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 flex-1 flex flex-col">
                            <h2 className="text-sm font-semibold text-zinc-100 uppercase tracking-wider mb-4 border-b border-zinc-800 pb-2">
                                Salida de Video (SD Walk)
                            </h2>
                            
                            <div className="flex-1 flex flex-col items-center justify-center relative bg-black/50 rounded-lg border border-zinc-800/50 overflow-hidden min-h-[300px]">
                                {isGenerating ? (
                                    <div className="flex flex-col items-center text-zinc-500 animate-pulse">
                                        <div className="relative w-16 h-16 mb-4">
                                            <div className="absolute inset-0 rounded-full border-r-2 border-fuchsia-500 animate-spin"></div>
                                            <div className="absolute inset-2 rounded-full border-l-2 border-indigo-500 animate-spin-reverse"></div>
                                        </div>
                                        <p className="font-mono text-xs uppercase tracking-[0.2em] text-fuchsia-400">Difusión de Ruido Activa</p>
                                        <p className="text-[10px] mt-2 opacity-50">Tarda ~2-5 minutos según cant. de Prompts</p>
                                    </div>
                                ) : videoUrl ? (
                                    <div className="w-full h-full flex flex-col relative group">
                                        <video 
                                            src={videoUrl} 
                                            controls 
                                            autoPlay 
                                            loop
                                            className="w-full h-full object-contain max-h-[500px]"
                                        />
                                        <a 
                                            href={videoUrl} 
                                            download="SDV_Generated_Phantom.mp4"
                                            className="absolute top-2 right-2 bg-black/80 text-white p-2 rounded-md hover:bg-fuchsia-600 transition-colors backdrop-blur-md border border-zinc-700 hover:border-fuchsia-500 opacity-0 group-hover:opacity-100"
                                            title="Descargar Video"
                                        >
                                            <Download className="w-4 h-4" />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="text-center text-zinc-600">
                                        <Video className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p className="text-xs uppercase tracking-widest font-semibold">Esperando secuencia de texto</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}

