-- ============================================================
-- Atlantir Rewrite — Migration 002
-- Cost tracking, observability columns, e2b sandbox table,
-- approval_token_id column, workflow_runs extended schema.
-- Run after 001_rewrite_schema.sql
-- ============================================================

-- ─── Workspace daily cost tracking ───────────────────────────

create table if not exists workspace_cost_daily (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null references workspaces(id) on delete cascade,
  date            date not null,
  tokens_input    bigint not null default 0,
  tokens_output   bigint not null default 0,
  tokens_cached   bigint not null default 0,
  cost_usd        numeric(12, 8) not null default 0,
  updated_at      timestamptz not null default now(),
  unique (workspace_id, date)
);

create index if not exists workspace_cost_daily_ws_date on workspace_cost_daily (workspace_id, date desc);

-- RPC used by updateWorkflowCosts() to atomically increment values
create or replace function increment_workspace_cost(
  p_workspace_id uuid,
  p_date         date,
  p_tokens_input bigint,
  p_tokens_output bigint,
  p_tokens_cached bigint,
  p_cost_usd     numeric
) returns void language plpgsql as $$
begin
  insert into workspace_cost_daily (workspace_id, date, tokens_input, tokens_output, tokens_cached, cost_usd)
  values (p_workspace_id, p_date, p_tokens_input, p_tokens_output, p_tokens_cached, p_cost_usd)
  on conflict (workspace_id, date) do update set
    tokens_input  = workspace_cost_daily.tokens_input  + excluded.tokens_input,
    tokens_output = workspace_cost_daily.tokens_output + excluded.tokens_output,
    tokens_cached = workspace_cost_daily.tokens_cached + excluded.tokens_cached,
    cost_usd      = workspace_cost_daily.cost_usd      + excluded.cost_usd,
    updated_at    = now();
end;
$$;

-- Daily cost cap per workspace (default $10/day — override per workspace in future)
alter table workspaces
  add column if not exists daily_cost_cap_usd numeric(10, 2) default 10.00;

-- ─── Approval requests — add approval_token_id ───────────────

create table if not exists approval_requests (
  id                 uuid primary key default gen_random_uuid(),
  task_id            uuid not null references tasks(id) on delete cascade,
  workspace_id       uuid not null references workspaces(id) on delete cascade,
  action_name        text not null,
  action_params      jsonb not null default '{}',
  risk_level         text not null default 'dangerous' check (risk_level in ('safe', 'dangerous')),
  state              text not null default 'pending' check (state in ('pending', 'approved', 'rejected')),
  approval_token_id  text not null default gen_random_uuid()::text,
  reviewed_by        uuid references auth.users(id),
  reviewed_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index if not exists approval_requests_task_id_idx      on approval_requests (task_id);
create index if not exists approval_requests_workspace_id_idx on approval_requests (workspace_id);
create index if not exists approval_requests_state_idx        on approval_requests (state) where state = 'pending';

-- ─── Workflow runs — extended schema ─────────────────────────

create table if not exists workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  status       text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  error        text,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz
);

create index if not exists workflow_runs_task_id_idx on workflow_runs (task_id);
create index if not exists workflow_runs_workspace_id_idx on workflow_runs (workspace_id);

-- ─── Artifacts ───────────────────────────────────────────────

create table if not exists artifacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id      uuid references tasks(id) on delete set null,
  employee_id  uuid references employees(id) on delete set null,
  title        text not null,
  type         text not null check (type in ('document', 'email', 'chart', 'code', 'slides', 'video')),
  state        text not null default 'draft' check (state in ('draft', 'reviewed', 'approved', 'executed')),
  content      jsonb not null default '{}',
  renderer     text,
  version      int not null default 1,
  parent_id    uuid references artifacts(id) on delete set null,
  created_by   text not null,
  updated_at   timestamptz not null default now()
);

create index if not exists artifacts_workspace_id_idx on artifacts (workspace_id);
create index if not exists artifacts_task_id_idx on artifacts (task_id);

-- ─── Langfuse trace ID on agent_runs ─────────────────────────

alter table agent_runs
  add column if not exists langfuse_trace_id text;

-- ─── Messages: add agent_type column ─────────────────────────

alter table messages
  add column if not exists agent_type text;

-- ─── Tasks: add priority column ──────────────────────────────

alter table tasks
  add column if not exists priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent'));
