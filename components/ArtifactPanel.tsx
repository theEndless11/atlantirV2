'use client'

import { useState } from 'react'
import type { Artifact, Task } from '@/types'

interface Props {
  artifacts: Artifact[]
  activeTask: Task | null
}

const typeBadgeStyles: Record<string, React.CSSProperties> = {
  research: { background: '#dbeafe', color: '#1e40af' },
  document: { background: '#d1fae5', color: '#065f46' },
  summary: { background: '#fef3c7', color: '#92400e' },
  analyst: { background: '#ede9fe', color: '#5b21b6' },
  other: { background: '#f3f4f6', color: '#374151' },
}

export default function ArtifactPanel({ artifacts, activeTask }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (!artifacts.length) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        <p style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: '#9ca3af', lineHeight: 1.6 }}>
          Artifacts will appear here once agents complete their work
        </p>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
      {artifacts.map(artifact => (
        <div
          key={artifact.id}
          onClick={() => setSelectedId(selectedId === artifact.id ? null : artifact.id)}
          style={{
            border: `1px solid ${selectedId === artifact.id ? '#2563eb' : '#e5e7eb'}`,
            borderRadius: 8, marginBottom: 8, overflow: 'hidden', cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#f9fafb' }}>
            <span style={{
              fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4,
              textTransform: 'uppercase', letterSpacing: '0.05em',
              ...(typeBadgeStyles[artifact.type] || typeBadgeStyles.other)
            }}>
              {artifact.type}
            </span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{artifact.title}</span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>v{artifact.version}</span>
          </div>
          {selectedId === artifact.id && (
            <div style={{
              padding: 12, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              color: '#374151', maxHeight: 400, overflowY: 'auto',
              borderTop: '1px solid #e5e7eb',
            }}>
              {artifact.content}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
