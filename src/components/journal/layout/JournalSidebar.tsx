'use client';

import React, { useState } from 'react';
import {
    Folder,
    FolderOpen,
    Book,
    FileText,
    Trash2,
    Plus,
    ChevronRight,
    ChevronDown,
    MoreHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

interface Collection {
    id: string;
    parent_id: string | null;
    name: string;
    children?: Collection[];
}

interface JournalSidebarProps {
    collections: Collection[];
    selectedCollectionId: string | null;
    onSelectCollection: (id: string | null) => void;
    onCreateCollection: (parentId: string | null) => void;
    onDeleteCollection: (id: string) => void;
}

export function JournalSidebar({
    collections,
    selectedCollectionId,
    onSelectCollection,
    onCreateCollection,
    onDeleteCollection
}: JournalSidebarProps) {

    // Recursive component for tree rendering
    const CollectionItem = ({ collection, depth = 0 }: { collection: Collection, depth?: number }) => {
        const [isExpanded, setIsExpanded] = useState(true);
        const hasChildren = collection.children && collection.children.length > 0;
        const isSelected = selectedCollectionId === collection.id;

        return (
            <div>
                <div
                    className={cn(
                        "flex items-center group py-1 px-2 rounded-md hover:bg-accent/50 cursor-pointer select-none",
                        isSelected && "bg-accent text-accent-foreground font-medium"
                    )}
                    style={{ paddingLeft: `${(depth * 12) + 8}px` }}
                    onClick={() => onSelectCollection(collection.id)}
                >
                    <div
                        className="p-1 rounded-sm hover:bg-black/10 dark:hover:bg-white/10 mr-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                    >
                        {hasChildren ? (
                            isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />
                        ) : (
                            <div className="w-3 h-3" /> // Spacer
                        )}
                    </div>

                    {isExpanded ? (
                        <FolderOpen className="w-4 h-4 text-yellow-500 mr-2 shrink-0" />
                    ) : (
                        <Folder className="w-4 h-4 text-yellow-500 mr-2 shrink-0" />
                    )}

                    <span className="truncate text-sm flex-1">{collection.name}</span>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                                <MoreHorizontal className="w-3 h-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => onCreateCollection(collection.id)}>
                                <Plus className="w-4 h-4 mr-2" /> Nueva Subcarpeta
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => onDeleteCollection(collection.id)}
                            >
                                <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {isExpanded && hasChildren && (
                    <div>
                        {collection.children!.map(child => (
                            <CollectionItem key={child.id} collection={child} depth={depth + 1} />
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 border-r border-border">
            <div className="p-4 border-b border-border flex justify-between items-center bg-white dark:bg-zinc-950">
                <span className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Bibliotecas</span>
                <Button variant="ghost" size="icon" onClick={() => onCreateCollection(null)}>
                    <Plus className="w-4 h-4" />
                </Button>
            </div>

            <ScrollArea className="flex-1 p-2">
                {/* Special "All Library" item */}
                <div
                    className={cn(
                        "flex items-center py-2 px-3 mb-2 rounded-md hover:bg-accent/50 cursor-pointer",
                        selectedCollectionId === null && "bg-accent text-accent-foreground font-medium"
                    )}
                    onClick={() => onSelectCollection(null)}
                >
                    <Book className="w-4 h-4 text-blue-500 mr-2" />
                    <span className="text-sm">Mi Biblioteca</span>
                </div>

                {collections.map(collection => (
                    <CollectionItem key={collection.id} collection={collection} />
                ))}
            </ScrollArea>
        </div>
    );
}
