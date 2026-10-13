export interface Organization {
  id: string
  name: string
  slug: string
  plan: 'starter' | 'growth' | 'enterprise'
}

export const MOCK_ORGANIZATIONS: Organization[] = [
  {
    id: 'org_alpha',
    name: 'Org Alpha',
    slug: 'alpha',
    plan: 'enterprise',
  },
  {
    id: 'org_beta',
    name: 'Org Beta',
    slug: 'beta',
    plan: 'growth',
  },
]
