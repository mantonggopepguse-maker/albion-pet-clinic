import { db, LocalTreatment } from './db';
import { api } from './apiService';
import { toast } from 'sonner';

export const syncService = {
    async saveTreatment(treatment: (Omit<LocalTreatment, 'synced' | 'id'> & { id?: string })) {
        const { id: serverId, ...rest } = treatment;

        try {
            let result;
            if (serverId) {
                result = await api.treatments.update(serverId, rest);
            } else {
                result = await api.treatments.create(rest);
            }
            await db.treatments.put({
                ...rest,
                id: result.id,
                synced: 1,
                date: rest.date || new Date().toISOString()
            });
            return result.id;
        } catch (error) {
            const localId = await db.treatments.put({
                ...rest,
                id: serverId,
                synced: 0,
                date: rest.date || new Date().toISOString()
            } as LocalTreatment);
            toast.info('Saved offline. Will sync when connection is restored.');
            return localId;
        }
    },

    async deleteTreatment(id: string) {
        try {
            await api.treatments.delete(id);
            const local = await db.treatments.where('id').equals(id).first();
            if (local?.id) await db.treatments.where('id').equals(id).delete();
            toast.success('Treatment deleted successfully!');
        } catch (error) {
            await db.treatments.where('id').equals(id).modify({ deleted: 1, synced: 0 });
            toast.info('Offline: Deletion will sync when connection is restored.');
        }
    },

    async syncDirtyRecords() {
        const dirty = await db.treatments.where('synced').equals(0).toArray();
        if (dirty.length === 0) return;
        for (const record of dirty) {
            try {
                const { id, synced, deleted, ...data } = record;
                if (deleted === 1 && id) {
                    await api.treatments.delete(id);
                    await db.treatments.where('id').equals(id).delete();
                    continue;
                }
                let result;
                if (id && isNaN(Number(id))) {
                    result = await api.treatments.update(id, data);
                } else {
                    result = await api.treatments.create(data);
                }
                await db.treatments.where('id').equals(id!).modify({ synced: 1, id: result.id });
            } catch (error) {
                console.error('Failed to sync record', record.id, error);
            }
        }
    },

    async fetchAndMergeTreatments() {
        try {
            const serverTreatments = await api.treatments.getAll();
            if (!Array.isArray(serverTreatments)) return await db.treatments.toArray();

            // Fetch unsynced local treatments so we don't overwrite dirty offline edits
            const dirtyRecords = await db.treatments.where('synced').equals(0).toArray();
            const dirtyIds = new Set(dirtyRecords.map(r => r.id).filter(Boolean));

            const toAdd = serverTreatments
                .filter((t: any) => !dirtyIds.has(t.id))
                .map((t: any) => ({
                    ...t,
                    synced: 1,
                    date: t.date || t.createdAt
                }));

            if (toAdd.length > 0) {
                // Upsert first so failure cannot wipe cached records
                await db.treatments.bulkPut(toAdd);

                // Clean up obsolete synced records that no longer exist on server
                const serverIdSet = new Set(serverTreatments.map((t: any) => t.id));
                const allSynced = await db.treatments.where('synced').equals(1).toArray();
                const obsoleteIds = allSynced
                    .map(r => r.id)
                    .filter((id): id is string => Boolean(id) && !serverIdSet.has(id));
                if (obsoleteIds.length > 0) {
                    await db.treatments.bulkDelete(obsoleteIds);
                }
            }
            return await db.treatments.toArray();
        } catch (error) {
            console.error('Failed to merge treatments from server:', error);
            return await db.treatments.toArray();
        }
    }
};

let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let onlineListenerRegistered = false;

export const startSyncService = () => {
    if (typeof window === 'undefined') return;
    if (syncIntervalId) clearInterval(syncIntervalId);

    syncIntervalId = setInterval(() => {
        if (navigator.onLine) {
            syncService.syncDirtyRecords();
        }
    }, 60000);

    if (!onlineListenerRegistered) {
        window.addEventListener('online', () => {
            syncService.syncDirtyRecords();
        });
        onlineListenerRegistered = true;
    }
};

export const stopSyncService = () => {
    if (syncIntervalId) {
        clearInterval(syncIntervalId);
        syncIntervalId = null;
    }
};
