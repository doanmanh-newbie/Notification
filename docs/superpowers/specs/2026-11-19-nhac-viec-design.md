# Ứng dụng Nhắc Việc Cá Nhân — Thiết kế (spec)

Ngày: 2026-11-19 · Trạng thái: chờ duyệt

## 1. Mục đích (vì sao)
Biến bản app nhắc việc hiện có (React + Vite + Tailwind, ~1.350 dòng, giao diện tiếng Việt) thành một **sản phẩm dùng hằng ngày được**. Yêu cầu cốt lõi của chủ dự án: **nhắc việc phải hiện thành thông báo trên màn hình điện thoại Android, kể cả khi đã đóng app/trình duyệt hoặc khoá máy.**

## 2. Hiện trạng (đã đọc code)
- 4 màn hình: Tập trung hôm nay, Tất cả việc, Ma trận ưu tiên, Bản đồ liên kết.
- Việc có: ưu tiên, công sức, hạn, giờ nhắc (`remindAt`), việc con, dự án, phụ thuộc.
- Nhắc việc: `Reminders.tsx` quét mỗi 15s và gọi `new Notification` → **chỉ chạy khi tab mở**.
- Dữ liệu: chỉ `localStorage` (`store.ts`) → mất khi xoá cache/đổi máy.
- Chưa có: PWA, backend, đăng nhập, test, việc lặp lại, snooze.

## 3. Mục tiêu / không mục tiêu / phản mục tiêu
**Mục tiêu**
1. Thông báo đẩy (Web Push) tới Android đúng giờ `remindAt`, app đóng vẫn nhận.
2. Cài được như app (PWA): biểu tượng, toàn màn hình, mở được khi mất mạng.
3. Dữ liệu lưu trên máy chủ, đồng bộ giữa các thiết bị, có đăng nhập.
4. Việc lặp lại (hằng ngày/tuần/tháng) và nhắc lại sau (snooze 10 phút / 1 giờ / mai) ngay trên thông báo.
5. Có bộ test và quy trình kiểm tra trước khi giao.

**Không mục tiêu (đợt này):** iPhone/iOS (làm sau, cần "Thêm vào Màn hình chính"), app store, chia sẻ việc giữa nhiều người, đính kèm file.

**Phản mục tiêu:** thông báo trễ/mất âm thầm; mất dữ liệu người dùng khi chuyển từ `localStorage` lên máy chủ; phải trả phí để chạy ở quy mô một người dùng.

## 4. Các hướng đã cân nhắc
| Hướng | Ưu | Nhược |
|---|---|---|
| **A. PWA + Web Push + Supabase** (chọn) | Không cần APK/cửa hàng, đồng bộ sẵn, miễn phí ở quy mô cá nhân, Android nhận thẳng | Phụ thuộc máy chủ; iOS cần thêm bước cài |
| B. Capacitor (APK) | Thông báo hẹn giờ trên máy, chạy offline | Phải build APK; iOS cần 99 USD/năm + Mac; phải làm thêm đồng bộ |
| C. Telegram/ntfy | Nhanh nhất | Thông báo không đến từ app của bạn |

Chọn A vì khớp "hiện thông báo điện thoại", dùng lại toàn bộ web hiện có, và Android hỗ trợ Web Push tốt. *(Đây là đề xuất của tôi; chủ dự án đã chọn "Android trước, vì dễ làm".)*

## 5. Thiết kế (hướng A)
**Kiến trúc**
- **Client (React/Vite):** PWA (manifest + service worker). Service worker nhận `push` và hiện thông báo, có nút hành động *Xong* / *Nhắc lại sau*.
- **Supabase (cloud, mọi thứ ở một chỗ):**
  - Auth: đăng nhập bằng email (magic link). *Lựa chọn của tôi.*
  - Postgres: bảng `tasks`, `projects`, `push_subscriptions` (kèm `user_id`, bật RLS: mỗi người chỉ thấy dữ liệu của mình).
  - Edge Function `send-reminders`: lấy các việc đến giờ nhắc chưa gửi, gửi Web Push (VAPID), đánh dấu đã gửi, tạo lần lặp kế tiếp nếu là việc lặp.
  - `pg_cron`: gọi `send-reminders` mỗi phút.
- **Đồng bộ:** client đọc/ghi qua Supabase; giữ bản cache cục bộ để mở được khi offline, ghi bù khi có mạng. Lần đăng nhập đầu: **tự nhập dữ liệu `localStorage` cũ lên tài khoản** (không mất dữ liệu).
- **Thông báo:** xin quyền khi người dùng bật nhắc lần đầu (có màn hướng dẫn), lưu subscription theo từng thiết bị; subscription hết hạn (410) thì xoá.
- **Snooze:** Android chỉ hiện tối đa 2 nút trên thông báo → thông báo có *Xong* và *Hoãn 10 phút*; trong app có đủ 10 phút / 1 giờ / mai.
- **Việc lặp:** thêm trường `repeat` (none/daily/weekly/monthly); khi đánh dấu xong thì việc tự cuộn sang lần kế tiếp (giống Todoist). Lặp tháng ngày 31 rơi vào ngày cuối tháng.

**Độ chính xác:** quét mỗi phút ⇒ trễ tối đa ~1 phút (chấp nhận được cho nhắc việc cá nhân).

## 6. Quy trình 5 bước (áp dụng cho dự án này)
1. **Spec** — tài liệu này, được duyệt mới đi tiếp.
2. **Plan** — kế hoạch từng bước nhỏ, có tiêu chí xong (skill writing-plans).
3. **Build** — làm theo kế hoạch, test trước cho phần logic (lặp lại, snooze, tính giờ nhắc).
4. **Review** — rà soát code (đúng, bảo mật RLS, khoá VAPID không lộ ra client).
5. **Test** — unit test logic; kiểm thử thật: bật thông báo, khoá màn hình, nhận push trên Android; kiểm tra build.

## 7. Ràng buộc
- Chạy trong Figma Make, deploy tĩnh (`adapter: static`) → backend phải ở ngoài (Supabase).
- Web Push cần HTTPS (bản deploy có sẵn).
- Khoá riêng VAPID chỉ nằm ở secret của Edge Function.
- Giao diện giữ tiếng Việt, giữ phong cách hiện có.

## 8. Để người xây tự quyết
Thư viện test (đề xuất Vitest), chi tiết giao diện màn đăng nhập/hướng dẫn bật thông báo, biểu tượng PWA, cấu trúc bảng chi tiết, cách xử lý xung đột đồng bộ (đề xuất: bản mới nhất thắng).

## 9. Việc cần chủ dự án làm / duyệt khi build
- Tạo (hoặc cho phép tạo) một dự án Supabase — có thể phát sinh chi phí, sẽ hỏi lại trước khi tạo.
- Thử thông báo trên điện thoại Android thật ở bước Test.

## 10. Các điểm tôi tự quyết (để bạn kiểm tra)
Đăng nhập bằng magic link email · quét mỗi phút · xung đột "bản mới nhất thắng" · Vitest · iOS để sau.
