import { render } from '@testing-library/react'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import table from '../art/menu-motion.json'
import { MenuScene, nextPlayIn } from './MenuScene.js'
import { Picture, frontArt } from './Picture.js'

describe('MenuScene', () => {
  it('is just the picture when nothing may move, as under test', () => {
    const { container } = render(<MenuScene />)
    expect(container.querySelector('img.menu-scene-art')).not.toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })

  it('has a clip and a mask made for every piece in the table', () => {
    const made = join(__dirname, '../assets/motion')
    for (const piece of table.pieces) {
      expect(existsSync(join(made, `${piece.name}.mp4`)), piece.name).toBe(true)
      expect(existsSync(join(made, `${piece.name}-mask.png`)), piece.name).toBe(true)
    }
  })

  it('plays each piece again about every so often, never all on one beat', () => {
    const piece = { name: 'x', rect: [0, 0, 2, 2], every: 8, jitter: 2 }
    expect(nextPlayIn(piece, () => 0)).toBe(6)
    expect(nextPlayIn(piece, () => 0.5)).toBe(8)
    expect(nextPlayIn(piece, () => 1)).toBe(10)
  })

  it('offers each picture of the front door in AVIF, and in WebP to the browsers that cannot read it', () => {
    for (const name of ['bg-menu', 'logo', 'menu-play-plate', 'menu-play-claw-tl', 'menu-tutorial', 'menu-settings']) {
      const art = frontArt(name)
      expect(art.avif, name).toMatch(/\.avif$/)
      expect(art.webp, name).toMatch(/\.webp$/)
    }
    const { container } = render(<Picture art={frontArt('logo')} className="x" />)
    expect(container.querySelector('source')?.getAttribute('type')).toBe('image/avif')
    expect(container.querySelector('source')?.getAttribute('srcset')).toMatch(/logo\.avif$/)
    // the image itself is the WebP: what a browser falls back on
    expect(container.querySelector('img.x')?.getAttribute('src')).toMatch(/logo\.webp$/)
  })
})
