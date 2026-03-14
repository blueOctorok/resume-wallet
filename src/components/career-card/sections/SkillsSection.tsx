'use client'

import { Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SkillsData, CareerCardMode } from '@/types/career-card'

interface SkillsSectionProps {
  data: SkillsData
  mode: CareerCardMode
  isDark: boolean
}

export default function SkillsSection({ data, isDark }: SkillsSectionProps) {
  if (!data.skills.length) return null

  // Group by category if present
  const categorized = data.skills.reduce<Record<string, string[]>>((acc, skill) => {
    const cat = skill.category ?? 'General'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(skill.name)
    return acc
  }, {})

  const categories = Object.entries(categorized)

  return (
    <div className={cn(
      'rounded-xl border p-4',
      isDark ? 'bg-gray-800/40 border-gray-700' : 'bg-white border-gray-200'
    )}>
      <div className='flex items-center gap-2 mb-3'>
        <Wrench className={cn('w-4 h-4', isDark ? 'text-teal-400' : 'text-teal-600')} />
        <h3 className={cn('text-sm font-semibold', isDark ? 'text-white' : 'text-gray-900')}>
          Skills
        </h3>
      </div>

      <div className='space-y-3'>
        {categories.map(([category, skills]) => (
          <div key={category}>
            {categories.length > 1 && (
              <p className={cn('text-xs mb-1.5', isDark ? 'text-gray-400' : 'text-gray-500')}>
                {category}
              </p>
            )}
            <div className='flex flex-wrap gap-1.5'>
              {skills.map((name) => (
                <span
                  key={name}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full',
                    isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-700'
                  )}
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
