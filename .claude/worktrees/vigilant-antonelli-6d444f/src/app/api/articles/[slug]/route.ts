import matter from 'gray-matter';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { createOrUpdateArticle, deleteArticle, listArticles } from '@/lib/github';

export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const { metadata, content } = await request.json();
    if (!metadata || !content || !metadata.slug) {
      return NextResponse.json({ error: 'Metadata y contenido son requeridos' }, { status: 400 });
    }

    const articles = await listArticles();
    const originalArticle = articles.find((article) => article.name === `${params.slug}.md`);
    const existingArticleWithNewSlug =
      metadata.slug !== params.slug
        ? articles.find((article) => article.name === `${metadata.slug}.md`)
        : null;

    if (existingArticleWithNewSlug && metadata.slug !== params.slug) {
      return NextResponse.json({ error: 'Ya existe un artículo con ese slug' }, { status: 400 });
    }

    const markdown = matter.stringify(content, metadata);
    await createOrUpdateArticle(
      `${metadata.slug}.md`,
      markdown,
      originalArticle ? `Update ${metadata.title}` : `Create ${metadata.title}`,
      metadata.slug === params.slug ? originalArticle?.sha : undefined
    );

    if (originalArticle && metadata.slug !== params.slug) {
      await deleteArticle(`${params.slug}.md`, `Rename from ${params.slug} to ${metadata.slug}`, originalArticle.sha);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Articles] PUT error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { slug: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const articles = await listArticles();
    const article = articles.find((item) => item.name === `${params.slug}.md`);

    if (!article) {
      return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 });
    }

    await deleteArticle(`${params.slug}.md`, `Delete ${article.name}`, article.sha);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[Articles] DELETE error:', error);
    return NextResponse.json({ error: error.message || 'Error interno del servidor' }, { status: 500 });
  }
}
