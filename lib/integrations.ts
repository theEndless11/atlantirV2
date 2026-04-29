import { useSupabaseAdmin } from '@/lib/supabase'

async function getIntegration(workspaceId: string, type: string) {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('integrations')
    .select('config')
    .eq('workspace_id', workspaceId)
    .eq('type', type)
    .eq('status', 'connected')
    .single()
  return data?.config as any || null
}

export async function sendSlack(workspaceId: string, message: string, channel?: string): Promise<boolean> {
  const config = await getIntegration(workspaceId, 'slack')
  if (!config?.webhook_url) return false
  const res = await fetch(config.webhook_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel: channel || config.channel || '#general', text: message, username: 'Atlantir', icon_emoji: ':robot_face:' })
  })
  return res.ok
}

// ─── GitHub ───────────────────────────────────────────────────────────────────
// Unified helper — all GitHub calls go through here so we never duplicate auth headers.

async function resolveGitHubRepo(token: string, preferredRepo?: string): Promise<string | null> {
  if (preferredRepo && preferredRepo.includes('/')) {
    const check = await fetch(`https://api.github.com/repos/${preferredRepo}`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
    })
    if (check.ok) return preferredRepo
  }
  const res = await fetch('https://api.github.com/user/repos?per_page=1&sort=pushed', {
    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data[0]?.full_name || null
}

async function ghFetch(token: string, path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      ...(opts.headers as any || {})
    }
  })
}

export async function listGitHubUserRepos(workspaceId: string): Promise<any[] | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const res = await ghFetch(cfg.token, '/user/repos?per_page=50&sort=pushed')
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data)
    ? data.map((r: any) => ({ name: r.name, full_name: r.full_name, private: r.private, description: r.description || '', language: r.language || '', stars: r.stargazers_count || 0, pushed_at: r.pushed_at, default_branch: r.default_branch }))
    : null
}

export async function getGitHubRepoInfo(workspaceId: string, repo?: string): Promise<any | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const [repoRes, langRes] = await Promise.all([
    ghFetch(cfg.token, `/repos/${resolvedRepo}`),
    ghFetch(cfg.token, `/repos/${resolvedRepo}/languages`)
  ])
  if (!repoRes.ok) return null
  const r = await repoRes.json()
  const langs = langRes.ok ? Object.keys(await langRes.json()).slice(0, 5) : []
  return { name: r.name, full_name: r.full_name, description: r.description, private: r.private, stars: r.stargazers_count, forks: r.forks_count, open_issues: r.open_issues_count, default_branch: r.default_branch, languages: langs, url: r.html_url, pushed_at: r.pushed_at, topics: r.topics || [] }
}

export async function listGitHubFiles(workspaceId: string, path = '', repo?: string, ref?: string): Promise<{ files: { name: string; type: string; path: string; size?: number; sha?: string }[]; repo: string } | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/contents/${path}${query}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data)) return null
  return { repo: resolvedRepo, files: data.map((f: any) => ({ name: f.name, type: f.type, path: f.path, size: f.size, sha: f.sha })) }
}

export async function readGitHubFile(workspaceId: string, filePath: string, repo?: string, ref?: string): Promise<{ content: string; sha: string; repo: string; url: string } | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/contents/${filePath}${query}`)
  if (!res.ok) return null
  const data = await res.json()
  if (data.type !== 'file' || !data.content) return null
  const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8')
  return { content: decoded, sha: data.sha, repo: resolvedRepo, url: data.html_url }
}

export async function getGitHubCommits(workspaceId: string, repo?: string, branch?: string, limit = 20): Promise<any[] | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const params = new URLSearchParams({ per_page: String(limit) })
  if (branch) params.set('sha', branch)
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/commits?${params}`)
  if (!res.ok) return null
  const data = await res.json()
  if (!Array.isArray(data)) return null
  return data.map((c: any) => ({
    sha: c.sha?.slice(0, 7), full_sha: c.sha,
    message: c.commit?.message || '',
    author: c.commit?.author?.name || c.author?.login || 'unknown',
    date: c.commit?.author?.date || '',
    url: c.html_url
  }))
}

export async function getGitHubCommitDetail(workspaceId: string, sha: string, repo?: string): Promise<any | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/commits/${sha}`)
  if (!res.ok) return null
  const data = await res.json()
  return {
    sha: data.sha?.slice(0, 7), message: data.commit?.message || '',
    author: data.commit?.author?.name || '', date: data.commit?.author?.date || '',
    url: data.html_url, additions: data.stats?.additions, deletions: data.stats?.deletions,
    files: (data.files || []).map((f: any) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch?.slice(0, 800) }))
  }
}

export async function listGitHubBranches(workspaceId: string, repo?: string): Promise<any[] | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/branches?per_page=30`)
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data) ? data.map((b: any) => ({ name: b.name, protected: b.protected, sha: b.commit?.sha?.slice(0, 7) })) : null
}

export async function listGitHubIssues(workspaceId: string, repo?: string, state: string = 'open', limit = 20): Promise<any[] | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/issues?state=${state}&per_page=${limit}`)
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data)
    ? data.filter((i: any) => !i.pull_request).map((i: any) => ({
        number: i.number, title: i.title, state: i.state,
        labels: (i.labels || []).map((l: any) => l.name),
        author: i.user?.login || '', created_at: i.created_at,
        url: i.html_url, body: i.body?.slice(0, 400)
      }))
    : null
}

export async function listGitHubPRs(workspaceId: string, repo?: string, state: string = 'open', limit = 20): Promise<any[] | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/pulls?state=${state}&per_page=${limit}`)
  if (!res.ok) return null
  const data = await res.json()
  return Array.isArray(data)
    ? data.map((p: any) => ({ number: p.number, title: p.title, state: p.state, author: p.user?.login || '', base: p.base?.ref, head: p.head?.ref, created_at: p.created_at, url: p.html_url, draft: p.draft, merged_at: p.merged_at }))
    : null
}

export async function searchGitHubCode(workspaceId: string, query: string, repo?: string): Promise<any[] | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = repo ? await resolveGitHubRepo(cfg.token, repo) : null
  const q = resolvedRepo ? `${query} repo:${resolvedRepo}` : query
  const res = await ghFetch(cfg.token, `/search/code?q=${encodeURIComponent(q)}&per_page=10`)
  if (!res.ok) return null
  const data = await res.json()
  return (data.items || []).map((i: any) => ({ path: i.path, repo: i.repository?.full_name, url: i.html_url, snippet: i.text_matches?.[0]?.fragment?.slice(0, 300) }))
}

export async function createGitHubIssue(workspaceId: string, title: string, body: string, labels?: string[], repo?: string): Promise<string | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/issues`, {
    method: 'POST',
    body: JSON.stringify({ title, body, labels: labels || [] })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.html_url
}

export async function updateGitHubIssue(workspaceId: string, issueNumber: number, updates: { title?: string; body?: string; state?: string; labels?: string[] }, repo?: string): Promise<string | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/issues/${issueNumber}`, {
    method: 'PATCH',
    body: JSON.stringify(updates)
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.html_url
}

export async function createOrUpdateGitHubFile(workspaceId: string, filePath: string, content: string, commitMessage: string, repo?: string): Promise<string | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const checkRes = await ghFetch(cfg.token, `/repos/${resolvedRepo}/contents/${filePath}`)
  const existingData = checkRes.ok ? await checkRes.json() : null
  const sha = existingData?.sha
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/contents/${filePath}`, {
    method: 'PUT',
    body: JSON.stringify({ message: commitMessage, content: Buffer.from(content).toString('base64'), ...(sha ? { sha } : {}) })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.content?.html_url || data.commit?.html_url || null
}

export async function deleteGitHubFile(workspaceId: string, filePath: string, commitMessage: string, repo?: string): Promise<boolean> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return false
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return false
  const fileRes = await ghFetch(cfg.token, `/repos/${resolvedRepo}/contents/${filePath}`)
  if (!fileRes.ok) return false
  const fileData = await fileRes.json()
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/contents/${filePath}`, {
    method: 'DELETE',
    body: JSON.stringify({ message: commitMessage, sha: fileData.sha })
  })
  return res.ok
}

export async function createGitHubPR(workspaceId: string, title: string, body: string, head: string, base = 'main', repo?: string): Promise<string | null> {
  const cfg = await getIntegration(workspaceId, 'github')
  if (!cfg?.token) return null
  const resolvedRepo = await resolveGitHubRepo(cfg.token, repo || cfg.repo)
  if (!resolvedRepo) return null
  const res = await ghFetch(cfg.token, `/repos/${resolvedRepo}/pulls`, {
    method: 'POST',
    body: JSON.stringify({ title, body, head, base })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.html_url
}

// Gmail
export async function sendGmail(workspaceId: string, to: string, subject: string, body: string): Promise<boolean> {
  const config = await getIntegration(workspaceId, 'gmail')
  if (!config?.sender_email || !config?.app_password) return false
  try {
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: config.sender_email, pass: config.app_password.replace(/\s/g, '') }
    })
    await transporter.sendMail({ from: config.sender_email, to, subject, text: body })
    return true
  } catch { return false }
}

// Google Calendar
export async function createCalendarEvent(workspaceId: string, summary: string, description?: string, startTime?: string): Promise<string | null> {
  const config = await getIntegration(workspaceId, 'google_calendar')
  if (!config?.webhook_url) return null
  let resolvedStart: Date
  if (!startTime || startTime.trim() === '') {
    resolvedStart = new Date(Date.now() + 86400000)
  } else if (/^tomorrow$/i.test(startTime.trim())) {
    const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); resolvedStart = d
  } else {
    const parsed = new Date(startTime)
    resolvedStart = isNaN(parsed.getTime()) ? new Date(Date.now() + 86400000) : parsed
  }
  const end = new Date(resolvedStart.getTime() + 3600000)
  const res = await fetch(config.webhook_url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'agentspace', summary, description: description || '', start: resolvedStart.toISOString(), end: end.toISOString() })
  })
  return res.ok ? 'created' : null
}

export async function triggerZapier(workspaceId: string, payload: Record<string, any>): Promise<boolean> {
  const config = await getIntegration(workspaceId, 'zapier')
  if (!config?.webhook_url) return false
  const res = await fetch(config.webhook_url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: 'agentspace', ...payload })
  })
  return res.ok
}

// Excel
export async function createExcelFile(workspaceId: string, filename: string, csvData: string, sheetName?: string): Promise<string | null> {
  try {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet(sheetName || 'Sheet1')
    const delimiter = csvData.includes('|') ? '|' : ','
    const lines = csvData.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return null
    const headers = lines[0].split(delimiter).map(h => h.trim())
    sheet.addRow(headers)
    const headerRow = sheet.getRow(1)
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headers.forEach((_, i) => {
      sheet.getColumn(i + 1).width = Math.max(headers[i].length + 4, ...lines.slice(1).map(l => (l.split(delimiter)[i] || '').trim().length + 2))
    })
    for (const line of lines.slice(1)) sheet.addRow(line.split(delimiter).map(v => v.trim()))
    const buffer = await workbook.xlsx.writeBuffer()
    const { useSupabaseAdmin } = await import('./supabase')
    const sb = supabaseAdmin()
    const safeFilename = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
    const storagePath = `${workspaceId}/${Date.now()}_${safeFilename}`
    await sb.storage.from('files').upload(storagePath, buffer as Buffer, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', upsert: false
    })
    await sb.from('files').insert({
      workspace_id: workspaceId, filename: safeFilename, storage_path: storagePath,
      mime_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      size_bytes: (buffer as Buffer).length, embedding_meta: { status: 'no_index', type: 'excel' }
    })
    const { data: urlData } = await sb.storage.from('files').createSignedUrl(storagePath, 3600)
    return urlData?.signedUrl || storagePath
  } catch { return null }
}

// Notion
export async function writeNotionPage(workspaceId: string, title: string, content: string): Promise<string | null> {
  const config = await getIntegration(workspaceId, 'notion')
  if (!config?.api_key || !config?.database_id) return null
  try {
    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${config.api_key}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        parent: { database_id: config.database_id },
        properties: { Name: { title: [{ text: { content: title } }] } },
        children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: content.slice(0, 2000) } }] } }]
      })
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.url || data.id || 'created'
  } catch { return null }
}

export async function appendNotionBlock(workspaceId: string, pageId: string, content: string): Promise<boolean> {
  const config = await getIntegration(workspaceId, 'notion')
  if (!config?.api_key) return false
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${config.api_key}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ children: [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: content.slice(0, 2000) } }] } }] })
    })
    return res.ok
  } catch { return false }
}