// Nhắc Việc — Windows app (single .exe).
// Build: node scripts/build-exe.mjs  (csc.exe of .NET Framework 4 = C# 5 syntax; WebView2 DLLs are embedded).
//
//  * Serves the embedded web app on http://localhost:4173/ (HttpListener, localhost only).
//  * Shows it in its OWN native window (WebView2 = the Edge engine built into Windows) — no Chrome, no tabs, no address bar.
//  * Closing the window (X) hides it to the system tray; the page keeps running so reminders still fire.
//    Reminders become Windows notifications. "Thoát" in the tray menu really quits.
//  * Optional "start with Windows" (HKCU\...\Run, launches hidden with --background).
//  * One copy only (Mutex); starting again just brings the window back.
//  * If the WebView2 runtime is missing, falls back to a Chrome/Edge "--app" window.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("Nhắc Việc")]
[assembly: AssemblyProduct("Nhắc Việc")]
[assembly: AssemblyDescription("Nhắc việc cá nhân")]
[assembly: AssemblyVersion("1.1.0.0")]
[assembly: AssemblyFileVersion("1.1.0.0")]

static class Program
{
    const int Port = 4173;
    internal static readonly string Url = "http://localhost:" + Port + "/";
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string RunName = "NhacViec";
    static HttpListener listener;
    internal static NotifyIcon Tray;
    static object host;                       // AppWindow (kept as object so Main can hook assembly loading before WebView2 types are touched)
    static bool useBrowserFallback;

    static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" }, { ".js", "text/javascript; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" }, { ".json", "application/json" },
        { ".webmanifest", "application/manifest+json" }, { ".png", "image/png" },
        { ".svg", "image/svg+xml" }, { ".ico", "image/x-icon" }, { ".txt", "text/plain; charset=utf-8" },
        { ".woff2", "font/woff2" }
    };

    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern bool SetDllDirectory(string path);

    [STAThread]
    static void Main(string[] args)
    {
        try { SetProcessDPIAware(); } catch { }
        bool firstInstance;
        using (var mutex = new Mutex(true, @"Local\NhacViec.Launcher", out firstInstance))
        {
            if (!firstInstance) { AskRunningInstanceToShow(); return; }
            if (!StartServer()) return;

            PrepareEmbeddedLibraries();
            Application.EnableVisualStyles();
            Tray = BuildTray();
            bool background = Array.IndexOf(args, "--background") >= 0;   // "start with Windows"

            startedHidden = background;
            try { host = CreateWindow(background); }
            catch (Exception) { useBrowserFallback = true; if (!background) OpenInAppWindowFallback(); }

            Application.Run();
            Tray.Visible = false;
            Tray.Dispose();
            listener.Stop();
        }
    }

    static bool startedHidden;

    // Tiny diagnostic log: %LOCALAPPDATA%\NhacViec\log.txt (kept under 100 KB).
    internal static void Log(string line)
    {
        try
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NhacViec");
            Directory.CreateDirectory(dir);
            string file = Path.Combine(dir, "log.txt");
            if (File.Exists(file) && new FileInfo(file).Length > 100000) File.Delete(file);
            File.AppendAllText(file, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + "  " + line + "\r\n");
        }
        catch { }
    }

    internal static void OnWebViewFailed()
    {
        if (useBrowserFallback) return;
        useBrowserFallback = true;
        if (!startedHidden) OpenInAppWindowFallback();
    }

    // WebView2 types live in AppWindow; creating it in its own method keeps the JIT from needing them earlier.
    [MethodImpl(MethodImplOptions.NoInlining)]
    static object CreateWindow(bool hidden) { return new AppWindow(hidden); }

    // ---------- embedded WebView2 DLLs ----------
    static string LibDir
    {
        get { return Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "NhacViec", "bin"); }
    }

    static byte[] ReadResource(string name)
    {
        using (Stream s = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
        {
            if (s == null) return null;
            var ms = new MemoryStream();
            s.CopyTo(ms);
            return ms.ToArray();
        }
    }

    static void PrepareEmbeddedLibraries()
    {
        // Managed DLLs: loaded straight from memory when the runtime asks for them.
        AppDomain.CurrentDomain.AssemblyResolve += (s, e) =>
        {
            string n = new AssemblyName(e.Name).Name;
            byte[] data = ReadResource("lib/" + n + ".dll");
            return data == null ? null : Assembly.Load(data);
        };
        // Native loader must be a real file next to a LoadLibrary search path.
        try
        {
            Directory.CreateDirectory(LibDir);
            string target = Path.Combine(LibDir, "WebView2Loader.dll");
            byte[] data = ReadResource("lib/WebView2Loader.dll");
            if (data != null && (!File.Exists(target) || new FileInfo(target).Length != data.Length)) File.WriteAllBytes(target, data);
            SetDllDirectory(LibDir);
        }
        catch { }
    }

    // ---------- web server ----------
    static bool StartServer()
    {
        try
        {
            listener = new HttpListener();
            listener.Prefixes.Add(Url);                        // localhost only: other machines cannot connect
            listener.Start();
        }
        catch (Exception e)
        {
            MessageBox.Show("Không mở được cổng " + Port + " (có thể một chương trình khác đang dùng cổng này).\n\n" + e.Message,
                "Nhắc Việc", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return false;
        }
        var t = new Thread(Serve);
        t.IsBackground = true;
        t.Start();
        return true;
    }

    static void Serve()
    {
        while (listener.IsListening)
        {
            HttpListenerContext ctx;
            try { ctx = listener.GetContext(); } catch { return; }
            ThreadPool.QueueUserWorkItem(_ => Handle(ctx));
        }
    }

    static void Handle(HttpListenerContext ctx)
    {
        HttpListenerResponse res = ctx.Response;
        try
        {
            string rel = Uri.UnescapeDataString(ctx.Request.Url.AbsolutePath).TrimStart('/');
            if (rel == "__show")                               // a second launch asks us to bring the window back
            {
                if (ctx.Request.RemoteEndPoint != null && IPAddress.IsLoopback(ctx.Request.RemoteEndPoint.Address)) ShowWindow();
                res.StatusCode = 204;
                return;
            }
            if (rel == "") rel = "index.html";
            byte[] data = ReadResource("app/" + rel);          // files come ONLY from embedded resources, never from disk
            if (data == null)
            {
                if (Path.HasExtension(rel)) { res.StatusCode = 404; return; }
                rel = "index.html";                           // single-page app: unknown routes → app shell
                data = ReadResource("app/" + rel);
            }
            string type;
            res.ContentType = Mime.TryGetValue(Path.GetExtension(rel), out type) ? type : "application/octet-stream";
            res.Headers["Cache-Control"] = rel.StartsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache";
            res.ContentLength64 = data.Length;
            if (ctx.Request.HttpMethod != "HEAD") res.OutputStream.Write(data, 0, data.Length);
        }
        catch { try { res.StatusCode = 500; } catch { } }
        finally { try { res.Close(); } catch { } }
    }

    static void AskRunningInstanceToShow()
    {
        try
        {
            var req = (HttpWebRequest)WebRequest.Create(Url + "__show");
            req.Timeout = 3000;
            req.GetResponse().Close();
        }
        catch { OpenInAppWindowFallback(); }
    }

    // ---------- tray ----------
    static NotifyIcon BuildTray()
    {
        var menu = new ContextMenuStrip();
        menu.Items.Add("Mở Nhắc Việc", null, (s, e) => ShowWindow());
        menu.Items.Add("Mở trong trình duyệt", null, (s, e) => OpenInBrowserTab());
        var auto = new ToolStripMenuItem("Khởi động cùng Windows");
        auto.Checked = IsAutoStart();
        auto.Click += (s, e) => { SetAutoStart(!auto.Checked); auto.Checked = IsAutoStart(); };
        menu.Items.Add(auto);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("Thoát (ngừng nhắc việc)", null, (s, e) => Quit());

        var icon = new NotifyIcon
        {
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath),
            Text = "Nhắc Việc — đang chạy ngầm",
            ContextMenuStrip = menu,
            Visible = true
        };
        icon.DoubleClick += (s, e) => ShowWindow();
        return icon;
    }

    internal static void ShowWindow()
    {
        if (useBrowserFallback || host == null) { OpenInAppWindowFallback(); return; }
        ((AppWindow)host).BringToFront();
    }

    internal static void Quit()
    {
        if (host != null) ((AppWindow)host).AllowClose();
        Application.Exit();
    }

    // ---------- fallbacks (no WebView2 runtime) ----------
    static void OpenInAppWindowFallback()
    {
        string browser = FindAppModeBrowser();
        try
        {
            if (browser != null) { Process.Start(new ProcessStartInfo(browser, "--app=" + Url + " --window-size=1280,860") { UseShellExecute = false }); return; }
        }
        catch { }
        OpenInBrowserTab();
    }

    internal static void OpenInBrowserTab()
    {
        try { Process.Start(new ProcessStartInfo(Url) { UseShellExecute = true }); } catch { }
    }

    static string FindAppModeBrowser()
    {
        foreach (string exe in new[] { "chrome.exe", "msedge.exe" })
            foreach (RegistryKey hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
                using (RegistryKey k = hive.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                {
                    string path = k == null ? null : k.GetValue("") as string;
                    if (!string.IsNullOrEmpty(path) && File.Exists(path.Trim('"'))) return path.Trim('"');
                }
        return null;
    }

    // ---------- start with Windows ----------
    static bool IsAutoStart()
    {
        using (RegistryKey k = Registry.CurrentUser.OpenSubKey(RunKey))
            return k != null && k.GetValue(RunName) != null;
    }

    static void SetAutoStart(bool on)
    {
        using (RegistryKey k = Registry.CurrentUser.CreateSubKey(RunKey))
        {
            if (on) k.SetValue(RunName, "\"" + Application.ExecutablePath + "\" --background");
            else k.DeleteValue(RunName, false);
        }
    }
}
