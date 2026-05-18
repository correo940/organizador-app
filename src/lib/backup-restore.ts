import { supabase } from './supabase';
import { toast } from 'sonner';

export interface BackupData {
    version: string;
    exportDate: string;
    manuals: any[];
    rooms: any[];
    tags: any[];
    notes: any[];
    reminders: any[];
}

export async function exportBackup(): Promise<void> {
    try {
        toast.info('Exportando datos...');

        // Fetch all data
        const [manualsRes, roomsRes, tagsRes, notesRes, remindersRes] = await Promise.all([
            supabase.from('manuals').select('*'),
            safeQuery(() => supabase.from('rooms').select('*')),
            safeQuery(() => supabase.from('manual_tags').select('*')),
            safeQuery(() => supabase.from('manual_notes').select('*')),
            safeQuery(() => supabase.from('manual_reminders').select('*'))
        ]);

        const backup: BackupData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            manuals: manualsRes.data || [],
            rooms: roomsRes.data || [],
            tags: tagsRes.data || [],
            notes: notesRes.data || [],
            reminders: remindersRes.data || []
        };

        // Create download
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `manuales-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success(`Backup creado: ${backup.manuals.length} manuales exportados`);
    } catch (error) {
        console.error('Error creating backup:', error);
        toast.error('Error al crear backup');
    }
}

export async function importBackup(file: File): Promise<boolean> {
    try {
        toast.info('Importando backup...');

        const text = await file.text();
        const backup: BackupData = JSON.parse(text);

        if (!backup.version || !backup.manuals) {
            throw new Error('Formato de backup inválido');
        }

        let imported = 0;
        let errors = 0;

        // Import manuals
        for (const manual of backup.manuals) {
            try {
                // Remove id to create new records
                const { id, user_id, created_at, updated_at, ...manualData } = manual;

                const { data: newManual, error } = await supabase
                    .from('manuals')
                    .insert([manualData])
                    .select()
                    .single();

                if (error) throw error;

                // Import tags for this manual
                const manualTags = backup.tags?.filter(t => t.manual_id === id);
                if (manualTags && manualTags.length > 0 && newManual) {
                    const tagsToInsert = manualTags.map(t => ({
                        manual_id: newManual.id,
                        tag: t.tag
                    }));
                    await safeMutation(() => supabase.from('manual_tags').insert(tagsToInsert));
                }

                // Import notes for this manual
                const manualNotes = backup.notes?.filter(n => n.manual_id === id);
                if (manualNotes && manualNotes.length > 0 && newManual) {
                    const notesToInsert = manualNotes.map(n => {
                        const { id: noteId, manual_id, created_at, updated_at, ...noteData } = n;
                        return { ...noteData, manual_id: newManual.id };
                    });
                    await safeMutation(() => supabase.from('manual_notes').insert(notesToInsert));
                }

                // Import reminders for this manual
                const manualReminders = backup.reminders?.filter(r => r.manual_id === id);
                if (manualReminders && manualReminders.length > 0 && newManual) {
                    const remindersToInsert = manualReminders.map(r => {
                        const { id: reminderId, manual_id, created_at, updated_at, ...reminderData } = r;
                        return { ...reminderData, manual_id: newManual.id };
                    });
                    await safeMutation(() => supabase.from('manual_reminders').insert(remindersToInsert));
                }

                imported++;
            } catch (error) {
                console.error('Error importing manual:', error);
                errors++;
            }
        }

        if (imported > 0) {
            toast.success(`Backup importado: ${imported} manuales restaurados${errors > 0 ? `, ${errors} errores` : ''}`);
            return true;
        } else {
            toast.error('No se pudo importar ningún manual');
            return false;
        }
    } catch (error) {
        console.error('Error importing backup:', error);
        toast.error('Error al importar backup: formato inválido');
        return false;
    }
}

export async function exportManualsCsv(): Promise<void> {
    try {
        toast.info('Exportando a CSV...');

        const { data: manuals, error } = await supabase
            .from('manuals')
            .select(`
                *,
                manual_tags(tag)
            `);

        if (error) throw error;

        // Create CSV
        const headers = ['Título', 'Categoría', 'Descripción', 'Tipo', 'Habitación', 'Tags', 'Fecha Creación', 'Última Modificación'];
        const rows = manuals?.map(m => [
            m.title,
            m.category,
            m.description,
            m.type,
            m.room_id || '',
            m.manual_tags?.map((t: any) => t.tag).join('; ') || '',
            m.created_at,
            m.updated_at || m.created_at
        ]) || [];

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `manuales-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success('CSV exportado correctamente');
    } catch (error) {
        console.error('Error exporting CSV:', error);
        toast.error('Error al exportar CSV');
    }
}

async function safeQuery<T>(queryFactory: () => PromiseLike<{ data: T[] | null; error: unknown }>) {
    try {
        return await queryFactory();
    } catch {
        return { data: [], error: null };
    }
}

async function safeMutation(queryFactory: () => PromiseLike<unknown>) {
    try {
        await queryFactory();
    } catch {
        // Best effort import for optional related tables.
    }
}
