/**
 * Thin wrapper around the Salesforce Marketing Cloud Block SDK
 * (`blocksdk` on npm) used when the editor is embedded as a Content
 * Builder Custom Block.
 *
 * The Block SDK communicates with the SFMC parent frame over
 * `postMessage` and lets a block persist two pieces of information
 * tied to a single block instance on an email:
 *
 *   - `data`    — arbitrary JSON metadata (invisible to the email).
 *                 We use this to store the project id + name so the
 *                 editor can auto-reopen the same project next time.
 *   - `content` — the HTML that is rendered into the email itself.
 *                 We write a small placeholder referencing the project
 *                 share URL so the block shows something meaningful in
 *                 the email preview.
 *
 * When the app is NOT embedded (e.g. loaded standalone in a browser),
 * every method here is a no-op.
 */

// blocksdk is a CommonJS module with no types; narrow it locally.
type BlockSdkInstance = {
  getData: (cb: (data: unknown) => void) => void;
  setData: (data: unknown, cb?: (data: unknown) => void) => void;
  getContent: (cb: (html: string) => void) => void;
  setContent: (html: string, cb?: (html: string) => void) => void;
};

export interface StoredProjectRef {
  projectId?: string;
  projectName?: string;
}

let sdkInstance: BlockSdkInstance | null = null;
let initialized = false;

/**
 * True when the app is running inside an iframe — the only situation
 * in which the Block SDK can connect to a parent frame.
 */
function isEmbedded(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.parent !== window;
  } catch {
    // Cross-origin access throws; being inside a frame is still true.
    return true;
  }
}

/**
 * Lazily initialise the SDK. Safe to call multiple times.
 * Returns `null` when not embedded or when the SDK fails to load
 * (e.g. during SSR / build).
 */
async function getSdk(): Promise<BlockSdkInstance | null> {
  if (initialized) return sdkInstance;
  initialized = true;
  if (!isEmbedded()) return null;
  try {
    // Dynamic import so blocksdk (which touches `window`) never runs on the server.
    const mod = await import('blocksdk');
    const SDK = mod.default;
    sdkInstance = new SDK() as unknown as BlockSdkInstance;
    return sdkInstance;
  } catch (err) {
    // Non-fatal: log and disable integration so the app still works standalone.
    // eslint-disable-next-line no-console
    console.warn('[sfmcBlock] Failed to initialise Block SDK:', err);
    return null;
  }
}

/**
 * Read the project reference previously saved by this block instance.
 * Resolves with `{}` when there is nothing stored, when the stored
 * value is malformed, or when the app is not embedded in SFMC.
 */
export async function getStoredProjectRef(): Promise<StoredProjectRef> {
  const sdk = await getSdk();
  if (!sdk) return {};
  return new Promise<StoredProjectRef>((resolve) => {
    // Guard against the SDK never calling us back (e.g. handshake failure).
    const timeout = setTimeout(() => resolve({}), 3000);
    try {
      sdk.getData((data) => {
        clearTimeout(timeout);
        if (data && typeof data === 'object') {
          const d = data as Record<string, unknown>;
          resolve({
            projectId: typeof d.projectId === 'string' ? d.projectId : undefined,
            projectName: typeof d.projectName === 'string' ? d.projectName : undefined,
          });
        } else {
          resolve({});
        }
      });
    } catch {
      clearTimeout(timeout);
      resolve({});
    }
  });
}

/**
 * Persist the currently-open project to the block instance so that
 * reopening the block re-loads the same project automatically.
 * Also writes a small HTML snippet as the block's email content so the
 * email preview shows something other than an empty block.
 */
export async function storeProjectRef(
  projectId: string,
  projectName: string,
  shareUrl: string,
): Promise<void> {
  const sdk = await getSdk();
  if (!sdk) return;
  try {
    sdk.setData({ projectId, projectName, shareUrl });
    // Minimal in-email placeholder. Users still export the final image
    // separately; this just ensures the block isn't empty.
    const safeName = projectName.replace(/[<>&"]/g, (c) => ({
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
    }[c] || c));
    const safeUrl = shareUrl.replace(/"/g, '&quot;');
    sdk.setContent(
      `<!-- image-text-overlay project: ${projectId} -->`
      + `<a href="${safeUrl}" style="text-decoration:none;color:inherit;">${safeName}</a>`,
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sfmcBlock] Failed to persist project ref:', err);
  }
}

/**
 * Clear the stored project reference (e.g. when the user explicitly
 * starts a new blank project from within an existing block).
 */
export async function clearStoredProjectRef(): Promise<void> {
  const sdk = await getSdk();
  if (!sdk) return;
  try {
    sdk.setData({});
  } catch {
    /* no-op */
  }
}
