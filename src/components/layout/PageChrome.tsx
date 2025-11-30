'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PageHeader } from './PageHeader'

interface PageChromeProps {
  title: string
  description?: string
  badge?: ReactNode
  headerActions?: ReactNode
  children: ReactNode
  className?: string
  searchContent?: ReactNode
  filtersContent?: ReactNode
  footerContent?: ReactNode
  emptyFiltersMessage?: string
  showSearchSection?: boolean
}

/**
 * PageChrome enforces the shared page scaffold:
 * - top header with title/description
 * - search + filters strip directly below the header
 * - scrollable content area
 * - optional sticky footer for contextual actions
 */
export function PageChrome({
  title,
  description,
  badge,
  headerActions,
  children,
  className,
  searchContent,
  filtersContent,
  footerContent,
  emptyFiltersMessage = 'This view has no search or filter controls yet.',
  showSearchSection = true,
}: PageChromeProps) {
  const hasSearchSlots = Boolean(searchContent || filtersContent)
  const gridTemplate = (() => {
    if (showSearchSection) {
      return footerContent ? 'grid-rows-[auto_auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_auto_minmax(0,1fr)]'
    }
    return footerContent ? 'grid-rows-[auto_minmax(0,1fr)_auto]' : 'grid-rows-[auto_minmax(0,1fr)]'
  })()

  return (
    <div className={cn('grid h-full min-h-0 flex-1 gap-6', gridTemplate, className)}>
      <PageHeader title={title} description={description} badge={badge} actions={headerActions} />

      {showSearchSection && (
        <section className="rounded-[28px] border border-slate-200/70 bg-white p-4 shadow-[0_15px_45px_-35px_rgba(15,23,42,0.8)] md:p-6">
          {hasSearchSlots ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              {searchContent && <div className="w-full flex-1">{searchContent}</div>}
              {filtersContent && (
                <div className="flex w-full flex-wrap gap-3 lg:w-auto lg:justify-end">
                  {filtersContent}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{emptyFiltersMessage}</p>
          )}
        </section>
      )}

      <div className="h-full min-h-0 overflow-hidden">
        <div className="flex h-full flex-col gap-6 overflow-y-auto pr-1">{children}</div>
      </div>

      {footerContent && (
        <footer className="flex-none">
          <div className="rounded-[28px] border border-slate-200 bg-white/95 px-6 py-4 shadow-[0_25px_65px_-40px_rgba(15,23,42,0.85)] backdrop-blur supports-[backdrop-filter]:bg-white/80">
            {footerContent}
          </div>
        </footer>
      )}
    </div>
  )
}



