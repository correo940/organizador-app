// pages/api/list.ts
import fs from 'fs';
import path from 'path';
import { NextApiRequest, NextApiResponse } from 'next';

const CONTENT_DIR = path.join(process.cwd(), 'content', 'docs');

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const exists = fs.existsSync(CONTENT_DIR);
    if (!exists) return res.status(200).json({ docs: [] });

    const files = await fs.promises.readdir(CONTENT_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const docs = await Promise.all(jsonFiles.map(async f => {
      const content = await fs.promises.readFile(path.join(CONTENT_DIR, f), 'utf8');
      return JSON.parse(content);
    }));
    res.status(200).json({ docs });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
