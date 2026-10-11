import { spawn } from 'node:child_process'

// One local Vite process for API-intercepted browser tests. No store backend is required.
const base = process.env.UI_TEST_URL || 'http://127.0.0.1:5175'
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', new URL(base).port, '--strictPort'], { windowsHide: true, stdio: 'pipe' })
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Vite startup timed out')), 15000)
    server.stdout.on('data', data => { if (data.toString().includes('Local:')) { clearTimeout(timeout); resolve() } })
    server.stderr.on('data', data => process.stderr.write(data))
    server.on('exit', code => { clearTimeout(timeout); reject(new Error(`Vite exited with ${code}`)) })
  })
  for (const file of process.argv.slice(2)) {
    const code = await new Promise(resolve => {
      const child = spawn(process.execPath, [file], { windowsHide: true, stdio: 'inherit', env: { ...process.env, UI_START_SERVER: '', UI_TEST_URL: base, REPORT_TEST_URL: base } })
      child.on('exit', resolve)
    })
    if (code !== 0) { process.exitCode = code || 1; break }
  }
} finally { server.kill() }
