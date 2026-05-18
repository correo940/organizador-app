'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type PostItColors = {
    overdue: string;
    tomorrow: string;
    upcoming: string; // < 1 week
    future: string;   // > 1 week
};

type PostItSettings = {
    isVisible: boolean;
    colors: PostItColors;
    snoozeDuration: number; // in minutes
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center';
    opacity: number;
    layout: 'vertical' | 'horizontal';
    visibilityMode: 'all' | 'custom';
    allowedPaths: string[];
    daysToHideAfterExpiration: number;
    setIsVisible: (visible: boolean) => void;
    setVisibilityMode: (mode: 'all' | 'custom') => void;
    setAllowedPaths: (paths: string[]) => void;
    setColors: (colors: PostItColors) => void;
    setSnoozeDuration: (duration: number) => void;
    setPosition: (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center') => void;
    setOpacity: (opacity: number) => void;
    setLayout: (layout: 'vertical' | 'horizontal') => void;
    setDaysToHideAfterExpiration: (days: number) => void;
};

const defaultColors: PostItColors = {
    overdue: 'bg-red-200 dark:bg-red-300',
    tomorrow: 'bg-green-200 dark:bg-green-300',
    upcoming: 'bg-blue-200 dark:bg-blue-300',
    future: 'bg-[#fef3c7] dark:bg-[#fcd34d]',
};

const PREFS_KEY = 'postit_settings';
const LOCAL_CACHE_KEY = 'postItSettings';

const PostItSettingsContext = createContext<PostItSettings | undefined>(undefined);

function applyParsed(
    parsed: any,
    setIsVisible: (v: boolean) => void,
    setVisibilityMode: (v: 'all' | 'custom') => void,
    setAllowedPaths: (v: string[]) => void,
    setColors: (v: PostItColors) => void,
    setSnoozeDuration: (v: number) => void,
    setPosition: (v: any) => void,
    setOpacity: (v: number) => void,
    setLayout: (v: any) => void,
    setDaysToHideAfterExpiration: (v: number) => void,
) {
    if (parsed.isVisible !== undefined) setIsVisible(parsed.isVisible);
    if (parsed.visibilityMode) setVisibilityMode(parsed.visibilityMode);
    if (parsed.allowedPaths) setAllowedPaths(parsed.allowedPaths);
    if (parsed.colors) setColors({ ...defaultColors, ...parsed.colors });
    if (parsed.snoozeDuration) setSnoozeDuration(parsed.snoozeDuration);
    if (parsed.position) setPosition(parsed.position);
    if (parsed.opacity !== undefined) setOpacity(parsed.opacity);
    if (parsed.layout) setLayout(parsed.layout);
    if (parsed.daysToHideAfterExpiration !== undefined) setDaysToHideAfterExpiration(parsed.daysToHideAfterExpiration);
}

export function PostItSettingsProvider({ children }: { children: React.ReactNode }) {
    const [isVisible, setIsVisible] = useState(true);
    const [visibilityMode, setVisibilityMode] = useState<'all' | 'custom'>('all');
    const [allowedPaths, setAllowedPaths] = useState<string[]>(['/apps/mi-hogar', '/apps/mi-hogar/tasks']);
    const [colors, setColors] = useState<PostItColors>(defaultColors);
    const [snoozeDuration, setSnoozeDuration] = useState(3);
    const [position, setPosition] = useState<'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'top-center' | 'bottom-center'>('top-left');
    const [opacity, setOpacity] = useState(0.8);
    const [layout, setLayout] = useState<'vertical' | 'horizontal'>('vertical');
    const [daysToHideAfterExpiration, setDaysToHideAfterExpiration] = useState(0);

    const [hasLoaded, setHasLoaded] = useState(false);
    const userIdRef = useRef<string | null>(null);

    // Load settings: first from localStorage (fast), then override from Supabase (authoritative)
    useEffect(() => {
        // 1. Instant load from localStorage cache
        try {
            const cached = localStorage.getItem(LOCAL_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                applyParsed(parsed, setIsVisible, setVisibilityMode, setAllowedPaths, setColors, setSnoozeDuration, setPosition, setOpacity, setLayout, setDaysToHideAfterExpiration);
            }
        } catch (e) {
            console.error('Failed to parse post-it settings from cache', e);
        }
        let isMounted = true;

        // 2. Fetch from Supabase helper
        const fetchFromSupabase = async (userId: string) => {
            try {
                const { data, error } = await supabase
                    .from('user_preferences')
                    .select('value')
                    .eq('user_id', userId)
                    .eq('key', PREFS_KEY)
                    .maybeSingle();

                if (isMounted && !error && data?.value) {
                    const parsed = data.value as any;
                    applyParsed(parsed, setIsVisible, setVisibilityMode, setAllowedPaths, setColors, setSnoozeDuration, setPosition, setOpacity, setLayout, setDaysToHideAfterExpiration);
                    // Update local cache with server data
                    localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(parsed));
                }
            } catch (e) {
                console.error('Failed to load post-it settings from Supabase', e);
            }
            if (isMounted) setHasLoaded(true);
        };

        // Listen for auth changes to capture userId and fetch
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const userId = session?.user?.id;
            
            if (userId && userId !== userIdRef.current) {
                // User logged in / session arrived
                userIdRef.current = userId;
                fetchFromSupabase(userId);
            } else if (!userId) {
                // User logged out / no session
                userIdRef.current = null;
                if (isMounted) setHasLoaded(true); // Stop waiting
            }
        });

        // Backup: explicitly check current session in case onAuthStateChange is already initialized
        supabase.auth.getSession().then(({ data: { session } }) => {
            const userId = session?.user?.id;
            if (userId && userId !== userIdRef.current) {
                userIdRef.current = userId;
                fetchFromSupabase(userId);
            } else if (!userId && userIdRef.current === null) {
                if (isMounted) setHasLoaded(true);
            }
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, []);

    // Save to both localStorage (cache) and Supabase (persistent) on change
    useEffect(() => {
        if (!hasLoaded) return;

        const settings = { isVisible, visibilityMode, allowedPaths, colors, snoozeDuration, position, opacity, layout, daysToHideAfterExpiration };

        // Always update local cache
        localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(settings));

        // Save to Supabase if user is logged in
        const userId = userIdRef.current;
        if (!userId) return;

        const saveToSupabase = async () => {
            try {
                const { error } = await supabase
                    .from('user_preferences')
                    .upsert(
                        { user_id: userId, key: PREFS_KEY, value: settings, updated_at: new Date().toISOString() },
                        { onConflict: 'user_id,key' }
                    );
                if (error) console.error('Failed to save post-it settings to Supabase:', error.message);
            } catch (e) {
                console.error('Failed to save post-it settings to Supabase', e);
            }
        };

        saveToSupabase();
    }, [isVisible, visibilityMode, allowedPaths, colors, snoozeDuration, position, opacity, layout, daysToHideAfterExpiration, hasLoaded]);

    return (
        <PostItSettingsContext.Provider value={{
            isVisible,
            colors,
            snoozeDuration,
            position,
            opacity,
            layout,
            visibilityMode,
            allowedPaths,
            setIsVisible,
            setVisibilityMode,
            setAllowedPaths,
            setColors,
            setSnoozeDuration,
            setPosition,
            setOpacity,
            setLayout,
            daysToHideAfterExpiration,
            setDaysToHideAfterExpiration
        }}>
            {children}
        </PostItSettingsContext.Provider>
    );
}

export function usePostItSettings() {
    const context = useContext(PostItSettingsContext);
    if (context === undefined) {
        throw new Error('usePostItSettings must be used within a PostItSettingsProvider');
    }
    return context;
}
