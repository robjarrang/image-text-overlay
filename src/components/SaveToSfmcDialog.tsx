'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icons, SldsIcon } from './Icons';
import { SfmcBrowser } from './SfmcBrowser';

/**
 * SaveToSfmcDialog
 * ----------------
 * Handles both single-image and desktop-mobile (pair) save flows.
 *
 *   - currentMode="single":        one asset name, one upload call.
 *   - currentMode="desktop-mobile": version picker (Desktop / Mobile /
 *                                   Both). Base name is suffixed
 *                                   `_desktop` / `_mobile` per asset.
 *                                   On "Both", uploads run sequentially;
 *                                   if the first succeeds and the second
 *                                   fails, the successful one is still
 *                                   persisted to the project link.
 *
 * All uploads go through POST /api/sfmc/upload. When an `assetId` is
 * included in the body, the server PATCHes the existing asset in place
 * (same id + published URL); otherwise it creates a new asset.
 */

export interface SfmcAssetRef {
  assetId: number;
  assetName: string;
  publishedUrl?: string;
  customerKey?: string;
}

export interface SfmcLinkSingle {
  kind: 'single';
  categoryId: number;
  categoryName?: string;
  assetId: number;
  assetName: string;
  publishedUrl?: string;
  customerKey?: string;
  lastUpdatedAt?: string;
}

export interface SfmcLinkPair {
  kind: 'pair';
  categoryId: number;
  categoryName?: string;
  baseName: string;
  desktop?: SfmcAssetRef;
  mobile?: SfmcAssetRef;
  lastUpdatedAt?: string;
}

export type SfmcLink = SfmcLinkSingle | SfmcLinkPair;

type VersionChoice = 'desktop' | 'mobile' | 'both';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Matches the editor's current image-source mode. */
  currentMode: 'single' | 'desktop-mobile';
  existingLink: SfmcLink | null;
  /**
   * Returns an overlayParams snapshot. In desktop-mobile mode, caller
   * should pass the version to render; single mode ignores the arg.
   */
  buildOverlayParams: (version?: 'desktop' | 'mobile') => Record<string, unknown>;
  /**
   * Called just before the first SFMC upload call. Gives the parent a
   * chance to persist the current project state so in-editor edits
   * aren't lost if the upload subsequently fails. Reject/throw to
   * abort the upload with an error shown to the user.
   */
  onBeforeUpload?: () => Promise<void>;
  onUploaded: (link: SfmcLink, summary: string) => void;
}

interface UploadResult {
  asset: {
    id: number;
    name: string;
    customerKey?: string;
    publishedUrl?: string;
    category?: { id: number; name?: string };
  };
  replaced: boolean;
}

async function runUpload(body: Record<string, unknown>): Promise<UploadResult> {
  const res = await fetch('/api/sfmc/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error || `Upload failed (${res.status})`);
  }
  return data as UploadResult;
}

export function SaveToSfmcDialog({
  isOpen,
  onClose,
  currentMode,
  existingLink,
  buildOverlayParams,
  onBeforeUpload,
  onUploaded,
}: Props) {
  const [pickedFolder, setPickedFolder] = useState<{ id: number; name: string } | null>(null);
  const [baseName, setBaseName] = useState('');
  const [saveAsNew, setSaveAsNew] = useState(false);
  const [versionChoice, setVersionChoice] = useState<VersionChoice>('both');
  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | null>(null);

  /** `true` when updating an existing linked asset (PATCH path). */
  const isUpdate = Boolean(existingLink) && !saveAsNew;

  /**
   * Detect a mode mismatch between the existing link and the editor's
   * current mode. e.g. project was linked as a pair but user is now in
   * single mode. We force "save as new" in this case.
   */
  const modeMismatch =
    existingLink !== null &&
    ((existingLink.kind === 'pair' && currentMode !== 'desktop-mobile') ||
      (existingLink.kind === 'single' && currentMode === 'desktop-mobile'));

  const effectiveSaveAsNew = saveAsNew || modeMismatch;
  const effectiveIsUpdate = Boolean(existingLink) && !effectiveSaveAsNew;

  // Populate form when the dialog opens / link changes.
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setPartialWarning(null);
    setIsUploading(false);
    setSaveAsNew(false);

    if (existingLink) {
      setPickedFolder({
        id: existingLink.categoryId,
        name: existingLink.categoryName || 'Linked folder',
      });
      if (existingLink.kind === 'pair') {
        setBaseName(existingLink.baseName);
        // Default to updating whichever versions already exist.
        if (existingLink.desktop && existingLink.mobile) setVersionChoice('both');
        else if (existingLink.desktop) setVersionChoice('desktop');
        else if (existingLink.mobile) setVersionChoice('mobile');
        else setVersionChoice('both');
      } else {
        setBaseName(existingLink.assetName.replace(/\.(png|jpg|jpeg)$/i, ''));
        setVersionChoice('both');
      }
    } else {
      setPickedFolder(null);
      setBaseName('');
      setVersionChoice('both');
    }
  }, [isOpen, existingLink]);

  // Esc to close (unless nested browser is open or an upload is running).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isBrowserOpen && !isUploading) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isBrowserOpen, isUploading, onClose]);

  const assetNamePreview = useMemo(() => {
    const trimmed = baseName.trim();
    if (!trimmed) return null;
    if (currentMode === 'single') return trimmed;
    if (versionChoice === 'desktop') return `${trimmed}_desktop`;
    if (versionChoice === 'mobile') return `${trimmed}_mobile`;
    return `${trimmed}_desktop, ${trimmed}_mobile`;
  }, [baseName, currentMode, versionChoice]);

  const handleUpload = async () => {
    setError(null);
    setPartialWarning(null);

    if (!pickedFolder) {
      setError('Please choose a destination folder.');
      return;
    }
    const trimmedBase = baseName.trim();
    if (!trimmedBase) {
      setError(
        currentMode === 'desktop-mobile'
          ? 'Please enter a base name for the assets.'
          : 'Please enter an asset name.',
      );
      return;
    }

    setIsUploading(true);

    try {
      // Persist project state first so edits survive even if the
      // upload below fails.
      if (onBeforeUpload) {
        try {
          await onBeforeUpload();
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to save project before upload.');
          return;
        }
      }

      if (currentMode === 'single') {
        const existingSingle =
          effectiveIsUpdate && existingLink?.kind === 'single' ? existingLink : null;

        const result = await runUpload({
          categoryId: pickedFolder.id,
          assetName: trimmedBase,
          overlayParams: buildOverlayParams(),
          ...(existingSingle && { assetId: existingSingle.assetId }),
        });

        const link: SfmcLinkSingle = {
          kind: 'single',
          categoryId: result.asset.category?.id ?? pickedFolder.id,
          categoryName: result.asset.category?.name ?? pickedFolder.name,
          assetId: result.asset.id,
          assetName: result.asset.name,
          publishedUrl: result.asset.publishedUrl,
          customerKey: result.asset.customerKey,
          lastUpdatedAt: new Date().toISOString(),
        };
        const summary = result.replaced
          ? `Updated ${result.asset.name} in SFMC`
          : `Uploaded ${result.asset.name} to SFMC`;
        onUploaded(link, summary);
        onClose();
        return;
      }

      // --- desktop-mobile pair path ---
      const existingPair =
        effectiveIsUpdate && existingLink?.kind === 'pair' ? existingLink : null;

      // Order: desktop first, mobile second. This matters for the
      // partial-failure policy — if desktop succeeds and mobile fails,
      // we still persist the desktop result.
      const targets: Array<'desktop' | 'mobile'> =
        versionChoice === 'both'
          ? ['desktop', 'mobile']
          : versionChoice === 'desktop'
          ? ['desktop']
          : ['mobile'];

      // Seed the pair link with whatever we already had, so a partial
      // update doesn't drop the other half.
      const nextPair: SfmcLinkPair = {
        kind: 'pair',
        categoryId: existingPair?.categoryId ?? pickedFolder.id,
        categoryName: existingPair?.categoryName ?? pickedFolder.name,
        baseName: trimmedBase,
        desktop: existingPair?.desktop,
        mobile: existingPair?.mobile,
        lastUpdatedAt: new Date().toISOString(),
      };

      const completed: Array<'desktop' | 'mobile'> = [];
      let firstError: { version: 'desktop' | 'mobile'; message: string } | null = null;

      for (const version of targets) {
        try {
          const suffix = version === 'desktop' ? '_desktop' : '_mobile';
          const existingRef = existingPair?.[version];
          const result = await runUpload({
            categoryId: pickedFolder.id,
            assetName: `${trimmedBase}${suffix}`,
            overlayParams: buildOverlayParams(version),
            ...(existingRef && { assetId: existingRef.assetId }),
          });

          const ref: SfmcAssetRef = {
            assetId: result.asset.id,
            assetName: result.asset.name,
            publishedUrl: result.asset.publishedUrl,
            customerKey: result.asset.customerKey,
          };
          if (version === 'desktop') nextPair.desktop = ref;
          else nextPair.mobile = ref;

          // Update folder info from the first successful response.
          if (completed.length === 0) {
            nextPair.categoryId = result.asset.category?.id ?? pickedFolder.id;
            nextPair.categoryName = result.asset.category?.name ?? pickedFolder.name;
          }
          completed.push(version);
        } catch (err) {
          firstError = {
            version,
            message: err instanceof Error ? err.message : 'Upload failed',
          };
          break;
        }
      }

      if (completed.length === 0 && firstError) {
        setError(`${firstError.version}: ${firstError.message}`);
        return;
      }

      // Commit whatever succeeded.
      const summary =
        completed.length === targets.length
          ? `${completed.length === 2 ? 'Uploaded both versions' : `Uploaded ${completed[0]} version`} to SFMC`
          : `Uploaded ${completed[0]} — ${firstError?.version} failed`;
      onUploaded(nextPair, summary);

      if (firstError) {
        setPartialWarning(
          `${completed.join(', ')} uploaded successfully, but ${firstError.version} failed: ${firstError.message}. The successful version has been saved to the project — retry to upload the other.`,
        );
      } else {
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  if (!isOpen) return null;

  const canUpload = Boolean(pickedFolder) && baseName.trim().length > 0 && !isUploading;

  return (
    <>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-to-sfmc-heading"
        className="slds-modal slds-fade-in-open"
      >
        <div className="slds-modal__container">
          <header className="slds-modal__header" style={{ position: 'relative' }}>
            <h1 id="save-to-sfmc-heading" className="slds-modal__title slds-hyphenate" style={{ paddingRight: '2.5rem' }}>
              Save to SFMC
            </h1>
            <button
              type="button"
              className="slds-button slds-button_icon"
              onClick={onClose}
              disabled={isUploading}
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

          <div className="slds-modal__content slds-p-around_medium">
            {existingLink && !effectiveSaveAsNew && (
              <div className="slds-notify slds-notify_alert slds-theme_info slds-m-bottom_medium">
                <span>
                  This project is linked to{' '}
                  <strong>
                    {existingLink.kind === 'pair'
                      ? existingLink.baseName
                      : existingLink.assetName}
                  </strong>
                  {existingLink.categoryName ? (
                    <>
                      {' '}in <strong>{existingLink.categoryName}</strong>
                    </>
                  ) : null}
                  . Saving will replace the existing{' '}
                  {existingLink.kind === 'pair' ? 'assets' : 'asset'} (same URL).
                </span>
              </div>
            )}

            {modeMismatch && (
              <div className="slds-notify slds-notify_alert slds-theme_warning slds-m-bottom_medium">
                <span>
                  This project is linked to a{' '}
                  {existingLink?.kind === 'pair' ? 'desktop+mobile pair' : 'single asset'},
                  but you&rsquo;re currently in{' '}
                  {currentMode === 'desktop-mobile' ? 'desktop+mobile' : 'single-image'} mode.
                  A new asset will be created instead of updating.
                </span>
              </div>
            )}

            {existingLink && !modeMismatch && (
              <div className="slds-form-element slds-m-bottom_medium">
                <label className="slds-checkbox">
                  <input
                    type="checkbox"
                    checked={saveAsNew}
                    onChange={(e) => setSaveAsNew(e.target.checked)}
                    disabled={isUploading}
                  />
                  <span className="slds-checkbox_faux"></span>
                  <span className="slds-form-element__label">
                    Save as a new {existingLink.kind === 'pair' ? 'pair' : 'asset'} instead of updating
                  </span>
                </label>
              </div>
            )}

            {/* Version picker — desktop-mobile mode only */}
            {currentMode === 'desktop-mobile' && (
              <div
                className="slds-form-element slds-m-bottom_medium"
                role="radiogroup"
                aria-label="Versions to upload"
              >
                <label className="slds-form-element__label">Versions to upload</label>
                <div className="slds-form-element__control">
                  <div className="slds-button-group" role="group">
                    {(
                      [
                        { value: 'desktop', label: 'Desktop' },
                        { value: 'mobile', label: 'Mobile' },
                        { value: 'both', label: 'Both' },
                      ] as Array<{ value: VersionChoice; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`slds-button ${
                          versionChoice === opt.value
                            ? 'slds-button_brand'
                            : 'slds-button_neutral'
                        }`}
                        aria-pressed={versionChoice === opt.value}
                        onClick={() => setVersionChoice(opt.value)}
                        disabled={isUploading}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Destination folder */}
            <div className="slds-form-element slds-m-bottom_medium">
              <label className="slds-form-element__label">Destination folder</label>
              <div className="slds-form-element__control">
                {pickedFolder ? (
                  <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center slds-box slds-box_x-small">
                    <span>
                      <SldsIcon
                        name="open_folder"
                        className="slds-icon slds-icon_x-small slds-m-right_x-small"
                      />
                      {pickedFolder.name}
                    </span>
                    <button
                      type="button"
                      className="slds-button slds-button_neutral"
                      onClick={() => setIsBrowserOpen(true)}
                      disabled={effectiveIsUpdate || isUploading}
                    >
                      Change…
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="slds-button slds-button_neutral"
                    onClick={() => setIsBrowserOpen(true)}
                    disabled={isUploading}
                  >
                    <SldsIcon
                      name="open_folder"
                      className="slds-button__icon slds-button__icon_left"
                    />
                    Choose folder…
                  </button>
                )}
                {effectiveIsUpdate && (
                  <div className="slds-form-element__help slds-text-color_weak">
                    Updates stay in the same folder. Tick &ldquo;Save as new&rdquo; to pick a different folder.
                  </div>
                )}
              </div>
            </div>

            {/* Asset name / base name */}
            <div className="slds-form-element slds-m-bottom_medium">
              <label className="slds-form-element__label" htmlFor="sfmc-asset-name">
                {currentMode === 'desktop-mobile' ? 'Base name' : 'Asset name'}
              </label>
              <div className="slds-form-element__control">
                <input
                  id="sfmc-asset-name"
                  type="text"
                  className="slds-input"
                  value={baseName}
                  onChange={(e) => setBaseName(e.target.value)}
                  placeholder={
                    currentMode === 'desktop-mobile'
                      ? 'e.g. spring-promo-hero'
                      : 'e.g. spring-promo-hero'
                  }
                  maxLength={100}
                  disabled={isUploading}
                />
              </div>
              <div className="slds-form-element__help slds-text-color_weak">
                {currentMode === 'desktop-mobile'
                  ? assetNamePreview
                    ? `Will save as: ${assetNamePreview}`
                    : 'Suffixes _desktop / _mobile are added automatically.'
                  : 'A file extension (.png / .jpg) will be added automatically.'}
              </div>
            </div>

            {partialWarning && (
              <div className="slds-notify slds-notify_alert slds-theme_warning" role="alert">
                <span>{partialWarning}</span>
              </div>
            )}
            {error && (
              <div className="slds-notify slds-notify_alert slds-theme_error" role="alert">
                <span>{error}</span>
              </div>
            )}
          </div>

          <footer className="slds-modal__footer">
            <button
              type="button"
              className="slds-button slds-button_neutral"
              onClick={onClose}
              disabled={isUploading}
            >
              {partialWarning ? 'Close' : 'Cancel'}
            </button>
            <button
              type="button"
              className="slds-button slds-button_brand"
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {isUploading
                ? 'Uploading…'
                : effectiveIsUpdate
                ? currentMode === 'desktop-mobile'
                  ? 'Update in SFMC'
                  : 'Update asset in SFMC'
                : 'Upload to SFMC'}
            </button>
          </footer>
        </div>
      </section>
      <div
        className="slds-backdrop slds-backdrop_open"
        onClick={() => {
          if (!isUploading) onClose();
        }}
      ></div>

      <SfmcBrowser
        isOpen={isBrowserOpen}
        onClose={() => setIsBrowserOpen(false)}
        mode="folder"
        onPickFolder={(f) => setPickedFolder(f)}
        title="Choose destination folder"
      />
    </>
  );
}
