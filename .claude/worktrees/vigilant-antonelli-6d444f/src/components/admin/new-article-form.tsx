'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ArticleMetadata } from '@/types/article';

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor'),
  { ssr: false }
);

interface NewArticleFormProps {
  onSave: (metadata: ArticleMetadata, content: string) => Promise<void>;
}

export function NewArticleForm({ onSave }: NewArticleFormProps) {
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<ArticleMetadata>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    category: 'salud física',
    description: '',
    slug: '',
  });

  const handleSubmit = async () => {
    if (!metadata.title || !content) {
      alert('El título y el contenido son obligatorios');
      return;
    }
    
    if (!metadata.slug) {
      metadata.slug = metadata.title
        .toLowerCase()
        .replace(/[áäâà]/g, 'a')
        .replace(/[éëêè]/g, 'e')
        .replace(/[íïîì]/g, 'i')
        .replace(/[óöôò]/g, 'o')
        .replace(/[úüûù]/g, 'u')
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    try {
      await onSave(metadata, content);
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('Error al guardar el artículo');
    }
  };

  const categories = [
    'salud física',
    'salud mental',
    'nutrición',
    'ejercicio',
    'bienestar',
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            placeholder="Título del artículo"
            value={metadata.title}
            onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <select
            id="category"
            className="w-full p-2 border rounded"
            value={metadata.category}
            onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            placeholder="Breve descripción del artículo"
            value={metadata.description}
            onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
          />
        </div>
      </div>

      <div data-color-mode="light" className="min-h-[500px] border rounded">
        <MDEditor
          value={content}
          onChange={(value) => setContent(value || '')}
          height={500}
          preview="live"
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={() => window.history.back()}>
          Cancelar
        </Button>
        <Button onClick={handleSubmit}>
          Guardar Artículo
        </Button>
      </div>
    </div>
  );
}