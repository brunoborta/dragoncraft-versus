import { useArt } from '../art/ArtContext.js'

/**
 * A player's portrait: the painted dragons, green and gold for you, crimson for
 * the opponent (plan 3.1: you can tell whose moment it is without reading).
 * Both face right, toward the board, since both plates sit on the left edge.
 * `active` lights the ring — on your side, that is one of the things saying it
 * is your turn.
 */
export function Avatar({ side, active = false }: { side: 'you' | 'opponent'; active?: boolean }) {
  const art = useArt()
  return (
    <span className="avatar" data-side={side} data-active={active || undefined} aria-hidden="true">
      <img src={side === 'you' ? art.avatarYou : art.avatarOpponent} alt="" draggable={false} />
    </span>
  )
}
