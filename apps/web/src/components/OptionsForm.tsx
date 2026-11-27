import type { GameOptions, TableOptions } from '../game/settings.js'

const OPTIONS: { name: keyof GameOptions; label: string; note: string; machine?: boolean }[] = [
  {
    name: 'opponentThinks',
    label: 'The machine takes its time',
    note: 'It pauses before its moves, as a person thinking would. Off, it plays at once — the moves still play out one by one.',
    machine: true,
  },
  {
    name: 'cardGlow',
    label: 'Light up the cards you can complete',
    note: 'While a token hovers over a space, a card it would complete glows; once a card can be scored, it rises with a Score tab, and End turn turns green only when nothing is left to score. The printed game leaves all of it for you to spot: off, End turn does not react to your cards, and turns green only once you have scored both.',
  },
  {
    name: 'showReputation',
    label: 'Show the opponent’s reputation during the game',
    note: 'Their reputation on their plate. Off, it stays a secret until the end; your own always shows.',
  },
  {
    name: 'bagComposition',
    label: 'Show what is left in the bag',
    note: 'Tapping the bag lists the tokens still in it, by type. The count is always shown; this is the counting the printed game leaves to you.',
  },
]

/**
 * The table's options as checkboxes, in the settings dialog: at the front
 * door's cog, where they are set for every game after, and during one. Without `onChange` it is read-only: online,
 * the host chose for both players, and nobody changes them mid-game.
 */
export function OptionsForm<T extends TableOptions & Partial<GameOptions>>({
  options,
  onChange,
}: {
  options: T
  onChange?: (next: T) => void
}) {
  const readOnly = onChange === undefined
  // the machine's own option only where there is a machine: when the record carries it
  const shown = OPTIONS.filter((option) => !option.machine || options.opponentThinks !== undefined)
  return (
    <div className="options-form" data-readonly={readOnly || undefined}>
      {shown.map((option) => (
        <label key={option.name} className="setting">
          <input
            type="checkbox"
            checked={options[option.name] ?? false}
            disabled={readOnly}
            onChange={(event) => onChange?.({ ...options, [option.name]: event.target.checked })}
          />
          <span className="setting-text">
            <span className="setting-name">{option.label}</span>
            <span className="setting-note">{option.note}</span>
          </span>
        </label>
      ))}
    </div>
  )
}
