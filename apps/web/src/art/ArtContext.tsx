import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { CHOSEN_ART } from './chosen.js'

/** Everything raster the game draws, as URLs. */
export type ArtSet = {
  bg: string
  /** The same painting, small and blurred, behind dialogs. */
  bgOverlay: string
  bag: string
  /** The bag with its mouth open, shown while a token comes out. Null until the art exists. */
  bagOpen: string | null
  avatarYou: string
  avatarOpponent: string
  stone: string
  parchment: string
  coin: string
}

const ArtContext = createContext<ArtSet>(CHOSEN_ART)

/**
 * The game reads its art from here and never imports an image itself, so a
 * test or a preview can hand it a different set. The game itself never sets a
 * provider and gets the chosen set.
 */
export function ArtProvider({ art, children }: { art: ArtSet; children: ReactNode }) {
  return <ArtContext.Provider value={art}>{children}</ArtContext.Provider>
}

export function useArt(): ArtSet {
  return useContext(ArtContext)
}

/**
 * The CSS custom properties a screen sets on its root, so the stylesheet can
 * paint backgrounds and surfaces with the art without importing it.
 */
export function artStyle(art: ArtSet): Record<string, string> {
  return {
    '--art-bg': `url("${art.bg}")`,
    '--art-overlay': `url("${art.bgOverlay}")`,
    '--art-parchment': `url("${art.parchment}")`,
  }
}

/**
 * Puts the art's CSS variables on everything inside it. `display: contents`
 * keeps it out of the layout; custom properties still inherit through it.
 */
export function ArtScope({ children }: { children: ReactNode }) {
  const art = useArt()
  return (
    <div className="art-scope" style={artStyle(art)}>
      {children}
    </div>
  )
}
