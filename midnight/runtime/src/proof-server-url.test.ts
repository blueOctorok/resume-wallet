import { describe, expect, it } from 'vitest'
import {
  parseProofServerUrl,
  resolveProofServerEndpoint,
} from './proof-server-url.js'

describe('resolveProofServerEndpoint', () => {
  it('leaves local Docker URL open (no Authorization)', () => {
    const ep = resolveProofServerEndpoint({ url: 'http://127.0.0.1:6300' })
    expect(ep.url).toBe('http://127.0.0.1:6300')
    expect(ep.authorization).toBeNull()
  })

  it('prefers explicit password over URL userinfo', () => {
    const ep = resolveProofServerEndpoint({
      url: 'https://legacy:oldpass@provven-midnight-proof.fly.dev',
      user: 'prove',
      password: 'newpass',
    })
    expect(ep.url).toBe('https://provven-midnight-proof.fly.dev')
    expect(ep.authorization).toBe(
      `Basic ${Buffer.from('prove:newpass', 'utf8').toString('base64')}`,
    )
  })

  it('accepts clean URL + separate password (preferred shape)', () => {
    const ep = resolveProofServerEndpoint({
      url: 'https://provven-midnight-proof.fly.dev/',
      password: 's3cret',
    })
    expect(ep.url).toBe('https://provven-midnight-proof.fly.dev')
    expect(ep.authorization).toBe(
      `Basic ${Buffer.from('prove:s3cret', 'utf8').toString('base64')}`,
    )
  })

  it('still accepts legacy user:pass@host URLs', () => {
    const ep = parseProofServerUrl(
      'https://prove:legacy@provven-midnight-proof.fly.dev',
    )
    expect(ep.url).toBe('https://provven-midnight-proof.fly.dev')
    expect(ep.authorization).toBe(
      `Basic ${Buffer.from('prove:legacy', 'utf8').toString('base64')}`,
    )
  })
})
