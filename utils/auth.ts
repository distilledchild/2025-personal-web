import { API_URL } from './apiConfig';
import { getOrFetchCached, invalidateCachedValue } from './clientCache';

export const USER_PROFILE_UPDATED_EVENT = 'user-profile-updated';

const MEMBER_ROLE_CACHE_TTL_MS = 5 * 60 * 1000;

interface StoredUserProfile {
    email?: string;
    role?: string;
    [key: string]: unknown;
}

interface MemberRoleResponse {
    authorized?: boolean;
    role?: string;
    [key: string]: unknown;
}

const getMemberRoleCacheKey = (email: string) => `member-role:${email.toLowerCase()}`;

export function getStoredUserProfile<T extends StoredUserProfile = StoredUserProfile>(): T | null {
    if (typeof window === 'undefined') return null;

    const stored = window.localStorage.getItem('user_profile');
    if (!stored) return null;

    try {
        return JSON.parse(stored) as T;
    } catch {
        return null;
    }
}

export function notifyUserProfileUpdated(): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new Event(USER_PROFILE_UPDATED_EVENT));
}

export function setStoredUserProfile(profile: StoredUserProfile): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('user_profile', JSON.stringify(profile));
    notifyUserProfileUpdated();
}

export function clearStoredUserProfile(): void {
    if (typeof window === 'undefined') return;

    const profile = getStoredUserProfile();
    if (profile?.email) {
        invalidateCachedValue(getMemberRoleCacheKey(profile.email));
    }

    window.localStorage.removeItem('user_profile');
    notifyUserProfileUpdated();
}

export async function fetchMemberRole(email: string): Promise<MemberRoleResponse> {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
        throw new Error('Email is required');
    }

    return getOrFetchCached(
        getMemberRoleCacheKey(normalizedEmail),
        MEMBER_ROLE_CACHE_TTL_MS,
        async () => {
            const response = await fetch(`${API_URL}/api/member/role/${encodeURIComponent(normalizedEmail)}`);
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            return response.json();
        }
    );
}

export function subscribeToUserProfileChanges(handler: () => void): () => void {
    if (typeof window === 'undefined') {
        return () => {};
    }

    window.addEventListener('storage', handler);
    window.addEventListener(USER_PROFILE_UPDATED_EVENT, handler);

    return () => {
        window.removeEventListener('storage', handler);
        window.removeEventListener(USER_PROFILE_UPDATED_EVENT, handler);
    };
}
