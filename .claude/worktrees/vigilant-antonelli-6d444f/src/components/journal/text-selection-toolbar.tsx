'use client';

import React, { useEffect, useState } from 'react';
import { Quote } from 'lucide-react';
import { useJournal } from '@/context/JournalContext';
import { motion, AnimatePresence } from 'framer-motion';

export default function TextSelectionToolbar() {
    const { addQuote } = useJournal();
    const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
    const [selectedText, setSelectedText] = useState('');

    useEffect(() => {
        const handleSelectionChange = () => {
            const selection = window.getSelection();

            if (!selection || selection.isCollapsed || !selection.toString().trim()) {
                setPosition(null);
                setSelectedText('');
                return;
            }

            const text = selection.toString().trim();
            // Ignore if selection is inside the journal panel itself to avoid annoying popup while writing
            const anchorNode = selection.anchorNode;
            if (anchorNode?.parentElement?.closest('.journal-panel')) {
                return;
            }

            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            // Calculate position above the selection (Viewport relative for fixed positioning)
            setPosition({
                top: rect.top - 50,
                left: rect.left + (rect.width / 2) - 40 // Center the button (approx width 80px)
            });
            setSelectedText(text);
        };

        // Use mouseup for better stability than selectionchange
        document.addEventListener('mouseup', handleSelectionChange);
        document.addEventListener('keyup', handleSelectionChange); // For keyboard selection

        return () => {
            document.removeEventListener('mouseup', handleSelectionChange);
            document.removeEventListener('keyup', handleSelectionChange);
        };
    }, []);

    const handleQuoteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (selectedText) {
            addQuote(selectedText);
            // Clear selection
            window.getSelection()?.removeAllRanges();
            setPosition(null);
        }
    };

    return (
        <AnimatePresence>
            {position && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: 10 }}
                    style={{
                        position: 'fixed',
                        top: position.top,
                        left: position.left,
                        zIndex: 9999
                    }}
                >
                    <button
                        onClick={handleQuoteClick}
                        className="flex items-center gap-2 px-3 py-2 bg-black text-white dark:bg-white dark:text-black rounded-full shadow-xl hover:scale-105 transition-transform font-medium text-sm"
                    >
                        <Quote className="w-4 h-4" />
                        Citar
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
