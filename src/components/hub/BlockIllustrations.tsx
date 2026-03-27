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

function ResumeIllustration({ accentText, isDark }: IllustrationProps) {
  const barColor = isDark ? 'bg-gray-600/60' : 'bg-gray-300/80'
  return (
    <div className='relative flex flex-col items-center gap-1.5'>
      <FileText className={cn('w-8 h-8', accentText)} />
      <div className='flex flex-col gap-1 w-12'>
        <div className={cn('h-[3px] rounded-full w-full', barColor)} />
        <div className={cn('h-[3px] rounded-full w-10', barColor)} />
        <div className={cn('h-[3px] rounded-full w-7', barColor)} />
      </div>
    </div>
  )
}

function DotAppIllustration({ accentText, isDark }: IllustrationProps) {
  const barColor = isDark ? 'bg-gray-600/60' : 'bg-gray-300/80'
  return (
    <div className='relative flex flex-col items-center gap-1'>
      <ClipboardCheck className={cn('w-8 h-8', accentText)} />
      <div className='flex flex-col gap-1 w-12'>
        {[true, true, false].map((checked, i) => (
          <div key={i} className='flex items-center gap-1'>
            <div className={cn(
              'w-2.5 h-2.5 rounded-sm flex items-center justify-center flex-shrink-0',
              checked ? accentText.replace('text-', 'bg-').replace('400', '500/30').replace('600', '500/20') : barColor
            )}>
              {checked && <Check className={cn('w-2 h-2', accentText)} />}
            </div>
            <div className={cn('h-[2px] rounded-full flex-1', barColor)} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MvrIllustration({ accentText }: IllustrationProps) {
  return (
    <div className='relative'>
      <ShieldCheck className={cn('w-10 h-10', accentText)} />
      <div className='absolute -bottom-0.5 -right-1 bg-green-500 rounded-full p-0.5'>
        <Check className='w-2.5 h-2.5 text-white' />
      </div>
    </div>
  )
}

/** Voluntary employer date confirmation — distinct from MVR shield */
function EmploymentVerificationIllustration({ accentText }: IllustrationProps) {
  return (
    <div className='relative flex flex-col items-center gap-0.5'>
      <Mail className={cn('w-8 h-8', accentText)} />
      <ClipboardCheck className={cn('w-5 h-5 -mt-1 opacity-80', accentText)} />
    </div>
  )
}

function CdlIllustration({ accentText, isDark }: IllustrationProps) {
  const barColor = isDark ? 'bg-gray-600/60' : 'bg-gray-300/80'
  return (
    <div className='relative flex flex-col items-center gap-1.5'>
      <IdCard className={cn('w-8 h-8', accentText)} />
      <div className='flex gap-1'>
        <div className={cn('h-[3px] w-4 rounded-full', barColor)} />
        <div className={cn('h-[3px] w-6 rounded-full', barColor)} />
      </div>
    </div>
  )
}

function PortfolioIllustration({ accentText }: IllustrationProps) {
  return (
    <div className='relative'>
      <Globe className={cn('w-9 h-9', accentText)} />
      <Link className={cn('w-3.5 h-3.5 absolute -top-0.5 -right-1.5', accentText, 'opacity-60')} />
      <Link className={cn('w-3 h-3 absolute -bottom-0.5 -left-1', accentText, 'opacity-40')} />
    </div>
  )
}

function GithubIllustration({ accentText, isDark }: IllustrationProps) {
  const dotColor = isDark ? 'bg-green-500/50' : 'bg-green-500/40'
  const dimDot = isDark ? 'bg-gray-600/40' : 'bg-gray-300/50'
  return (
    <div className='flex flex-col items-center gap-1.5'>
      <Github className={cn('w-8 h-8', accentText)} />
      {/* Mini contribution grid */}
      <div className='grid grid-cols-7 gap-[2px]'>
        {[0,1,1,0,1,0,1, 1,0,1,1,0,1,0, 0,1,0,1,1,0,1].map((on, i) => (
          <div key={i} className={cn('w-1.5 h-1.5 rounded-[1px]', on ? dotColor : dimDot)} />
        ))}
      </div>
    </div>
  )
}

function ProjectsIllustration({ accentText }: IllustrationProps) {
  return (
    <div className='relative flex flex-col items-center gap-1'>
      <FolderGit2 className={cn('w-8 h-8', accentText)} />
      <div className='flex items-center gap-1'>
        <GitBranch className={cn('w-3.5 h-3.5', accentText, 'opacity-50')} />
        <GitBranch className={cn('w-3 h-3', accentText, 'opacity-30')} />
      </div>
    </div>
  )
}

/** Default fallback */
function DefaultIllustration({ accentText }: IllustrationProps) {
  return <Wrench className={cn('w-9 h-9', accentText)} />
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
