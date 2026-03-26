import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const { id } = req.query;
  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid folder ID' });
  }

  const sql = getDb();

  // GET — get folder details with its projects
  if (req.method === 'GET') {
    try {
      const folderRows = await sql`
        SELECT id, name, created_at, updated_at FROM folders WHERE id = ${id}
      `;

      if (folderRows.length === 0) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      const projects = await sql`
        SELECT id, name, created_at, updated_at
        FROM projects
        WHERE folder_id = ${id}
        ORDER BY updated_at DESC
      `;

      return res.status(200).json({
        ...folderRows[0],
        projects,
      });
    } catch (error) {
      console.error('Error fetching folder:', error);
      return res.status(500).json({ error: 'Failed to fetch folder' });
    }
  }

  // PUT — rename a folder
  if (req.method === 'PUT') {
    try {
      const { name } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Folder name is required.' });
      }

      const trimmedName = name.trim();

      const result = await sql`
        UPDATE folders SET name = ${trimmedName}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      return res.status(200).json({ success: true, name: trimmedName });
    } catch (error) {
      console.error('Error renaming folder:', error);
      return res.status(500).json({ error: 'Failed to rename folder' });
    }
  }

  // DELETE — delete a folder (projects in it become unfiled)
  if (req.method === 'DELETE') {
    try {
      // The FK has ON DELETE SET NULL, so projects become unfiled automatically
      const result = await sql`
        DELETE FROM folders WHERE id = ${id} RETURNING id
      `;

      if (result.length === 0) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting folder:', error);
      return res.status(500).json({ error: 'Failed to delete folder' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
