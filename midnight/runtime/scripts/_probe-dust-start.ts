// Temporary read-only probe: repeat the SDK's dust hand-over search step by
// step, on one connection as the SDK does, and show which step fails.
// Deleted after use. Prints no URLs.
import { Duration, Effect, Option, Stream } from 'effect'
import { DustLedgerEvents } from '@midnightntwrk/wallet-sdk-indexer-client'
import { WsSubscriptionClient } from '@midnightntwrk/wallet-sdk-indexer-client/effect'

import { MIDNIGHT_CONFIG } from '../src/config.js'

const redact = (text: string) =>
  text.replace(/project_id=[^ :)&"]*/g, 'project_id=REDACTED').replace(/wss?:\/\/[^\s"')]+/g, 'ws://REDACTED').slice(0, 300)

const probe = (id: number | null) =>
  Effect.gen(function* () {
    const startedAt = Date.now()
    const exit = yield* DustLedgerEvents.run({ id }).pipe(
      Stream.runHead,
      Effect.scoped,
      Effect.timeout(Duration.seconds(40)),
      Effect.exit,
    )
    const ms = Date.now() - startedAt
    if (exit._tag === 'Failure') {
      console.log('probe', JSON.stringify({ id, ms, failed: redact(String(exit.cause)) }))
      return undefined
    }
    const head = Option.getOrUndefined(exit.value)?.dustLedgerEvents
    console.log('probe', JSON.stringify({ id, ms, gotId: head?.id, version: head?.protocolVersion, maxId: head?.maxId }))
    return head
  })

const program = Effect.gen(function* () {
  const first = yield* probe(null)
  if (!first) return
  yield* probe(first.maxId)
  for (const id of [1_019_549, 1_529_323, 1_784_210, 1_656_766, 1_593_044, 1_624_905]) yield* probe(id)
}).pipe(Effect.provide(WsSubscriptionClient.layer({ url: MIDNIGHT_CONFIG.indexerWs as never })), Effect.scoped)

await Effect.runPromise(program as Effect.Effect<void>).catch((err) => console.log('program failed', redact(String(err))))
process.exit(0)
