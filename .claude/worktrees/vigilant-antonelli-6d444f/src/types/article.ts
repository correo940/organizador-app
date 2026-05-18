export interface ArticleMetadata {
  title: string;
  date: string;
  category: string;
  description: string;
  slug: string;
  image?: string;
}

export interface Article extends ArticleMetadata {
  content: string;
  contentHtml: string;
}