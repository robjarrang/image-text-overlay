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

  // GET — get folder details with its projects and subfolders
  if (req.method === 'GET') {
    try {
      const folderRows = await sql`
        SELECT id, name, parent_id, created_at, updated_at FROM folders WHERE id = ${id}
      `;

      if (folderRows.length === 0) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      const [subfolders, projects] = await Promise.all([
        sql`
          SELECT f.id, f.name, f.parent_id, f.created_at, f.updated_at,
                 COUNT(p.id)::int AS project_count,
                 (SELECT COUNT(*)::int FROM folders cf WHERE cf.parent_id = f.id) AS subfolder_count
          FROM folders f
          LEFT JOIN projects p ON p.folder_id = f.id
          WHERE f.parent_id = ${id}
          GROUP BY f.id
          ORDER BY f.name ASC
        `,
        sql`
          SELECT id, name, created_at, updated_at
          FROM projects
          WHERE folder_id = ${id}
          ORDER BY updated_at DESC
        `,
      ]);

      return res.status(200).json({
        ...folderRows[0],
        subfolders,
        projects,
      });
    } catch (error) {
      console.error('Error fetching folder:', error);
      return res.status(500).json({ error: 'Failed to fetch folder' });
    }
  }

  // PUT — rename or move a folder
  if (req.method === 'PUT') {
    try {
      const { name, parent_id } = req.body;

      // Must provide at least name or parent_id
      if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
        return res.status(400).json({ error: 'Folder name cannot be empty.' });
      }

      // Prevent moving a folder into itself or its descendants
      if (parent_id !== undefined && parent_id !== null) {
        if (parent_id === id) {
          return res.status(400).json({ error: 'Cannot move a folder into itself.' });
        }
        // Check parent exists
        const parentRows = await sql`SELECT id FROM folders WHERE id = ${parent_id}`;
        if (parentRows.length === 0) {
          return res.status(400).json({ error: 'Target parent folder not found.' });
        }
        // Check for circular reference (is parent_id a descendant of id?)
        const descendants = await sql`
          WITH RECURSIVE desc AS (
            SELECT id FROM folders WHERE parent_id = ${id}
            UNION ALL
            SELECT f.id FROM folders f INNER JOIN desc d ON f.parent_id = d.id
          )
          SELECT id FROM desc WHERE id = ${parent_id}
        `;
        if (descendants.length > 0) {
          return res.status(400).json({ error: 'Cannot move a folder into one of its subfolders.' });
        }
      }

      // Build update
      const updates: string[] = [];
      if (name !== undefined) {
        const trimmedName = name.trim();
        await sql`UPDATE folders SET name = ${trimmedName}, updated_at = NOW() WHERE id = ${id}`;
      }
      if (parent_id !== undefined) {
        const newParent = parent_id === null || parent_id === '' ? null : parent_id;
        await sql`UPDATE folders SET parent_id = ${newParent}, updated_at = NOW() WHERE id = ${id}`;
      }

      const result = await sql`SELECT id, name, parent_id FROM folders WHERE id = ${id}`;
      if (result.length === 0) {
        return res.status(404).json({ error: 'Folder not found' });
      }

      return res.status(200).json({ success: true, ...result[0] });
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
