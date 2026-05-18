'use client';

import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { ArticleMetadata } from '@/types/article';

const ArticleEditor = dynamic(
  () => import('@/components/article-editor'),
  { ssr: false }
);

export default function NewArticleContainer() {
  const router = useRouter();

  const handleSave = async (metadata: ArticleMetadata, content: string) => {
    try {
      const response = await fetch('/api/articles', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metadata, content }),
      });

      if (!response.ok) {
        throw new Error('Error al guardar el artículo');
      }

      router.push('/admin');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar el artículo');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Nuevo Artículo</h1>
      <ArticleEditor onSave={handleSave} />
    </div>
  );
}