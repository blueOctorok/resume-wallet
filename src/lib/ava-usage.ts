/**
 * AvA Chat Usage Tracking
 *
 * Tracks daily free messages and purchased credits per user.
 * The daily counter self-resets on first request of each new day (UTC),
 * so no cron job is needed.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const AVA_DAILY_FREE = 10

export interface AvaUsage {
  dailyUsed: number
  credits: number
  totalMessages: number
}

export interface AvaUsageCheck {
  allowed: boolean
  /** Which model the API should use for this message */
  model: 'sonnet' | 'haiku'
  /** True when deducting from purchased credits (not free tier) */
  usingCredits: boolean
  dailyRemaining: number
  credits: number
  totalMessages: number
}

/**
 * Credit packs — single source of truth for pricing.
 * Pack id is the key sent from the client on purchase.
 */
export const AVA_CREDIT_PACKS = {
  starter:  { messages: 50,  priceUsdc: '1.00' },
  standard: { messages: 200, priceUsdc: '3.00' },
  pro:      { messages: 500, priceUsdc: '5.00' },
} as const

export type AvaCreditPackId = keyof typeof AVA_CREDIT_PACKS

// ── Helpers ──────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10) // 'YYYY-MM-DD'
}

/**
 * Get or create the usage row for a user.
 * Auto-resets daily_used when the stored date is before today.
 */
export async function getOrCreateUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<AvaUsage> {
  const { data, error } = await supabase
    .from('ava_chat_usage')
    .select('daily_used, daily_reset_at, credits, total_messages')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) throw new Error(`ava_chat_usage read failed: ${error.message}`)

  if (!data) {
    // First ever chat — create row
    const { error: insertErr } = await supabase
      .from('ava_chat_usage')
      .insert({ user_id: userId, daily_used: 0, daily_reset_at: todayUTC(), credits: 0, total_messages: 0 })

    if (insertErr && !insertErr.message?.includes('duplicate')) {
      throw new Error(`ava_chat_usage insert failed: ${insertErr.message}`)
    }

    return { dailyUsed: 0, credits: 0, totalMessages: 0 }
  }

  // Self-resetting daily counter
  if (data.daily_reset_at < todayUTC()) {
    await supabase
      .from('ava_chat_usage')
      .update({ daily_used: 0, daily_reset_at: todayUTC(), updated_at: new Date().toISOString() })
      .eq('user_id', userId)

    return { dailyUsed: 0, credits: data.credits, totalMessages: data.total_messages }
  }

  return {
    dailyUsed: data.daily_used,
    credits: data.credits,
    totalMessages: data.total_messages,
  }
}

/**
 * Determine whether the user can send a message and which model to use.
 */
export function checkUsage(usage: AvaUsage): AvaUsageCheck {
  const dailyRemaining = Math.max(0, AVA_DAILY_FREE - usage.dailyUsed)

  if (dailyRemaining > 0) {
    return {
      allowed: true,
      model: 'sonnet',
      usingCredits: false,
      dailyRemaining,
      credits: usage.credits,
      totalMessages: usage.totalMessages,
    }
  }

  if (usage.credits > 0) {
    return {
      allowed: true,
      model: 'haiku',
      usingCredits: true,
      dailyRemaining: 0,
      credits: usage.credits,
      totalMessages: usage.totalMessages,
    }
  }

  return {
    allowed: false,
    model: 'haiku',
    usingCredits: false,
    dailyRemaining: 0,
    credits: 0,
    totalMessages: usage.totalMessages,
  }
}

/** Increment daily free counter + total. Call AFTER a successful Sonnet reply. */
export async function incrementDailyUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  // Use raw SQL increment to avoid race conditions
  const { error } = await supabase.rpc('increment_ava_daily', { p_user_id: userId })

  // Fallback: if the RPC doesn't exist yet, do a manual update
  if (error) {
    await supabase
      .from('ava_chat_usage')
      .update({
        daily_used: (await getOrCreateUsage(supabase, userId)).dailyUsed + 1,
        total_messages: (await getOrCreateUsage(supabase, userId)).totalMessages + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}

/** Decrement credits + bump total. Call AFTER a successful Haiku reply. */
export async function consumeCredit(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc('consume_ava_credit', { p_user_id: userId })

  if (error) {
    const usage = await getOrCreateUsage(supabase, userId)
    await supabase
      .from('ava_chat_usage')
      .update({
        credits: Math.max(0, usage.credits - 1),
        total_messages: usage.totalMessages + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}

/** Add purchased credits to a user's balance. */
export async function addCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
): Promise<void> {
  const usage = await getOrCreateUsage(supabase, userId)
  const { error } = await supabase
    .from('ava_chat_usage')
    .update({
      credits: usage.credits + amount,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(`addCredits failed: ${error.message}`)
}

/** Convenience: how many free messages remain today. */
export function getDailyRemaining(usage: AvaUsage): number {
  return Math.max(0, AVA_DAILY_FREE - usage.dailyUsed)
}
