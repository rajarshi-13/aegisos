export type AuditOutcome = 'ALLOW' | 'INTERCEPT' | 'BLOCK' | 'SUCCESS' | 'DENIED' | 'REVIEW'

export type AuditLog = {
  id: string
  org_id: string
  agent_id: string | null
  actor: string
  action: string
  target: string
  outcome: AuditOutcome
  metadata: Record<string, unknown> | null
  created_at: string
}

export type AuditLogInsert = {
  org_id: string
  agent_id?: string | null
  actor: string
  action: string
  target: string
  outcome: AuditOutcome
  metadata?: Record<string, unknown> | null
}
