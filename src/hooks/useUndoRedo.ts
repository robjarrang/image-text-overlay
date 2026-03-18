import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

export function useUndoRedo<T>(initialState: T) {
  const [state, setState] = useState<T>(initialState);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  // Wrap setState to push current state onto the undo stack
  const set = useCallback((updater: T | ((prev: T) => T)) => {
    setState(prev => {
      const next = typeof updater === 'function' ? (updater as (prev: T) => T)(prev) : updater;
      // Only record history if the state actually changed
      if (next !== prev) {
        pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
        futureRef.current = [];
      }
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setState(prev => {
      if (pastRef.current.length === 0) return prev;
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [...futureRef.current, prev];
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setState(prev => {
      if (futureRef.current.length === 0) return prev;
      const next = futureRef.current[futureRef.current.length - 1];
      futureRef.current = futureRef.current.slice(0, -1);
      pastRef.current = [...pastRef.current, prev];
      return next;
    });
  }, []);

  const canUndo = pastRef.current.length > 0;
  const canRedo = futureRef.current.length > 0;

  return { state, set, undo, redo, canUndo, canRedo } as const;
}
