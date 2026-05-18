'use client';

import DocumentUploader from '@/components/DocumentUploader';
import DocumentList from '@/components/DocumentList';

// Estilos básicos en línea para simplicidad
const styles = {
  container: {
    maxWidth: '800px',
    margin: '2rem auto',
    padding: '2rem',
    fontFamily: 'sans-serif',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
  },
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
    borderBottom: '1px solid #eaeaea',
    paddingBottom: '1rem',
  },
  section: {
    backgroundColor: '#fff',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    marginBottom: '2rem',
  }
};

export default function DocsAppPage() {
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1>Gestor de Documentos (App Router)</h1>
        <p>Sube nuevos documentos y visualiza los existentes.</p>
      </header>
      
      <main>
        <section style={styles.section}>
          <DocumentUploader />
        </section>
        
        <section style={styles.section}>
          <DocumentList />
        </section>
      </main>
    </div>
  );
}
