import { describe, expect, it } from 'vitest'
import { analyticsPath } from '@/lib/analytics-path'

describe('analyticsPath', () => {
  it('keeps public pages', () => {
    expect(analyticsPath('/')).toBe('/')
    expect(analyticsPath('/privacy')).toBe('/privacy')
  })

  it('drops the secret code on invite and share links', () => {
    expect(analyticsPath('/apply/abc123')).toBe('/apply/[token]')
    expect(analyticsPath('/ask/tok')).toBe('/ask/[token]')
    expect(analyticsPath('/card/abc/embed')).toBe('/card/[token]')
  })
})
