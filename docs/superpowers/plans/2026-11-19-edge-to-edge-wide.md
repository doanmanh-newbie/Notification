# Edge-to-Edge + Wide Container — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native, đã được chọn). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Tràn viền trên điện thoại (safe-area) và khung rộng 1440px chia cột theo vùng chứa trên máy tính.

**Architecture:** Thêm lớp `.wide` + biến safe-area trong `index.css`; `<main>` thành `@container` để các màn hình chia cột bằng container query của Tailwind v4 (`@5xl:` = 64rem, `@7xl:` = 80rem), nên mở TaskPanel tự giảm cột. Không đổi logic.

**Tech Stack:** Tailwind CSS v4 (container queries có sẵn), React 19.

**Spec:** `docs/superpowers/specs/2026-11-19-edge-to-edge-wide-design.md`

## Global Constraints
- Khung tối đa `1440px`; lề ngang `clamp(16px, 4vw, 48px)` + `env(safe-area-inset-left/right)`.
- Mốc chia cột: 2 cột khi vùng nội dung ≥ `64rem` (≈ cửa sổ 1280px có sidebar 248px), 3 cột (Tất cả việc) khi ≥ `80rem` (≈ cửa sổ 1530px).
- Tiêu đề/đoạn mô tả `max-w-prose`.
- Vùng bấm hàng việc trên mobile ≥ 44px.
- Không đổi màu, font, chữ, logic, sidebar desktop 248px.

## Review Focus
1. Tai thỏ / thanh điều hướng Android che thanh trên cùng, toast, đáy danh sách khi chạy standalone → mọi phần tử fixed/sticky cộng `env(safe-area-inset-*)`.
2. Mở TaskPanel ở 1280px làm 2 cột quá hẹp → cột dựa vào container, không vào viewport.
3. Chiều cao nhảy khi thanh địa chỉ mobile co giãn → `h-dvh`.
4. Cột "Tiếp theo" sticky dài hơn màn hình bị cắt → sticky chỉ khi đủ cao, cột tự cuộn trong `<main>`.
5. Dòng chữ quá dài ở 1600px → `max-w-prose` cho đoạn văn.
(Không có test tự động cho layout; kiểm bằng ảnh chụp ở 375/768/1280/1600px, có/không TaskPanel.)

---

### Task 1: Khung chung
**Files:** `index.html`, `src/index.css`, `src/App.tsx`
- [ ] `index.html`: viewport `width=device-width, initial-scale=1.0, viewport-fit=cover`.
- [ ] `index.css` (trong `@layer components`): `.wide` theo Global Constraints; `.pt-safe/.pb-safe` = `env(safe-area-inset-top/bottom)`.
- [ ] `App.tsx`: khung `h-dvh`; `<main>` thêm `@container`; thanh trên mobile tràn mép + `pt-safe`; ngăn kéo sidebar `pt-safe pb-safe`.
- [ ] Kiểm tra: `pnpm typecheck`, `pnpm build`.

### Task 2: Mobile tràn viền
**Files:** `TaskRow.tsx`, `TaskPanel.tsx`, `Reminders.tsx`, 4 view
- [ ] Hàng việc: `min-h-11` (44px) trên mobile; danh sách bỏ `-mx-2` lệch mép ở mobile, kẻ `divide-y divide-stone-100` < `sm`.
- [ ] TaskPanel toàn màn hình mobile: header `pt-safe`, đáy `pb-safe`.
- [ ] Toast: `bottom` = `max(20px, env(safe-area-inset-bottom))`.

### Task 3: Chia cột
**Files:** `FocusView.tsx`, `ListView.tsx`
- [ ] FocusView: bọc `.wide`; khi `@5xl` thành grid `[minmax(0,1fr)_minmax(320px,400px)]`: trái = ngày/lời chào/tóm tắt/năng lượng+tải/"Bắt đầu với"; phải = "Tiếp theo" + "Để sau", `@5xl:sticky @5xl:top-6 self-start`. Dưới `@5xl` giữ thứ tự 1 cột như cũ.
- [ ] ListView: bọc `.wide`; các nhóm trong grid `@5xl:grid-cols-2 @7xl:grid-cols-3 gap-x-10`; "việc đã xong" bên dưới full width.

### Task 4: Ma trận + Bản đồ
**Files:** `MatrixView.tsx`, `GraphView.tsx`
- [ ] Thay `mx-auto max-w-[1100px] px-6 sm:px-12` bằng `.wide`; đoạn mô tả `max-w-prose`.

### Task 5: Kiểm tra
- [ ] Ảnh chụp 375×812, 768×1024, 1280×800, 1600×900; ở 1280 mở TaskPanel → còn 1 cột.
- [ ] `pnpm test` (45 pass), `pnpm typecheck`, `pnpm build`. Commit `feat(ui): edge-to-edge mobile + wide container columns`.
