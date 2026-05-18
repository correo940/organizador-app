import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import NewArticleContainer from "@/components/admin/new-article-container";

export const dynamic = process.env.NEXT_PUBLIC_IS_MOBILE_BUILD === 'true' ? 'force-static' : 'auto';

export default async function NewArticlePage() {
  // Bypass for mobile build
  if (process.env.NEXT_PUBLIC_IS_MOBILE_BUILD === 'true') {
    return <div className="p-8 text-center text-muted-foreground">Admin Disabled in Mobile Build</div>;
  }

  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/admin/login");
  }

  return <NewArticleContainer />;
}