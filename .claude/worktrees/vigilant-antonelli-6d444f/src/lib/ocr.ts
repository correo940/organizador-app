import Tesseract from 'tesseract.js';

export async function extractPageFromImage(base64Image: string): Promise<Tesseract.Page> {
    try {
        const result = await Tesseract.recognize(
            base64Image,
            'spa',
            { logger: m => console.log(m) }
        );
        return result.data;
    } catch (error) {
        console.error("Tesseract OCR Error:", error);
        throw new Error("Error al leer el texto de la imagen");
    }
}
