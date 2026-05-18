'use client';

import React from 'react';
import {
    FileText,
    Book,
    Globe,
    File,
    MoreVertical
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from '@/lib/utils';

interface JournalEntry {
    id: string;
    title: string; // From metadata or tags or content snippet
    entry_type: 'note' | 'book' | 'article' | 'webpage' | 'document';
    metadata: any;
    created_at: string;
    updated_at: string;
}

interface JournalListProps {
    entries: JournalEntry[];
    selectedEntryId: string | null;
    onSelectEntry: (entry: JournalEntry) => void;
}

export function JournalList({ entries, selectedEntryId, onSelectEntry }: JournalListProps) {

    const getIcon = (type: string) => {
        switch (type) {
            case 'book': return <Book className="w-4 h-4 text-amber-700" />;
            case 'article': return <FileText className="w-4 h-4 text-blue-600" />;
            case 'webpage': return <Globe className="w-4 h-4 text-cyan-600" />;
            case 'document': return <File className="w-4 h-4 text-slate-500" />;
            default: return <FileText className="w-4 h-4 text-yellow-500" />; // Note
        }
    };

    const getTitle = (entry: JournalEntry) => {
        if (entry.metadata?.title) return entry.metadata.title;
        // Fallback for old notes: try to get first line or placeholder
        return "Sin título";
    };

    const getCreator = (entry: JournalEntry) => {
        const m = entry.metadata;
        if (m?.author) return m.author;
        if (m?.creators && m.creators.length > 0) {
            const c = m.creators[0];
            return `${c.lastName || ''} ${c.firstName || ''}`.trim();
        }
        return '';
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-950">
            {/* Toolbar for sorting/filtering could go here */}
            <div className="flex-1 overflow-auto">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-zinc-900 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[30px]"></TableHead>
                            <TableHead className="w-[40%]">Título</TableHead>
                            <TableHead className="w-[20%]">Creador</TableHead>
                            <TableHead className="w-[15%]">Año</TableHead>
                            <TableHead className="text-right">Fecha</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                    Esta colección está vacía.
                                </TableCell>
                            </TableRow>
                        ) : (
                            entries.map((entry) => (
                                <TableRow
                                    key={entry.id}
                                    className={cn(
                                        "cursor-pointer hover:bg-muted/50 transition-colors",
                                        selectedEntryId === entry.id && "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500"
                                    )}
                                    onClick={() => onSelectEntry(entry)}
                                >
                                    <TableCell className="py-2 px-2">
                                        {getIcon(entry.entry_type)}
                                    </TableCell>
                                    <TableCell className="font-medium py-2">
                                        {getTitle(entry)}
                                    </TableCell>
                                    <TableCell className="py-2 text-muted-foreground">
                                        {getCreator(entry)}
                                    </TableCell>
                                    <TableCell className="py-2 text-muted-foreground">
                                        {entry.metadata?.date ? entry.metadata.date.substring(0, 4) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right py-2 text-xs text-muted-foreground">
                                        {format(new Date(entry.updated_at), 'dd/MM/yy', { locale: es })}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
