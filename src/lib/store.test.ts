import { expect, test } from 'vitest'
import { migrateState } from './store'

test('migrateState thêm repeat và updatedAt cho dữ liệu v1 cũ', () => {
  const s = migrateState({ tasks: [{ id: 'a', title: 'x', createdAt: 5 }], projects: [] })
  expect(s.tasks[0].repeat).toBe('none')
  expect(s.tasks[0].updatedAt).toBe(5)
  expect(s.deletedIds).toEqual({})
})

test('migrateState trả seed khi dữ liệu hỏng', () => {
  expect(migrateState('rác').tasks.length).toBeGreaterThan(0)
})

import { applyPatch } from './store'
import type { Task } from './model'

const base: Task = {
  id: 'd', title: 'Tập thể dục', notes: '', priority: 'medium', effort: 1, due: '2026-11-19', remindAt: '2026-11-19T06:00',
  reminded: true, done: false, projectId: null, dependsOn: [], subtasks: [], createdAt: 1, updatedAt: 1, repeat: 'daily',
}

test('applyPatch: hoàn thành việc lặp thì cuộn sang ngày sau', () => {
  const t = applyPatch(base, { done: true }, 99)
  expect(t).toMatchObject({ done: false, due: '2026-11-20', remindAt: '2026-11-20T06:00', reminded: false, updatedAt: 99 })
})

test('applyPatch: việc không lặp thì đánh dấu xong', () => {
  expect(applyPatch({ ...base, repeat: 'none' }, { done: true }, 5)).toMatchObject({ done: true, updatedAt: 5 })
})

test('review#1: dữ liệu mẫu có updatedAt = 0 để không bao giờ đè dữ liệu thật', () => {
  const s = migrateState(null)
  expect(s.tasks.every((t) => t.updatedAt === 0)).toBe(true)
  expect(s.projects.every((p) => (p.updatedAt ?? 0) === 0)).toBe(true)
})

import { clearPushed, type State } from './store'

const st = (over: Partial<State> = {}): State => ({ tasks: [base], projects: [], deletedIds: {}, dirty: {}, dirtyProjects: {}, ...over })

test('review#2: bỏ dấu dirty sau khi đẩy thành công', () => {
  const s = clearPushed(st({ dirty: { d: true } }), [{ id: 'd', updatedAt: 1 }], [], [])
  expect(s.dirty).toEqual({})
})
test('review#2: việc bị sửa tiếp trong lúc đang đẩy vẫn còn dirty', () => {
  const s = clearPushed(st({ tasks: [{ ...base, updatedAt: 9 }], dirty: { d: true } }), [{ id: 'd', updatedAt: 1 }], [], [])
  expect(s.dirty).toEqual({ d: true })
})
test('review#3: chỉ quên việc đã xoá khi máy chủ xác nhận tombstone', () => {
  const s = clearPushed(st({ deletedIds: { a: 5, b: 6 } }), [], [], ['a'])
  expect(s.deletedIds).toEqual({ b: 6 })
})
test('review#2: migrateState có dirty rỗng', () => expect(migrateState(null).dirty).toEqual({}))

test('sửa hạn hoặc kiểu lặp bằng tay thì bỏ ngày neo cũ', () => {
  const anchored = { ...base, repeat: 'monthly' as const, repeatAnchor: 31 }
  expect(applyPatch(anchored, { due: '2027-04-15' }, 1).repeatAnchor).toBeNull()
  expect(applyPatch(anchored, { repeat: 'weekly' }, 1).repeatAnchor).toBeNull()
  expect(applyPatch(anchored, { title: 'x' }, 1).repeatAnchor).toBe(31)
})
