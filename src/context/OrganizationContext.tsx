import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { MOCK_ORGANIZATIONS, type Organization } from '@/types/organization'
import { listOrganizations } from '@/lib/organizations'

interface OrganizationContextValue {
  organizations: Organization[]
  currentOrg: Organization
  setCurrentOrg: (org: Organization) => void
  loading: boolean
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(
  undefined,
)

const STORAGE_KEY = 'aegis.os.currentOrgId'

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>(MOCK_ORGANIZATIONS)
  const [loading, setLoading] = useState(true)
  const [currentOrg, setCurrentOrgState] = useState<Organization>(() => {
    const storedId = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    return (
      MOCK_ORGANIZATIONS.find((o) => o.id === storedId) ?? MOCK_ORGANIZATIONS[0]
    )
  })

  useEffect(() => {
    let cancelled = false
    listOrganizations()
      .then((data) => {
        if (cancelled) return
        if (data.length > 0) {
          setOrganizations(data)
          setCurrentOrgState((prev) => {
            const storedId = localStorage.getItem(STORAGE_KEY)
            const match = data.find((o) => o.id === (storedId ?? prev.id))
            return match ?? data[0]
          })
        }
      })
      .catch((err) => {
        console.warn('[Aegis OS] Failed to load organizations from Supabase, using mocks.', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currentOrg.id)
  }, [currentOrg.id])

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organizations,
      currentOrg,
      setCurrentOrg: setCurrentOrgState,
      loading,
    }),
    [organizations, currentOrg, loading],
  )

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext)
  if (!ctx) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return ctx
}
