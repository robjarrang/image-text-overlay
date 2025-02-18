import { useEffect, useCallback } from 'react';

interface KeyboardHandlers {
  onArrowUp?: (e: KeyboardEvent) => void;
  onArrowDown?: (e: KeyboardEvent) => void;
  onArrowLeft?: (e: KeyboardEvent) => void;
  onArrowRight?: (e: KeyboardEvent) => void;
  onCommandS?: (e: KeyboardEvent) => void;
  onCommandD?: (e: KeyboardEvent) => void;
  onQuestionMark?: (e: KeyboardEvent) => void;
}

export function useKeyboardNavigation(handlers: KeyboardHandlers) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle keyboard events when user is typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    const isCommand = e.metaKey || e.ctrlKey;

    switch (e.key) {
      case 'ArrowUp':
        if (handlers.onArrowUp) {
          e.preventDefault();
          handlers.onArrowUp(e);
        }
        break;
      case 'ArrowDown':
        if (handlers.onArrowDown) {
          e.preventDefault();
          handlers.onArrowDown(e);
        }
        break;
      case 'ArrowLeft':
        if (handlers.onArrowLeft) {
          e.preventDefault();
          handlers.onArrowLeft(e);
        }
        break;
      case 'ArrowRight':
        if (handlers.onArrowRight) {
          e.preventDefault();
          handlers.onArrowRight(e);
        }
        break;
      case 's':
        if (isCommand && handlers.onCommandS) {
          e.preventDefault();
          handlers.onCommandS(e);
        }
        break;
      case 'd':
        if (isCommand && handlers.onCommandD) {
          e.preventDefault();
          handlers.onCommandD(e);
        }
        break;
      case '?':
        if (handlers.onQuestionMark) {
          e.preventDefault();
          handlers.onQuestionMark(e);
        }
        break;
    }
  }, [handlers]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}