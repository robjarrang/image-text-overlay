import { NextApiRequest, NextApiResponse } from 'next';
import { nanoid } from 'nanoid';
import { getDb } from '../../../utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const sql = getDb();

  // GET — list projects, optionally filtered by folder_id
  if (req.method === 'GET') {
    try {
      const { folder_id, unfiled } = req.query;

      let rows;
      if (unfiled === 'true') {
        // Return projects not in any folder
        rows = await sql`
          SELECT id, name, folder_id, created_at, updated_at
          FROM projects
          WHERE folder_id IS NULL
          ORDER BY updated_at DESC
        `;
      } else if (folder_id && typeof folder_id === 'string') {
        rows = await sql`
          SELECT id, name, folder_id, created_at, updated_at
          FROM projects
          WHERE folder_id = ${folder_id}
          ORDER BY updated_at DESC
        `;
      } else {
        // Return all projects
        rows = await sql`
          SELECT id, name, folder_id, created_at, updated_at
          FROM projects
          ORDER BY updated_at DESC
        `;
      }

      return res.status(200).json({ projects: rows });
    } catch (error) {
      console.error('Error listing projects:', error);
      return res.status(500).json({ error: 'Failed to list projects' });
    }
  }

  // POST — create a new project
  if (req.method === 'POST') {
    try {
      const { data, name, folderId } = req.body;

      if (!data || typeof data !== 'object') {
        return res.status(400).json({ error: 'Invalid request body. Expected { data: object }.' });
      }

      const id = nanoid(10);
      const projectName = (name && typeof name === 'string' && name.trim()) || 'Untitled Project';
      const folderIdVal = (folderId && typeof folderId === 'string') ? folderId : null;

      await sql`
        INSERT INTO projects (id, name, folder_id, data)
        VALUES (${id}, ${projectName}, ${folderIdVal}, ${JSON.stringify(data)})
      `;

      return res.status(201).json({ id, name: projectName });
    } catch (error) {
      console.error('Error creating project:', error);
      return res.status(500).json({ error: 'Failed to save project' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
