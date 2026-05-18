import { jsPDF } from 'jspdf';

type Manual = {
    id: string;
    title: string;
    category: string;
    description: string;
    type: 'text' | 'image' | 'video' | 'link' | 'audio';
    content: string;
    date: string;
    room_id?: string;
    updated_at?: string;
    tags?: string[];
};

export async function exportManualToPDF(manual: Manual) {
    try {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(manual.title, 20, 20);

        // Category
        doc.setFontSize(12);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100);
        doc.text(`Categoría: ${manual.category}`, 20, 30);

        // Tags
        if (manual.tags && manual.tags.length > 0) {
            doc.text(`Etiquetas: ${manual.tags.join(', ')}`, 20, 37);
        }

        // Date
        doc.text(`Fecha: ${manual.date}`, 20, manual.tags && manual.tags.length > 0 ? 44 : 37);

        // Description
        doc.setTextColor(0);
        doc.setFontSize(10);
        const descY = manual.tags && manual.tags.length > 0 ? 54 : 47;
        if (manual.description) {
            doc.setFont('helvetica', 'bold');
            doc.text('Descripción:', 20, descY);
            doc.setFont('helvetica', 'normal');
            const splitDescription = doc.splitTextToSize(manual.description, 170);
            doc.text(splitDescription, 20, descY + 7);
        }

        // Content
        let contentY = descY + (manual.description ? 25 : 10);
        try {
            let contentData = { text: '', image: '', video: '', audio: '', link: '' };

            if (manual.content.startsWith('{')) {
                contentData = JSON.parse(manual.content);
            } else {
                // Legacy single-type content
                switch (manual.type) {
                    case 'text': contentData.text = manual.content; break;
                    case 'image': contentData.image = manual.content; break;
                    case 'video': contentData.video = manual.content; break;
                    case 'audio': contentData.audio = manual.content; break;
                    case 'link': contentData.link = manual.content; break;
                }
            }

            // Add text content
            if (contentData.text && contentData.text.trim()) {
                doc.setFont('helvetica', 'bold');
                doc.text('Contenido:', 20, contentY);
                doc.setFont('helvetica', 'normal');
                const splitText = doc.splitTextToSize(contentData.text, 170);
                doc.text(splitText, 20, contentY + 7);
                contentY += splitText.length * 5 + 15;
            }

            // Add image (as base64)
            if (contentData.image) {
                const imgHeight = 80;
                if (contentY + imgHeight > 270) {
                    doc.addPage();
                    contentY = 20;
                }
                doc.text('Imagen adjunta:', 20, contentY);
                try {
                    doc.addImage(contentData.image, 'JPEG', 20, contentY + 5, 100, imgHeight);
                    contentY += imgHeight + 15;
                } catch (e) {
                    doc.text('(Imagen no se pudo exportar)', 20, contentY + 5);
                    contentY += 15;
                }
            }

            // Add links
            if (contentData.video) {
                doc.setFont('helvetica', 'bold');
                doc.text('Enlace a vídeo:', 20, contentY);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 255);
                doc.textWithLink(contentData.video, 20, contentY + 7, { url: contentData.video });
                doc.setTextColor(0);
                contentY += 15;
            }

            if (contentData.link) {
                doc.setFont('helvetica', 'bold');
                doc.text('Enlace externo:', 20, contentY);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(0, 0, 255);
                doc.textWithLink(contentData.link, 20, contentY + 7, { url: contentData.link });
                doc.setTextColor(0);
                contentY += 15;
            }

            if (contentData.audio) {
                doc.text('(Incluye nota de voz - no exportable a PDF)', 20, contentY);
            }

        } catch (e) {
            console.error('Error parsing content for PDF:', e);
        }

        // Save
        doc.save(`Manual_${manual.title.replace(/[^a-z0-9]/gi, '_')}.pdf`);
        return true;
    } catch (error) {
        console.error('Error exporting to PDF:', error);
        return false;
    }
}
