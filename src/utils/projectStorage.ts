/**
 * Client-side utility for managing project edit tokens in localStorage.
 * 
 * When a user creates or updates a project, we store the edit token locally
 * so they can update the same project later. Viewers who open a shared link
 * won't have the token, so they get read-only access (sharing creates a new project for them).
 */

const STORAGE_KEY = 'project-tokens';

interface ProjectTokens {
  [projectId: string]: {
    editToken: string;
    savedAt: string; // ISO date string
  };
}

function getTokenStore(): ProjectTokens {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setTokenStore(store: ProjectTokens): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage may be full or unavailable — fail silently
  }
}

/** Save an edit token for a project. */
export function saveEditToken(projectId: string, editToken: string): void {
  const store = getTokenStore();
  store[projectId] = {
    editToken,
    savedAt: new Date().toISOString(),
  };
  setTokenStore(store);
}

/** Retrieve the edit token for a project, or null if not found. */
export function getEditToken(projectId: string): string | null {
  const store = getTokenStore();
  return store[projectId]?.editToken ?? null;
}

/** Remove the edit token for a project. */
export function removeEditToken(projectId: string): void {
  const store = getTokenStore();
  delete store[projectId];
  setTokenStore(store);
}

/** Check if the current user owns (has the edit token for) a project. */
export function isProjectOwner(projectId: string): boolean {
  return getEditToken(projectId) !== null;
}
