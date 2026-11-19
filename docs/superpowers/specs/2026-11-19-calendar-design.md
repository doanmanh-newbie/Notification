# Màn hình Lịch — Thiết kế ngắn

Ngày: 2026-11-19 · Trạng thái: chủ dự án giao tự quyết ("tự đánh tự xử lý")

## Mục đích
Xem **cả tháng để lên kế hoạch** — thấy việc nào hết hạn ngày nào, đọc ghi chú, và (vì app quản lý thời gian) thấy ngay **ngày nào quá tải, ngày nào còn trống**.

## Phạm vi đợt này
1. Lưới tháng (T2→CN, 6 tuần), điều hướng tháng trước/sau/hôm nay; hôm nay có viền.
2. Mỗi ô ngày: tối đa 3 việc (chấm màu ưu tiên + tiêu đề, việc xong gạch ngang, quá hạn màu đỏ), "+N", **thanh tải ngày**.
3. Bấm ngày → khung chi tiết: mọi việc của ngày với **ghi chú** và **thời gian hết hạn** ("Hôm nay", "Quá hạn 2 ngày", "nhắc 08:00"); bấm việc → mở trang chi tiết sẵn có.
4. **Thêm việc nhanh** vào ngày đang chọn.
5. **Kéo thả** việc sang ngày khác để dời hạn (giữ nguyên giờ nhắc, đổi ngày).
6. **Tải ngày** = tổng phút "độ nặng" (Nhẹ 15', Vừa 45', Sâu 2h) của việc chưa xong; sức chứa 6 giờ (như "Tải hôm nay"). Mức: trống / vừa / nhiều (>60%) / quá tải (>100%).
7. Ngày quá tải → cảnh báo + **gợi ý ngày còn trống gần nhất** + nút "Dời việc ít ưu tiên nhất sang …".
8. Lọc theo dự án.

**Để sau:** chế độ tuần, ngày lễ, xuất .ics, hiển thị trước các lần lặp tương lai.

## Quyết định (của người làm)
- Ngày của một việc = `due`, nếu không có thì ngày của `remindAt`. Việc không có cả hai không lên lịch.
- Tự viết lưới (không thư viện lịch) để nhẹ và hợp giao diện; container query: ô hẹp chỉ hiện chấm, khung chi tiết nằm dưới lưới khi hẹp, bên phải khi rộng.
- Không đổi dữ liệu/máy chủ: dời ngày chỉ là `updateTask({ due, remindAt })` → đồng bộ như mọi sửa đổi khác.
- Logic thuần ở `src/lib/calendar.ts` (có test); giao diện ở `src/components/CalendarView.tsx`.

## Phản mục tiêu
Lịch rối mắt trên điện thoại; kéo thả làm mất giờ nhắc; tính tải sai múi giờ (chỉ dùng ngày cục bộ dạng chuỗi).
