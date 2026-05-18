import matter from 'gray-matter';
import { Octokit } from 'octokit';
import fs from 'fs';
import path from 'path';

const GITHUB_API = 'https://api.github.com';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || 'correo940';
const repo = process.env.GITHUB_REPO || 'Quiova';
const branch = process.env.GITHUB_BRANCH || 'main';
const CONTENT_PATH = 'content/articles';

// Solo inicializar Octokit si hay token
export const octokit = GITHUB_TOKEN ? new Octokit({
  auth: GITHUB_TOKEN,
}) : null;

export interface Article {
  title: string;
  description: string;
  category: string;
  date: string;
  author: string;
  slug: string;
  content: string;
  image?: string;
  featured?: boolean;
}

// Obtener artículos desde el sistema de archivos local
export async function getArticlesFromLocal(): Promise<Article[]> {
  try {
    const articlesPath = path.join(process.cwd(), CONTENT_PATH);
    if (!fs.existsSync(articlesPath)) {
      console.warn(`⚠️ Carpeta local no encontrada: ${articlesPath}`);
      return [];
    }

    const files = fs.readdirSync(articlesPath);
    const articles: Article[] = [];

    for (const fileName of files) {
      if (fileName.endsWith('.md')) {
        const filePath = path.join(articlesPath, fileName);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const { data, content: articleContent } = matter(raw);

        articles.push({
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          date: data.date || '',
          author: data.author || 'Anónimo',
          slug: data.slug || fileName.replace('.md', ''),
          content: articleContent,
          image: data.image,
          featured: data.featured === true,
        });
      }
    }

    console.log(`🏠 ${articles.length} artículos cargados desde el sistema local`);
    return articles;
  } catch (error) {
    console.error('❌ Error leyendo artículos locales:', error);
    return [];
  }
}

// Obtener todos los artículos (con fallback local en desarrollo)
export async function getArticlesFromGitHub(): Promise<Article[]> {
  // 🚀 En desarrollo, prioritizar carga local para ver cambios al instante
  if (process.env.NODE_ENV === 'development') {
    const localArticles = await getArticlesFromLocal();
    if (localArticles.length > 0) return localArticles;
  }

  try {
    const response = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/contents/${CONTENT_PATH}?ref=${branch}`,
      {
        headers: {
          Authorization: GITHUB_TOKEN ? `Bearer ${GITHUB_TOKEN}` : '',
          Accept: 'application/vnd.github.v3+json',
        },
        next: { revalidate: 60 }, // Revalidar cada 60 segundos
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.warn('⚠️ Artículos no encontrados en GitHub (404). Continuando con lista vacía.');
        return [];
      }
      console.error('❌ Error al obtener artículos de GitHub', response.status, await response.text());
      return [];
    }

    const files = await response.json();

    if (!Array.isArray(files)) {
      console.error('❌ La respuesta no es un array:', files);
      return [];
    }

    const articles: Article[] = [];

    // Leer cada archivo .md
    for (const file of files) {
      if (file.name && file.name.endsWith('.md')) {
        const contentUrl = file.download_url || file.url;
        if (!contentUrl) continue;

        const contentResponse = await fetch(contentUrl);
        if (!contentResponse.ok) {
          console.warn('⚠️ No se pudo descargar el archivo', file.name);
          continue;
        }
        const raw = await contentResponse.text();

        // Parsear frontmatter
        const { data, content: articleContent } = matter(raw);

        articles.push({
          title: data.title || '',
          description: data.description || '',
          category: data.category || '',
          date: data.date || '',
          author: data.author || 'Anónimo',
          slug: data.slug || file.name.replace('.md', ''),
          content: articleContent,
          image: data.image,
          featured: data.featured === true,
        });
      }
    }

    console.log(`✅ ${articles.length} artículos cargados desde GitHub`);
    return articles;
  } catch (error) {
    console.error('❌ Error leyendo artículos desde GitHub:', error);
    return [];
  }
}

// Obtener artículos por categoría (CON NORMALIZACIÓN)
export async function getArticlesByCategory(category: string): Promise<Article[]> {
  const articles = await getArticlesFromGitHub();

  // 🔧 NORMALIZAR: minúsculas y sin espacios extra
  const normalizedSearch = category.toLowerCase().trim();

  const filtered = articles.filter((article) => {
    const articleCategory = (article.category || '').toLowerCase().trim();
    return articleCategory === normalizedSearch;
  });

  console.log(`🔍 Buscando categoría: "${category}"`);
  console.log(`📋 Categorías disponibles:`, articles.map(a => `"${a.category}"`));
  console.log(`✅ Encontrados: ${filtered.length} artículos`);

  return filtered;
}

// Obtener un artículo por slug
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const articles = await getArticlesFromGitHub();
  return articles.find((article) => article.slug === slug) || null;
}

// ===== FUNCIONES PARA CREAR/EDITAR/ELIMINAR =====

export async function getArticleContent(articlePath: string) {
  if (!GITHUB_TOKEN || !octokit) {
    console.warn('GITHUB_TOKEN no está configurado. No se puede cargar desde GitHub.');
    // 🚀 Fallback local si no hay token (útil para desarrollo offline)
    if (process.env.NODE_ENV === 'development') {
      try {
        const filePath = path.join(process.cwd(), CONTENT_PATH, articlePath);
        if (fs.existsSync(filePath)) {
          console.log(`🏠 Cargando contenido local (sin token): ${articlePath}`);
          return fs.readFileSync(filePath, 'utf-8');
        }
      } catch (localError) {
        console.error('Error cargando fallback local:', localError);
      }
    }
    throw new Error('GITHUB_TOKEN_NOT_CONFIGURED');
  }

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `${CONTENT_PATH}/${articlePath}`,
    });

    if ('content' in response.data) {
      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      return content;
    }
    throw new Error('No content found');
  } catch (error: any) {
    // 🚀 Fallback local si falla GitHub
    if (process.env.NODE_ENV === 'development') {
      try {
        const filePath = path.join(process.cwd(), CONTENT_PATH, articlePath);
        if (fs.existsSync(filePath)) {
          console.log(`🏠 Cargando contenido local (fallback): ${articlePath}`);
          return fs.readFileSync(filePath, 'utf-8');
        }
      } catch (localError) {
        console.error('Error cargando fallback local:', localError);
      }
    }

    if (error.status === 404 || error.message === 'Not Found') {
      throw new Error('Article not found');
    }
    if (error.status === 401 || error.status === 403) {
      console.error('Error de autenticación con GitHub:', error.message);
      throw new Error('GITHUB_AUTH_ERROR');
    }
    console.error('Error fetching article content:', error);
    throw error;
  }
}

export async function createOrUpdateArticle(
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  if (!GITHUB_TOKEN || !octokit) {
    throw new Error('GITHUB_TOKEN no está configurado');
  }

  try {
    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: `${CONTENT_PATH}/${path}`,
      message,
      content: Buffer.from(content).toString('base64'),
      sha: sha,
    });
    return response.data;
  } catch (error) {
    console.error('Error creating/updating article:', error);
    throw error;
  }
}

export async function deleteArticle(path: string, message: string, sha: string) {
  if (!GITHUB_TOKEN || !octokit) {
    throw new Error('GITHUB_TOKEN no está configurado');
  }

  try {
    const response = await octokit.rest.repos.deleteFile({
      owner,
      repo,
      path: `${CONTENT_PATH}/${path}`,
      message,
      sha,
    });
    return response.data;
  } catch (error) {
    console.error('Error deleting article:', error);
    throw error;
  }
}

export async function listArticles() {
  if (!GITHUB_TOKEN || !octokit) {
    return [];
  }

  try {
    const response = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: CONTENT_PATH,
    });

    if (Array.isArray(response.data)) {
      return response.data
        .filter((file) => file.name.endsWith('.md'))
        .map((file) => ({
          name: file.name,
          path: file.path,
          sha: file.sha,
        }));
    }
    return [];
  } catch (error) {
    console.error('Error listing articles:', error);
    return [];
  }
}
