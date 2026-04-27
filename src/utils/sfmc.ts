/**
 * SFMC service module.
 *
 * All Salesforce Marketing Cloud API traffic flows through this module.
 * Tokens are cached in memory (per serverless instance) and refreshed
 * automatically with a 60s expiry buffer.
 *
 * Scoping:
 *   Every caller that accepts a category ID from the client MUST validate
 *   it via `assertCategoryInScope(id)` before making any SFMC request with
 *   it. The allowed subtree is rooted at `SFMC_ROOT_CATEGORY_ID`.
 */

interface SfmcToken {
  accessToken: string;
  restInstanceUrl: string;
  expiresAt: number;
}

interface SfmcCategory {
  id: number;
  name: string;
  parentId: number;
  categoryType?: string;
}

let cachedToken: SfmcToken | null = null;

/** IDs we've already confirmed are inside the allowed subtree. */
const scopeAllowedCache = new Set<number>();

/** IDs we've already confirmed are outside the allowed subtree. */
const scopeDeniedCache = new Set<number>();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function getRootCategoryId(): number {
  const raw = requireEnv('SFMC_ROOT_CATEGORY_ID');
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`SFMC_ROOT_CATEGORY_ID is not a valid numeric ID: ${raw}`);
  }
  return parsed;
}

export async function getSfmcToken(): Promise<SfmcToken> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken;
  }

  const authUrl = requireEnv('SFMC_AUTH_URL').replace(/\/$/, '');
  const clientId = requireEnv('SFMC_CLIENT_ID');
  const clientSecret = requireEnv('SFMC_CLIENT_SECRET');
  const accountId = process.env.SFMC_ACCOUNT_ID;

  const body: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  };
  if (accountId) body.account_id = accountId;

  const response = await fetch(`${authUrl}/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SFMC auth failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const restInstanceUrl = (
    data.rest_instance_url ||
    process.env.SFMC_REST_URL ||
    ''
  ).replace(/\/$/, '');

  if (!restInstanceUrl) {
    throw new Error('SFMC auth returned no rest_instance_url and SFMC_REST_URL is not set');
  }

  cachedToken = {
    accessToken: data.access_token,
    restInstanceUrl,
    expiresAt: Date.now() + (data.expires_in ?? 1200) * 1000,
  };

  return cachedToken;
}

export class ReadOnlyModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReadOnlyModeError';
  }
}

/**
 * When SFMC_READ_ONLY=true, refuse to send any request to SFMC that
 * could modify state. Only GET and HEAD are permitted by default. A
 * small allow-list of known read-only POST endpoints is also permitted
 * (e.g. `/asset/v1/content/assets/query`, which is a search endpoint
 * that happens to use POST for body-based filter expressions).
 *
 * This is a belt-and-braces guard on top of the Installed Package
 * scope (which already lacks write permission).
 */
const READ_ONLY_POST_ALLOWLIST: RegExp[] = [
  // Asset search — POST with filter body, does not mutate state.
  /^\/asset\/v1\/content\/assets\/query(\?|$)/,
  // Category search — same pattern as asset query.
  /^\/asset\/v1\/content\/categories\/query(\?|$)/,
];

function assertNotBlockedByReadOnly(method: string, path: string): void {
  if (process.env.SFMC_READ_ONLY !== 'true') return;
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD') return;
  if (m === 'POST' && READ_ONLY_POST_ALLOWLIST.some((re) => re.test(path))) return;
  throw new ReadOnlyModeError(
    `Blocked ${m} ${path} — SFMC_READ_ONLY=true is set. ` +
      `Unset SFMC_READ_ONLY to allow writes.`
  );
}

/**
 * Authenticated fetch against SFMC REST API.
 * Handles a single 401 retry after clearing the cached token.
 * Honours SFMC_READ_ONLY=true by refusing to send non-safe methods.
 */
export async function sfmcFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  assertNotBlockedByReadOnly(method, path);

  const token = await getSfmcToken();

  const doFetch = (t: SfmcToken) =>
    fetch(`${t.restInstanceUrl}${path}`, {
      ...options,
      method,
      headers: {
        Authorization: `Bearer ${t.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

  let response = await doFetch(token);

  if (response.status === 401) {
    cachedToken = null;
    const fresh = await getSfmcToken();
    response = await doFetch(fresh);
  }

  return response;
}

/** Fetch a single category's metadata (id, name, parentId). */
export async function getCategory(id: number): Promise<SfmcCategory | null> {
  const response = await sfmcFetch(`/asset/v1/content/categories/${id}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch category ${id}: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return {
    id: data.id,
    name: data.name,
    parentId: data.parentId,
    categoryType: data.categoryType,
  };
}

/**
 * Returns true if `categoryId` is equal to, or a descendant of, the
 * configured root category. Walks up the parent chain on cache miss.
 */
export async function isCategoryInScope(categoryId: number): Promise<boolean> {
  const rootId = getRootCategoryId();
  if (categoryId === rootId) return true;
  if (scopeAllowedCache.has(categoryId)) return true;
  if (scopeDeniedCache.has(categoryId)) return false;

  // Walk up the parent chain until we find the root, hit a cached result,
  // reach the top of Content Builder (parentId == 0), or loop (safety).
  const visited = new Set<number>();
  const pathToCheck: number[] = [];
  let currentId: number | undefined = categoryId;

  while (currentId && currentId !== 0 && !visited.has(currentId)) {
    visited.add(currentId);

    if (currentId === rootId || scopeAllowedCache.has(currentId)) {
      // Everything we walked through is in scope.
      pathToCheck.forEach((id) => scopeAllowedCache.add(id));
      scopeAllowedCache.add(categoryId);
      return true;
    }
    if (scopeDeniedCache.has(currentId)) {
      pathToCheck.forEach((id) => scopeDeniedCache.add(id));
      scopeDeniedCache.add(categoryId);
      return false;
    }

    pathToCheck.push(currentId);
    const category: SfmcCategory | null = await getCategory(currentId);
    if (!category) {
      scopeDeniedCache.add(categoryId);
      return false;
    }
    currentId = category.parentId;
  }

  pathToCheck.forEach((id) => scopeDeniedCache.add(id));
  scopeDeniedCache.add(categoryId);
  return false;
}

/** Throws with a 403-equivalent message if the category is not in scope. */
export async function assertCategoryInScope(categoryId: number): Promise<void> {
  const ok = await isCategoryInScope(categoryId);
  if (!ok) {
    throw new ScopeViolationError(
      `Category ${categoryId} is outside the allowed scope.`
    );
  }
}

export class ScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeViolationError';
  }
}
