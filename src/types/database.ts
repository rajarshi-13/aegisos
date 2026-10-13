import type { Agent, AgentInsert, AgentStatus, RiskTier } from './agent'
import type { Approval, ApprovalInsert, ApprovalStatus } from './approval'
import type { AuditLog, AuditLogInsert, AuditOutcome } from './audit'
import type { Incident, IncidentInsert, IncidentSeverity, IncidentStatus } from './incident'

export interface Database {
  public: {
    Tables: {
      agents: {
        Row: Agent
        Insert: AgentInsert
        Update: Partial<AgentInsert> & {
          status?: AgentStatus
          updated_at?: string
        }
        Relationships: []
      }
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: 'starter' | 'growth' | 'enterprise'
        }
        Insert: {
          id?: string
          name: string
          slug: string
          plan?: 'starter' | 'growth' | 'enterprise'
        }
        Update: {
          name?: string
          slug?: string
          plan?: 'starter' | 'growth' | 'enterprise'
        }
        Relationships: []
      }
      approvals: {
        Row: Approval
        Insert: ApprovalInsert
        Update: {
          status?: ApprovalStatus
          resolved_by?: string | null
          resolved_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: AuditLog
        Insert: AuditLogInsert
        Update: never
        Relationships: []
      }
      incidents: {
        Row: Incident
        Insert: IncidentInsert
        Update: {
          status?: IncidentStatus
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      agent_status: AgentStatus
      risk_tier: RiskTier
      approval_status: ApprovalStatus
      audit_outcome: AuditOutcome
      incident_severity: IncidentSeverity
      incident_status: IncidentStatus
    }
    CompositeTypes: Record<string, never>
  }
}
