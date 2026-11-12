// Throwaway: proves the migrated module graph loads. Prints export names only.
const mod = await import('../src/prove-on-chain.js')
console.log(JSON.stringify({ node: process.version, exports: Object.keys(mod).sort() }))
process.exit(0)
