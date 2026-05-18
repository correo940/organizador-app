'use client';

import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';

export interface PlatformInfo {
    isWeb: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    isMobile: boolean;
    platform: 'web' | 'ios' | 'android';
}

/**
 * Hook para detectar la plataforma actual usando Capacitor
 * Usa tanto la plataforma como la disponibilidad de plugins nativos
 * @returns Información sobre la plataforma actual
 */
export function usePlatform(): PlatformInfo {
    const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({
        isWeb: true,
        isIOS: false,
        isAndroid: false,
        isMobile: false,
        platform: 'web',
    });

    useEffect(() => {
        const currentPlatform = Capacitor.getPlatform();
        const isNative = Capacitor.isNativePlatform();

        // Verificación adicional: check si tenemos capacidades nativas
        // Esto funciona incluso cuando cargamos desde URL remota
        const hasNativeContext = typeof (window as any).Capacitor !== 'undefined' &&
            (currentPlatform === 'ios' || currentPlatform === 'android');

        setPlatformInfo({
            isWeb: !hasNativeContext,
            isIOS: currentPlatform === 'ios' && hasNativeContext,
            isAndroid: currentPlatform === 'android' && hasNativeContext,
            isMobile: hasNativeContext || isNative,
            platform: currentPlatform as 'web' | 'ios' | 'android',
        });
    }, []);

    return platformInfo;
}
