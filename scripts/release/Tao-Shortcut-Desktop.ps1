# Creates a "Nhắc Việc" shortcut on the Desktop that starts the app (console window minimized).
# Uses the Unicode IShellLinkW API so Vietnamese folder names / OneDrive desktops work
# (WScript.Shell fails on characters outside the ANSI code page).
param(
  [string]$Target = $(if (Test-Path (Join-Path $PSScriptRoot 'NhacViec.exe')) { Join-Path $PSScriptRoot 'NhacViec.exe' } else { Join-Path $PSScriptRoot 'Chay-Nhac-Viec.bat' }),
  [ValidateSet('Desktop','StartMenu')][string]$Where = 'Desktop',
  [string]$Icon = $(if (Test-Path (Join-Path $PSScriptRoot 'icon.ico')) { Join-Path $PSScriptRoot 'icon.ico' } else { '' })
)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class NvShortcut {
  [ComImport, Guid("00021401-0000-0000-C000-000000000046")] class ShellLink {}
  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("000214F9-0000-0000-C000-000000000046")]
  interface IShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c, IntPtr fd, int fl);
    void GetIDList(out IntPtr p); void SetIDList(IntPtr p);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder n, int c);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string n);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder d, int c);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string d);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder a, int c);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string a);
    void GetHotkey(out short k); void SetHotkey(short k);
    void GetShowCmd(out int s); void SetShowCmd(int s);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder p, int c, out int i);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string p, int i);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string p, int r);
    void Resolve(IntPtr h, int f);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string f);
  }
  [ComImport, InterfaceType(ComInterfaceType.InterfaceIsIUnknown), Guid("0000010b-0000-0000-C000-000000000046")]
  interface IPersistFile {
    void GetClassID(out Guid g); [PreserveSig] int IsDirty();
    void Load([MarshalAs(UnmanagedType.LPWStr)] string f, int m);
    void Save([MarshalAs(UnmanagedType.LPWStr)] string f, bool r);
    void SaveCompleted([MarshalAs(UnmanagedType.LPWStr)] string f);
    void GetCurFile([MarshalAs(UnmanagedType.LPWStr)] out string f);
  }
  public static void Create(string lnk, string target, string workDir, string icon, string desc) {
    var link = (IShellLinkW)new ShellLink();
    link.SetPath(target);
    link.SetWorkingDirectory(workDir);
    link.SetDescription(desc);
    link.SetShowCmd(7); // SW_SHOWMINNOACTIVE: keep the server console minimized
    if (!string.IsNullOrEmpty(icon)) link.SetIconLocation(icon, 0);
    ((IPersistFile)link).Save(lnk, true);
  }
}
'@

$target = (Resolve-Path $Target).Path
$icon = if ($Icon -and (Test-Path $Icon)) { (Resolve-Path $Icon).Path } elseif ($target -like '*.exe') { $target } else { '' }
$folder = if ($Where -eq 'StartMenu') { [Environment]::GetFolderPath('Programs') } else { [Environment]::GetFolderPath('Desktop') }
$lnk = Join-Path $folder 'Nhắc Việc.lnk'
[NvShortcut]::Create($lnk, $target, (Split-Path $target), $icon, 'Nhắc Việc - nhắc việc cá nhân')
Write-Host "Da tao bieu tuong: $lnk"
