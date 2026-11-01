import { Input } from 'antd';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

interface SearchInputProps {
  value: string | undefined;
  onCommit: (value: string | undefined) => void;
  placeholder?: string;
  ariaLabel?: string;
  delayMs?: number;
  style?: CSSProperties;
}

// A search box whose committed value lives elsewhere (usually the URL). The text being typed stays local, so an
// input method (Telex/VNI, which rewrites "Vo" into "Võ" mid-word) never sees its own keystrokes echoed back late
// and doubled. Commits after `delayMs` of quiet, never in the middle of a composition; follows outside changes.
export function SearchInput({
  value,
  onCommit,
  placeholder,
  ariaLabel,
  delayMs = 400,
  style,
}: SearchInputProps) {
  const [text, setText] = useState(value ?? '');
  const composing = useRef(false);
  // Bumped when a composition ends: the text may be unchanged, but the held-back commit must run now.
  const [compositionEnds, setCompositionEnds] = useState(0);
  const committed = useRef(value ?? '');

  useEffect(() => {
    const outside = value ?? '';
    if (outside !== committed.current) {
      committed.current = outside;
      setText(outside);
    }
  }, [value]);

  useEffect(() => {
    if (composing.current) return;
    const next = text.trim();
    if (next === committed.current) return;
    const timer = setTimeout(() => {
      committed.current = next;
      onCommit(next || undefined);
    }, delayMs);
    return () => clearTimeout(timer);
  }, [text, delayMs, onCommit, compositionEnds]);

  return (
    <Input.Search
      aria-label={ariaLabel}
      placeholder={placeholder}
      allowClear
      value={text}
      style={style}
      onChange={(event) => setText(event.target.value)}
      onCompositionStart={() => {
        composing.current = true;
      }}
      onCompositionEnd={(event) => {
        composing.current = false;
        setText(event.currentTarget.value);
        setCompositionEnds((count) => count + 1);
      }}
      onSearch={(next) => {
        committed.current = next.trim();
        onCommit(next.trim() || undefined);
      }}
    />
  );
}
