'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import DataEditor, {
  CompactSelection,
  type EditableGridCell,
  type GridCell,
  GridCellKind,
  type GridColumn,
  type Item,
  type Theme,
} from '@glideapps/glide-data-grid'
import '@glideapps/glide-data-grid/dist/index.css'

import { Download, Plus, Sparkles, Trash2, Columns2, Loader2 } from 'lucide-react'
import type { DataGridArtifact, DataGridContent } from '@/types'

function css(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

function buildTheme(): Partial<Theme> {
  return {
    accentColor:       css('--accent',        '#6366f1'),
    accentFg:          css('--text-inv',      '#ffffff'),
    accentLight:       css('--accent-soft',   '#eef2ff'),
    textDark:          css('--text-1',        '#1a1714'),
    textMedium:        css('--text-2',        '#5c5549'),
    textLight:         css('--text-3',        '#9c9289'),
    textBubble:        css('--text-1',        '#1a1714'),
    bgIconHeader:      css('--surface-2',     '#f5f3ef'),
    fgIconHeader:      css('--text-2',        '#5c5549'),
    textHeader:        css('--text-1',        '#1a1714'),
    textGroupHeader:   css('--text-1',        '#1a1714'),
    bgCell:            css('--surface',       '#ffffff'),
    bgCellMedium:      css('--bg',            '#f9f7f4'),
    bgHeader:          css('--surface-2',     '#f5f3ef'),
    bgHeaderHasFocus:  css('--accent-soft',   '#eef2ff'),
    bgHeaderHovered:   css('--surface-3',     '#ede9e2'),
    bgBubble:          css('--surface-2',     '#f5f3ef'),
    bgBubbleSelected:  css('--accent-border', '#c7d2fe'),
    borderColor:       css('--border',        '#e8e4dc'),
    drilldownBorder:   css('--accent',        '#6366f1'),
    linkColor:         css('--accent',        '#6366f1'),
    cellHorizontalPadding: 12,
    cellVerticalPadding:   4,
    headerFontStyle:   '500 12px',
    baseFontStyle:     '13px',
    fontFamily:        'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    editorFontSize:    '13px',
    lineHeight:        1.5,
  }
}

function buildColumns(headers: string[], widths: number[]): GridColumn[] {
  return headers.map((h, i) => ({
    title: h,
    id: `col-${i}`,
    width: widths[i] ?? 160,
    hasMenu: false,
  }))
}

function toCsv(headers: string[], rows: string[][]): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  return [headers, ...rows].map(r => r.map(esc).join(',')).join('\n')
}

interface Props {
  artifact: DataGridArtifact
  onDataChange?: (content: DataGridContent) => void
}

export function DataGridRenderer({ artifact, onDataChange }: Props) {
  const content = artifact.content as DataGridContent

  const [headers, setHeaders] = useState<string[]>(content.headers ?? [])
  const [rows, setRows]       = useState<string[][]>(content.rows ?? [])
  const [widths, setWidths]   = useState<number[]>(
    content.columnWidths ?? (content.headers ?? []).map(() => 160)
  )
  const [selection, setSelection] = useState({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: undefined as any,
  })
  const [aiPrompt, setAiPrompt]   = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError]     = useState<string | null>(null)
  const [gridTheme, setGridTheme] = useState<Partial<Theme>>({})

  // Read CSS vars after mount so canvas gets real resolved values
  useEffect(() => { setGridTheme(buildTheme()) }, [])

  useEffect(() => {
    setHeaders(content.headers ?? [])
    setRows(content.rows ?? [])
    setWidths(content.columnWidths ?? (content.headers ?? []).map(() => 160))
  }, [artifact.id, artifact.version]) // eslint-disable-line

  const emit = useCallback(
    (h: string[], r: string[][], w: number[]) =>
      onDataChange?.({ headers: h, rows: r, columnWidths: w }),
    [onDataChange]
  )

  const getContent = useCallback(
    ([col, row]: Item): GridCell => {
      const value = rows[row]?.[col] ?? ''
      return { kind: GridCellKind.Text, data: value, displayData: value, allowOverlay: true, readonly: false }
    },
    [rows]
  )

  const onCellEdited = useCallback(
    ([col, row]: Item, cell: EditableGridCell) => {
      const next = rows.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? String((cell as any).data ?? '') : c)) : r
      )
      setRows(next)
      emit(headers, next, widths)
    },
    [rows, headers, widths, emit]
  )

  const columns = useMemo(() => buildColumns(headers, widths), [headers, widths])

  const onColumnResize = useCallback(
    (_col: GridColumn, newSize: number, colIndex: number) => {
      const next = widths.map((w, i) => (i === colIndex ? newSize : w))
      setWidths(next)
      emit(headers, rows, next)
    },
    [widths, headers, rows, emit]
  )

  function addRow() {
    const next = [...rows, Array(headers.length).fill('')]
    setRows(next); emit(headers, next, widths)
  }

  function addColumn() {
    const nh = [...headers, `Column ${headers.length + 1}`]
    const nw = [...widths, 160]
    const nr = rows.map(r => [...r, ''])
    setHeaders(nh); setWidths(nw); setRows(nr); emit(nh, nr, nw)
  }

  function deleteSelectedRows() {
    const del = new Set(selection.rows.toArray())
    if (!del.size) return
    const next = rows.filter((_, i) => !del.has(i))
    setRows(next)
    setSelection({ columns: CompactSelection.empty(), rows: CompactSelection.empty(), current: undefined })
    emit(headers, next, widths)
  }

  function exportCsv() {
    const blob = new Blob([toCsv(headers, rows)], { type: 'text/csv' })
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `${artifact.title.replace(/\s+/g, '_')}.csv`,
    })
    a.click(); URL.revokeObjectURL(a.href)
  }

  async function runAiAssist() {
    if (!aiPrompt.trim()) return
    setAiLoading(true); setAiError(null)
    try {
      const res = await fetch('/api/artifacts/datagrid-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headers, rows, prompt: aiPrompt }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json() as { headers: string[]; rows: string[][] }
      const nw = data.headers.map((_, i) => widths[i] ?? 160)
      setHeaders(data.headers); setRows(data.rows); setWidths(nw)
      emit(data.headers, data.rows, nw)
      setAiPrompt('')
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI assist failed')
    } finally {
      setAiLoading(false)
    }
  }

  const gridHeight = Math.min(540, Math.max(180, rows.length * 34 + 48))
  const selCount   = selection.rows.length

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>

      <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
        <button className="btn btn-ghost" style={{ fontSize:12, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:4 }} onClick={addRow}>
          <Plus size={12} /> Row
        </button>
        <button className="btn btn-ghost" style={{ fontSize:12, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:4 }} onClick={addColumn}>
          <Columns2 size={12} /> Column
        </button>
        {selCount > 0 && (
          <button className="btn btn-danger" style={{ fontSize:12, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:4 }} onClick={deleteSelectedRows}>
            <Trash2 size={12} /> Delete {selCount} row{selCount > 1 ? 's' : ''}
          </button>
        )}
        <div style={{ flex:1 }} />
        <span className="badge badge-grey" style={{ fontFamily:'monospace', fontSize:11 }}>
          {rows.length} × {headers.length}
        </span>
        <button className="btn btn-ghost" style={{ fontSize:12, padding:'3px 10px', display:'inline-flex', alignItems:'center', gap:4 }} onClick={exportCsv}>
          <Download size={12} /> Export CSV
        </button>
      </div>

      <div style={{ borderRadius:8, border:'1px solid var(--border)', overflow:'hidden', height: gridHeight }}>
        <DataEditor
          width="100%"
          height={gridHeight}
          columns={columns}
          getCellContent={getContent}
          onCellEdited={onCellEdited}
          onColumnResize={onColumnResize}
          rows={rows.length}
          rowMarkers="both"
          smoothScrollX
          smoothScrollY
          freezeColumns={1}
          rowSelect="multi"
          gridSelection={selection}
          onGridSelectionChange={s =>
            setSelection({ columns: s.columns, rows: s.rows, current: s.current })
          }
          theme={gridTheme}
          getCellsForSelection
          onPaste
        />
      </div>

      <div style={{
        display:'flex', alignItems:'center', gap:8,
        border:'1px solid var(--border)', borderRadius:8,
        background:'var(--surface-2)', padding:'7px 12px',
        opacity: aiLoading ? 0.6 : 1,
        pointerEvents: aiLoading ? 'none' : 'auto',
      }}>
        {aiLoading
          ? <Loader2 size={13} style={{ color:'var(--accent)', flexShrink:0, animation:'spin .8s linear infinite' }} />
          : <Sparkles size={13} style={{ color:'var(--text-3)', flexShrink:0 }} />
        }
        <input
          style={{
            flex:1, border:'none', background:'transparent', outline:'none',
            fontSize:12, color:'var(--text-1)', fontFamily:'inherit',
          }}
          placeholder='Ask AI: "add Bonus column", "sort by score desc", "summarize by dept"…'
          value={aiPrompt}
          onChange={e => setAiPrompt(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') runAiAssist() }}
        />
        <button
          disabled={!aiPrompt.trim()}
          onClick={runAiAssist}
          style={{
            padding:'3px 10px', fontSize:12, borderRadius:6, border:'none', cursor:'pointer',
            background: aiPrompt.trim() ? 'var(--accent)' : 'transparent',
            color: aiPrompt.trim() ? 'var(--text-inv)' : 'var(--text-3)',
            fontFamily:'inherit',
          }}
        >
          {aiLoading ? 'Working…' : 'Run'}
        </button>
      </div>

      {aiError && (
        <p style={{ fontSize:12, color:'var(--red-text)', padding:'0 4px' }}>{aiError}</p>
      )}
    </div>
  )
}


