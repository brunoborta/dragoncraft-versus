import { describe, expect, it } from 'vitest'
import { parseRoute, roomHash, roomLink } from './route.js'

describe('parseRoute', () => {
  it('reads a room out of the fragment, upper-cased', () => {
    expect(parseRoute('#/room/abc123')).toEqual({ kind: 'room', id: 'ABC123' })
    expect(parseRoute('#/room/ABC123/debug')).toEqual({ kind: 'room', id: 'ABC123' })
  })

  it('is home for anything else', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' })
    expect(parseRoute('#debug')).toEqual({ kind: 'home' })
    expect(parseRoute('#/room/')).toEqual({ kind: 'home' })
  })

  it('builds a link that parses back to the same room', () => {
    const link = roomLink('ABC123', { origin: 'https://x.example', pathname: '/dragoncraft-versus/' })
    expect(link).toBe('https://x.example/dragoncraft-versus/#/room/ABC123')
    expect(parseRoute(roomHash('ABC123'))).toEqual({ kind: 'room', id: 'ABC123' })
  })
})
