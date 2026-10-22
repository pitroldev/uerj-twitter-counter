const { spawnSync } = require('node:child_process')
const { resolve } = require('node:path')
const python =
  process.env.TWIFORK_PYTHON ||
  resolve(
    __dirname,
    '..',
    '.venv',
    process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'
  )
const result = spawnSync(
  python,
  ['-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v'],
  {
    cwd: resolve(__dirname, '..'),
    stdio: 'inherit',
    windowsHide: true,
    timeout: 30000
  }
)
if (result.error)
  console.error(
    'Python indisponível: crie .venv e instale requirements-twifork.txt.'
  )
process.exitCode = result.status === 0 ? 0 : 1
