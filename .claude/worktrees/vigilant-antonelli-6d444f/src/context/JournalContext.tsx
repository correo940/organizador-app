'use client';

import React, { createContext, useContext, useState } from 'react';

interface JournalContextType {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    selectedDate: Date | undefined;
    setSelectedDate: (date: Date | undefined) => void;
    pendingQuote: string | null;
    addQuote: (text: string) => void;
    clearPendingQuote: () => void;
    width: number;
    setWidth: (width: number) => void;
    isBrowserOpen: boolean;
    setBrowserOpen: (isOpen: boolean) => void;
    isBrowserPinned: boolean;
    setBrowserPinned: (isPinned: boolean) => void;
    browserUrl: string;
    setBrowserUrl: (url: string) => void;
    browserWindow: Window | null;
    setBrowserWindow: (window: Window | null) => void;
}

const JournalContext = createContext<JournalContextType | undefined>(undefined);

export function JournalProvider({ children }: { children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [pendingQuote, setPendingQuote] = useState<string | null>(null);
    const [width, setWidth] = useState(33);
    const [isBrowserOpen, setBrowserOpen] = useState(false);
    const [isBrowserPinned, setBrowserPinned] = useState(false);
    const [browserUrl, setBrowserUrl] = useState('https://www.bing.com');
    const [browserWindow, setBrowserWindow] = useState<Window | null>(null);

    const addQuote = (text: string) => {
        setPendingQuote(text);
        setIsOpen(true);
    };

    const clearPendingQuote = () => {
        setPendingQuote(null);
    };

    return (
        <JournalContext.Provider value={{
            isOpen,
            setIsOpen,
            selectedDate,
            setSelectedDate,
            pendingQuote,
            addQuote,
            clearPendingQuote,
            width,
            setWidth,
            isBrowserOpen,
            setBrowserOpen,
            isBrowserPinned,
            setBrowserPinned,
            browserUrl,
            setBrowserUrl,
            browserWindow,
            setBrowserWindow
        }}>
            {children}
        </JournalContext.Provider>
    );
}

export function useJournal() {
    const context = useContext(JournalContext);
    if (context === undefined) {
        throw new Error('useJournal must be used within a JournalProvider');
    }
    return context;
}
