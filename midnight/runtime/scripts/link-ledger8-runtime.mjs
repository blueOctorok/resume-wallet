// The deployed contracts were compiled for ledger 8. Their generated modules
// (managed/*/contract/index.js) import '@midnight-ntwrk/compact-runtime' and
// refuse anything but 0.16.0, while Midnight.js 5 needs 0.21.0 at the top level.
// This link makes only the modules under managed/ resolve the 0.16.0 copy, which
// is installed as `compact-runtime-ledger8`. Node follows a link to its real
// path, so 0.16.0 still loads the one top-level onchain-runtime-v3 that the
// framework uses (two copies of that WASM package reject each other's objects).
//
// Runs from postinstall and again in the worker image after `COPY . .`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const runtimeDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const target = path.join(runtimeDir, 'node_modules', 'compact-runtime-ledger8')
const linkDir = path.join(runtimeDir, 'managed', 'node_modules', '@midnight-ntwrk')
const linkPath = path.join(linkDir, 'compact-runtime')

if (!fs.existsSync(target)) {
  throw new Error(`${target} is missing. Run npm install in midnight/runtime first.`)
}

fs.mkdirSync(linkDir, { recursive: true })
// Replace whatever is there, so a second run or a stale link ends the same way.
fs.rmSync(linkPath, { recursive: true, force: true })
fs.symlinkSync(path.relative(linkDir, target), linkPath)
