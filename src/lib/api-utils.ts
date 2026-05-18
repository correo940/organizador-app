import { Capacitor } from '@capacitor/core';

const PRODUCTION_SITE_URL = 'https://quioba.com';

function cleanPath(path: string): string {
    return path.startsWith('/') ? path.substring(1) : path;
}

export function getSiteUrl(path = ''): string {
    const clean = cleanPath(path);

    if (Capacitor.isNativePlatform()) {
        return clean ? `${PRODUCTION_SITE_URL}/${clean}` : PRODUCTION_SITE_URL;
    }

    // In the browser we keep same-origin requests.
    if (typeof window !== 'undefined' && window.location.origin.startsWith('http')) {
        return clean ? `${window.location.origin}/${clean}` : window.location.origin;
    }

    return clean ? `/${clean}` : '/';
}

export function getApiUrl(path: string): string {
    return getSiteUrl(path);
}
