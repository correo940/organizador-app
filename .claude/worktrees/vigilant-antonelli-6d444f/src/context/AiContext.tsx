'use client';

import React, { createContext, useContext, useState } from 'react';

interface AiContextType {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    width: number;
    setWidth: (width: number) => void;
    isWakeWordEnabled: boolean;
    setIsWakeWordEnabled: (enabled: boolean) => void;
    pendingPrompt: string | null;
    setPendingPrompt: (prompt: string | null) => void;
}

const AiContext = createContext<AiContextType | undefined>(undefined);

export function AiProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [width, setWidth] = useState(33);
    const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(false);
    const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

    React.useEffect(() => {
        try {
            const saved = localStorage.getItem('quioba_wake_word');
            if (saved !== null) {
                setIsWakeWordEnabled(saved === 'true');
            } else {
                setIsWakeWordEnabled(false);
            }
        } catch {
            setIsWakeWordEnabled(false);
        }
    }, []);

    const toggleWakeWord = (enabled: boolean) => {
        setIsWakeWordEnabled(enabled);
        localStorage.setItem('quioba_wake_word', String(enabled));
    };

    return (
        <AiContext.Provider value={{
            isOpen,
            setIsOpen,
            width,
            setWidth,
            isWakeWordEnabled,
            setIsWakeWordEnabled: toggleWakeWord,
            pendingPrompt,
            setPendingPrompt
        }}>
            {children}
        </AiContext.Provider>
    );
}

export function useAi() {
    const context = useContext(AiContext);
    if (context === undefined) {
        throw new Error('useAi must be used within an AiProvider');
    }
    return context;
}
