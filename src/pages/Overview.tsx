import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  Bot,
  ClipboardCheck,
  ScrollText,
  ShieldX,
  TrendingUp,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useOrganization } from '@/context/OrganizationContext'
import { listAgentsByOrg } from '@/lib/agents'
import { listApprovalsByOrg } from '@/lib/approvals'
import { listAuditLogsByOrg } from '@/lib/audit'
import { formatRelativeTime } from '@/lib/format'
import type { Agent } from '@/types/agent'
import type { Approval } from '@/types/approval'
import type { AuditLog } from '@/types/audit'

const BREACH_OUTCOMES = new Set(['INTERCEPT', 'BLOCK', 'DENIED'])

export function Overview() {
  const { currentOrg } = useOrganization()

  const [agents, setAgents] = useState<Agent[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      listAgentsByOrg(currentOrg.id),
      listApprovalsByOrg(currentOrg.id),
      listAuditLogsByOrg(currentOrg.id, 100),
    ])
      .then(([a, ap, l]) => {
        if (cancelled) return
        setAgents(a)
        setApprovals(ap)
        setLogs(l)
      })
      .catch((err) => {
        console.warn('[Overview] Failed to load dashboard data', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentOrg.id])

  const activeAgents = agents.filter((a) => a.status === 'ACTIVE').length
  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING').length
  const recentBreaches = logs.filter((l) => BREACH_OUTCOMES.has(l.outcome)).length
  const auditEventCount = logs.length

  const stats = [
    {
      label: 'Active Agents',
      value: activeAgents.toString(),
      delta: `${agents.length} total registered`,
      icon: Bot,
      accent: 'text-brand-600 bg-brand-50',
      trendUp: true,
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals.toString(),
      delta: 'HITL queue',
      icon: ClipboardCheck,
      accent: 'text-amber-600 bg-amber-50',
      trendUp: pendingApprovals > 0,
    },
    {
      label: 'Recent Breaches',
      value: recentBreaches.toString(),
      delta: 'last 100 events',
      icon: ShieldX,
      accent: 'text-rose-600 bg-rose-50',
      trendUp: false,
    },
    {
      label: 'Audit Events',
      value: auditEventCount.toString(),
      delta: 'last 100 events',
      icon: ScrollText,
      accent: 'text-slate-600 bg-slate-100',
      trendUp: true,
    },
  ]

  const recentActivity = logs.slice(0, 5)

  return (
    <div>
      <PageHeader
        title="Overview"
        description={`Governance summary for ${currentOrg.name}.`}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card p-5">
              <div className="flex items-center justify-between">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.accent}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`flex items-center gap-1 text-xs font-medium ${
                    stat.trendUp ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  {stat.delta}
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold text-slate-900">
                {loading ? '—' : stat.value}
              </p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-base font-semibold text-slate-900">Recent Activity</h2>
          <p className="mt-1 text-sm text-slate-500">Latest agent and approval events across your workspace.</p>
          <div className="mt-4 space-y-3">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-400">Loading activity...</p>
            ) : recentActivity.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No recent activity.</p>
            ) : (
              recentActivity.map((log) => {
                const isBreach = BREACH_OUTCOMES.has(log.outcome)
                const tone = isBreach
                  ? 'bg-rose-500'
                  : log.outcome === 'ALLOW' || log.outcome === 'SUCCESS'
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                return (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3"
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${tone}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {log.actor} · {log.action}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {log.target} · {log.outcome}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-400">
                      {formatRelativeTime(log.created_at)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900">Policy Status</h2>
          <p className="mt-1 text-sm text-slate-500">Agent risk distribution across registered agents.</p>
          <div className="mt-4 space-y-4">
            {[
              { label: 'High risk', value: agents.filter((a) => a.risk_tier === 'high').length, total: agents.length },
              { label: 'Medium risk', value: agents.filter((a) => a.risk_tier === 'medium').length, total: agents.length },
              { label: 'Low risk', value: agents.filter((a) => a.risk_tier === 'low').length, total: agents.length },
            ].map((bar) => {
              const pct = bar.total > 0 ? Math.round((bar.value / bar.total) * 100) : 0
              return (
                <div key={bar.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600">{bar.label}</span>
                    <span className="font-medium text-slate-900">
                      {loading ? '—' : `${bar.value} (${pct}%)`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${
                        bar.label === 'High risk'
                          ? 'bg-rose-500'
                          : bar.label === 'Medium risk'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {recentBreaches > 0 && (
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-rose-50 px-3 py-2.5 ring-1 ring-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <p className="text-xs text-rose-700">
                {recentBreaches} policy breach(es) detected. Review the Agent Registry to freeze affected agents.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
