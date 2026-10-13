import { supabase } from './supabase'
import type { Approval, ApprovalStatus } from '@/types/approval'

export async function listApprovalsByOrg(
  orgId: string,
  status?: ApprovalStatus,
): Promise<Approval[]> {
  let query = supabase
    .from('approvals')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }
  return data ?? []
}

export async function resolveApproval(
  approvalId: string,
  status: 'APPROVED' | 'REJECTED',
  resolvedBy: string,
): Promise<Approval> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from('approvals')
    .update({
      status,
      resolved_by: resolvedBy,
      resolved_at: now,
      updated_at: now,
    })
    .eq('id', approvalId)
    .select()
    .single()

  if (error) {
    throw error
  }
  if (!data) {
    throw new Error('No approval returned after update')
  }
  return data
}

export function subscribeToApprovals(
  orgId: string,
  onInsert: (approval: Approval) => void,
  onUpdate: (approval: Approval) => void,
  onDelete: (id: string) => void,
) {
  const channel = supabase
    .channel(`approvals:${orgId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'approvals',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        onInsert(payload.new as Approval)
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'approvals',
        filter: `org_id=eq.${orgId}`,
      },
      (payload) => {
        onUpdate(payload.new as Approval)
      },
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'approvals',
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
