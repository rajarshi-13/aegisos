import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertCircle, Loader2, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useOrganization } from '@/context/OrganizationContext'
import { listAuditLogsByOrg, subscribeToAuditLogs } from '@/lib/audit'
import { formatTimestamp } from '@/lib/format'
import type { AuditLog, AuditOutcome } from '@/types/audit'

const outcomeStyles: Record<AuditOutcome, string> = {
  ALLOW: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  INTERCEPT: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  BLOCK: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  SUCCESS: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  DENIED: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
  REVIEW: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

export function AuditTrail() {
  const { currentOrg } = useOrganization()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newCount, setNewCount] = useState(0)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAuditLogsByOrg(currentOrg.id, 200)
      setLogs(data)
      setNewCount(0)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to load audit trail: ${err.message}`
          : 'Unable to load audit trail. Check your Supabase configuration.',
      )
    } finally {
      setLoading(false)
    }
  }, [currentOrg.id])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  useEffect(() => {
    const cleanup = subscribeToAuditLogs(currentOrg.id, (newLog) => {
      setLogs((prev) => {
        if (prev.some((l) => l.id === newLog.id)) return prev
        return [newLog, ...prev]
      })
      setNewCount((c) => c + 1)
    })
    return cleanup
  }, [currentOrg.id])

  return (
    <div>
      <PageHeader
        title="Audit Trail"
        description={`Forensic log of all agent actions and governance verdicts for ${currentOrg.name}. Updates in real time.`}
        actions={
          <div className="flex items-center gap-2">
            {newCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-medium text-brand-700">
                <Activity className="h-3 w-3" />
                {newCount} new
              </span>
            )}
            <button className="btn-secondary" onClick={loadLogs}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        }
      />

      {error && !loading ? (
        <div className="card flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Could not load audit trail</p>
              <p className="mt-0.5 text-sm text-slate-500">{error}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={loadLogs}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Timestamp</th>
                  <th className="px-6 py-3 font-semibold">Actor</th>
                  <th className="px-6 py-3 font-semibold">Action</th>
                  <th className="px-6 py-3 font-semibold">Target</th>
                  <th className="px-6 py-3 font-semibold">Outcome</th>
                  <th className="px-6 py-3 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading audit events...
                      </span>
                    </td>
                  </tr>
                )}

                {!loading && logs.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Activity className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-900">No audit events yet</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Governance verdicts and agent actions will stream in here automatically.
                      </p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="whitespace-nowrap px-6 py-4 font-mono text-xs text-slate-500">
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-6 py-4 text-slate-700">{log.actor}</td>
                      <td className="px-6 py-4 font-mono text-xs text-slate-800">{log.action}</td>
                      <td className="px-6 py-4 text-slate-600">{log.target}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${outcomeStyles[log.outcome]}`}
                        >
                          {log.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {log.metadata && Object.keys(log.metadata).length > 0 ? (
                          <details>
                            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                              View
                            </summary>
                            <pre className="mt-1 max-h-32 overflow-auto rounded bg-slate-100 p-2 text-[11px] text-slate-700">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
