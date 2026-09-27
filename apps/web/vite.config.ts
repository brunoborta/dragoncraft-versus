import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * The built site is served from a subpath on GitHub Pages, but the dev server
 * stays at the root — the URL you open on a phone over the LAN is just the
 * host, with nothing to remember after it.
 */
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/dragoncraft-versus/' : '/',
  plugins: [react()],
}))
