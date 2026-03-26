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

  // GET — list folders (optionally filtered by parent_id)
  if (req.method === 'GET') {
    try {
      const { parent_id, tree } = req.query;

      // tree=true returns the entire folder hierarchy as a flat list with paths
      if (tree === 'true') {
        const rows = await sql`
          WITH RECURSIVE folder_tree AS (
            SELECT id, name, parent_id, name::text AS path, 0 AS depth
            FROM folders WHERE parent_id IS NULL
            UNION ALL
            SELECT f.id, f.name, f.parent_id,
                   (ft.path || ' / ' || f.name)::text AS path,
                   ft.depth + 1
            FROM folders f
            INNER JOIN folder_tree ft ON f.parent_id = ft.id
          )
          SELECT ft.id, ft.name, ft.parent_id, ft.path, ft.depth,
                 COUNT(p.id)::int AS project_count
          FROM folder_tree ft
          LEFT JOIN projects p ON p.folder_id = ft.id
          GROUP BY ft.id, ft.name, ft.parent_id, ft.path, ft.depth
          ORDER BY ft.path ASC
        `;
        return res.status(200).json({ folders: rows });
      }

      // Filter by parent_id (use parent_id=root for top-level folders)
      if (parent_id !== undefined) {
        const isRoot = parent_id === 'root' || parent_id === '';
        const rows = isRoot
          ? await sql`
              SELECT f.id, f.name, f.parent_id, f.created_at, f.updated_at,
                     COUNT(p.id)::int AS project_count,
                     (SELECT COUNT(*)::int FROM folders cf WHERE cf.parent_id = f.id) AS subfolder_count
              FROM folders f
              LEFT JOIN projects p ON p.folder_id = f.id
              WHERE f.parent_id IS NULL
              GROUP BY f.id
              ORDER BY f.name ASC
            `
          : await sql`
              SELECT f.id, f.name, f.parent_id, f.created_at, f.updated_at,
                     COUNT(p.id)::int AS project_count,
                     (SELECT COUNT(*)::int FROM folders cf WHERE cf.parent_id = f.id) AS subfolder_count
              FROM folders f
              LEFT JOIN projects p ON p.folder_id = f.id
              WHERE f.parent_id = ${parent_id}
              GROUP BY f.id
              ORDER BY f.name ASC
            `;
        return res.status(200).json({ folders: rows });
      }

      // Default: return all folders
      const rows = await sql`
        SELECT f.id, f.name, f.parent_id, f.created_at, f.updated_at,
               COUNT(p.id)::int AS project_count,
               (SELECT COUNT(*)::int FROM folders cf WHERE cf.parent_id = f.id) AS subfolder_count
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
      const { name, parent_id } = req.body;

      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Folder name is required.' });
      }

      // Validate parent exists if provided
      if (parent_id) {
        const parentRows = await sql`SELECT id FROM folders WHERE id = ${parent_id}`;
        if (parentRows.length === 0) {
          return res.status(400).json({ error: 'Parent folder not found.' });
        }
      }

      const id = nanoid(10);
      const trimmedName = name.trim();

      await sql`
        INSERT INTO folders (id, name, parent_id)
        VALUES (${id}, ${trimmedName}, ${parent_id || null})
      `;

      return res.status(201).json({ id, name: trimmedName, parent_id: parent_id || null });
    } catch (error) {
      console.error('Error creating folder:', error);
      return res.status(500).json({ error: 'Failed to create folder' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
