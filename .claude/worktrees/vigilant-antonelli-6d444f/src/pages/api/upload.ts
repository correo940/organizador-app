// pages/api/upload.ts
import { IncomingForm } from 'formidable';
import fs from 'fs';
import fse from 'fs-extra';
import path from 'path';
import { PDFParse } from 'pdf-parse';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: { bodyParser: false }, // importante para formidable
};

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs');
const PDF_DIR = path.join(process.cwd(), 'public', 'docs');

async function saveFile(buffer: Buffer, destPath: string) {
  await fse.ensureDir(path.dirname(destPath));
  await fs.promises.writeFile(destPath, buffer);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = new IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) throw err;
      const file = (files.file as any);
      if (!file) return res.status(400).json({ error: 'No file uploaded' });

      // formidable may provide a filepath (temp); leemos el buffer
      const buffer = await fs.promises.readFile(file.filepath ?? file.path);

      // extraer pdf
      const parser = new PDFParse({ data: buffer });
      const [pdfInfo, pdfText] = await Promise.all([
        parser.getInfo(),
        parser.getText()
      ]);
      await parser.destroy();
      const metadata = {
        title: pdfInfo.info?.Title || fields.title || file.originalFilename || 'Sin título',
        author: pdfInfo.info?.Author || fields.author || '',
        pages: pdfInfo.total ?? null,
        text: pdfText.text || '',
        fileName: file.originalFilename || `doc-${Date.now()}.pdf`,
        uploadDate: new Date().toISOString()
      };

      // guardar PDF en public/docs
      await fse.ensureDir(PDF_DIR);
      const safeFileName = `${Date.now()}-${metadata.fileName}`.replace(/\s+/g, '_');
      const pdfPath = path.join(PDF_DIR, safeFileName);
      await saveFile(buffer, pdfPath);

      // guardar JSON metadata en content/docs
      await fse.ensureDir(CONTENT_DIR);
      const jsonName = safeFileName.replace(/\.pdf$/i, '.json');
      const jsonPath = path.join(CONTENT_DIR, jsonName);
      const publicUrl = `/docs/${safeFileName}`; // accesible desde public
      const docRecord = { ...metadata, publicUrl, jsonFile: `/content/docs/${jsonName}` };

      await fs.promises.writeFile(jsonPath, JSON.stringify(docRecord, null, 2), 'utf8');

      return res.status(200).json({ ok: true, doc: docRecord });
    } catch (e: any) {
      console.error('Upload error', e);
      return res.status(500).json({ error: e.message || 'Error extracting PDF' });
    }
  });
}
