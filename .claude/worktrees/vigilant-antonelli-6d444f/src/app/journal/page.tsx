'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { JournalSidebar } from '@/components/journal/layout/JournalSidebar';
import { JournalList } from '@/components/journal/layout/JournalList';
import { JournalDetailPanel } from '@/components/journal/layout/JournalDetailPanel';
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup
} from "@/components/ui/resizable";
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export default function JournalLibraryPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [collections, setCollections] = useState<any[]>([]);
    const [entries, setEntries] = useState<any[]>([]);

    // Selection State
    const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
    const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            router.push('/login');
            return;
        }

        // Fetch collections
        const { data: colsData, error: colsError } = await supabase
            .from('journal_collections')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        if (colsError) console.error('Error fetching collections:', colsError);
        else setCollections(buildCollectionTree(colsData || []));

        // Fetch all entries (we filter client-side for now for speed/simplicity with small datasets)
        const { data: entriesData, error: entriesError } = await supabase
            .from('journal_entries')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (entriesError) console.error('Error fetching entries:', entriesError);
        else setEntries(entriesData || []);

        setIsLoading(false);
    };

    // Transform flat list to tree
    const buildCollectionTree = (items: any[]) => {
        const rootItems: any[] = [];
        const lookup: any = {};
        items.forEach(item => {
            lookup[item.id] = { ...item, children: [] };
        });
        items.forEach(item => {
            if (item.parent_id) {
                lookup[item.parent_id]?.children.push(lookup[item.id]);
            } else {
                rootItems.push(lookup[item.id]);
            }
        });
        return rootItems;
    };

    const filteredEntries = useMemo(() => {
        if (!selectedCollectionId) return entries;
        return entries.filter(e => e.collection_id === selectedCollectionId);
    }, [entries, selectedCollectionId]);

    const handleCreateCollection = async (parentId: string | null) => {
        const name = prompt("Nombre de la nueva carpeta:");
        if (!name) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('journal_collections')
            .insert({
                user_id: user.id,
                name,
                parent_id: parentId
            });

        if (error) {
            toast.error("Error al crear carpeta");
        } else {
            toast.success("Carpeta creada");
            fetchData();
        }
    };

    const handleDeleteCollection = async (id: string) => {
        if (!confirm("¿Seguro que quieres eliminar esta carpeta y su contenido?")) return;

        const { error } = await supabase
            .from('journal_collections')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error("Error al eliminar");
        } else {
            toast.success("Eliminado");
            if (selectedCollectionId === id) setSelectedCollectionId(null);
            fetchData();
        }
    };

    const handleDeleteEntry = async (id: string) => {
        if (!confirm("¿Eliminar este elemento?")) return;

        const { error } = await supabase
            .from('journal_entries')
            .delete()
            .eq('id', id);

        if (error) {
            toast.error("Error al eliminar");
        } else {
            toast.success("Elemento eliminado");
            if (selectedEntryId === id) setSelectedEntryId(null);
            setEntries(prev => prev.filter(e => e.id !== id));
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col pt-16 md:pt-0"> {/* Adjust for fixed header if needed */}
            <ResizablePanelGroup direction="horizontal" className="h-full border-t border-border">
                {/* Left Panel: Collections */}
                <ResizablePanel defaultSize={20} minSize={15} maxSize={30} className="hidden md:block">
                    <JournalSidebar
                        collections={collections}
                        selectedCollectionId={selectedCollectionId}
                        onSelectCollection={setSelectedCollectionId}
                        onCreateCollection={handleCreateCollection}
                        onDeleteCollection={handleDeleteCollection}
                    />
                </ResizablePanel>

                <ResizableHandle className="hidden md:flex" />

                {/* Middle Panel: List */}
                <ResizablePanel defaultSize={40} minSize={30}>
                    <JournalList
                        entries={filteredEntries}
                        selectedEntryId={selectedEntryId}
                        onSelectEntry={(entry) => setSelectedEntryId(entry.id)}
                    />
                </ResizablePanel>

                <ResizableHandle />

                {/* Right Panel: Details */}
                <ResizablePanel defaultSize={40} minSize={30}>
                    <JournalDetailPanel
                        entry={entries.find(e => e.id === selectedEntryId) || null}
                        onUpdateEntry={fetchData} // Or optimize with local update
                        onDeleteEntry={handleDeleteEntry}
                    />
                </ResizablePanel>
            </ResizablePanelGroup>
        </div>
    );
}
