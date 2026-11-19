// One-time: download Microsoft.Web.WebView2 from nuget.org and keep the 3 DLLs the exe embeds in scripts/exe/lib/ (git-ignored).
// The DLLs are Authenticode-signed by Microsoft; we verify the signature before keeping them.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const VERSION = '1.0.4314.35'
const root = path.resolve(import.meta.dirname, '..')
const libDir = path.join(root, 'scripts', 'exe', 'lib')
const wanted = {
  'lib/net462/Microsoft.Web.WebView2.Core.dll': 'Microsoft.Web.WebView2.Core.dll',
  'lib/net462/Microsoft.Web.WebView2.WinForms.dll': 'Microsoft.Web.WebView2.WinForms.dll',
  'runtimes/win-x64/native/WebView2Loader.dll': 'WebView2Loader.dll',
}
if (Object.values(wanted).every((f) => fs.existsSync(path.join(libDir, f)))) {
  console.log('WebView2 DLLs already present')
  process.exit(0)
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wv2-'))
const url = `https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/${VERSION}/microsoft.web.webview2.${VERSION}.nupkg`
const res = await fetch(url)
if (!res.ok) throw new Error(`download failed: ${res.status}`)
fs.writeFileSync(path.join(tmp, 'pkg.zip'), Buffer.from(await res.arrayBuffer()))
execFileSync('powershell', ['-NoProfile', '-Command', `Expand-Archive -Force '${path.join(tmp, 'pkg.zip')}' '${path.join(tmp, 'x')}'`], { stdio: 'inherit' })
fs.mkdirSync(libDir, { recursive: true })
for (const [from, to] of Object.entries(wanted)) fs.copyFileSync(path.join(tmp, 'x', from), path.join(libDir, to))
const check = execFileSync('powershell', ['-NoProfile', '-Command', `Get-ChildItem '${libDir}\*.dll' | ForEach-Object { $s = Get-AuthenticodeSignature $_.FullName; if ($s.Status -ne 'Valid' -or $s.SignerCertificate.Subject -notlike '*Microsoft Corporation*') { 'BAD ' + $_.Name } }`]).toString()
if (check.includes('BAD')) { fs.rmSync(libDir, { recursive: true, force: true }); throw new Error('signature check failed:\n' + check) }
fs.rmSync(tmp, { recursive: true, force: true })
console.log('WebView2 DLLs ready (Microsoft-signed):', Object.values(wanted).join(', '))
