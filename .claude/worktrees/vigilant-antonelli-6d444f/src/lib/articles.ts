import { createOrUpdateArticle } from '@/lib/github';
import { createArticleMarkdown } from '@/lib/markdown';
import type { ArticleMetadata } from '@/types/article';

export async function saveArticle(metadata: ArticleMetadata, content: string) {
  try {
    const markdown = createArticleMarkdown(metadata, content);
    const fileName = `${metadata.slug}.md`;
    
    await createOrUpdateArticle(
      fileName,
      markdown,
      `Update article: ${metadata.title}`
    );

    return { success: true };
  } catch (error) {
    console.error('Error saving article:', error);
    throw new Error('Failed to save article');
  }
}