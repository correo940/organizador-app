import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Article } from '@/types';
import { cn } from '@/lib/utils';
import CategoryIcon from './category-icon';

type ArticleCardProps = {
  article: Article;
  className?: string;
};

export default function ArticleCard({ article, className }: ArticleCardProps) {
  return (
    <Card className={cn("overflow-hidden flex flex-col h-full group transition-all duration-300 hover:shadow-xl hover:-translate-y-1", className)}>
      <Link href={`/articles/${article.slug}`} className="block h-full">
        <div className="flex flex-col h-full">
          <CardHeader className="p-0">
            <div className="relative h-48 w-full">
              <Image
                src={article.imageUrl}
                alt={article.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                data-ai-hint={article.imageHint}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
               <Badge className="absolute top-3 right-3 capitalize backdrop-blur-sm bg-background/70 hover:bg-background/90 text-foreground">
                <CategoryIcon category={article.category} className="h-4 w-4 mr-1.5" />
                {article.category.replace('physical health', 'salud física').replace('mental health', 'salud mental').replace('family finance', 'finanzas familiares')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-4 flex-grow">
            <CardTitle className="text-lg font-bold leading-snug mb-2 group-hover:text-primary transition-colors">
              {article.title}
            </CardTitle>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {article.excerpt}
            </p>
          </CardContent>
        </div>
      </Link>
    </Card>
  );
}
