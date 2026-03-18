import { useState, useCallback } from 'react';

const MAX_HISTORY = 50;

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useUndoRedo<T>(initialState: T) {
  const [hist, setHist] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
  });

  const set = useCallback((updater: T | ((prev: T) => T)) => {
    setHist(h => {
      const next = typeof updater === 'function'
        ? (updater as (prev: T) => T)(h.present)
        : updater;
      if (next === h.present) return h;
      return {
        past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setHist(h => {
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHist(h => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
      };
    });
  }, []);

  const canUndo = hist.past.length > 0;
  const canRedo = hist.future.length > 0;

  return { state: hist.present, set, undo, redo, canUndo, canRedo } as const;
}
