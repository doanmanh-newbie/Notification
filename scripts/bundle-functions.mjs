// Inline supabase/functions/_shared/*.ts into one file per Edge Function, for deploying via the Dashboard editor.
// Output: supabase/functions/.bundled/<name>.ts (git-ignored). Usage: node scripts/bundle-functions.mjs
import fs from 'node:fs'
import path from 'node:path'

const root = 'supabase/functions'
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8').replace(/\r\n/g, '\n')
// Every file in _shared, in dependency order (time → recur → delivery → anything new, alphabetically).
const order = ['time.ts', 'recur.ts', 'delivery.ts']
const sharedFiles = [...order, ...fs.readdirSync(path.join(root, '_shared')).filter((f) => f.endsWith('.ts') && !order.includes(f)).sort()]
const shared = sharedFiles.map((f) => `// ---- _shared/${f} ----\n` + read('_shared', f).replace(/^import [^;]*? from '\.\/[^']*\.ts'\n/gms, '')).join('\n')

const out = path.join(root, '.bundled')
fs.mkdirSync(out, { recursive: true })
for (const name of ['send-reminders', 'notification-action']) {
  const src = read(name, 'index.ts')
  const imports = src.match(/^import [^;]*? from '(npm|jsr):[^']*'\n/gms)?.join('') ?? ''
  const body = src.replace(/^import [^;]*? from '(npm:|jsr:|\.\.\/_shared\/)[^']*'\n/gms, '')
  const bundled = `${imports}\n${shared}\n// ---- ${name} ----\n${body}`
  if (/from\s+['"]\.{1,2}\//.test(bundled)) throw new Error(`${name}: a relative import survived bundling`)
  fs.writeFileSync(path.join(out, `${name}.ts`), bundled)
  console.log('wrote', path.join(out, `${name}.ts`))
}
