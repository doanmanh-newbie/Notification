# Nhắc Việc — Hướng dẫn dùng thử, deploy và lên bản chính thức

## 1. Trạng thái hiện tại (bản test)
| Phần | Trạng thái |
|---|---|
| Web app (PWA) | Chạy được, cài lên màn hình chính, mở được khi mất mạng (kể cả sau lần truy cập đầu) |
| Backend Supabase (dự án **TODO**, `lsznbtcmrbeougdjgnye`) | Bảng + RLS + quyền, Vault, cron mỗi phút, 2 Edge Function (`send-reminders`, `notification-action`) |
| Thông báo đẩy | Đã thử đầu-cuối trên Chrome máy tính: đến sau ~40 giây, có nút **Xong** / **Hoãn 10 phút**; hoãn cập nhật về app qua realtime |
| Đăng nhập | Email + mật khẩu (**không** cần xác nhận email) và **Dùng thử không cần tài khoản** (ẩn danh); tài khoản dùng thử có nút **Lưu thành tài khoản thật** |
| Android (giả lập Pixel 5, Android 14, Chrome 113) | Giao diện tràn viền, đăng nhập dùng thử, đồng bộ: **chạy đúng**. Push: **chưa thử được** — image giả lập không có Play Store nên Chrome không đăng ký được FCM |
| Bản local Windows (`Chay-Nhac-Viec.bat`, `localhost:4173`) | Đã chạy thử: tải trang, service worker, đăng nhập dùng thử, đồng bộ, **push đến sau ~110 giây** |
| Chưa thử | Push trên điện thoại Android thật; bản deploy công khai |

## 2. Chạy trên máy
```powershell
npx pnpm@10.34.3 install
npx pnpm@10.34.3 dev          # http://localhost:8443  (service worker tắt ở chế độ dev)
npx pnpm@10.34.3 build; npx pnpm@10.34.3 preview --port 4174   # bản production, có service worker + push
npx pnpm@10.34.3 test         # 51 test logic
```
Cấu hình: `.env.local` (không vào git). Mẫu ở `.env.example`. Anon key đã có giá trị mặc định trong `src/lib/config.ts` (khoá công khai).

## 2a. Chạy trên laptop Windows (bản production, chỉ máy này)
1. **Bấm đúp `Chay-Nhac-Viec.bat`** trong thư mục dự án. Lần đầu tự cài thư viện (~1 phút), sau đó build và mở `http://localhost:4173`.
   - Cửa sổ đen phải **để mở**; đóng nó là tắt app. Bấm đúp lần nữa khi đang chạy chỉ mở lại trình duyệt.
   - App chỉ nghe ở `127.0.0.1` — máy khác trong mạng không truy cập được.
   - Hoặc trong terminal: `npx pnpm@10.34.3 serve`.
2. **Cài thành app Windows:** mở `http://localhost:4173` bằng Chrome/Edge → biểu tượng **Cài đặt** ở thanh địa chỉ (hoặc ⋮ → *Truyền, lưu và chia sẻ* → *Cài đặt trang dưới dạng ứng dụng*). App có cửa sổ riêng, biểu tượng trong Start menu.
3. **Thông báo:** đăng nhập → **Bật thông báo** → *Cho phép*. Thông báo hiện ở góc phải Windows, có nút **Xong** / **Hoãn 10 phút**.
   - Để nhận cả khi đã đóng cửa sổ app: Chrome → Cài đặt → Hệ thống → bật **"Tiếp tục chạy ứng dụng nền khi Google Chrome đóng"** (Edge có tuỳ chọn tương tự).
   - Kiểm tra Windows không bật *Không làm phiền / Focus*.
   - Thông báo do máy chủ Supabase gửi, nên **không cần cửa sổ đen đang chạy** để nhận nhắc — chỉ cần nó chạy khi bạn mở/dùng app (hoặc app đã cài và đã mở ít nhất một lần: service worker phục vụ bản offline).
4. **Tự chạy khi bật máy (tuỳ chọn):** Win+R → `shell:startup` → tạo shortcut tới `Chay-Nhac-Viec.bat`.

## 2b. Gửi cho người khác dùng trên máy của họ
`npx pnpm@10.34.3 pack:win` tạo 2 gói trong `release/`. Gửi file zip (Zalo, Drive, USB…). **Không gửi cả thư mục dự án** — nó chứa khoá bí mật (`.env.local`, `supabase/*.local.sql`).

| Gói | Dùng khi | Ghi chú |
|---|---|---|
| **NhacViec.zip** (~330 KB) | Người nhận muốn tài khoản, đồng bộ, nhắc cả khi đã đóng app | Dùng chung Supabase của bạn (mỗi người tài khoản riêng, RLS tách dữ liệu) |
| **NhacViec-Offline.zip** (~280 KB) | Chỉ cần nhắc việc trên một máy, không tài khoản, không Internet | Không kết nối máy chủ; chỉ nhắc khi cửa sổ app đang mở |

Mỗi gói có: `NhacViec.exe` (1 file, app nhúng sẵn, biểu tượng ở khay hệ thống), `Tao-Shortcut-Desktop.bat`, `HUONG-DAN-SU-DUNG.txt`, thư mục `du-phong` (bat + PowerShell) nếu máy chặn exe. Người nhận **không cần cài gì**. Script đóng gói tự quét khoá bí mật và kiểm tra bản offline không chứa khoá Supabase.

Lưu ý bản thường: đang tắt xác nhận email nên ai có zip cũng tạo được tài khoản. Muốn chặn: Supabase → Authentication → Sign In / Providers → tắt *Allow new users to sign up*.
Kiến thức chi tiết về exe: [KIEN-THUC-EXE.md](KIEN-THUC-EXE.md).

## 2c. Trên máy của bạn
Đã cài `NhacViec.exe` vào `%LOCALAPPDATA%\Programs\NhacViec\`, có biểu tượng **Nhắc Việc** trên Desktop và Start menu. Bấm → app mở **cửa sổ riêng (WebView2, không Chrome)**. Bấm X chỉ thu xuống khay (góc phải dưới) và vẫn chạy ngầm để nhắc việc bằng thông báo Windows; chuột phải biểu tượng khay → *Khởi động cùng Windows* để tự chạy ngầm khi bật máy, *Thoát* để tắt hẳn. Chi tiết và đánh đổi (không Web Push khi thoát hẳn): [KIEN-THUC-EXE.md](KIEN-THUC-EXE.md) mục 8.
Cập nhật sau khi sửa code: `npx pnpm@10.34.3 build:exe` → thoát app ở khay → chép `release\NhacViec.exe` đè vào thư mục trên.
(`Chay-Nhac-Viec.bat` ở gốc dự án vẫn dùng cho phát triển: build từ mã nguồn mỗi lần chạy.)

## 3. Deploy (Figma Make)
1. Đưa code lên Figma Make (đồng bộ repo / import lại thư mục này). Lệnh deploy của Figma Make: `pnpm run build` rồi `figma make deploy --build-dir dist`.
2. Sau khi có địa chỉ deploy (HTTPS), vào Supabase → **Authentication → URL Configuration**:
   - **Site URL** = địa chỉ deploy.
   - **Redirect URLs**: thêm `https://<địa-chỉ-deploy>/**` (giữ `http://localhost:8443/**`).
3. Nếu địa chỉ deploy nằm trong thư mục con (biến `FIGMA_PUBLIC_URL`), service worker và manifest đã tự theo `BASE_URL`.

## 4. Thử trên Android (checklist)
1. Mở địa chỉ deploy bằng **Chrome Android** → menu ⋮ → **Thêm vào màn hình chính** → mở từ biểu tượng *Nhắc Việc*.
2. Đăng nhập (email + mật khẩu, hoặc **Dùng thử không cần tài khoản**).
3. Thanh bên → **Bật thông báo** → **Cho phép**.
4. Bấm **Gửi thử** → **khoá máy / vuốt đóng app** → trong 1–2 phút thông báo hiện trên màn hình khoá.
5. Bấm **Hoãn 10 phút** trên thông báo → 10 phút sau nhận lại. Bấm **Xong** trên một việc lặp hằng ngày → mở app thấy hạn sang ngày mai.
6. Bật chế độ máy bay, thêm việc, tắt chế độ máy bay → việc lên máy chủ (cùng tài khoản trên máy tính sẽ thấy).
> Mẹo: nếu không nhận được, vào Cài đặt Android → Ứng dụng → Chrome → Pin → **Không hạn chế**, và kiểm tra Chrome được phép gửi thông báo.

## 5. Lên bản chính thức (việc cần làm)
- [ ] Supabase → Authentication → Sign In / Providers: **bật lại "Confirm email"**, **tắt "Allow anonymous sign-ins"**.
- [ ] Cấu hình SMTP riêng (Authentication → Emails) — email mặc định của Supabase chỉ vài thư/giờ.
- [x] "Quên mật khẩu" đã có (link qua email → form đặt mật khẩu mới). Cần SMTP riêng để gửi ổn định.
- [ ] (Khuyến nghị) bật CAPTCHA cho đăng ký và cho đăng nhập ẩn danh; dọn tài khoản ẩn danh cũ định kỳ (ví dụ cron xoá tài khoản dùng thử > 30 ngày — cần chủ dự án quyết vì xoá vĩnh viễn).
- [ ] iPhone: cần "Thêm vào Màn hình chính" trên iOS 16.4+ mới nhận push (chưa thử).

## 6. Dựng lại backend từ đầu
Xem `supabase/README.md`. Thứ tự: `0001_init.sql` → secrets (`supabase/setup-secrets.local.sql`, không vào git) → `0002_cron.sql` → `0003_grants.sql` → `0004_push_endpoint_allowlist.sql` → deploy 2 hàm (`node scripts/bundle-functions.mjs` tạo bản 1-file cho Dashboard), **tắt Verify JWT**.

## 7. Bảo mật — những gì KHÔNG được commit
`.env.local` (khoá riêng VAPID, cron secret), `supabase/*.local.sql`, `supabase/functions/.bundled/`. Khoá riêng VAPID chỉ nằm trong Supabase Vault.
