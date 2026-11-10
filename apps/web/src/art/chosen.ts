/**
 * The art the game ships, as processed by `apps/web/scripts/art.mjs` from the
 * sources in `designs/art/`. Chosen on 2026-11-10 from an A/B of each asset;
 * the foliage for the board corners was dropped altogether.
 */
import avatarOpponent from '../assets/art/avatar-opponent.webp'
import avatarYou from '../assets/art/avatar-you.webp'
import bag from '../assets/art/bag.webp'
import bg from '../assets/art/bg-game.webp'
import bgOverlay from '../assets/art/bg-overlay.webp'
import coin from '../assets/art/coin.webp'
import parchment from '../assets/art/tex-parchment.webp'
import stone from '../assets/art/tex-stone.webp'
import type { ArtSet } from './ArtContext.js'

/**
 * Art that may not exist yet. A glob matches nothing rather than failing the
 * build, so the game runs without it and picks it up once it is processed.
 */
const optional = import.meta.glob('../assets/art/bag-open.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

export const CHOSEN_ART: ArtSet = {
  bg,
  bgOverlay,
  bag,
  bagOpen: optional['../assets/art/bag-open.webp'] ?? null,
  avatarYou,
  avatarOpponent,
  stone,
  parchment,
  coin,
}
