-- ============================================================
-- Atlantir Rewrite — Migration 001
-- Foundation schema: employees, skills, memory, artifacts,
-- approvals, workflow runs, cost tracking, semantic search
-- ============================================================

-- Ensure pgvector is available (safe to run multiple times)
create extension if not exists vector;

-- ─── Employees ───────────────────────────────────────────────

create table if not exists employees (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name         text not null,
  avatar_url   text,
  system_prompt text,
  created_at   timestamptz not null default now()
);

create index if not exists employees_workspace_id_idx on employees (workspace_id);

-- ─── Skills ──────────────────────────────────────────────────

create table if not exists skills (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null references workspaces(id) on delete cascade,
  name             text not null,
  description      text,
  prompt_guidance  text,
  created_at       timestamptz not null default now()
);

create index if not exists skills_workspace_id_idx on skills (workspace_id);

-- ─── Employee ↔ Skill Join ────────────────────────────────────

create table if not exists employee_skills (
  employee_id uuid not null references employees(id) on delete cascade,
  skill_id    uuid not null references skills(id)    on delete cascade,
  primary key (employee_id, skill_id)
);

-- ─── Tasks: add employee_id ───────────────────────────────────

alter table tasks
  add column if not exists employee_id uuid references employees(id) on delete set null;

create index if not exists tasks_employee_id_idx on tasks (employee_id);

-- ─── Memory Files ────────────────────────────────────────────

create table if not exists memory_files (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- NULL means workspace-shared file (not tied to a specific employee)
  employee_id  uuid references employees(id) on delete cascade,
  path         text not null,
  content      text not null,
  updated_at   timestamptz not null default now(),
  -- format: 'agent:<id>' or 'user:<id>'
  updated_by   text not null,
  version      int  not null default 1,
  unique (workspace_id, employee_id, path)
);

create index if not exists memory_files_workspace_idx  on memory_files (workspace_id);
create index if not exists memory_files_employee_idx   on memory_files (employee_id);

-- ─── Messages: add employee_id + embedding ───────────────────

alter table messages
  add column if not exists employee_id uuid references employees(id) on delete set null,
  add column if not exists embedding   vector(1536);

create index if not exists messages_employee_id_idx on messages (employee_id);

-- HNSW index for sub-millisecond cosine similarity search
create index if not exists messages_embedding_hnsw
  on messages using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- ─── Artifacts ───────────────────────────────────────────────

create table if not exists artifacts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  task_id      uuid references tasks(id) on delete set null,
  employee_id  uuid references employees(id) on delete set null,
  -- 'document' | 'email' | 'video' | 'chart' | 'code' | 'slides'
  type         text not null,
  title        text,
  content      jsonb not null,
  renderer     text not null,
  -- 'draft' | 'reviewed' | 'approved' | 'executed'
  state        text not null default 'draft',
  version      int  not null default 1,
  parent_id    uuid references artifacts(id) on delete set null,
  -- format: 'agent:<id>' or 'user:<id>'
  created_by   text not null,
  updated_at   timestamptz not null default now()
);

create index if not exists artifacts_workspace_id_idx on artifacts (workspace_id);
create index if not exists artifacts_task_id_idx      on artifacts (task_id);
create index if not exists artifacts_employee_id_idx  on artifacts (employee_id);
create index if not exists artifacts_state_idx        on artifacts (state);

-- ─── Approval Requests ───────────────────────────────────────

create table if not exists approval_requests (
  id                uuid primary key default gen_random_uuid(),
  task_id           uuid not null references tasks(id) on delete cascade,
  workspace_id      uuid not null references workspaces(id) on delete cascade,
  action_name       text not null,
  action_params     jsonb not null,
  -- 'safe' | 'dangerous'
  risk_level        text not null default 'dangerous',
  -- 'pending' | 'approved' | 'rejected'
  state             text not null default 'pending',
  -- opaque token used in approval email links
  approval_token_id uuid not null unique default gen_random_uuid(),
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists approval_requests_task_id_idx      on approval_requests (task_id);
create index if not exists approval_requests_workspace_id_idx on approval_requests (workspace_id);
create index if not exists approval_requests_state_idx        on approval_requests (state);
create index if not exists approval_requests_token_idx        on approval_requests (approval_token_id);

-- ─── Workflow Runs ────────────────────────────────────────────

create table if not exists workflow_runs (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  workspace_id uuid not null references workspaces(id) on delete cascade,
  -- 'running' | 'completed' | 'failed' | 'cancelled'
  status       text not null default 'running',
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  error        text
);

create index if not exists workflow_runs_task_id_idx      on workflow_runs (task_id);
create index if not exists workflow_runs_workspace_id_idx on workflow_runs (workspace_id);
create index if not exists workflow_runs_status_idx       on workflow_runs (status);

-- ─── Workspace Cost Daily ────────────────────────────────────

create table if not exists workspace_cost_daily (
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  date           date not null,
  tokens_input   bigint  not null default 0,
  tokens_output  bigint  not null default 0,
  tokens_cached  bigint  not null default 0,
  cost_usd       numeric(10,4) not null default 0,
  traces         integer not null default 0,
  primary key (workspace_id, date)
);

create index if not exists workspace_cost_daily_date_idx on workspace_cost_daily (date);

-- ─── RPC: Semantic Message Search ────────────────────────────

create or replace function match_messages(
  query_embedding  vector(1536),
  workspace_filter uuid,
  match_threshold  float default 0.72,
  match_count      int   default 5
)
returns table (
  id         uuid,
  content    text,
  role       text,
  created_at timestamptz,
  score      float
)
language sql stable as $$
  select
    m.id,
    m.content,
    m.sender_type as role,
    m.created_at,
    1 - (m.embedding <=> query_embedding) as score
  from messages m
  where m.workspace_id = workspace_filter
    and m.embedding is not null
    and 1 - (m.embedding <=> query_embedding) >= match_threshold
  order by m.embedding <=> query_embedding
  limit match_count;
$$;
