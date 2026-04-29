'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

interface DataSource {
  id: string; name: string; type: string; rows: number; cols: number
  columns: string[]; data: Record<string, any>[]; preview: Record<string, any>[]
  columnStats: { name: string; type: string; min?: any; max?: any; uniques?: number }[]
}
interface DbConnection { id: string; name: string; type: string; status: string; tables?: string[] }
interface Insight { question: string; answer: string; chartData?: any; keyMetrics?: { label: string; value: string }[]; pinned?: boolean }
interface ChatMsg { id: string; role: string; content: string; time: string; user_name?: string; pending_write?: string }

const DB_CONFIGS: Record<string, any> = {
  postgres:    { host: 'localhost', port: '5432', user: 'postgres', database: 'mydb', dbLabel: 'Database', connStr: 'postgresql://user:pass@localhost:5432/mydb', connHint: 'Standard PostgreSQL URL' },
  mysql:       { host: 'localhost', port: '3306', user: 'root', database: 'mydb', dbLabel: 'Database', connStr: 'mysql://user:pass@localhost:3306/mydb', connHint: 'MySQL connection URL' },
  mariadb:     { host: 'localhost', port: '3306', user: 'root', database: 'mydb', dbLabel: 'Database', connStr: 'mariadb://user:pass@localhost:3306/mydb', connHint: 'MariaDB connection URL' },
  mssql:       { host: 'localhost', port: '1433', user: 'sa', database: 'master', dbLabel: 'Database', extraLabel: 'Instance', extraPlaceholder: 'SQLEXPRESS', connStr: 'mssql://sa:pass@localhost:1433/master', connHint: 'SQL Server URL' },
  sqlite:      { host: '', port: '', user: '', database: '/path/to/db.sqlite', dbLabel: 'File path', connStr: 'file:/path/to/database.sqlite', connHint: 'SQLite file path' },
  duckdb:      { host: '', port: '', user: '', database: '/path/to/db.duckdb', dbLabel: 'File path', connStr: 'duckdb:///path/to/db.duckdb', connHint: 'Use :memory: for in-memory' },
  mongodb:     { host: 'localhost', port: '27017', user: 'admin', database: 'mydb', dbLabel: 'Database', connStr: 'mongodb://localhost:27017/mydb', connHint: 'Supports Atlas SRV URIs' },
  redis:       { host: 'localhost', port: '6379', user: 'default', database: '0', dbLabel: 'DB index', connStr: 'redis://localhost:6379/0', connHint: 'Redis URL' },
  cassandra:   { host: 'localhost', port: '9042', user: '', database: '', dbLabel: 'Keyspace', extraLabel: 'Datacenter', extraPlaceholder: 'datacenter1', connStr: 'cassandra://localhost:9042/mykeyspace', connHint: 'Comma-separate contact points' },
  scylla:      { host: 'localhost', port: '9042', user: '', database: '', dbLabel: 'Keyspace', extraLabel: 'Datacenter', extraPlaceholder: 'datacenter1', connStr: 'scylla://localhost:9042/mykeyspace', connHint: 'ScyllaDB uses Cassandra driver' },
  clickhouse:  { host: 'localhost', port: '8123', user: 'default', database: 'default', dbLabel: 'Database', connStr: 'clickhouse://default@localhost:8123/default', connHint: 'ClickHouse HTTP interface' },
  bigquery:    { host: '', port: '', user: '', database: 'my-gcp-project', dbLabel: 'Project ID', extraLabel: 'Dataset', extraPlaceholder: 'my_dataset', connStr: 'bigquery://my-project/my-dataset', connHint: 'BigQuery project URL' },
  snowflake:   { host: 'account.snowflakecomputing.com', port: '443', user: 'user', database: 'MY_DB', dbLabel: 'Database', extraLabel: 'Warehouse', extraPlaceholder: 'COMPUTE_WH', connStr: 'snowflake://user:pass@account/db', connHint: 'Snowflake account URL' },
  supabase:    { host: 'db.xxxx.supabase.co', port: '5432', user: 'postgres', database: 'postgres', dbLabel: 'Database', connStr: 'postgresql://postgres:pass@db.xxxx.supabase.co:5432/postgres', connHint: 'Supabase Postgres URL' },
  planetscale: { host: 'aws.connect.psdb.cloud', port: '3306', user: 'user', database: 'mydb', dbLabel: 'Database', connStr: 'mysql://user:pass@aws.connect.psdb.cloud/mydb?ssl=true', connHint: 'PlanetScale MySQL URL' },
  turso:       { host: 'libsql://db.turso.io', port: '', user: '', database: '', dbLabel: 'Database URL', extraLabel: 'Auth token', extraPlaceholder: 'eyJ...', connStr: 'libsql://db-name-org.turso.io?authToken=TOKEN', connHint: 'Turso libSQL URL' },
}

function parseCSV(text: string): Record<string, any>[] {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const vals = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ? vals[i].trim().replace(/^"|"$/g, '') : '']))
  })
}
function inferStats(data: Record<string, any>[], columns: string[]) {
  return columns.map(col => {
    const vals = data.map(r => r[col]).filter(v => v !== '' && v != null)
    const nums = vals.map(Number).filter(n => !isNaN(n))
    if (nums.length > vals.length * 0.7) return { name: col, type: 'number', min: Math.min(...nums), max: Math.max(...nums) }
    return { name: col, type: 'text', uniques: new Set(vals).size }
  })
}
function cellVal(v: any): string { if (v === undefined || v === null) return '-'; return String(v) }
function renderMd(text: string): string {
  if (!text) return ''
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/^### (.*)/gm, '<h4>$1</h4>').replace(/^## (.*)/gm, '<h3>$1</h3>').replace(/^- (.*)/gm, '<li>$1</li>').replace(/`(.*?)`/g, '<code>$1</code>').replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')
}

const TABS = [{ id: 'analysis', label: 'Analysis' }, { id: 'sql', label: 'SQL' }, { id: 'charts', label: 'Charts' }, { id: 'summary', label: 'Report' }]
const CHART_TYPES = ['bar','line','pie','scatter','doughnut','radar']
const DB_TYPES = ['postgres','mysql','mariadb','mssql','sqlite','mongodb','redis','cassandra','scylla','clickhouse','bigquery','snowflake','supabase','planetscale','turso','duckdb']
const SQL_EXAMPLES = ['SELECT * FROM orders LIMIT 10', 'SELECT category, SUM(revenue) FROM sales GROUP BY category', 'SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL 30 DAY']

const SAMPLE_DATA = [
  { month:'Jan',revenue:42000,expenses:28000,profit:14000,units:340,region:'North',product:'Pro' },
  { month:'Feb',revenue:48000,expenses:29000,profit:19000,units:390,region:'North',product:'Basic' },
  { month:'Mar',revenue:45000,expenses:31000,profit:14000,units:365,region:'South',product:'Pro' },
  { month:'Apr',revenue:52000,expenses:30000,profit:22000,units:420,region:'North',product:'Enterprise' },
  { month:'May',revenue:61000,expenses:32000,profit:29000,units:495,region:'West',product:'Pro' },
  { month:'Jun',revenue:58000,expenses:35000,profit:23000,units:470,region:'South',product:'Basic' },
  { month:'Jul',revenue:49000,expenses:33000,profit:16000,units:400,region:'West',product:'Pro' },
  { month:'Aug',revenue:55000,expenses:31000,profit:24000,units:445,region:'North',product:'Enterprise' },
  { month:'Sep',revenue:63000,expenses:36000,profit:27000,units:510,region:'South',product:'Pro' },
  { month:'Oct',revenue:71000,expenses:38000,profit:33000,units:575,region:'West',product:'Enterprise' },
  { month:'Nov',revenue:84000,expenses:42000,profit:42000,units:680,region:'North',product:'Pro' },
  { month:'Dec',revenue:92000,expenses:45000,profit:47000,units:745,region:'West',product:'Enterprise' },
]

export default function AnalystPage() {
  const params = useParams()
  const workspaceId = Array.isArray(params.id) ? params.id[0] : params.id as string

  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [activeSource, setActiveSource] = useState<DataSource | null>(null)
  const [dbConnections, setDbConnections] = useState<DbConnection[]>([])
  const [activeDb, setActiveDb] = useState<DbConnection | null>(null)
  const [activeTab, setActiveTab] = useState('analysis')
  const [question, setQuestion] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [insights, setInsights] = useState<Insight[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([])
  const [sqlError, setSqlError] = useState('')
  const [chatInput, setChatInput] = useState('')
  const [chatThinking, setChatThinking] = useState(false)
  const [sqlQuery, setSqlQuery] = useState('')
  const [sqlResult, setSqlResult] = useState<any>(null)
  const [runningSQL, setRunningSQL] = useState(false)
  const [chartConfig, setChartConfig] = useState({ type: 'bar', x: '', y: '' })
  const [chartBuilt, setChartBuilt] = useState(false)
  const [summaryData, setSummaryData] = useState<any>(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [showDbModal, setShowDbModal] = useState(false)
  const [dbLoading, setDbLoading] = useState(false)
  const [writeConfirmPending, setWriteConfirmPending] = useState<string | null>(null)
  const [sqlLimit, setSqlLimit] = useState(500)
  const [dbErrorMsg, setDbErrorMsg] = useState('')
  const [dbPreview, setDbPreview] = useState<{ tables: string[]; preview: any[]; columns: string[]; rowCounts: Record<string,number> } | null>(null)
  const [testingDb, setTestingDb] = useState(false)
  const [dbError, setDbError] = useState('')
  const [dbTestStatus, setDbTestStatus] = useState('')
  const [dbForm, setDbForm] = useState({ type: 'postgres', name: '', host: '', port: '', database: '', username: '', password: '', connectionString: '', useConnStr: false, ssl: false, extra: '' })

  const chatEl = useRef<HTMLDivElement>(null)

  const numericCols = useMemo(() => activeSource ? activeSource.columnStats.filter(c => c.type === 'number').map(c => c.name) : [], [activeSource])
  const textCols = useMemo(() => activeSource ? activeSource.columnStats.filter(c => c.type === 'text').map(c => c.name) : [], [activeSource])
  const dbFieldDefaults = useMemo(() => DB_CONFIGS[dbForm.type] || DB_CONFIGS.postgres, [dbForm.type])
  const quickSuggestions = useMemo(() => {
    if (!activeSource) return ['Summarize this dataset', 'Find outliers', 'Show trends', 'Top 10 by value']
    const s2 = numericCols.length > 1 ? `Correlate ${numericCols[0]} vs ${numericCols[1]}` : `Distribution of ${numericCols[0] || activeSource.columns[0]}`
    return ['Summarize key insights', s2, textCols.length ? `Top 10 ${textCols[0]}` : 'Find anomalies', 'What should I focus on?']
  }, [activeSource, numericCols, textCols])

  function buildDataContext(): string {
    const src = activeSource
    if (!src) return ''
    const stats = src.columnStats.map(c => c.type === 'number' ? `${c.name}(num,${c.min}-${c.max})` : `${c.name}(text,${c.uniques}unique)`).join(', ')
    return `Dataset: ${src.name}, ${src.rows} rows. Columns: ${stats}`
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files; if (!files) return
    for (const file of Array.from(files)) {
      const text = await file.text()
      let data: Record<string, any>[] = []
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (ext === 'csv' || ext === 'tsv') data = parseCSV(ext === 'tsv' ? text.replace(/\t/g, ',') : text)
      else if (ext === 'json') { try { data = JSON.parse(text); if (!Array.isArray(data)) data = [data] } catch {} }
      if (!data.length) continue
      const columns = Object.keys(data[0])
      const src: DataSource = { id: Math.random().toString(36).slice(2), name: file.name, type: ext === 'csv' || ext === 'tsv' ? 'csv' : 'json', rows: data.length, cols: columns.length, columns, data, preview: data.slice(0, 10), columnStats: inferStats(data, columns) }
      setDataSources(prev => [...prev, src]); setActiveSource(src); setActiveDb(null); setInsights([])
    }
  }

  function loadSampleData() {
    const columns = Object.keys(SAMPLE_DATA[0])
    const src: DataSource = { id: 'sample', name: 'sample-sales-2024.csv', type: 'csv', rows: SAMPLE_DATA.length, cols: columns.length, columns, data: SAMPLE_DATA, preview: SAMPLE_DATA, columnStats: inferStats(SAMPLE_DATA, columns) }
    setDataSources(prev => { const idx = prev.findIndex(s => s.id === 'sample'); return idx !== -1 ? prev.map((s,i) => i===idx?src:s) : [...prev, src] })
    setActiveSource(src); setActiveDb(null); setInsights([])
  }

  function selectSource(src: DataSource) { setActiveSource(src); setActiveDb(null); setInsights([]); setActiveTab('analysis') }

  async function selectDb(db: DbConnection) {
    setActiveDb(db); setActiveSource(null); setInsights([]); setActiveTab('analysis'); setDbPreview(null); setDbLoading(true)
    try {
      const res = await fetch('/api/analyst/db-introspect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ connection_id: db.id, workspace_id: workspaceId }) }).then(r => r.json())
      setDbPreview(res)
      setDbConnections(prev => prev.map(c => c.id === db.id ? { ...c, tables: res.tables, status: 'connected' } : c))
      setActiveDb({ ...db, tables: res.tables, status: 'connected' })
    } catch (e: any) {
      setDbErrorMsg(e?.message || 'Connection failed')
      setDbConnections(prev => prev.map(c => c.id === db.id ? { ...c, status: 'error' } : c))
      setActiveDb({ ...db, status: 'error' })
    } finally { setDbLoading(false) }
  }

  async function removeDb(id: string) {
    setDbConnections(prev => prev.filter(d => d.id !== id))
    if (activeDb?.id === id) { setActiveDb(null); setDbPreview(null) }
    try { await fetch('/api/analyst/db-delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, workspace_id: workspaceId }) }) } catch {}
  }

  function removeSource(id: string) {
    setDataSources(prev => prev.filter(s => s.id !== id))
    if (activeSource?.id === id) { setActiveSource(null); setInsights([]) }
  }

  async function analyzeQuestion() {
    if (!question.trim() || analyzing) return
    const q = question.trim(); setQuestion(''); setAnalyzing(true)
    try {
      let body: any = { question: q, workspace_id: workspaceId }
      if (activeSource) { body.data_context = buildDataContext(); body.data_sample = activeSource.data.slice(0, 100) }
      else if (activeDb) { body.connection_id = activeDb.id; body.db_type = activeDb.type }
      const res = await fetch('/api/analyst/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())
      setInsights(prev => [{ question: q, answer: res.answer, keyMetrics: res.key_metrics || [], chartData: res.chart_data || null }, ...prev])
    } catch (e: any) {
      setInsights(prev => [{ question: q, answer: e?.message || 'Analysis failed. Please try again.' }, ...prev])
    } finally { setAnalyzing(false) }
  }

  async function sendChatMessage() {
    if (!chatInput.trim() || chatThinking) return
    const text = chatInput.trim(); setChatInput('')
    const userMsg: ChatMsg = { id: String(Date.now()), role: 'user', content: text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    setChatMessages(prev => [...prev, userMsg])
    setTimeout(() => { if (chatEl.current) chatEl.current.scrollTop = chatEl.current.scrollHeight }, 0)
    setChatThinking(true)
    try {
      const history = chatMessages.slice(-10).map(m => ({ role: m.role, content: m.content }))
      const res = await fetch('/api/analyst/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: text, history, data_context: buildDataContext(), workspace_id: workspaceId, connection_id: activeDb?.id || null, db_tables: dbPreview?.tables || [], db_name: activeDb?.name || null, db_type: activeDb?.type || null }) }).then(r => r.json())
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'assistant', content: res.reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), pending_write: res.pending_write || undefined }])
    } catch (e: any) {
      setChatMessages(prev => [...prev, { id: String(Date.now() + 1), role: 'assistant', content: e?.message || 'Something went wrong.', time: '' }])
    } finally {
      setChatThinking(false)
      setTimeout(() => { if (chatEl.current) chatEl.current.scrollTop = chatEl.current.scrollHeight }, 0)
    }
  }

  async function clearChat() {
    setChatMessages([])
    await fetch('/api/analyst/chat-clear', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace_id: workspaceId, connection_id: activeDb?.id || null }) })
  }

  async function generateSQL() {
    if (!sqlQuery.trim()) { setSqlQuery('SELECT * FROM '); return }
    const res = await fetch('/api/analyst/sql-gen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: sqlQuery, tables: activeDb ? (activeDb.tables || []) : (activeSource ? [activeSource.name] : []), db_type: activeDb?.type || 'postgres', workspace_id: workspaceId }) }).then(r => r.json())
    setSqlQuery(res.sql)
  }

  async function runSQL(allowWrite = false) {
    if (!sqlQuery.trim() || runningSQL) return
    setWriteConfirmPending(null); setRunningSQL(true)
    const start = Date.now()
    try {
      if (activeSource) {
        const data = activeSource.data.slice(0, sqlLimit)
        setSqlResult({ columns: activeSource.columns, data, rows: data.length, time: Date.now() - start, truncated: false })
      } else if (activeDb) {
        const res = await fetch('/api/analyst/db-query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: sqlQuery, connection_id: activeDb.id, limit: sqlLimit, allow_write: allowWrite }) }).then(r => r.json())
        if (res.error) { if (res.code === 'WRITE_CONFIRMATION_REQUIRED') setWriteConfirmPending(sqlQuery); else setSqlError(res.error); setSqlResult(null) }
        else setSqlResult({ columns: res.columns, data: res.data, rows: res.rows, time: res.time, truncated: res.truncated, affected_rows: res.affected_rows, query_type: res.query_type })
      }
    } catch (e: any) {
      setSqlResult(null); setSqlError(e?.message || 'Query failed')
    } finally { setRunningSQL(false) }
  }

  function exportSQL() {
    if (!sqlResult) return
    const rows = [sqlResult.columns.join(',')]
    sqlResult.data.forEach((r: any) => rows.push(sqlResult.columns.map((c: string) => cellVal(r[c])).join(',')))
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = `query-${Date.now()}.csv`; a.click()
  }

  function buildChart() {
    if (!activeSource) return
    const labels = activeSource.data.map(r => cellVal(r[chartConfig.x])).slice(0, 50)
    const values = activeSource.data.map(r => parseFloat(r[chartConfig.y]) || 0).slice(0, 50)
    setChartBuilt(true)
    setTimeout(() => {
      const canvas = document.getElementById('builder-chart') as HTMLCanvasElement
      if (!canvas || !(window as any).Chart) return
      const existing = (window as any).Chart.getChart(canvas); if (existing) existing.destroy()
      new (window as any).Chart(canvas, { type: chartConfig.type, data: { labels, datasets: [{ label: chartConfig.y, data: values, backgroundColor: '#6366f1', borderColor: '#6366f1', fill: false }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } })
    }, 0)
  }

  async function generateSummary() {
    if (!activeSource && !activeDb) return
    setGeneratingSummary(true)
    try {
      let sample: any[] = [], colStats: any[] = [], totalRows = 0, name = ''
      if (activeSource) { sample = activeSource.data.slice(0, 100); colStats = activeSource.columnStats; totalRows = activeSource.rows; name = activeSource.name }
      else if (activeDb && dbPreview) {
        name = `${activeDb.name} (${activeDb.type})`
        for (const table of dbPreview.tables.slice(0, 5)) {
          try { const res = await fetch('/api/analyst/db-query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql: `SELECT * FROM ${table} LIMIT 50`, connection_id: activeDb.id }) }).then(r => r.json()); sample.push(...(res.data || [])); totalRows += dbPreview.rowCounts[table] || 0 } catch {}
        }
        colStats = dbPreview.columns.map(c => ({ name: c, type: 'text' }))
      }
      const res = await fetch('/api/analyst/summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data_sample: sample, column_stats: colStats, name, total_rows: totalRows, db_tables: dbPreview?.tables || [], workspace_id: workspaceId }) }).then(r => r.json())
      setSummaryData(res)
    } catch (e) { console.error('Summary error:', e) }
    finally { setGeneratingSummary(false) }
  }

  function exportReport() {
    if (!summaryData) return
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([summaryData.content], { type: 'text/markdown' })); a.download = `report-${Date.now()}.md`; a.click()
  }

  async function saveConnection() {
    if (!dbForm.name) return
    setDbError(''); setDbTestStatus(''); setTestingDb(true)
    try {
      const testRes = await fetch('/api/analyst/db-test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dbForm, workspace_id: workspaceId }) }).then(r => r.json())
      if (testRes.error) { setDbTestStatus('error'); setDbError(testRes.error); setTestingDb(false); return }
      setDbTestStatus('success')
    } catch (e: any) { setDbTestStatus('error'); setDbError(e.message || 'Connection failed'); setTestingDb(false); return }
    setTestingDb(false)
    try {
      const saved = await fetch('/api/analyst/db-connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dbForm, workspace_id: workspaceId }) }).then(r => r.json())
      const newDb = { id: saved.id, name: dbForm.name, type: dbForm.type, status: 'connected', tables: [] }
      setDbConnections(prev => [...prev, newDb]); setShowDbModal(false); setDbTestStatus(''); setDbError('')
      setDbForm({ type: 'postgres', name: '', host: '', port: '', database: '', username: '', password: '', connectionString: '', useConnStr: false, ssl: false, extra: '' })
      await selectDb(newDb)
    } catch (e: any) { setDbError(e.message || 'Failed to save connection'); setDbTestStatus('error') }
  }

  async function loadSavedConnections() {
    try {
      const data = await fetch(`/api/analyst/db-list?workspace_id=${workspaceId}`).then(r => r.json())
      if (data && data.length) setDbConnections(data.map((d: any) => ({ id: d.id, name: d.name || d.type, type: d.type, status: d.status, tables: d.tables || [] })))
    } catch {}
  }

  useEffect(() => {
    loadSavedConnections()
    if (!(window as any).Chart) {
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/chart.umd.min.js'; document.head.appendChild(s)
    }
  }, [])

  useEffect(() => {
    if (activeSource) { setChartConfig(c => ({ ...c, x: activeSource.columns[0], y: numericCols[0] || activeSource.columns[1] || '' })) }
  }, [activeSource])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: activeDb ? '200px 1fr 300px' : '200px 1fr', height: '100%', overflow: 'hidden' }}>

      {/* Sources panel */}
      <aside style={{ borderRight: '1px solid var(--border)', background: 'var(--surface)', overflowY: 'auto', display: 'flex', flexDirection: 'column', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 6px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)' }}>
          <span>Data sources</span>
          <label style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '2px 6px', fontSize: 14, fontWeight: 600 }} title="Import file">
            <input type="file" accept=".csv,.xlsx,.xls,.json,.tsv" multiple onChange={handleFileImport} style={{ display: 'none' }} />+
          </label>
        </div>
        {!dataSources.length && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 12px 8px', lineHeight: 1.5 }}>Import CSV, Excel, or JSON</p>}
        {dataSources.map(src => (
          <div key={src.id} onClick={() => selectSource(src)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 8, margin: '0 6px 3px', border: `1px solid ${activeSource?.id === src.id ? 'var(--accent-border)' : 'transparent'}`, background: activeSource?.id === src.id ? 'var(--accent-soft)' : 'transparent' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: '#10b981', display: 'inline-block' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{src.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{src.rows} rows / {src.cols} cols</div>
            </div>
            <button onClick={e => { e.stopPropagation(); removeSource(src.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
        <button onClick={loadSampleData} style={{ margin: '6px 10px', padding: '6px 10px', background: 'var(--surface-2)', border: '1px dashed var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)', cursor: 'pointer', textAlign: 'left' }}>+ Sample sales data</button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px 6px', marginTop: 12, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text-3)' }}>
          <span>Databases</span>
          <button onClick={() => setShowDbModal(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, fontWeight: 600, padding: '2px 6px' }}>+</button>
        </div>
        {!dbConnections.length && <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '4px 12px 8px', lineHeight: 1.5 }}>Connect Postgres, MySQL, SQLite</p>}
        {dbConnections.map(db => (
          <div key={db.id} onClick={() => selectDb(db)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', cursor: 'pointer', borderRadius: 8, margin: '0 6px 3px', border: `1px solid ${activeDb?.id === db.id ? 'var(--accent-border)' : 'transparent'}`, background: activeDb?.id === db.id ? 'var(--accent-soft)' : 'transparent' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, background: db.status === 'connected' ? '#10b981' : db.status === 'error' ? '#ef4444' : '#d1d5db', display: 'inline-block' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{db.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{db.type}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); removeDb(db.id) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', display: 'flex', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </aside>

      {/* Main panel */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, gap: 2 }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '10px 14px', fontSize: 13, color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`, marginBottom: -1, fontWeight: activeTab === tab.id ? 500 : 400 }}>
              {tab.label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          {(activeSource || activeDb) && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{activeSource ? activeSource.name : activeDb?.name}</span>}
        </div>

        {/* Analysis tab */}
        {activeTab === 'analysis' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {(activeSource || activeDb) ? (
              <>
                <div style={{ padding: '10px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 7 }}>
                    <input value={question} onChange={e => setQuestion(e.target.value)} onKeyUp={e => e.key === 'Enter' && analyzeQuestion()} className="q-input" placeholder="Ask anything about your data..." style={{ flex: 1, padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-1)', outline: 'none' }} />
                    <button disabled={!question.trim() || analyzing} onClick={analyzeQuestion} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: !question.trim() || analyzing ? 'not-allowed' : 'pointer', opacity: !question.trim() || analyzing ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {analyzing ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : 'Go'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {quickSuggestions.map(s => (
                      <button key={s} onClick={() => { setQuestion(s); analyzeQuestion() }} style={{ fontSize: 11, padding: '3px 9px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 20, color: 'var(--text-2)', cursor: 'pointer' }}>{s}</button>
                    ))}
                  </div>
                </div>

                {!insights.length ? (
                  <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', fontSize: 12, fontWeight: 500, color: 'var(--text-1)', borderBottom: '1px solid var(--border-soft)', background: 'var(--surface)', flexShrink: 0 }}>
                      <span>{activeSource ? activeSource.name : activeDb?.name}</span>
                      <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>{activeSource ? `${activeSource.rows} rows` : activeDb?.type}</span>
                    </div>
                    <div style={{ flex: 1, overflow: 'auto' }}>
                      {activeSource && (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead><tr>{activeSource.columns.map(col => <th key={col} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', background: 'var(--surface)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{col}</th>)}</tr></thead>
                          <tbody>{activeSource.preview.map((row, i) => <tr key={i}>{activeSource.columns.map(col => <td key={col} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{cellVal(row[col])}</td>)}</tr>)}</tbody>
                        </table>
                      )}
                      {activeDb && (
                        <div style={{ padding: 20 }}>
                          {dbLoading ? <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Connecting to {activeDb.name}...</p>
                          : activeDb.status === 'error' ? (
                            <div><div style={{ fontSize: 14, fontWeight: 500, color: '#ef4444' }}>Connection failed</div><div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>{dbErrorMsg || 'Could not reach the database.'}</div><button onClick={() => selectDb(activeDb)} style={{ marginTop: 8, padding: '6px 14px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: 'var(--text-2)' }}>Retry</button></div>
                          ) : dbPreview ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
                              <div>{dbPreview.tables.map(t => <div key={t} onClick={() => { setSqlQuery(`SELECT * FROM ${t} LIMIT 50`); setActiveTab('sql') }} style={{ padding: '6px 10px', fontSize: 12, cursor: 'pointer', color: 'var(--text-1)', borderRadius: 6 }}>{t} <span style={{ color: 'var(--text-3)', fontSize: 10 }}>{dbPreview.rowCounts[t]?.toLocaleString()} rows</span></div>)}</div>
                              <div style={{ overflow: 'auto' }}>{dbPreview.preview.length > 0 && <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}><thead><tr>{dbPreview.columns.map(c => <th key={c} style={{ padding: '6px 10px', textAlign: 'left', fontSize: 10, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', borderBottom: '1px solid var(--border)', background: 'var(--surface)', position: 'sticky', top: 0 }}>{c}</th>)}</tr></thead><tbody>{dbPreview.preview.map((row, i) => <tr key={i}>{dbPreview.columns.map(c => <td key={c} style={{ padding: '5px 10px', borderBottom: '1px solid var(--border-soft)', fontSize: 12, color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{cellVal(row[c])}</td>)}</tr>)}</tbody></table>}</div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {insights.map((ins, i) => (
                      <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-soft)' }}>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: 500, color: 'var(--text-1)' }}>{ins.question}</div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            {['pin','export','remove'].map(a => <button key={a} onClick={() => { if (a==='remove') setInsights(prev => prev.filter((_,j)=>j!==i)); else if (a==='pin') setInsights(prev => prev.map((x,j) => j===i ? {...x,pinned:!x.pinned} : x)) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>{a==='pin' ? (ins.pinned ? 'unpin' : 'pin') : a}</button>)}
                          </div>
                        </div>
                        <div style={{ padding: '10px 14px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-1)' }} dangerouslySetInnerHTML={{ __html: renderMd(ins.answer) }} />
                        {ins.keyMetrics && ins.keyMetrics.length > 0 && (
                          <div style={{ display: 'flex', gap: 8, padding: '0 12px 12px', flexWrap: 'wrap' }}>
                            {ins.keyMetrics.map(m => <div key={m.label} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '6px 10px' }}><div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{m.value}</div><div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{m.label}</div></div>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 8px' }}>AI Data Analyst</h2>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>Connect a database or import a file to start</p>
              </div>
            )}
          </div>
        )}

        {/* SQL tab */}
        {activeTab === 'sql' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-soft)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>SQL Editor</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>Limit</span>
                  <select value={sqlLimit} onChange={e => setSqlLimit(parseInt(e.target.value))} style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 5, fontSize: 12, background: 'var(--surface)', color: 'var(--text-1)' }}>
                    {[100,500,1000,5000,999999].map(v => <option key={v} value={v}>{v === 999999 ? 'All' : v}</option>)}
                  </select>
                </div>
                <button disabled={!sqlQuery.trim() || runningSQL} onClick={() => runSQL(false)} style={{ padding: '5px 12px', background: '#d1fae5', color: '#065f46', border: '1px solid #bbf7d0', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: !sqlQuery.trim() || runningSQL ? 'not-allowed' : 'pointer', opacity: !sqlQuery.trim() || runningSQL ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {runningSQL ? <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid rgba(0,0,0,.2)', borderTopColor: '#065f46', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : 'Run'}
                </button>
                <button onClick={generateSQL} style={{ padding: '5px 10px', background: 'var(--surface-3)', border: 'none', borderRadius: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>Generate SQL</button>
              </div>
              <textarea value={sqlQuery} onChange={e => setSqlQuery(e.target.value)} placeholder="SELECT * FROM orders LIMIT 100" spellCheck={false} style={{ width: '100%', minHeight: 100, padding: '12px 14px', fontFamily: 'monospace', fontSize: 13, border: 'none', resize: 'vertical', color: 'var(--text-1)', background: 'var(--surface)', boxSizing: 'border-box', outline: 'none' }} />
            </div>
            {writeConfirmPending && (
              <div style={{ background: '#fef3c7', borderBottom: '1px solid #fcd34d', padding: '12px 14px', flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#92400e', marginBottom: 6 }}><strong>Write operation detected</strong> — This query will modify data. Are you sure?</div>
                <code style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', background: 'white', border: '1px solid #e5e7eb', borderRadius: 5, padding: '6px 10px', marginBottom: 10, whiteSpace: 'pre-wrap' }}>{writeConfirmPending}</code>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setWriteConfirmPending(null)} style={{ padding: '5px 14px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => runSQL(true)} style={{ padding: '5px 14px', background: '#ef4444', color: 'white', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Yes, run it</button>
                </div>
              </div>
            )}
            {sqlResult ? (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-2)', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
                  {sqlResult.query_type === 'write' ? <span style={{ fontSize: 11, fontWeight: 600, color: '#065f46', background: '#d1fae5', padding: '2px 8px', borderRadius: 10 }}>{sqlResult.affected_rows} rows affected</span> : <span>{sqlResult.rows} rows</span>}
                  {sqlResult.truncated && <span style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '2px 8px', borderRadius: 10 }}>Limited to {sqlLimit}</span>}
                  <span style={{ color: 'var(--text-3)' }}>{sqlResult.time}ms</span>
                  <button onClick={exportSQL} style={{ marginLeft: 'auto', padding: '4px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, fontSize: 11, cursor: 'pointer', color: 'var(--text-2)' }}>Export CSV</button>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>{sqlResult.columns.map((col: string) => <th key={col} style={{ padding: '7px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 10, textTransform: 'uppercase', background: 'var(--surface)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{col}</th>)}</tr></thead>
                    <tbody>{sqlResult.data.map((row: any, i: number) => <tr key={i}>{sqlResult.columns.map((col: string) => <td key={col} style={{ padding: '6px 12px', borderBottom: '1px solid var(--border-soft)', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{cellVal(row[col])}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-3)', fontSize: 13, padding: 30 }}>
                <p style={{ margin: 0 }}>Write SQL or use Generate SQL to create queries from plain English</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 480 }}>
                  {SQL_EXAMPLES.map(ex => <button key={ex} onClick={() => setSqlQuery(ex)} style={{ padding: '7px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-1)', cursor: 'pointer', textAlign: 'left' }}>{ex}</button>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Charts tab */}
        {activeTab === 'charts' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
            <div style={{ width: 200, borderRight: '1px solid var(--border)', padding: 14, overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--surface)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Chart type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {CHART_TYPES.map(ct => <button key={ct} onClick={() => setChartConfig(c => ({ ...c, type: ct }))} style={{ padding: '6px 4px', background: chartConfig.type === ct ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1px solid ${chartConfig.type === ct ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: chartConfig.type === ct ? 'var(--accent)' : 'var(--text-2)', textAlign: 'center' }}>{ct.charAt(0).toUpperCase() + ct.slice(1)}</button>)}
                </div>
              </div>
              {activeSource && (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>X axis</label>
                    <select value={chartConfig.x} onChange={e => setChartConfig(c => ({ ...c, x: e.target.value }))} style={{ padding: '6px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none' }}>
                      {activeSource.columns.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Y axis</label>
                    <select value={chartConfig.y} onChange={e => setChartConfig(c => ({ ...c, y: e.target.value }))} style={{ padding: '6px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none' }}>
                      {numericCols.map(col => <option key={col} value={col}>{col}</option>)}
                    </select>
                  </div>
                </>
              )}
              <button disabled={!activeSource} onClick={buildChart} style={{ padding: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: activeSource ? 'pointer' : 'not-allowed', opacity: activeSource ? 1 : 0.4, marginTop: 'auto' }}>Build chart</button>
            </div>
            <div style={{ flex: 1, padding: 20, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <canvas id="builder-chart" height={280} />
              {!chartBuilt && <div style={{ position: 'absolute', fontSize: 13, color: 'var(--text-3)' }}>Configure and build your chart</div>}
            </div>
          </div>
        )}

        {/* Summary tab */}
        {activeTab === 'summary' && (
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {!summaryData ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
                <button disabled={(!activeSource && !activeDb) || generatingSummary} onClick={generateSummary} style={{ padding: '10px 22px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 500, cursor: (!activeSource && !activeDb) || generatingSummary ? 'not-allowed' : 'pointer', opacity: (!activeSource && !activeDb) || generatingSummary ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {generatingSummary ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', animation: 'spin .7s linear infinite', display: 'inline-block' }} /> : null}
                  {generatingSummary ? 'Generating...' : 'Generate full report'}
                </button>
                <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 280, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>Auto-generate a complete analysis report with key insights, trends, and recommendations</p>
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, flex: 1, color: 'var(--text-1)' }}>{summaryData.title}</span>
                  <button onClick={exportReport} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Export</button>
                  <button onClick={() => setSummaryData(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, padding: '2px 6px' }}>Regenerate</button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: 20, fontSize: 13, lineHeight: 1.8, color: 'var(--text-1)' }} dangerouslySetInnerHTML={{ __html: renderMd(summaryData.content) }} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Chat panel (shown when DB active) */}
      {activeDb && (
        <aside style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-2)', borderBottom: '1px solid var(--border-soft)', flexShrink: 0 }}>
            <span>Chat with data</span>
            <button onClick={clearChat} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 11, padding: '2px 6px', borderRadius: 4 }}>Clear</button>
          </div>
          <div ref={chatEl} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0 }}>
            {!chatMessages.length && <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5, textAlign: 'center', margin: 0 }}>Ask follow-up questions or dig deeper into any insight</p>}
            {chatMessages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                {msg.user_name && msg.role === 'user' && <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent)', marginBottom: 2, paddingLeft: 2 }}>{msg.user_name}</div>}
                <div style={{ padding: '10px 14px', borderRadius: msg.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px', fontSize: 13, lineHeight: 1.68, maxWidth: '90%', background: msg.role === 'user' ? 'linear-gradient(135deg, #4f46e5, #6d28d9)' : 'var(--surface-2)', color: msg.role === 'user' ? '#fff' : 'var(--text-1)', border: msg.role === 'user' ? 'none' : '1px solid var(--border-soft)' }} dangerouslySetInnerHTML={{ __html: renderMd(msg.content) }} />
                {msg.pending_write && (
                  <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 12px', marginTop: 6, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#92400e' }}>⚠ Proposed write — confirm before executing</div>
                    <code style={{ display: 'block', fontSize: 11, fontFamily: 'monospace', background: 'white', border: '1px solid #e5e7eb', borderRadius: 4, padding: '5px 8px', whiteSpace: 'pre-wrap' }}>{msg.pending_write}</code>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending_write: undefined } : m))} style={{ padding: '4px 12px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: 11, cursor: 'pointer' }}>Decline</button>
                      <button onClick={async () => { const sql = msg.pending_write; setChatMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending_write: undefined } : m)); if (!sql || !activeDb) return; setChatThinking(true); try { const res = await fetch('/api/analyst/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'confirm', workspace_id: workspaceId, connection_id: activeDb.id, confirm_write: true, pending_sql: sql, history: [] }) }).then(r => r.json()); setChatMessages(prev => [...prev, { id: String(Date.now()), role: 'assistant', content: res.reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]) } catch {} finally { setChatThinking(false) } }} style={{ padding: '5px 14px', background: '#b45309', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Confirm & Execute</button>
                    </div>
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{msg.time}</div>
              </div>
            ))}
            {chatThinking && <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '10px 14px', borderRadius: '12px 12px 12px 4px', background: 'var(--surface-2)', width: 'fit-content' }}>{[0,200,400].map(d => <span key={d} style={{ width: 5, height: 5, background: 'var(--text-3)', borderRadius: '50%', animation: `bounce 1.2s ${d}ms infinite`, display: 'inline-block' }} />)}</div>}
          </div>
          <div style={{ borderTop: '1px solid var(--border-soft)', padding: '10px 12px', display: 'flex', gap: 8, flexShrink: 0, background: 'var(--surface)', alignItems: 'flex-end' }}>
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }} placeholder="Ask anything about your data..." rows={3} style={{ flex: 1, resize: 'none', fontSize: 13, border: '1.5px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', lineHeight: 1.5, minHeight: 56, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none' }} />
            <button disabled={!chatInput.trim() || chatThinking} onClick={sendChatMessage} style={{ padding: '8px 16px', background: 'linear-gradient(135deg, #4f46e5, #6d28d9)', color: '#fff', border: 'none', borderRadius: 8, cursor: !chatInput.trim() || chatThinking ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 600, opacity: !chatInput.trim() || chatThinking ? 0.4 : 1, alignSelf: 'flex-end' }}>Send</button>
          </div>
        </aside>
      )}

      {/* SQL Error toast */}
      {sqlError && (
        <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 900, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', borderRadius: 10, background: 'rgba(239,68,68,.95)', color: '#fff', fontSize: 13, fontWeight: 500, boxShadow: '0 8px 24px rgba(0,0,0,.25)', border: '1px solid rgba(255,255,255,.15)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          <span>{sqlError}</span>
          <button onClick={() => setSqlError('')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}

      {/* DB Connect Modal */}
      {showDbModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={e => e.target === e.currentTarget && setShowDbModal(false)}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', fontWeight: 500, fontSize: 14, color: 'var(--text-1)' }}>
              <span>Connect database</span>
              <button onClick={() => setShowDbModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14 }}>✕</button>
            </div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {DB_TYPES.map(t => <button key={t} onClick={() => setDbForm(f => ({ ...f, type: t }))} style={{ padding: '6px 4px', background: dbForm.type === t ? 'var(--accent-soft)' : 'var(--surface-2)', border: `1px solid ${dbForm.type === t ? 'var(--accent-border)' : 'var(--border)'}`, borderRadius: 6, fontSize: 11, cursor: 'pointer', color: dbForm.type === t ? 'var(--accent)' : 'var(--text-2)', textAlign: 'center', fontWeight: dbForm.type === t ? 500 : 400 }}>{t}</button>)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Connection name <span style={{ color: 'var(--red)' }}>*</span></label>
                <input value={dbForm.name} onChange={e => setDbForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Production Postgres" style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', border: '1.5px solid var(--border)', borderRadius: 7, overflow: 'hidden' }}>
                {['Fields','Connection string'].map((opt, i) => <button key={opt} onClick={() => setDbForm(f => ({ ...f, useConnStr: i === 1 }))} style={{ flex: 1, padding: 6, fontSize: 12, border: 'none', background: (i === 0 && !dbForm.useConnStr) || (i === 1 && dbForm.useConnStr) ? 'var(--accent-soft)' : 'var(--surface)', cursor: 'pointer', color: (i === 0 && !dbForm.useConnStr) || (i === 1 && dbForm.useConnStr) ? 'var(--accent)' : 'var(--text-2)', fontWeight: (i === 0 && !dbForm.useConnStr) || (i === 1 && dbForm.useConnStr) ? 500 : 400 }}>{opt}</button>)}
              </div>
              {dbForm.useConnStr ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>Connection string</label>
                  <input value={dbForm.connectionString} onChange={e => setDbForm(f => ({ ...f, connectionString: e.target.value }))} placeholder={dbFieldDefaults.connStr} style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{dbFieldDefaults.connHint}</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{label:'Host',key:'host',placeholder:dbFieldDefaults.host,flex:1},{label:'Port',key:'port',placeholder:dbFieldDefaults.port,maxWidth:90}].map(f => (
                      <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, ...(f.maxWidth ? { maxWidth: f.maxWidth } : { flex: f.flex }) }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>{f.label}</label>
                        <input value={(dbForm as any)[f.key]} onChange={e => setDbForm(form => ({ ...form, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, fontFamily: 'inherit', background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>{dbFieldDefaults.dbLabel}</label>
                    <input value={dbForm.database} onChange={e => setDbForm(f => ({ ...f, database: e.target.value }))} placeholder={dbFieldDefaults.database} style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {[{label:'Username',key:'username',placeholder:dbFieldDefaults.user},{label:'Password',key:'password',type:'password',placeholder:'leave blank if none'}].map(f => (
                      <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>{f.label}</label>
                        <input type={f.type || 'text'} value={(dbForm as any)[f.key]} onChange={e => setDbForm(form => ({ ...form, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                      </div>
                    ))}
                  </div>
                  {dbFieldDefaults.extraLabel && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)' }}>{dbFieldDefaults.extraLabel}</label>
                      <input value={dbForm.extra} onChange={e => setDbForm(f => ({ ...f, extra: e.target.value }))} placeholder={dbFieldDefaults.extraPlaceholder || ''} style={{ padding: '8px 10px', border: '1.5px solid var(--border)', borderRadius: 7, fontSize: 13, background: 'var(--surface)', color: 'var(--text-1)', outline: 'none', boxSizing: 'border-box', width: '100%' }} />
                    </div>
                  )}
                  <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={dbForm.ssl} onChange={e => setDbForm(f => ({ ...f, ssl: e.target.checked }))} style={{ cursor: 'pointer' }} />
                    Enable SSL/TLS
                  </label>
                </>
              )}
              {testingDb && <div style={{ fontSize: 12, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '8px 10px', borderRadius: 6 }}>Testing connection...</div>}
              {dbTestStatus === 'success' && !testingDb && <div style={{ fontSize: 12, color: '#065f46', background: '#d1fae5', padding: '8px 10px', borderRadius: 6 }}>Connection successful - saving...</div>}
              {dbTestStatus === 'error' && <div style={{ fontSize: 12, color: '#dc2626', background: '#fee2e2', padding: '8px 10px', borderRadius: 6 }}>{dbError}</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowDbModal(false)} style={{ padding: '7px 14px', border: '1.5px solid var(--border)', borderRadius: 7, background: 'var(--surface)', color: 'var(--text-1)', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
              <button disabled={!dbForm.name || testingDb} onClick={saveConnection} style={{ padding: '7px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, cursor: !dbForm.name || testingDb ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500, opacity: !dbForm.name || testingDb ? 0.4 : 1 }}>
                {testingDb ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-4px)} }`}</style>
    </div>
  )
}