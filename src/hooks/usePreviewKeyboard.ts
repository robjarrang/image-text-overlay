import { useEffect } from 'react';

interface PreviewKeyboardHandlers {
  onReset?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
}

export function usePreviewKeyboard({ onReset, onDownload, onShare }: PreviewKeyboardHandlers) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Reset view with 'R'
      if (e.key === 'r' && !e.ctrlKey && !e.altKey && onReset) {
        e.preventDefault();
        onReset();
      }
      // Download with Cmd/Ctrl + S
      else if (e.key === 's' && (e.ctrlKey || e.metaKey) && onDownload) {
        e.preventDefault();
        onDownload();
      }
      // Share with Cmd/Ctrl + Shift + S
      else if (e.key === 's' && (e.ctrlKey || e.metaKey) && e.shiftKey && onShare) {
        e.preventDefault();
        onShare();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onReset, onDownload, onShare]);
}