export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED'

export type Incident = {
  id: string
  org_id: string
  agent_id: string | null
  title: string
  description: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type IncidentInsert = {
  org_id: string
  agent_id?: string | null
  title: string
  description?: string | null
  severity?: IncidentSeverity
  status?: IncidentStatus
  metadata?: Record<string, unknown> | null
}

export const INCIDENT_SEVERITIES: IncidentSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
export const INCIDENT_STATUSES: IncidentStatus[] = ['OPEN', 'INVESTIGATING', 'RESOLVED']

export const severityStyles: Record<IncidentSeverity, string> = {
  LOW: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200',
  MEDIUM: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  CRITICAL: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

export const statusStyles: Record<IncidentStatus, string> = {
  OPEN: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  INVESTIGATING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
}
