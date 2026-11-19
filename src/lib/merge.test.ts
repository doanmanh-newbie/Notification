import { expect, test } from 'vitest'
import { mergeTasks } from './merge'
import { rowOf, task } from './fixtures'

test('bản cục bộ mới hơn thắng và được đẩy lên', () => {
  const m = mergeTasks([{ ...task, title: 'mới', updatedAt: 200 }], {}, [rowOf({ ...task, title: 'cũ' }, 100)])
  expect(m.tasks[0].title).toBe('mới')
  expect(m.toPush.map((t) => t.id)).toEqual([task.id])
})
test('bản máy chủ mới hơn thắng, không đẩy', () => {
  const m = mergeTasks([{ ...task, title: 'cũ', updatedAt: 100 }], {}, [rowOf({ ...task, title: 'mới' }, 200)])
  expect(m.tasks[0].title).toBe('mới')
  expect(m.toPush).toEqual([])
})
test('task chỉ có cục bộ được đẩy (nhập dữ liệu localStorage cũ)', () => expect(mergeTasks([task], {}, []).toPush).toHaveLength(1))
test('task chỉ có trên máy chủ được thêm vào', () => expect(mergeTasks([], {}, [rowOf(task, 5)]).tasks).toHaveLength(1))
test('tombstone máy chủ xoá bản cục bộ cũ hơn', () =>
  expect(mergeTasks([{ ...task, updatedAt: 100 }], {}, [{ ...rowOf(task, 150), deleted: true }]).tasks).toEqual([]))
test('xoá cục bộ thắng bản máy chủ cũ hơn và gửi tombstone', () => {
  const m = mergeTasks([], { [task.id]: 300 }, [rowOf(task, 200)])
  expect(m.tasks).toEqual([])
  expect(m.toDelete).toEqual([task.id])
  expect(m.deletedIds).toEqual({ [task.id]: 300 })
})
test('sửa trên máy chủ sau khi xoá cục bộ thì sống lại', () => {
  const m = mergeTasks([], { [task.id]: 100 }, [rowOf(task, 200)])
  expect(m.tasks).toHaveLength(1)
  expect(m.deletedIds).toEqual({})
})
test('tombstone đã có trên máy chủ thì bỏ khỏi hàng chờ', () =>
  expect(mergeTasks([], { [task.id]: 100 }, [{ ...rowOf(task, 100), deleted: true }]).deletedIds).toEqual({}))

import { mergeProjects } from './merge'
const proj = { id: 'p', name: 'Học', color: '#000', updatedAt: 100 }
const prow = (updatedAtMs: number, name = 'Học', deleted = false) => ({ id: 'p', user_id: 'u', data: { ...proj, name }, deleted, updated_at: new Date(updatedAtMs).toISOString() })
test('mergeProjects: cục bộ mới hơn được đẩy', () => expect(mergeProjects([proj], [prow(50)]).toPush).toHaveLength(1))
test('mergeProjects: máy chủ mới hơn thắng', () => expect(mergeProjects([proj], [prow(200, 'Mới')]).projects[0].name).toBe('Mới'))
test('mergeProjects: dự án chỉ có trên máy chủ', () => expect(mergeProjects([], [prow(1)]).projects).toHaveLength(1))
