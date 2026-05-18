import Image from 'next/image';
import type { ComponentProps } from 'react';

interface LogoProps extends Omit<ComponentProps<'div'>, 'children'> {
  className?: string;
}

export function Logo({ className, ...props }: LogoProps) {
  return (
    <div className={className} {...props} suppressHydrationWarning>
      <Image
        src="/images/logo.png"  // Cambia la extensión según tu archivo
        alt="Quioba Logo"
        width={32}
        height={32}
        className="object-contain"
        priority
      />
    </div>
  );
}
