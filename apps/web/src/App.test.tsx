import { act, fireEvent, render, screen } from '@testing-library/react'
import { DEFAULT_TABLE_OPTIONS } from '@dcv/protocol'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App.js'

describe('App', () => {
  /**
   * The game opens on a difficulty modal and does not start until it is
   * answered, so every test has to choose an opponent before anything else.
   */
  function startGame(level: 'Easy' | 'Medium' | 'Hard' = 'Easy') {
    const rendered = render(<App seed={2} />)
    fireEvent.click(screen.getByText('Against the computer'))
    fireEvent.click(screen.getByText(level))
    fireEvent.click(screen.getByText('Start game'))
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

    fireEvent.click(screen.getByText('Skip'))
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
    fireEvent.click(screen.getByText('Against the computer'))
    fireEvent.click(screen.getByText('Easy'))
    fireEvent.click(screen.getByText('Start game'))

    fireEvent.click(screen.getByText('Win now'))
    expect(screen.getByText('You win')).toBeDefined()

    fireEvent.click(screen.getByText('Lose now'))
    expect(screen.getByText('You lose')).toBeDefined()

    fireEvent.click(screen.getByText('Draw now'))
    expect(screen.getByText('Shared victory')).toBeDefined()
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
      fireEvent.click(screen.getByText('Against the computer'))
      fireEvent.click(screen.getByText('Easy'))
      fireEvent.click(screen.getByText('Start game'))
      expect(screen.getByText('Seed 500000')).toBeDefined()
    } finally {
      random.mockRestore()
    }
  })

  it('does not start until an opponent is chosen', () => {
    render(<App seed={2} />)
    expect(screen.getByLabelText('Choose your opponent')).toBeDefined()
    const legal = screen
      .getAllByRole('button')
      .filter((el) => el.getAttribute('data-highlight') === 'legal')
    expect(legal).toHaveLength(0)
  })

  it('shows the chosen opponent as a label, with nothing to change mid-game', () => {
    startGame('Medium')
    expect(screen.queryByLabelText('Choose your opponent')).toBeNull()
    expect(screen.getByLabelText('Opponent').textContent).toContain('Medium')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('opens the full log grouped into rounds, naming each side once per turn', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Full log'))

    const dialog = screen.getByLabelText('Move log')
    expect(dialog.querySelector('.log-round')?.textContent).toBe('Round 1')
    expect(dialog.querySelectorAll('.log-who')).toHaveLength(1)
    expect(dialog.querySelector('.log-who')?.textContent).toBe('You')
    expect(dialog.textContent).not.toMatch(/Player/)
  })

  it('closes the full log', () => {
    startGame()
    fireEvent.click(screen.getByText('Full log'))
    fireEvent.click(screen.getByLabelText('Close log'))
    expect(screen.queryByLabelText('Move log')).toBeNull()
  })

  it('does not open a stack for a space holding a single token', () => {
    startGame()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('opens a stack once a space buries something', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()
  })

  it('shows the stack bottom to top without naming a coordinate on screen', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    const panel = screen.getByLabelText('Stack at 1,0')
    expect(panel.textContent).toContain('Bottom to top')
    expect(panel.textContent).not.toMatch(/\d,-?\d/)
  })

  it('shows nothing for an empty space', () => {
    startGame()
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail from its own button, leaving the game untouched', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    fireEvent.click(screen.getByLabelText('Close stack'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
    expect(screen.getByText('Your turn')).toBeDefined()
  })

  it('closes the stack detail when the commit comes from the fire-up choice', () => {
    startGame()
    stackTwoOnInnerRing()
    expect(screen.getByText('Fire up this token?')).toBeDefined()

    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()

    fireEvent.click(screen.getByText('Skip'))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  it('closes the stack detail when the turn is undone', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByLabelText(/^1,0: /))
    expect(screen.getByLabelText('Stack at 1,0')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.queryByLabelText(/^Stack at /)).toBeNull()
  })

  /**
   * Clicks whatever the interface is offering, in the order a player would find
   * it. Returns false when there is nothing to click, which means the machine
   * is on turn and the test should let its timer run.
   */
  function takeAnyTurnAction(): boolean {
    // a coin discard takes over the screen: pick the keepers, then finish
    const dialog = document.querySelector('.discard-dialog')
    if (dialog) {
      const finish = dialog.querySelector<HTMLButtonElement>('.discard-finish')
      if (finish && !finish.disabled) {
        fireEvent.click(finish)
        return true
      }
      const unpicked = dialog.querySelector<HTMLElement>('.card[data-picked="false"]')
      if (unpicked) fireEvent.click(unpicked)
      return true
    }

    // the crystal's choice is made on the tokens, in their own dialog
    const discover = document.querySelector<HTMLButtonElement>('.discover-choice:not(:disabled)')
    if (discover) {
      fireEvent.click(discover)
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

    // a placement confirms on a second tap of the same space; a two-hex move
    // leaves that space selected and wants a different one for the destination
    fireEvent.click(first)
    fireEvent.click(first)
    if (first.getAttribute('data-highlight') === 'selected') {
      const destination = document.querySelector<SVGGElement>(offered)
      if (destination) fireEvent.click(destination)
    }
    return true
  }

  it('lets the coin choice be put aside to look at the board, and brings it back', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Spend a coin'))
    expect(screen.getByLabelText('Choose the cards to keep')).toBeDefined()

    fireEvent.click(screen.getByRole('button', { name: /Look at the board/ }))
    expect(screen.queryByLabelText('Choose the cards to keep')).toBeNull()
    // the board is there to look at, the only way on is back to the choice
    expect(screen.getByLabelText('Game board')).toBeDefined()
    expect(screen.getByText('Put two cards at the bottom of the deck')).toBeDefined()

    fireEvent.click(screen.getByText('Back to your choice'))
    expect(screen.getByLabelText('Choose the cards to keep')).toBeDefined()
  })

  it('puts two cards back by picking the ones to keep in a dialog', () => {
    startGame()
    stackTwoOnInnerRing()
    fireEvent.click(screen.getByText('Skip'))
    fireEvent.click(screen.getByText('Spend a coin'))

    const dialog = screen.getByLabelText('Choose the cards to keep')
    const cards = [...dialog.querySelectorAll<HTMLElement>('.card')]
    expect(cards).toHaveLength(4)
    expect(screen.getByText(/^Keep 2\./)).toBeDefined()

    const finish = screen.getByText('Finish') as HTMLButtonElement
    expect(finish.disabled).toBe(true)

    const names = cards.map((card) => card.querySelector('.card-name')?.textContent)
    fireEvent.click(cards[0])
    fireEvent.click(cards[1])
    expect(finish.disabled).toBe(false)

    // a third pick is refused: exactly two stay
    fireEvent.click(cards[2])
    expect(cards[2].getAttribute('data-picked')).toBe('false')

    fireEvent.click(finish)
    expect(screen.queryByLabelText('Choose the cards to keep')).toBeNull()

    const left = [...document.querySelectorAll('.hand .card-name')].map((el) => el.textContent)
    expect(left).toEqual([names[0], names[1]])
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

      expect(screen.getByLabelText('Choose your opponent')).toBeDefined()
      // a new game is a new game: the seed it was pinned to does not come back
      fireEvent.click(screen.getByText('Against the computer'))
      fireEvent.click(screen.getByText('Easy'))
      fireEvent.click(screen.getByText('Start game'))
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
    fireEvent.click(screen.getByText('Against the computer'))
    expect(screen.getByText('Hard')).toBeDefined()
    fireEvent.click(screen.getByLabelText('Back'))
    expect(screen.getByText('Against a player')).toBeDefined()
  })

  it('cannot pick a player when the site was built without a server', () => {
    render(<App seed={2} server={null} />)
    const button = screen.getByText('Against a player').closest('button') as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(screen.getByText('Not available in this build')).toBeDefined()
  })

  it('creates a game and shows its PIN while waiting', () => {
    const { connect, latest } = fakeConnect()
    render(<App seed={2} server="ws://test" connect={connect} />)
    fireEvent.click(screen.getByText('Against a player'))
    fireEvent.click(screen.getByText('Create'))
    fireEvent.click(screen.getByText('Create game'))

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

  it('joins by PIN, taking digits only, and plays from the view the server sends', async () => {
    const { createGame, legalActions, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    fireEvent.click(screen.getByText('Against a player'))
    fireEvent.click(screen.getByText('Join'))

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
    // no undo across the wire
    expect((screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true)

    // two taps place, and the move goes to the server rather than into a local engine
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    fireEvent.click(screen.getByLabelText('2,-2: empty'))
    expect(latest().sent.at(-1)).toEqual({ type: 'action', action: { type: 'place', at: { q: 2, r: -2 } } })
    expect(screen.getByText('Opponent is thinking…')).toBeDefined()
  })

  it("plays a joined game with the host's options, shown but not changeable", async () => {
    const { createGame, legalActions, toPlayerView } = await import('@dcv/engine')
    const { connect, latest } = fakeConnect()
    render(<App server="ws://test" connect={connect} />)
    fireEvent.click(screen.getByText('Against a player'))
    fireEvent.click(screen.getByText('Join'))
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '042137' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())

    const hosts = { bagComposition: true, cardGlow: false, showReputation: false }
    const state = createGame(2)
    act(() => latest().receive({ type: 'seated', room: '042137', seat: 1, token: 't', role: 'player', options: hosts }))
    act(() => latest().receive({ type: 'view', view: toPlayerView(state, 1), actions: legalActions(state), opponentConnected: true }))

    // reputation hidden, as the host chose
    expect(screen.queryByText(/reputation/)).toBeNull()
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
    fireEvent.click(screen.getByText('Against a player'))
    fireEvent.click(screen.getByText('Join'))
    fireEvent.change(screen.getByLabelText('Game PIN'), { target: { value: '999999' } })
    fireEvent.click(screen.getByRole('button', { name: 'Join' }))
    act(() => latest().onopen?.())
    act(() => latest().receive({ type: 'error', code: 'room-not-found', message: 'No game is open with this PIN' }))
    expect(screen.getByText('Could not join')).toBeDefined()
    expect(screen.getByText('No game is open with this PIN')).toBeDefined()

    fireEvent.click(screen.getByText('Back to menu'))
    expect(screen.getByText('Against the computer')).toBeDefined()
    expect(window.location.hash).toBe('')
  })
})
