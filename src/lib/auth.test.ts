import { expect, test } from 'vitest'
import { authMessage } from './auth'

test('dịch lỗi đăng nhập sang tiếng Việt', () => {
  expect(authMessage('Invalid login credentials')).toBe('Sai email hoặc mật khẩu')
  expect(authMessage('User already registered')).toMatch(/đã có tài khoản/)
  expect(authMessage('Password should be at least 6 characters.')).toBe('Mật khẩu cần ít nhất 6 ký tự')
  expect(authMessage('Anonymous sign-ins are disabled')).toBe('Chế độ dùng thử đang tắt trên máy chủ')
  expect(authMessage('something else')).toBe('something else')
})
