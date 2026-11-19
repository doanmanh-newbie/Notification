# Nhắc Việc

Ứng dụng nhắc việc cá nhân: danh sách việc, lịch tuần / tháng, ma trận ưu tiên, nhắc giờ, Pomodoro và widget tóm tắt trên màn hình Windows.

## Tải về và chạy (Windows)

Trong thư mục [`release/`](release/):

| Gói | Dùng khi |
|---|---|
| `NhacViec.zip` | Muốn có tài khoản, đồng bộ nhiều máy, nhắc cả khi đã đóng app |
| `NhacViec-Offline.zip` | Không cần mạng; dữ liệu chỉ nằm trên máy, nhắc khi app đang mở |

Giải nén → chạy `NhacViec.exe`. Không cần cài thêm gì. Đọc `HUONG-DAN-SU-DUNG.txt` trong gói.

## Chạy từ mã nguồn

Cần Node.js 22+.

```powershell
npx pnpm@10.34.3 install
npx pnpm@10.34.3 dev          # chạy thử trên trình duyệt
npx pnpm@10.34.3 test         # kiểm thử
npx pnpm@10.34.3 pack:win     # đóng gói lại release/*.zip
```

Sao chép `.env.example` thành `.env.local` nếu muốn trỏ tới máy chủ của riêng bạn.

Công nghệ: React 19, Vite, Tailwind CSS v4, Supabase; bản Windows là một exe nhỏ dùng WebView2.

## Kiến trúc

```
shared/            Logic thuần dùng chung cho app VÀ máy chủ: giờ địa phương ↔ UTC, việc lặp lại, kết quả gửi push
src/
  main.tsx         Điểm vào: ?widget=1 → widget, còn lại → App
  App.tsx          Khung app: thanh bên, chọn màn hình, nối các phần với nhau
  core/            Logic nghiệp vụ thuần (không React, không mạng): mô hình việc, ưu tiên/điểm,
                   hiểu câu gõ tự nhiên (smart), lịch, gộp dữ liệu khi đồng bộ, chuyển đổi hàng CSDL
  state/           Kho dữ liệu của app (useStore), sao lưu, và Cài đặt người dùng (useSettings)
  services/        Giao tiếp ra ngoài: cấu hình, Supabase, đăng nhập, đồng bộ, thông báo đẩy,
                   cầu nối app ↔ widget ↔ exe Windows (bridge)
  views/           Các màn hình: Tập trung, Danh sách, Ma trận, Bản đồ liên kết, Lịch, Cài đặt
  components/      Thành phần giao diện dùng lại: dòng việc, thêm nhanh, bảng chi tiết, tài khoản…
  widget/          Widget màn hình (thanh mini / thẻ gọn / đầy đủ)
public/            Icon, manifest, service worker (chạy offline, nhận push)
scripts/           Build & đóng gói: exe/ (mã C# của NhacViec.exe), release/ (file đi kèm gói zip)
release/           Gói chạy sẵn cho Windows
```

**Quy tắc phụ thuộc** (chiều mũi tên = được phép import):

```
views / components / widget  →  state, services, core, shared
state                        →  core, shared
services                     →  state, core
core                         →  shared
shared                       →  (không gì cả — chạy được cả trên trình duyệt lẫn máy chủ Deno)
```

- Logic mới không cần giao diện → đặt ở `core/` và viết test cạnh nó (`*.test.ts`).
- Thứ gì cả app lẫn máy chủ cùng cần → `shared/` (chỉ import tương đối có đuôi `.ts`, không dùng thư viện).
- Import giữa các thư mục dùng alias `@/…` (= `src/`) và `@shared/…`, nên di chuyển file không làm gãy đường dẫn tương đối dài.
- Phần máy chủ (Supabase) không nằm trong kho công khai.
