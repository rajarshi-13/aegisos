import type { RiskTier } from '@/types/agent'

export type GovernanceVerdict = 'ALLOW' | 'INTERCEPT' | 'BLOCK'

export interface GovernanceCheckInput {
  agentId: string
  agentName: string
  actionType: string
  value: number | null
  riskTier: RiskTier
  orgId: string
}

export interface GovernanceCheckResult {
  verdict: GovernanceVerdict
  reason?: string
  confidence?: number
  raw: unknown
}

export async function runGovernanceCheck(
  input: GovernanceCheckInput,
): Promise<GovernanceCheckResult> {
  const webhookUrl = import.meta.env.VITE_N8N_GOVERNANCE_WEBHOOK_URL

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent_id: input.agentId,
      action_type: input.actionType,
      value_amount: Number(input.value),
    }),
  })

  let data: unknown = null
  const text = await response.text()
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }

  if (!response.ok) {
    return {
      verdict: 'BLOCK',
      reason: `Webhook returned HTTP ${response.status}`,
      raw: data,
    }
  }

  const verdict = extractVerdict(data)
  return {
    verdict,
    reason: extractReason(data),
    confidence: extractConfidence(data),
    raw: data,
  }
}

function extractVerdict(data: unknown): GovernanceVerdict {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const candidate = obj.verdict ?? obj.outcome ?? obj.result ?? obj.status
    if (typeof candidate === 'string') {
      const upper = candidate.toUpperCase()
      if (upper === 'ALLOW' || upper === 'INTERCEPT' || upper === 'BLOCK') {
        return upper
      }
    }
    if (typeof obj.allowed === 'boolean') return obj.allowed ? 'ALLOW' : 'BLOCK'
    if (typeof obj.approved === 'boolean') return obj.approved ? 'ALLOW' : 'BLOCK'
  }
  if (typeof data === 'string') {
    const upper = data.toUpperCase()
    if (upper.includes('BLOCK')) return 'BLOCK'
    if (upper.includes('INTERCEPT')) return 'INTERCEPT'
    if (upper.includes('ALLOW')) return 'ALLOW'
  }
  return 'BLOCK'
}

function extractReason(data: unknown): string | undefined {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const candidate = obj.reason ?? obj.message ?? obj.explanation
    if (typeof candidate === 'string') return candidate
  }
  return undefined
}

function extractConfidence(data: unknown): number | undefined {
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const candidate = obj.confidence ?? obj.score
    if (typeof candidate === 'number') return candidate
  }
  return undefined
}
