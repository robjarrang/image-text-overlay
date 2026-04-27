'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';

/**
 * SfmcBrowser
 * -----------
 * Modal for browsing SFMC Content Builder folders and image assets,
 * scoped to the subtree configured via `SFMC_ROOT_CATEGORY_ID` on the
 * server. All requests go through the app's /api/sfmc/* endpoints —
 * credentials never leave the server.
 *
 * On asset selection the caller receives the image's published URL,
 * which the parent can feed into the existing image-URL flow (the
 * /api/load-images proxy handles CORS).
 */

export interface SfmcFolder {
  id: number;
  name: string;
  parentId: number | null;
  isScopeRoot?: boolean;
}

export interface SfmcAsset {
  id: number;
  name: string;
  fileName?: string;
  publishedUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  assetType?: { id: number; name: string; displayName?: string };
  category?: { id: number; name?: string };
}

interface BreadcrumbItem {
  id: number;
  name: string;
}

interface SfmcBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Called when the user picks an image asset. Only used when
   * `mode === 'asset'` (default).
   */
  onPickAsset?: (asset: SfmcAsset) => void;
  /**
   * Called when the user picks a destination folder. Only used when
   * `mode === 'folder'`.
   */
  onPickFolder?: (folder: { id: number; name: string }) => void;
  /**
   * 'asset' (default) — user navigates folders and picks an image.
   * 'folder' — user navigates folders and picks the folder itself via
   *            a "Select this folder" button. Assets are hidden.
   */
  mode?: 'asset' | 'folder';
  title?: string;
}

export function SfmcBrowser({
  isOpen,
  onClose,
  onPickAsset,
  onPickFolder,
  mode = 'asset',
  title,
}: SfmcBrowserProps) {
  const [folders, setFolders] = useState<SfmcFolder[]>([]);
  const [assets, setAssets] = useState<SfmcAsset[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // First call: no parentId → returns the scope root folder only.
      const res = await fetch('/api/sfmc/folders');
      if (!res.ok) throw new Error(`Failed to load folders (${res.status})`);
      const data = await res.json();
      const rootFolders: SfmcFolder[] = data.items || [];
      const root = rootFolders[0];
      if (!root) throw new Error('No SFMC scope root configured on the server');
      // Auto-dive into the scope root so the user immediately sees its contents.
      setBreadcrumbs([{ id: root.id, name: root.name }]);
      setCurrentFolderId(root.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SFMC');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFolderContents = useCallback(async (folderId: number) => {
    setLoading(true);
    setError(null);
    try {
      // Skip asset fetch entirely in folder-pick mode.
      const [foldersRes, assetsRes] = await Promise.all([
        fetch(`/api/sfmc/folders?parentId=${folderId}`),
        mode === 'folder'
          ? Promise.resolve(null)
          : fetch(`/api/sfmc/assets?categoryId=${folderId}&pageSize=100`),
      ]);
      if (!foldersRes.ok) {
        const msg = await foldersRes.text();
        throw new Error(`Folders: ${foldersRes.status} ${msg}`);
      }
      if (assetsRes && !assetsRes.ok) {
        const msg = await assetsRes.text();
        throw new Error(`Assets: ${assetsRes.status} ${msg}`);
      }
      const foldersData = await foldersRes.json();
      const assetsData = assetsRes ? await assetsRes.json() : { items: [] };
      setFolders(foldersData.items || []);
      setAssets(assetsData.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
      setFolders([]);
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!isOpen) return;
    if (currentFolderId === null) {
      loadInitial();
    }
  }, [isOpen, currentFolderId, loadInitial]);

  useEffect(() => {
    if (!isOpen || currentFolderId === null) return;
    loadFolderContents(currentFolderId);
  }, [isOpen, currentFolderId, loadFolderContents]);

  // Reset state when closed so the next open reloads fresh.
  useEffect(() => {
    if (!isOpen) {
      setFolders([]);
      setAssets([]);
      setBreadcrumbs([]);
      setCurrentFolderId(null);
      setError(null);
    }
  }, [isOpen]);

  const handleFolderClick = (folder: SfmcFolder) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const newTrail = breadcrumbs.slice(0, index + 1);
    setBreadcrumbs(newTrail);
    setCurrentFolderId(newTrail[newTrail.length - 1].id);
  };

  const handleAssetClick = (asset: SfmcAsset) => {
    if (!asset.publishedUrl) {
      setError(`"${asset.name}" has no published URL yet — try again in a minute.`);
      return;
    }
    onPickAsset(asset);
    onClose();
  };
  const handleSelectCurrentFolder = () => {
    const current = breadcrumbs[breadcrumbs.length - 1];
    if (!current) return;
    onPickFolder?.({ id: current.id, name: current.name });
    onClose();
  };
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="sfmc-browser-heading"
        className="slds-modal slds-fade-in-open slds-modal_large"
      >
        <div className="slds-modal__container" ref={panelRef}>
        <header className="slds-modal__header" style={{ position: 'relative' }}>
          <h1 id="sfmc-browser-heading" className="slds-modal__title slds-hyphenate" style={{ paddingRight: '2.5rem' }}>
            {title ?? (mode === 'folder' ? 'Choose SFMC Destination Folder' : 'Browse SFMC Content Builder')}
          </h1>
          <button
            type="button"
            className="slds-button slds-button_icon"
            onClick={onClose}
            aria-label="Close"
            style={{
              position: 'absolute',
              top: '50%',
              right: '0.75rem',
              transform: 'translateY(-50%)',
              width: '2rem',
              height: '2rem',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icons.Close size="x-small" />
          </button>
        </header>

        <div className="slds-modal__content slds-p-around_medium" style={{ minHeight: '60vh' }}>
          {/* Breadcrumbs */}
          {breadcrumbs.length > 0 && (
            <nav aria-label="Breadcrumbs" className="slds-m-bottom_small">
              <ol className="slds-breadcrumb slds-list_horizontal slds-wrap">
                {breadcrumbs.map((b, i) => (
                  <li
                    key={b.id}
                    className="slds-breadcrumb__item slds-text-title_caps"
                  >
                    {i < breadcrumbs.length - 1 ? (
                      <button
                        type="button"
                        className="slds-button slds-button_reset"
                        onClick={() => handleBreadcrumbClick(i)}
                      >
                        {b.name}
                      </button>
                    ) : (
                      <span>{b.name}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}

          {error && (
            <div
              className="slds-notify slds-notify_alert slds-theme_error slds-m-bottom_small"
              role="alert"
            >
              <span className="slds-assistive-text">Error</span>
              <span>{error}</span>
            </div>
          )}

          {loading && (
            <div className="slds-is-relative slds-p-around_large">
              <div className="slds-spinner_container">
                <div className="slds-spinner slds-spinner_medium" role="status">
                  <span className="slds-assistive-text">Loading</span>
                  <div className="slds-spinner__dot-a"></div>
                  <div className="slds-spinner__dot-b"></div>
                </div>
              </div>
            </div>
          )}

          {!loading && (
            <>
              {/* Folders */}
              {folders.length > 0 && (
                <>
                  <h2 className="slds-text-heading_small slds-m-bottom_x-small">Folders</h2>
                  <ul className="slds-grid slds-wrap slds-m-bottom_medium" style={{ gap: '0.5rem' }}>
                    {folders.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          className="slds-button slds-button_neutral"
                          onClick={() => handleFolderClick(f)}
                        >
                          <Icons.OpenFolder />
                          <span className="slds-m-left_x-small">{f.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Assets — hidden in folder-pick mode */}
              {mode === 'asset' && (
                <>
                  <h2 className="slds-text-heading_small slds-m-bottom_x-small">Images</h2>
                  {assets.length === 0 ? (
                    <p className="slds-text-body_regular slds-text-color_weak">
                      No images in this folder.
                    </p>
                  ) : (
                    <ul className="slds-grid slds-wrap" style={{ gap: '0.75rem' }}>
                      {assets.map((a) => (
                        <li
                          key={a.id}
                          style={{
                            width: 180,
                            border: '1px solid #dddbda',
                            borderRadius: 4,
                            overflow: 'hidden',
                            background: '#fff',
                          }}
                        >
                          <button
                            type="button"
                            className="slds-button slds-button_reset"
                            style={{
                              display: 'block',
                              width: '100%',
                              textAlign: 'left',
                              padding: 0,
                            }}
                            onClick={() => handleAssetClick(a)}
                            title={a.name}
                          >
                            <div
                              style={{
                                width: '100%',
                                aspectRatio: '1 / 1',
                                background: '#f3f3f3',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                              }}
                            >
                              {a.publishedUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={a.publishedUrl}
                                  alt={a.name}
                                  style={{
                                    maxWidth: '100%',
                                    maxHeight: '100%',
                                    objectFit: 'contain',
                                  }}
                                />
                              ) : (
                                <span className="slds-text-color_weak">No preview</span>
                              )}
                            </div>
                            <div
                              className="slds-p-around_x-small slds-truncate"
                              style={{ fontSize: 12 }}
                            >
                              {a.name}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {mode === 'folder' && (
                <p className="slds-text-body_small slds-text-color_weak slds-m-top_small">
                  Navigate into a folder and click <em>Select this folder</em> below to choose it as the upload destination.
                </p>
              )}
            </>
          )}
        </div>

        <footer className="slds-modal__footer">
          {mode === 'folder' && breadcrumbs.length > 0 && (
            <button
              type="button"
              className="slds-button slds-button_brand"
              onClick={handleSelectCurrentFolder}
            >
              Select this folder ({breadcrumbs[breadcrumbs.length - 1].name})
            </button>
          )}
          <button type="button" className="slds-button slds-button_neutral" onClick={onClose}>
            Cancel
          </button>
        </footer>
      </div>
      </section>
      <div className="slds-backdrop slds-backdrop_open" onClick={onClose}></div>
    </>
  );
}
