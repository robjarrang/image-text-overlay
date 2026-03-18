import { useCallback, useRef, useState } from 'react';

const MAX_HISTORY = 50;

export function useUndoRedo<T>(initialState: T) {
  const presentRef = useRef<T>(initialState);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  // Render trigger — incrementing this forces a re-render so the
  // component sees updated canUndo / canRedo / state values.
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender(n => n + 1), []);

  const set = useCallback((updater: T | ((prev: T) => T)) => {
    const prev = presentRef.current;
    const next = typeof updater === 'function'
      ? (updater as (prev: T) => T)(prev)
      : updater;
    if (Object.is(next, prev)) return;
    pastRef.current = [...pastRef.current.slice(-(MAX_HISTORY - 1)), prev];
    futureRef.current = [];
    presentRef.current = next;
    rerender();
  }, [rerender]);

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (past.length === 0) return;
    futureRef.current = [presentRef.current, ...futureRef.current];
    presentRef.current = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    rerender();
  }, [rerender]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (future.length === 0) return;
    pastRef.current = [...pastRef.current, presentRef.current];
    presentRef.current = future[0];
    futureRef.current = future.slice(1);
    rerender();
  }, [rerender]);

  return {
    state: presentRef.current,
    set,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  } as const;
}
