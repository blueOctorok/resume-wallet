import { describe, expect, it } from 'vitest'
import { isSupportRecipient, parseMailbox, supportBodyText } from '@/lib/support-inbox'

describe('support inbox', () => {
  it('recognizes both support addresses and ignores an employment-verification alias', () => {
    expect(isSupportRecipient('Support <support@provven.com>')).toBe(true)
    expect(isSupportRecipient('support@verify.provven.com')).toBe(true)
    expect(isSupportRecipient('evr-3e9344b2-3bd8-495b-bd4e-0ee7bd611bdb@verify.provven.com')).toBe(false)
  })

  it('splits a display name from the address', () => {
    expect(parseMailbox('Jane Driver <jane@example.com>')).toEqual({
      name: 'Jane Driver',
      email: 'jane@example.com',
    })
  })

  it('keeps the text of an html body and drops the tags', () => {
    expect(supportBodyText({ bodyHtml: '<p>Hello&nbsp;there</p><script>nope</script>' })).toBe('Hello there')
  })
})
