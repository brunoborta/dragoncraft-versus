/**
 * The front door's pictures, each made twice by scripts/art.mjs: AVIF, the
 * lighter, and WebP for the browsers that cannot read it (iOS 14 and 15).
 */
const FILES = import.meta.glob<string>('../assets/art/{bg-menu,logo,menu-*,choice-*}.{avif,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export interface Art {
  avif: string
  webp: string
}

/** Both files of one of the front door's pictures, by name (`menu-play-plate`). */
export function frontArt(name: string): Art {
  const avif = FILES[`../assets/art/${name}.avif`]
  const webp = FILES[`../assets/art/${name}.webp`]
  if (!avif || !webp) throw new Error(`no front door picture called ${name}: run scripts/art.mjs`)
  return { avif, webp }
}

/**
 * A picture in AVIF where the browser reads it, else in WebP: each device
 * fetches only the one it takes. The wrapper takes no box of its own (styles
 * see only the image), so the image is placed as if it stood alone.
 */
export function Picture({ art, className }: { art: Art; className?: string }) {
  return (
    <picture className="picture">
      <source srcSet={art.avif} type="image/avif" />
      <img className={className} src={art.webp} alt="" draggable={false} />
    </picture>
  )
}
