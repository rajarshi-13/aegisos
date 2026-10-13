-- Aegis OS — Agent Governance Schema
-- Run this in the Supabase SQL Editor to create the required tables.

-- Cleanup: drop any tables created with wrong names (safe to run)
drop table if exists public.agent_registry cascade;
drop table if exists public.approval_queue cascade;
drop table if exists public.audit_trail cascade;

-- Organizations (multi-tenant)
create table if not exists public.organizations (
  id text primary key,
  name text not null,
  slug text not null unique,
  plan text not null default 'starter' check (plan in ('starter', 'growth', 'enterprise')),
  created_at timestamptz not null default now()
);

-- Agents
create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  name text not null,
  agent_id text not null,
  role text not null default 'Other',
  risk_tier text not null default 'medium' check (risk_tier in ('low', 'medium', 'high')),
  owner text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'PAUSED')),
  webhook_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, agent_id)
);

create index if not exists agents_org_id_idx on public.agents (org_id);
create index if not exists agents_status_idx on public.agents (status);

-- Migration: add role to existing agents tables (safe to re-run)
alter table public.agents add column if not exists role text not null default 'Other';

-- HITL Approval tickets
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  agent_id text not null,
  agent_name text not null,
  action_type text not null,
  action_value numeric,
  requested_by text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approvals_org_id_idx on public.approvals (org_id);
create index if not exists approvals_status_idx on public.approvals (status);

-- Forensic audit log
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  agent_id text,
  actor text not null,
  action text not null,
  target text not null,
  outcome text not null check (outcome in ('ALLOW', 'INTERCEPT', 'BLOCK', 'SUCCESS', 'DENIED', 'REVIEW')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_org_id_idx on public.audit_logs (org_id);
create index if not exists audit_logs_agent_id_idx on public.audit_logs (agent_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);

-- Migration: add agent_id to existing audit_logs tables (safe to re-run)
alter table public.audit_logs add column if not exists agent_id text;
create index if not exists audit_logs_agent_id_idx on public.audit_logs (agent_id);

-- Security Incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references public.organizations(id) on delete cascade,
  agent_id text,
  title text not null,
  description text,
  severity text not null default 'MEDIUM' check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (status in ('OPEN', 'INVESTIGATING', 'RESOLVED')),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists incidents_org_id_idx on public.incidents (org_id);
create index if not exists incidents_severity_idx on public.incidents (severity);
create index if not exists incidents_status_idx on public.incidents (status);
create index if not exists incidents_created_at_idx on public.incidents (created_at desc);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
  before update on public.agents
  for each row
  execute function public.set_updated_at();

drop trigger if exists approvals_set_updated_at on public.approvals;
create trigger approvals_set_updated_at
  before update on public.approvals
  for each row
  execute function public.set_updated_at();

drop trigger if exists incidents_set_updated_at on public.incidents;
create trigger incidents_set_updated_at
  before update on public.incidents
  for each row
  execute function public.set_updated_at();

-- Row Level Security
alter table public.organizations enable row level security;
alter table public.agents enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.incidents enable row level security;

-- NOTE: Replace these policies with auth-aware rules once authentication is wired up.
-- For now, allow all operations so the dashboard can read/write during development.
create policy "orgs allow all" on public.organizations
  for all using (true) with check (true);

create policy "agents allow all" on public.agents
  for all using (true) with check (true);

create policy "approvals allow all" on public.approvals
  for all using (true) with check (true);

create policy "audit_logs allow all" on public.audit_logs
  for all using (true) with check (true);

create policy "incidents allow all" on public.incidents
  for all using (true) with check (true);

-- Enable Realtime for instant UI updates
alter publication supabase_realtime add table public.agents;
alter publication supabase_realtime add table public.approvals;
alter publication supabase_realtime add table public.audit_logs;
alter publication supabase_realtime add table public.incidents;

-- Seed organizations to match the in-app mock tenants
insert into public.organizations (id, name, slug, plan) values
  ('org_alpha', 'Org Alpha', 'alpha', 'enterprise'),
  ('org_beta', 'Org Beta', 'beta', 'growth')
on conflict (id) do nothing;

-- =====================================================================
-- Breach email notification webhook
-- Fires the send-breach-email Edge Function when a policy breach is logged.
-- Requires the Edge Function to be deployed first.
-- =====================================================================

create or replace function public.notify_breach_email()
returns trigger
language plpgsql
as $$
begin
  if new.outcome in ('INTERCEPT', 'BLOCK', 'DENIED') and new.agent_id is not null then
    perform supabase_functions.http_request(
      'https://cnjdjaflgcqsyhjbcnjw.supabase.co/functions/v1/send-breach-email',
      'POST',
      '{"Content-Type": "application/json"}',
      json_build_object(
        'type', 'INSERT',
        'table', 'audit_logs',
        'record', to_jsonb(new)
      )::text,
      '2000'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists audit_logs_breach_email on public.audit_logs;
create trigger audit_logs_breach_email
after insert on public.audit_logs
for each row
execute function public.notify_breach_email();
