import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-'); // Replace multiple - with single -
}

export function getYoutubeEmbedUrl(url: string): string | null {
  if (!url) return null;

  let videoId;
  try {
    const urlObj = new URL(url);
    // Standard youtube.com/watch?v=...
    if (urlObj.hostname.includes('youtube.com')) {
      const urlParams = new URLSearchParams(urlObj.search);
      videoId = urlParams.get('v');
    }
    // Shortened youtu.be/...
    else if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1);
    }
  } catch (error) {
    // Regex fallback for non-URL strings
    const match = url.match(/(?:v=|\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    videoId = match ? match[1] : null;
  }


  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}`;
  }

  return null;
}

export function translateAuthError(errorMessage: string): string {
  switch (errorMessage) {
    case 'Invalid login credentials':
      return 'Credenciales incorrectas. Por favor, verifica tu correo y contraseña.';
    case 'Email not confirmed':
      return 'Tu correo electrónico no ha sido confirmado. Por favor, revisa tu bandeja de entrada.';
    case 'User not found':
      return 'Usuario no encontrado. Regístrate si aún no tienes cuenta.';
    case 'Password should be at least 6 characters':
      return 'La contraseña debe tener al menos 6 caracteres.';
    default:
      return errorMessage;
  }
}
