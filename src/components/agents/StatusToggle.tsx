import { useState } from 'react'
import { Pause, Play, Snowflake } from 'lucide-react'
import type { AgentStatus } from '@/types/agent'
import { updateAgentStatus } from '@/lib/agents'

interface StatusToggleProps {
  agentId: string
  status: AgentStatus
  hasBreach?: boolean
  onStatusChange: (agentId: string, status: AgentStatus) => void
  onError: (message: string) => void
}

export function StatusToggle({
  agentId,
  status,
  hasBreach = false,
  onStatusChange,
  onError,
}: StatusToggleProps) {
  const [pending, setPending] = useState(false)

  const isActive = status === 'ACTIVE'
  const nextStatus: AgentStatus = isActive ? 'PAUSED' : 'ACTIVE'

  const showFreeze = isActive && hasBreach

  const handleToggle = async () => {
    if (pending) return

    if (isActive) {
      const confirmed = window.confirm(
        showFreeze
          ? 'FREEZE this agent? It has triggered a policy breach. This will immediately stop it from processing new requests.'
          : 'Pause this agent? This acts as a global kill-switch and will stop it from processing new requests.',
      )
      if (!confirmed) return
    }

    setPending(true)
    onStatusChange(agentId, nextStatus)

    try {
      await updateAgentStatus(agentId, nextStatus)
    } catch (err) {
      onStatusChange(agentId, status)
      onError(
        err instanceof Error
          ? `Failed to ${nextStatus.toLowerCase()} agent: ${err.message}`
          : `Failed to ${nextStatus.toLowerCase()} agent.`,
      )
    } finally {
      setPending(false)
    }
  }

  const label = showFreeze ? 'Freeze' : isActive ? 'Pause' : 'Resume'

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      title={`${label} agent${hasBreach ? ' · policy breach detected' : ''}`}
      aria-pressed={isActive}
      aria-label={`${label} agent`}
      className={`relative inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${
        showFreeze
          ? 'bg-rose-600 text-white ring-1 ring-rose-700 hover:bg-rose-700 focus:ring-rose-500 shadow-sm'
          : isActive
            ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 hover:bg-amber-100 focus:ring-amber-400'
            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 focus:ring-emerald-400'
      }`}
    >
      {showFreeze && (
        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
      )}
      {showFreeze ? (
        <Snowflake className="h-3.5 w-3.5" />
      ) : isActive ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      {pending ? '...' : label}
    </button>
  )
}
