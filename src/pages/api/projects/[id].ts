import { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../../utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const { id } = req.query;

  if (typeof id !== 'string') {
    return res.status(400).json({ error: 'Invalid project ID' });
  }

  const sql = getDb();

  // GET — retrieve a project by ID
  if (req.method === 'GET') {
    try {
      const rows = await sql`
        SELECT name, folder_id, data, created_at, updated_at FROM projects WHERE id = ${id}
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      const project = rows[0];
      return res.status(200).json({
        name: project.name,
        folderId: project.folder_id,
        data: project.data,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
      });
    } catch (error) {
      console.error('Error fetching project:', error);
      return res.status(500).json({ error: 'Failed to fetch project' });
    }
  }

  // PUT — update an existing project
  if (req.method === 'PUT') {
    try {
      const { data, name, folderId } = req.body;

      // Check the project exists
      const rows = await sql`
        SELECT id FROM projects WHERE id = ${id}
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Build dynamic update — only set fields that are provided
      if (data && typeof data === 'object') {
        await sql`
          UPDATE projects
          SET data = ${JSON.stringify(data)}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      if (name !== undefined && typeof name === 'string') {
        await sql`
          UPDATE projects SET name = ${name.trim() || 'Untitled Project'}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      if (folderId !== undefined) {
        // folderId can be null (move to unfiled) or a string (move to folder)
        const folderVal = (folderId && typeof folderId === 'string') ? folderId : null;
        await sql`
          UPDATE projects SET folder_id = ${folderVal}, updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error updating project:', error);
      return res.status(500).json({ error: 'Failed to update project' });
    }
  }

  // DELETE — delete a project
  if (req.method === 'DELETE') {
    try {
      const rows = await sql`
        SELECT id FROM projects WHERE id = ${id}
      `;

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await sql`DELETE FROM projects WHERE id = ${id}`;

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting project:', error);
      return res.status(500).json({ error: 'Failed to delete project' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
