/**
 * Where the online game lives, or nowhere. Set at build time by
 * `VITE_SERVER_URL`; without it the site is exactly the one-player game it
 * was, and the option to play a friend is not shown.
 */
export function serverUrl(): string | null {
  const raw = import.meta.env.VITE_SERVER_URL as string | undefined
  if (!raw) return null
  return toSocketUrl(raw)
}

/** `https://host` → `wss://host`, so the variable can hold the address you would type in a browser. */
export function toSocketUrl(url: string): string {
  return url.replace(/^http/, 'ws')
}
