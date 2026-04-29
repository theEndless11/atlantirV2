'use client'

import { useState } from 'react'
import type { Task } from '@/types'
import TaskStatusBadge from './TaskStatusBadge'

interface Props {
  task: Task
  active: boolean
  onClick: () => void
  onApprove: (agent: string) => void
}

export default function TaskCard({ task, active, onClick, onApprove }: Props) {
  const [selectedAgent, setSelectedAgent] = useState('')

  const priorityColors: Record<string, string> = {
    low: '#6ee7b7', medium: '#fbbf24', high: '#f97316', urgent: '#ef4444'
  }

  return (
    <div
      onClick={onClick}
      style={{
        padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6',
        transition: 'background 0.1s',
        background: active ? '#eff6ff' : undefined,
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = '#f9fafb' }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{task.title}</span>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4,
          background: priorityColors[task.priority] || '#d1d5db',
          display: 'inline-block'
        }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <TaskStatusBadge status={task.status} />
        {task.assigned_agent && (
          <span style={{ fontSize: 11, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>
            {task.assigned_agent}
          </span>
        )}
      </div>

      {task.status === 'pending_approval' && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }} onClick={e => e.stopPropagation()}>
          <select
            value={selectedAgent}
            onChange={e => setSelectedAgent(e.target.value)}
            style={{ flex: 1, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px' }}
          >
            <option value="">Assign agent...</option>
            <option value="research">Research</option>
            <option value="writer">Writer</option>
            <option value="analyst">Analyst</option>
            <option value="executor">Executor</option>
          </select>
          <button
            disabled={!selectedAgent}
            onClick={() => onApprove(selectedAgent)}
            style={{
              fontSize: 12, padding: '4px 10px', background: selectedAgent ? '#2563eb' : '#93c5fd',
              color: 'white', border: 'none', borderRadius: 6, cursor: selectedAgent ? 'pointer' : 'not-allowed'
            }}
          >
            Approve
          </button>
        </div>
      )}
    </div>
  )
}
