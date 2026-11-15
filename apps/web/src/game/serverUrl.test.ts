import { describe, expect, it } from 'vitest'
import { toSocketUrl } from './serverUrl.js'

describe('toSocketUrl', () => {
  it('turns a web address into a socket address', () => {
    expect(toSocketUrl('http://localhost:8080')).toBe('ws://localhost:8080')
    expect(toSocketUrl('https://dcv.fly.dev')).toBe('wss://dcv.fly.dev')
  })

  it('keeps localhost when the page is opened on the same computer', () => {
    expect(toSocketUrl('http://localhost:8080', 'localhost')).toBe('ws://localhost:8080')
  })

  it("points a phone on the LAN at the computer's address, not its own localhost", () => {
    expect(toSocketUrl('http://localhost:8080', '192.168.1.20')).toBe('ws://192.168.1.20:8080')
    expect(toSocketUrl('http://127.0.0.1:8080', '192.168.1.20')).toBe('ws://192.168.1.20:8080')
  })

  it('leaves a real server alone, wherever the page came from', () => {
    expect(toSocketUrl('https://dcv.fly.dev', '192.168.1.20')).toBe('wss://dcv.fly.dev')
  })
})
