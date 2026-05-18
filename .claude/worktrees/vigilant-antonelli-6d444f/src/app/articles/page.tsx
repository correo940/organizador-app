'use client';

import React, { Suspense } from 'react';
import BlogContent from '@/components/blog-content';

export default function ArticlesPage() {
    return (
        <div className="pt-2">
            <Suspense fallback={<div className="container mx-auto px-4 py-20 text-center">Cargando artículos...</div>}>
                <BlogContent />
            </Suspense>
        </div>
    );
}
