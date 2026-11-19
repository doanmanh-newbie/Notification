# Kiến thức: biến web app Nhắc Việc thành file .exe

## 1. Web app khác app "cài đặt" thế nào?
Nhắc Việc là **PWA** — giao diện HTML/CSS/JS chạy trong trình duyệt. Trình duyệt cho web app nhiều khả năng như app thật (cài vào Start menu, chạy offline, nhận thông báo) **nhưng chỉ trong "secure context"**: trang phải là `https://…` hoặc `http://localhost`. Vì vậy mọi cách chạy local đều phục vụ app ở `http://localhost:4173`.

## 2. Ba cách làm .exe
| Cách | Bên trong | Dung lượng | Cần để build |
|---|---|---|---|
| Electron | Nhúng cả trình duyệt Chromium | ~100–150 MB | Node, electron-builder |
| Tauri | Dùng WebView2 có sẵn của Windows | ~5–10 MB | Rust, Visual Studio Build Tools |
| **Launcher (đang dùng)** | Exe nhỏ = web server localhost + biểu tượng khay, mở app bằng Chrome/Edge | **~550 KB** | Không gì — `csc.exe` có sẵn trong Windows |
Ta chọn launcher vì push notification của app đi qua service worker của Chrome/Edge — giữ nguyên được mọi thứ đã kiểm chứng.

## 3. Bên trong `NhacViec.exe` (`scripts/exe/NhacViec.cs`)
- **HttpListener**: web server của .NET, nghe `http://localhost:4173/` → chỉ máy này kết nối được.
- **Embedded resources**: lúc build, mỗi file trong `dist/` được nhúng vào exe với tên `app/<đường dẫn>`. Server chỉ đọc từ đây, không đụng ổ đĩa → không bị lỗi "path traversal" (`../../Windows/...`), và **chỉ cần đúng 1 file**.
- **SPA fallback**: đường dẫn lạ không có đuôi file → trả `index.html` để React tự định tuyến.
- **Mutex**: khoá có tên toàn hệ thống; mở exe lần 2 thấy khoá đã có → chỉ mở trình duyệt rồi thoát.
- **NotifyIcon**: biểu tượng ở khay hệ thống, menu Mở / Khởi động cùng Windows / Thoát. `/target:winexe` → không có cửa sổ đen.
- **Khởi động cùng Windows**: ghi một giá trị vào `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` (của riêng người dùng, không cần Admin), chạy kèm `--background` để không bật trình duyệt lúc khởi động.

## 4. Biên dịch (`scripts/build-exe.mjs`)
`csc.exe` (trình biên dịch C# 5 đi kèm .NET Framework 4, có sẵn trên Windows 10/11) đọc `.cs` → sinh `.exe`. Các tham số chính: `/target:winexe`, `/win32icon:icon.ico`, `/resource:<file>,<tên>` cho từng file của app. Build trong thư mục tạm không dấu vì công cụ cũ hay lỗi với đường dẫn tiếng Việt.

## 5. "Cài đặt" một exe là gì?
Chép exe vào chỗ cố định + tạo shortcut. `C:\Program Files` (mọi người dùng, cần Admin) hoặc `%LOCALAPPDATA%\Programs` (riêng một người, không cần Admin — máy bạn đang dùng cách này). Shortcut tạo bằng API `IShellLinkW` (bản Unicode) vì `WScript.Shell` lỗi với chữ tiếng Việt.

## 6. Cảnh báo "Windows protected your PC" (SmartScreen)
Exe tải từ Internet/Zalo **chưa có chữ ký số** sẽ bị cảnh báo → "More info" → "Run anyway". Muốn hết cảnh báo phải mua **chứng chỉ ký mã (code signing)** và ký bằng `signtool` — làm khi phát hành rộng. Một số phần mềm diệt virus cũng nghi ngờ exe nhỏ chưa ký; khi đó dùng thư mục `du-phong` (bat + PowerShell).

## 7. Có cần Supabase không?
- **Bản thường** (`NhacViec.zip`): cần — máy chủ chạy 24/7 mới gửi được thông báo **khi app đã đóng**, và lo tài khoản/đồng bộ nhiều máy.
- **Bản Offline** (`NhacViec-Offline.zip`, build với `VITE_OFFLINE=1`): không kết nối máy chủ nào; dữ liệu chỉ trên máy đó; **chỉ nhắc khi cửa sổ app đang mở**. Hằng `import.meta.env.VITE_*` được Vite thay lúc build nên bản offline không chứa khoá Supabase.

## 8. Cửa sổ riêng bằng WebView2 (không Chrome)
**WebView2** là bộ máy trình duyệt Edge mà Microsoft cài sẵn trong Windows 11 (và hầu hết Windows 10) để ứng dụng nhúng vào cửa sổ của mình — Teams, Outlook mới đều dùng. `NhacViec.exe` tạo một cửa sổ WinForms thật (biểu tượng chữ N, tiêu đề "Nhắc Việc") và đặt WebView2 bên trong, trỏ vào server localhost của chính nó. Người dùng thấy một phần mềm Windows bình thường, không có Chrome.

**Nhúng thư viện:** 3 DLL của Microsoft (`Core`, `WinForms`, `WebView2Loader`, đều có chữ ký số, ~0,9 MB) được nhúng vào exe. DLL .NET nạp thẳng từ bộ nhớ qua `AppDomain.AssemblyResolve`; DLL native `WebView2Loader` phải là file thật nên được ghi ra `%LOCALAPPDATA%NhacViecin` rồi `SetDllDirectory`. Tải một lần bằng `node scripts/fetch-webview2.mjs` (tự kiểm chữ ký).

**Chạy ngầm trong khay:** bấm X → `FormClosing` bị huỷ + `Hide()`, trình duyệt WebView2 vẫn sống nên bộ nhắc trong app (kiểm tra mỗi 15 giây) vẫn chạy. Các cờ `--disable-background-timer-throttling` / `--disable-renderer-backgrounding` ngăn Chromium làm chậm bộ đếm khi cửa sổ ẩn. Chỉ "Thoát" ở khay mới tắt hẳn. Windows tắt máy (`CloseReason.WindowsShutDown`) vẫn đóng bình thường.

**Thông báo:** WebView2 **không có Web Push** (máy chủ không đẩy xuống được khi app đã thoát). Bù lại, app nhận ra vỏ Windows qua đuôi User-Agent `NhacViecDesktop`, tự cho phép quyền Notification, và bắt sự kiện `NotificationReceived` để hiện thành thông báo Windows qua biểu tượng khay. Kiểm chứng: đặt nhắc khi cửa sổ đang ẩn → thông báo đến đúng giờ. Đánh đổi: **thoát hẳn app = hết nhắc**; muốn vậy phải bật "Khởi động cùng Windows" (chạy ngầm khi mở máy).

**Khởi động cùng Windows:** khoá `HKCU...Run` chạy `NhacViec.exe --background` → không hiện cửa sổ nhưng trang vẫn chạy.

**Một bản duy nhất:** Mutex. Mở lần hai gọi `http://localhost:4173/__show` (chỉ chấp nhận từ loopback) để bản đang chạy hiện cửa sổ lại.

**Không có WebView2:** exe tự lùi về cửa sổ Chrome/Edge `--app=URL` (app mode), vẫn dùng được.

**Bài học khi kiểm thử:** gửi `WM_CLOSE` từ tiến trình khác bị Windows coi là `TaskManagerClosing` chứ không phải `UserClosing`; mô phỏng nút X đúng là `WM_SYSCOMMAND/SC_CLOSE`. Chẩn đoán: `%LOCALAPPDATA%NhacVieclog.txt`; gỡ lỗi trang bằng biến môi trường `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333` rồi nối Playwright qua CDP.

## 9. Lệnh
```powershell
npx pnpm@10.34.3 build:exe   # chỉ build release/NhacViec.exe
npx pnpm@10.34.3 pack:win    # build 2 gói zip để gửi người khác
```
