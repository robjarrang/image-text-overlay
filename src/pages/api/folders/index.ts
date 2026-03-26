import { NextApiRequest, NextApiResponse } from 'next';
import { nanoid } from 'nanoid';
import { getDb } from '../../../utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const sql = getDb();

  // GET — list all folders
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT f.id, f.name, f.created_at, f.updated_at,
               COUNT(p.id)::int AS project_count
        FROM folders f
        LEFT JOIN projects p ON p.folder_id = f.id
        GROUP BY f.id
        ORDER BY f.name ASC
      `;

      return res.status(200).json({ folders: rows });
    } catch (error) {
      console.error('Error listing folders:', error);
      return res.status(500).json({ error: 'Failed to list folders' });
    }
  }

  // POST — create a new folder
  if (req.method === 'POST') {
    try {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Folder name is required.' });
      }

      const id = nanoid(10);
      const trimmedName = name.trim();

      await sql`
        INSERT INTO folders (id, name)
        VALUES (${id}, ${trimmedName})
      `;

      return res.status(201).json({ id, name: trimmedName });
    } catch (error) {
      console.error('Error creating folder:', error);
      return res.status(500).json({ error: 'Failed to create folder' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
