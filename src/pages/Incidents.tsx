import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useOrganization } from '@/context/OrganizationContext'
import {
  listIncidentsByOrg,
  subscribeToIncidents,
  updateIncidentStatus,
} from '@/lib/incidents'
import { formatRelativeTime, formatTimestamp } from '@/lib/format'
import {
  INCIDENT_SEVERITIES,
  INCIDENT_STATUSES,
  severityStyles,
  statusStyles,
  type Incident,
  type IncidentSeverity,
  type IncidentStatus,
} from '@/types/incident'

type SeverityFilter = IncidentSeverity | 'ALL'

export function Incidents() {
  const { currentOrg } = useOrganization()
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const loadIncidents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listIncidentsByOrg(currentOrg.id)
      setIncidents(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to load incidents: ${err.message}`
          : 'Unable to load incidents. Check your Supabase configuration.',
      )
    } finally {
      setLoading(false)
    }
  }, [currentOrg.id])

  useEffect(() => {
    loadIncidents()
  }, [loadIncidents])

  useEffect(() => {
    const cleanup = subscribeToIncidents(
      currentOrg.id,
      (inserted) => {
        setIncidents((prev) => {
          if (prev.some((i) => i.id === inserted.id)) return prev
          return [inserted, ...prev]
        })
      },
      (updated) => {
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
      },
      (id) => {
        setIncidents((prev) => prev.filter((i) => i.id !== id))
      },
    )
    return cleanup
  }, [currentOrg.id])

  const handleStatusChange = async (incident: Incident, status: IncidentStatus) => {
    if (incident.status === status) return
    setUpdatingId(incident.id)
    setActionError(null)
    try {
      const updated = await updateIncidentStatus(incident.id, status)
      setIncidents((prev) => prev.map((i) => (i.id === incident.id ? updated : i)))
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to update incident status.',
      )
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = severityFilter === 'ALL'
    ? incidents
    : incidents.filter((i) => i.severity === severityFilter)

  const nextStatuses: Record<IncidentStatus, IncidentStatus> = {
    OPEN: 'INVESTIGATING',
    INVESTIGATING: 'RESOLVED',
    RESOLVED: 'OPEN',
  }

  return (
    <div>
      <PageHeader
        title="Incidents"
        description={`Security incidents for ${currentOrg.name}. Updates in real time.`}
        actions={
          <button className="btn-secondary" onClick={loadIncidents}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">Severity:</span>
        {(['ALL', ...INCIDENT_SEVERITIES] as SeverityFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSeverityFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              severityFilter === s
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {s === 'ALL' ? 'All' : s}
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
              <p className="text-sm font-medium text-slate-900">Could not load incidents</p>
              <p className="mt-0.5 text-sm text-slate-500">{error}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={loadIncidents}>
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
                  <th className="w-8 px-4 py-3" />
                  <th className="px-6 py-3 font-semibold">Incident</th>
                  <th className="px-6 py-3 font-semibold">Severity</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Created</th>
                  <th className="px-6 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading incidents...
                      </span>
                    </td>
                  </tr>
                )}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <ShieldAlert className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-sm font-medium text-slate-900">No incidents found</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {severityFilter === 'ALL'
                          ? 'Security incidents will stream in here automatically.'
                          : `No ${severityFilter} severity incidents.`}
                      </p>
                    </td>
                  </tr>
                )}

                {!loading &&
                  filtered.map((incident) => {
                    const isExpanded = expandedId === incident.id
                    const next = nextStatuses[incident.status]
                    return (
                      <Fragment key={incident.id}>
                        <tr
                          className="cursor-pointer transition-colors hover:bg-slate-50/60"
                          onClick={() => setExpandedId(isExpanded ? null : incident.id)}
                        >
                          <td className="px-4 py-4 text-slate-400">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-slate-900">{incident.title}</p>
                            {incident.agent_id && (
                              <p className="mt-0.5 font-mono text-xs text-slate-400">
                                {incident.agent_id}
                              </p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${severityStyles[incident.severity]}`}
                            >
                              {incident.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[incident.status]}`}
                            >
                              {incident.status}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-500">
                            {formatRelativeTime(incident.created_at)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(incident, next)
                              }}
                              disabled={updatingId === incident.id}
                              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updatingId === incident.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : null}
                              Mark {next}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${incident.id}-detail`} className="bg-slate-50/50">
                            <td />
                            <td colSpan={5} className="px-6 py-4">
                              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Description
                                  </p>
                                  <p className="mt-1 text-sm text-slate-700">
                                    {incident.description || 'No description provided.'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Metadata
                                  </p>
                                  {incident.metadata &&
                                  Object.keys(incident.metadata).length > 0 ? (
                                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-white p-2 text-[11px] text-slate-700 ring-1 ring-slate-200">
                                      {JSON.stringify(incident.metadata, null, 2)}
                                    </pre>
                                  ) : (
                                    <p className="mt-1 text-sm text-slate-400">No metadata</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Created
                                  </p>
                                  <p className="mt-1 text-sm text-slate-700">
                                    {formatTimestamp(incident.created_at)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Updated
                                  </p>
                                  <p className="mt-1 text-sm text-slate-700">
                                    {formatTimestamp(incident.updated_at)}
                                  </p>
                                </div>
                                <div className="sm:col-span-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                    Change Status
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {INCIDENT_STATUSES.map((status) => (
                                      <button
                                        key={status}
                                        type="button"
                                        onClick={() => handleStatusChange(incident, status)}
                                        disabled={
                                          incident.status === status ||
                                          updatingId === incident.id
                                        }
                                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                          incident.status === status
                                            ? `${statusStyles[status]} cursor-default`
                                            : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                                        }`}
                                      >
                                        {status}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
