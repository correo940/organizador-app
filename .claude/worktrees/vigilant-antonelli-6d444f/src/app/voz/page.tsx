"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTTS } from '@/hooks/useTTS';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Mic2, Play, Square, Settings2, ShieldCheck, Volume2, Cpu, ChevronDown, Zap, AudioWaveform } from "lucide-react";
import { toast } from 'sonner';

// Idiomas disponibles en el XTTS (mapeados al Colab)
const LANGUAGES = [
    { label: "Spanish", value: "Spanish", code: "es" },
    { label: "English-1", value: "English-1", code: "en" },
    { label: "English-2", value: "English-2", code: "en" },
    { label: "French", value: "French", code: "fr" },
    { label: "German", value: "German", code: "de" },
    { label: "Italian", value: "Italian", code: "it" },
    { label: "Portuguese", value: "Portuguese", code: "pt" },
    { label: "Arabic", value: "Arabic", code: "ar" },
    { label: "Bulgarian", value: "Bulgarian", code: "bg" },
    { label: "Chinese", value: "Chinese", code: "zh" },
    { label: "Croatian", value: "Croatian", code: "hr" },
    { label: "Czech", value: "Czech", code: "cs" },
    { label: "Danish", value: "Danish", code: "da" },
    { label: "Dutch", value: "Dutch", code: "nl" },
    { label: "Finnish", value: "Finnish", code: "fi" },
    { label: "Greek", value: "Greek", code: "el" },
    { label: "Hindi", value: "Hindi", code: "hi" },
    { label: "Hungarian", value: "Hungarian", code: "hu" },
    { label: "Indonesian", value: "Indonesian", code: "id" },
    { label: "Japanese", value: "Japanese", code: "ja" },
    { label: "Korean", value: "Korean", code: "ko" },
    { label: "Norwegian", value: "Norwegian", code: "no" },
    { label: "Polish", value: "Polish", code: "pl" },
    { label: "Romanian", value: "Romanian", code: "ro" },
    { label: "Russian", value: "Russian", code: "ru" },
    { label: "Slovak", value: "Slovak", code: "sk" },
    { label: "Swedish", value: "Swedish", code: "sv" },
    { label: "Tamil", value: "Tamil", code: "ta" },
    { label: "Turkish", value: "Turkish", code: "tr" },
    { label: "Ukrainian", value: "Ukrainian", code: "uk" },
    { label: "Vietnamese", value: "Vietnamese", code: "vi" },
];

const TTS_LANGUAGES = [
    { label: "Spanish", value: "es" },
    { label: "English", value: "en" },
    { label: "French", value: "fr" },
    { label: "German", value: "de" },
    { label: "Italian", value: "it" },
    { label: "Portuguese", value: "pt" },
    { label: "Polish", value: "pl" },
    { label: "Turkish", value: "tr" },
    { label: "Russian", value: "ru" },
    { label: "Dutch", value: "nl" },
    { label: "Czech", value: "cs" },
    { label: "Arabic", value: "ar" },
    { label: "Chinese", value: "zh" },
    { label: "Hungarian", value: "hu" },
    { label: "Korean", value: "ko" },
    { label: "Japanese", value: "ja" },
];

// Voces en español hardcodeadas como fallback
const SPANISH_VOICES_FALLBACK = [
    'Alejandro_-_Mexican_male', 'Andrea', 'Antonio_ia', 'Beto_-_Latin_American_Spanish_Argentina',
    'Carlos_-_Podcasting__News', 'Carmelo', 'Carolina_-_Spanish_woman_-_es_ES',
    'Cristian_Medina', 'Dante_-_Castilian_Spanish', 'Dany_-_Professional_narrator',
    'Diego_Aguado_-_Spanish_deep_voice', 'Eduardo_-_Advertising__Commercial_voice_in_Spanish',
    'Eva_Dorado', 'Fernando', 'Francisco', 'Gabriela_-_Spanish_from_Mexico_',
    'Javier_España', 'Javier_Madrid', 'Jorge', 'José_Borda',
    'Juan', 'Juan_Carlos', 'Juan_Manuel', 'Leonardo', 'Luis',
    'Malena_Tango', 'Mariluz_Parras', 'María', 'Miguel',
    'Nina', 'Pablo_Vambe_AI_V2', 'Pilar_Corral', 'Rafael',
    'Ricardo', 'Rosa_-_Spanish_Calm_Old_Woman', 'Santiago', 'Santiago_-_calm',
    'Serena_AI', 'Sofi', 'Valeria', 'Victor', 'paco'
];

export default function VoicePhantomPage() {
    const { generate, loadModel, loadVoices, stop, loading, modelLoading, modelLoaded, error, isPlaying, audioUrl } = useTTS();

    // Server config
    const [config, setConfig] = useState({ xttsApiUrl: '', defaultVoice: '' });
    const [isSaving, setIsSaving] = useState(false);

    // TTS params
    const [selectedLanguage, setSelectedLanguage] = useState('Spanish');
    const [ttsLanguage, setTtsLanguage] = useState('es');
    const [text, setText] = useState('');
    const [voices, setVoices] = useState<string[]>(SPANISH_VOICES_FALLBACK);
    const [selectedVoice, setSelectedVoice] = useState('');
    const [voicesLoading, setVoicesLoading] = useState(false);
    const [voiceFilter, setVoiceFilter] = useState('');

    // Advanced params
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [temperature, setTemperature] = useState(0.75);
    const [lengthPenalty, setLengthPenalty] = useState(1);
    const [repetitionPenalty, setRepetitionPenalty] = useState(5);
    const [topK, setTopK] = useState(50);
    const [topP, setTopP] = useState(0.85);
    const [sentenceSplit, setSentenceSplit] = useState(true);
    const [useConfig, setUseConfig] = useState(false);

    // Load config on mount
    useEffect(() => {
        fetch('/api/tts/config')
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error("Error loading config", err));
    }, []);

    const saveConfig = async () => {
        setIsSaving(true);
        try {
            const res = await fetch('/api/tts/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                toast.success("🔗 URL guardada en las sombras.");
            } else {
                throw new Error("Error al guardar");
            }
        } catch (e) {
            toast.error("Fallo al guardar la configuración.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLoadModel = async () => {
        try {
            const msg = await loadModel();
            toast.success(`🧠 ${msg}`);
        } catch (e: any) {
            toast.error(`Error: ${e.message}`);
        }
    };

    const handleLanguageChange = useCallback(async (lang: string) => {
        setSelectedLanguage(lang);
        setSelectedVoice('');
        setVoiceFilter('');
        setVoicesLoading(true);

        // Also auto-detect TTS language
        const langInfo = LANGUAGES.find(l => l.value === lang);
        if (langInfo) setTtsLanguage(langInfo.code);

        // Try to load voices from the server
        const serverVoices = await loadVoices(lang);
        if (serverVoices.length > 0) {
            setVoices(serverVoices);
            setSelectedVoice(serverVoices[0]);
        } else if (lang === 'Spanish') {
            setVoices(SPANISH_VOICES_FALLBACK);
            setSelectedVoice(SPANISH_VOICES_FALLBACK[0]);
        } else {
            setVoices([]);
        }
        setVoicesLoading(false);
    }, [loadVoices]);

    const handleGenerate = async () => {
        if (!text.trim()) {
            toast.error("Escribe algo para narrar.");
            return;
        }
        if (!selectedVoice) {
            toast.error("Selecciona una voz.");
            return;
        }

        try {
            await generate({
                selectedLanguage,
                ttsLanguage,
                text: text.trim(),
                speakerName: selectedVoice,
                temperature,
                lengthPenalty,
                repetitionPenalty,
                topK,
                topP,
                sentenceSplit,
                useConfig,
            });
            toast.success("🎙️ Audio generado.");
        } catch (e: any) {
            toast.error(e.message);
        }
    };

    const filteredVoices = voiceFilter
        ? voices.filter(v => v.toLowerCase().includes(voiceFilter.toLowerCase()))
        : voices;

    return (
        <div className="min-h-screen bg-black text-gray-100 p-4 md:p-8 font-sans">
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in zoom-in duration-700">
                {/* Header */}
                <div className="text-center space-y-3 py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-900 border border-gray-800 shadow-[0_0_40px_rgba(59,130,246,0.15)]">
                        <Mic2 className={`h-8 w-8 ${isPlaying ? 'text-blue-400 animate-pulse' : 'text-gray-400'}`} />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500">
                        QUIOVA VOZ
                    </h1>
                    <p className="text-gray-600 text-xs tracking-[0.3em] uppercase">XTTS v2 · 2161 Voces · Protocolo Fantasma</p>
                </div>

                {/* Grid Layout */}
                <div className="grid md:grid-cols-2 gap-5">

                    {/* LEFT COLUMN: Config + Model */}
                    <div className="space-y-5">
                        {/* Server Config */}
                        <Card className="bg-gray-950/80 border-gray-800/50 backdrop-blur-xl">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2 text-gray-300">
                                    <Settings2 className="h-3.5 w-3.5 text-blue-500" /> Servidor XTTS
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <Input
                                    value={config.xttsApiUrl}
                                    onChange={(e) => setConfig({ ...config, xttsApiUrl: e.target.value })}
                                    placeholder="https://xxxx.gradio.live"
                                    className="bg-black/70 border-gray-800 text-blue-400 text-sm placeholder:text-gray-700 focus:ring-blue-900 focus:border-blue-800"
                                />
                                <Button
                                    onClick={saveConfig}
                                    disabled={isSaving}
                                    size="sm"
                                    className="w-full bg-gray-800 text-gray-200 hover:bg-gray-700 text-xs"
                                >
                                    {isSaving ? <Loader2 className="animate-spin h-3 w-3 mr-1" /> : <ShieldCheck className="mr-1 h-3 w-3" />}
                                    GUARDAR URL
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Load Model */}
                        <Card className="bg-gray-950/80 border-gray-800/50 backdrop-blur-xl">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2 text-gray-300">
                                    <Cpu className="h-3.5 w-3.5 text-green-500" /> Motor Neural
                                </CardTitle>
                                <CardDescription className="text-gray-600 text-xs">
                                    Carga el modelo XTTS en el servidor antes de generar.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button
                                    onClick={handleLoadModel}
                                    disabled={modelLoading || !config.xttsApiUrl}
                                    size="sm"
                                    className={`w-full text-xs font-bold transition-all ${modelLoaded
                                        ? 'bg-green-950/50 text-green-300 border border-green-950 hover:bg-green-950'
                                        : 'bg-blue-900/50 text-blue-300 border border-blue-800 hover:bg-blue-900'
                                        }`}
                                >
                                    {modelLoading ? (
                                        <><Loader2 className="animate-spin h-3 w-3 mr-1" /> CARGANDO MODELO...</>
                                    ) : modelLoaded ? (
                                        <><Zap className="h-3 w-3 mr-1" /> MODELO ACTIVO ✓</>
                                    ) : (
                                        <><Cpu className="h-3 w-3 mr-1" /> CARGAR MODELO</>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Language & Voice Selection */}
                        <Card className="bg-gray-950/80 border-gray-800/50 backdrop-blur-xl">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2 text-gray-300">
                                    <AudioWaveform className="h-3.5 w-3.5 text-purple-500" /> Voz
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {/* Idioma de referencia (voces) */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Idioma de las voces</Label>
                                    <select
                                        value={selectedLanguage}
                                        onChange={(e) => handleLanguageChange(e.target.value)}
                                        className="w-full bg-black/70 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200 focus:ring-blue-900 focus:border-blue-800"
                                    >
                                        {LANGUAGES.map(l => (
                                            <option key={l.value} value={l.value}>{l.label}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Búsqueda de voz */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-gray-500 uppercase tracking-wider">
                                        Buscar voz ({filteredVoices.length} disponibles)
                                    </Label>
                                    <Input
                                        value={voiceFilter}
                                        onChange={(e) => setVoiceFilter(e.target.value)}
                                        placeholder="Filtrar voces..."
                                        className="bg-black/70 border-gray-800 text-sm placeholder:text-gray-700"
                                    />
                                </div>

                                {/* Selector de voz */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Voz seleccionada</Label>
                                    {voicesLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                                            <Loader2 className="animate-spin h-3 w-3" /> Cargando voces...
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedVoice}
                                            onChange={(e) => setSelectedVoice(e.target.value)}
                                            className="w-full bg-black/70 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200 focus:ring-blue-900 max-h-48 overflow-y-auto"
                                            size={Math.min(filteredVoices.length, 6)}
                                        >
                                            {filteredVoices.map(v => (
                                                <option key={v} value={v} className="py-0.5">
                                                    {v.replace(/_/g, ' ')}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Idioma de síntesis */}
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] text-gray-500 uppercase tracking-wider">Idioma de síntesis</Label>
                                    <select
                                        value={ttsLanguage}
                                        onChange={(e) => setTtsLanguage(e.target.value)}
                                        className="w-full bg-black/70 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200"
                                    >
                                        {TTS_LANGUAGES.map(l => (
                                            <option key={l.value} value={l.value}>{l.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: Text + Generate + Audio */}
                    <div className="space-y-5">
                        {/* Text Input */}
                        <Card className="bg-gray-950/80 border-gray-800/50 backdrop-blur-xl">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2 text-gray-300">
                                    <Volume2 className="h-3.5 w-3.5 text-amber-500" /> Texto a narrar
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Escribe aquí el texto que quieres convertir en voz..."
                                    rows={6}
                                    className="w-full bg-black/70 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-200 placeholder:text-gray-700 focus:ring-blue-900 focus:border-blue-800 resize-none"
                                />
                                <div className="text-right">
                                    <span className="text-[10px] text-gray-600">{text.length} caracteres</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Advanced Settings */}
                        <Card className="bg-gray-950/80 border-gray-800/50 backdrop-blur-xl">
                            <CardHeader
                                className="pb-3 cursor-pointer select-none"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                            >
                                <CardTitle className="text-sm flex items-center justify-between text-gray-300">
                                    <span className="flex items-center gap-2">
                                        <Settings2 className="h-3.5 w-3.5 text-gray-500" /> Ajustes Avanzados
                                    </span>
                                    <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                                </CardTitle>
                            </CardHeader>
                            {showAdvanced && (
                                <CardContent className="space-y-4 pt-0">
                                    {/* Temperature */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Label className="text-[10px] text-gray-500 uppercase">Temperature</Label>
                                            <span className="text-[10px] text-blue-400 font-mono">{temperature}</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.05" value={temperature}
                                            onChange={e => setTemperature(parseFloat(e.target.value))}
                                            className="w-full accent-blue-500 h-1" />
                                    </div>

                                    {/* Length Penalty */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Label className="text-[10px] text-gray-500 uppercase">Length Penalty</Label>
                                            <span className="text-[10px] text-blue-400 font-mono">{lengthPenalty}</span>
                                        </div>
                                        <input type="range" min="-10" max="10" step="0.5" value={lengthPenalty}
                                            onChange={e => setLengthPenalty(parseFloat(e.target.value))}
                                            className="w-full accent-blue-500 h-1" />
                                    </div>

                                    {/* Repetition Penalty */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Label className="text-[10px] text-gray-500 uppercase">Repetition Penalty</Label>
                                            <span className="text-[10px] text-blue-400 font-mono">{repetitionPenalty}</span>
                                        </div>
                                        <input type="range" min="1" max="10" step="0.5" value={repetitionPenalty}
                                            onChange={e => setRepetitionPenalty(parseFloat(e.target.value))}
                                            className="w-full accent-blue-500 h-1" />
                                    </div>

                                    {/* Top K */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Label className="text-[10px] text-gray-500 uppercase">Top K</Label>
                                            <span className="text-[10px] text-blue-400 font-mono">{topK}</span>
                                        </div>
                                        <input type="range" min="1" max="100" step="1" value={topK}
                                            onChange={e => setTopK(parseInt(e.target.value))}
                                            className="w-full accent-blue-500 h-1" />
                                    </div>

                                    {/* Top P */}
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between">
                                            <Label className="text-[10px] text-gray-500 uppercase">Top P</Label>
                                            <span className="text-[10px] text-blue-400 font-mono">{topP}</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.05" value={topP}
                                            onChange={e => setTopP(parseFloat(e.target.value))}
                                            className="w-full accent-blue-500 h-1" />
                                    </div>

                                    {/* Checkboxes */}
                                    <div className="flex items-center gap-6 pt-1">
                                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                            <input type="checkbox" checked={sentenceSplit}
                                                onChange={e => setSentenceSplit(e.target.checked)}
                                                className="accent-blue-500 rounded" />
                                            Dividir frases
                                        </label>
                                        <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                                            <input type="checkbox" checked={useConfig}
                                                onChange={e => setUseConfig(e.target.checked)}
                                                className="accent-blue-500 rounded" />
                                            Usar config del modelo
                                        </label>
                                    </div>
                                </CardContent>
                            )}
                        </Card>

                        {/* Generate Button */}
                        <div className="flex gap-3">
                            <Button
                                onClick={handleGenerate}
                                disabled={loading || !config.xttsApiUrl || !selectedVoice || !text.trim()}
                                className="flex-1 h-14 bg-gradient-to-r from-blue-600 to-blue-800 hover:from-blue-500 hover:to-blue-700 text-white font-bold text-sm tracking-wider shadow-[0_0_30px_rgba(59,130,246,0.2)] transition-all disabled:opacity-30"
                            >
                                {loading ? (
                                    <><Loader2 className="animate-spin h-5 w-5 mr-2" /> GENERANDO...</>
                                ) : (
                                    <><Play className="h-5 w-5 mr-2" /> GENERAR VOZ</>
                                )}
                            </Button>
                            <Button
                                onClick={stop}
                                disabled={!isPlaying}
                                variant="outline"
                                className="h-14 px-5 border-gray-800 hover:bg-gray-900 text-gray-300"
                            >
                                <Square className="h-5 w-5" />
                            </Button>
                        </div>

                        {/* Audio Player */}
                        {audioUrl && (
                            <Card className="bg-gray-950/80 border-gray-800/50 backdrop-blur-xl">
                                <CardContent className="py-4">
                                    <audio
                                        src={audioUrl}
                                        controls
                                        className="w-full h-10"
                                        style={{ filter: 'invert(1) hue-rotate(180deg) brightness(0.8)' }}
                                    />
                                </CardContent>
                            </Card>
                        )}

                        {/* Error Display */}
                        {error && (
                            <div className="bg-red-950/30 border border-red-900/50 rounded-lg p-3">
                                <p className="text-red-400 text-xs font-medium">{error}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-4 pb-8">
                    <p className="text-[9px] text-gray-800 uppercase tracking-[0.3em]">
                        Solo para tus oídos · No dejes rastro · Phantom v2.0
                    </p>
                </div>
            </div>
        </div>
    );
}

