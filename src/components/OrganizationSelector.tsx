import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { useOrganization } from '@/context/OrganizationContext'
import type { Organization } from '@/types/organization'

const planLabel: Record<Organization['plan'], string> = {
  starter: 'Starter',
  growth: 'Growth',
  enterprise: 'Enterprise',
}

export function OrganizationSelector() {
  const { currentOrg, organizations, setCurrentOrg } = useOrganization()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition-colors hover:bg-slate-50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
          <Building2 className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-slate-900">
            {currentOrg.name}
          </span>
          <span className="block truncate text-xs text-slate-500">
            {planLabel[currentOrg.plan]}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Switch organization
          </p>
          {organizations.map((org) => {
            const isActive = org.id === currentOrg.id
            return (
              <button
                key={org.id}
                type="button"
                onClick={() => {
                  setCurrentOrg(org)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isActive ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand-600 text-white">
                  <Building2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">
                    {org.name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {planLabel[org.plan]}
                  </span>
                </span>
                {isActive && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
