const inFlightRequests = new Map<string, Promise<unknown>>();

interface CacheEnvelope<T> {
    expiresAt: number;
    value: T;
}

export function getCachedValue<T>(key: string): T | null {
    if (typeof window === 'undefined') return null;

    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;

    try {
        const envelope = JSON.parse(raw) as CacheEnvelope<T>;
        if (!envelope || typeof envelope.expiresAt !== 'number' || envelope.expiresAt <= Date.now()) {
            window.sessionStorage.removeItem(key);
            return null;
        }
        return envelope.value;
    } catch {
        window.sessionStorage.removeItem(key);
        return null;
    }
}

export function setCachedValue<T>(key: string, value: T, ttlMs: number): void {
    if (typeof window === 'undefined') return;

    const envelope: CacheEnvelope<T> = {
        expiresAt: Date.now() + ttlMs,
        value
    };
    window.sessionStorage.setItem(key, JSON.stringify(envelope));
}

export function invalidateCachedValue(key: string): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(key);
    inFlightRequests.delete(key);
}

export async function getOrFetchCached<T>(
    key: string,
    ttlMs: number,
    fetcher: () => Promise<T>
): Promise<T> {
    const cached = getCachedValue<T>(key);
    if (cached !== null) {
        return cached;
    }

    const inFlight = inFlightRequests.get(key) as Promise<T> | undefined;
    if (inFlight) {
        return inFlight;
    }

    const request = (async () => {
        try {
            const value = await fetcher();
            setCachedValue(key, value, ttlMs);
            return value;
        } finally {
            inFlightRequests.delete(key);
        }
    })();

    inFlightRequests.set(key, request);
    return request;
}
