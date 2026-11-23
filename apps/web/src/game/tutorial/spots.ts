import type { HexKey } from '@dcv/engine'

/**
 * Where the spotlight can open, as CSS selectors on the real game screen. Every
 * match of a selector gets its own hole, so `fire` lights each flame and the
 * skip beside them, and a pair of selectors lights both plates at once.
 */
const stat = (side: 'top-bar' | 'player-bar', nth: number) => `.${side} .plate-stats > .stat:nth-child(${nth})`

/** The mark of a spot that lights several things in one plain box (`SPOT.around`). */
export const AROUND = 'around:'
/** The mark of a spot lit but still: shown, not pointed at — its ring does not breathe (`SPOT.still`). */
export const STILL = 'still:'

export const SPOT = {
  // the space itself (lit as a hexagon): the token hovering over it before it is placed carries the same `data-hex`
  hex: (at: HexKey) => `[data-spot="hex"][data-hex="${at}"]`,
  /** A space and the token hovering over it, in one plain box: for a stack, where the token rises above the space. */
  spaceAndToken: (at: HexKey) => `${AROUND}[data-spot="hex"][data-hex="${at}"]|.token-preview[data-hex="${at}"]`,
  /** The button that confirms a choice in the bar — the button, not the bar. */
  confirm: '.prompt .prompt-actions button',
  card: (id: string) => `[data-card="${id}"]`,
  /** Lit to be seen beside what is to be done, with a still ring: the breathing one says "tap here". */
  still: (spot: string) => `${STILL}${spot}`,
  // the slot's frame, which stays put while its token rises under a hover
  slot: (index: number) => `.crystal-slot-frame:has(> .crystal-slot[data-slot="${index}"])`,
  board: '.board',
  yourPlate: '.player-bar .plate',
  opponentPlate: '.top-bar .plate',
  yourCards: stat('player-bar', 1),
  yourCoins: stat('player-bar', 2),
  yourStar: stat('player-bar', 3),
  theirCards: stat('top-bar', 1),
  theirCoins: stat('top-bar', 2),
  theirStar: stat('top-bar', 3),
  hand: '.hand',
  bag: '.bag',
  deck: '.deck-count',
  /** The bag and the deck together, in one spotlight: the corner that holds both. */
  bagAndDeck: '.bag-corner',
  log: '[data-coach="log"]',
  help: '[data-coach="help"]',
  settings: '[data-coach="settings"]',
  options: '.modal .options-form',
  forfeit: '.modal .forfeit',
  settingsClose: '[data-coach="settings-close"]',
  undo: '.undo-button',
  endTurn: '.end-turn',
  coin: '.coin-purse',
  held: '.held-slot[data-side="you"]',
  /** The card that comes up over your token while it is held: what it does. */
  heldInfo: '.held-slot[data-side="you"] .token-info',
  /** Your token and the card over it, in one plain box. */
  heldAndInfo: `${AROUND}.held-slot[data-side="you"]|.held-slot[data-side="you"] .token-info`,
  fire: '.fire-slot',
  /** Only the Skip beside the flames, when skipping is what is asked. */
  skip: '.fire-skip',
  /** One flame of several — a dual's, say — by the ability it fires. */
  flame: (ability: string) => `.fire-slot:has(> .fire-up[data-ability="${ability}"])`,
  prompt: '.prompt',
  arch: '.crystal-arch',
  /** What a tapped stack holds, in the board's corner. */
  peek: '.stack-peek',
} as const
