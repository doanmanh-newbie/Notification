# Backend Supabase — Nhắc Việc

Dự án: `lsznbtcmrbeougdjgnye` (`https://lsznbtcmrbeougdjgnye.supabase.co`).

## Dựng lại từ đầu
1. Chạy `migrations/0001_init.sql` (bảng, RLS, trigger "bản mới nhất thắng", realtime).
2. Tạo 4 secret trong Vault (SQL Editor) — giá trị lấy từ `.env.local` trên máy dev, **không commit**:
   ```sql
   select vault.create_secret('<VAPID_PUBLIC>', 'vapid_public');
   select vault.create_secret('<VAPID_PRIVATE>', 'vapid_private');
   select vault.create_secret('mailto:<email chủ dự án>', 'vapid_subject');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```
3. Chạy `migrations/0002_cron.sql` (hàm hỗ trợ + cron mỗi phút).
3b. Chạy `migrations/0003_grants.sql` (cấp quyền bảng cho người dùng đã đăng nhập — dự án Supabase mới không tự cấp).
3c. Chạy `migrations/0004_push_endpoint_allowlist.sql` (chỉ nhận endpoint của dịch vụ push thật).
4. Deploy hai Edge Function, **tắt "Verify JWT"** cho cả hai (chúng tự xác thực bằng `x-cron-secret` / `action_token`):
   ```
   supabase functions deploy send-reminders --no-verify-jwt --project-ref lsznbtcmrbeougdjgnye
   supabase functions deploy notification-action --no-verify-jwt --project-ref lsznbtcmrbeougdjgnye
   ```
   Thư mục `functions/_shared` được deploy kèm (logic dùng chung với web app).
5. Authentication → URL Configuration: Site URL = URL deploy của app; thêm `http://localhost:8443` vào Redirect URLs.

## Kiểm tra
- `select jobname, schedule from cron.job;` → có `send-reminders-every-minute`.
- `select status_code, content from net._http_response order by id desc limit 5;` → 200 với `{"due":…,"sent":…}`.
- Gọi `send-reminders` không có header `x-cron-secret` → 401.
