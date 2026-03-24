/**
 * Server-only: deploy / update MultiOwnerLightAccount for employers.
 * Uses a service EOA (COMPANY_WALLET_SERVICE_PRIVATE_KEY) as a permanent co-owner
 * so invite accept can add/remove team owners without an existing member signing.
 * Team members use their personal Light Account address as on-chain owners.
 */

import { createMultiOwnerLightAccountAlchemyClient } from '@account-kit/smart-contracts'
import { alchemy } from '@account-kit/infra'
import { LocalAccountSigner } from '@aa-sdk/core'
import { baseSepolia } from 'viem/chains'
import { getAddress, type Address } from 'viem'
import { companyIdToWalletSalt } from '@/lib/company-wallet-salt'

function normalizePrivateKey(pk: string): `0x${string}` {
  const t = pk.trim()
  const with0x = t.startsWith('0x') ? t : `0x${t}`
  return with0x as `0x${string}`
}

function getAlchemyPaymentConfig(): { apiKey: string; policyId: string | undefined } {
  const apiKey = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY
  if (!apiKey) {
    throw new Error('NEXT_PUBLIC_ALCHEMY_API_KEY is required for company wallet')
  }
  return {
    apiKey,
    policyId: process.env.NEXT_PUBLIC_ALCHEMY_POLICY_ID,
  }
}

async function getServiceSigner() {
  const pk = process.env.COMPANY_WALLET_SERVICE_PRIVATE_KEY
  if (!pk?.trim()) {
    throw new Error('COMPANY_WALLET_SERVICE_PRIVATE_KEY is not set')
  }
  return LocalAccountSigner.privateKeyToAccountSigner(normalizePrivateKey(pk))
}

/** Public address of the service co-owner (must match NEXT_PUBLIC_COMPANY_WALLET_SERVICE_ADDRESS on the client). */
export async function getCompanyWalletServiceSignerAddress(): Promise<Address> {
  const signer = await getServiceSigner()
  return getAddress(await signer.getAddress())
}

async function createServiceConnectedClient(params: {
  companyId: string
  accountAddress?: Address
  extraOwnersForInit?: Address[]
}) {
  const { apiKey, policyId } = getAlchemyPaymentConfig()
  const signer = await getServiceSigner()
  const salt = companyIdToWalletSalt(params.companyId)

  return createMultiOwnerLightAccountAlchemyClient({
    transport: alchemy({ apiKey }),
    chain: baseSepolia,
    signer,
    policyId,
    salt,
    ...(params.accountAddress ? { accountAddress: params.accountAddress } : {}),
    ...(params.extraOwnersForInit?.length
      ? { owners: params.extraOwnersForInit }
      : {}),
  })
}

/**
 * Create (counterfactual) company wallet with owners = sorted([service EOA, creator Light Account]).
 * Does not force-deploy; first user op from any owner deploys.
 */
export async function createCompanySharedWallet(params: {
  companyId: string
  creatorSmartAccountAddress: string
}): Promise<{ address: Address }> {
  const creator = getAddress(params.creatorSmartAccountAddress)
  const client = await createServiceConnectedClient({
    companyId: params.companyId,
    extraOwnersForInit: [creator],
  })
  return { address: getAddress(client.account.address) }
}

export async function addOwnerToCompanyWallet(params: {
  companyId: string
  companyWalletAddress: string
  newOwnerSmartAccountAddress: string
}): Promise<void> {
  const client = await createServiceConnectedClient({
    companyId: params.companyId,
    accountAddress: getAddress(params.companyWalletAddress),
  })
  const newOwner = getAddress(params.newOwnerSmartAccountAddress)
  await client.updateOwners({
    ownersToAdd: [newOwner],
    ownersToRemove: [],
    waitForTxn: true,
  })
}

export async function removeOwnerFromCompanyWallet(params: {
  companyId: string
  companyWalletAddress: string
  ownerSmartAccountAddress: string
}): Promise<void> {
  const client = await createServiceConnectedClient({
    companyId: params.companyId,
    accountAddress: getAddress(params.companyWalletAddress),
  })
  const toRemove = getAddress(params.ownerSmartAccountAddress)
  const serviceAddr = await getCompanyWalletServiceSignerAddress()
  if (toRemove === serviceAddr) {
    console.warn('[COMPANY WALLET] Refusing to remove service co-owner from chain')
    return
  }
  await client.updateOwners({
    ownersToAdd: [],
    ownersToRemove: [toRemove],
    waitForTxn: true,
  })
}
