'use client'

import { AuthProvider } from '@/components/apps/mi-hogar/auth-context'

export default function HuertoLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <AuthProvider>
            {children}
        </AuthProvider>
    )
}
