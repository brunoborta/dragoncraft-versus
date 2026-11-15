/**
 * Where the online game lives, or nowhere. Set at build time by
 * `VITE_SERVER_URL`; without it the site is exactly the one-player game it
 * was, and the option to play a friend is not shown.
 */
export function serverUrl(): string | null {
  const raw = import.meta.env.VITE_SERVER_URL as string | undefined
  if (!raw) return null
  return toSocketUrl(raw, typeof window === 'undefined' ? undefined : window.location.hostname)
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * `https://host` → `wss://host`, so the variable can hold the address you would
 * type in a browser.
 *
 * In development the server is `localhost` — but a phone that opened the site
 * at the computer's LAN address (`http://192.168.1.20:5173`) has a localhost of
 * its own, with no server on it. So a loopback server is looked for on the
 * host the page itself came from, which is the computer both run on.
 */
export function toSocketUrl(url: string, pageHost?: string): string {
  const socket = url.replace(/^http/, 'ws')
  if (!pageHost || LOOPBACK.has(pageHost)) return socket
  try {
    const parsed = new URL(socket)
    if (!LOOPBACK.has(parsed.hostname)) return socket
    parsed.hostname = pageHost
    // URL keeps a trailing slash on a bare host; the variable did not have one
    return url.endsWith('/') ? parsed.toString() : parsed.toString().replace(/\/$/, '')
  } catch {
    return socket
  }
}
