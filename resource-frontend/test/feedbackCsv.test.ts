import { describe, expect, it } from 'vitest'
import { csvFileName, feedbackCsv, subscribersCsv } from '../src/feedback/csv'
import type { FeedbackEntry, Subscriber } from '../src/feedback/types'

const entry = (over: Partial<FeedbackEntry>): FeedbackEntry => ({
  id: 'f-1', created_at: '2026-11-18T01:02:03.456Z', rating: 4, comment: 'Clear', page: '/the-breast',
  device: 'phone', app_version: '2.0.3', mode: 'standalone', ...over,
})

describe('feedbackCsv', () => {
  it('starts with a byte-order mark, so Excel reads ā and ngā as written', () => {
    expect(feedbackCsv([]).startsWith('﻿')).toBe(true)
  })

  it('has a header row and one row per entry, CRLF-separated', () => {
    const lines = feedbackCsv([entry({})]).slice(1).split('\r\n')
    expect(lines[0]).toBe('id,created_at,rating,rating_label,comment,page,device,app_version,mode')
    expect(lines[1]).toBe('f-1,2026-11-18T01:02:03.456Z,4,Easy,Clear,/the-breast,phone,2.0.3,standalone')
  })

  it('quotes commas, quotes and line breaks the RFC 4180 way', () => {
    const line = feedbackCsv([entry({ comment: 'Bigger, "clearer"\ntext' })]).slice(1).split('\r\n').slice(1).join('\r\n')
    expect(line).toContain('"Bigger, ""clearer""\ntext"')
  })

  it('leaves both rating cells empty for a note with no face', () => {
    const line = feedbackCsv([entry({ rating: null })]).slice(1).split('\r\n')[1]!
    expect(line.startsWith('f-1,2026-11-18T01:02:03.456Z,,,')).toBe(true)
  })

  it('defuses a comment a spreadsheet would run as a formula', () => {
    const line = feedbackCsv([entry({ comment: '=HYPERLINK("x")' })]).slice(1).split('\r\n')[1]!
    expect(line).toContain(`"'=HYPERLINK(""x"")"`)
  })
})

describe('subscribersCsv', () => {
  it('lists first name, contact and its kind', () => {
    const s: Subscriber = { id: 's-1', created_at: '2026-11-18T00:00:00.000Z', first_name: 'Aroha', contact: 'aroha@example.nz', contact_type: 'email' }
    const lines = subscribersCsv([s]).slice(1).split('\r\n')
    expect(lines[0]).toBe('id,created_at,first_name,contact,contact_type')
    expect(lines[1]).toBe('s-1,2026-11-18T00:00:00.000Z,Aroha,aroha@example.nz,email')
  })
})

describe('csvFileName', () => {
  it('names the file after the app, the list and the day', () => {
    expect(csvFileName('feedback', new Date(2026, 10, 18))).toBe('visual-whakamarama-feedback-2026-11-18.csv')
    expect(csvFileName('stay-in-touch', new Date(2026, 0, 5))).toBe('visual-whakamarama-stay-in-touch-2026-01-05.csv')
  })
})
