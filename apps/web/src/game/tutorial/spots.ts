import type { HexKey } from '@dcv/engine'

/**
 * Where the spotlight can open, as CSS selectors on the real game screen. Every
 * match of a selector gets its own hole, so `fire` lights each flame and the
 * skip beside them, and a pair of selectors lights both plates at once.
 */
const stat = (side: 'top-bar' | 'player-bar', nth: number) => `.${side} .plate-stats > .stat:nth-child(${nth})`

export const SPOT = {
  hex: (at: HexKey) => `[data-hex="${at}"]`,
  card: (id: string) => `[data-card="${id}"]`,
  slot: (index: number) => `.crystal-slot[data-slot="${index}"]`,
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
  fire: '.fire-slot',
  prompt: '.prompt',
  arch: '.crystal-arch',
} as const
