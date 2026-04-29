// ============================================================
// Atlantir — Foundation Layer Types
// Strict mode; no `any` unless explicitly noted.
// All exports are named exports.
// ============================================================

// ─── Scalars / Enums ────────────────────────────────────────

export type AgentType =
  | 'orchestrator'
  | 'research'
  | 'writer'
  | 'analyst'
  | 'executor'
  | 'decision'
  | 'memory'

export type TaskStatus =
  | 'pending_approval'
  | 'approved'
  | 'in_progress'
  | 'awaiting_human'
  | 'needs_clarification'
  | 'completed'
  | 'rejected'

export type ArtifactState = 'draft' | 'reviewed' | 'approved' | 'executed'

export type ApprovalState = 'pending' | 'approved' | 'rejected'

export type RiskLevel = 'safe' | 'dangerous'

// ─── Workspace ──────────────────────────────────────────────

export interface Workspace {
  id: string
  name: string
  created_at: string
  owner_id: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
}

// ─── Employee & Skill ────────────────────────────────────────

export interface Employee {
  id: string
  workspace_id: string
  name: string
  avatar_url?: string
  system_prompt?: string
  skill_ids: string[]
  created_at: string
}

export interface Skill {
  id: string
  workspace_id: string
  name: string
  description?: string
  prompt_guidance?: string
  created_at: string
}

// ─── Task ────────────────────────────────────────────────────

export interface Task {
  id: string
  workspace_id: string
  title: string
  description?: string
  status: TaskStatus
  assigned_agent?: AgentType
  /** ID of the AI employee assigned to this task */
  employee_id?: string
  priority?: 'low' | 'medium' | 'high' | 'urgent'
  meeting_id?: string
  created_at: string
}

// ─── Message ─────────────────────────────────────────────────

export interface Message {
  id: string
  workspace_id: string
  task_id?: string
  meeting_id?: string
  sender_id?: string
  sender_type: 'human' | 'agent'
  agent_type?: AgentType
  /** Which employee (AI persona) produced this message */
  employee_id?: string
  content: string
  /** 1536-dim vector from text-embedding-3-small; present after embedding pass */
  embedding?: number[]
  created_at: string
}

// ─── Meeting & Transcript ────────────────────────────────────

export interface TranscriptSegment {
  speaker_id: string
  speaker_name: string
  text: string
  timestamp_ms: number
  /** 1536-dim semantic embedding for this segment */
  embedding?: number[]
}

export interface Meeting {
  id: string
  workspace_id: string
  title: string
  transcript?: string
  transcript_segments: TranscriptSegment[]
  status: 'recording' | 'processing' | 'done'
  /** Vexa/recall.ai bot ID */
  bot_id?: string
  /** Vexa platform meeting identifier */
  vexa_meeting_id?: string
  created_at: string
}

// ─── Memory File ─────────────────────────────────────────────

export interface MemoryFile {
  id: string
  workspace_id: string
  /** null = workspace-shared file */
  employee_id: string | null
  path: string
  content: string
  updated_at: string
  /** Format: 'agent:<id>' | 'user:<id>' */
  updated_by: string
  version: number
}

// ─── Artifacts (discriminated union per §14.6) ───────────────

interface ArtifactBase {
  id: string
  workspace_id: string
  task_id?: string
  employee_id?: string
  title: string
  state: ArtifactState
  version: number
  /** Reference to previous version */
  parent_id?: string
  /** Format: 'agent:<id>' | 'user:<id>' */
  created_by: string
  updated_at: string
}

export interface DocumentArtifact extends ArtifactBase {
  type: 'document'
  content: {
    body: string
    format: 'markdown' | 'html' | 'plain'
    word_count?: number
  }
  renderer: 'markdown' | 'html'
}

export interface EmailArtifact extends ArtifactBase {
  type: 'email'
  content: {
    subject: string
    body: string
    to?: string[]
    cc?: string[]
    bcc?: string[]
    html?: string
  }
  renderer: 'email'
}

export interface VideoArtifact extends ArtifactBase {
  type: 'video'
  content: {
    url: string
    thumbnail_url?: string
    duration_seconds?: number
    transcript?: string
  }
  renderer: 'video'
}

export interface ChartArtifact extends ArtifactBase {
  type: 'chart'
  content: {
    chart_type: 'bar' | 'line' | 'pie' | 'scatter' | 'table'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>[] // chart data is schema-free by design
    options?: Record<string, unknown>
    title?: string
  }
  renderer: 'chart'
}

export interface CodeArtifact extends ArtifactBase {
  type: 'code'
  content: {
    language: string
    code: string
    filename?: string
    explanation?: string
  }
  renderer: 'code'
}

export interface SlidesArtifact extends ArtifactBase {
  type: 'slides'
  content: {
    slides: Array<{
      title: string
      body: string
      notes?: string
      image_url?: string
    }>
    theme?: string
  }
  renderer: 'slides'
}

export type Artifact =
  | DocumentArtifact
  | EmailArtifact
  | VideoArtifact
  | ChartArtifact
  | CodeArtifact
  | SlidesArtifact

// ─── Approval Request ────────────────────────────────────────

export interface ApprovalRequest {
  id: string
  task_id: string
  workspace_id: string
  action_name: string
  /** JSONB payload — intentionally open, validated at runtime */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action_params: Record<string, any>
  risk_level: RiskLevel
  state: ApprovalState
  approval_token_id: string
  reviewed_by?: string
  reviewed_at?: string
  created_at: string
}

// ─── Agent Run ───────────────────────────────────────────────

export interface AgentRun {
  id: string
  task_id: string
  agent_type: AgentType
  /** Which employee (AI persona) executed this run */
  employee_id?: string
  status: 'running' | 'completed' | 'failed'
  input?: string
  output?: string
  tool_calls?: unknown[]
  /** Langfuse trace ID for observability */
  langfuse_trace_id?: string
  started_at?: string
  ended_at?: string
}

// ─── Workflow Run ────────────────────────────────────────────

export interface WorkflowRun {
  id: string
  task_id: string
  workspace_id: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  ended_at?: string
  error?: string
}

// ─── Pipeline / Task Updates (preserved) ────────────────────

export interface PipelineStep {
  id: string
  task_id: string
  workspace_id: string
  step_index: number
  agent_type: AgentType
  pet_name: string
  status: 'waiting' | 'running' | 'completed' | 'failed'
  output?: string
  started_at?: string
  completed_at?: string
}

export interface TaskUpdate {
  id: string
  task_id: string
  workspace_id: string
  agent_type: AgentType
  pet_name: string
  update_type: 'started' | 'progress' | 'error'
  content: string
  created_at: string
}

// ─── Legacy (kept for backward compat) ──────────────────────

export interface OrchestratorResult {
  summary: string
  tasks: Array<{
    title: string
    description: string
    assigned_agent: AgentType
    priority: Task['priority']
  }>
}

// ─── Constants ───────────────────────────────────────────────

/**
 * Actions that always require an ApprovalRequest before execution.
 * Layer 2 agents must check this list before invoking any tool.
 */
export const DANGEROUS_ACTIONS: string[] = [
  'send_email',
  'send_slack_message',
  'post_to_social',
  'create_calendar_event',
  'delete_record',
  'update_crm_contact',
  'create_invoice',
  'submit_form',
  'publish_content',
  'execute_sql',
  'call_webhook',
  'transfer_funds',
  'update_dns',
  'deploy_code',
  'modify_permissions',
]
