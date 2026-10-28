import { useCallback, useEffect, useRef, useState } from 'react';

// Key for a tab editor that restarts from server data. A save remounts it at once, but the refetched
// revision can land a render later, so a clean editor also restarts when the revision changes;
// a dirty one keeps what was typed, which is what a stale refusal promises.
export function useEditorRemountKey(
  syllabusId: string,
  updatedAt: string,
  onDirtyChange?: (dirty: boolean) => void,
) {
  const [generation, setGeneration] = useState(0);
  const [revision, setRevision] = useState(updatedAt);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current && updatedAt !== revision) setRevision(updatedAt);
  }, [updatedAt, revision]);

  const trackDirty = useCallback(
    (next: boolean) => {
      dirty.current = next;
      onDirtyChange?.(next);
    },
    [onDirtyChange],
  );
  const restart = useCallback(() => {
    dirty.current = false;
    setGeneration((value) => value + 1);
  }, []);

  return {
    key: `${syllabusId}:${revision}:${generation}`,
    trackDirty,
    restart,
  };
}
