import { describe, expect, it } from 'vitest'
import { signInCodeHash } from './signin-code-hash'

describe('signInCodeHash', () => {
  it('matches Auth: SHA-224 of the lowercased email concatenated with the code', () => {
    expect(signInCodeHash('user@example.com', '123456')).toBe(
      'b507a4ef007e1379d644aa6fe395cf98f1054ac96b63a052dca9a26a',
    )
  })
})
