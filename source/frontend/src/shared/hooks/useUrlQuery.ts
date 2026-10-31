import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

// A list's filters, sort and page live in the URL, not in component state, so that
// - "← Danh sách …" and the browser Back button return to the list exactly as it was left;
// - a filtered list can be bookmarked or sent to a colleague.
// Values equal to the default stay out of the URL; a cleared value that has a default is
// written as an empty parameter so it is not restored on the next read.

export type UrlParamKind = 'string' | 'number' | 'boolean' | 'list';
type Kinds<T> = Partial<Record<keyof T & string, UrlParamKind>>;
type Updater<T> = T | ((current: T) => T);

function decodeValue(raw: string, kind: UrlParamKind): unknown {
  if (raw === '') return undefined;
  switch (kind) {
    case 'number': {
      const value = Number(raw);
      return Number.isFinite(value) ? value : undefined;
    }
    case 'boolean':
      return raw === 'true' ? true : raw === 'false' ? false : undefined;
    case 'list':
      return raw.split(',').filter(Boolean);
    default:
      return raw;
  }
}

function encodeValue(value: unknown): string {
  return Array.isArray(value) ? value.join(',') : String(value);
}

const isEmpty = (value: unknown) =>
  value === undefined ||
  value === null ||
  value === '' ||
  (Array.isArray(value) && value.length === 0);

export function decodeQuery<T extends object>(
  params: URLSearchParams,
  defaults: T,
  kinds: Kinds<T>,
): T {
  const query: Record<string, unknown> = {
    ...(defaults as Record<string, unknown>),
  };
  params.forEach((raw, key) => {
    const kind = kinds[key as keyof T & string] ?? 'string';
    query[key] = decodeValue(raw, kind);
  });
  return query as T;
}

export function encodeQuery<T extends object>(
  query: T,
  defaults: T,
): URLSearchParams {
  const params = new URLSearchParams();
  const fallback = defaults as Record<string, unknown>;
  for (const [key, value] of Object.entries(query)) {
    const initial = fallback[key];
    if (isEmpty(value)) {
      if (!isEmpty(initial)) params.set(key, '');
      continue;
    }
    if (encodeValue(value) === (isEmpty(initial) ? null : encodeValue(initial)))
      continue;
    params.set(key, encodeValue(value));
  }
  return params;
}

const NO_KINDS = {};

// `defaults` and `kinds` must be module constants (stable between renders).
export function useUrlQuery<T extends object>(
  defaults: T,
  kinds: Kinds<T> = NO_KINDS,
): [T, (next: Updater<T>) => void] {
  const [params, setParams] = useSearchParams();
  const query = useMemo(
    () => decodeQuery(params, defaults, kinds),
    [params, defaults, kinds],
  );
  const setQuery = useCallback(
    (next: Updater<T>) =>
      setParams(
        (previous) => {
          const current = decodeQuery(previous, defaults, kinds);
          const resolved =
            typeof next === 'function'
              ? (next as (current: T) => T)(current)
              : next;
          return encodeQuery(resolved, defaults);
        },
        { replace: true },
      ),
    [setParams, defaults, kinds],
  );
  return [query, setQuery];
}
