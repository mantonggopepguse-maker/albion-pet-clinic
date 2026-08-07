import { db } from './db';

interface CacheEntryData<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

const DEFAULT_TTL = 5 * 60 * 1000;

class CacheManager {
    private prefix: string = 'apc_cache';
    private userContext: { clinicId?: string; userId?: string } = {};
    private hydrated = false;

    constructor() {
        this.hydrateFromIndexedDB();
    }

    private async hydrateFromIndexedDB(): Promise<void> {
        try {
            const entries = await db.cache.toArray();
            const now = Date.now();
            const expired: string[] = [];
            for (const entry of entries) {
                if (now - entry.timestamp > entry.ttl) {
                    expired.push(entry.key);
                } else {
                    sessionStorage.setItem(entry.key, entry.data);
                }
            }
            if (expired.length > 0) {
                await db.cache.bulkDelete(expired);
            }
        } catch {
        } finally {
            this.hydrated = true;
        }
    }

    setUserContext(clinicId: string, userId: string) {
        this.userContext = { clinicId, userId };
    }

    clearUserContext() {
        this.userContext = {};
    }

    private generateKey(resource: string, params?: string): string {
        const { clinicId, userId } = this.userContext;
        const base = `${this.prefix}:${clinicId || 'guest'}:${userId || 'anon'}:${resource}`;
        return params ? `${base}:${params}` : base;
    }

    get<T>(resource: string, params?: string): T | null {
        const key = this.generateKey(resource, params);
        try {
            const raw = sessionStorage.getItem(key);
            if (!raw) return null;

            const entry: CacheEntryData<T> = JSON.parse(raw);
            const now = Date.now();

            if (now - entry.timestamp > entry.ttl) {
                sessionStorage.removeItem(key);
                this.removeFromIndexedDB(key);
                return null;
            }

            return entry.data;
        } catch (e) {
            return null;
        }
    }

    set<T>(resource: string, data: T, params?: string, ttl: number = DEFAULT_TTL): void {
        const key = this.generateKey(resource, params);
        const entry: CacheEntryData<T> = {
            data,
            timestamp: Date.now(),
            ttl
        };
        const serialized = JSON.stringify(entry);

        try {
            sessionStorage.setItem(key, serialized);
        } catch {
            this.clearSessionStorage();
            try {
                sessionStorage.setItem(key, serialized);
            } catch {
            }
        }

        this.persistToIndexedDB(key, serialized, entry.timestamp, ttl);
    }

    private async persistToIndexedDB(key: string, data: string, timestamp: number, ttl: number): Promise<void> {
        try {
            await db.cache.put({ key, data, timestamp, ttl });
        } catch {
        }
    }

    private async removeFromIndexedDB(key: string): Promise<void> {
        try {
            await db.cache.delete(key);
        } catch {
        }
    }

    async invalidate(resource: string): Promise<void> {
        const keyPrefix = this.generateKey(resource);

        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(keyPrefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));

        try {
            const entries = await db.cache.filter(e => e.key.startsWith(keyPrefix)).toArray();
            await Promise.all(entries.map(e => db.cache.delete(e.key)));
        } catch {
        }
    }

    async clearAll(): Promise<void> {
        this.clearSessionStorage();
        try {
            await db.cache.clear();
        } catch {
        }
    }

    private clearSessionStorage(): void {
        const keysToRemove: string[] = [];
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (key && key.startsWith(this.prefix)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => sessionStorage.removeItem(key));
    }
}

export const cacheManager = new CacheManager();
