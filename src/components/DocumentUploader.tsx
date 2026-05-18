// src/components/DocumentUploader.tsx
'use client';

import React, { useState, ChangeEvent, FormEvent } from 'react';
import { getApiUrl } from '@/lib/api-utils';

export default function DocumentUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return setError('Selecciona un PDF primero');
    setLoading(true);
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const apiUrl = getApiUrl('api/upload');
      const res = await fetch(apiUrl, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setResult(data.doc);
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 border rounded">
      <form onSubmit={handleUpload}>
        <input type="file" accept="application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} />
        <div className="mt-2">
          <button disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
            {loading ? 'Subiendo...' : 'Subir PDF'}
          </button>
        </div>
      </form>

      {error && <div className="mt-2 text-red-600">{error}</div>}

      {result && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h3 className="font-semibold">{result.title}</h3>
          <p>Autor: {result.author}</p>
          <p>Páginas: {result.pages}</p>
          <a className="text-blue-600" href={result.publicUrl} target="_blank" rel="noreferrer">Ver PDF</a>
        </div>
      )}
    </div>
  );
}