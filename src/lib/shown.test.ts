import { expect, test } from 'vitest'
import { pruneShown, reminderKey } from './shown'

test('khoá nhắc gồm id và giờ nhắc', () => expect(reminderKey('a', '2026-11-19T08:00')).toBe('a@2026-11-19T08:00'))

test('chỉ giữ khoá của các nhắc còn tồn tại', () => {
  const kept = pruneShown(['a@1', 'b@2', 'c@3'], [{ id: 'a', remindAt: '1' }, { id: 'b', remindAt: 'khác' }])
  expect(kept).toEqual(['a@1'])
})
