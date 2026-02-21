// =====================================================
//  FieldCorrect — Undo/Redo hook
// =====================================================

import { useCallback, useRef, useState } from 'react';

interface UndoEntry {
  type: string;
  entityId: string;
  before: unknown;
  after?: unknown;
}

export function useUndoRedo(maxSize = 50) {
  const undoStack = useRef<UndoEntry[]>([]);
  const redoStack = useRef<UndoEntry[]>([]);
  const [, forceUpdate] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const addUndo = useCallback((entry: UndoEntry) => {
    undoStack.current.push(entry);
    if (undoStack.current.length > maxSize) {
      undoStack.current.shift();
    }
    redoStack.current = [];
    syncFlags();
    forceUpdate((n) => n + 1);
  }, [maxSize, syncFlags]);

  const undo = useCallback((): UndoEntry | null => {
    const entry = undoStack.current.pop();
    if (entry) {
      redoStack.current.push(entry);
      syncFlags();
      forceUpdate((n) => n + 1);
    }
    return entry ?? null;
  }, [syncFlags]);

  const redo = useCallback((): UndoEntry | null => {
    const entry = redoStack.current.pop();
    if (entry) {
      undoStack.current.push(entry);
      syncFlags();
      forceUpdate((n) => n + 1);
    }
    return entry ?? null;
  }, [syncFlags]);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    syncFlags();
    forceUpdate((n) => n + 1);
  }, [syncFlags]);

  return { addUndo, undo, redo, canUndo, canRedo, clear };
}
