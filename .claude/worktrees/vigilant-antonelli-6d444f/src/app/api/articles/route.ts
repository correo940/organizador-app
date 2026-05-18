import matter from 'gray-matter';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createOrUpdateArticle, getArticlesFromGitHub } from '@/lib/github';

export const revalidate = 60;

export async function GET() {
  try {
    const articles = await getArticlesFromGitHub();

    return NextResponse.json(
      articles.map((article) => ({
        id: article.slug,
        slug: article.slug,
        title: article.title,
        description: article.description,
        excerpt: article.description || article.content.slice(0, 180),
        content: article.content,
        category: article.category,
        imageUrl: article.image || '/images/placeholder.png',
        author: article.author || 'Anónimo',
        date: article.date || '',
        featured: article.featured === true,
      }))
    );
  } catch (error) {
    console.error('[Articles] GET error:', error);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { metadata, content } = await request.json();

    if (!metadata || !content) {
      return NextResponse.json({ error: 'Metadata y contenido son requeridos' }, { status: 400 });
    }

    if (!metadata.slug) {
      return NextResponse.json({ error: 'El slug es obligatorio' }, { status: 400 });
    }

    const markdown = matter.stringify(content, metadata);
    await createOrUpdateArticle(`${metadata.slug}.md`, markdown, `Create ${metadata.title}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Articles] POST error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
