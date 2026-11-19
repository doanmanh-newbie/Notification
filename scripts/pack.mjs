// Build shareable Windows releases (no install needed on the receiving PC):
//   release/NhacViec.zip          — normal edition (accounts, sync, push even when the app is closed; uses your Supabase)
//   release/NhacViec-Offline.zip  — offline edition (no server, data stays on that PC, reminders only while open)
// Each zip: NhacViec.exe (app embedded) + guide + desktop-shortcut maker + "du-phong" fallback (bat + PowerShell server).
// Usage: node scripts/pack.mjs   (or: pnpm pack:win)
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { buildExe } from './build-exe.mjs'

const root = path.resolve(import.meta.dirname, '..')
execSync('node scripts/fetch-webview2.mjs', { cwd: root, stdio: 'inherit' })
const out = path.join(root, 'release')
const rel = (...p) => path.join(root, 'scripts', 'release', ...p)

// Server-side secrets from .env.local must never ship.
const secrets = []
const envFile = path.join(root, '.env.local')
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.+)$/)
    if (m && !m[1].startsWith('VITE_') && m[1] !== 'VAPID_PUBLIC' && m[2].trim().length >= 12) secrets.push([m[1], m[2].trim()])
  }
}
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
function scan(dir) {
  for (const file of walk(dir)) {
    const text = fs.readFileSync(file).toString('latin1') + fs.readFileSync(file).toString('utf16le')
    for (const [name, value] of secrets) if (text.includes(value)) throw new Error(`SECRET ${name} found in ${file} — aborting`)
    if (/SUPABASE_SERVICE_ROLE_KEY=|service_role_key/i.test(text)) throw new Error(`suspicious secret marker in ${file}`)
  }
}

function edition({ name, offline, guide }) {
  execSync('npx -y pnpm@10.34.3 run build', { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_OFFLINE: offline ? '1' : '' } })
  const stage = path.join(out, name)
  fs.mkdirSync(path.join(stage, 'du-phong'), { recursive: true })
  buildExe(path.join(stage, 'NhacViec.exe'), { skipVite: true })
  fs.cpSync(path.join(root, 'dist'), path.join(stage, 'du-phong', 'app'), { recursive: true })
  for (const f of ['Chay-Nhac-Viec.bat', 'server.ps1']) fs.copyFileSync(rel(f), path.join(stage, 'du-phong', f))
  for (const f of ['Tao-Shortcut-Desktop.bat', 'Tao-Shortcut-Desktop.ps1']) fs.copyFileSync(rel(f), path.join(stage, f))
  fs.copyFileSync(rel(guide), path.join(stage, 'HUONG-DAN-SU-DUNG.txt'))
  if (offline && fs.readFileSync(path.join(stage, 'NhacViec.exe')).toString('latin1').includes('sb_publishable_')) {
    throw new Error('offline build still contains the Supabase key')
  }
  scan(stage)
  const zip = path.join(out, `${name}.zip`)
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${stage}\\*' -DestinationPath '${zip}' -Force"`, { stdio: 'inherit' })
  console.log(`${name}.zip ready (${Math.round(fs.statSync(zip).size / 1024)} KB, secret scan ok)`)
}

fs.rmSync(out, { recursive: true, force: true })
edition({ name: 'NhacViec', offline: false, guide: 'HUONG-DAN-SU-DUNG.txt' })
edition({ name: 'NhacViec-Offline', offline: true, guide: 'HUONG-DAN-SU-DUNG-OFFLINE.txt' })
// Leave the normal build in dist/ for local use.
execSync('npx -y pnpm@10.34.3 run build', { cwd: root, stdio: 'ignore' })
