// IndexedDB wrapper for offline storage of manuals
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ManualsDB extends DBSchema {
    manuals: {
        key: string;
        value: {
            id: string;
            title: string;
            category: string;
            description: string;
            type: string;
            content: string;
            date: string;
            room_id?: string;
            updated_at?: string;
            tags?: string[];
            synced_at: number;
        };
        indexes: { 'by-category': string; 'by-updated': string };
    };
    sync_queue: {
        key: number;
        value: {
            action: 'create' | 'update' | 'delete';
            manual_id: string;
            data?: any;
            timestamp: number;
        };
        indexes: { 'by-timestamp': number };
    };
}

class OfflineStorage {
    private dbPromise: Promise<IDBPDatabase<ManualsDB>>;

    constructor() {
        this.dbPromise = openDB<ManualsDB>('manuals-offline', 1, {
            upgrade(db) {
                // Manuals store
                const manualsStore = db.createObjectStore('manuals', { keyPath: 'id' });
                manualsStore.createIndex('by-category', 'category');
                manualsStore.createIndex('by-updated', 'updated_at');

                // Sync queue store
                const syncStore = db.createObjectStore('sync_queue', { keyPath: 'timestamp', autoIncrement: true });
                syncStore.createIndex('by-timestamp', 'timestamp');
            },
        });
    }

    async saveManual(manual: any) {
        const db = await this.dbPromise;
        await db.put('manuals', {
            ...manual,
            synced_at: Date.now()
        });
    }

    async saveManyManuals(manuals: any[]) {
        const db = await this.dbPromise;
        const tx = db.transaction('manuals', 'readwrite');
        await Promise.all([
            ...manuals.map(manual => tx.store.put({
                ...manual,
                synced_at: Date.now()
            })),
            tx.done
        ]);
    }

    async getManual(id: string) {
        const db = await this.dbPromise;
        return await db.get('manuals', id);
    }

    async getAllManuals() {
        const db = await this.dbPromise;
        return await db.getAll('manuals');
    }

    async deleteManual(id: string) {
        const db = await this.dbPromise;
        await db.delete('manuals', id);
    }

    async clearAll() {
        const db = await this.dbPromise;
        await db.clear('manuals');
        await db.clear('sync_queue');
    }

    async addToSyncQueue(action: 'create' | 'update' | 'delete', manualId: string, data?: any) {
        const db = await this.dbPromise;
        await db.add('sync_queue', {
            action,
            manual_id: manualId,
            data,
            timestamp: Date.now()
        });
    }

    async getSyncQueue() {
        const db = await this.dbPromise;
        return await db.getAll('sync_queue');
    }

    async clearSyncQueue() {
        const db = await this.dbPromise;
        await db.clear('sync_queue');
    }

    async getLastSyncTime(): Promise<number | null> {
        const db = await this.dbPromise;
        const manuals = await db.getAll('manuals');
        if (manuals.length === 0) return null;

        const lastSync = Math.max(...manuals.map(m => m.synced_at || 0));
        return lastSync;
    }
}

export const offlineStorage = new OfflineStorage();
