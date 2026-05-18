'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { categories } from '@/lib/data';
import type { ArticleMetadata } from '@/types/article';
import { slugify } from '@/lib/utils';

const MDEditor = dynamic(() => import('@uiw/react-md-editor'), {
  ssr: false,
  loading: () => <div>Cargando editor...</div>
});

interface ArticleEditorProps {
  initialData?: ArticleMetadata;
  content?: string;
  isEditing?: boolean;
  onSave?: (metadata: ArticleMetadata, content: string) => Promise<void>;
}

export default function ArticleEditor({ initialData, content: initialContent, isEditing, onSave }: ArticleEditorProps) {
  const router = useRouter();
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [category, setCategory] = useState<string>(initialData?.category || 'salud física');
  const [content, setContent] = useState(initialContent || '');
  const [image, setImage] = useState(initialData?.image || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const date = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const metadata = {
        title,
        description,
        category,
        date: initialData?.date || date,
        slug: initialData?.slug || slugify(title),
        image: image || undefined
      };

      if (onSave) {
        await onSave(metadata, content);
        return;
      }
      
      const response = await fetch(`/api/articles${isEditing ? `/${initialData?.slug}` : ''}`, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metadata,
          content
        }),
      });

      // Parsear la respuesta
      const contentType = response.headers.get('content-type');
      let result;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      if (!response.ok) {
        const errorMessage = result?.error || result?.message || `Error al guardar el artículo (${response.status})`;
        throw new Error(errorMessage);
      }

      // Artículo guardado exitosamente
      console.log('Artículo guardado exitosamente:', result);

      // Mostrar mensaje de éxito y redirigir
      alert('Artículo guardado exitosamente');
      
      // Usar window.location para asegurar la navegación
      window.location.href = '/admin';
    } catch (error) {
      console.error('Error al guardar:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar el artículo';
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  }, [title, description, category, content, image, router, isEditing, initialData]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Ingresa el título del artículo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descripción</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            placeholder="Ingresa una breve descripción del artículo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select value={category} onValueChange={(value) => setCategory(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una categoría" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="image">URL de la imagen (opcional)</Label>
          <Input
            id="image"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>
      </Card>

      <div className="min-h-[500px]" data-color-mode="light">
        <MDEditor
          value={content}
          onChange={(value) => setContent(value || '')}
          height={500}
          preview="live"
        />
      </div>

      <div className="flex justify-end space-x-4">
        <Button type="button" variant="outline" onClick={() => history.back()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar Artículo'}
        </Button>
      </div>
    </form>
  );
}
