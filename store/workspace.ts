import { create } from 'zustand'
import { supabaseBrowser } from '@/lib/supabase-browser'
import type { Workspace, Task, Message, Meeting, Artifact, AgentType } from '@/types'

interface WorkspaceState {
  currentWorkspace: Workspace | null
  workspaces: Workspace[]
  tasks: Task[]
  messages: Message[]
  meetings: Meeting[]
  artifacts: Artifact[]
  activeTaskId: string | null

  // Computed helpers (functions so they're always fresh)
  pendingTasks: () => Task[]
  activeTasks: () => Task[]
  completedTasks: () => Task[]
  activeTask: () => Task | null
  taskMessages: () => Message[]
  taskArtifacts: () => Artifact[]

  // Actions
  setActiveTaskId: (id: string | null) => void
  setCurrentWorkspace: (ws: Workspace) => void
  loadWorkspaces: () => Promise<void>
  loadTasks: (workspaceId: string) => Promise<void>
  loadMessages: (taskId: string) => Promise<void>
  loadArtifacts: (workspaceId: string) => Promise<void>
  approveTask: (taskId: string, agentType: string, userId?: string) => Promise<Task>
  rejectTask: (taskId: string) => Promise<void>
  deleteTask: (taskId: string) => Promise<void>
  runTask: (taskId: string) => Promise<void>
  sendMessage: (content: string, taskId?: string, meetingId?: string) => Promise<void>
  processMeetingTranscript: (transcript: string, meetingId?: string) => Promise<any>
  subscribeToWorkspace: (workspaceId: string) => () => void
  upsertTask: (task: Task) => void
  removeTask: (taskId: string) => void
  appendMessage: (msg: Message) => void
  prependArtifact: (artifact: Artifact) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  currentWorkspace: null,
  workspaces: [],
  tasks: [],
  messages: [],
  meetings: [],
  artifacts: [],
  activeTaskId: null,

  // ── Computed ──────────────────────────────────────────────────────────────
  pendingTasks: () => get().tasks.filter(t => t.status === 'pending_approval'),
  activeTasks: () => get().tasks.filter(t => ['approved', 'in_progress', 'needs_clarification'].includes(t.status)),
  completedTasks: () => get().tasks.filter(t => t.status === 'completed'),
  activeTask: () => get().tasks.find(t => t.id === get().activeTaskId) ?? null,
  taskMessages: () => get().messages.filter(m => m.task_id === get().activeTaskId),
  taskArtifacts: () => get().artifacts.filter(a => a.task_id === get().activeTaskId),

  // ── Setters ───────────────────────────────────────────────────────────────
  setActiveTaskId: (id) => set({ activeTaskId: id }),
  setCurrentWorkspace: (ws) => set({ currentWorkspace: ws }),

  upsertTask: (task) => set(state => {
    const idx = state.tasks.findIndex(t => t.id === task.id)
    if (idx !== -1) {
      const next = [...state.tasks]
      next[idx] = task
      return { tasks: next }
    }
    return { tasks: [task, ...state.tasks] }
  }),

  removeTask: (taskId) => set(state => ({
    tasks: state.tasks.filter(t => t.id !== taskId),
    activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId,
  })),

  appendMessage: (msg) => set(state => {
    if (state.messages.find(m => m.id === msg.id)) return state
    return { messages: [...state.messages, msg] }
  }),

  prependArtifact: (artifact) => set(state => {
    if (state.artifacts.find(a => a.id === artifact.id)) return state
    return { artifacts: [artifact, ...state.artifacts] }
  }),

  // ── Loaders ───────────────────────────────────────────────────────────────
  loadWorkspaces: async () => {
    const sb = supabaseBrowser()
    const { data } = await sb.from('workspaces').select('*').order('created_at')
    const workspaces = (data as Workspace[]) || []
    set(state => ({
      workspaces,
      currentWorkspace: state.currentWorkspace ?? workspaces[0] ?? null,
    }))
  },

  loadTasks: async (workspaceId) => {
    const sb = supabaseBrowser()
    const { data } = await sb.from('tasks').select('*')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    set({ tasks: (data as Task[]) || [] })
  },

  loadMessages: async (taskId) => {
    const sb = supabaseBrowser()
    const { data } = await sb.from('messages').select('*')
      .eq('task_id', taskId).order('created_at')
    const fresh = (data as Message[]) || []
    set(state => ({
      messages: [
        ...state.messages.filter(m => m.task_id !== taskId),
        ...fresh,
      ],
    }))
  },

  loadArtifacts: async (workspaceId) => {
    const sb = supabaseBrowser()
    const { data } = await sb.from('artifacts').select('*')
      .eq('workspace_id', workspaceId).order('created_at', { ascending: false })
    set({ artifacts: (data as Artifact[]) || [] })
  },

  // ── Actions ───────────────────────────────────────────────────────────────
  approveTask: async (taskId, agentType, userId) => {
    const res = await fetch('/api/tasks/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, assigned_agent: agentType, approved_by: userId }),
    })
    const task: Task = await res.json()
    get().upsertTask(task)
    return task
  },

  rejectTask: async (taskId) => {
    const sb = supabaseBrowser()
    await sb.from('tasks').update({ status: 'cancelled' }).eq('id', taskId)
    set(state => {
      const idx = state.tasks.findIndex(t => t.id === taskId)
      if (idx === -1) return state
      const next = [...state.tasks]
      next[idx] = { ...next[idx], status: 'cancelled' as any }
      return { tasks: next, activeTaskId: state.activeTaskId === taskId ? null : state.activeTaskId }
    })
  },

  deleteTask: async (taskId) => {
    const sb = supabaseBrowser()
    await sb.from('tasks').delete().eq('id', taskId)
    get().removeTask(taskId)
  },

  runTask: async (taskId) => {
    await fetch('/api/agents/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId }),
    })
  },

  sendMessage: async (content, taskId, meetingId) => {
    const wsId = get().currentWorkspace?.id
    if (!wsId) return
    const sb = supabaseBrowser()
    const { data: { user } } = await sb.auth.getUser()
    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_id: wsId,
        task_id: taskId ?? null,
        meeting_id: meetingId ?? null,
        sender_id: user?.id,
        content,
      }),
    })
  },

  processMeetingTranscript: async (transcript, meetingId) => {
    const wsId = get().currentWorkspace?.id
    if (!wsId) return
    const res = await fetch('/api/meetings/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: wsId, meeting_id: meetingId, transcript }),
    })
    const result = await res.json()
    await get().loadTasks(wsId)
    return result
  },

  // Returns an unsubscribe function — call it in useEffect cleanup
  subscribeToWorkspace: (workspaceId) => {
    const sb = supabaseBrowser()
    // Remove any existing channel with this name before creating a new one
    // (prevents "cannot add callbacks after subscribe" on hot-reload / StrictMode)
    const existing = sb.channel(`workspace:${workspaceId}`)
    sb.removeChannel(existing)
    const channel = sb
      .channel(`workspace:${workspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') get().upsertTask(payload.new as Task)
          if (payload.eventType === 'UPDATE') get().upsertTask(payload.new as Task)
          if (payload.eventType === 'DELETE') get().removeTask((payload.old as Task).id)
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => get().appendMessage(payload.new as Message))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'artifacts', filter: `workspace_id=eq.${workspaceId}` },
        (payload) => get().prependArtifact(payload.new as Artifact))
      .subscribe()

    return () => { sb.removeChannel(channel) }
  },
}))
