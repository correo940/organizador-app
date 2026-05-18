import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { getArticleContent } from "@/lib/github";
import { parseMarkdown } from "@/lib/markdown";
import ArticleEditor from "@/components/article-editor";
import { allArticles } from "@/lib/data";

// Required for static export with dynamic routes
// Required for static export with dynamic routes
export const dynamic = process.env.NEXT_PUBLIC_IS_MOBILE_BUILD === 'true' ? 'force-static' : 'auto';

export async function generateStaticParams() {
  return [{ slug: 'placeholder' }];
}

export default async function EditArticlePage({ params }: { params: { slug: string } }) {
  // Resolver params primero para check ear placeholder
  const resolvedParams = await Promise.resolve(params);
  const slug = resolvedParams.slug;

  // Handle placeholder for static build BEFORE ANY AUTH CHECK
  if (slug === 'placeholder') {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Placeholder for static build generation.</p>
      </div>
    );
  }

  try {
    // Bypass for mobile build
    if (process.env.NEXT_PUBLIC_IS_MOBILE_BUILD === 'true') {
      return <div className="p-8 text-center text-muted-foreground">Admin Disabled in Mobile Build</div>;
    }

    const session = await getServerSession(authOptions);

    if (!session) {
      redirect("/admin/login");
    }

    if (!slug) {
      notFound();
    }

    // Intentar cargar el artículo desde GitHub primero, con fallback a datos locales
    let article;

    try {
      const markdownContent = await getArticleContent(`${slug}.md`);
      article = await parseMarkdown(markdownContent);

      // Si el artículo parseado está vacío o no tiene título, usar fallback
      if (!article || !article.title) {
        throw new Error('Artículo parseado está vacío');
      }
    } catch (githubError: any) {
      // Si no existe en GitHub o hay un error, usar datos locales como fallback
      const errorMessage = githubError?.message || '';

      // Solo loguear si no es un error esperado (404 o token no configurado)
      if (!errorMessage.includes('not found') && !errorMessage.includes('GITHUB_TOKEN')) {
        console.warn('Error cargando desde GitHub, usando datos locales:', errorMessage);
      }

      const localArticle = allArticles.find((a) => a.slug === slug);

      if (!localArticle) {
        notFound();
      }

      // Convertir HTML a markdown básico (remover tags y mantener estructura)
      let markdownContent = localArticle.content
        .replace(/<h3>/g, '### ')
        .replace(/<\/h3>/g, '\n\n')
        .replace(/<h2>/g, '## ')
        .replace(/<\/h2>/g, '\n\n')
        .replace(/<h1>/g, '# ')
        .replace(/<\/h1>/g, '\n\n')
        .replace(/<p>/g, '')
        .replace(/<\/p>/g, '\n\n')
        .replace(/<ul>/g, '')
        .replace(/<\/ul>/g, '\n')
        .replace(/<ol>/g, '')
        .replace(/<\/ol>/g, '\n')
        .replace(/<li>/g, '- ')
        .replace(/<\/li>/g, '\n')
        .replace(/<strong>/g, '**')
        .replace(/<\/strong>/g, '**')
        .replace(/<[^>]*>/g, '') // Remover cualquier otro tag HTML
        .replace(/\n{3,}/g, '\n\n') // Limpiar múltiples saltos de línea
        .trim();

      // Convertir el artículo local al formato esperado
      article = {
        title: localArticle.title || 'Sin título',
        description: localArticle.excerpt || '',
        category: localArticle.category || 'salud física',
        date: localArticle.date || new Date().toLocaleDateString('es-ES'),
        slug: localArticle.slug || slug,
        image: localArticle.imageUrl,
        content: markdownContent || '',
        contentHtml: localArticle.content || ''
      };
    }

    // Asegurarse de que article está definido y tiene valores válidos
    if (!article || !article.title) {
      notFound();
    }

    // Validar que todos los campos requeridos estén presentes
    const initialData = {
      title: article.title || 'Sin título',
      description: article.description || '',
      category: article.category || 'salud física',
      date: article.date || new Date().toLocaleDateString('es-ES'),
      slug: article.slug || slug,
      image: article.image || ''
    };

    return (
      <div className="container mx-auto py-6">
        <h1 className="text-3xl font-bold mb-6">Editar Artículo</h1>
        <ArticleEditor
          initialData={initialData}
          content={article.content || ''}
          isEditing={true}
        />
      </div>
    );
  } catch (error) {
    console.error('Error crítico en página de edición:', error);
    notFound();
  }
}