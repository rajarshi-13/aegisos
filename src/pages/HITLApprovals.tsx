import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Clock, Loader2, RefreshCw, X } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useOrganization } from '@/context/OrganizationContext'
import {
  listApprovalsByOrg,
  resolveApproval,
  subscribeToApprovals,
} from '@/lib/approvals'
import { formatRelativeTime } from '@/lib/format'
import type { Approval, ApprovalStatus } from '@/types/approval'

type Filter = 'PENDING' | 'ALL'

const statusStyles: Record<ApprovalStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

const actionTypeRisk: Record<string, string> = {
  DROP_TABLE: 'high',
  DELETE_USER: 'high',
  TRANSFER: 'high',
  REFUND: 'medium',
  MODIFY_CONFIG: 'medium',
  DEPLOY_AGENT: 'medium',
  ACCESS_DATA: 'low',
  SEND_EMAIL: 'low',
}

const riskStyles: Record<string, string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  high: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

export function HITLApprovals() {
  const { currentOrg } = useOrganization()
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [resolvingId, setResolvingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadApprovals = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listApprovalsByOrg(currentOrg.id)
      setApprovals(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to load approvals: ${err.message}`
          : 'Unable to load approvals. Check your Supabase configuration.',
      )
    } finally {
      setLoading(false)
    }
  }, [currentOrg.id])

  useEffect(() => {
    loadApprovals()
  }, [loadApprovals])

  useEffect(() => {
    const cleanup = subscribeToApprovals(
      currentOrg.id,
      (inserted) => {
        setApprovals((prev) => {
          if (prev.some((a) => a.id === inserted.id)) return prev
          return [inserted, ...prev]
        })
      },
      (updated) => {
        setApprovals((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      },
      (id) => {
        setApprovals((prev) => prev.filter((a) => a.id !== id))
      },
    )
    return cleanup
  }, [currentOrg.id])

  const handleResolve = async (approval: Approval, status: 'APPROVED' | 'REJECTED') => {
    setResolvingId(approval.id)
    setActionError(null)
    try {
      const updated = await resolveApproval(approval.id, status, 'admin@aegis.os')
      setApprovals((prev) => prev.map((a) => (a.id === approval.id ? updated : a)))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : `Failed to ${status.toLowerCase()} approval.`,
      )
    } finally {
      setResolvingId(null)
    }
  }

  const filtered = filter === 'PENDING'
    ? approvals.filter((a) => a.status === 'PENDING')
    : approvals

  return (
    <div>
      <PageHeader
        title="HITL Approvals"
        description={`Review and resolve actions requiring human-in-the-loop oversight for ${currentOrg.name}.`}
        actions={
          <button className="btn-secondary" onClick={loadApprovals}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        {(['PENDING', 'ALL'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'PENDING' ? 'Pending' : 'All'}
            {f === 'PENDING' && approvals.filter((a) => a.status === 'PENDING').length > 0 && (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">
                {approvals.filter((a) => a.status === 'PENDING').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && !loading ? (
        <div className="card flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Could not load approvals</p>
              <p className="mt-0.5 text-sm text-slate-500">{error}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={loadApprovals}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {loading && (
            <div className="card flex items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading approvals...</span>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="card flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-900">
                {filter === 'PENDING' ? 'No pending approvals' : 'No approvals yet'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {filter === 'PENDING'
                  ? 'All caught up. New intercepted actions will appear here in real time.'
                  : 'Approval tickets will appear here as agents request them.'}
              </p>
            </div>
          )}

          {!loading &&
            filtered.map((approval) => {
              const risk = actionTypeRisk[approval.action_type] ?? 'medium'
              const isPending = approval.status === 'PENDING'
              return (
                <div key={approval.id} className="card p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-slate-400">
                          {approval.id.slice(0, 8)}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${riskStyles[risk]}`}
                        >
                          {risk} risk
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyles[approval.status]}`}
                        >
                          {approval.status}
                        </span>
                      </div>
                      <p className="mt-2 text-base font-semibold text-slate-900">
                        {approval.action_type}
                        {approval.action_value != null && (
                          <span className="ml-2 font-mono text-sm text-slate-500">
                            value={approval.action_value}
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Agent{' '}
                        <span className="font-medium text-slate-700">{approval.agent_name}</span>{' '}
                        ({approval.agent_id}) · requested by {approval.requested_by} ·{' '}
                        {formatRelativeTime(approval.created_at)}
                      </p>
                      {approval.resolved_by && approval.resolved_at && (
                        <p className="mt-1 text-xs text-slate-400">
                          Resolved by {approval.resolved_by} ·{' '}
                          {formatRelativeTime(approval.resolved_at)}
                        </p>
                      )}
                    </div>

                    {isPending ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleResolve(approval, 'APPROVED')}
                          disabled={resolvingId === approval.id}
                          className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resolvingId === approval.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResolve(approval, 'REJECTED')}
                          disabled={resolvingId === approval.id}
                          className="btn-secondary text-rose-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {resolvingId === approval.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <X className="h-4 w-4" />
                          )}
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span
                        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold ${statusStyles[approval.status]}`}
                      >
                        {approval.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
