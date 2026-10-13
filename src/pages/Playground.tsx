import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Play,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
} from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { useOrganization } from '@/context/OrganizationContext'
import { listAgentsByOrg } from '@/lib/agents'
import { N8N_GOVERNANCE_WEBHOOK_URL, GOVERNANCE_ACTION_TYPES } from '@/lib/constants'
import { runGovernanceCheck, type GovernanceCheckResult, type GovernanceVerdict } from '@/lib/governance'
import type { Agent } from '@/types/agent'

const verdictStyles: Record<GovernanceVerdict, { badge: string; icon: typeof ShieldCheck; label: string }> = {
  ALLOW: {
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    icon: ShieldCheck,
    label: 'ALLOW',
  },
  INTERCEPT: {
    badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    icon: ShieldAlert,
    label: 'INTERCEPT',
  },
  BLOCK: {
    badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
    icon: ShieldX,
    label: 'BLOCK',
  },
}

function buildPythonSnippet(agentId: string, actionType: string, value: number | null): string {
  return `import requests
from langchain.tools import tool

N8N_WEBHOOK_URL = "${N8N_GOVERNANCE_WEBHOOK_URL}"


@tool
def governance_check(action_type: str, value_amount: float | None = None) -> dict:
    """Run an action through the Aegis OS governance webhook.

    Returns a dict with verdict (ALLOW / INTERCEPT / BLOCK),
    reason, and confidence.
    """
    payload = {
        "agent_id": "${agentId}",
        "action_type": action_type,
        "value_amount": value_amount,
    }
    response = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=10)
    response.raise_for_status()
    return response.json()


# Example usage inside a LangChain agent:
result = governance_check.invoke({
    "action_type": "${actionType}",
    "value_amount": ${value ?? 'None'},
})

if result["verdict"] == "ALLOW":
    execute_action("${actionType}", ${value ?? 'None'})
elif result["verdict"] == "INTERCEPT":
    raise_for_human_review(result["reason"])
else:
    log_blocked_action(result["reason"])
`
}

export function Playground() {
  const { currentOrg } = useOrganization()
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [agentsError, setAgentsError] = useState<string | null>(null)

  const [selectedAgentId, setSelectedAgentId] = useState<string>('')
  const [actionType, setActionType] = useState<string>('REFUND')
  const [value, setValue] = useState<string>('100')

  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<GovernanceCheckResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  const [copiedSnippet, setCopiedSnippet] = useState(false)

  useEffect(() => {
    let cancelled = false
    setAgentsLoading(true)
    setAgentsError(null)
    listAgentsByOrg(currentOrg.id)
      .then((data) => {
        if (cancelled) return
        setAgents(data)
        setSelectedAgentId(data[0]?.agent_id ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setAgentsError(err instanceof Error ? err.message : 'Failed to load agents')
      })
      .finally(() => {
        if (!cancelled) setAgentsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentOrg.id])

  const selectedAgent = useMemo(
    () => agents.find((a) => a.agent_id === selectedAgentId),
    [agents, selectedAgentId],
  )

  const numericValue = useMemo(() => {
    const parsed = parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }, [value])

  const pythonSnippet = useMemo(
    () => buildPythonSnippet(selectedAgentId || 'your-agent-id', actionType, numericValue),
    [selectedAgentId, actionType, numericValue],
  )

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(pythonSnippet)
      setCopiedSnippet(true)
      setTimeout(() => setCopiedSnippet(false), 1500)
    } catch {
      // ignore
    }
  }

  const handleRun = async () => {
    if (!selectedAgent) {
      setRunError('Please select an agent first.')
      return
    }
    setRunning(true)
    setRunError(null)
    setResult(null)
    try {
      const res = await runGovernanceCheck({
        agentId: selectedAgent.agent_id,
        agentName: selectedAgent.name,
        actionType,
        value: numericValue,
        riskTier: selectedAgent.risk_tier,
        orgId: currentOrg.id,
      })
      setResult(res)
    } catch (err) {
      setRunError(
        err instanceof Error
          ? `Governance check failed: ${err.message}`
          : 'Governance check failed. Is the n8n webhook reachable?',
      )
    } finally {
      setRunning(false)
    }
  }

  const verdict = result ? verdictStyles[result.verdict] : null

  return (
    <div>
      <PageHeader
        title="Playground"
        description="Test agent actions against the live governance webhook and inspect the verdict."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Input panel */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-slate-900">Governance Check Input</h2>
          <p className="mt-1 text-sm text-slate-500">
            Simulate an agent action and route it through the n8n governance webhook.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Agent
              </label>
              {agentsError ? (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
                  {agentsError}
                </p>
              ) : agentsLoading ? (
                <div className="flex h-[38px] items-center rounded-lg border border-slate-200 px-3 text-sm text-slate-400">
                  Loading agents...
                </div>
              ) : agents.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
                  No agents registered for {currentOrg.name}. Register one in the Agent Registry.
                </p>
              ) : (
                <select
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.agent_id}>
                      {agent.name} ({agent.agent_id}) · {agent.role || 'Other'} · {agent.risk_tier}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Action Type
              </label>
              <div className="flex flex-wrap gap-2">
                {GOVERNANCE_ACTION_TYPES.map((action) => (
                  <button
                    key={action}
                    type="button"
                    onClick={() => setActionType(action)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                      actionType === action
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {action}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Value Amount
              </label>
              <input
                type="number"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g. 100"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
              <p className="mt-1 text-xs text-slate-400">
                Numeric value associated with the action (e.g. refund amount, record count).
              </p>
            </div>

            <button
              type="button"
              onClick={handleRun}
              disabled={running || !selectedAgent}
              className="btn-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running governance check...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Governance Check
                </>
              )}
            </button>
          </div>
        </div>

        {/* Verdict panel */}
        <div className="card flex flex-col p-6">
          <h2 className="text-base font-semibold text-slate-900">Instant Verdict</h2>
          <p className="mt-1 text-sm text-slate-500">
            The live response from the n8n governance webhook.
          </p>

          <div className="mt-5 flex flex-1 flex-col items-center justify-center">
            {runError ? (
              <div className="flex items-start gap-3 rounded-lg bg-rose-50 px-4 py-3 ring-1 ring-rose-200">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
                <div>
                  <p className="text-sm font-medium text-rose-700">Check failed</p>
                  <p className="mt-0.5 text-sm text-rose-600">{runError}</p>
                </div>
              </div>
            ) : running ? (
              <div className="flex flex-col items-center gap-3 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">Evaluating {actionType} against policy...</p>
              </div>
            ) : verdict ? (
              <div className="w-full text-center">
                <div
                  className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${verdict.badge}`}
                >
                  <verdict.icon className="h-10 w-10" />
                </div>
                <span
                  className={`mt-4 inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold ${verdict.badge}`}
                >
                  {verdict.label}
                </span>
                {result?.reason && (
                  <p className="mt-3 text-sm text-slate-600">{result.reason}</p>
                )}
                {typeof result?.confidence === 'number' && (
                  <p className="mt-1 text-xs text-slate-400">
                    Confidence: {Math.round(result.confidence * 100)}%
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Shield className="h-8 w-8" />
                <p className="text-sm">No verdict yet. Run a check to see the result.</p>
              </div>
            )}
          </div>

          {result && (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700">
                Raw webhook response
              </summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>

      {/* Python LangChain snippet */}
      <div className="card mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Python — LangChain Integration</h2>
            <p className="text-xs text-slate-500">
              Drop this into your LangChain agent to route every action through Aegis OS governance.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={N8N_GOVERNANCE_WEBHOOK_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Webhook
            </a>
            <button
              type="button"
              onClick={handleCopySnippet}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              {copiedSnippet ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <pre className="overflow-x-auto bg-slate-900 p-5 text-xs leading-relaxed text-slate-100">
          <code>{pythonSnippet}</code>
        </pre>
      </div>
    </div>
  )
}
