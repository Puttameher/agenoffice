import assert from 'node:assert/strict'
import { resolveDshHome } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/packages/util/home-paths/src/index.ts'
import { loadProfileDirectory } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/packages/boot/app-boot/src/profile.ts'
import { Context } from 'file:///D:/youtube/agenoffice/vendor/deepseek-harness/vendor/cordis/src/index.ts'
import * as OfficeHello from 'file:///D:/youtube/agenoffice/plugins/office-hello/src/index.js'

console.log('=== PHASE 1 ACCEPTANCE: Profile, Bundle & Unwind Lifecycle ===')

// 1. Verify Profile Resolution and Bundle Layer Stacking
process.env.DSH_HOME = 'd:/youtube/agenoffice'
const dshHome = resolveDshHome()
assert.equal(dshHome, 'd:\\youtube\\agenoffice')

const installAnchor = 'D:/youtube/agenoffice/vendor/deepseek-harness/apps/cli/package.json'
const profileDir = 'D:/youtube/agenoffice/profiles/office'

const profile = loadProfileDirectory('dsh', profileDir, installAnchor)
const layerNames = profile.layers.map(l => l.packageName)
console.log('[PASS] Profile loaded. Bundles declared:', layerNames)
assert.deepEqual(layerNames, [
  '@deepseek-ai/dsh-base',
  '@deepseek-ai/dsh-web-app',
  'office-bundle'
])

// Verify office-hello row exists in the bundle patches
const hasOfficeHello = profile.layers.some(layer =>
  layer.patches.some(patch => patch.insert?.some(row => row.id === 'office-hello') || patch.id === 'office-hello')
)
console.log('[PASS] Bundle layer contains office-hello:', hasOfficeHello)
assert.ok(hasOfficeHello)

// 2. Test Cordis Plugin Mounting, Command Execution, and Effect Unwinding
const rootCtx = new Context()

// Provide minimal command registry so injected service satisfies dependency
const registeredCommands = new Map()
rootCtx.reflect.provide('commands', {
  registerCommand(def) {
    registeredCommands.set(def.name, def)
    return () => {
      registeredCommands.delete(def.name)
    }
  },
  getCommand(name) {
    return registeredCommands.get(name)
  }
})

// Mount plugin as a Cordis fork
const fork = rootCtx.plugin(OfficeHello)
await new Promise(r => setTimeout(r, 20))
console.log('[PASS] Mounted office-hello plugin')

// Verify command was registered
const cmd = rootCtx.commands.getCommand('office-ping')
assert.ok(cmd, 'office-ping should be registered')
console.log('[PASS] Command registered:', cmd.name, '-', cmd.description)

// Execute command
const result = await cmd.handler({})
console.log('[PASS] Invoked office-ping command, result:', result)
assert.deepEqual(result, { output: 'pong' })

// Unload / dispose plugin and prove effects unwind
console.log('[ACTION] Disposing office-hello plugin fork...')
await fork.dispose()
await new Promise(r => setTimeout(r, 20))

const cmdAfterUnwind = rootCtx.commands.getCommand('office-ping')
console.log('[PASS] After unload, office-ping command lookup is:', cmdAfterUnwind)
assert.equal(cmdAfterUnwind, undefined, 'Command must be unwound after plugin dispose')

console.log('=== PHASE 1 ACCEPTANCE: ALL GATES PASSED ===')
