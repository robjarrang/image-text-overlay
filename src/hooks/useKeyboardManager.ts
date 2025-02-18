import { useEffect } from 'react';

type KeyboardShortcut = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  handler: () => void;
  description: string;
};

export function useKeyboardManager(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          (!shortcut.ctrlKey || (shortcut.ctrlKey && (e.ctrlKey || e.metaKey))) &&
          (!shortcut.altKey || (shortcut.altKey && e.altKey)) &&
          (!shortcut.shiftKey || (shortcut.shiftKey && e.shiftKey))
        ) {
          e.preventDefault();
          shortcut.handler();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

export const defaultShortcuts: KeyboardShortcut[] = [
  {
    key: 'l',
    ctrlKey: true,
    altKey: true,
    handler: () => {}, // Will be overridden by component
    description: 'Align text left'
  },
  {
    key: 'c',
    ctrlKey: true,
    altKey: true,
    handler: () => {},
    description: 'Center text'
  },
  {
    key: 'r',
    ctrlKey: true,
    altKey: true,
    handler: () => {},
    description: 'Align text right'
  },
  {
    key: 's',
    ctrlKey: true,
    handler: () => {},
    description: 'Save/Download image'
  }
];