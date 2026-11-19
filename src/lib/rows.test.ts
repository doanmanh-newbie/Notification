import { expect, test } from 'vitest'
import { rowToTask, taskToRow, tombstoneRow } from './rows'
import { rowOf, task } from './fixtures'

test('taskToRow tính remind_at theo offset', () => {
  const r = taskToRow({ ...task, remindAt: '2026-11-20T08:00', reminded: false, done: false }, 'u', -420)
  expect(r.remind_at).toBe('2026-11-20T01:00:00.000Z')
  expect(r.tz_offset).toBe(-420)
})
test('việc đã xong không có remind_at', () =>
  expect(taskToRow({ ...task, remindAt: '2026-11-20T08:00', done: true }, 'u', -420).remind_at).toBeNull())
test('việc đã nhắc không có remind_at', () =>
  expect(taskToRow({ ...task, remindAt: '2026-11-20T08:00', reminded: true }, 'u', -420).remind_at).toBeNull())
test('rowToTask lấy updatedAt từ updated_at', () =>
  expect(rowToTask({ ...rowOf(task, 0), updated_at: '2026-11-19T00:00:00.000Z' }).updatedAt).toBe(Date.parse('2026-11-19T00:00:00.000Z')))
test('rowToTask bổ sung trường thiếu', () => expect(rowToTask(rowOf({ ...task, repeat: undefined as never }, 5)).repeat).toBe('none'))
test('tombstoneRow', () => expect(tombstoneRow('x', 'u', 0)).toMatchObject({ id: 'x', deleted: true, data: null, remind_at: null }))

test('review#5: mọi sửa đổi từ client vô hiệu hoá token của thông báo cũ', () => {
  expect(taskToRow(task, 'u', -420).action_token).toBeNull()
})
