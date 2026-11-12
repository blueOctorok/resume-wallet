/**
 * Ask the model for slots only. The resume line is written in driver-document-lines.
 */

import Anthropic from '@anthropic-ai/sdk'
import { ANTHROPIC_MODEL_HAIKU } from '@/lib/anthropic-models'
import { sanitizeSlots, type DriverDocumentSlots } from '@/lib/driver-document-lines'

const SYSTEM = [
  'You read one document a truck driver uploaded.',
  'Return JSON only. No markdown.',
  'Keys: kind, insurer, liabilityLimit, cargoLimit, expiration, mcNumber, usdot, authorityDate, vehicleYear, vehicleMake.',
  'kind is "insurance", "authority", "registration", or "other".',
  'liabilityLimit and cargoLimit are digits only (1000000, not "$1,000,000"). Auto liability is liabilityLimit. Cargo is cargoLimit.',
  'expiration and authorityDate are YYYY-MM-DD or null.',
  'mcNumber and usdot are digits only or null.',
  'vehicleYear is a 4-digit year or null. vehicleMake is the make only, such as Peterbilt, or null.',
  'Use null when the page does not say it. Do not guess.',
  'Ignore VIN, policy numbers, SSN, and addresses. Do not include them.',
  'kind "other" when this is not an insurance certificate, operating authority, or a vehicle registration.',
].join(' ')

export async function extractSlotsFromText(text: string): Promise<DriverDocumentSlots> {
  return askModel([{ type: 'text', text: text.slice(0, 12000) }])
}

export async function extractSlotsFromImage(
  bytes: Buffer,
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp',
): Promise<DriverDocumentSlots> {
  return askModel([
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data: bytes.toString('base64'),
      },
    },
    { type: 'text', text: 'Read this document and return the JSON slots.' },
  ])
}

async function askModel(content: Anthropic.Messages.ContentBlockParam[]): Promise<DriverDocumentSlots> {
  if (!process.env.AVA_BRAIN) {
    throw new Error('AI service is not configured.')
  }
  const anthropic = new Anthropic({ apiKey: process.env.AVA_BRAIN })
  const response = await anthropic.messages.create({
    model: ANTHROPIC_MODEL_HAIKU,
    max_tokens: 400,
    system: SYSTEM,
    messages: [{ role: 'user', content }],
  })
  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
  return sanitizeSlots(parseJsonObject(text))
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1))
  } catch {
    return null
  }
}
