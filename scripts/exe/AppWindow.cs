// The native window hosting the web app (WebView2). Kept in its own file/class so the launcher can
// register assembly resolving before any WebView2 type is loaded.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

sealed class AppWindow : Form
{
    readonly WebView2 web = new WebView2();
    bool allowClose;
    bool toldAboutTray;

    public AppWindow(bool hidden)
    {
        Text = "Nhắc Việc";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        StartPosition = FormStartPosition.CenterScreen;
        Rectangle wa = Screen.PrimaryScreen.WorkingArea;
        ClientSize = new Size(Math.Min(1320, wa.Width - 80), Math.Min(880, wa.Height - 80));
        MinimumSize = new Size(420, 520);
        web.Dock = DockStyle.Fill;
        Controls.Add(web);

        InitWebView();                                   // starts async; the form may stay hidden meanwhile
        if (hidden)
        {
            // Create the native handle (needed by WebView2) without ever showing a window.
            ShowInTaskbar = false;
            Opacity = 0;
            Show();
            Hide();
            Opacity = 1;
            ShowInTaskbar = true;
        }
        else
        {
            var h = Handle;                                  // force the native handle, then show once the message loop is running
            BeginInvoke(new Action(BringToFront));
        }
    }

    async void InitWebView()
    {
        try
        {
            string data = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NhacViec", "WebView2");
            // Keep timers/rendering at full speed while hidden in the tray, so reminders stay on time.
            var options = new CoreWebView2EnvironmentOptions("--disable-background-timer-throttling --disable-renderer-backgrounding --disable-backgrounding-occluded-windows");
            CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, data, options);
            await web.EnsureCoreWebView2Async(env);
            CoreWebView2 core = web.CoreWebView2;
            core.Settings.UserAgent = core.Settings.UserAgent + " NhacViecDesktop";   // the web app detects the desktop shell by this marker
            core.Settings.AreBrowserAcceleratorKeysEnabled = true;

            // Notifications: allow for our own origin and show them as Windows notifications.
            core.PermissionRequested += (s, e) =>
            {
                if (e.PermissionKind == CoreWebView2PermissionKind.Notifications) e.State = CoreWebView2PermissionState.Allow;
            };
            core.NotificationReceived += (s, e) =>
            {
                e.Handled = true;
                Program.Tray.ShowBalloonTip(10000, e.Notification.Title, e.Notification.Body, ToolTipIcon.Info);
                Program.Log("notification: " + e.Notification.Title + " | " + e.Notification.Body + " | windowVisible=" + Visible);
            };
            Program.Tray.BalloonTipClicked += (s, e) => BringToFront();

            // Links to other sites open in the normal browser, not inside the app.
            core.NewWindowRequested += (s, e) =>
            {
                e.Handled = true;
                try { Process.Start(new ProcessStartInfo(e.Uri) { UseShellExecute = true }); } catch { }
            };
            core.Navigate(Program.Url);
        }
        catch (Exception)
        {
            // WebView2 runtime missing/broken → let the launcher use a Chrome/Edge app window instead.
            Program.OnWebViewFailed();
        }
    }

    public new void BringToFront()
    {
        if (!Visible) Show();
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
        base.BringToFront();
    }

    public void AllowClose() { allowClose = true; }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        // X (or any close request) = hide to tray and keep running. Real exit only via the tray menu or Windows shutdown.
        if (!allowClose && e.CloseReason != CloseReason.WindowsShutDown && e.CloseReason != CloseReason.TaskManagerClosing)
        {
            e.Cancel = true;
            Hide();
            if (!toldAboutTray)
            {
                toldAboutTray = true;
                Program.Tray.ShowBalloonTip(4000, "Nhắc Việc vẫn chạy ngầm",
                    "App thu xuống khay hệ thống để tiếp tục nhắc việc. Chuột phải biểu tượng → Thoát để tắt hẳn.", ToolTipIcon.Info);
            }
            return;
        }
        base.OnFormClosing(e);
    }
}
