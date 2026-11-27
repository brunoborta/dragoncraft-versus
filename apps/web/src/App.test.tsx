import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'

/** A card from the carousel: a tap brings one from behind to the front, and a tap on the one in front picks it. */
function pick(name: string) {
  const card = screen.getByText(name).closest('button') as HTMLButtonElement
  if (card.getAttribute('aria-current') !== 'true') fireEvent.click(card)
  fireEvent.click(card)
}

/** At the front door: Play, then one of the ways to play it offers. */
function choose(mode: 'Vs. Computer' | 'Vs. Player') {
  fireEvent.click(screen.getByRole('button', { name: 'Play' }))
  pick(mode)
}

/** Back at the front door, with Play to press. */
function atFrontDoor() {
  return screen.getByRole('button', { name: 'Play' })
}

describe('App', () => {
  /**
   * The game opens on a difficulty modal and does not start until it is
   * answered, so every test has to choose an opponent before anything else.
   */
  function startGame(level: 'Easy' | 'Medium' | 'Hard' = 'Easy') {
    const rendered = render(<App seed={2} />)
    choose('Vs. Computer')
    pick(level)
    return rendered
  }

  it('asks where to place the opening token, and shows the token in your tray under the board', () => {
    const { container } = startGame()
    expect(container.querySelector('.prompt-text')?.textContent).toBe('Choose where to place the token')
    // the token being placed has to be on screen, not only in the log: it sits in your tray
    const tray = container.querySelector('.held-slot[data-side="you"]')
    expect(tray?.querySelector('.held-glyph')).not.toBeNull()
    expect(screen.getByRole('img', { name: /^Your token: (Bread|Crystal|Meat|Iron|Potion|Plant)/ })).toBeDefined()
    // and the opponent's slot is there, empty, under their portrait
    expect(container.querySelector('.held-slot[data-side="opponent"]')?.getAttribute('data-empty')).toBe('true')
  })

  it("leaves a ghost of the token in the tray while it hovers over a space, and empties it once placed", () => {
    const { container } = startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(container.querySelector('.held-slot[data-side="you"] .held-glyph')?.hasAttribute('data-away')).toBe(true)
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(container.querySelector('.held-slot[data-side="you"]')?.getAttribute('data-empty')).toBe('true')
  })

  it('hovers the held token over the previewed space', () => {
    const { container } = startGame()
    expect(container.querySelector('.token-preview')).toBeNull()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    // in the overlay, so the space above cannot paint over the hovering token
    const preview = container.querySelector('.board-overlay .token-preview')
    expect(preview?.getAttribute('data-hex')).toBe('2,-2')
  })

  it('marks every legal space', () => {
    startGame()
    const legal = screen.getAllByRole('button').filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(19)
  })

  it('previews on the first tap and commits on the second', () => {
    startGame()
    const target = screen.getByLabelText('2,-2: empty')

    fireEvent.click(target)
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('selected')

    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText('2,-2: empty')).toBeNull()
    expect(screen.getByText('Fire up this token?')).toBeDefined()
  })

  it('asks to fire up on the board, around the token: one fire and Skip, or two fires and Skip for a dual', () => {
    const { container } = startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    const choice = container.querySelector('.board-area .fire-choice')
    const fires = choice?.querySelectorAll('.fire-up') ?? []
    expect(fires.length).toBeGreaterThan(0)
    expect(choice?.getAttribute('data-shape')).toBe(fires.length > 1 ? 'Y' : 'I')
    for (const fire of fires) expect(fire.getAttribute('aria-label')).toMatch(/^Fire up /)
    // and nothing of it in the panel, which is only a reminder now
    expect(container.querySelectorAll('.prompt button')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(container.querySelector('.fire-choice')).toBeNull()
  })

  it('moves the preview when a different space is tapped', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('0,2: empty'))
    expect(screen.getByLabelText('2,-2: empty').getAttribute('data-highlight')).toBe('legal')
    expect(screen.getByLabelText('0,2: empty').getAttribute('data-highlight')).toBe('selected')
  })

  it('offers declining the fire-up as a button', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.getByRole('button', { name: 'Skip' })).toBeDefined()
  })

  it('does not put spatial actions in the decision bar', () => {
    startGame()
    expect(screen.queryByText(/^Place on /)).toBeNull()
  })

  /**
   * Places the opening token onto 1,0, which already holds one, leaving a stack
   * of two. The board starts with a single token on every occupied space, and
   * the inspector only opens once something is actually buried.
   */
  function stackTwoOnInnerRing(): void {
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText(/^1,0: /))
  }

  it('hides the debug hatch unless the URL asks for it', () => {
    startGame()
    expect(screen.queryByText('Win now')).toBeNull()
    expect(screen.queryByText('Lose now')).toBeNull()
    expect(screen.queryByText('Draw now')).toBeNull()
  })

  it('jumps to a finished game you won, one you lost, and one that ended level', () => {
    render(<App seed={2} debug />)
    choose('Vs. Computer')
    pick('Easy')

    fireEvent.click(screen.getByText('Win now'))
    expect(screen.getByText('You win')).toBeDefined()

    fireEvent.click(screen.getByText('Lose now'))
    expect(screen.getByText('You lose')).toBeDefined()

    fireEvent.click(screen.getByText('Draw now'))
    expect(screen.getByText('Shared victory')).toBeDefined()
  })

  it('plays again against the same opponent, on a fresh seed, without asking anything', () => {
    render(<App seed={2} debug />)
    choose('Vs. Computer')
    pick('Easy')
    fireEvent.click(screen.getByText('Win now'))
    expect(screen.getByText('You win')).toBeDefined()

    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    random.mockRestore()

    // no opponent chooser, no result left standing: the same machine, a new game
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    expect(screen.queryByRole('dialog', { name: 'Final score' })).toBeNull()
    expect(screen.getByText('Seed 500000')).toBeDefined()
  })

  it('opens the front door on the logo, Tutorial, Play and the settings', () => {
    render(<App seed={2} />)
    expect(screen.getByRole('img', { name: 'Dragoncraft Versus' })).toBeDefined()
    const menu = screen.getByRole('navigation', { name: 'Main menu' })
    expect(within(menu).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent)).toEqual([
      'Tutorial',
      'Play',
      'Settings',
    ])
    // the settings are the table's, kept for the next game
    fireEvent.click(within(menu).getByRole('button', { name: 'Settings' }))
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()

    // Play's window opens over them: they stay in sight, but out of reach until it closes
    fireEvent.click(within(menu).getByRole('button', { name: 'Play' }))
    expect(screen.getByRole('dialog', { name: 'Choose your opponent' })).toBeDefined()
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBe(menu)
    expect((menu as HTMLElement & { inert: boolean }).inert).toBe(true)
    fireEvent.click(screen.getByLabelText('Back'))
    expect((menu as HTMLElement & { inert: boolean }).inert).toBe(false)
  })

  it('shows the seed of the game being played', () => {
    startGame()
    expect(screen.getByText('Seed 2')).toBeDefined()
  })

  it('draws a seed of its own when none is given', () => {
    // the app picks the seed; the engine is the part that may not
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.5)
    try {
      render(<App />)
      choose('Vs. Computer')
      pick('Easy')
      expect(screen.getByText('Seed 500000')).toBeDefined()
    } finally {
      random.mockRestore()
    }
  })

  it('does not start until an opponent is chosen', () => {
    render(<App seed={2} />)
    expect(atFrontDoor()).toBeDefined()
    const legal = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(0)
  })

  it('shows the chosen opponent as a label, with nothing to change mid-game', () => {
    startGame('Medium')
    expect(screen.queryByRole('button', { name: 'Play' })).toBeNull()
    expect(screen.getByLabelText('Opponent').textContent).toContain('Medium')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('opens the full log grouped into rounds, naming each side once per turn', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByText('Full log'))

    const dialog = screen.getByLabelText('Move log')
    expect(dialog.querySelector('.log-round')?.textContent).toBe('Round 1')
    expect(dialog.querySelectorAll('.log-who')).toHaveLength(1)
    expect(dialog.querySelector('.log-who')?.textContent).toBe('You')
    expect(dialog.textContent).not.toMatch(/Player/)
  })

  it('ends the turn straight from "Fire up this token?", which the log reads as declining it first', () => {
    startGame()
    const endTurn = () => screen.getByRole('button', { name: 'End turn' }) as HTMLButtonElement
    // before the token is placed there is nothing to end yet
    expect(endTurn().disabled).toBe(true)

    stackTwoOnInnerRing()
    expect(screen.getByText('Fire up this token?')).toBeDefined()
    expect(endTurn().disabled).toBe(false)
    fireEvent.click(endTurn())

    // the turn has passed: the question is gone, and the machine is to move
    expect(screen.queryByText('Fire up this token?')).toBeNull()
    expect(endTurn().dataset.state).toBe('waiting')
    fireEvent.click(screen.getByText('Full log'))
    // your turn's lines, in order: the placement, then the two the tap played
    const yours = [...screen.getByLabelText('Move log').querySelectorAll('li li')].map((line) => line.textContent)
    const declined = yours.indexOf('Do not fire up')
    expect(declined).toBeGreaterThan(0)
    expect(yours[declined - 1]).toMatch(/^Place on 1,0/)
    expect(yours[declined + 1]).toBe('End turn')
  })

  it('closes the full log', () => {
    startGame()
    fireEvent.click(screen.getByText('Full log'))
    fireEvent.click(screen.getByLabelText('Close log'))
    expect(screen.queryByLabelText('Move log')).toBeNull()
  })

  it('opens a single token as a stack of two when your token is chosen to land on it', () => {
    startGame()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    const peek = screen.getByLabelText('Stack at 1,0')
    expect(peek.querySelectorAll('.stack-chip')).toHaveLength(2)
    expect(peek.querySelector('.stack-chip[data-ghost][data-top]')).not.toBeNull()
  })

  it('opens a buried stack even while a fire-up is being offered', () => {
    startGame()
    stackTwoOnInnerRing()
    expect(screen.getByText('Fire up this token?')).toBeDefined()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
    // the question itself is still standing
    expect(screen.getByText('Fire up this token?')).toBeDefined()
  })

  it('offers Undo once something is done this turn, and takes back a whole play at a time', () => {
    startGame()
    const undo = () => screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement
    // the turn opens on a draw: there is nothing of yours to take back yet
    expect(undo().disabled).toBe(true)

    stackTwoOnInnerRing()
    expect(screen.getByText('Fire up this token?')).toBeDefined()
    expect(undo().disabled).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(screen.getByText('Score what you can, then end your turn')).toBeDefined()
    expect(undo().disabled).toBe(false)

    // the placement and the answer to "fire up?" are one play: one tap takes both back
    fireEvent.click(undo())
    expect(screen.getByText('Choose where to place the token')).toBeDefined()
    // and back at the draw it stops: the token in hand stays the one drawn
    expect(undo().disabled).toBe(true)
  })

  it('gives up against the machine from Settings, by holding the button', () => {
    vi.useFakeTimers()
    try {
      startGame()
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      const giveUp = screen.getByRole('button', { name: 'Hold to give up' })

      // a tap is not enough
      fireEvent.click(giveUp)
      act(() => vi.advanceTimersByTime(3000))
      expect(screen.queryByRole('dialog', { name: 'Final score' })).toBeNull()

      fireEvent.pointerDown(giveUp)
      act(() => vi.advanceTimersByTime(1500))
      const result = screen.getByRole('dialog', { name: 'Final score' })
      expect(within(result).getByText('You lose')).toBeDefined()
      expect(within(result).getByText('You gave up')).toBeDefined()
      expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull()

      // and once the game is over there is nothing left to give up
      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      expect(screen.queryByRole('button', { name: 'Hold to give up' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('freezes the machine while a menu is open, and lets it go on when it closes', () => {
    vi.useFakeTimers()
    try {
      startGame('Easy')
      fireEvent.click(screen.getByLabelText('2,-2: empty'))
      fireEvent.click(screen.getByLabelText('2,-2: empty'))
      fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
      fireEvent.click(screen.getByRole('button', { name: 'End turn' }))
      const before = document.querySelector('svg.board')!.innerHTML

      fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
      act(() => vi.advanceTimersByTime(20_000))
      // nothing moved under the menu
      expect(document.querySelector('svg.board')!.innerHTML).toBe(before)

      fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
      for (let i = 0; i < 60 && !screen.queryByText('Choose where to place the token'); i += 1) {
        act(() => vi.advanceTimersByTime(500))
      }
      expect(screen.getByText('Choose where to place the token')).toBeDefined()
      expect(document.querySelector('svg.board')!.innerHTML).not.toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows nothing for an empty space', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  /**
   * Clicks whatever the interface is offering, in the order a player would find
   * it. Returns false when there is nothing to click, which means the machine
   * is on turn and the test should let its timer run.
   */
  function takeAnyTurnAction(): boolean {
    // a coin discard is picked on the hand: mark the keepers, then confirm on the bar
    if (document.querySelector('.hand[data-picking]')) {
      const confirm = document.querySelector<HTMLButtonElement>('.prompt-actions button')
      if (confirm) {
        fireEvent.click(confirm)
        return true
      }
      const unpicked = document.querySelector<HTMLElement>('.hand .card[data-picked="false"]')
      if (unpicked) fireEvent.click(unpicked)
      return true
    }

    // the crystal's choice is made on the tokens, in the arch over the board
    const archToken = document.querySelector<HTMLButtonElement>('.crystal-slot:not(:disabled)')
    if (archToken) {
      fireEvent.click(archToken)
      return true
    }

    const scoreButton = document.querySelector<HTMLButtonElement>('.card button')
    if (scoreButton) {
      fireEvent.click(scoreButton)
      return true
    }

    // "Fire up this token?" is asked on the board: fire, so the abilities get played too
    const fire = document.querySelector<HTMLButtonElement>('.fire-choice .fire-up')
    if (fire) {
      fireEvent.click(fire)
      return true
    }

    const barButton = document.querySelector<HTMLButtonElement>('.prompt-actions button')
    if (barButton) {
      fireEvent.click(barButton)
      return true
    }

    const offered = '.hex-cell[data-highlight="legal"]'
    const first = document.querySelector<SVGGElement>(offered)
    if (!first) {
      // nothing left to decide: End turn has its own place beside your bar
      const endTurn = document.querySelector<HTMLButtonElement>('.end-turn[data-state="ready"]')
      if (!endTurn) return false
      fireEvent.click(endTurn)
      return true
    }

    // the first tap chooses. A plant's neighbour then puts its fires over it,
    // which the next round taps; a move wants a destination; a placement
    // confirms on a second tap of the same space
    fireEvent.click(first)
    if (document.querySelector('.fire-choice')) return true
    // a placement hovers the token over the space: tapping it again puts it down
    if (document.querySelector('.token-preview')) {
      fireEvent.click(first)
      return true
    }
    // a move or a swap wants its other end
    const destination = document.querySelector<SVGGElement>(offered)
    if (destination) fireEvent.click(destination)
    return true
  }

  it('keeps the cards marked in the hand and puts the other two back, with no dialog', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByText('Spend a coin'))

    expect(screen.queryByRole('dialog')).toBeNull()
    // the board stays there to look at while choosing
    expect(screen.getByLabelText('Game board')).toBeDefined()
    expect(screen.getByText('Choose the cards to keep')).toBeDefined()

    const hand = screen.getByLabelText('Your hand')
    const cards = [...hand.querySelectorAll<HTMLElement>('.card')]
    expect(cards).toHaveLength(4)
    const names = cards.map((card) => card.querySelector('.card-name')?.textContent)

    // nothing to confirm until two are kept
    fireEvent.click(cards[1])
    expect(screen.queryByRole('button', { name: 'Keep these' })).toBeNull()
    fireEvent.click(cards[3])

    // a third keeper is refused: exactly two go back
    fireEvent.click(cards[0])
    expect(cards[0].getAttribute('data-picked')).toBe('false')

    fireEvent.click(screen.getByRole('button', { name: 'Keep these' }))
    const left = [...document.querySelectorAll('.hand .card-name')].map((el) => el.textContent)
    expect(left).toEqual([names[1], names[3]])
    expect(document.querySelector('.hand[data-picking]')).toBeNull()
  })

  it('takes a mark back when the card is tapped again', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByText('Spend a coin'))
    const cards = [...screen.getByLabelText('Your hand').querySelectorAll<HTMLElement>('.card')]
    fireEvent.click(cards[0])
    expect(cards[0].getAttribute('data-picked')).toBe('true')
    fireEvent.click(cards[0])
    expect(cards[0].getAttribute('data-picked')).toBe('false')
  })

  it('opens a stack over the board while the cards are chosen, leaving the hand uncovered', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    fireEvent.click(screen.getByText('Spend a coin'))
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    const panel = screen.getByLabelText('Stack at 1,0')
    expect(panel.closest('.board-area')).not.toBeNull()
    expect(panel.closest('footer')).toBeNull()
    // and the choice is still there to make
    expect(document.querySelector('.hand[data-picking]')).not.toBeNull()
  })

  it('plays a whole game and asks for an opponent again on a new one', () => {
    vi.useFakeTimers()
    try {
      startGame('Easy')

      let steps = 0
      while (!screen.queryByRole('dialog', { name: 'Final score' })) {
        steps += 1
        expect(steps, 'the game never reached its end').toBeLessThan(3000)
        if (takeAnyTurnAction()) continue
        // nothing on offer: the machine is deciding
        act(() => {
          vi.advanceTimersByTime(500)
        })
      }

      // guards the loop against passing by exiting on its first turn: a real
      // game runs to something like a hundred decisions
      expect(steps).toBeGreaterThan(50)

      const random = vi.spyOn(Math, 'random').mockReturnValue(0.123456)
      fireEvent.click(screen.getByText('New game'))
      random.mockRestore()

      expect(atFrontDoor()).toBeDefined()
      // a new game is a new game: the seed it was pinned to does not come back
      choose('Vs. Computer')
      pick('Easy')
      expect(screen.getByText('Seed 123456')).toBeDefined()
      expect(screen.queryByRole('dialog', { name: 'Final score' })).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('App online', () => {
  class FakeSocket {
    sent: unknown[] = []
    closed = false
    onopen: (() => void) | null = null
    onmessage: ((event: { data: unknown }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: (() => void) | null = null
    send(data: string) {
      this.sent.push(JSON.parse(data))
    }
    close() {
      this.closed = true
    }
    receive(message: unknown) {
      this.onmessage?.({ data: JSON.stringify(message) })
    }
  }

  function fakeConnect() {
    const sockets: FakeSocket[] = []
    const connect = () => {
      const socket = new FakeSocket()
      sockets.push(socket)
      return socket
    }
    return { connect, latest: () => sockets[sockets.length - 1] }
  }

  afterEach(() => {
    window.history.replaceState(null, '', window.location.pathname)
    globalThis.localStorage?.clear()
  })

  it('asks for the mode first, then the difficulty, with a way back', () => {
    render(<App seed={2} server="ws://test" />)
    expect(screen.queryByText('Easy')).toBeNull()
    choose('Vs. Computer')
    expect(screen.getByText('Hard')).toBeDefined()
    fireEvent.click(screen.getByLabelText('Back'))
    expect(screen.getByText('Vs. Player')).toBeDefined()
    // and one more Back is the front door
    fireEvent.click(screen.getByLabelText('Back'))
    expect(atFrontDoor()).toBeDefined()
  })

  it('cannot pick a player when the site was built without a server', () => {
    render(<App seed={2} server={null} />)
    fireEvent.click(atFrontDoor())
    const button = screen.getByText('Vs. Player').closest('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText('Not available in this build')).toBeDefined()
  })

  it('creates a game and shows its PIN while waiting', () => {
    const { connect, latest } = fakeConnect()
    render(<App seed={2} server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Create')

    act(() => latest().onopen?.())
    expect(latest().sent).toEqual([{ type: 'create', options: DEFAULT_TABLE_OPTIONS }])
    expect(screen.getByText('Talking to the server…')).toBeDefined()

    act(() => latest().receive({ type: 'seated', room: '042137', seat: 0, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => latest().receive({ type: 'waiting' }))
    expect(screen.getByLabelText('Game PIN').textContent).toBe('042 137')
    expect(screen.getByText('Waiting for your friend…')).toBeDefined()
    // so a reload comes back to the same game
    expect(window.location.hash).toBe('#/room/042137')
  })

  it('creates the game with the options set under the cog, asking none before it', () => {
    const { connect, latest } = fakeConnect()
    render(<App seed={2} server="ws://test" connect={connect} />)
    const menu = screen.getByRole('navigation', { name: 'Main menu' })
    fireEvent.click(within(menu).getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByLabelText(/Show what is left in the bag/))
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    choose('Vs. Player')
    pick('Create')

    act(() => latest().onopen?.())
    expect(latest().sent).toEqual([{ type: 'create', options: { ...DEFAULT_TABLE_OPTIONS, bagComposition: true } }])
  })

  it('joins by PIN, taking digits only, and plays from the view the server sends', async () => {
    const { createGame, legalActions, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Join')

    const input = screen.getByLabelText('Game PIN') as HTMLInputElement
    const join = screen.getByRole('button', { name: 'Join' }) as HTMLButtonElement
    fireEvent.change(input, { target: { value: '04-21' } })
    expect(input.value).toBe('0421')
    expect(join.disabled).toBe(true)
    fireEvent.change(input, { target: { value: '04213799' } })
    expect(input.value).toBe('042137')
    fireEvent.click(join)

    act(() => latest().onopen?.())
    expect(latest().sent).toEqual([{ type: 'join', room: '042137' }])

    const state = createGame(2)
    const seat = state.current
    act(() => latest().receive({ type: 'seated', room: '042137', seat, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() =>
      latest().receive({
        type: 'view',
        view: toPlayerView(state, seat),
        actions: legalActions(state),
        opponentConnected: true,
      }),
    )

    expect(screen.getByText('PIN 042137')).toBeDefined()
    expect(screen.getByLabelText('Opponent').textContent).toContain('Friend')
    const legal = screen.getAllByRole('button').filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(19)
    // this view carries no canUndo (an older server): nothing to take back
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true)

    // two taps place, and the move goes to the server rather than into a local engine
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(latest().sent.at(-1)).toEqual({ type: 'action', action: { type: 'place', at: { q: 2, r: -2 } } })
    expect(screen.getByText('Opponent is thinking…')).toBeDefined()
  })

  it('undoes across the wire when the server says there is something to take back', async () => {
    const { createGame, legalActions, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Join')
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '042137' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())

    const state = createGame(2)
    const seat = state.current
    act(() => latest().receive({ type: 'seated', room: '042137', seat, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() =>
      latest().receive({
        type: 'view',
        view: toPlayerView(state, seat),
        actions: legalActions(state),
        opponentConnected: true,
        canUndo: true,
      }),
    )

    const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement
    expect(undo.disabled).toBe(false)
    fireEvent.click(undo)
    expect(latest().sent.at(-1)).toEqual({ type: 'undo' })
    // one tap, one step back: the button waits for the server's next view
    expect(undo.disabled).toBe(true)
  })

  it('asks for a rematch across the wire and starts over when the server says so', async () => {
    const { createGame, legalActions, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Join')
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '042137' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())

    const state = createGame(2)
    const over = { ...state, phase: 'ended' as const }
    act(() => latest().receive({ type: 'seated', room: '042137', seat: 0, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => latest().receive({ type: 'view', view: toPlayerView(over, 0), actions: [], opponentConnected: true }))

    expect(screen.getByRole('dialog', { name: 'Final score' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }))
    expect(latest().sent.at(-1)).toEqual({ type: 'rematch' })
    expect((screen.getByRole('button', { name: 'Requested…' }) as HTMLButtonElement).disabled).toBe(true)

    // the opponent agrees: a fresh game arrives under the next game number
    act(() =>
      latest().receive({
        type: 'view',
        view: toPlayerView(state, 0),
        actions: state.current === 0 ? legalActions(state) : [],
        opponentConnected: true,
        game: 1,
      }),
    )
    expect(screen.queryByRole('dialog', { name: 'Final score' })).toBeNull()
  })

  it('online, New game leaves the room for good, and the result can be put away with a tap outside', async () => {
    const { createGame, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Join')
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '042137' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())
    const over = { ...createGame(2), phase: 'ended' as const }
    act(() => latest().receive({ type: 'seated', room: '042137', seat: 0, token: 't', role: 'player', options: DEFAULT_TABLE_OPTIONS }))
    act(() => latest().receive({ type: 'view', view: toPlayerView(over, 0), actions: [], opponentConnected: true }))

    // a tap outside puts it away; there is no View board button any more
    expect(screen.queryByRole('button', { name: 'View board' })).toBeNull()
    fireEvent.click(document.querySelector('.game-over-backdrop')!)
    expect(screen.queryByRole('dialog', { name: 'Final score' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show result' }))

    // the opponent turned the rematch down: New game alone
    act(() => latest().receive({ type: 'opponentLeft' }))
    expect(screen.getByText('Opponent left the room')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Rematch' })).toBeNull()

    const socket = latest()
    fireEvent.click(screen.getByRole('button', { name: 'New game' }))
    expect(socket.sent.at(-1)).toEqual({ type: 'leave' })
    expect(atFrontDoor()).toBeDefined()
  })

  it("plays a joined game with the host's options, shown but not changeable", async () => {
    const { createGame, legalActions, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Join')
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '042137' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())

    const hosts = { bagComposition: true, cardGlow: false, showReputation: false }
    const state = createGame(2)
    act(() => latest().receive({ type: 'seated', room: '042137', seat: 1, token: 't', role: 'player', options: hosts }))
    act(() => latest().receive({ type: 'view', view: toPlayerView(state, 1), actions: legalActions(state), opponentConnected: true }))

    // the opponent's reputation hidden, as the host chose; your own still shows
    expect(screen.getAllByText(/reputation/)).toHaveLength(1)
    expect(within(screen.getByRole('region', { name: 'You' })).getByText(/reputation/)).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    const boxes = screen.getAllByRole('checkbox') as HTMLInputElement[]
    expect(boxes.map((box) => box.checked)).toEqual([false, false, true])
    expect(boxes.every((box) => box.disabled)).toBe(true)
  })

  it('goes back into the game in the fragment on reload', () => {
    window.location.hash = '#/room/042137'
    const { connect, latest } = fakeConnect()
    // this test DOM has no localStorage of its own
    const stored = new Map([['dcv:room:042137', JSON.stringify({ token: 'mine', seat: 1 })]])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => stored.get(k) ?? null,
      setItem: (k: string, v: string) => void stored.set(k, v),
      clear: () => stored.clear(),
    })
    try {
      render(<App server="ws://test" connect={connect} />)
      act(() => latest().onopen?.())
      expect(latest().sent).toEqual([{ type: 'join', room: '042137', token: 'mine' }])
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('says so when the PIN leads nowhere, and goes back to the start', () => {
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    choose('Vs. Player')
    pick('Join')
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())
    act(() => latest().receive({ type: 'error', code: 'room-not-found', message: 'No game is open with this PIN' }))
    expect(screen.getByText('Could not join')).toBeDefined()
    expect(screen.getByText('No game is open with this PIN')).toBeDefined()

    fireEvent.click(screen.getByText('Back to menu'))
    expect(atFrontDoor()).toBeDefined()
    expect(window.location.hash).toBe('')
  })
})
