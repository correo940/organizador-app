import React from 'react';
import { getArticlesByCategory, getArticlesFromGitHub } from '@/lib/github';
import ArticleCard from '@/components/article-card';
import type { Article as SiteArticle, ArticleCategory } from '@/types';

export default async function SaludFisicaPage() {
  // 🔍 DEBUG: Obtener artículos por categoría
  const articlesFromGitHub = await getArticlesByCategory('salud física');
  console.log('📚 TOTAL ARTÍCULOS EN CATEGORÍA:', articlesFromGitHub.length);

  // Mapear al tipo interno esperado por ArticleCard
  const mapped: SiteArticle[] = articlesFromGitHub.map((a) => ({
    id: a.slug,
    slug: a.slug,
    title: a.title,
    excerpt: a.description || (a.content ? a.content.slice(0, 180) : ''),
    content: a.content,
    category: (a.category as ArticleCategory) || ('salud física' as ArticleCategory),
    youtubeUrl: undefined,
    imageUrl: a.image || '/images/placeholder.png',
    imageHint: '',
    author: a.author || 'Anónimo',
    authorImageUrl: '/images/avatar-placeholder.png',
    authorImageHint: '',
    date: a.date || '',
    featured: false,
  }));

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Salud Física</h1>

      {mapped.length === 0 ? (
        <div>
          <p className="text-red-500 font-bold">⚠️ No hay artículos en esta categoría.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mapped.map((article) => (
            <ArticleCard key={article.slug} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}
