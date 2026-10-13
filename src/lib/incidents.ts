import { supabase } from './supabase'
import type { Incident, IncidentStatus } from '@/types/incident'

export async function listIncidentsByOrg(
  orgId: string,
  options?: { limit?: number },
): Promise<Incident[]> {
  let query = supabase
    .from('incidents')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function updateIncidentStatus(
  incidentId: string,
  status: IncidentStatus,
): Promise<Incident> {
  const { data, error } = await supabase
    .from('incidents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', incidentId)
    .select()
    .single()

  if (error) throw error
  if (!data) throw new Error('No incident returned after status update')
  return data
}

export function subscribeToIncidents(
  orgId: string,
  onInsert: (incident: Incident) => void,
  onUpdate: (incident: Incident) => void,
  onDelete: (id: string) => void,
) {
  const channel = supabase
    .channel(`incidents:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'incidents',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => onInsert(payload.new as Incident),
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'incidents',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => onUpdate(payload.new as Incident),
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'incidents',
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
