# Nhac Viec - tiny static server (no install needed: uses Windows PowerShell + .NET HttpListener).
# Serves ./app on http://localhost:<Port>/ only (not reachable from other machines).
param([int]$Port = 4173)

$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot 'app'
$prefix = "http://localhost:$Port/"
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'
  '.png' = 'image/png'; '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.txt' = 'text/plain; charset=utf-8'
  '.woff2' = 'font/woff2'; '.map' = 'application/json'
}

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add($prefix)
try { $listener.Start() } catch {
  Write-Host "Khong mo duoc cong $Port (co the dang co chuong trinh khac dung). Loi: $($_.Exception.Message)"
  Read-Host 'Nhan Enter de dong'
  exit 1
}

Write-Host ''
Write-Host "Nhac Viec dang chay tai $prefix  (chi may nay truy cap duoc)"
Write-Host 'Giu cua so nay mo. Dong cua so = tat app.'
Start-Process $prefix

$rootFull = [System.IO.Path]::GetFullPath($root)
while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $path = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
    # Never serve outside ./app (path traversal); unknown routes fall back to the SPA shell.
    if (-not $path.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
      if ([System.IO.Path]::HasExtension($rel)) { $res.StatusCode = 404; $res.Close(); continue }
      $path = Join-Path $root 'index.html'
    }
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
    if ($rel -like 'assets/*') { $res.Headers['Cache-Control'] = 'public, max-age=31536000, immutable' }
    else { $res.Headers['Cache-Control'] = 'no-cache' }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $res.ContentLength64 = $bytes.Length
    if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
  } catch { $res.StatusCode = 500 }
  finally { try { $res.Close() } catch {} }
}
