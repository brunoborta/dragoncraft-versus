/**
 * The game's name, over the blurred greenhouse, on the screens before a game:
 * choosing the opponent, the PIN lobby, a closed room. Not in the game itself,
 * where every pixel above the board is board or plate.
 */
export function Brand() {
  return (
    <p className="brand" aria-hidden="true">
      <span>Dragoncraft</span>
      <span>Versus</span>
    </p>
  )
}
