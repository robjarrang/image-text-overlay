import { NextApiRequest, NextApiResponse } from 'next';
import {
  sfmcFetch,
  assertCategoryInScope,
  ScopeViolationError,
  ReadOnlyModeError,
} from '../../../utils/sfmc';

export const config = {
  maxDuration: 60,
  api: {
    bodyParser: { sizeLimit: '10mb' },
  },
};

const ASSET_TYPES: Record<string, { name: string; id: number }> = {
  'image/png': { name: 'png', id: 28 },
  'image/jpeg': { name: 'jpg', id: 23 },
};

/**
 * POST /api/sfmc/upload
 * Body:
 *   {
 *     categoryId: number,       // must be within scope
 *     assetName:  string,
 *     overlayParams: object,    // same shape accepted by /api/overlay
 *     assetId?:   number,       // if provided, REPLACE this asset's bytes
 *                               // instead of creating a new one. Must be in
 *                               // scope. Used for "Update" flow.
 *   }
 *
 * When `assetId` is omitted a new asset is created in `categoryId`.
 * When `assetId` is provided the asset bytes are replaced in place
 * (SFMC keeps the same `id` and `publishedURL`).
 *
 * Generates the image via the existing overlay pipeline, then uploads
 * it to SFMC.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { categoryId, assetName, overlayParams, assetId } = req.body ?? {};

    const categoryIdNum = Number(categoryId);
    if (!Number.isFinite(categoryIdNum) || categoryIdNum <= 0) {
      return res.status(400).json({ error: 'categoryId must be a positive integer' });
    }
    if (typeof assetName !== 'string' || !assetName.trim()) {
      return res.status(400).json({ error: 'assetName is required' });
    }
    if (!overlayParams || typeof overlayParams !== 'object') {
      return res.status(400).json({ error: 'overlayParams is required' });
    }

    const assetIdNum = assetId !== undefined ? Number(assetId) : undefined;
    if (assetIdNum !== undefined && (!Number.isFinite(assetIdNum) || assetIdNum <= 0)) {
      return res.status(400).json({ error: 'assetId must be a positive integer if provided' });
    }

    await assertCategoryInScope(categoryIdNum);

    // If replacing, also confirm the existing asset sits in scope so we
    // can't be tricked into overwriting something outside the subtree.
    if (assetIdNum !== undefined) {
      const existing = await sfmcFetch(`/asset/v1/content/assets/${assetIdNum}`);
      if (!existing.ok) {
        const txt = await existing.text();
        return res.status(existing.status).json({
          error: `Cannot verify existing asset ${assetIdNum}: ${txt}`,
        });
      }
      const existingJson = await existing.json();
      const existingCategoryId = existingJson?.category?.id;
      if (!existingCategoryId) {
        return res.status(500).json({ error: 'Existing asset has no category' });
      }
      await assertCategoryInScope(Number(existingCategoryId));
    }

    // Fail fast in read-only mode before generating the image.
    if (process.env.SFMC_READ_ONLY === 'true') {
      return res.status(403).json({
        error:
          'Uploads are disabled because SFMC_READ_ONLY=true is set. ' +
          'Unset SFMC_READ_ONLY to enable writes.',
      });
    }

    // Basic filename sanitisation
    const safeName = assetName
      .replace(/[\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);

    // Call the overlay endpoint to produce the image buffer.
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT || 3000}`;

    const overlayResponse = await fetch(`${baseUrl}/api/overlay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...overlayParams, download: true }),
    });

    if (!overlayResponse.ok) {
      const errorText = await overlayResponse.text();
      return res.status(502).json({ error: `Image generation failed: ${errorText}` });
    }

    const contentType = overlayResponse.headers.get('content-type') || 'image/png';
    const assetType = ASSET_TYPES[contentType] ?? ASSET_TYPES['image/png'];
    const extension = assetType.name;

    const imageBuffer = Buffer.from(await overlayResponse.arrayBuffer());
    const base64Data = imageBuffer.toString('base64');

    const fileName = safeName.toLowerCase().endsWith(`.${extension}`)
      ? safeName
      : `${safeName}.${extension}`;

    const sfmcPayload = {
      name: fileName,
      assetType: { name: assetType.name, id: assetType.id },
      category: { id: categoryIdNum },
      fileProperties: { fileName },
      file: base64Data,
    };

    // POST creates a new asset; PATCH on /{id} replaces the file in place.
    // (SFMC supports PUT but many tenants allow PATCH for partial
    // updates — PATCH of `file` + `fileProperties` is the documented
    // way to replace asset bytes while retaining the id.)
    const sfmcResponse = assetIdNum !== undefined
      ? await sfmcFetch(`/asset/v1/content/assets/${assetIdNum}`, {
          method: 'PATCH',
          body: JSON.stringify(sfmcPayload),
        })
      : await sfmcFetch('/asset/v1/content/assets', {
          method: 'POST',
          body: JSON.stringify(sfmcPayload),
        });

    if (!sfmcResponse.ok) {
      const errorText = await sfmcResponse.text();
      return res.status(sfmcResponse.status).json({
        error: `SFMC upload failed: ${errorText}`,
      });
    }

    const asset = await sfmcResponse.json();
    return res.status(assetIdNum !== undefined ? 200 : 201).json({
      success: true,
      replaced: assetIdNum !== undefined,
      asset: {
        id: asset.id,
        name: asset.name,
        customerKey: asset.customerKey,
        publishedUrl: asset.fileProperties?.publishedURL,
        thumbnailUrl: asset.thumbnail?.thumbnailUrl,
        category: asset.category,
      },
    });
  } catch (err) {
    if (err instanceof ScopeViolationError) {
      return res.status(403).json({ error: err.message });
    }
    if (err instanceof ReadOnlyModeError) {
      return res.status(403).json({ error: err.message });
    }
    console.error('SFMC upload error:', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to upload to SFMC',
    });
  }
}
