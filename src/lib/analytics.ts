import { supabase } from './supabase'
import type { AuditLog } from '@/types/audit'
import type { Incident } from '@/types/incident'

export type TimeWindow = '15M' | '1H' | '6H' | '24H' | '7D'

const WINDOW_MINUTES: Record<TimeWindow, number> = {
  '15M': 15,
  '1H': 60,
  '6H': 360,
  '24H': 1440,
  '7D': 10080,
}

const BUCKET_MINUTES: Record<TimeWindow, number> = {
  '15M': 1,
  '1H': 5,
  '6H': 30,
  '24H': 60,
  '7D': 360,
}

export const TIME_WINDOWS: TimeWindow[] = ['15M', '1H', '6H', '24H', '7D']

export type VerdictCategory = 'Allow' | 'Require Approval' | 'Deny' | 'Governance'

function categorizeOutcome(outcome: string): VerdictCategory {
  switch (outcome) {
    case 'ALLOW':
    case 'SUCCESS':
      return 'Allow'
    case 'INTERCEPT':
      return 'Governance'
    case 'REVIEW':
      return 'Require Approval'
    case 'BLOCK':
    case 'DENIED':
      return 'Deny'
    default:
      return 'Allow'
  }
}

const HELD_CATEGORIES: VerdictCategory[] = ['Governance', 'Deny', 'Require Approval']

function bucketStart(ts: number, bucketMs: number): number {
  return Math.floor(ts / bucketMs) * bucketMs
}

function formatBucketLabel(ts: number, window: TimeWindow): string {
  const d = new Date(ts)
  if (window === '7D' || window === '24H') {
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export interface ActivityBucket {
  time: string
  allowed: number
  held: number
}

export interface IncidentBucket {
  time: string
  incidents: number
}

export interface VerdictMix {
  name: VerdictCategory
  value: number
}

export interface AgentActivity {
  name: string
  actions: number
}

export interface AnalyticsResult {
  actionsInWindow: number
  actionsPerMin: number
  incidentsInWindow: number
  heldDeniedShare: number
  activityOverTime: ActivityBucket[]
  incidentsOverTime: IncidentBucket[]
  verdictMix: VerdictMix[]
  mostActiveAgents: AgentActivity[]
}

export async function getAnalytics(
  orgId: string,
  window: TimeWindow,
): Promise<AnalyticsResult> {
  const windowMs = WINDOW_MINUTES[window] * 60 * 1000
  const bucketMs = BUCKET_MINUTES[window] * 60 * 1000
  const since = new Date(Date.now() - windowMs).toISOString()

  const [logsRes, incidentsRes, agentsRes] = await Promise.all([
    supabase
      .from('audit_logs')
      .select('agent_id, outcome, created_at')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    supabase
      .from('incidents')
      .select('created_at')
      .eq('org_id', orgId)
      .gte('created_at', since)
      .order('created_at', { ascending: true }),
    supabase
      .from('agents')
      .select('agent_id, name')
      .eq('org_id', orgId),
  ])

  if (logsRes.error) throw logsRes.error
  if (incidentsRes.error) throw incidentsRes.error
  if (agentsRes.error) throw agentsRes.error

  const logs = (logsRes.data ?? []) as Pick<AuditLog, 'agent_id' | 'outcome' | 'created_at'>[]
  const incidents = (incidentsRes.data ?? []) as Pick<Incident, 'created_at'>[]
  const agents = (agentsRes.data ?? []) as { agent_id: string; name: string }[]
  const agentNameById = new Map(agents.map((a) => [a.agent_id, a.name]))

  const actionsInWindow = logs.length
  const actionsPerMin = actionsInWindow > 0 ? +(actionsInWindow / WINDOW_MINUTES[window]).toFixed(2) : 0

  const heldCount = logs.filter((l) => HELD_CATEGORIES.includes(categorizeOutcome(l.outcome))).length
  const heldDeniedShare = actionsInWindow > 0 ? +((heldCount / actionsInWindow) * 100).toFixed(1) : 0

  const incidentsInWindow = incidents.length

  const activityMap = new Map<number, { allowed: number; held: number }>()
  for (const log of logs) {
    const ts = bucketStart(new Date(log.created_at).getTime(), bucketMs)
    const bucket = activityMap.get(ts) ?? { allowed: 0, held: 0 }
    if (HELD_CATEGORIES.includes(categorizeOutcome(log.outcome))) {
      bucket.held += 1
    } else {
      bucket.allowed += 1
    }
    activityMap.set(ts, bucket)
  }

  const activityOverTime: ActivityBucket[] = [...activityMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, counts]) => ({
      time: formatBucketLabel(ts, window),
      allowed: counts.allowed,
      held: counts.held,
    }))

  const incidentMap = new Map<number, number>()
  for (const inc of incidents) {
    const ts = bucketStart(new Date(inc.created_at).getTime(), bucketMs)
    incidentMap.set(ts, (incidentMap.get(ts) ?? 0) + 1)
  }

  const incidentsOverTime: IncidentBucket[] = [...incidentMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, count]) => ({
      time: formatBucketLabel(ts, window),
      incidents: count,
    }))

  const verdictCounts: Record<VerdictCategory, number> = {
    Allow: 0,
    'Require Approval': 0,
    Deny: 0,
    Governance: 0,
  }
  for (const log of logs) {
    verdictCounts[categorizeOutcome(log.outcome)] += 1
  }
  const verdictMix: VerdictMix[] = (Object.keys(verdictCounts) as VerdictCategory[])
    .map((name) => ({ name, value: verdictCounts[name] }))

  const agentCount = new Map<string, number>()
  for (const log of logs) {
    const id = log.agent_id
    if (!id) continue
    agentCount.set(id, (agentCount.get(id) ?? 0) + 1)
  }
  const mostActiveAgents: AgentActivity[] = [...agentCount.entries()]
    .map(([id, actions]) => ({ name: agentNameById.get(id) ?? id, actions }))
    .sort((a, b) => b.actions - a.actions)
    .slice(0, 8)

  return {
    actionsInWindow,
    actionsPerMin,
    incidentsInWindow,
    heldDeniedShare,
    activityOverTime,
    incidentsOverTime,
    verdictMix,
    mostActiveAgents,
  }
}
