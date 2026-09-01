import { ApiPromise, HttpProvider } from '@polkadot/api'
import { u8aToHex } from '@polkadot/util'
import type { FinalizedTransaction } from '@midnight-ntwrk/ledger-v8'

import { MIDNIGHT_CONFIG } from './config.js'

function deployRpcHost(): string {
  try {
    return new URL(MIDNIGHT_CONFIG.deployNodeRpc).host
  } catch {
    return 'keyed-rpc'
  }
}

/**
 * Build the Midnight extrinsic against the public node (metadata), then POST
 * author_submitExtrinsic to the Foundation keyed URL. That node is a mailbox:
 * WebSocket submitAndWatch closes immediately (1000), so the wallet SDK's
 * default relay path always looks like a failure.
 */
export async function submitDeployTx(tx: FinalizedTransaction): Promise<string> {
  const deployUrl = MIDNIGHT_CONFIG.deployNodeRpc
  if (!deployUrl) {
    throw new Error('MIDNIGHT_DEPLOY_RPC_URL is not set')
  }

  const publicApi = await ApiPromise.create({
    provider: new HttpProvider(MIDNIGHT_CONFIG.nodeRpc),
    noInitWarn: true,
  })
  let extrinsicHex: string
  try {
    extrinsicHex = publicApi.tx.midnight
      .sendMnTransaction(u8aToHex(tx.serialize()))
      .toHex()
  } finally {
    await publicApi.disconnect()
  }

  const res = await fetch(deployUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'author_submitExtrinsic',
      params: [extrinsicHex],
    }),
  })
  const body = (await res.json()) as {
    result?: string
    error?: { code?: number; message?: string }
  }
  if (body.error) {
    throw new Error(
      `Keyed deploy submit failed (${deployRpcHost()}): ${body.error.code ?? ''} ${body.error.message ?? 'unknown'}`.trim(),
    )
  }
  if (!body.result) {
    throw new Error(`Keyed deploy submit returned no hash (${deployRpcHost()})`)
  }
  return body.result
}
