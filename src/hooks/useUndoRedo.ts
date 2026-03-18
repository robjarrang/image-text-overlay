import { useState, useCallback, useRef, useEffect } from 'react';

const MAX_HISTORY = 50;
const DEBOUNCE_MS = 500;

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
  /** Snapshot of state before the current batch of rapid changes */
  batch: T | null;
}

export function useUndoRedo<T>(initialState: T) {
  const [hist, setHist] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: [],
    batch: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const set = useCallback((updater: T | ((prev: T) => T)) => {
    setHist(h => {
      const next = typeof updater === 'function'
        ? (updater as (prev: T) => T)(h.present)
        : updater;
      if (next === h.present) return h;
      return {
        ...h,
        present: next,
        future: [],
        // Capture the state before this batch of rapid changes
        batch: h.batch ?? h.present,
      };
    });

    // Debounce: commit the batch to the undo stack after a pause
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setHist(h => {
        if (h.batch === null) return h;
        return {
          ...h,
          past: [...h.past.slice(-(MAX_HISTORY - 1)), h.batch],
          batch: null,
        };
      });
    }, DEBOUNCE_MS);
  }, []);

  const undo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHist(h => {
      // If there's an uncommitted batch, revert to the batch start
      if (h.batch !== null) {
        return {
          ...h,
          present: h.batch,
          future: [h.present, ...h.future],
          batch: null,
        };
      }
      if (h.past.length === 0) return h;
      return {
        past: h.past.slice(0, -1),
        present: h.past[h.past.length - 1],
        future: [h.present, ...h.future],
        batch: null,
      };
    });
  }, []);

  const redo = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setHist(h => {
      if (h.future.length === 0) return h;
      return {
        past: [...h.past, h.present],
        present: h.future[0],
        future: h.future.slice(1),
        batch: null,
      };
    });
  }, []);

  const canUndo = hist.past.length > 0 || hist.batch !== null;
  const canRedo = hist.future.length > 0;

  return { state: hist.present, set, undo, redo, canUndo, canRedo } as const;
}
