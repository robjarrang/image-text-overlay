import { NextApiRequest, NextApiResponse } from 'next';
import {
  sfmcFetch,
  assertCategoryInScope,
  ScopeViolationError,
} from '../../../utils/sfmc';

/**
 * GET /api/sfmc/assets?categoryId=<id>
 *
 * Lists image assets in a folder. Requires categoryId; rejects any ID
 * outside the configured scope subtree.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { categoryId, page = '1', pageSize = '25' } = req.query;

    const categoryIdNum = Number(categoryId);
    if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
      return res.status(400).json({ error: 'categoryId must be a positive integer' });
    }

    await assertCategoryInScope(categoryIdNum);

    const pageNum = Math.max(1, Number(page) || 1);
    const pageSizeNum = Math.min(200, Math.max(1, Number(pageSize) || 25));

    // Use POST /asset/v1/content/assets/query with a compound filter
    // (category.id AND assetType.name). The simple GET /assets endpoint
    // requires broader "view all assets" permissions that the
    // documents_and_images_read scope alone does not grant — the query
    // endpoint with an assetType filter works because it scopes to
    // image permissions we do have.
    const body = {
      page: { page: pageNum, pageSize: pageSizeNum },
      query: {
        leftOperand: {
          property: 'category.id',
          simpleOperator: 'equal',
          value: categoryIdNum,
        },
        logicalOperator: 'AND',
        rightOperand: {
          property: 'assetType.name',
          simpleOperator: 'in',
          value: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
        },
      },
      sort: [{ property: 'name', direction: 'ASC' }],
      fields: ['id', 'name', 'assetType', 'fileProperties', 'thumbnail', 'category'],
    };

    const response = await sfmcFetch(`/asset/v1/content/assets/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `SFMC error: ${errorText}` });
    }

    const data = await response.json();
    type RawAsset = {
      id: number;
      name: string;
      assetType?: { id: number; name: string; displayName?: string };
      fileProperties?: { fileName?: string; publishedURL?: string; fileSize?: number };
      thumbnail?: { thumbnailUrl?: string };
      category?: { id: number; name?: string };
    };

    const items = (data.items || []).map((a: RawAsset) => ({
      id: a.id,
      name: a.name,
      assetType: a.assetType,
      thumbnailUrl: a.thumbnail?.thumbnailUrl,
      fileName: a.fileProperties?.fileName,
      publishedUrl: a.fileProperties?.publishedURL,
      fileSize: a.fileProperties?.fileSize,
      category: a.category,
    }));

    return res.status(200).json({
      items,
      page: data.page ?? pageNum,
      pageSize: data.pageSize ?? pageSizeNum,
      count: data.count ?? items.length,
    });
  } catch (err) {
    if (err instanceof ScopeViolationError) {
      return res.status(403).json({ error: err.message });
    }
    console.error('SFMC assets error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to fetch assets',
    });
  }
}
