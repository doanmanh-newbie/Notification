import { expect, test } from 'vitest'
import { dayLoad, freeDays, groupByDay, lightestToMove, monthGrid, moveToDay, taskDay, weekDays } from './calendar'
import type { Task } from './model'

const t = (over: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2),
  title: 'x',
  notes: '',
  priority: 'medium',
  effort: 2,
  due: null,
  remindAt: null,
  reminded: false,
  done: false,
  projectId: null,
  dependsOn: [],
  subtasks: [],
  createdAt: 1,
  updatedAt: 1,
  repeat: 'none',
  ...over,
})

test('lưới tháng 11/2026 bắt đầu thứ Hai 26/10, 42 ô, có ngày 1', () => {
  const g = monthGrid(2026, 10)
  expect(g).toHaveLength(42)
  expect(g[0]).toBe('2026-10-26')
  expect(g).toContain('2026-11-01')
  expect(g[41]).toBe('2026-12-06')
})

test('tháng bắt đầu đúng thứ Hai không bị lùi cả tuần', () => expect(monthGrid(2027, 1)[0]).toBe('2027-02-01'))

test('ngày của việc: hạn trước, rồi ngày nhắc', () => {
  expect(taskDay(t({ due: '2026-11-20', remindAt: '2026-11-19T08:00' }))).toBe('2026-11-20')
  expect(taskDay(t({ remindAt: '2026-11-19T08:00' }))).toBe('2026-11-19')
  expect(taskDay(t({}))).toBeNull()
})

test('gom theo ngày: lọc dự án, việc chưa xong và ưu tiên cao lên trước', () => {
  const a = t({ title: 'thấp', due: '2026-11-20', priority: 'low' })
  const b = t({ title: 'khẩn', due: '2026-11-20', priority: 'urgent' })
  const c = t({ title: 'xong', due: '2026-11-20', priority: 'urgent', done: true })
  const d = t({ title: 'khác dự án', due: '2026-11-20', projectId: 'p2' })
  const m = groupByDay([a, b, c, d])
  expect(m.get('2026-11-20')!.map((x) => x.title)).toEqual(['khẩn', 'khác dự án', 'thấp', 'xong'])
  expect(groupByDay([a, d], 'p2').get('2026-11-20')!.map((x) => x.title)).toEqual(['khác dự án'])
})

test('tải ngày: chỉ tính việc chưa xong, các mức', () => {
  expect(dayLoad([]).level).toBe('free')
  expect(dayLoad([t({ effort: 2 })]).level).toBe('ok')
  expect(dayLoad(Array.from({ length: 7 }, () => t({ effort: 2 })))).toMatchObject({ minutes: 315, level: 'busy' })
  expect(dayLoad(Array.from({ length: 9 }, () => t({ effort: 2 }))).level).toBe('over')
  expect(dayLoad([t({ effort: 3, done: true })]).minutes).toBe(0)
})

test('dời ngày giữ nguyên giờ nhắc', () => {
  expect(moveToDay(t({ due: '2026-11-20', remindAt: '2026-11-20T08:00', reminded: true }), '2026-11-25')).toEqual({
    due: '2026-11-25',
    remindAt: '2026-11-25T08:00',
    reminded: false,
  })
  expect(moveToDay(t({ due: '2026-11-20' }), '2026-11-25')).toEqual({ due: '2026-11-25' })
})

test('gợi ý ngày trống: bỏ ngày bận, chỉ tính sau ngày gốc', () => {
  const by = new Map<string, Task[]>([['2026-11-21', Array.from({ length: 9 }, () => t({ effort: 2 }))]])
  expect(freeDays('2026-11-20', by, 2)).toEqual(['2026-11-22', '2026-11-23'])
})

test('chọn việc nên dời: ưu tiên thấp nhất, rồi nhẹ nhất, bỏ việc đã xong', () => {
  const keep = t({ title: 'khẩn', priority: 'urgent', effort: 1 })
  const heavyLow = t({ title: 'thấp nặng', priority: 'low', effort: 3 })
  const lightLow = t({ title: 'thấp nhẹ', priority: 'low', effort: 1 })
  const doneLow = t({ title: 'xong', priority: 'low', effort: 1, done: true })
  expect(lightestToMove([keep, heavyLow, lightLow, doneLow])!.title).toBe('thấp nhẹ')
  expect(lightestToMove([doneLow])).toBeNull()
})

test('review#1: dời vào giờ đã qua thì không bắn lại nhắc cũ', () => {
  const p = moveToDay(t({ due: '2026-11-20', remindAt: '2026-11-20T08:00', reminded: true }), '2026-11-18', '2026-11-19T10:00')
  expect(p.reminded).toBeUndefined()
  const q = moveToDay(t({ due: '2026-11-20', remindAt: '2026-11-20T08:00', reminded: true }), '2026-11-25', '2026-11-19T10:00')
  expect(q.reminded).toBe(false)
})

test('review#2: giữ khoảng cách giữa giờ nhắc và hạn', () => {
  expect(moveToDay(t({ due: '2026-11-25', remindAt: '2026-11-24T08:00' }), '2026-11-28')).toMatchObject({ due: '2026-11-28', remindAt: '2026-11-27T08:00' })
})

test('review#2: việc chỉ có giờ nhắc thì không tự sinh hạn', () => {
  const p = moveToDay(t({ remindAt: '2026-11-24T08:00' }), '2026-11-28')
  expect(p.due).toBeUndefined()
  expect(p.remindAt).toBe('2026-11-28T08:00')
})

test('review#4: ngày gợi ý phải còn chỗ cho việc cần dời', () => {
  // 22/11 đang 4×45' = 180' (50%, "vừa sức") — thêm việc 120' sẽ thành 300' (> 60%) → bỏ qua
  const by = new Map<string, Task[]>([['2026-11-22', Array.from({ length: 4 }, () => t({ effort: 2 }))]])
  expect(freeDays('2026-11-21', by, 1, 21, 120)).toEqual(['2026-11-23'])
  expect(freeDays('2026-11-21', by, 1)).toEqual(['2026-11-22'])
})

test('tuần: thứ Hai → Chủ nhật chứa ngày đã cho', () => {
  expect(weekDays('2026-11-19')).toEqual(['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
  expect(weekDays('2026-11-22')[0]).toBe('2026-11-16') // Chủ nhật vẫn thuộc tuần bắt đầu thứ Hai trước đó
  expect(weekDays('2026-11-16')[0]).toBe('2026-11-16')
})

test('tuần vắt qua năm mới', () => expect(weekDays('2027-01-01')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']))
