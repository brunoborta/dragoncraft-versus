import { describe, expect, it } from 'vitest'
import { parseClientMessage } from './parse.js'

describe('parseClientMessage', () => {
  it('accepts each kind of message', () => {
    expect(parseClientMessage('{"type":"create"}')).toEqual({ type: 'create' })
    expect(parseClientMessage('{"type":"join","room":"ABC123"}')).toEqual({ type: 'join', room: 'ABC123' })
    expect(parseClientMessage('{"type":"join","room":"ABC123","token":"t"}')).toEqual({
      type: 'join',
      room: 'ABC123',
      token: 't',
    })
    expect(parseClientMessage('{"type":"action","action":{"type":"endTurn"}}')).toEqual({
      type: 'action',
      action: { type: 'endTurn' },
    })
  })

  it('rejects what is not a message', () => {
    expect(parseClientMessage('not json')).toBeNull()
    expect(parseClientMessage('42')).toBeNull()
    expect(parseClientMessage('[]')).toBeNull()
    expect(parseClientMessage('{}')).toBeNull()
    expect(parseClientMessage('{"type":"dance"}')).toBeNull()
  })

  it('rejects a join without a room, or with a token that is not text', () => {
    expect(parseClientMessage('{"type":"join"}')).toBeNull()
    expect(parseClientMessage('{"type":"join","room":""}')).toBeNull()
    expect(parseClientMessage('{"type":"join","room":"X","token":7}')).toBeNull()
  })

  it('rejects an action that is not an object with a type', () => {
    expect(parseClientMessage('{"type":"action"}')).toBeNull()
    expect(parseClientMessage('{"type":"action","action":"endTurn"}')).toBeNull()
    expect(parseClientMessage('{"type":"action","action":{}}')).toBeNull()
  })

  it('drops fields it does not know rather than passing them through', () => {
    expect(parseClientMessage('{"type":"create","extra":1}')).toEqual({ type: 'create' })
  })

  it('reads the options a room is created with, filling in what an older client leaves out', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'create', options: { bagComposition: true } }))).toEqual({
      type: 'create',
      options: { bagComposition: true, cardGlow: true, showReputation: true },
    })
  })

  it('refuses options that are not booleans', () => {
    expect(parseClientMessage(JSON.stringify({ type: 'create', options: { cardGlow: 'yes' } }))).toBeNull()
    expect(parseClientMessage(JSON.stringify({ type: 'create', options: 3 }))).toBeNull()
  })
})
