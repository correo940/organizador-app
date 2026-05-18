'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ArticleEditor from '@/components/article-editor';
import { saveArticle } from '@/lib/articles';
import type { ArticleMetadata } from '@/types/article';

export default function ArticleEditorContainer() {
  const router = useRouter();

  const handleSave = async (metadata: ArticleMetadata, content: string) => {
    try {
      await saveArticle(metadata, content);
      router.push('/admin');
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar el artículo');
    }
  };

  return <ArticleEditor onSave={handleSave} />;
}