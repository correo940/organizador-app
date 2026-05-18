'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { ArticleMetadata } from '@/types/article';

export default function AdminArticleList() {
  const [articles, setArticles] = useState<Array<ArticleMetadata & { path: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadArticles() {
      try {
        const response = await fetch('/api/articles');
        const data = await response.json();
        setArticles(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error cargando artículos:', error);
      } finally {
        setLoading(false);
      }
    }

    loadArticles();
  }, []);

  if (loading) {
    return <div>Cargando artículos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Artículos</h2>
        <Button asChild>
          <Link href="/admin/articles/new">Nuevo Artículo</Link>
        </Button>
      </div>

      <div className="grid gap-4">
        {articles.map((article) => (
          <Card key={article.slug} className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-semibold">{article.title}</h3>
                <p className="text-sm text-gray-500">{article.description}</p>
                <div className="mt-2 flex gap-2">
                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                    {article.category}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(article.date).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/admin/articles/${article.slug}/edit`}>
                    Editar
                  </Link>
                </Button>
                <Button
                  variant="destructive"
                  onClick={async () => {
                    if (!confirm('¿Estás seguro de eliminar este artículo?')) {
                      return;
                    }

                    const response = await fetch(`/api/articles/${article.slug}`, { method: 'DELETE' });
                    if (!response.ok) {
                      alert('No se pudo eliminar el artículo');
                      return;
                    }

                    setArticles((current) => current.filter((item) => item.slug !== article.slug));
                  }}
                >
                  Eliminar
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
