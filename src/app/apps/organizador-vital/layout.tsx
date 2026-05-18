'use client';

import { SidebarProvider } from "@/components/ui/sidebar";

export default function OrganizadorVitalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <SidebarProvider>
            <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950">
                {children}
            </div>
        </SidebarProvider>
    );
}
