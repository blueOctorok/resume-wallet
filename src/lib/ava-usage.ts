/**
 * AvA Chat + Job AI usage (daily free chat, credits, cover letters, job match cache).
 * Daily counters self-reset on first request of each new UTC day.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export const AVA_DAILY_FREE = 10
/** Free AI cover letters per UTC day before credits (same credit pool as chat). */
export const AVA_COVER_LETTER_DAILY_FREE = 3
/** Free personalized job-list AI run per UTC day (cache reused until next day). */
export const AVA_JOB_MATCH_FREE_DAILY = 1

export const AVA_UNLIMITED_WALLETS = new Set([
  '0x9d17cf2ac64ea97be08e3319fe17d94bd1a0660a',
])

export interface AvaUsage {
  dailyUsed: number
  credits: number
  totalMessages: number
  coverLettersDailyUsed: number
  jobMatchAiDailyUsed: number
  jobMatchCache: unknown | null
  jobMatchCacheAt: string | null
}

export interface AvaUsageCheck {
  allowed: boolean
  model: 'sonnet' | 'haiku'
  usingCredits: boolean
  dailyRemaining: number
  credits: number
  totalMessages: number
}

export interface AvaCoverLetterCheck {
  allowed: boolean
  model: 'sonnet' | 'haiku'
  usingCredits: boolean
  coverLettersDailyRemaining: number
  credits: number
}

export const AVA_CREDIT_PACKS = {
  starter: { messages: 50, priceUsdc: '1.00' },
  standard: { messages: 200, priceUsdc: '3.00' },
  pro: { messages: 500, priceUsdc: '5.00' },
} as const

export type AvaCreditPackId = keyof typeof AVA_CREDIT_PACKS

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function rowToUsage(data: Record<string, unknown>): AvaUsage {
  return {
    dailyUsed: (data.daily_used as number) ?? 0,
    credits: (data.credits as number) ?? 0,
    totalMessages: (data.total_messages as number) ?? 0,
    coverLettersDailyUsed: (data.cover_letters_daily_used as number) ?? 0,
    jobMatchAiDailyUsed: (data.job_match_ai_daily_used as number) ?? 0,
    jobMatchCache: (data.job_match_cache as unknown) ?? null,
    jobMatchCacheAt: (data.job_match_cache_at as string) ?? null,
  }
}

/**
 * Get or create the usage row. Resets all daily counters (+ clears job match cache) on new UTC day.
 */
export async function getOrCreateUsage(supabase: SupabaseClient, userId: string): Promise<AvaUsage> {
  const { data, error } = await supabase
    .from('ava_chat_usage')
    .select(
      'daily_used, daily_reset_at, credits, total_messages, cover_letters_daily_used, job_match_ai_daily_used, job_match_cache, job_match_cache_at',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    const code = (error as { code?: string }).code ?? 'unknown'
    throw new Error(`ava_chat_usage read failed [${code}]: ${error.message}`)
  }

  if (!data) {
    const { error: insertErr } = await supabase.from('ava_chat_usage').insert({
      user_id: userId,
      daily_used: 0,
      daily_reset_at: todayUTC(),
      credits: 0,
      total_messages: 0,
    })

    if (insertErr && !insertErr.message?.includes('duplicate')) {
      throw new Error(`ava_chat_usage insert failed: ${insertErr.message}`)
    }

    return {
      dailyUsed: 0,
      credits: 0,
      totalMessages: 0,
      coverLettersDailyUsed: 0,
      jobMatchAiDailyUsed: 0,
      jobMatchCache: null,
      jobMatchCacheAt: null,
    }
  }

  if (data.daily_reset_at < todayUTC()) {
    await supabase
      .from('ava_chat_usage')
      .update({
        daily_used: 0,
        daily_reset_at: todayUTC(),
        cover_letters_daily_used: 0,
        job_match_ai_daily_used: 0,
        job_match_cache: null,
        job_match_cache_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)

    return {
      dailyUsed: 0,
      credits: data.credits ?? 0,
      totalMessages: data.total_messages ?? 0,
      coverLettersDailyUsed: 0,
      jobMatchAiDailyUsed: 0,
      jobMatchCache: null,
      jobMatchCacheAt: null,
    }
  }

  return rowToUsage(data as Record<string, unknown>)
}

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

/** Cover letter: 3× Sonnet/day, then 1 credit → Haiku (same as post-quota chat). */
export function checkCoverLetterUsage(usage: AvaUsage, isUnlimited: boolean): AvaCoverLetterCheck {
  if (isUnlimited) {
    return {
      allowed: true,
      model: 'sonnet',
      usingCredits: false,
      coverLettersDailyRemaining: 999,
      credits: usage.credits,
    }
  }

  const used = usage.coverLettersDailyUsed
  const remaining = Math.max(0, AVA_COVER_LETTER_DAILY_FREE - used)

  if (remaining > 0) {
    return {
      allowed: true,
      model: 'sonnet',
      usingCredits: false,
      coverLettersDailyRemaining: remaining,
      credits: usage.credits,
    }
  }

  if (usage.credits > 0) {
    return {
      allowed: true,
      model: 'haiku',
      usingCredits: true,
      coverLettersDailyRemaining: 0,
      credits: usage.credits,
    }
  }

  return {
    allowed: false,
    model: 'haiku',
    usingCredits: false,
    coverLettersDailyRemaining: 0,
    credits: 0,
  }
}

export async function incrementDailyUsage(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ava_daily', { p_user_id: userId })

  if (error) {
    const u = await getOrCreateUsage(supabase, userId)
    await supabase
      .from('ava_chat_usage')
      .update({
        daily_used: u.dailyUsed + 1,
        total_messages: u.totalMessages + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}

export async function consumeCredit(supabase: SupabaseClient, userId: string): Promise<void> {
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

/** After a successful cover letter from the free daily pool. */
export async function incrementCoverLetterDaily(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ava_cover_letter_daily', { p_user_id: userId })
  if (error) {
    const u = await getOrCreateUsage(supabase, userId)
    await supabase
      .from('ava_chat_usage')
      .update({
        cover_letters_daily_used: u.coverLettersDailyUsed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}

/** After a successful free job-match AI run (once per UTC day). */
export async function incrementJobMatchAiDaily(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_ava_job_match_daily', { p_user_id: userId })
  if (error) {
    const u = await getOrCreateUsage(supabase, userId)
    await supabase
      .from('ava_chat_usage')
      .update({
        job_match_ai_daily_used: u.jobMatchAiDailyUsed + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }
}

export async function saveJobMatchCache(
  supabase: SupabaseClient,
  userId: string,
  cache: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('ava_chat_usage')
    .update({
      job_match_cache: cache as Record<string, unknown>,
      job_match_cache_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw new Error(`saveJobMatchCache failed: ${error.message}`)
}

export async function addCredits(supabase: SupabaseClient, userId: string, amount: number): Promise<void> {
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

export function getDailyRemaining(usage: AvaUsage): number {
  return Math.max(0, AVA_DAILY_FREE - usage.dailyUsed)
}

export function getCoverLetterDailyRemaining(usage: AvaUsage): number {
  return Math.max(0, AVA_COVER_LETTER_DAILY_FREE - usage.coverLettersDailyUsed)
}
