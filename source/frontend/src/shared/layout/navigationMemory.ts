// Remembers the last full URL (path + query) the user had open for each path, so a back link
// returns to the list exactly as it was left: same filters, search and page.
// Memory only lives for the tab session; a fresh load falls back to the plain path.

const lastSearchByPath = new Map<string, string>();

export function rememberLocation(pathname: string, search: string) {
  lastSearchByPath.set(pathname, search);
}

// `to` may carry its own query; that wins over the remembered one.
export function resolveBackTarget(to: string): string {
  if (to.includes('?')) return to;
  const search = lastSearchByPath.get(to);
  return search ? `${to}${search}` : to;
}

export function clearNavigationMemory() {
  lastSearchByPath.clear();
}
