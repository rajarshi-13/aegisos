import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Copy, ExternalLink, Plus, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { RegisterAgentModal } from '@/components/agents/RegisterAgentModal'
import { StatusToggle } from '@/components/agents/StatusToggle'
import { useOrganization } from '@/context/OrganizationContext'
import { createAgent, getAgentBreaches, listAgentsByOrg, subscribeToAgents, type AgentBreachInfo } from '@/lib/agents'
import { subscribeToAuditLogs } from '@/lib/audit'
import { N8N_GOVERNANCE_WEBHOOK_URL } from '@/lib/constants'
import type { Agent, AgentInsert, AgentStatus, RiskTier } from '@/types/agent'

const statusStyles: Record<AgentStatus, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  PAUSED: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
}

const riskTierStyles: Record<RiskTier, string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  high: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

function useCopy() {
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const copy = useCallback(async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500)
    } catch {
      // ignore clipboard errors
    }
  }, [])

  return { copiedId, copy }
}

export function AgentRegistry() {
  const { currentOrg } = useOrganization()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [breaches, setBreaches] = useState<Record<string, AgentBreachInfo>>({})
  const { copiedId, copy } = useCopy()

  const loadBreaches = useCallback(async (orgId: string) => {
    try {
      const data = await getAgentBreaches(orgId, 60)
      const map: Record<string, AgentBreachInfo> = {}
      for (const b of data) {
        map[b.agentId] = b
      }
      setBreaches(map)
    } catch (err) {
      console.warn('[AgentRegistry] Failed to load breach info', err)
    }
  }, [])

  const loadAgents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAgentsByOrg(currentOrg.id)
      setAgents(data)
      await loadBreaches(currentOrg.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? `Unable to load agents: ${err.message}`
          : 'Unable to load agents. Check your Supabase configuration.',
      )
    } finally {
      setLoading(false)
    }
  }, [currentOrg.id, loadBreaches])

  useEffect(() => {
    loadAgents()
  }, [loadAgents])

  useEffect(() => {
    const cleanupAgents = subscribeToAgents(
      currentOrg.id,
      (inserted) => {
        setAgents((prev) => {
          if (prev.some((a) => a.id === inserted.id)) return prev
          return [inserted, ...prev]
        })
      },
      (updated) => {
        setAgents((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
      },
      (id) => {
        setAgents((prev) => prev.filter((a) => a.id !== id))
      },
    )

    const cleanupAudit = subscribeToAuditLogs(currentOrg.id, () => {
      loadBreaches(currentOrg.id)
    })

    return () => {
      cleanupAgents()
      cleanupAudit()
    }
  }, [currentOrg.id, loadBreaches])

  const handleStatusChange = useCallback((agentId: string, status: AgentStatus) => {
    setAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, status } : a)),
    )
  }, [])

  const handleToggleError = useCallback((message: string) => {
    setToast({ type: 'error', message })
  }, [])

  const handleCreate = useCallback(
    async (input: Omit<AgentInsert, 'org_id'>) => {
      const created = await createAgent({ ...input, org_id: currentOrg.id })
      setAgents((prev) => [created, ...prev])
      setToast({ type: 'success', message: `Agent "${created.name}" registered successfully.` })
      return created
    },
    [currentOrg.id],
  )

  const hasBreach = useCallback(
    (agent: Agent) => Boolean(breaches[agent.agent_id]?.hasBreach),
    [breaches],
  )

  return (
    <div>
      <PageHeader
        title="Agent Registry"
        description={`Register, configure, and govern AI agents for ${currentOrg.name}.`}
        actions={
          <button className="btn-primary" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Register Agent
          </button>
        }
      />

      {toast && (
        <div
          className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm ring-1 ${
            toast.type === 'error'
              ? 'bg-rose-50 text-rose-700 ring-rose-200'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <Check className="h-4 w-4 shrink-0" />
          )}
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current/70 hover:text-current"
            aria-label="Dismiss"
          >
            <AlertCircle className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && !loading && (
        <div className="card flex items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div>
              <p className="text-sm font-medium text-slate-900">Could not load agents</p>
              <p className="mt-0.5 text-sm text-slate-500">{error}</p>
            </div>
          </div>
          <button className="btn-secondary" onClick={loadAgents}>
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      {!error && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold">Agent ID</th>
                  <th className="px-6 py-3 font-semibold">Role</th>
                  <th className="px-6 py-3 font-semibold">Risk Tier</th>
                  <th className="px-6 py-3 font-semibold">Owner</th>
                  <th className="px-6 py-3 font-semibold">Status</th>
                  <th className="px-6 py-3 font-semibold">Governance Webhook</th>
                  <th className="px-6 py-3 font-semibold text-right">Kill-Switch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-400">
                      Loading agents...
                    </td>
                  </tr>
                )}

                {!loading && agents.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center">
                      <p className="text-sm font-medium text-slate-900">No agents registered</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Register your first AI agent to start governing it.
                      </p>
                      <button
                        className="btn-primary mt-4"
                        onClick={() => setModalOpen(true)}
                      >
                        <Plus className="h-4 w-4" />
                        Register Agent
                      </button>
                    </td>
                  </tr>
                )}

                {!loading &&
                  agents.map((agent) => (
                    <tr key={agent.id} className="transition-colors hover:bg-slate-50/60">
                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-900">{agent.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                          {agent.agent_id}
                        </code>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                          {agent.role || 'Other'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${riskTierStyles[agent.risk_tier]}`}
                        >
                          {agent.risk_tier}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{agent.owner}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusStyles[agent.status]}`}
                        >
                          {agent.status === 'ACTIVE' ? '● Active' : '◼ Paused'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="max-w-[220px] truncate font-mono text-xs text-slate-500" title={agent.webhook_url}>
                            {agent.webhook_url || N8N_GOVERNANCE_WEBHOOK_URL}
                          </span>
                          <button
                            type="button"
                            onClick={() => copy(agent.id, agent.webhook_url || N8N_GOVERNANCE_WEBHOOK_URL)}
                            className="text-slate-400 transition-colors hover:text-slate-600"
                            aria-label="Copy webhook URL"
                            title="Copy webhook URL"
                          >
                            {copiedId === agent.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                          <a
                            href={agent.webhook_url || N8N_GOVERNANCE_WEBHOOK_URL}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-400 transition-colors hover:text-brand-600"
                            aria-label="Open webhook"
                            title="Open webhook (POST endpoint)"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end">
                          <StatusToggle
                            agentId={agent.id}
                            status={agent.status}
                            hasBreach={hasBreach(agent)}
                            onStatusChange={handleStatusChange}
                            onError={handleToggleError}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <RegisterAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  )
}
