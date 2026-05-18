// src/components/DocumentList.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { getApiUrl } from '@/lib/api-utils';

export default function DocumentList() {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const apiUrl = getApiUrl('api/list');
    fetch(apiUrl)
      .then(r => r.json())
      .then(d => { setDocs(d.docs || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div>Cargando documentos…</div>;
  if (!docs.length) return <div>No hay documentos en content/docs</div>;

  return (
    <div className="space-y-3">
      {docs.map(d => (
        <div key={d.publicUrl} className="p-3 border rounded flex justify-between items-start">
          <div>
            <div className="font-semibold">{d.title}</div>
            <div className="text-sm text-gray-600">Autor: {d.author} • Páginas: {d.pages}</div>
          </div>
          <div className="text-right">
            <a className="text-blue-600" href={d.publicUrl} target="_blank" rel="noreferrer">Abrir PDF</a>
          </div>
        </div>
      ))}
    </div>
  );
}