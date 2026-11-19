import { expect, test } from 'vitest'
import { toUtcIso, toLocal, addMonthsClamped } from '../../supabase/functions/_shared/time.ts'
import { nextOccurrence, rollForward } from '../../supabase/functions/_shared/recur.ts'
import { afterSend } from '../../supabase/functions/_shared/delivery.ts'

test('08:00 giờ VN là 01:00Z', () => expect(toUtcIso('2026-11-20T08:00', -420)).toBe('2026-11-20T01:00:00.000Z'))
test('qua nửa đêm UTC', () => expect(toUtcIso('2026-11-20T03:00', -420)).toBe('2026-11-19T20:00:00.000Z'))
test('toLocal ngược lại', () => expect(toLocal(Date.parse('2026-11-20T01:10:00Z'), -420)).toBe('2026-11-20T08:10'))
test('31/01 + 1 tháng = 28/02', () => expect(addMonthsClamped('2027-01-31', 1)).toBe('2027-02-28'))
test('năm nhuận 29/02', () => expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29'))
test('tháng 12 sang năm mới', () => expect(addMonthsClamped('2026-12-15', 1)).toBe('2027-01-15'))
test('daily giữ giờ', () => expect(nextOccurrence('2026-12-31T21:30', 'daily')).toBe('2027-01-01T21:30'))
test('weekly', () => expect(nextOccurrence('2026-11-19', 'weekly')).toBe('2026-11-26'))
test('monthly giữ giờ', () => expect(nextOccurrence('2027-01-31T07:00', 'monthly')).toBe('2027-02-28T07:00'))
test('rollForward việc lặp', () => {
  const t = rollForward({ due: '2026-11-19', remindAt: '2026-11-19T08:00', repeat: 'daily', done: true, reminded: true, subtasks: [{ done: true }] })
  expect(t).toMatchObject({ due: '2026-11-20', remindAt: '2026-11-20T08:00', done: false, reminded: false })
  expect(t.subtasks[0].done).toBe(false)
})
test('rollForward chỉ có remindAt', () =>
  expect(rollForward({ due: null, remindAt: '2026-11-19T08:00', repeat: 'weekly', done: false, reminded: true, subtasks: [] }).remindAt).toBe('2026-11-26T08:00'))
test('rollForward không lặp thì chỉ đánh dấu xong', () =>
  expect(rollForward({ due: null, remindAt: null, repeat: 'none', done: false, reminded: false, subtasks: [] }).done).toBe(true))
test('afterSend: một máy hết hạn, một máy nhận', () =>
  expect(afterSend([{ endpoint: 'a', status: 410 }, { endpoint: 'b', status: 201 }])).toEqual({ reminded: true, deadEndpoints: ['a'] }))
test('afterSend: không máy nào nhận thì chưa đánh dấu', () => expect(afterSend([{ endpoint: 'a', status: 500 }]).reminded).toBe(false))

test('review#7: hoàn thành việc lặp quá hạn 3 ngày thì nhảy tới lần kế tiếp trong tương lai', () => {
  const t = rollForward({ due: '2026-11-16', remindAt: '2026-11-16T08:00', repeat: 'daily', done: false, reminded: true, subtasks: [] }, '2026-11-19T10:00')
  expect(t).toMatchObject({ due: '2026-11-20', remindAt: '2026-11-20T08:00' })
})
test('review#7: chưa tới giờ nhắc hôm nay thì vẫn sang ngày mai (không lùi)', () => {
  expect(rollForward({ due: null, remindAt: '2026-11-19T21:00', repeat: 'daily', done: false, reminded: false, subtasks: [] }, '2026-11-19T10:00').remindAt).toBe('2026-11-20T21:00')
})
test('review#7: chỉ có hạn, quá hạn thì tới ngày sau hôm nay', () => {
  expect(rollForward({ due: '2026-11-10', remindAt: null, repeat: 'weekly', done: false, reminded: false, subtasks: [] }, '2026-11-19T10:00').due).toBe('2026-11-24')
})

test('lặp tháng không trôi ngày: 31/1 → 28/2 → 31/3', () => {
  const a = rollForward({ due: '2027-01-31', remindAt: null, repeat: 'monthly', done: false, reminded: false, subtasks: [] })
  expect(a.due).toBe('2027-02-28')
  expect(a.repeatAnchor).toBe(31)
  const b = rollForward(a)
  expect(b.due).toBe('2027-03-31')
})
test('neo ngày cũng áp dụng cho giờ nhắc', () => {
  const a = rollForward({ due: null, remindAt: '2027-01-30T09:00', repeat: 'monthly', done: false, reminded: false, subtasks: [] })
  expect(rollForward(a).remindAt).toBe('2027-03-30T09:00')
})
test('addMonthsClamped với ngày neo', () => expect(addMonthsClamped('2027-02-28', 1, 31)).toBe('2027-03-31'))
