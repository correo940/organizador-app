'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { useRouter } from 'next/navigation';
import { consumePendingShareEvent } from '@/lib/share-target-init';

interface ShareTargetContextType {
    sharedImageBase64: string | null;
    consumeSharedImage: () => string | null;
}

const ShareTargetContext = createContext<ShareTargetContextType>({
    sharedImageBase64: null,
    consumeSharedImage: () => null,
});

export function useShareTarget() {
    return useContext(ShareTargetContext);
}

/**
 * Converts any image URI (content://, file://, http://) to a base64 data URL
 * using Capacitor.convertFileSrc + Image/Canvas.
 */
function imageUriToBase64(uri: string): Promise<string> {
    return new Promise((resolve, reject) => {
        let webUrl = uri;
        try {
            webUrl = Capacitor.convertFileSrc(uri);
        } catch (e) {
            console.log('[ShareTarget] convertFileSrc failed, using raw URI');
        }

        console.log('[ShareTarget] Loading image from:', webUrl.substring(0, 100));

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('No canvas context')); return; }
                ctx.drawImage(img, 0, 0);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
                console.log('[ShareTarget] ✅ Image → base64, length:', dataUrl.length);
                resolve(dataUrl);
            } catch (err) {
                reject(err);
            }
        };
        img.onerror = (err) => {
            console.error('[ShareTarget] Image load failed:', err);
            reject(new Error('Failed to load image'));
        };
        img.src = webUrl;
    });
}

/**
 * Process a ShareReceivedEvent: extract the image, convert to base64, navigate.
 */
async function processShareEvent(
    event: any,
    setImage: (img: string) => void,
    router: ReturnType<typeof useRouter>
) {
    if (event.files && event.files.length > 0) {
        const file = event.files[0];
        console.log('[ShareTarget] Processing file:', file.name, file.mimeType);
        try {
            const base64 = await imageUriToBase64(file.uri);
            setImage(base64);
            router.push('/apps/mi-hogar/tasks');
        } catch (err) {
            console.error('[ShareTarget] ❌ Error converting:', err);
        }
    }
}

export function ShareTargetProvider({ children }: { children: React.ReactNode }) {
    const [sharedImageBase64, setSharedImageBase64] = useState<string | null>(null);
    const router = useRouter();

    const consumeSharedImage = useCallback(() => {
        const img = sharedImageBase64;
        setSharedImageBase64(null);
        return img;
    }, [sharedImageBase64]);

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        // === COLD START ===
        // Check if the early-init module buffered a share event
        // (the app was launched via share intent before React mounted)
        const pendingEvent = consumePendingShareEvent();
        if (pendingEvent) {
            console.log('[ShareTarget] 🧊 Cold start: found buffered event');
            processShareEvent(pendingEvent, setSharedImageBase64, router);
        }

        // === WARM START ===
        // Listen for future shares via DOM event from share-target-init
        const handleShareEvent = (e: Event) => {
            const customEvent = e as CustomEvent;
            console.log('[ShareTarget] 🔥 Warm start: received DOM event');
            processShareEvent(customEvent.detail, setSharedImageBase64, router);
        };

        window.addEventListener('quioba-share-received', handleShareEvent);

        return () => {
            window.removeEventListener('quioba-share-received', handleShareEvent);
        };
    }, [router]);

    return (
        <ShareTargetContext.Provider value={{ sharedImageBase64, consumeSharedImage }}>
            {children}
        </ShareTargetContext.Provider>
    );
}
