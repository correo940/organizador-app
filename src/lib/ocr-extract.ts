import Tesseract from 'tesseract.js';
import { toast } from 'sonner';

export async function extractTextFromImage(imageData: string): Promise<string> {
    try {
        toast.info('Extrayendo texto de la imagen...');

        const { data: { text } } = await Tesseract.recognize(
            imageData,
            'spa', // Spanish language
            {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        // Could show progress here
                        console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
                    }
                }
            }
        );

        if (!text || text.trim().length === 0) {
            toast.warning('No se detectó texto en la imagen');
            return '';
        }

        toast.success('Texto extraído correctamente');
        return text.trim();
    } catch (error) {
        console.error('OCR Error:', error);
        toast.error('Error al extraer texto de la imagen');
        return '';
    }
}

export async function extractTextFromImageWithProgress(
    imageData: string,
    onProgress?: (progress: number) => void
): Promise<string> {
    try {
        const { data: { text } } = await Tesseract.recognize(
            imageData,
            'spa',
            {
                logger: (m) => {
                    if (m.status === 'recognizing text' && onProgress) {
                        onProgress(m.progress);
                    }
                }
            }
        );

        return text.trim();
    } catch (error) {
        console.error('OCR Error:', error);
        throw error;
    }
}
