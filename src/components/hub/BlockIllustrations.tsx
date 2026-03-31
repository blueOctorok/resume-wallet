/**
 * Styled placeholder illustrations for each hub block tile.
 *
 * Each illustration is a small composition of lucide icons and SVG shapes
 * that gives the tile a unique visual identity. They receive the block's
 * accent color classes so the palette stays per-block.
 */
import {
  FileText,
  ClipboardCheck,
  ShieldCheck,
  IdCard,
  Globe,
  Github,
  FolderGit2,
  Wrench,
  Check,
  Link,
  GitBranch,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface IllustrationProps {
  accentText: string
  isDark: boolean
}

/** Soft radial bloom behind art so tiles feel finished, not flat icon drops. */
function IllustrationFrame({
  accentText,
  isDark,
  children,
}: {
  accentText: string
  isDark: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('relative z-0 flex flex-col items-center text-current', accentText)}>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-1/2 top-1/2 h-[4.25rem] w-[4.25rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-xl',
          isDark ? 'opacity-[0.22]' : 'opacity-[0.15]',
        )}
        style={{ background: 'currentColor' }}
      />
      <div className='relative z-[1]'>{children}</div>
    </div>
  )
}

function ResumeIllustration({ accentText, isDark }: IllustrationProps) {
  const barColor = isDark ? 'bg-gray-600/60' : 'bg-gray-300/80'
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative flex flex-col items-center gap-1.5'>
        <FileText className={cn('w-8 h-8 drop-shadow-sm', accentText)} />
        <div className='flex w-12 flex-col gap-1'>
          <div className={cn('h-[3px] w-full rounded-full', barColor)} />
          <div className={cn('h-[3px] w-10 rounded-full', barColor)} />
          <div className={cn('h-[3px] w-7 rounded-full', barColor)} />
        </div>
      </div>
    </IllustrationFrame>
  )
}

function DotAppIllustration({ accentText, isDark }: IllustrationProps) {
  const barColor = isDark ? 'bg-gray-600/60' : 'bg-gray-300/80'
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative flex flex-col items-center gap-1'>
        <ClipboardCheck className={cn('w-8 h-8 drop-shadow-sm', accentText)} />
        <div className='flex w-12 flex-col gap-1'>
          {[true, true, false].map((checked, i) => (
            <div key={i} className='flex items-center gap-1'>
              <div
                className={cn(
                  'flex h-2.5 w-2.5 flex-shrink-0 items-center justify-center rounded-sm',
                  checked
                    ? accentText.replace('text-', 'bg-').replace('400', '500/30').replace('600', '500/20')
                    : barColor,
                )}
              >
                {checked && <Check className={cn('h-2 w-2', accentText)} />}
              </div>
              <div className={cn('h-[2px] flex-1 rounded-full', barColor)} />
            </div>
          ))}
        </div>
      </div>
    </IllustrationFrame>
  )
}

function MvrIllustration({ accentText, isDark }: IllustrationProps) {
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative'>
        <ShieldCheck className={cn('h-10 w-10 drop-shadow-sm', accentText)} />
        <div className='absolute -bottom-0.5 -right-1 rounded-full bg-green-500 p-0.5'>
          <Check className='h-2.5 w-2.5 text-white' />
        </div>
      </div>
    </IllustrationFrame>
  )
}

/** Voluntary employer date confirmation — distinct from MVR shield */
function EmploymentVerificationIllustration({ accentText, isDark }: IllustrationProps) {
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative flex flex-col items-center gap-0.5'>
        <Mail className={cn('h-8 w-8 drop-shadow-sm', accentText)} />
        <ClipboardCheck className={cn('-mt-1 h-5 w-5 opacity-80', accentText)} />
      </div>
    </IllustrationFrame>
  )
}

function CdlIllustration({ accentText, isDark }: IllustrationProps) {
  const barColor = isDark ? 'bg-gray-600/60' : 'bg-gray-300/80'
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative flex flex-col items-center gap-1.5'>
        <IdCard className={cn('h-8 w-8 drop-shadow-sm', accentText)} />
        <div className='flex gap-1'>
          <div className={cn('h-[3px] w-4 rounded-full', barColor)} />
          <div className={cn('h-[3px] w-6 rounded-full', barColor)} />
        </div>
      </div>
    </IllustrationFrame>
  )
}

function PortfolioIllustration({ accentText, isDark }: IllustrationProps) {
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative'>
        <Globe className={cn('h-9 w-9 drop-shadow-sm', accentText)} />
        <Link className={cn('absolute -right-1.5 -top-0.5 h-3.5 w-3.5 opacity-60', accentText)} />
        <Link className={cn('absolute -bottom-0.5 -left-1 h-3 w-3 opacity-40', accentText)} />
      </div>
    </IllustrationFrame>
  )
}

function GithubIllustration({ accentText, isDark }: IllustrationProps) {
  const dotColor = isDark ? 'bg-green-500/50' : 'bg-green-500/40'
  const dimDot = isDark ? 'bg-gray-600/40' : 'bg-gray-300/50'
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='flex flex-col items-center gap-1.5'>
        <Github className={cn('h-8 w-8 drop-shadow-sm', accentText)} />
        <div className='grid grid-cols-7 gap-[2px]'>
          {[0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1].map((on, i) => (
            <div key={i} className={cn('h-1.5 w-1.5 rounded-[1px]', on ? dotColor : dimDot)} />
          ))}
        </div>
      </div>
    </IllustrationFrame>
  )
}

function ProjectsIllustration({ accentText, isDark }: IllustrationProps) {
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <div className='relative flex flex-col items-center gap-1'>
        <FolderGit2 className={cn('h-8 w-8 drop-shadow-sm', accentText)} />
        <div className='flex items-center gap-1'>
          <GitBranch className={cn('h-3.5 w-3.5 opacity-50', accentText)} />
          <GitBranch className={cn('h-3 w-3 opacity-30', accentText)} />
        </div>
      </div>
    </IllustrationFrame>
  )
}

/** Default fallback */
function DefaultIllustration({ accentText, isDark }: IllustrationProps) {
  return (
    <IllustrationFrame accentText={accentText} isDark={isDark}>
      <Wrench className={cn('h-9 w-9 drop-shadow-sm', accentText)} />
    </IllustrationFrame>
  )
}

type IllustrationComponent = (props: IllustrationProps) => React.ReactElement

const ILLUSTRATION_MAP: Record<string, IllustrationComponent> = {
  'driver-resume':          ResumeIllustration,
  'developer-resume':       ResumeIllustration,
  'driver-dot-application': DotAppIllustration,
  'driver-mvr':             MvrIllustration,
  'driver-cdl-credentials': CdlIllustration,
  'developer-portfolio':    PortfolioIllustration,
  'developer-github':       GithubIllustration,
  'developer-projects':     ProjectsIllustration,
  'general-resume':         ResumeIllustration,
  'general-employment-verification': EmploymentVerificationIllustration,
}

export function getBlockIllustration(blockType: string): IllustrationComponent {
  return ILLUSTRATION_MAP[blockType] ?? DefaultIllustration
}
