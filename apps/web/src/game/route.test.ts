import { describe, expect, it } from 'vitest'
import { parseRoute, roomHash } from './route.js'

describe('parseRoute', () => {
  it('reads a six-digit room out of the fragment', () => {
    expect(parseRoute('#/room/012345')).toEqual({ kind: 'room', id: '012345' })
    expect(parseRoute('#/room/012345/debug')).toEqual({ kind: 'room', id: '012345' })
    expect(parseRoute(roomHash('987654'))).toEqual({ kind: 'room', id: '987654' })
  })

  it('is home for anything else', () => {
    expect(parseRoute('')).toEqual({ kind: 'home' })
    expect(parseRoute('#debug')).toEqual({ kind: 'home' })
    expect(parseRoute('#/room/')).toEqual({ kind: 'home' })
    expect(parseRoute('#/room/12345')).toEqual({ kind: 'home' })
    expect(parseRoute('#/room/1234567')).toEqual({ kind: 'home' })
    expect(parseRoute('#/room/ABC123')).toEqual({ kind: 'home' })
  })
})
