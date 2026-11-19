# Edge-to-Edge + Wide Container — Thiết kế ngắn

Ngày: 2026-11-19 · Trạng thái: chờ duyệt

## Mục đích
- **Edge-to-edge:** trên điện thoại (nhất là khi cài thành app), nền, thanh trên cùng và danh sách tràn sát mép; giao diện vẽ cả dưới thanh trạng thái / thanh điều hướng Android nhưng nội dung không bị che.
- **Wide container:** trên màn rộng, dùng chiều ngang thêm ra cho có ích thay vì một cột hẹp ở giữa.

## Hiện trạng
Mỗi màn hình tự bó: Tập trung 760px, Danh sách 860px, Ma trận/Bản đồ 1100px, lề 24–48px. Không có `viewport-fit=cover`, không tính safe-area, khung dùng `h-screen` (100vh, lệch trên mobile).

## Hướng đã chọn — B: Wide container + chia cột theo nội dung
(Đã cân nhắc A: chỉ nới khung rộng chung ~1280px — đơn giản nhưng dòng chữ dài khó đọc, không tận dụng chỗ trống. Chủ dự án chọn B.)

## Thiết kế
**Khung chung (mọi màn)**
- `index.html`: `viewport-fit=cover`; `theme-color` giữ `#f7f6f3`.
- Khung app dùng `h-dvh` thay `h-screen`.
- Một lớp tiện ích `.wide` trong `index.css`: `max-width: 1440px; margin-inline: auto; padding-inline: clamp(16px, 4vw, 48px)` + cộng `env(safe-area-inset-left/right)`.
- Mỗi màn bỏ `max-w-[…]` riêng, dùng `.wide`. Tiêu đề/đoạn mô tả giữ `max-w-prose` (~65 ký tự) để dễ đọc.

**Mobile (< 768px) — edge-to-edge**
- Thanh trên cùng sticky, nền tràn mép, có `padding-top: env(safe-area-inset-top)`.
- Danh sách việc tràn mép: bỏ bo góc/viền thẻ, phân tách bằng đường kẻ mảnh; vùng bấm cao ≥ 44px.
- Cuối trang chừa `env(safe-area-inset-bottom)`; toast nhắc việc và `TaskPanel` toàn màn hình cũng tính safe-area.
- Sidebar dạng ngăn kéo: tính safe-area trên/dưới.

**Desktop — chia cột (B)**
| Màn | < 1280px | ≥ 1280px |
|---|---|---|
| Tập trung | 1 cột như hiện tại | 2 cột: trái = lời chào, tóm tắt, năng lượng, "Bắt đầu với"; phải = "Tiếp theo" + "Để sau" (sticky) |
| Tất cả việc | 1 cột, nhóm theo ưu tiên | Lưới nhóm 2 cột (≥1280) / 3 cột (≥1600); mỗi nhóm là một cột độc lập |
| Ma trận | 2×2 | 2×2, rộng hơn (tận dụng 1440px) |
| Bản đồ liên kết | rộng theo khung | dùng hết khung 1440px |
- Khi `TaskPanel` mở bên phải (≥1024px), vùng nội dung hẹp lại → số cột tự giảm theo chiều rộng vùng chứa (container queries `@container`), không theo chiều rộng cửa sổ.

## Không làm
Không đổi màu, font, logic, nội dung chữ; không làm chế độ tối; không đổi sidebar desktop (248px).

## Phản mục tiêu
Nội dung bị tai thỏ/thanh điều hướng che; dòng chữ dài quá ~80 ký tự trên màn rộng; layout nhảy khi mở/đóng TaskPanel.

## Để người làm tự quyết (lựa chọn của tôi)
Mốc 1280/1600px, khung tối đa 1440px, dùng container queries của Tailwind v4 (`@container`, `@5xl:` …), độ dày đường kẻ phân tách trên mobile.

## Kiểm tra
Xem ở 375px (mobile), 768px, 1280px, 1600px, có và không mở TaskPanel; build + 45 test vẫn qua.
