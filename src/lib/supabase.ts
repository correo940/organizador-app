import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables')
}

// The Android WebView persists localStorage, and using Capacitor Preferences
// here can block auth flows in the APK. Keep storage simple and browser-like.
const customStorage = {
    getItem: async (key: string) => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem(key);
    },
    setItem: async (key: string, value: string) => {
        if (typeof window === 'undefined') return;
        localStorage.setItem(key, value);
    },
    removeItem: async (key: string) => {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(key);
    },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: customStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !Capacitor.isNativePlatform()
    }
})
