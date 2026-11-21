import { INNER_RING, key } from '@dcv/engine'
import type { Action, DragonType, HexKey } from '@dcv/engine'
import { scenario } from './scenario.js'
import type { Lesson, Step } from './script.js'
import { SPOT } from './spots.js'

/*
 * Professor Maple's lesson (spec docs/specs/2026-11-21-tutorial-design.md,
 * "Roteiro"). Every board is built by hand and every draw is rigged: nothing
 * in here is random. Spaces are axial `q,r`; `r` grows down the screen, so the
 * lessons keep their play in the middle and the lower half, under the ribbon.
 */

const hex = (at: HexKey) => {
  const [q, r] = at.split(',').map(Number)
  return { q, r }
}
const place = (at: HexKey): Partial<Action> => ({ type: 'place', at: hex(at) })
const fireUp = (ability: DragonType): Partial<Action> => ({ type: 'fireUp', ability })
const score = (cardId: string): Partial<Action> => ({ type: 'scoreCard', cardId })
const skip: Partial<Action> = { type: 'skipFireUp' }
const endTurn: Partial<Action> = { type: 'endTurn' }

const say = (text: string, ...spots: string[]): Step => ({ kind: 'say', text, spots })
const doIt = (text: string, spots: string[], ...actions: Partial<Action>[]): Step => ({
  kind: 'do',
  text,
  spots,
  expect: actions.map((action) => ({ action })),
})
const putHere = (at: HexKey, text = 'Put it here.'): Step => doIt(text, [SPOT.hex(at)], place(at))
const fire = (ability: DragonType, text = 'Fire it up!'): Step => doIt(text, [SPOT.fire], fireUp(ability))
const skipFire = (text: string): Step => ({ ...doIt(text, [SPOT.fire], skip), show: [{ type: 'fireUp' }] }) as Step
const scoreIt = (cardId: string, text: string): Step => doIt(text, [SPOT.card(cardId)], score(cardId))
const maple = (action: Action, ...spots: string[]): Step => ({ kind: 'play', action, spots })

/** The opening board: one of each type around the centre, as a real game starts. */
const RING: DragonType[] = ['plant', 'iron', 'bread', 'potion', 'meat', 'crystal']
const ringBoard = () => Object.fromEntries(INNER_RING.map((at, i) => [key(at), [RING[i]]]))
const ringStack = key(INNER_RING[0])

const both = (a: string, b: string) => [a, b]

export const CLASS: Lesson = {
  id: 'class',
  act: 1,
  idle: { type: 'place' },
  build: () =>
    scenario({
      board: ringBoard(),
      held: 'bread',
      hand: ['tri-crystal', 'line-potion'],
      opponentHand: ['line-bread', 'tri-plant'],
    }),
  steps: [
    say('Ah, a new apprentice! I’m Professor Maple, and this is my greenhouse.'),
    say('Dragons are picky eaters. Our job is to serve each one its favourite dishes — in just the right arrangement.'),
    say('Let’s get to the root of it. It’ll only take a few minutes.'),

    say('These are your shop cards. Each one shows three tokens in a shape.', SPOT.hand),
    say(
      'Make that shape on the board — any rotation will do — and the card is yours. That’s reputation.',
      SPOT.card('tri-crystal'),
    ),
    say('Reputation lives here. Most reputation at the end wins.', SPOT.yourStar),
    say('That’s the whole game: draw a token, place it, make the shapes on your cards.'),

    say('Nineteen spaces. Every turn you draw one token and put it anywhere there’s room.', SPOT.board),
    say('Tokens can stack up to three high. Only the top one counts.', SPOT.hex(ringStack)),

    say('This is you. You look good in this picture.', SPOT.yourPlate),
    say('Your opponent sits up here, with the same three numbers: cards, coins, reputation.', ...both(SPOT.yourPlate, SPOT.opponentPlate)),
    say('How many cards you’re holding. Always two at the start of your turn.', ...both(SPOT.yourCards, SPOT.theirCards)),
    say('Coins. You start with three. I’ll show you what they buy later.', ...both(SPOT.yourCoins, SPOT.theirCoins)),
    say('And reputation, as promised.', ...both(SPOT.yourStar, SPOT.theirStar)),
    say('Some tables hide the opponent’s reputation until the end. You can choose that in the settings.', SPOT.theirStar),

    say('The bag. Every token you draw comes out of here. The number is how many are left.', SPOT.bag),
    say('And the deck, where new cards come from.', SPOT.deck),
    say('Remember these two. When either one runs out, the game is nearly over.', SPOT.bag, SPOT.deck),

    say('Everything that happened, move by move, is in the log.', SPOT.log),
    say('Forgot what a token does? The rules are behind this one.', SPOT.help),
    { kind: 'do', text: 'Now tap the gear.', spots: [SPOT.settings], expect: [{ ui: { kind: 'openSettings' } }] },
    say('How the table looks: hints on your cards, the opponent’s reputation, what’s left in the bag.', SPOT.options),
    say(
      'And if a game goes badly wrong, you can give up here. You have to hold it, so you never do it by accident. But don’t give up! Winners don’t use drugs. And you don’t use drugs, right? Right?',
      SPOT.forfeit,
    ),
    { kind: 'do', text: 'Close it, and let’s play.', spots: [SPOT.settingsClose], expect: [{ ui: { kind: 'closeSettings' } }] },

    say('Changed your mind? Undo takes back your last move, as long as it’s still your turn.', SPOT.undo),
    say('End turn. It stays locked until your token is on the board.', SPOT.endTurn),
    say('It glows gold when you can end, and green when there’s nothing left worth doing.', SPOT.endTurn),

    say('Enough talk. I’ll take the other side of the table — let’s learn by playing.'),
  ],
}

const FIRST_TURN: Lesson = {
  id: 'first-turn',
  act: 2,
  build: () =>
    scenario({
      board: ringBoard(),
      held: 'bread',
      bag: ['iron'],
      hand: ['tri-crystal', 'line-potion'],
      opponentHand: ['line-bread', 'tri-plant'],
    }),
  steps: [
    say('You drew a Bread. Every turn starts like this.', SPOT.held),
    putHere('1,1'),
    say('Each token you place may fire up its ability, once. We’ll try that soon — for now, skip it.', SPOT.fire),
    {
      kind: 'do',
      text: 'Tapping End turn skips it and ends your turn — and my turn starts!',
      spots: [SPOT.endTurn],
      expect: [{ action: skip }, { action: endTurn }],
      show: [{ type: 'fireUp' }],
      draws: ['iron'],
    },
    maple({ type: 'place', at: hex('-1,2') }, SPOT.hex('-1,2')),
    maple({ type: 'skipFireUp' }),
    maple({ type: 'endTurn' }),
    say('See? Same thing, my side. Draw, place, maybe fire up, end.'),
  ],
}

const SCORING: Lesson = {
  id: 'scoring',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['plant'], '0,1': ['plant'], '0,-1': ['iron'], '-1,0': ['bread'] },
      held: 'plant',
      hand: ['line-plant', 'tri-bread'],
    }),
  steps: [
    say('Three Plants in a row. Look at the board…', SPOT.card('line-plant')),
    putHere('1,1', 'Finish the row.'),
    skipFire('No need to fire it up this time. Tap Skip.'),
    scoreIt(
      'line-plant',
      'When a card’s shape is on the board, it can be scored. One of the settings makes it rise, too. Tap Score to claim it.',
    ),
    say('Three of a kind is worth 3. A mix of tokens is worth 2.', SPOT.yourStar),
    say('When your turn ends, your hand fills back up to two cards.', SPOT.yourCards),
    doIt('End your turn.', [SPOT.endTurn], endTurn),
    say('Two cards again. Your turn, my turn, and so on, until the bag or the deck runs out.', SPOT.hand),
  ],
}

const BREAD: Lesson = {
  id: 'bread',
  act: 2,
  build: () => scenario({ board: { '-1,0': ['iron'], '1,-1': ['meat'] }, held: 'bread', bag: ['potion'] }),
  steps: [
    say('Bread: when you fire it up, you draw another token and place it.', SPOT.held),
    putHere('0,0'),
    { ...(fire('bread') as Extract<Step, { kind: 'do' }>), draws: ['potion'] },
    say(
      'A second token, same turn. Usually you only play one token a turn, but Bread lets you play another. And that one could fire up too!',
      SPOT.held,
    ),
    putHere('0,1'),
    skipFire('Let’s keep it simple and skip this one.'),
    say('Two tokens, one turn. Not bad for a loaf.'),
  ],
}

const CRYSTAL: Lesson = {
  id: 'crystal',
  act: 2,
  build: () =>
    scenario({ board: { '0,0': ['plant'], '1,0': ['iron'] }, held: 'crystal', bag: ['meat', 'iron', 'plant'] }),
  steps: [
    say('Crystal: draw three, keep the one you like best, place it.', SPOT.held),
    putHere('-1,1'),
    { ...(fire('crystal') as Extract<Step, { kind: 'do' }>), draws: ['meat', 'iron', 'plant'] },
    doIt('Pick one. The other two go back in the bag. Take the Meat.', [SPOT.slot(0)], { type: 'crystalPick', index: 0 }),
    putHere('0,1', 'And put it here.'),
    say('The token you keep doesn’t fire up. Crystals are generous, but not that generous.'),
  ],
}

const MEAT_ALONE: Lesson = {
  id: 'meat-alone',
  act: 2,
  build: () => scenario({ board: { '0,0': ['plant'] }, held: 'meat' }),
  steps: [
    say('One lonely Plant. Let’s give it a ride.', SPOT.hex('0,0')),
    say('Meat: fire it up and you move one neighbour — anywhere on the board.', SPOT.held),
    putHere('0,1', 'Put the Meat right next to the Plant.'),
    fire('meat'),
    doIt('Pick the Plant up… and drop it all the way over here.', [SPOT.hex('0,0'), SPOT.hex('-2,1')], {
      type: 'meatMove',
      from: hex('0,0'),
      to: hex('-2,1'),
    }),
    say('Anywhere at all. It only has to start next to the Meat.'),
  ],
}

const MEAT_CARD: Lesson = {
  id: 'meat-card',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,2': ['plant'], '1,0': ['iron'], '2,0': ['iron'] },
      held: 'meat',
      hand: ['line-iron-iron-plant', 'tri-bread'],
    }),
  steps: [
    say(
      'Your card wants a Plant at the end of those two Irons.',
      SPOT.card('line-iron-iron-plant'),
      SPOT.hex('1,0'),
      SPOT.hex('2,0'),
    ),
    putHere('0,2', 'Put the Meat next to the Plant.'),
    fire('meat', 'Fire it up.'),
    doIt('Now move the Plant.', [SPOT.hex('-1,2'), SPOT.hex('0,0')], { type: 'meatMove', from: hex('-1,2'), to: hex('0,0') }),
    scoreIt('line-iron-iron-plant', 'Moving a token can finish a card just as well as placing one. Score it!'),
  ],
}

const IRON: Lesson = {
  id: 'iron',
  act: 2,
  build: () =>
    scenario({
      board: { '1,1': ['potion'], '-1,1': ['potion'], '1,-1': ['potion'] },
      held: 'iron',
      bag: ['meat'],
      hand: ['tri-potion', 'line-bread'],
    }),
  steps: [
    say('Iron: move up to two of its neighbours, one space each.', SPOT.held),
    putHere('0,0'),
    fire('iron'),
    doIt('Move this Potion one space.', [SPOT.hex('-1,1'), SPOT.hex('0,1')], { type: 'ironMove', from: hex('-1,1'), to: hex('0,1') }),
    doIt('And this one.', [SPOT.hex('1,-1'), SPOT.hex('1,0')], { type: 'ironMove', from: hex('1,-1'), to: hex('1,0') }),
    scoreIt('tri-potion', 'Two different tokens, one step each. Small moves, big difference. Score it!'),
    { ...doIt('Now end your turn, and watch me.', [SPOT.endTurn], endTurn), draws: ['meat'] } as Step,
    maple({ type: 'place', at: hex('2,0') }, SPOT.hex('2,0')),
    maple({ type: 'fireUp', ability: 'meat' }),
    maple({ type: 'meatMove', from: hex('1,1'), to: hex('-2,2') }, SPOT.hex('1,1'), SPOT.hex('-2,2')),
    say('Ha! Your opponent can move your tokens too. Keep an eye on me.'),
  ],
}

const POTION: Lesson = {
  id: 'potion',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['bread'], '0,1': ['bread'], '1,1': ['plant'], '-2,2': ['bread'] },
      held: 'potion',
      hand: ['line-bread', 'tri-meat'],
    }),
  steps: [
    say('Potion: swap any two tokens on the board. Any two — they don’t have to be near it.', SPOT.held),
    putHere('0,0'),
    fire('potion'),
    doIt('Swap these two.', [SPOT.hex('1,1'), SPOT.hex('-2,2')], { type: 'potionSwap', a: hex('1,1'), b: hex('-2,2') }),
    scoreIt('line-bread', 'Swapped! And look at your card…'),
  ],
}

const PLANT: Lesson = {
  id: 'plant',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['crystal'], '0,1': ['crystal'], '2,-1': ['meat'], '2,-2': ['crystal'] },
      held: 'plant',
      hand: ['line-crystal', 'tri-bread'],
    }),
  steps: [
    say('Plant: it borrows the ability of a neighbour.', SPOT.held),
    putHere('1,0', 'Put it next to the Meat.'),
    fire('plant', 'Fire it up.'),
    doIt('Borrow the Meat’s.', [SPOT.hex('2,-1')], { type: 'plantTarget', at: hex('2,-1'), ability: 'meat' }),
    doIt(
      'The Meat moves one of its own neighbours: bring that Crystal down here.',
      [SPOT.hex('2,-2'), SPOT.hex('1,1')],
      { type: 'meatMove', from: hex('2,-2'), to: hex('1,1') },
    ),
    scoreIt('line-crystal', 'And there’s your card.'),
    say('A Plant next to a Plant can borrow another Plant… and the chain keeps going. One turn can run a long way.'),
  ],
}

const STACKS: Lesson = {
  id: 'stacks',
  act: 2,
  build: () =>
    scenario({
      board: { '0,0': ['iron', 'bread'], '1,0': ['meat', 'plant', 'potion'], '-1,1': ['crystal'] },
      held: 'iron',
    }),
  steps: [
    { kind: 'do', text: 'Tap a stack to see what’s inside.', spots: [SPOT.hex('1,0')], expect: [{ ui: { kind: 'inspect', hex: '1,0' } }] },
    say('Only the top token counts, for cards and for abilities.', SPOT.hex('1,0')),
    say('Three is the limit. Nothing more goes on here.', SPOT.hex('1,0')),
    putHere('0,0', 'But this one has room. Put your token on top.'),
    say('Burying a token is a way to get it out of the way — yours or mine.'),
  ],
}

const DUAL: Lesson = {
  id: 'dual',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['meat'], '0,1': ['meat'], '2,0': ['bread'] },
      held: ['plant', 'meat'],
      hand: ['line-meat-meat-plant', 'tri-iron'],
    }),
  steps: [
    say('A two-coloured token. It counts as either colour for your cards.', SPOT.held),
    putHere('1,1', 'Put it here — your card wants a Plant at the end of the Meats.'),
    say('Here it’s the Plant your card wanted.', SPOT.card('line-meat-meat-plant')),
    fire('meat', 'When you fire it up, you pick which of its two abilities to use. Take the Meat.'),
    doIt('Move that Bread out of the way.', [SPOT.hex('2,0'), SPOT.hex('-2,2')], {
      type: 'meatMove',
      from: hex('2,0'),
      to: hex('-2,2'),
    }),
    scoreIt('line-meat-meat-plant', 'Score it!'),
  ],
}

const UNDO: Lesson = {
  id: 'undo',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['meat'], '0,1': ['meat'], '1,0': ['meat'] },
      held: 'meat',
      hand: ['line-meat', 'tri-meat'],
    }),
  steps: [
    putHere('-2,0', 'Put it here. Trust me.'),
    say('…Hm. That was a terrible spot. My fault.'),
    { kind: 'do', text: 'Undo takes it back.', spots: [SPOT.undo], expect: [{ undo: true }] },
    putHere('1,1', 'Now put it here.'),
    skipFire('No fire-up this time.'),
    scoreIt('line-meat', 'Look at that — two cards at once. Score the first…'),
    scoreIt('tri-meat', '…and the second.'),
    say(
      'Undo works inside your own turn. It can’t take back a draw — the bag doesn’t forget — and a card you’ve scored stays scored.',
      SPOT.undo,
    ),
  ],
}

const COINS: Lesson = {
  id: 'coins',
  act: 2,
  build: () =>
    scenario({
      board: { '0,0': ['bread'], '1,0': ['meat'] },
      held: 'iron',
      hand: ['tri-crystal', 'line-potion'],
      deck: ['line-plant', 'tri-iron', 'line-meat', 'tri-bread', 'line-bread'],
    }),
  steps: [
    say('Neither of these is going to happen.', SPOT.hand),
    doIt('Spend a coin.', [SPOT.coin], { type: 'spendCoin' }),
    say('You draw two cards, then choose two to put back under the deck. Hopefully you’ll find something good.', SPOT.hand),
    doIt(
      'Keep the two new ones: tap them, then confirm.',
      [SPOT.card('line-plant'), SPOT.card('tri-iron'), SPOT.prompt],
      { type: 'coinDiscard', cardIds: ['tri-crystal', 'line-potion'] },
    ),
    say(
      'Once a turn, at most. And every coin you still hold at the end is worth 1 reputation — so don’t splash them around.',
      SPOT.coin,
    ),
  ],
}

const THE_END: Lesson = {
  id: 'the-end',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['meat'], '0,1': ['meat'], '0,-1': ['iron'], '1,-1': ['iron'], '0,0': ['iron'] },
      held: 'crystal',
      bag: ['meat', 'plant'],
      filler: 0,
      hand: ['line-meat', 'tri-bread'],
      opponentHand: ['tri-iron', 'line-potion'],
      opponentCoins: 0,
    }),
  steps: [
    say('Only two tokens left in the bag. Watch closely.', SPOT.bag),
    putHere('-1,2', 'Put the Crystal here.'),
    { ...(fire('crystal', 'And fire it up.') as Extract<Step, { kind: 'do' }>), draws: ['meat', 'plant'] },
    say('That’s it — the bag ran out, so this is the last turn of the game.', SPOT.bag),
    say('My Crystal still needed one more, so six spare tokens were poured in — just to finish the draw. The end is still coming.', SPOT.bag),
    doIt('Keep the Meat.', [SPOT.slot(0)], { type: 'crystalPick', index: 0 }),
    putHere('1,1'),
    scoreIt('line-meat', 'Score it.'),
    say('The deck works the same way: the moment its last card is drawn, the end begins.', SPOT.deck),
    doIt('End your turn.', [SPOT.endTurn], endTurn),
    say('Now I get one last chance: I can score and spend a coin, but I can’t place anything.'),
    maple({ type: 'scoreCard', cardId: 'tri-iron' }),
    maple({ type: 'endTurn' }),
    say('Most reputation wins — unspent coins count now, one each. If it’s a tie, whoever scored more cards wins.'),
  ],
}

export const LESSONS: readonly Lesson[] = [
  CLASS,
  FIRST_TURN,
  SCORING,
  BREAD,
  CRYSTAL,
  MEAT_ALONE,
  MEAT_CARD,
  IRON,
  POTION,
  PLANT,
  STACKS,
  DUAL,
  UNDO,
  COINS,
  THE_END,
]
