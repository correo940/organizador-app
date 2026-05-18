'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { es } from 'date-fns/locale';

import { format } from 'date-fns';

interface NotesWidgetProps {
    selectedDate: Date | undefined;
}

export default function NotesWidget({ selectedDate }: NotesWidgetProps) {
    const [note, setNote] = useState('');

    // Generate a key based on the date, fallback to 'general' if no date
    const getNoteKey = (date: Date | undefined) => {
        if (!date) return 'quiova_quick_note_general';
        return `quiova_note_${format(date, 'yyyy-MM-dd')}`;
    };

    useEffect(() => {
        const key = getNoteKey(selectedDate);
        const savedNote = localStorage.getItem(key);
        setNote(savedNote || '');
    }, [selectedDate]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setNote(newValue);
        const key = getNoteKey(selectedDate);
        localStorage.setItem(key, newValue);
    };

    return (
        <Card className="h-full flex flex-col">
            <CardHeader>
                <CardTitle>
                    {selectedDate
                        ? `Notas del ${format(selectedDate, "d 'de' MMMM", { locale: es })}`
                        : "Notas Generales"
                    }
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[200px]">
                <Textarea
                    placeholder="Escribe aquí tus ideas, recordatorios o pensamientos..."
                    className="h-full resize-none border-0 focus-visible:ring-0 p-0 text-lg leading-relaxed bg-transparent"
                    value={note}
                    onChange={handleChange}
                />
            </CardContent>
        </Card>
    );
}
