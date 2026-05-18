import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

export interface ArticleMetadata {
  title: string;
  date: string;
  category: string;
  description: string;
  image?: string;
  slug: string;
  ingredients?: string[];
}

export interface Article extends ArticleMetadata {
  content: string;
  contentHtml: string;
}

export async function parseMarkdown(markdown: string): Promise<Article> {
  try {
    if (!markdown || typeof markdown !== 'string') {
      throw new Error('Markdown inválido o vacío');
    }

    const { data, content } = matter(markdown);

    // Procesar el markdown a HTML
    let contentHtml = '';
    try {
      const processedContent = await remark()
        .use(html, { sanitize: true })
        .process(content || '');

      contentHtml = processedContent.toString();
    } catch (remarkError) {
      console.warn('Error procesando markdown con remark, usando contenido sin procesar:', remarkError);
      // Si remark falla, usar el contenido sin procesar como HTML
      contentHtml = content || '';
    }

    // Log para debugging (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('Markdown parseado:', {
        title: data.title,
        contentLength: content?.length || 0,
        htmlLength: contentHtml.length,
        hasLinks: contentHtml.includes('<a href')
      });
    }

    return {
      title: data.title || '',
      date: data.date || new Date().toLocaleDateString('es-ES'),
      category: data.category || 'salud física',
      description: data.description || '',
      image: data.image,
      slug: data.slug || '',
      content: content || '',
      contentHtml: contentHtml || '',
      ingredients: data.ingredients || [],
    };
  } catch (error) {
    console.error('Error parsing markdown:', error);
    const preview = typeof markdown === 'string' ? markdown.substring(0, 500) : 'No markdown disponible';
    console.error('Markdown que causó el error:', preview);

    // Retornar un artículo vacío en lugar de lanzar error para evitar romper la página
    return {
      title: '',
      date: new Date().toLocaleDateString('es-ES'),
      category: 'salud física',
      description: '',
      image: undefined,
      slug: '',
      content: '',
      contentHtml: '',
      ingredients: [],
    };
  }
}

export function createArticleMarkdown(metadata: ArticleMetadata, content: string): string {
  const frontmatter = {
    title: metadata.title,
    date: metadata.date,
    category: metadata.category,
    description: metadata.description,
    image: metadata.image,
    slug: metadata.slug,
  };

  return matter.stringify(content, frontmatter);
}
