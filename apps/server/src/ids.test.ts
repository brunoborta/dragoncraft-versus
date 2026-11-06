import { describe, expect, it } from 'vitest'
import { roomId } from './ids.js'

describe('roomId', () => {
  it('is always six digits, leading zeros kept', () => {
    for (let i = 0; i < 500; i++) expect(roomId()).toMatch(/^\d{6}$/)
  })
})
