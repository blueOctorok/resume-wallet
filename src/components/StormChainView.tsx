'use client'

import { isDarkTheme } from '@/lib/theme-storage'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import {
  Briefcase,
  Users,
  Shield,
  TrendingUp,
  Gift,
  Clock,
  Calculator,
  PieChart,
  Zap,
  Lock,
  TrendingDown,
  UserPlus,
  CloudLightning,
} from 'lucide-react'
import BackToHubButton from '@/components/ui/BackToHubButton'
import StormChainWordmark from '@/components/ui/StormChainWordmark'

interface StormChainViewProps {
  onBack: () => void
  backLabel?: string
}

export default function StormChainView({ onBack, backLabel }: StormChainViewProps) {
  const { theme } = useTheme()
  const isDark = isDarkTheme(theme)

  return (
    <div className='max-w-4xl mx-auto'>
      {/* Back Button */}
      <div className='mb-6'>
        <BackToHubButton onClick={onBack} label={backLabel} />
      </div>

      {/* Hero Header — stacked Storm / StormTokenMark / Chain (same identity as LoadingScreen) */}
      <div className='text-center mb-10'>
        <h1 className='mb-5' aria-label='Storm — STORM wordmark'>
          <StormChainWordmark size='hero' />
        </h1>
        <p
          className={cn(
            'text-xl sm:text-2xl font-semibold mb-2',
            isDark ? 'text-zinc-100' : 'text-slate-800',
          )}
          style={
            isDark
              ? { textShadow: '0 2px 10px rgba(0,0,0,0.75), 0 1px 3px rgba(0,0,0,0.6)' }
              : undefined
          }
        >
          Token whitepaper
        </p>
        <p
          className={cn('text-lg', isDark ? 'text-zinc-300' : 'text-slate-600')}
          style={isDark ? { textShadow: '0 1px 6px rgba(0,0,0,0.65)' } : undefined}
        >
          The reward token for verified professionals
        </p>
        <div className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
          isDark
            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
            : 'bg-teal-100 text-teal-700 border border-teal-200'
        }`}>
          <Lock className='w-4 h-4' />
          Total Supply: 50,000,000 STORM
        </div>
      </div>

      {/* Key Stats Row */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
        <StatCard isDark={isDark} label='Total Supply' value='50M' />
        <StatCard isDark={isDark} label='User Rewards' value='50%' />
        <StatCard isDark={isDark} label='Per $3 (Applicant)' value='~10' />
        <StatCard isDark={isDark} label='Decay Model' value='Smooth' />
      </div>

      {/* What is STORM */}
      <Section isDark={isDark} title='What is STORM?' icon={<CloudLightning className='w-5 h-5' />}>
        <p>
          STORM is a bonus token you earn when you spend USDC on the platform.
          The more you spend, the more tokens you earn—resume verification,
          premium subscriptions, or any future product all use the same rule.
        </p>
        <p className='mt-3'>
          Think of it like airline miles or credit card points—except STORM can
          be traded and may increase in value as more people use the platform.
        </p>
      </Section>

      {/* How You Earn (USDC-based) */}
      <Section isDark={isDark} title='How You Earn' icon={<CloudLightning className='w-5 h-5' />}>
        <p className='mb-4'>
          <strong>
            Tokens are based on how much USDC you spend, not which product you
            buy.
          </strong>{' '}
          One formula for everything: spend $X USDC → earn Y tokens (with decay
          as the pool depletes).
        </p>
        <div className={`p-4 rounded-lg mb-4 ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Examples at current rate (before decay)
          </p>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>• $3 USDC spent (applicant) → ~10 tokens</li>
            <li>• $3 USDC spent (employer) → ~5 tokens (0.5x rate)</li>
            <li>• Any product, any price: same rule</li>
          </ul>
        </div>
        <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          As more tokens are distributed, the rate decreases (smooth decay).
          Early spenders earn more tokens per dollar.
        </p>

        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Why 10 tokens per $3 with a 50M supply?
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            Reward rates are based on the <strong>25M user reward pool</strong>,
            not the full 50M supply. The remaining 25M serves other purposes:
            17M for treasury (referrals, community programs), 5M for DEX trading
            liquidity, and 3M for founder vesting. Keeping the earn rate tied to
            the reward pool means every token you earn represents real, meaningful
            value — not inflated numbers.
          </p>
        </div>
      </Section>

      {/* Token Distribution */}
      <Section isDark={isDark} title='Token Distribution' icon={<PieChart className='w-5 h-5' />}>
        <p className='mb-4'>
          There will only ever be <strong>50 million STORM tokens</strong>. No
          more can be created. Here's how they're allocated:
        </p>

        {/* Visual Distribution Bars */}
        <div className='space-y-3 mb-6'>
          <DistributionBar
            isDark={isDark}
            label='User Rewards'
            amount='25M'
            percentage={50}
            color='green'
            description='Earned by users through platform usage'
          />
          <DistributionBar
            isDark={isDark}
            label='Platform Treasury'
            amount='17M'
            percentage={34}
            color='blue'
            description='Referral rewards, community programs, buybacks, partnerships'
          />
          <DistributionBar
            isDark={isDark}
            label='DEX Liquidity'
            amount='5M'
            percentage={10}
            color='orange'
            description='Trading liquidity (funded by platform revenue)'
          />
          <DistributionBar
            isDark={isDark}
            label='Founders (Vested)'
            amount='3M'
            percentage={6}
            color='purple'
            description='1.5M each, 1-year lock + 2-year vesting'
          />
        </div>

        {/* Distribution Table */}
        <div className='overflow-x-auto'>
          <table className={`w-full text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                <th className='text-left py-2 font-semibold'>Allocation</th>
                <th className='text-right py-2 font-semibold'>Amount</th>
                <th className='text-right py-2 font-semibold'>%</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>User Rewards</td>
                <td className='py-2 text-right font-mono'>25,000,000</td>
                <td className='py-2 text-right'>50%</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Platform Treasury</td>
                <td className='py-2 text-right font-mono'>17,000,000</td>
                <td className='py-2 text-right'>34%</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>DEX Liquidity</td>
                <td className='py-2 text-right font-mono'>5,000,000</td>
                <td className='py-2 text-right'>10%</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Founder A (Vested)</td>
                <td className='py-2 text-right font-mono'>1,500,000</td>
                <td className='py-2 text-right'>3%</td>
              </tr>
              <tr>
                <td className='py-2'>Founder B (Vested)</td>
                <td className='py-2 text-right font-mono'>1,500,000</td>
                <td className='py-2 text-right'>3%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Treasury note */}
        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-blue-900/20 border border-blue-500/30'
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <p className={`text-sm font-medium mb-1 ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>
            About the Treasury
          </p>
          <p className={`text-sm ${isDark ? 'text-blue-400/80' : 'text-blue-600'}`}>
            The 17M treasury (15M original allocation + 2M reserve) is held in a
            dedicated TreasuryDistributor smart contract. It funds referral
            rewards (2.5 STORM to each party when a referred user completes
            their first paid action), community bonuses, buybacks, and
            partnerships. Treasury tokens are released for specific
            events—not sold arbitrarily.
          </p>
        </div>
      </Section>

      {/* Smooth Decay Model */}
      <Section isDark={isDark} title='Smooth Decay Rewards' icon={<TrendingDown className='w-5 h-5' />}>
        <p className='mb-4'>
          Token rewards are based on <strong>USDC spent</strong>, with a{' '}
          <strong>smooth decay</strong>—inspired by Bitcoin, but fairer. As more
          tokens are distributed, the rate per dollar decreases gradually.
        </p>

        {/* Formula Box */}
        <div className={`p-4 rounded-lg font-mono text-center mb-4 ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`text-sm mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            The Formula
          </p>
          <p className={`text-sm font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
            tokens = (USDC × rate × multiplier) × (remaining / total)^0.7
          </p>
          <p className={`text-xs mt-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            rate ≈ 3.33 per $1 | multiplier: 1.0 (applicant), 0.5 (employer)
          </p>
        </div>

        <p className={`text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          <strong>What this means:</strong> Applicant spends $3 USDC → ~10
          tokens at the start. Employer spends $3 USDC → ~5 tokens. By the time
          50% of the pool is distributed, those amounts decrease to ~6 and ~3
          tokens respectively.
        </p>

        {/* Decay Curve Table */}
        <div className='overflow-x-auto'>
          <table className={`w-full text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                <th className='text-left py-2 font-semibold'>Tokens Distributed</th>
                <th className='text-right py-2 font-semibold'>% Used</th>
                <th className='text-right py-2 font-semibold'>Applicant per $3</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${isDark ? 'border-gray-700 bg-green-900/20' : 'border-gray-200 bg-green-50'}`}>
                <td className='py-2 font-medium'>0</td>
                <td className='py-2 text-right'>0%</td>
                <td className='py-2 text-right font-mono font-bold'>10.00</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>2,500,000</td>
                <td className='py-2 text-right'>10%</td>
                <td className='py-2 text-right font-mono'>9.28</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>7,500,000</td>
                <td className='py-2 text-right'>30%</td>
                <td className='py-2 text-right font-mono'>7.76</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>12,500,000</td>
                <td className='py-2 text-right'>50%</td>
                <td className='py-2 text-right font-mono'>6.16</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>17,500,000</td>
                <td className='py-2 text-right'>70%</td>
                <td className='py-2 text-right font-mono'>4.36</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>22,500,000</td>
                <td className='py-2 text-right'>90%</td>
                <td className='py-2 text-right font-mono'>2.04</td>
              </tr>
              <tr>
                <td className='py-2'>24,750,000</td>
                <td className='py-2 text-right'>99%</td>
                <td className='py-2 text-right font-mono'>0.36</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className={`text-xs mt-2 italic ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          * Table shows applicant rates. Employers receive half these amounts.
        </p>
      </Section>

      {/* Early Adopter Advantage */}
      <Section isDark={isDark} title='Early Adopter Advantage' icon={<TrendingUp className='w-5 h-5' />}>
        <p>
          The first users earn the most tokens. As more people join, the reward
          amounts gradually decrease. This rewards early believers and creates
          urgency to join sooner—but it's <strong>fair</strong>: the first user
          and the hundredth user earn nearly the same amount.
        </p>

        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-green-900/20 border border-green-500/30'
            : 'bg-green-50 border border-green-200'
        }`}>
          <p className={`font-semibold mb-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}>
            <Zap className='w-4 h-4 inline mr-1' />
            Potential Upside
          </p>
          <p className={`text-sm ${isDark ? 'text-green-400/80' : 'text-green-600'}`}>
            Tokens have no market price until trading is enabled. Once the
            platform launches DEX liquidity, early token holders could see
            significant value if the platform grows successfully.
          </p>
        </div>
      </Section>

      {/* How Token Price Works */}
      <Section isDark={isDark} title='How Token Value Works' icon={<Calculator className='w-5 h-5' />}>
        <p className='mb-4'>
          <strong>Before trading is enabled:</strong> Tokens accumulate in your
          wallet but have no market price. They're like reward points waiting to
          be redeemed.
        </p>

        <p className='mb-4'>
          <strong>When trading launches:</strong> The platform uses revenue to
          create a liquidity pool. This establishes the first real price, and
          market supply/demand takes over from there.
        </p>

        <div className={`p-4 rounded-lg ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            What "backed" means
          </p>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
            Every token <strong>earned by users</strong> (the 25M reward pool)
            is tied to real USDC spent on the platform—no spend, no tokens.
            Treasury, founder, and DEX allocations are pre-minted at launch
            for operations, referral programs, and trading liquidity. DEX
            liquidity itself is funded by actual platform revenue.
          </p>
        </div>
      </Section>

      {/* Who Earns */}
      <Section isDark={isDark} title='Who Earns STORM?' icon={<Users className='w-5 h-5' />}>
        <p>
          <strong>Everyone who pays in USDC earns STORM.</strong> Both
          applicants and employers participate in the token economy, but at
          different rates to keep the token community-first.
        </p>

        {/* Rate Comparison Table */}
        <div className='overflow-x-auto mt-4'>
          <table className={`w-full text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                <th className='text-left py-2 font-semibold'>User Type</th>
                <th className='text-center py-2 font-semibold'>Rate</th>
                <th className='text-right py-2 font-semibold'>$3 USDC Example</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${isDark ? 'border-gray-700 bg-green-900/20' : 'border-gray-200 bg-green-50'}`}>
                <td className='py-2 font-medium'>Applicants</td>
                <td className='py-2 text-center'>1.0x (full rate)</td>
                <td className='py-2 text-right font-mono'>~10 tokens</td>
              </tr>
              <tr>
                <td className='py-2 font-medium'>Employers</td>
                <td className='py-2 text-center'>0.5x (half rate)</td>
                <td className='py-2 text-right font-mono'>~5 tokens</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Why differentiated rates?
          </p>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>• <strong>Applicants get full rate</strong> — The token is community-first for job seekers</li>
            <li>• <strong>Employers get half rate</strong> — They participate but don't dominate</li>
            <li>• <strong>Every earned token is USDC-backed</strong> — No USDC spend, no tokens generated</li>
          </ul>
        </div>
      </Section>

      {/* For Employers */}
      <Section isDark={isDark} title='For Employers' icon={<Briefcase className='w-5 h-5' />}>
        <p>
          Employers <strong>earn STORM at 0.5x the applicant rate</strong> when
          they pay for platform services. You always{' '}
          <strong>pay in USDC</strong>, and STORM tokens are distributed as a
          bonus.
        </p>
        <p className='mt-3'>
          When token utility is live, employers who{' '}
          <strong>hold STORM</strong> in their wallet get{' '}
          <strong>lower USDC transaction costs</strong> on the platform (e.g.
          plans, bulk verification). You never pay in STORM—just hold it to
          qualify for the discount.
        </p>
        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Why this matters for employers
          </p>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>• Pay in USDC, earn STORM as a bonus (at half the applicant rate)</li>
            <li>• Hold STORM to get lower USDC fees on plans and bulk verification</li>
            <li>• Half rate keeps the token community-first while still rewarding your spending</li>
            <li>• Governance voting may exclude employer-held tokens to preserve applicant voice</li>
          </ul>
        </div>
      </Section>

      {/* Referral Program */}
      <Section isDark={isDark} title='Referral Program' icon={<UserPlus className='w-5 h-5' />}>
        <p>
          Invite friends to Storm and <strong>both of you earn STORM tokens</strong> from
          the treasury. Referral rewards are separate from the decay-based user rewards — they
          come from the 17M treasury allocation.
        </p>

        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-teal-900/20 border border-teal-500/30'
            : 'bg-teal-50 border border-teal-200'
        }`}>
          <p className={`font-semibold mb-3 ${isDark ? 'text-teal-400' : 'text-teal-700'}`}>
            How It Works
          </p>
          <ol className={`text-sm space-y-2 list-decimal list-inside ${isDark ? 'text-teal-400/80' : 'text-teal-600'}`}>
            <li>Share your unique referral link from your hub</li>
            <li>Your friend signs up using that link</li>
            <li>When they complete their first paid action (e.g., resume verification), <strong>both of you receive 2.5 STORM</strong></li>
          </ol>
        </div>

        <div className='overflow-x-auto mt-4'>
          <table className={`w-full text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                <th className='text-left py-2 font-semibold'>Detail</th>
                <th className='text-right py-2 font-semibold'>Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Reward to referrer</td>
                <td className='py-2 text-right font-mono'>2.5 STORM</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Reward to referred user</td>
                <td className='py-2 text-right font-mono'>2.5 STORM</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Total per referral</td>
                <td className='py-2 text-right font-mono font-bold'>5.0 STORM</td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Source</td>
                <td className='py-2 text-right'>Treasury (17M pool)</td>
              </tr>
              <tr>
                <td className='py-2'>Trigger</td>
                <td className='py-2 text-right'>Referred user&apos;s first paid action</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className={`mt-4 p-4 rounded-lg ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <p className={`font-medium mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Anti-Sybil Protections
          </p>
          <ul className={`text-sm space-y-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
            <li>• You cannot refer yourself (same wallet or same user ID)</li>
            <li>• Each person can only be referred once</li>
            <li>• Rewards require a real paid action — no free claiming</li>
            <li>• Per-user referral cap prevents mass farming</li>
            <li>• Wallet addresses are verified from the database, not user input</li>
          </ul>
        </div>
      </Section>

      {/* Founder Commitment */}
      <Section isDark={isDark} title='Founder Commitment' icon={<Clock className='w-5 h-5' />}>
        <p>
          The two founders each receive 1.5 million STORM tokens. To show
          commitment, these tokens are locked and vest over time:
        </p>

        {/* Vesting Timeline Visual */}
        <div className='mt-4 mb-4'>
          <div className='flex items-center gap-2 mb-2'>
            {[1, 2, 3].map((year) => (
              <div key={year} className='flex-1'>
                <div className={`h-3 rounded-full ${
                  year === 1
                    ? isDark ? 'bg-red-500/50' : 'bg-red-200'
                    : year === 2
                      ? isDark ? 'bg-yellow-500/50' : 'bg-yellow-200'
                      : isDark ? 'bg-green-500/50' : 'bg-green-200'
                }`} />
                <p className={`text-xs mt-1 text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                  Year {year}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table className={`w-full text-sm ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
            <thead>
              <tr className={`border-b ${isDark ? 'border-gray-600' : 'border-gray-300'}`}>
                <th className='text-left py-2 font-semibold'>Year</th>
                <th className='text-right py-2 font-semibold'>Unlocked</th>
                <th className='text-left py-2 pl-4 font-semibold'>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Year 1</td>
                <td className='py-2 text-right font-mono'>0%</td>
                <td className='py-2 pl-4'>
                  <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'}`}>
                    Locked
                  </span>
                </td>
              </tr>
              <tr className={`border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
                <td className='py-2'>Year 2</td>
                <td className='py-2 text-right font-mono'>50%</td>
                <td className='py-2 pl-4'>
                  <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}>
                    Partial
                  </span>
                </td>
              </tr>
              <tr>
                <td className='py-2'>Year 3</td>
                <td className='py-2 text-right font-mono'>100%</td>
                <td className='py-2 pl-4'>
                  <span className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}>
                    Vested
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className='mt-3 text-sm opacity-75'>
          This aligns founder interests with long-term platform success.
        </p>
      </Section>

      {/* What Can You Do With STORM */}
      <Section isDark={isDark} title='Token Utility' icon={<Gift className='w-5 h-5' />}>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <UtilityCard isDark={isDark} title='Hold' description='Accumulate tokens before trading goes live' />
          <UtilityCard isDark={isDark} title='Use' description='Pay for subscriptions at a 10% discount' />
          <UtilityCard isDark={isDark} title='Trade' description='Once trading is enabled, sell or buy on exchanges' />
          <UtilityCard isDark={isDark} title='Vote' description='Have a say in future platform features' />
        </div>
      </Section>

      {/* Anti-Gaming & Security */}
      <Section isDark={isDark} title='Anti-Gaming Protection' icon={<Shield className='w-5 h-5' />}>
        <p className='mb-3'>
          Every STORM token represents real economic activity. Our anti-abuse
          mechanisms ensure fair distribution:
        </p>
        <ul className={`space-y-2 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          <li className='flex items-start gap-2'>
            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-teal-600'}`} />
            <span>
              <strong>Tokens require real USDC payments</strong> — No free
              claiming or bot farming
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-teal-600'}`} />
            <span>
              <strong>Smooth decay creates scarcity</strong> — Rewards decrease
              with each transaction
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-teal-600'}`} />
            <span>
              <strong>Revenue-backed value</strong> — Liquidity funded by actual
              platform revenue
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-teal-600'}`} />
            <span>
              <strong>Referral sybil protection</strong> — Self-referral blocked at DB level,
              one referral per user, per-user caps, wallet-verified payouts
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-teal-400' : 'bg-teal-600'}`} />
            <span>
              <strong>Server-side validation</strong> — Reward endpoints are
              internal-only with cryptographic verification
            </span>
          </li>
        </ul>
      </Section>

      {/* Important Notes */}
      <Section isDark={isDark} title='Important Notes'>
        <div className={`p-4 rounded-lg ${
          isDark
            ? 'bg-gray-700/50 border border-gray-600'
            : 'bg-gray-100 border border-gray-200'
        }`}>
          <ul className='space-y-2 text-sm'>
            <li>
              • STORM is a <strong>bonus reward</strong>, not a requirement. The
              platform works fine without it.
            </li>
            <li>
              • Tokens have <strong>no market price</strong> until trading is
              enabled.
            </li>
            <li>
              • Token prices can go up or down once trading begins. This is not
              financial advice.
            </li>
            <li>
              • You don't need to understand crypto to use the platform. STORM
              is just a bonus.
            </li>
          </ul>
        </div>
      </Section>

      {/* Footer */}
      <div className={`mt-12 pt-8 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} text-center`}>
        <p className={`text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
          Questions? Contact us at support@stormchain.ai
        </p>
      </div>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({ isDark, label, value }: { isDark: boolean; label: string; value: string }) {
  return (
    <div className={`p-4 rounded-xl text-center ${
      isDark
        ? 'bg-gray-800/50 border border-gray-700'
        : 'bg-white border border-gray-200'
    }`}>
      <p className={`text-2xl font-bold ${isDark ? 'text-teal-400' : 'text-teal-600'}`}>
        {value}
      </p>
      <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {label}
      </p>
    </div>
  )
}

function DistributionBar({
  isDark,
  label,
  amount,
  percentage,
  color,
  description,
}: {
  isDark: boolean
  label: string
  amount: string
  percentage: number
  color: 'green' | 'blue' | 'purple' | 'orange'
  description: string
}) {
  const colorClasses = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-1'>
        <span className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>
          {label}
        </span>
        <span className={`text-sm font-mono ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
          {amount} ({percentage}%)
        </span>
      </div>
      <div className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`}>
        <div className={`h-full rounded-full ${colorClasses[color]}`} style={{ width: `${percentage}%` }} />
      </div>
      <p className={`text-xs mt-1 ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
        {description}
      </p>
    </div>
  )
}

function UtilityCard({ isDark, title, description }: { isDark: boolean; title: string; description: string }) {
  return (
    <div className={`p-4 rounded-lg ${
      isDark
        ? 'bg-gray-700/50 border border-gray-600'
        : 'bg-gray-50 border border-gray-200'
    }`}>
      <p className={`font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </p>
      <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
        {description}
      </p>
    </div>
  )
}

function Section({
  isDark,
  title,
  icon,
  children,
}: {
  isDark: boolean
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className={`mb-6 p-6 rounded-xl shadow-lg border ${
      isDark
        ? 'bg-gray-800/50 border-gray-700'
        : 'bg-white border-gray-200'
    }`}>
      <h2 className={`flex items-center gap-2 text-xl font-semibold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
        {icon && (
          <span className={isDark ? 'text-teal-400' : 'text-teal-600'}>
            {icon}
          </span>
        )}
        {title}
      </h2>
      <div className={`${isDark ? 'text-gray-300' : 'text-gray-600'} leading-relaxed`}>
        {children}
      </div>
    </section>
  )
}
