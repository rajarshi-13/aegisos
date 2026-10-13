import { supabase } from './supabase'
import type { AuditLog } from '@/types/audit'

export async function listAuditLogsByOrg(
  orgId: string,
  limit = 100,
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw error
  }
  return data ?? []
}

export function subscribeToAuditLogs(
  orgId: string,
  onInsert: (log: AuditLog) => void,
) {
  const channel = supabase
    .channel(`audit_logs:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'audit_logs',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        onInsert(payload.new as AuditLog)
      },
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
