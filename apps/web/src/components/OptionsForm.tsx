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
    label: 'Light up the card a space completes',
    note: 'While a token hovers over a space, a card in your hand it would complete glows. The printed game leaves that for you to spot.',
  },
  {
    name: 'showReputation',
    label: 'Show reputation during the game',
    note: 'Both players’ reputation on their plates. Off, it is only revealed at the end.',
  },
  {
    name: 'bagComposition',
    label: 'Show what is left in the bag',
    note: 'Tapping the bag lists the tokens still in it, by type. The count is always shown; this is the counting the printed game leaves to you.',
  },
]

/**
 * The table's options as checkboxes. Used on the screen before a game and in
 * the settings dialog during one. Without `onChange` it is read-only: online,
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
