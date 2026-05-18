import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import React from "react";

export const dynamic = process.env.NEXT_PUBLIC_IS_MOBILE_BUILD === 'true' ? 'force-static' : 'auto';

export default async function ProtectedAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Bypass auth check for mobile static build (admin not used in mobile app)
    if (process.env.NEXT_PUBLIC_IS_MOBILE_BUILD === 'true') {
        return <>{children}</>; 
    }

    const session = await getServerSession(authOptions);

    if (!session) {
        redirect("/admin/login");
    }

    return <>{children}</>;
}
