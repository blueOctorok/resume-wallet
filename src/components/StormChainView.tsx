'use client'

import { useTheme } from '@/contexts/ThemeContext'
import {
  ArrowLeft,
  Briefcase,
  Coins,
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
} from 'lucide-react'

interface StormChainViewProps {
  onBack: () => void
}

export default function StormChainView({ onBack }: StormChainViewProps) {
  const { isDark } = useTheme()

  return (
    <div className='max-w-4xl mx-auto'>
      {/* Back Button */}
      <div className='mb-6'>
        <button
          onClick={onBack}
          className={`inline-flex items-center gap-2 text-sm font-medium transition-colors cursor-pointer ${
            isDark
              ? 'text-brand-cream/70 hover:text-brand-mint'
              : 'text-brand-sage/70 hover:text-brand-sage'
          }`}
        >
          <ArrowLeft className='w-4 h-4' />
          Back to Hub
        </button>
      </div>

      {/* Hero Header */}
      <div className='text-center mb-10'>
        <div className='inline-flex items-center gap-3 mb-4'>
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl ${
              isDark
                ? 'bg-gradient-to-br from-brand-mint to-brand-sage-light'
                : 'bg-gradient-to-br from-brand-sage to-brand-sage-dark'
            }`}
          >
            <Coins
              className={`w-10 h-10 ${isDark ? 'text-brand-sage-dark' : 'text-white'}`}
            />
          </div>
        </div>
        <h1
          className={`text-4xl sm:text-5xl font-bold mb-3 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
        >
          StormChain Token
        </h1>
        <p
          className={`text-xl ${isDark ? 'text-brand-cream/80' : 'text-brand-sage/70'}`}
        >
          The reward token for verified professionals
        </p>
        <div
          className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            isDark
              ? 'bg-brand-mint/20 text-brand-mint'
              : 'bg-brand-sage/10 text-brand-sage'
          }`}
        >
          <Lock className='w-4 h-4' />
          Total Supply: 15,000,000 STORM
        </div>
      </div>

      {/* Key Stats Row */}
      <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-8'>
        <StatCard isDark={isDark} label='Total Supply' value='15M' />
        <StatCard isDark={isDark} label='Driver Rewards' value='60%' />
        <StatCard isDark={isDark} label='Per $3 USDC' value='~10' />
        <StatCard isDark={isDark} label='Decay Model' value='Smooth' />
      </div>

      {/* What is STORM */}
      <Section
        isDark={isDark}
        title='What is STORM?'
        icon={<Coins className='w-5 h-5' />}
      >
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
      <Section
        isDark={isDark}
        title='How You Earn'
        icon={<Coins className='w-5 h-5' />}
      >
        <p className='mb-4'>
          <strong>
            Tokens are based on how much USDC you spend, not which product you
            buy.
          </strong>{' '}
          One formula for everything: spend $X USDC → earn Y tokens (with decay
          as the pool depletes).
        </p>
        <div
          className={`p-4 rounded-lg mb-4 ${
            isDark
              ? 'bg-brand-sage/50 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
          <p
            className={`font-medium mb-2 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
          >
            Examples at current rate (before decay)
          </p>
          <ul
            className={`text-sm space-y-1 ${isDark ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
          >
            <li>• $3 USDC spent → ~10 tokens</li>
            <li>• $10 USDC spent → ~33 tokens</li>
            <li>• Any product, any price: same rule</li>
          </ul>
        </div>
        <p
          className={`text-sm ${isDark ? 'text-brand-cream/70' : 'text-brand-sage/70'}`}
        >
          As more tokens are distributed, the rate decreases (smooth decay).
          Early spenders earn more tokens per dollar.
        </p>
      </Section>

      {/* Token Distribution */}
      <Section
        isDark={isDark}
        title='Token Distribution'
        icon={<PieChart className='w-5 h-5' />}
      >
        <p className='mb-4'>
          There will only ever be <strong>15 million STORM tokens</strong>. No
          more can be created. Here's how they're allocated:
        </p>

        {/* Visual Distribution Bars */}
        <div className='space-y-3 mb-6'>
          <DistributionBar
            isDark={isDark}
            label='User Rewards'
            amount='9M'
            percentage={60}
            color='green'
            description='Earned by users through platform usage'
          />
          <DistributionBar
            isDark={isDark}
            label='Platform Treasury'
            amount='3M'
            percentage={20}
            color='blue'
            description='Buybacks, partnerships, liquidity'
          />
          <DistributionBar
            isDark={isDark}
            label='Founders'
            amount='2M'
            percentage={13.3}
            color='purple'
            description='Team that built the platform (vested)'
          />
          <DistributionBar
            isDark={isDark}
            label='DEX Liquidity'
            amount='1M'
            percentage={6.7}
            color='orange'
            description='Initial trading liquidity'
          />
        </div>

        {/* Distribution Table */}
        <div className='overflow-x-auto'>
          <table
            className={`w-full text-sm ${isDark ? 'text-brand-cream/90' : 'text-brand-sage'}`}
          >
            <thead>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}
              >
                <th className='text-left py-2 font-semibold'>Allocation</th>
                <th className='text-right py-2 font-semibold'>Amount</th>
                <th className='text-right py-2 font-semibold'>%</th>
              </tr>
            </thead>
            <tbody>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>User Rewards</td>
                <td className='py-2 text-right font-mono'>9,000,000</td>
                <td className='py-2 text-right'>60%</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>Platform Treasury</td>
                <td className='py-2 text-right font-mono'>3,000,000</td>
                <td className='py-2 text-right'>20%</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>Founders (Vested)</td>
                <td className='py-2 text-right font-mono'>2,000,000</td>
                <td className='py-2 text-right'>~13%</td>
              </tr>
              <tr>
                <td className='py-2'>DEX Liquidity</td>
                <td className='py-2 text-right font-mono'>1,000,000</td>
                <td className='py-2 text-right'>~7%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Smooth Decay Model */}
      <Section
        isDark={isDark}
        title='Smooth Decay Rewards'
        icon={<TrendingDown className='w-5 h-5' />}
      >
        <p className='mb-4'>
          Token rewards are based on <strong>USDC spent</strong>, with a{' '}
          <strong>smooth decay</strong>—inspired by Bitcoin, but fairer. As more
          tokens are distributed, the rate per dollar decreases gradually.
        </p>

        {/* Formula Box */}
        <div
          className={`p-4 rounded-lg font-mono text-center mb-4 ${
            isDark
              ? 'bg-brand-sage/50 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
          <p
            className={`text-sm mb-2 ${isDark ? 'text-brand-cream/60' : 'text-brand-sage/60'}`}
          >
            The Formula
          </p>
          <p
            className={`text-sm font-bold ${isDark ? 'text-brand-mint' : 'text-brand-sage'}`}
          >
            tokens = (USDC_spent × rate) × (remaining / total)^0.7
          </p>
          <p
            className={`text-xs mt-2 ${isDark ? 'text-brand-cream/60' : 'text-brand-sage/60'}`}
          >
            rate ≈ 3.33 tokens per $1 USDC at start (e.g. $3 → 10 tokens)
          </p>
        </div>

        <p
          className={`text-sm mb-4 ${isDark ? 'text-brand-cream/70' : 'text-brand-sage/70'}`}
        >
          <strong>What this means:</strong> Spend $3 USDC → ~10 tokens at the
          start. By the time 50% of the pool is distributed, $3 spend → ~6
          tokens. One rule for any product.
        </p>

        {/* Decay Curve Table */}
        <div className='overflow-x-auto'>
          <table
            className={`w-full text-sm ${isDark ? 'text-brand-cream/90' : 'text-brand-sage'}`}
          >
            <thead>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}
              >
                <th className='text-left py-2 font-semibold'>
                  Tokens Distributed
                </th>
                <th className='text-right py-2 font-semibold'>% Used</th>
                <th className='text-right py-2 font-semibold'>
                  Tokens per $3 USDC
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'} ${isDark ? 'bg-green-900/20' : 'bg-green-50'}`}
              >
                <td className='py-2 font-medium'>0</td>
                <td className='py-2 text-right'>0%</td>
                <td className='py-2 text-right font-mono font-bold'>10.00</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>1,000,000</td>
                <td className='py-2 text-right'>11%</td>
                <td className='py-2 text-right font-mono'>9.21</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>3,000,000</td>
                <td className='py-2 text-right'>33%</td>
                <td className='py-2 text-right font-mono'>7.52</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>4,500,000</td>
                <td className='py-2 text-right'>50%</td>
                <td className='py-2 text-right font-mono'>6.16</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>6,000,000</td>
                <td className='py-2 text-right'>67%</td>
                <td className='py-2 text-right font-mono'>4.63</td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>8,000,000</td>
                <td className='py-2 text-right'>89%</td>
                <td className='py-2 text-right font-mono'>2.15</td>
              </tr>
              <tr>
                <td className='py-2'>8,900,000</td>
                <td className='py-2 text-right'>99%</td>
                <td className='py-2 text-right font-mono'>0.44</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* Early Adopter Advantage */}
      <Section
        isDark={isDark}
        title='Early Adopter Advantage'
        icon={<TrendingUp className='w-5 h-5' />}
      >
        <p>
          The first users earn the most tokens. As more people join, the reward
          amounts gradually decrease. This rewards early believers and creates
          urgency to join sooner—but it's <strong>fair</strong>: the first user
          and the hundredth user earn nearly the same amount.
        </p>

        <div
          className={`mt-4 p-4 rounded-lg ${
            isDark
              ? 'bg-green-900/20 border border-green-500/30'
              : 'bg-green-50 border border-green-200'
          }`}
        >
          <p
            className={`font-semibold mb-2 ${isDark ? 'text-green-400' : 'text-green-700'}`}
          >
            <Zap className='w-4 h-4 inline mr-1' />
            Potential Upside
          </p>
          <p
            className={`text-sm ${isDark ? 'text-green-400/80' : 'text-green-600'}`}
          >
            Tokens have no market price until trading is enabled. Once the
            platform launches DEX liquidity, early token holders could see
            significant value if the platform grows successfully.
          </p>
        </div>
      </Section>

      {/* How Token Price Works */}
      <Section
        isDark={isDark}
        title='How Token Value Works'
        icon={<Calculator className='w-5 h-5' />}
      >
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

        <div
          className={`p-4 rounded-lg ${
            isDark
              ? 'bg-brand-sage/50 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
          <p
            className={`font-medium mb-2 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
          >
            Revenue-Backed Model
          </p>
          <p
            className={`text-sm ${isDark ? 'text-brand-cream/70' : 'text-brand-sage/70'}`}
          >
            Unlike speculative tokens, STORM liquidity is funded by actual
            platform revenue. Every token earned represents real economic
            activity on the platform.
          </p>
        </div>
      </Section>

      {/* Drivers Only */}
      <Section
        isDark={isDark}
        title='Who Earns STORM?'
        icon={<Users className='w-5 h-5' />}
      >
        <p>
          <strong>Only applicants earn STORM tokens.</strong> When employers pay
          for services, those tokens go into a platform fund—not to the
          employer.
        </p>
        <p className='mt-3'>
          This keeps things simple for companies (no token accounting) and
          directs all rewards to the users who actually use the platform.
        </p>

        <div
          className={`mt-4 p-4 rounded-lg ${
            isDark
              ? 'bg-brand-sage/50 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
          <p
            className={`font-medium mb-2 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
          >
            Platform Fund Uses:
          </p>
          <ul
            className={`text-sm space-y-1 ${isDark ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
          >
            <li>• Surprise bonuses for active users</li>
            <li>• "User of the Month" rewards</li>
            <li>
              • Rewards for employers who do well on StormChain (e.g. discounts)
            </li>
            <li>• Treasury for platform growth</li>
            <li>• Future liquidity provisions</li>
          </ul>
        </div>
      </Section>

      {/* For Employers */}
      <Section
        isDark={isDark}
        title='For Employers'
        icon={<Briefcase className='w-5 h-5' />}
      >
        <p>
          Employers don't earn STORM when they pay for platform services—those
          tokens go to the platform fund. You always{' '}
          <strong>pay in USDC</strong>. When token utility is live, employers
          who <strong>hold STORM</strong> in their wallet get{' '}
          <strong>lower USDC transaction costs</strong> on the platform (e.g.
          plans, bulk verification). You never pay in STORM—just hold it to
          qualify for the discount.
        </p>
        <p className='mt-3'>
          Holding (instead of spending tokens at checkout) keeps STORM scarcer
          and makes company books and taxes simpler: all platform spend stays in
          USDC.
        </p>
        <p className='mt-3'>
          From the same platform rewards bucket we could also reward employers
          who do well on StormChain (e.g. quality, engagement) with discounts—so
          performing well on the platform can earn you lower USDC costs too.
        </p>
        <div
          className={`mt-4 p-4 rounded-lg ${
            isDark
              ? 'bg-brand-sage/50 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
          <p
            className={`font-medium mb-2 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
          >
            Why this matters for employers
          </p>
          <ul
            className={`text-sm space-y-1 ${isDark ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
          >
            <li>
              • Pay only in USDC—no token accounting; applicants earn the
              rewards
            </li>
            <li>
              • Optional: buy and hold STORM on the DEX to get lower USDC fees
              on plans and bulk verification
            </li>
            <li>
              • Do well on StormChain and you could get rewards from the
              platform bucket (e.g. discounts)
            </li>
            <li>
              • Holding keeps tokens scarce and simplifies taxes and company
              books
            </li>
          </ul>
        </div>
      </Section>

      {/* Founder Commitment */}
      <Section
        isDark={isDark}
        title='Founder Commitment'
        icon={<Clock className='w-5 h-5' />}
      >
        <p>
          The two founders each receive 1 million STORM tokens. To show
          commitment, these tokens are locked and vest over time:
        </p>

        {/* Vesting Timeline Visual */}
        <div className='mt-4 mb-4'>
          <div className='flex items-center gap-2 mb-2'>
            {[1, 2, 3].map((year) => (
              <div key={year} className='flex-1'>
                <div
                  className={`h-3 rounded-full ${
                    year === 1
                      ? isDark
                        ? 'bg-red-500/50'
                        : 'bg-red-200'
                      : year === 2
                        ? isDark
                          ? 'bg-yellow-500/50'
                          : 'bg-yellow-200'
                        : isDark
                          ? 'bg-green-500/50'
                          : 'bg-green-200'
                  }`}
                />
                <p
                  className={`text-xs mt-1 text-center ${isDark ? 'text-brand-cream/60' : 'text-brand-sage/60'}`}
                >
                  Year {year}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className='overflow-x-auto'>
          <table
            className={`w-full text-sm ${isDark ? 'text-brand-cream/90' : 'text-brand-sage'}`}
          >
            <thead>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/30' : 'border-brand-sage/30'}`}
              >
                <th className='text-left py-2 font-semibold'>Year</th>
                <th className='text-right py-2 font-semibold'>Unlocked</th>
                <th className='text-left py-2 pl-4 font-semibold'>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>Year 1</td>
                <td className='py-2 text-right font-mono'>0%</td>
                <td className='py-2 pl-4'>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'}`}
                  >
                    Locked
                  </span>
                </td>
              </tr>
              <tr
                className={`border-b ${isDark ? 'border-brand-mint/10' : 'border-brand-sage/10'}`}
              >
                <td className='py-2'>Year 2</td>
                <td className='py-2 text-right font-mono'>50%</td>
                <td className='py-2 pl-4'>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-yellow-900/30 text-yellow-400' : 'bg-yellow-100 text-yellow-700'}`}
                  >
                    Partial
                  </span>
                </td>
              </tr>
              <tr>
                <td className='py-2'>Year 3</td>
                <td className='py-2 text-right font-mono'>100%</td>
                <td className='py-2 pl-4'>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${isDark ? 'bg-green-900/30 text-green-400' : 'bg-green-100 text-green-700'}`}
                  >
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
      <Section
        isDark={isDark}
        title='Token Utility'
        icon={<Gift className='w-5 h-5' />}
      >
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <UtilityCard
            isDark={isDark}
            title='Hold'
            description='Accumulate tokens before trading goes live'
          />
          <UtilityCard
            isDark={isDark}
            title='Use'
            description='Pay for subscriptions at a 10% discount'
          />
          <UtilityCard
            isDark={isDark}
            title='Trade'
            description='Once trading is enabled, sell or buy on exchanges'
          />
          <UtilityCard
            isDark={isDark}
            title='Vote'
            description='Have a say in future platform features'
          />
        </div>
      </Section>

      {/* Anti-Gaming & Security */}
      <Section
        isDark={isDark}
        title='Anti-Gaming Protection'
        icon={<Shield className='w-5 h-5' />}
      >
        <p className='mb-3'>
          Every STORM token represents real economic activity. Our anti-spam
          mechanisms ensure fair distribution:
        </p>
        <ul
          className={`space-y-2 ${isDark ? 'text-brand-cream/80' : 'text-brand-sage/80'}`}
        >
          <li className='flex items-start gap-2'>
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-brand-mint' : 'bg-brand-sage'}`}
            />
            <span>
              <strong>Tokens require real USDC payments</strong> — No free
              claiming or bot farming
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-brand-mint' : 'bg-brand-sage'}`}
            />
            <span>
              <strong>Smooth decay creates scarcity</strong> — Rewards decrease
              with each transaction
            </span>
          </li>
          <li className='flex items-start gap-2'>
            <span
              className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-brand-mint' : 'bg-brand-sage'}`}
            />
            <span>
              <strong>Revenue-backed value</strong> — Liquidity funded by actual
              platform revenue
            </span>
          </li>
        </ul>
      </Section>

      {/* Important Notes */}
      <Section isDark={isDark} title='Important Notes'>
        <div
          className={`p-4 rounded-lg ${
            isDark
              ? 'bg-brand-sage/50 border border-brand-mint/30'
              : 'bg-brand-sage/10 border border-brand-sage/30'
          }`}
        >
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
      <div
        className={`mt-12 pt-8 border-t ${isDark ? 'border-brand-mint/20' : 'border-brand-sage/20'} text-center`}
      >
        <p
          className={`text-sm ${isDark ? 'text-brand-cream/50' : 'text-brand-sage/60'}`}
        >
          Questions? Contact us at support@stormchain.ai
        </p>
      </div>
    </div>
  )
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({
  isDark,
  label,
  value,
}: {
  isDark: boolean
  label: string
  value: string
}) {
  return (
    <div
      className={`p-4 rounded-xl text-center ${
        isDark
          ? 'bg-brand-sage-light/20 border border-brand-mint/20'
          : 'bg-white/90 border border-brand-sage/20'
      }`}
    >
      <p
        className={`text-2xl font-bold ${isDark ? 'text-brand-mint' : 'text-brand-sage'}`}
      >
        {value}
      </p>
      <p
        className={`text-xs ${isDark ? 'text-brand-cream/60' : 'text-brand-sage/60'}`}
      >
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
    green: isDark ? 'bg-green-500' : 'bg-green-500',
    blue: isDark ? 'bg-blue-500' : 'bg-blue-500',
    purple: isDark ? 'bg-purple-500' : 'bg-purple-500',
    orange: isDark ? 'bg-orange-500' : 'bg-orange-500',
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-1'>
        <span
          className={`text-sm font-medium ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
        >
          {label}
        </span>
        <span
          className={`text-sm font-mono ${isDark ? 'text-brand-cream/70' : 'text-brand-sage/70'}`}
        >
          {amount} ({percentage}%)
        </span>
      </div>
      <div
        className={`h-3 rounded-full overflow-hidden ${isDark ? 'bg-brand-sage/30' : 'bg-gray-200'}`}
      >
        <div
          className={`h-full rounded-full ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p
        className={`text-xs mt-1 ${isDark ? 'text-brand-cream/50' : 'text-brand-sage/50'}`}
      >
        {description}
      </p>
    </div>
  )
}

function UtilityCard({
  isDark,
  title,
  description,
}: {
  isDark: boolean
  title: string
  description: string
}) {
  return (
    <div
      className={`p-4 rounded-lg ${
        isDark
          ? 'bg-brand-sage/30 border border-brand-mint/20'
          : 'bg-brand-sage/5 border border-brand-sage/20'
      }`}
    >
      <p
        className={`font-semibold mb-1 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
      >
        {title}
      </p>
      <p
        className={`text-sm ${isDark ? 'text-brand-cream/70' : 'text-brand-sage/70'}`}
      >
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
    <section
      className={`mb-6 p-6 rounded-xl shadow-lg border ${
        isDark
          ? 'bg-brand-sage-light/20 border-brand-mint/20 backdrop-blur-sm'
          : 'bg-white/90 border-brand-sage/20 backdrop-blur-sm'
      }`}
    >
      <h2
        className={`flex items-center gap-2 text-xl font-semibold mb-4 ${isDark ? 'text-brand-cream' : 'text-brand-sage'}`}
      >
        {icon && (
          <span className={isDark ? 'text-brand-mint' : 'text-brand-sage'}>
            {icon}
          </span>
        )}
        {title}
      </h2>
      <div
        className={`${isDark ? 'text-brand-cream/80' : 'text-brand-sage/80'} leading-relaxed`}
      >
        {children}
      </div>
    </section>
  )
}
