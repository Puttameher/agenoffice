/**
 * office-hello plugin
 *
 * Demonstrates plugin lifecycle in Cordis / DeepSeek Harness:
 * - Logs on activation
 * - Registers a slash command `office-ping`
 * - Unregisters cleanly via ctx.effect on disposal
 */

export const name = 'office-hello'
export const inject = ['commands']

export function apply(ctx) {
  console.log('[office-hello] loaded successfully')

  return ctx.effect(() => {
    const unregister = ctx.commands.registerCommand({
      name: 'office-ping',
      description: 'Office ping test command',
      handler: (invocation) => {
        console.log('[office-hello] office-ping invoked')
        return {
          output: 'pong'
        }
      }
    })

    return () => {
      console.log('[office-hello] unloading and unwinding registrations')
      if (typeof unregister === 'function') {
        unregister()
      }
    }
  })
}
