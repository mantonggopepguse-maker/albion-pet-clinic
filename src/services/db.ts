import Dexie, { Table } from 'dexie';

export interface LocalTreatment {
    id?: string;
    clientId: string;
    patientId: string;
    description: string;
    diagnosis?: string;
    treatmentPlan?: string;
    medications: any[];
    vitals?: any;
    date: string;
    synced: number;
    deleted?: number;
}

export interface CacheEntry {
    key: string;
    data: string;
    timestamp: number;
    ttl: number;
}

export class AlbionPetClinicDB extends Dexie {
    treatments!: Table<LocalTreatment>;
    cache!: Table<CacheEntry>;

    constructor() {
        super('AlbionPetClinicDB');
        this.version(2).stores({
            treatments: '++id, clientId, patientId, date, synced, deleted',
            cache: '&key, timestamp'
        });
    }
}

export const db = new AlbionPetClinicDB();
