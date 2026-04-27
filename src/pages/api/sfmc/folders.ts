import { NextApiRequest, NextApiResponse } from 'next';
import {
  sfmcFetch,
  getRootCategoryId,
  assertCategoryInScope,
  ScopeViolationError,
} from '../../../utils/sfmc';

/**
 * GET /api/sfmc/folders
 *   - No parentId           => returns the scope root as the single top-level folder.
 *   - parentId=<id>         => returns children of that folder, after verifying
 *                              the parent is within scope.
 *
 * Query params:
 *   parentId  (optional)    SFMC category ID to list children of.
 *   page      (optional)    1-based page number (default 1).
 *   pageSize  (optional)    default 50, max 200.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const rootId = getRootCategoryId();
    const { parentId, page = '1', pageSize = '50' } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));

    // No parentId => return the scope root itself so the UI starts scoped.
    if (parentId === undefined || parentId === '') {
      const response = await sfmcFetch(`/asset/v1/content/categories/${rootId}`);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `Failed to fetch root category: ${errorText}`,
        });
      }
      const root = await response.json();
      return res.status(200).json({
        items: [
          {
            id: root.id,
            name: root.name,
            parentId: root.parentId,
            isScopeRoot: true,
          },
        ],
        page: 1,
        pageSize: 1,
        count: 1,
      });
    }

    const parentIdNum = Number(parentId);
    if (!Number.isFinite(parentIdNum) || parentIdNum <= 0) {
      return res.status(400).json({ error: 'parentId must be a positive integer' });
    }

    await assertCategoryInScope(parentIdNum);

    const filterExpr = `parentId eq ${parentIdNum}`;
    const url =
      `/asset/v1/content/categories` +
      `?$page=${pageNum}` +
      `&$pageSize=${pageSizeNum}` +
      `&$filter=${encodeURIComponent(filterExpr)}` +
      `&$orderBy=${encodeURIComponent('name asc')}`;

    const response = await sfmcFetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `SFMC error: ${errorText}` });
    }

    const data = await response.json();
    return res.status(200).json({
      items: (data.items || []).map((c: { id: number; name: string; parentId: number }) => ({
        id: c.id,
        name: c.name,
        parentId: c.parentId,
      })),
      page: data.page ?? pageNum,
      pageSize: data.pageSize ?? pageSizeNum,
      count: data.count ?? 0,
    });
  } catch (err) {
    if (err instanceof ScopeViolationError) {
      return res.status(403).json({ error: err.message });
    }
    console.error('SFMC folders error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch folders',
    });
  }
}
