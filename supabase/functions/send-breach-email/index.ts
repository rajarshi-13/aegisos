// Aegis OS — Breach Notification Edge Function
// Triggered by a database webhook on audit_logs INSERT.
// When a policy breach (INTERCEPT / BLOCK / DENIED) is detected,
// Gemini composes a clear email and Resend delivers it to the agent owner.

interface WebhookPayload {
  type: string
  table: string
  record: {
    id: string
    org_id: string
    agent_id: string | null
    actor: string
    action: string
    target: string
    outcome: string
    metadata: Record<string, unknown> | null
    created_at: string
  }
}

interface AgentRow {
  id: string
  org_id: string
  name: string
  agent_id: string
  risk_tier: string
  owner: string
  status: string
}

const BREACH_OUTCOMES = new Set(['INTERCEPT', 'BLOCK', 'DENIED'])

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 })
    }

    const payload = (await req.json()) as WebhookPayload
    const record = payload?.record

    if (!record) {
      return new Response('No record in payload', { status: 400 })
    }

    if (!BREACH_OUTCOMES.has(record.outcome)) {
      return new Response('Not a breach outcome, skipping', { status: 200 })
    }

    if (!record.agent_id) {
      return new Response('No agent_id on breach record, skipping', { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    const resendKey = Deno.env.get('RESEND_API_KEY')
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'noreply@aegis.os'

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response('Missing Supabase credentials', { status: 500 })
    }
    if (!geminiKey) {
      return new Response('Missing GEMINI_API_KEY', { status: 500 })
    }
    if (!resendKey) {
      return new Response('Missing RESEND_API_KEY', { status: 500 })
    }

    const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)

    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('id, org_id, name, agent_id, risk_tier, owner, status')
      .eq('agent_id', record.agent_id)
      .eq('org_id', record.org_id)
      .limit(1)
      .single<AgentRow>()

    if (agentErr || !agent) {
      console.error('Agent lookup failed', agentErr)
      return new Response('Agent not found', { status: 404 })
    }

    const ownerEmail = agent.owner
    if (!ownerEmail || !ownerEmail.includes('@')) {
      return new Response('Agent has no valid owner email', { status: 200 })
    }

    const { subject, body } = await composeEmailWithGemini({
      agentName: agent.name,
      agentId: agent.agent_id,
      riskTier: agent.risk_tier,
      ownerEmail,
      outcome: record.outcome,
      action: record.action,
      target: record.target,
      actor: record.actor,
      metadata: record.metadata,
      geminiKey,
    })

    const { error: sendErr } = await sendWithResend({
      resendKey,
      fromEmail,
      to: ownerEmail,
      subject,
      html: body,
    })

    if (sendErr) {
      console.error('Resend send failed', sendErr)
      return new Response(`Failed to send email: ${sendErr.message}`, { status: 500 })
    }

    console.log(`Breach email sent to ${ownerEmail} for agent ${agent.agent_id}`)
    return new Response(JSON.stringify({ ok: true, sentTo: ownerEmail }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Unhandled error in send-breach-email', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
})

function createSupabaseClient(url: string, key: string) {
  return {
    from(table: string) {
      return {
        select(columns: string) {
          let query = `${url}/rest/v1/${table}?select=${encodeURIComponent(columns)}`
          let filterCount = 0
          return {
            eq(column: string, value: string) {
              query += `&${column}=eq.${encodeURIComponent(value)}`
              return this
            },
            limit(n: number) {
              query += `&limit=${n}`
              return this
            },
            async single<T>(): Promise<{ data: T | null; error: { message: string } | null }> {
              const res = await fetch(query, {
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${key}`,
                  Accept: 'application/json',
                  Prefer: 'return=representation',
                },
              })
              if (!res.ok) {
                const text = await res.text()
                return { data: null, error: { message: `HTTP ${res.status}: ${text}` } }
              }
              const arr = (await res.json()) as T[]
              return { data: arr[0] ?? null, error: null }
            },
          }
        },
      }
    },
  }
}

async function composeEmailWithGemini(input: {
  agentName: string
  agentId: string
  riskTier: string
  ownerEmail: string
  outcome: string
  action: string
  target: string
  actor: string
  metadata: Record<string, unknown> | null
  geminiKey: string
}): Promise<{ subject: string; body: string }> {
  const prompt = `You are an AI governance assistant. A policy breach was intercepted for an AI agent. Write a concise, professional email notification to the agent's owner.

Details:
- Agent name: ${input.agentName}
- Agent ID: ${input.agentId}
- Risk tier: ${input.riskTier}
- Breach outcome: ${input.outcome}
- Action attempted: ${input.action}
- Target: ${input.target}
- Actor: ${input.actor}
- Timestamp: ${new Date().toISOString()}
- Metadata: ${input.metadata ? JSON.stringify(input.metadata) : 'none'}

Write the email as HTML (no markdown). Include:
1. A clear subject line
2. A one-line summary of what happened
3. What action was blocked/intercepted and why it matters
4. A recommendation to review the agent in the Aegis OS dashboard and consider freezing it
5. A note that the agent's access can be resumed after review

Respond ONLY with a JSON object: {"subject": "...", "body": "<html>...</html>"}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${input.geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        }),
      },
    )

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Gemini API error ${res.status}: ${text}`)
    }

    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = JSON.parse(text)
    return { subject: parsed.subject, body: parsed.body }
  } catch (err) {
    console.warn('Gemini composition failed, falling back to template', err)
    return fallbackEmail(input)
  }
}

function fallbackEmail(input: {
  agentName: string
  agentId: string
  riskTier: string
  outcome: string
  action: string
  target: string
  actor: string
}): { subject: string; body: string } {
  const subject = `Aegis OS: Policy breach for agent "${input.agentName}"`
  const body = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #dc2626;">Policy Breach Detected</h2>
  <p>A policy breach has been intercepted for one of your AI agents.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Agent</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${input.agentName} (${input.agentId})</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Risk tier</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${input.riskTier}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Outcome</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee; color: #dc2626;">${input.outcome}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Action</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${input.action}</td></tr>
    <tr><td style="padding: 6px; border-bottom: 1px solid #eee;"><strong>Target</strong></td><td style="padding: 6px; border-bottom: 1px solid #eee;">${input.target}</td></tr>
    <tr><td style="padding: 6px;"><strong>Actor</strong></td><td style="padding: 6px;">${input.actor}</td></tr>
  </table>
  <p>Please review this agent in the Aegis OS dashboard. If the activity is unexpected, consider <strong>freezing</strong> the agent immediately to prevent further policy violations.</p>
  <p style="color: #666; font-size: 12px;">This is an automated notification from Aegis OS.</p>
</div>`
  return { subject, body }
}

async function sendWithResend(input: {
  resendKey: string
  fromEmail: string
  to: string
  subject: string
  html: string
}): Promise<{ error: { message: string } | null }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: input.fromEmail,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return { error: { message: `Resend HTTP ${res.status}: ${text}` } }
    }
    return { error: null }
  } catch (err) {
    return { error: { message: err instanceof Error ? err.message : String(err) } }
  }
}
