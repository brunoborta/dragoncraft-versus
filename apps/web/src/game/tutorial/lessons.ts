import { INNER_RING, key } from '@dcv/engine'
import type { Action, DragonType, HexKey } from '@dcv/engine'
import type { MaplePose } from '../../art/poses.js'
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
// the flame stays on screen, but only Skip is lit: it is the one thing asked
const skipFire = (text: string): Step => ({ ...doIt(text, [SPOT.skip], skip), show: [{ type: 'fireUp' }] }) as Step
const scoreIt = (cardId: string, text: string): Step => doIt(text, [SPOT.card(cardId)], score(cardId))
const maple = (action: Action, ...spots: string[]): Step => ({ kind: 'play', action, spots })
/** Maple's pose for a line: the cards when he talks about cards, the scroll for the log… */
const as = (pose: MaplePose, step: Step): Step => ({ ...step, pose }) as Step
/**
 * Where the game itself already shows what to do (the one space ringed, the
 * flame, the Score tab, End turn glowing) nothing is darkened and no ring is
 * drawn. A tap still only meets what the step names.
 */
const plain = (step: Step): Step => ({ ...step, clear: true }) as Step

/** The opening board: one of each type around the centre, as a real game starts. */
const RING: DragonType[] = ['plant', 'iron', 'bread', 'potion', 'meat', 'crystal']
const ringBoard = () => Object.fromEntries(INNER_RING.map((at, i) => [key(at), [RING[i]]]))
const ringStack = key(INNER_RING[0])

const both = (a: string, b: string) => [a, b]

/*
 * The hand is never empty. A lesson with no card of its own to teach holds
 * the cards of the next one that has: the same two from the Bread to the
 * page that finally needs them (4.7), and the Undo lesson's in the one before.
 */
const ON_THE_WAY_TO_4_7 = ['line-iron-iron-plant', 'tri-bread']
const UNDO_HAND = ['line-meat', 'tri-meat']

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
    as('welcoming', say('Ah, a new apprentice! I’m Professor Maple, and this is my greenhouse.')),
    as(
      'feast',
      say('Dragons are picky eaters. Our job is to serve each one its favourite dishes — in just the right arrangement.'),
    ),
    as('thumbs-up', say('Let’s get to the root of it. It’ll only take a few minutes.')),

    as('cards', say('These are your shop cards. Each one shows three tokens in a shape.', SPOT.hand)),
    as(
      'cards',
      say(
        'Make that shape on the board — any rotation will do — and the card is yours. That’s reputation.',
        SPOT.card('tri-crystal'),
      ),
    ),
    say('Reputation lives here. Most reputation at the end wins.', SPOT.yourStar),
    as('thumbs-up', say('That’s the whole game: draw a token, place it, make the shapes on your cards.')),

    say('Nineteen spaces. Every turn you draw one token and put it anywhere there’s room.', SPOT.board),
    as('magnifier', say('Tokens can stack up to three high. Only the top one counts.', SPOT.hex(ringStack))),

    as('thumbs-up', say('This is you. You look good in this picture.', SPOT.yourPlate)),
    say('Your opponent sits up here, with the same three numbers: cards, coins, reputation.', ...both(SPOT.yourPlate, SPOT.opponentPlate)),
    as('cards', say('How many cards you’re holding. Always two at the start of your turn.', ...both(SPOT.yourCards, SPOT.theirCards))),
    as('coin', say('Coins. You start with three. I’ll show you what they buy later.', ...both(SPOT.yourCoins, SPOT.theirCoins))),
    say('And reputation, as promised.', ...both(SPOT.yourStar, SPOT.theirStar)),
    as(
      'thinking',
      say('Some tables hide the opponent’s reputation until the end. You can choose that in the settings.', SPOT.theirStar),
    ),

    say('The bag. Every token you draw comes out of here. The number is how many are left.', SPOT.bag),
    as('cards', say('And the deck, where new cards come from.', SPOT.deck)),
    as('thinking', say('Remember these two. When either one runs out, the game is nearly over.', SPOT.bagAndDeck)),

    as('scroll', say('Everything that happened, move by move, is in the log.', SPOT.log)),
    as('thinking', say('Forgot what a token does? The rules are behind this one.', SPOT.help)),
    { kind: 'do', text: 'Now tap the gear.', spots: [SPOT.settings], expect: [{ ui: { kind: 'openSettings' } }] },
    as('magnifier', say('How the table looks: hints on your cards, the opponent’s reputation, what’s left in the bag. It doesn’t matter for us right now. We will use the default rules here.', SPOT.options)),
    as(
      'surprised',
      say(
        'And if a game goes badly wrong, you can give up here. You have to hold it, so you never do it by accident. But don’t give up! Winners don’t use drugs. And you don’t use drugs, right? Right?',
        SPOT.forfeit,
      ),
    ),
    as('thumbs-up', {
      kind: 'do',
      text: 'Close it, and let’s play.',
      spots: [SPOT.settingsClose],
      expect: [{ ui: { kind: 'closeSettings' } }],
    }),

    say('Changed your mind? Undo takes back your last move, as long as it’s still your turn.', SPOT.undo),
    say('End turn. It stays locked until your token is on the board.', SPOT.endTurn),
    as('thumbs-up', say('It glows gold when you can end, and green when there’s nothing left worth doing.', SPOT.endTurn)),

    as('welcoming', say('Enough talk. I’ll take the other side of the table — let’s learn by playing.')),
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
    say('Every turn starts like this: You drew a token. Here, you drew a Bread.', SPOT.held),
    // what the token does is on it: a tap brings it up, lit while it is up
    as('magnifier', {
      kind: 'do',
      text: 'Tap your token to see what it does.',
      spots: [SPOT.held, SPOT.heldInfo],
      expect: [{ ui: { kind: 'tokenInfo' } }],
    }),
    // in the arch and on the flames a tap chooses: there, a hold tells instead
    // the token and its card lit together, in one box
    as(
      'thumbs-up',
      say(
        'You can check your token like this any time. In a Crystal’s arch or on a flame, a tap chooses, so hold it instead.',
        SPOT.heldAndInfo,
      ),
    ),
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
    maple({ type: 'place', at: hex('-1,2') }),
    maple({ type: 'skipFireUp' }),
    maple({ type: 'endTurn' }),
    as('thumbs-up', say('See? Same thing, my side. Draw, place, maybe fire up, end.')),
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
    as('cards', say('Three Plants in a row. Look at the board…', SPOT.card('line-plant'))),
    plain(putHere('1,1', 'Finish the row.')),
    skipFire('We will fire up later. Tap Skip this time.'),
    as(
      'cards',
      scoreIt(
        'line-plant',
        'When a card’s shape is on the board, it can be scored. One of the settings makes it rise, too. Tap Score to claim it.',
      ),
    ),
    as('thumbs-up', plain(say('Three of a kind is worth 3. A mix of tokens is worth 2.', SPOT.yourStar))),
    as('cards', plain(say('When your turn ends, your hand fills back up to two cards.', SPOT.yourCards))),
    plain(doIt('End your turn.', [SPOT.endTurn], endTurn)),
    as('cards', plain(say('Two cards again. Your turn, my turn, and so on, until the bag or the deck runs out.', SPOT.hand))),
  ],
}

const BREAD: Lesson = {
  id: 'bread',
  act: 2,
  build: () =>
    scenario({ board: { '-1,0': ['iron'], '1,-1': ['meat'] }, held: 'bread', bag: ['potion'], hand: ON_THE_WAY_TO_4_7 }),
  steps: [
    as('feast', plain(say('Bread: when you fire it up, you draw another token and place it.', SPOT.held))),
    plain(putHere('0,0')),
    plain({ ...(fire('bread') as Extract<Step, { kind: 'do' }>), draws: ['potion'] }),
    as(
      'thumbs-up',
      plain(
        say(
          'A second token, same turn. Usually you only play one token a turn, but Bread lets you play another. And that one could fire up too!',
          SPOT.held,
        ),
      ),
    ),
    plain(putHere('0,1')),
    plain(skipFire('Let’s keep it simple and skip this one too.')),
    as('feast', say('Two tokens, one turn. Not bad for a loaf.')),
  ],
}

const CRYSTAL: Lesson = {
  id: 'crystal',
  act: 2,
  build: () =>
    scenario({
      board: { '0,0': ['plant'], '1,0': ['iron'] },
      held: 'crystal',
      bag: ['meat', 'iron', 'plant'],
      hand: ON_THE_WAY_TO_4_7,
    }),
  steps: [
    plain(say('Crystal: draw three, keep the one you like best, place it.', SPOT.held)),
    plain(putHere('-1,1')),
    plain({ ...(fire('crystal') as Extract<Step, { kind: 'do' }>), draws: ['meat', 'iron', 'plant'] }),
    as('magnifier', doIt('Pick one. The other two go back in the bag. Take the Meat.', [SPOT.slot(0)], { type: 'crystalPick', index: 0 })),
    plain(putHere('0,1', 'And put it here.')),
    as('thumbs-up', say('The token you keep doesn’t fire up. Crystals are generous, but not that generous.')),
  ],
}

const MEAT_ALONE: Lesson = {
  id: 'meat-alone',
  act: 2,
  build: () => scenario({ board: { '0,0': ['plant'] }, held: 'meat', hand: ON_THE_WAY_TO_4_7 }),
  steps: [
    as('magnifier', say('One lonely Plant. Let’s give it a ride.', SPOT.hex('0,0'))),
    as('feast', plain(say('Meat: fire it up and you move one neighbour — anywhere on the board.', SPOT.held))),
    plain(putHere('0,1', 'Put the Meat right next to the Plant.')),
    plain(fire('meat')),
    doIt('Pick the Plant up… and drop it all the way over here.', [SPOT.hex('0,0'), SPOT.hex('-2,1')], {
      type: 'meatMove',
      from: hex('0,0'),
      to: hex('-2,1'),
    }),
    as('thumbs-up', say('Anywhere at all. It only has to start next to the Meat.')),
  ],
}

const MEAT_CARD: Lesson = {
  id: 'meat-card',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,2': ['plant'], '1,0': ['iron'], '2,0': ['iron'] },
      held: 'meat',
      hand: ON_THE_WAY_TO_4_7,
    }),
  steps: [
    as(
      'cards',
      say('Your card wants a Plant at the end of those two Irons.', SPOT.card('line-iron-iron-plant'), SPOT.hex('1,0'), SPOT.hex('2,0')),
    ),
    plain(putHere('0,2', 'Put the Meat next to the Plant.')),
    plain(fire('meat', 'Fire it up.')),
    plain(doIt('Now move the Plant.', [SPOT.hex('-1,2'), SPOT.hex('0,0')], { type: 'meatMove', from: hex('-1,2'), to: hex('0,0') })),
    as('thumbs-up', plain(scoreIt('line-iron-iron-plant', 'Moving a token can finish a card just as well as placing one. Score it!'))),
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
    plain(say('Iron: move up to two of its neighbours, one space each.', SPOT.held)),
    plain(putHere('0,0')),
    plain(fire('iron')),
    plain(doIt('Move this Potion one space.', [SPOT.hex('-1,1'), SPOT.hex('0,1')], { type: 'ironMove', from: hex('-1,1'), to: hex('0,1') })),
    plain(doIt('And this one.', [SPOT.hex('1,-1'), SPOT.hex('1,0')], { type: 'ironMove', from: hex('1,-1'), to: hex('1,0') })),
    as('thumbs-up', plain(scoreIt('tri-potion', 'Two different tokens, one step each. Small moves, big difference. Score it!'))),
    as('welcoming', plain({ ...doIt('Now end your turn, and watch me.', [SPOT.endTurn], endTurn), draws: ['meat'] } as Step)),
    maple({ type: 'place', at: hex('2,0') }),
    maple({ type: 'fireUp', ability: 'meat' }),
    maple({ type: 'meatMove', from: hex('1,1'), to: hex('-2,2') }),
    as('portrait', say('Ha! Your opponent can move your tokens too. Keep an eye on me.')),
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
    plain(say('Potion: swap any two tokens on the board. Any two — they don’t have to be near it.', SPOT.held)),
    plain(putHere('0,0')),
    plain(fire('potion')),
    plain(doIt('Swap these two.', [SPOT.hex('1,1'), SPOT.hex('-2,2')], { type: 'potionSwap', a: hex('1,1'), b: hex('-2,2') })),
    as('cards', plain(scoreIt('line-bread', 'Swapped! And look at your card…'))),
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
    plain(say('Plant: it borrows the ability of a neighbour.', SPOT.held)),
    plain(putHere('1,0', 'Put it next to the Meat.')),
    plain(fire('plant', 'Fire it up.')),
    // two pages: the neighbour first, then the flame its tap opens beside it, each marked by the game alone
    plain({ kind: 'do', text: 'Tap the Meat.', spots: [SPOT.hex('2,-1')], expect: [{ ui: { kind: 'select', hex: '2,-1' } }] }),
    plain(doIt('Now tap its flame to borrow its ability.', [SPOT.fire], { type: 'plantTarget', at: hex('2,-1'), ability: 'meat' })),
    plain(
      doIt(
        'The Meat moves one of its own neighbours: bring that Crystal down here.',
        [SPOT.hex('2,-2'), SPOT.hex('1,1')],
        { type: 'meatMove', from: hex('2,-2'), to: hex('1,1') },
      ),
    ),
    as('cards', plain(scoreIt('line-crystal', 'And there’s your card.'))),
    as('thinking', say('A Plant next to a Plant can borrow another Plant… and the chain keeps going. One turn can run a long way.')),
  ],
}

const STACKS: Lesson = {
  id: 'stacks',
  act: 2,
  build: () =>
    scenario({
      board: { '0,0': ['iron', 'bread'], '1,0': ['meat', 'plant', 'potion'], '-1,1': ['crystal'] },
      held: 'iron',
      // the Undo lesson's, a lesson early: the hand is never empty
      hand: UNDO_HAND,
    }),
  steps: [
    as('magnifier', {
      kind: 'do',
      text: 'Tap a stack to see what’s inside.',
      spots: [SPOT.hex('1,0')],
      expect: [{ ui: { kind: 'inspect', hex: '1,0' } }],
    }),
    as('magnifier', say('It opens up here, in the corner: the stack from top to bottom, the top one brightest.', SPOT.peek)),
    as('magnifier', say('Only the top token counts, for cards and for abilities.', SPOT.peek)),
    say('Three is the limit. Nothing more goes on here.', SPOT.hex('1,0'), SPOT.peek),
    // the token rises over a stack: a plain box takes in the space and the token, where a hexagon would cut it
    plain(doIt('But this one has room. Put your token on top.', [SPOT.spaceAndToken('0,0')], place('0,0'))),
    as('thinking', say('Burying a token is a way to get it out of the way: yours or mine.')),
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
    as('magnifier', say('A two-coloured token. It counts as either colour for your cards.', SPOT.held)),
    plain(putHere('1,1', 'Put it here. Your card wants a Plant at the end of the Meats.')),
    as('cards', say('Here it’s the Plant your card wanted.', SPOT.card('line-meat-meat-plant'))),
    // nothing darkened: both flames are there to see, and either would do
    as('magnifier', say('When you fire it up, you pick which of its two abilities to use. Either flame works.')),
    // then only the Meat's answers, named in the line
    plain({
      ...doIt('This time, take the Meat.', [SPOT.flame('meat')], fireUp('meat')),
      show: [{ type: 'fireUp' }],
    } as Step),
    plain(
      doIt('Move that Bread out of the way. Just because.', [SPOT.hex('2,0'), SPOT.hex('-2,2')], {
        type: 'meatMove',
        from: hex('2,0'),
        to: hex('-2,2'),
      }),
    ),
    as('thumbs-up', plain(scoreIt('line-meat-meat-plant', 'Score it!'))),
  ],
}

const UNDO: Lesson = {
  id: 'undo',
  act: 2,
  build: () =>
    scenario({
      board: { '-1,1': ['meat'], '0,1': ['meat'], '1,0': ['meat'] },
      held: 'meat',
      hand: UNDO_HAND,
    }),
  steps: [
    as('thumbs-up', plain(putHere('-2,0', 'Put it here. Trust me.'))),
    // the wrong spot he sent you to
    as('surprised', say('…Hm. That was a terrible spot. My fault.')),
    {
      kind: 'do',
      text: 'Undo takes it back.',
      spots: [SPOT.undo],
      expect: [{ undo: true }],
      // the fire-up question stays on screen, so the turn still reads as yours
      show: [{ type: 'skipFireUp' }, { type: 'fireUp' }],
    },
    plain(putHere('1,1', 'Now put it here.')),
    plain(skipFire('No fire-up this time. We don’t need it.')),
    as('cards', plain(scoreIt('line-meat', 'Look at that! Two cards at once. Score the first…'))),
    as('thumbs-up', plain(scoreIt('tri-meat', '…and the second.'))),
    as(
      'scroll',
      plain(say('Undo works inside your own turn. It can’t take back a draw, or a card you’ve scored.', SPOT.undo)),
    ),
  ],
}

const COINS: Lesson = {
  id: 'coins',
  act: 2,
  build: () =>
    scenario({
      /*
       * One space, 0,1, makes two cards with the Crystal in the tray: with the
       * Crystals at 1,0 and 1,1 it closes a triangle, and after the Breads at
       * -2,1 and -1,1 it ends a Bread, Bread, Crystal line. Nothing is made yet.
       */
      board: { '1,0': ['crystal'], '1,1': ['crystal'], '-2,1': ['bread'], '-1,1': ['bread'] },
      held: 'crystal',
      // the line is in hand already, beside a card with nothing to do here; the coin brings the triangle,
      // and another one with nothing to do: the two to keep are the first and the third of the four
      hand: ['line-bread-bread-crystal', 'line-potion'],
      deck: ['tri-crystal', 'tri-plant', 'line-meat', 'tri-bread', 'line-iron'],
    }),
  steps: [
    as('thinking', say('One of these fits the board. The other is never going to happen.', SPOT.hand)),
    as('coin', doIt('Spend a coin.', [SPOT.coin], { type: 'spendCoin' })),
    as('cards', plain(say('You draw two cards, then choose two to keep. The other two go back under the deck.', SPOT.hand))),
    as('surprised', say('For the Dragon of a Thousand Heads! What a lucky draw!', SPOT.card('tri-crystal'))),
    as(
      'cards',
      say(
        'Your Crystal would finish both of them, right there.',
        SPOT.card('line-bread-bread-crystal'),
        SPOT.card('tri-crystal'),
        SPOT.hex('0,1'),
      ),
    ),
    // the two to keep are the first and the third of the four: apart in the fan, so their spotlights never overlap
    as('cards', {
      kind: 'do',
      text: 'Keep those two: tap them.',
      spots: [SPOT.card('line-bread-bread-crystal'), SPOT.card('tri-crystal')],
      expect: [{ ui: { kind: 'keep', cards: ['line-bread-bread-crystal', 'tri-crystal'] } }],
    }),
    // the button that confirms, not the bar it sits in — and the two cards it keeps, lit and still
    as(
      'thumbs-up',
      doIt(
        'Now confirm.',
        [SPOT.confirm, SPOT.still(SPOT.card('line-bread-bread-crystal')), SPOT.still(SPOT.card('tri-crystal'))],
        { type: 'coinDiscard', cardIds: ['line-potion', 'tri-plant'] },
      ),
    ),
    // the payoff: the Crystal goes where both cards wanted it
    plain(putHere('0,1', 'Now put your Crystal here.')),
    plain(skipFire('No fire-up this time.')),
    as('feast', plain(scoreIt('line-bread-bread-crystal', 'Both of them! Score the line…'))),
    as('thumbs-up', plain(scoreIt('tri-crystal', '…and the triangle. One coin, two cards.'))),
    as(
      'coin',
      plain(say('Once a turn, at most. And every coin you still hold at the end is worth 1 reputation, so don’t splash them around.', SPOT.coin)),
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
    as('magnifier', say('Only two tokens left in the bag. Watch closely.', SPOT.bag)),
    plain(putHere('-1,2', 'Put the Crystal here.')),
    plain({ ...(fire('crystal', 'And fire it up.') as Extract<Step, { kind: 'do' }>), draws: ['meat', 'plant'] }),
    as('surprised', say('That’s it! The bag ran out, so this is the final round. See the cross on it?', SPOT.bag)),
    say('My Crystal still needed one more, so six spare tokens were poured in, just to finish the draw. The end is still coming.', SPOT.bag),
    doIt('Keep the Meat.', [SPOT.slot(0)], { type: 'crystalPick', index: 0 }),
    plain(putHere('1,1')),
    as('thumbs-up', plain(scoreIt('line-meat', 'Score it.'))),
    as('cards', say('The deck works the same way: the moment its last card is drawn, the end begins.', SPOT.deck)),
    plain(doIt('End your turn.', [SPOT.endTurn], endTurn)),
    as('thinking', say('Now I get one last chance: I can score and spend a coin, but I can’t place anything.')),
    maple({ type: 'scoreCard', cardId: 'tri-iron' }),
    maple({ type: 'endTurn' }),
    as('coin', say('Most reputation wins. Unspent coins count now, one each. If it’s a tie, whoever scored more cards wins.')),
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
  DUAL,
  STACKS,
  UNDO,
  COINS,
  THE_END,
]
