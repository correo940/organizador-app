import { BrainCircuit, HeartPulse, Landmark } from 'lucide-react';
import type { ArticleCategory } from '@/types';
import type { LucideProps } from 'lucide-react';

type CategoryIconProps = LucideProps & {
  category: ArticleCategory;
};

export default function CategoryIcon({ category, ...props }: CategoryIconProps) {
  switch (category) {
    case 'salud física':
      return <HeartPulse {...props} />;
    case 'salud mental':
      return <BrainCircuit {...props} />;
    case 'finanzas familiares':
      return <Landmark {...props} />;
    default:
      return null;
  }
}
