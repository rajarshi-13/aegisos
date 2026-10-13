export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type Approval = {
  id: string
  org_id: string
  agent_id: string
  agent_name: string
  action_type: string
  action_value: number | null
  requested_by: string
  status: ApprovalStatus
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type ApprovalInsert = {
  org_id: string
  agent_id: string
  agent_name: string
  action_type: string
  action_value?: number | null
  requested_by: string
  status?: ApprovalStatus
}
