import { supabase } from './supabase'
import type { Agent, AgentInsert, AgentStatus } from '@/types/agent'

export async function listAgentsByOrg(orgId: string): Promise<Agent[]> {
  const { data, error } = await supabase
    .from('agents')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }
  return data ?? []
}

export async function createAgent(agent: AgentInsert): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .insert(agent)
    .select()
    .single()

  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('No agent returned after insert')
  }
  return data
}

export async function updateAgentStatus(
  agentId: string,
  status: AgentStatus,
): Promise<Agent> {
  const { data, error } = await supabase
    .from('agents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', agentId)
    .select()
    .single()

  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('No agent returned after status update')
  }
  return data
}

export function subscribeToAgents(
  orgId: string,
  onInsert: (agent: Agent) => void,
  onUpdate: (agent: Agent) => void,
  onDelete: (id: string) => void,
) {
  const channel = supabase
    .channel(`agents:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'agents',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        onInsert(payload.new as Agent)
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'agents',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        onUpdate(payload.new as Agent)
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'agents',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        const old = payload.old as { id?: string } | null
        if (old?.id) onDelete(old.id)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

const BREACH_OUTCOMES = ['INTERCEPT', 'BLOCK', 'DENIED'] as const

export interface AgentBreachInfo {
  agentId: string
  hasBreach: boolean
  latestBreachAt: string | null
  breachCount: number
}

export async function getAgentBreaches(
  orgId: string,
  sinceMinutes = 60,
): Promise<AgentBreachInfo[]> {
  const since = new Date(Date.now() - sinceMinutes * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('audit_logs')
    .select('agent_id, outcome, created_at')
    .eq('org_id', orgId)
    .in('outcome', [...BREACH_OUTCOMES])
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const map = new Map<string, AgentBreachInfo>()
  for (const row of data ?? []) {
    const agentId = row.agent_id
    if (!agentId) continue
    const existing = map.get(agentId)
    if (existing) {
      existing.breachCount += 1
    } else {
      map.set(agentId, {
        agentId,
        hasBreach: true,
        latestBreachAt: row.created_at,
        breachCount: 1,
      })
    }
  }

  return [...map.values()]
}
