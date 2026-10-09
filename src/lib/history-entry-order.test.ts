import { describe, expect, it } from 'vitest'
import { orderHistoryEntries } from '@/lib/history-entry-order'

describe('orderHistoryEntries', () => {
  it('puts the newest job first no matter the order they were added', () => {
    const ordered = orderHistoryEntries([
      { type: 'employment', name: 'oldest', fromDate: '01/2016', toDate: '12/2018' },
      { type: 'employment', name: 'middle', fromDate: '01/2019', toDate: '06/2022' },
      { type: 'employment', name: 'current', fromDate: '07/2022', toDate: 'Present' },
    ])
    expect(ordered.map((entry) => entry.name)).toEqual(['current', 'middle', 'oldest'])
  })

  it('keeps a job with no date at the bottom', () => {
    const ordered = orderHistoryEntries([
      { type: 'employment', name: 'blank', fromDate: '', toDate: '' },
      { type: 'employment', name: 'past', fromDate: '03/2020', toDate: '03/2021' },
    ])
    expect(ordered.map((entry) => entry.name)).toEqual(['past', 'blank'])
  })

  it('does not mix a recent school into the job list', () => {
    const ordered = orderHistoryEntries([
      { type: 'drivingSchool', name: 'CDL school', fromDate: '01/2024', toDate: '06/2024' },
      { type: 'employment', name: 'old job', fromDate: '01/2015', toDate: '01/2016' },
    ])
    expect(ordered.map((entry) => entry.name)).toEqual(['old job', 'CDL school'])
  })

  it('is unchanged when run twice', () => {
    const entries = [
      { type: 'employment', name: 'a', fromDate: '01/2020', toDate: '01/2021' },
      { type: 'unemployment', name: 'gap', fromDate: '02/2021', toDate: '08/2021' },
      { type: 'employment', name: 'b', fromDate: '09/2021', toDate: 'Present' },
    ]
    const once = orderHistoryEntries(entries)
    expect(orderHistoryEntries(once)).toEqual(once)
  })
})
