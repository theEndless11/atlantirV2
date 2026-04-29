import type { TaskStatus } from '@/types'

const labels: Record<string, string> = {
  pending_approval: 'Pending',
  approved: 'Approved',
  in_progress: 'Running',
  needs_clarification: 'Question',
  completed: 'Done',
  cancelled: 'Cancelled',
}

const styles: Record<string, React.CSSProperties> = {
  pending_approval: { background: '#fef3c7', color: '#92400e' },
  approved: { background: '#dbeafe', color: '#1e40af' },
  in_progress: { background: '#e0e7ff', color: '#3730a3' },
  needs_clarification: { background: '#fce7f3', color: '#9d174d' },
  completed: { background: '#d1fae5', color: '#065f46' },
  cancelled: { background: '#f3f4f6', color: '#6b7280' },
}

export default function TaskStatusBadge({ status }: { status: TaskStatus | string }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '2px 7px', borderRadius: 10,
      ...(styles[status] || { background: '#f3f4f6', color: '#6b7280' })
    }}>
      {labels[status] || status}
    </span>
  )
}
