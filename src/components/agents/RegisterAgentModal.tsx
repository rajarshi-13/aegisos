import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { AGENT_ROLES, type Agent, type AgentInsert, type RiskTier } from '@/types/agent'
import { N8N_GOVERNANCE_WEBHOOK_URL } from '@/lib/constants'

interface RegisterAgentModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (agent: Omit<AgentInsert, 'org_id'>) => Promise<Agent>
}

const riskTiers: RiskTier[] = ['low', 'medium', 'high']

const riskTierStyles: Record<RiskTier, string> = {
  low: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  medium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  high: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
}

export function RegisterAgentModal({ open, onClose, onSubmit }: RegisterAgentModalProps) {
  const [name, setName] = useState('')
  const [agentId, setAgentId] = useState('')
  const [role, setRole] = useState<string>(AGENT_ROLES[0])
  const [riskTier, setRiskTier] = useState<RiskTier>('medium')
  const [owner, setOwner] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setAgentId('')
      setRole(AGENT_ROLES[0])
      setRiskTier('medium')
      setOwner('')
      setError(null)
      setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !agentId.trim() || !owner.trim()) {
      setError('Name, Agent ID, and Owner are required.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        agent_id: agentId.trim(),
        role: role.trim(),
        risk_tier: riskTier,
        owner: owner.trim(),
        webhook_url: N8N_GOVERNANCE_WEBHOOK_URL,
        status: 'ACTIVE',
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to register agent.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-agent-title"
        className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 id="register-agent-title" className="text-lg font-semibold text-slate-900">
            Register Agent
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Contract Reviewer"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Agent ID <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              placeholder="e.g. contract-reviewer"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Unique identifier used by the governance webhook.
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {AGENT_ROLES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Risk Tier
            </label>
            <div className="flex gap-2">
              {riskTiers.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setRiskTier(tier)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium capitalize transition-all ${
                    riskTier === tier
                      ? riskTierStyles[tier]
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Owner <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="e.g. legal@alpha.io"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>

          <div className="rounded-lg bg-slate-50 px-3 py-2.5">
            <p className="text-xs font-medium text-slate-500">Governance Webhook</p>
            <p className="mt-0.5 break-all font-mono text-xs text-slate-700">
              {N8N_GOVERNANCE_WEBHOOK_URL}
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Registering...' : 'Register Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
