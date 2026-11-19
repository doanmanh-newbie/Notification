// Compile the single-file Windows launcher: release/NhacViec.exe (web app embedded as resources).
// Usage: node scripts/build-exe.mjs [--skip-vite]
// Needs only Windows' built-in .NET Framework 4 compiler (csc.exe) — no SDK install.
import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const csc = path.join(process.env.WINDIR ?? 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe')

export function buildExe(outFile = path.join(root, 'release', 'NhacViec.exe'), { skipVite = false } = {}) {
  if (!fs.existsSync(csc)) throw new Error(`Không tìm thấy trình biên dịch C#: ${csc}`)
  if (!skipVite) execSync('npx -y pnpm@10.34.3 run build', { cwd: root, stdio: 'inherit' })

  // Old tools choke on non-ASCII paths (this project lives in "D:\Ứng Dụng ..."), so compile in an ASCII temp dir.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-exe-'))
  try {
    fs.cpSync(path.join(root, 'dist'), path.join(work, 'app'), { recursive: true })
    for (const f of ['NhacViec.cs', 'AppWindow.cs']) fs.copyFileSync(path.join(root, 'scripts', 'exe', f), path.join(work, f))
    // Microsoft's WebView2 libraries (signed DLLs, fetched once by scripts/fetch-webview2.mjs).
    const libSrc = path.join(root, 'scripts', 'exe', 'lib')
    const libs = ['Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll']
    for (const l of libs) if (!fs.existsSync(path.join(libSrc, l))) throw new Error('Thiếu ' + l + ' — chạy: node scripts/fetch-webview2.mjs')
    fs.mkdirSync(path.join(work, 'lib'))
    for (const l of libs) fs.copyFileSync(path.join(libSrc, l), path.join(work, 'lib', l))
    fs.copyFileSync(path.join(root, 'scripts', 'release', 'icon.ico'), path.join(work, 'icon.ico'))

    const files = []
    const walk = (dir) => {
      for (const e of fs.readdirSync(path.join(work, dir), { withFileTypes: true })) {
        const rel = path.posix.join(dir, e.name)
        e.isDirectory() ? walk(rel) : files.push(rel)
      }
    }
    walk('app')
    // One "/resource:<file>,<name>" per app file; the name ("app/assets/x.js") is what the server looks up.
    const rsp = [
      '/nologo', '/optimize+', '/target:winexe', '/platform:anycpu',
      '/win32icon:icon.ico', '/out:NhacViec.exe',
      '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
      '/reference:lib/Microsoft.Web.WebView2.Core.dll', '/reference:lib/Microsoft.Web.WebView2.WinForms.dll',
      ...libs.map((l) => `"/resource:lib/${l},lib/${l}"`),
      ...files.map((f) => `"/resource:${f.split('/').join('\\')},${f}"`),
      'NhacViec.cs', 'AppWindow.cs',
    ]
    fs.writeFileSync(path.join(work, 'build.rsp'), rsp.join('\r\n'))
    execFileSync(csc, ['@build.rsp'], { cwd: work, stdio: 'inherit' })

    fs.mkdirSync(path.dirname(outFile), { recursive: true })
    try {
      fs.copyFileSync(path.join(work, 'NhacViec.exe'), outFile)
    } catch (e) {
      if (e.code === 'EBUSY' || e.code === 'EPERM') throw new Error('NhacViec.exe đang chạy — chuột phải biểu tượng ở khay → Thoát, rồi build lại.')
      throw e
    }
    console.log(`exe ready: ${outFile} (${Math.round(fs.statSync(outFile).size / 1024)} KB, ${files.length} embedded files)`)
    return outFile
  } finally {
    fs.rmSync(work, { recursive: true, force: true })
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  buildExe(undefined, { skipVite: process.argv.includes('--skip-vite') })
}
