export const N8N_GOVERNANCE_WEBHOOK_URL =
  import.meta.env.VITE_N8N_GOVERNANCE_WEBHOOK_URL ||
  'https://gromanzo.app.n8n.cloud/webhook/governance-check'

export const GOVERNANCE_ACTION_TYPES = [
  'REFUND',
  'DROP_TABLE',
  'TRANSFER',
  'DELETE_USER',
  'SEND_EMAIL',
  'ACCESS_DATA',
  'MODIFY_CONFIG',
  'DEPLOY_AGENT',
] as const

export type GovernanceActionType = (typeof GOVERNANCE_ACTION_TYPES)[number]
