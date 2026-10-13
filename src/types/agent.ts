export type AgentStatus = 'ACTIVE' | 'PAUSED'
export type RiskTier = 'low' | 'medium' | 'high'

export const AGENT_ROLES = [
  'Support Specialist',
  'Financial Bot',
  'Database Admin',
  'Data Classifier',
  'Legal Reviewer',
  'Sales Assistant',
  'HR Assistant',
  'Ops Automator',
  'Other',
] as const

export type AgentRole = (typeof AGENT_ROLES)[number]

export type Agent = {
  id: string
  org_id: string
  name: string
  agent_id: string
  role: string
  risk_tier: RiskTier
  owner: string
  status: AgentStatus
  webhook_url: string
  created_at: string
  updated_at: string
}

export type AgentInsert = {
  org_id: string
  name: string
  agent_id: string
  role?: string
  risk_tier: RiskTier
  owner: string
  status?: AgentStatus
  webhook_url?: string
}
