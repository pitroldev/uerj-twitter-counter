const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const target = path.resolve(root, 'dist')
if (path.dirname(target) !== root || path.basename(target) !== 'dist') {
  throw new Error('UNSAFE_BUILD_DIRECTORY')
}
if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
  throw new Error('BUILD_DIRECTORY_IS_SYMLINK')
}
fs.rmSync(target, { recursive: true, force: true })
