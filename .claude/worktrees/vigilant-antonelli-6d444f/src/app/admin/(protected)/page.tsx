"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import AdminArticleList from "@/components/admin/article-list";
import AdminPostItManager from "@/components/admin/post-it-manager";
import SchedulerActivityManager from "@/components/admin/scheduler-activity-manager";
import AssistantManager from "@/components/admin/assistant-manager";
import AdminKnowledgeManager from "@/components/admin/admin-knowledge-manager";
import ApiLimitsManager from "@/components/admin/api-limits-manager";

export default function AdminPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Panel de Administración</h1>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/admin/articles/new">Nuevo Artículo</Link>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => signOut()} title="Cerrar sesión">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        <div className="rounded-lg bg-card p-6 shadow-sm">
          <AdminArticleList />
        </div>

        <div className="rounded-lg bg-card shadow-sm">
          <AdminPostItManager />
        </div>

        <div className="rounded-lg bg-card shadow-sm">
          <SchedulerActivityManager />
        </div>

        <div className="rounded-lg bg-card p-6 shadow-sm">
          <AssistantManager />
        </div>

        <div className="rounded-lg bg-card shadow-sm">
          <AdminKnowledgeManager />
        </div>

        <div className="rounded-lg bg-card shadow-sm">
          <ApiLimitsManager />
        </div>
      </div>
    </div>
  );
}
