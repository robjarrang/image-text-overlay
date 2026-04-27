import { NextApiRequest, NextApiResponse } from 'next';
import { getSfmcToken, getCategory } from '../../../utils/sfmc';

/**
 * GET /api/sfmc/auth
 * Connection health check. Returns whether auth works and whether the
 * configured scope root category is reachable.
 *
 * GET /api/sfmc/auth?debug=scopes
 *   Also calls SFMC's /v2/userinfo to report the actual scopes granted
 *   to the current token. Useful for diagnosing "Insufficient
 *   Privileges" errors. No secrets are returned.
 *
 * NOTE: No secrets are returned. Only booleans and a non-sensitive
 * display name for the root folder.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const result: {
    connected: boolean;
    scope: { configured: boolean; rootId?: number; rootName?: string };
    grantedScopes?: string[];
    tokenScopesRaw?: string;
    error?: string;
  } = {
    connected: false,
    scope: { configured: false },
  };

  let token;
  try {
    token = await getSfmcToken();
    result.connected = true;
  } catch (err) {
    result.error = err instanceof Error ? err.message : 'Unknown auth error';
    return res.status(200).json(result);
  }

  if (req.query.debug === 'scopes') {
    try {
      const authUrl = process.env.SFMC_AUTH_URL!.replace(/\/$/, '');
      const userinfo = await fetch(`${authUrl}/v2/userinfo`, {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
      if (userinfo.ok) {
        const info = await userinfo.json();
        // userinfo returns rest.* / application.* fields; scopes live under
        // rest.permissions or at top-level "scope". Surface both.
        result.tokenScopesRaw = info.scope ?? info.scopes ?? '';
        result.grantedScopes = typeof result.tokenScopesRaw === 'string'
          ? result.tokenScopesRaw.split(/\s+/).filter(Boolean)
          : Array.isArray(result.tokenScopesRaw) ? (result.tokenScopesRaw as string[]) : [];
      } else {
        result.error = `userinfo failed: ${userinfo.status} ${await userinfo.text()}`;
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : 'Failed to fetch userinfo';
    }
  }

  const rootIdRaw = process.env.SFMC_ROOT_CATEGORY_ID;
  if (rootIdRaw) {
    const rootId = Number(rootIdRaw);
    result.scope.configured = Number.isFinite(rootId) && rootId > 0;
    if (result.scope.configured) {
      try {
        const cat = await getCategory(rootId);
        if (cat) {
          result.scope.rootId = cat.id;
          result.scope.rootName = cat.name;
        } else {
          result.error = `Configured root category ${rootId} not found`;
        }
      } catch (err) {
        result.error = err instanceof Error ? err.message : 'Failed to load root category';
      }
    }
  }

  return res.status(200).json(result);
}
