import { NextApiRequest, NextApiResponse } from 'next';
import { sfmcFetch } from '../../../utils/sfmc';

/**
 * GET /api/sfmc/discover?path=ZZ - Test/JAR_Test
 *
 * Resolves a Content Builder folder path to its category ID by walking
 * down from the root of Content Builder.
 *
 * This endpoint is a one-off admin helper — use it to find the ID to put
 * in SFMC_ROOT_CATEGORY_ID. It ignores scope (it has to, to find the root
 * of scope). It only returns category metadata, no asset content.
 *
 * Requires the env var SFMC_DISCOVER_ENABLED=true to function, so it
 * can't be left accidentally exposed in production.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  if (process.env.SFMC_DISCOVER_ENABLED !== 'true') {
    return res.status(403).json({
      error: 'Discover endpoint is disabled. Set SFMC_DISCOVER_ENABLED=true to use it.',
    });
  }

  const pathParam = req.query.path;
  if (typeof pathParam !== 'string' || !pathParam.trim()) {
    return res.status(400).json({ error: 'path query parameter is required (e.g. "ZZ - Test/JAR_Test")' });
  }

  // Split the user-supplied path into segments. Some tenants expose
  // "Content Builder" as an actual folder at parentId=0, others treat it
  // as the implicit root. We walk down literally from parentId=0 using
  // whatever segments the caller provides.
  const segments = pathParam
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    return res.status(400).json({ error: 'Path must contain at least one folder name' });
  }

  try {
    // Walk down from Content Builder root. The true root has parentId == 0.
    let currentParentId: number | null = null; // null on first iteration => filter parentId eq 0
    const resolvedChain: Array<{ id: number; name: string; parentId: number }> = [];

    for (const segmentName of segments) {
      const filterExpr =
        currentParentId === null
          ? `parentId eq 0`
          : `parentId eq ${currentParentId}`;

      const url =
        `/asset/v1/content/categories` +
        `?$pageSize=200` +
        `&$filter=${encodeURIComponent(filterExpr)}` +
        `&$orderBy=${encodeURIComponent('name asc')}`;

      const response = await sfmcFetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        return res.status(response.status).json({
          error: `SFMC error fetching children of ${currentParentId ?? 'root'}: ${errorText}`,
        });
      }

      const data = await response.json();
      const items: Array<{ id: number; name: string; parentId: number }> = data.items || [];
      const match = items.find((c) => c.name === segmentName);

      if (!match) {
        return res.status(404).json({
          error: `Folder not found: "${segmentName}"`,
          parentId: currentParentId,
          availableChildren: items.map((c) => ({ id: c.id, name: c.name })),
          resolvedSoFar: resolvedChain,
        });
      }

      resolvedChain.push({ id: match.id, name: match.name, parentId: match.parentId });
      currentParentId = match.id;
    }

    const leaf = resolvedChain[resolvedChain.length - 1];

    return res.status(200).json({
      found: true,
      categoryId: leaf.id,
      name: leaf.name,
      path: resolvedChain.map((c) => c.name).join(' / '),
      chain: resolvedChain,
      suggestedEnvVar: `SFMC_ROOT_CATEGORY_ID=${leaf.id}`,
    });
  } catch (err) {
    console.error('SFMC discover error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Unknown error during discovery',
    });
  }
}
