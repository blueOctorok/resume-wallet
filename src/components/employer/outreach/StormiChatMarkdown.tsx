'use client'

import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import { cn } from '@/lib/utils'

type BubbleVariant = 'user' | 'assistant'

interface StormiChatMarkdownProps {
  text: string
  variant: BubbleVariant
  isDark: boolean
}

/**
 * Renders Stormi / employer chat bodies as Markdown (**bold**, lists, links)
 * instead of raw `**tokens**`. `remarkBreaks` maps single newlines to `<br>`
 * so short AI paragraphs still read naturally.
 *
 * We do not use `rehype-raw` — no raw HTML from the model is executed.
 */
export default function StormiChatMarkdown({ text, variant, isDark }: StormiChatMarkdownProps) {
  const linkCls =
    variant === 'user'
      ? 'font-medium text-teal-100 underline decoration-teal-200/80 underline-offset-2 hover:text-white'
      : isDark
        ? 'font-medium text-violet-300 underline underline-offset-2 hover:text-violet-200'
        : 'font-medium text-violet-700 underline underline-offset-2 hover:text-violet-900'

  return (
    <div
      className={cn(
        'min-w-0 text-sm leading-relaxed [&>p]:mb-2 [&>p:last-child]:mb-0',
        '[&_ul]:my-2 [&_ul]:ml-4 [&_ul]:list-disc [&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal',
        '[&_li]:mb-0.5',
        '[&_strong]:font-semibold',
        '[&_em]:italic',
        '[&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem]',
        variant === 'user'
          ? '[&_code]:bg-teal-950/50 [&_code]:text-teal-50'
          : isDark
            ? '[&_code]:bg-gray-800/90 [&_code]:text-violet-100'
            : '[&_code]:bg-violet-100/90 [&_code]:text-violet-900',
        '[&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-semibold',
        '[&_h2]:mb-1 [&_h2]:text-sm [&_h2]:font-semibold',
        '[&_h3]:mb-1 [&_h3]:text-sm [&_h3]:font-semibold',
        '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-2 [&_blockquote]:opacity-90',
        variant === 'user'
          ? '[&_blockquote]:border-teal-300/50'
          : isDark
            ? '[&_blockquote]:border-violet-500/40'
            : '[&_blockquote]:border-violet-300',
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkBreaks]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className={linkCls}>
              {children}
            </a>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
