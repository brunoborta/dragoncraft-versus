import { describe, expect, it } from 'vitest'
import { blockers, measureHoles } from './spotlight.js'

describe('blockers', () => {
  const inside = (cells: { x: number; y: number; w: number; h: number }[], x: number, y: number) =>
    cells.some((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h)

  it('covers everything but the hole', () => {
    const cells = blockers([{ x: 100, y: 100, w: 50, h: 50 }], 400, 800)
    expect(inside(cells, 125, 125)).toBe(false)
    expect(inside(cells, 10, 10)).toBe(true)
    expect(inside(cells, 125, 300)).toBe(true)
  })
  it('keeps two overlapping holes open where they overlap', () => {
    const holes = [
      { x: 100, y: 100, w: 50, h: 50 },
      { x: 110, y: 105, w: 50, h: 50 },
    ]
    const cells = blockers(holes, 400, 800)
    expect(inside(cells, 125, 125)).toBe(false)
    expect(inside(cells, 155, 150)).toBe(false)
  })
})


describe('measureHoles', () => {
  it('opens a padded hole on every element found, and none for what is not on screen', () => {
    const gear = document.createElement('button')
    gear.className = 'gear'
    gear.getBoundingClientRect = () => ({ left: 100, top: 20, width: 40, height: 40 }) as DOMRect
    document.body.append(gear)
    expect(measureHoles(['.gear', '.missing'])).toEqual([{ x: 92, y: 12, w: 56, h: 56 }])
    gear.remove()
  })

  it('does not light what is still fading in, nor what says it is not in its place yet', () => {
    const faded = document.createElement('div')
    faded.className = 'faded'
    faded.style.opacity = '0'
    faded.getBoundingClientRect = () => ({ left: 10, top: 10, width: 40, height: 40 }) as DOMRect
    const pending = document.createElement('div')
    pending.setAttribute('data-spot-pending', '')
    const inside = document.createElement('button')
    inside.className = 'inside'
    inside.getBoundingClientRect = () => ({ left: 200, top: 10, width: 40, height: 40 }) as DOMRect
    pending.append(inside)
    document.body.append(faded, pending)
    expect(measureHoles(['.faded', '.inside'])).toEqual([])
    faded.remove()
    pending.remove()
  })

  it('marks a still spot, lit like any other', () => {
    const card = document.createElement('div')
    card.className = 'seen'
    card.getBoundingClientRect = () => ({ left: 100, top: 20, width: 40, height: 40 }) as DOMRect
    document.body.append(card)
    expect(measureHoles(['still:.seen'])).toEqual([{ x: 92, y: 12, w: 56, h: 56, still: true }])
    card.remove()
  })

  it('lights several things in one plain box', () => {
    const space = document.createElement('div')
    space.className = 'space'
    space.getBoundingClientRect = () => ({ left: 100, top: 300, width: 80, height: 70 }) as DOMRect
    const token = document.createElement('div')
    token.className = 'token'
    token.getBoundingClientRect = () => ({ left: 110, top: 260, width: 60, height: 60 }) as DOMRect
    document.body.append(space, token)
    expect(measureHoles(['around:.space|.token'])).toEqual([{ x: 92, y: 252, w: 96, h: 126 }])
    expect(measureHoles(['around:.missing'])).toEqual([])
    space.remove()
    token.remove()
  })

  it("keeps to an element's own box when it says so, so a hover's lift inside it does not move the spot", () => {
    const frame = document.createElement('div')
    frame.className = 'frame'
    frame.setAttribute('data-spot', 'own')
    frame.getBoundingClientRect = () => ({ left: 100, top: 500, width: 64, height: 69 }) as DOMRect
    const lifted = document.createElement('button')
    lifted.getBoundingClientRect = () => ({ left: 100, top: 494, width: 64, height: 69 }) as DOMRect
    frame.append(lifted)
    document.body.append(frame)
    expect(measureHoles(['.frame'])).toEqual([{ x: 92, y: 492, w: 80, h: 85 }])
    frame.remove()
  })

  it('takes in what sticks out of a small element, as the drawn token floats above its tray', () => {
    const tray = document.createElement('div')
    tray.className = 'tray'
    tray.getBoundingClientRect = () => ({ left: 100, top: 520, right: 200, bottom: 585, width: 100, height: 65 }) as DOMRect
    const token = document.createElement('div')
    token.getBoundingClientRect = () => ({ left: 115, top: 503, right: 180, bottom: 572, width: 65, height: 69 }) as DOMRect
    const tip = document.createElement('div')
    tip.setAttribute('role', 'tooltip')
    tip.getBoundingClientRect = () => ({ left: 0, top: 300, right: 400, bottom: 400, width: 400, height: 100 }) as DOMRect
    tray.append(token, tip)
    document.body.append(tray)
    expect(measureHoles(['.tray'])).toEqual([{ x: 92, y: 495, w: 116, h: 98 }])
    tray.remove()
  })
})
