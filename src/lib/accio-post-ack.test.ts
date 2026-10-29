import { describe, expect, it } from 'vitest'
import { accioPostAckErrorText, accioPostAckXml } from './accio-post-ack'

describe('accioPostAckXml', () => {
  it('accepts a stored result with XML and no error node', () => {
    const xml = accioPostAckXml()
    expect(xml).toBe('<XML>Accepted</XML>')
    expect(xml).not.toContain('<error')
  })

  it('rejects a failed store with an error node Accio will retry', () => {
    expect(accioPostAckXml('Database is down & retry')).toBe(
      '<XML><error><errortext>Database is down &amp; retry</errortext></error></XML>',
    )
  })
})

describe('accioPostAckErrorText', () => {
  it('keeps the processor message and drops anything that is not a string', () => {
    expect(accioPostAckErrorText({ error: 'MVR order not found', xml: '<postResults/>' })).toBe(
      'MVR order not found',
    )
    expect(accioPostAckErrorText({ error: 'Failed to parse XML result', details: 'bad tag' })).toBe(
      'Failed to parse XML result: bad tag',
    )
  })
})
