/**
 * Tool Executor — dispatches Anthropic tool_use calls to the actual integration functions.
 */

import { useSupabaseAdmin, supabaseAdmin } from './supabase'
import {
  sendSlack, sendGmail, createCalendarEvent,
  listGitHubUserRepos, listGitHubFiles, readGitHubFile,
  getGitHubCommits, getGitHubCommitDetail, listGitHubBranches,
  listGitHubIssues, listGitHubPRs, searchGitHubCode, getGitHubRepoInfo,
  createGitHubIssue, updateGitHubIssue, createOrUpdateGitHubFile, deleteGitHubFile, createGitHubPR,
  writeNotionPage, appendNotionBlock,
  triggerZapier, createExcelFile,
} from './integrations'

export interface ToolCall {
  id: string
  name: string
  input: Record<string, string>
}

export interface ToolResult {
  toolUseId: string
  toolName: string
  content: string
  isError: boolean
}

/**
 * Execute a batch of tool calls from an Anthropic tool_use response.
 * Returns results in the format Anthropic expects for the next turn.
 */
export async function executeTools(
  calls: ToolCall[],
  workspaceId: string
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  for (const call of calls) {
    let content = ''
    let isError = false

    try {
      content = await dispatch(call.name, call.input, workspaceId)
    } catch (err: any) {
      content = `Error executing ${call.name}: ${err.message || String(err)}`
      isError = true
    }

    results.push({ toolUseId: call.id, toolName: call.name, content, isError })
  }

  return results
}

async function dispatch(
  toolId: string,
  input: Record<string, string>,
  workspaceId: string
): Promise<string> {

  switch (toolId) {

    // ── Slack ────────────────────────────────────────────────────────────────
    case 'slack_post_message': {
      const ok = await sendSlack(workspaceId, input.message, input.channel)
      return ok
        ? ` Slack message posted to ${input.channel || 'default channel'}`
        : ` Failed to post Slack message. Check that the Slack webhook URL is correctly configured in Integrations.`
    }

    // ── Gmail ────────────────────────────────────────────────────────────────
    case 'gmail_send': {
      const ok = await sendGmail(workspaceId, input.to, input.subject, input.body)
      return ok
        ? ` Email sent to ${input.to} (subject: "${input.subject}")`
        : ` Failed to send email. Check Gmail address and app password in Integrations.`
    }

    // ── Google Calendar ───────────────────────────────────────────────────────
    case 'calendar_create_event': {
      const uid = await createCalendarEvent(workspaceId, input.summary, input.description, input.startTime)
      return uid
        ? ` Calendar event created: "${input.summary}"${input.startTime ? ` at ${input.startTime}` : ''}`
        : ` Failed to create calendar event. Verify the Make.com/Zapier webhook is active in Integrations.`
    }

    // ── GitHub READ ──────────────────────────────────────────────────────────
    case 'github_list_repos': {
      const repos = await listGitHubUserRepos(workspaceId)
      if (!repos) return ` Could not list GitHub repos. Check the token scope.`
      const list = repos.slice(0, 30).map(r =>
        `- **${r.full_name}**${r.private ? ' ' : ''} — ${r.language || 'unknown lang'}, ⭐${r.stars}${r.description ? ` — ${r.description}` : ''}`
      ).join('\n')
      return `📦 Found ${repos.length} GitHub repositories:\n\n${list}`
    }

    case 'github_repo_info': {
      const info = await getGitHubRepoInfo(workspaceId, input.repo)
      if (!info) return ` Could not get repo info. Check repo name and token.`
      return `📦 **${info.full_name}**\n${info.description || 'No description'}\n\n- Stars: ${info.stars} | Forks: ${info.forks} | Open issues: ${info.open_issues}\n- Default branch: \`${info.default_branch}\`\n- Languages: ${info.languages.join(', ') || 'unknown'}\n- Topics: ${info.topics.join(', ') || 'none'}\n- Last push: ${info.pushed_at}\n- URL: ${info.url}`
    }

    case 'github_list_files': {
      const result = await listGitHubFiles(workspaceId, input.path || '', input.repo, input.ref)
      if (!result) return ` Could not list files. Check the repo name, path, and token.`
      const list = result.files.map(f =>
        `${f.type === 'dir' ? '📁' : ''} ${f.name}${f.size ? ` (${f.size}b)` : ''}`
      ).join('\n')
      const pathLabel = input.path ? `/${input.path}` : '/ (root)'
      const refLabel = input.ref ? ` @ ${input.ref}` : ''
      return `📂 \`${result.repo}\`${pathLabel}${refLabel}:\n\n${list}`
    }

    case 'github_read_file': {
      const result = await readGitHubFile(workspaceId, input.filePath, input.repo, input.ref)
      if (!result) return ` Could not read file \`${input.filePath}\`. Check the path and token.`
      const preview = result.content.slice(0, 4000)
      const truncated = result.content.length > 4000 ? `\n\n_...truncated (${result.content.length} chars total)_` : ''
      return ` **${input.filePath}** from \`${result.repo}\`:\n\n\`\`\`\n${preview}\n\`\`\`${truncated}\n\n[View on GitHub](${result.url})`
    }

    case 'github_get_commits': {
      const commits = await getGitHubCommits(workspaceId, input.repo, input.branch, parseInt(input.limit || '20'))
      if (!commits) return ` Could not get commits. Check repo name and token.`
      if (commits.length === 0) return `No commits found.`
      const list = commits.map(c =>
        `- [\`${c.sha}\`](${c.url}) **${c.message.split('\n')[0].slice(0, 80)}** — ${c.author}, ${new Date(c.date).toLocaleDateString()}`
      ).join('\n')
      const branchLabel = input.branch ? ` (branch: ${input.branch})` : ''
      return `📜 Last ${commits.length} commits${branchLabel}:\n\n${list}`
    }

    case 'github_get_commit_detail': {
      const detail = await getGitHubCommitDetail(workspaceId, input.sha, input.repo)
      if (!detail) return ` Could not get commit details for SHA: ${input.sha}`
      const fileList = detail.files.slice(0, 15).map((f: any) =>
        `- **${f.filename}** (${f.status}) +${f.additions}/-${f.deletions}${f.patch ? '\n  ```\n  ' + f.patch.slice(0, 300) + '\n  ```' : ''}`
      ).join('\n')
      return `🔍 Commit \`${detail.sha}\`: **${detail.message.split('\n')[0]}**\n${detail.author} — ${new Date(detail.date).toLocaleDateString()}\n+${detail.additions}/-${detail.deletions} total\n\n**Files changed:**\n${fileList}\n\n[View on GitHub](${detail.url})`
    }

    case 'github_list_branches': {
      const branches = await listGitHubBranches(workspaceId, input.repo)
      if (!branches) return ` Could not list branches.`
      const list = branches.map(b => `- \`${b.name}\`${b.protected ? '  protected' : ''} (SHA: ${b.sha})`).join('\n')
      return `🌿 ${branches.length} branches:\n\n${list}`
    }

    case 'github_list_issues': {
      const issues = await listGitHubIssues(workspaceId, input.repo, input.state || 'open', parseInt(input.limit || '20'))
      if (!issues) return ` Could not list issues. Check repo and token.`
      if (issues.length === 0) return `No ${input.state || 'open'} issues found.`
      const list = issues.map(i =>
        `- **#${i.number} [${i.title}](${i.url})** (${i.state}) — @${i.author}${i.labels.length ? ` [${i.labels.join(', ')}]` : ''}`
      ).join('\n')
      return `🐛 ${issues.length} ${input.state || 'open'} issues:\n\n${list}`
    }

    case 'github_list_prs': {
      const prs = await listGitHubPRs(workspaceId, input.repo, input.state || 'open', parseInt(input.limit || '20'))
      if (!prs) return ` Could not list pull requests. Check repo and token.`
      if (prs.length === 0) return `No ${input.state || 'open'} pull requests found.`
      const list = prs.map(p =>
        `- **#${p.number} [${p.title}](${p.url})** (${p.state}${p.draft ? ', draft' : ''}) \`${p.head}\` → \`${p.base}\` — @${p.author}`
      ).join('\n')
      return `🔀 ${prs.length} ${input.state || 'open'} pull requests:\n\n${list}`
    }

    case 'github_search_code': {
      const results = await searchGitHubCode(workspaceId, input.query, input.repo)
      if (!results) return ` Code search failed. Check token has search scope.`
      if (results.length === 0) return `No code found matching: ${input.query}`
      const list = results.map(r => `- **${r.path}** in \`${r.repo}\` — [view](${r.url})${r.snippet ? '\n  > ' + r.snippet.replace(/\n/g, ' ') : ''}`).join('\n')
      return `🔍 Code search results for "${input.query}":\n\n${list}`
    }

    // ── GitHub WRITE ─────────────────────────────────────────────────────────
    case 'github_create_issue': {
      const labels = input.labels ? input.labels.split(',').map((l: string) => l.trim()) : []
      const url = await createGitHubIssue(workspaceId, input.title, input.body, labels, input.repo)
      return url
        ? ` GitHub issue created: [${input.title}](${url})`
        : ` Failed to create GitHub issue. Check token has Issues:write permission.`
    }

    case 'github_update_issue': {
      const updates: any = {}
      if (input.title) updates.title = input.title
      if (input.body) updates.body = input.body
      if (input.state) updates.state = input.state
      if (input.labels) updates.labels = input.labels.split(',').map((l: string) => l.trim())
      const url = await updateGitHubIssue(workspaceId, parseInt(input.issueNumber), updates, input.repo)
      return url
        ? ` Issue #${input.issueNumber} updated: [view](${url})`
        : ` Failed to update issue #${input.issueNumber}.`
    }

    case 'github_commit_file': {
      const url = await createOrUpdateGitHubFile(workspaceId, input.filePath, input.content, input.commitMessage, input.repo)
      return url
        ? ` File committed to GitHub: \`${input.filePath}\` — [view commit](${url})`
        : ` Failed to commit file. Check token has Contents:write permission.`
    }

    case 'github_delete_file': {
      const ok = await deleteGitHubFile(workspaceId, input.filePath, input.commitMessage, input.repo)
      return ok
        ? ` File deleted from GitHub: \`${input.filePath}\``
        : ` Failed to delete file. Check path and token permissions.`
    }

    case 'github_create_pr': {
      const url = await createGitHubPR(workspaceId, input.title, input.body, input.head, input.base || 'main', input.repo)
      return url
        ? ` Pull request created: [${input.title}](${url})`
        : ` Failed to create pull request. Ensure both branches exist and token has PR:write permission.`
    }

    // ── Notion ───────────────────────────────────────────────────────────────
    case 'notion_create_page': {
      const url = await writeNotionPage(workspaceId, input.title, input.content)
      return url
        ? ` Notion page created: "${input.title}"`
        : ` Failed to create Notion page. Check API key and database_id in Integrations.`
    }

    case 'notion_append_block': {
      const ok = await appendNotionBlock(workspaceId, input.pageId, input.content)
      return ok
        ? ` Content appended to Notion page ${input.pageId}`
        : ` Failed to append to Notion page.`
    }

    // ── Zapier ───────────────────────────────────────────────────────────────
    case 'zapier_trigger': {
      const ok = await triggerZapier(workspaceId, { event: input.event, data: input.data })
      return ok
        ? ` Zapier webhook triggered: event="${input.event}"`
        : ` Zapier webhook failed. Check the URL in Integrations.`
    }

    // ── Excel ────────────────────────────────────────────────────────────────
    case 'excel_create_file': {
      const url = await createExcelFile(workspaceId, input.filename || 'report', input.data || '', input.sheetName)
      return url
        ? ` Excel file created: [${input.filename || 'report'}.xlsx](${url})`
        : ` Failed to generate Excel file. Check the data format.`
    }

    // ── Jira ─────────────────────────────────────────────────────────────────
    case 'jira_create_issue': {
      const url = await jiraCreateIssue(workspaceId, input)
      return url
        ? ` Jira issue created: [${input.summary}](${url})`
        : ` Failed to create Jira issue. Check credentials in Integrations.`
    }

    case 'jira_list_issues': {
      const issues = await jiraListIssues(workspaceId, input.jql, parseInt(input.maxResults || '20'))
      if (!issues) return ` Failed to list Jira issues. Check credentials.`
      if (issues.length === 0) return ` No Jira issues found matching: ${input.jql}`
      const list = issues.map((i: any) => `- **[${i.key}](${i.url})** ${i.summary} (${i.status})`).join('\n')
      return ` Found ${issues.length} Jira issues:\n\n${list}`
    }

    // ── Linear ───────────────────────────────────────────────────────────────
    case 'linear_create_issue': {
      const url = await linearCreateIssue(workspaceId, input)
      return url
        ? ` Linear issue created: [${input.title}](${url})`
        : ` Failed to create Linear issue. Check API key in Integrations.`
    }

    case 'linear_list_issues': {
      const issues = await linearListIssues(workspaceId, input.teamId, input.state)
      if (!issues) return ` Failed to list Linear issues.`
      if (issues.length === 0) return ` No Linear issues found.`
      const list = issues.slice(0, 15).map((i: any) => `- **[${i.identifier}]** ${i.title} (${i.state}) — ${i.assignee || 'Unassigned'}`).join('\n')
      return ` Linear issues:\n\n${list}`
    }

    // ── HubSpot ───────────────────────────────────────────────────────────────
    case 'hubspot_create_contact': {
      const id = await hubspotCreateContact(workspaceId, input)
      return id
        ? ` HubSpot contact created: ${input.email} (ID: ${id})`
        : ` Failed to create HubSpot contact. Check access token.`
    }

    case 'hubspot_create_deal': {
      const id = await hubspotCreateDeal(workspaceId, input)
      return id
        ? ` HubSpot deal created: "${input.dealName}" (ID: ${id})`
        : ` Failed to create HubSpot deal.`
    }

    case 'hubspot_search_contacts': {
      const contacts = await hubspotSearchContacts(workspaceId, input.query)
      if (!contacts) return ` Failed to search HubSpot contacts.`
      if (contacts.length === 0) return ` No HubSpot contacts found matching: ${input.query}`
      const list = contacts.slice(0, 10).map((c: any) => `- ${c.firstname || ''} ${c.lastname || ''} <${c.email}>${c.company ? ` — ${c.company}` : ''}`).join('\n')
      return ` Found ${contacts.length} HubSpot contacts:\n\n${list}`
    }

    // ── Twilio ────────────────────────────────────────────────────────────────
    case 'twilio_send_sms': {
      const ok = await twilioSendSMS(workspaceId, input.to, input.message)
      return ok
        ? ` SMS sent to ${input.to}`
        : ` Failed to send SMS. Check Twilio credentials.`
    }

    // ── Stripe ────────────────────────────────────────────────────────────────
    case 'stripe_list_customers': {
      const customers = await stripeListCustomers(workspaceId, input.limit ? parseInt(input.limit) : 10, input.email)
      if (!customers) return ` Failed to list Stripe customers. Check secret key.`
      if (customers.length === 0) return ` No Stripe customers found.`
      const list = customers.map((c: any) => `- **${c.name || c.email}** <${c.email}> — ${c.currency?.toUpperCase() || 'USD'}`).join('\n')
      return ` ${customers.length} Stripe customers:\n\n${list}`
    }

    case 'stripe_get_revenue': {
      const summary = await stripeGetRevenue(workspaceId, parseInt(input.days || '30'))
      if (!summary) return ` Failed to get Stripe revenue. Check secret key.`
      return ` Stripe revenue (last ${input.days || 30} days):\n\n${summary}`
    }

    // ── Airtable ──────────────────────────────────────────────────────────────
    case 'airtable_create_record': {
      const id = await airtableCreateRecord(workspaceId, input.baseId, input.tableName, input.fields)
      return id
        ? ` Airtable record created in ${input.tableName} (ID: ${id})`
        : ` Failed to create Airtable record.`
    }

    case 'airtable_list_records': {
      const records = await airtableListRecords(workspaceId, input.baseId, input.tableName, input.filterFormula, parseInt(input.maxRecords || '20'))
      if (!records) return ` Failed to list Airtable records.`
      if (records.length === 0) return ` No records found in ${input.tableName}.`
      const list = records.slice(0, 15).map((r: any) =>
        `- [${r.id}] ${JSON.stringify(r.fields).slice(0, 120)}`
      ).join('\n')
      return ` ${records.length} records from ${input.tableName}:\n\n${list}`
    }

    // ── Asana ─────────────────────────────────────────────────────────────────
    case 'asana_create_task': {
      const url = await asanaCreateTask(workspaceId, input)
      return url
        ? ` Asana task created: [${input.name}](${url})`
        : ` Failed to create Asana task.`
    }

    // ── Trello ────────────────────────────────────────────────────────────────
    case 'trello_create_card': {
      const url = await trelloCreateCard(workspaceId, input)
      return url
        ? ` Trello card created: [${input.name}](${url})`
        : ` Failed to create Trello card.`
    }

    // ── Intercom ──────────────────────────────────────────────────────────────
    case 'intercom_send_message': {
      const ok = await intercomSendMessage(workspaceId, input.userId, input.message, input.subject)
      return ok
        ? ` Intercom message sent to ${input.userId}`
        : ` Failed to send Intercom message.`
    }

    // ── Zendesk ───────────────────────────────────────────────────────────────
    case 'zendesk_create_ticket': {
      const url = await zendeskCreateTicket(workspaceId, input)
      return url
        ? ` Zendesk ticket created: [${input.subject}](${url})`
        : ` Failed to create Zendesk ticket.`
    }

    // ── Vercel ────────────────────────────────────────────────────────────────
    case 'vercel_list_deployments': {
      const deployments = await vercelListDeployments(workspaceId, input.projectName, parseInt(input.limit || '10'))
      if (!deployments) return ` Failed to list Vercel deployments.`
      if (deployments.length === 0) return ` No Vercel deployments found.`
      const list = deployments.map((d: any) => `- **${d.name}** (${d.state}) ${d.url ? `→ ${d.url}` : ''} — ${new Date(d.createdAt).toLocaleDateString()}`).join('\n')
      return ` Vercel deployments:\n\n${list}`
    }

    case 'vercel_get_project': {
      const info = await vercelGetProject(workspaceId, input.projectName)
      if (!info) return ` Failed to get Vercel project info.`
      return ` Vercel project **${info.name}**:\n- Framework: ${info.framework || 'unknown'}\n- Latest deployment: ${info.latestDeployment || 'none'}\n- URL: ${info.url || 'N/A'}`
    }

    // ── PagerDuty ─────────────────────────────────────────────────────────────
    case 'pagerduty_create_incident': {
      const id = await pagerdutyCreateIncident(workspaceId, input)
      return id
        ? ` PagerDuty incident triggered: ${input.title} (ID: ${id})`
        : ` Failed to trigger PagerDuty incident.`
    }

    // ── Sentry ────────────────────────────────────────────────────────────────
    case 'sentry_list_issues': {
      const issues = await sentryListIssues(workspaceId, input.project, input.query, parseInt(input.limit || '10'))
      if (!issues) return ` Failed to list Sentry issues.`
      if (issues.length === 0) return ` No Sentry issues found.`
      const list = issues.map((i: any) => `- **${i.title}** (${i.level}) — ${i.culprit || ''} — ${i.count} events`).join('\n')
      return ` Sentry issues:\n\n${list}`
    }

    // ── Cloudflare ────────────────────────────────────────────────────────────
    case 'cloudflare_list_zones': {
      const zones = await cloudflareListZones(workspaceId)
      if (!zones) return ` Failed to list Cloudflare zones.`
      if (zones.length === 0) return ` No Cloudflare zones found.`
      const list = zones.map((z: any) => `- **${z.name}** (${z.status}) — ID: ${z.id}`).join('\n')
      return ` Cloudflare zones:\n\n${list}`
    }

    case 'cloudflare_purge_cache': {
      const ok = await cloudflarePurgeCache(workspaceId, input.zoneId, input.urls)
      return ok
        ? ` Cloudflare cache purged for zone ${input.zoneId}`
        : ` Failed to purge Cloudflare cache.`
    }

    // ── Web search ────────────────────────────────────────────────────────────
    case 'web_search': {
      return await webSearch(input.query, parseInt(input.numResults || '5'))
    }

    // ── Knowledge base vector search ──────────────────────────────────────────
    case 'search_knowledge': {
      return await searchKnowledge(workspaceId, input.query, parseInt(input.top_k || '5'))
    }

    default:
      return ` Unknown tool: ${toolId}`
  }
}

// ─── Integration implementations ──────────────────────────────────────────────

async function getConfig(workspaceId: string, type: string): Promise<any> {
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('integrations').select('config')
    .eq('workspace_id', workspaceId).eq('type', type).eq('status', 'connected').single()
  return data?.config || null
}

// Jira
async function jiraCreateIssue(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'jira')
  if (!cfg?.host || !cfg?.email || !cfg?.api_token) return null
  const auth = Buffer.from(`${cfg.email}:${cfg.api_token}`).toString('base64')
  const res = await fetch(`${cfg.host}/rest/api/3/issue`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      fields: {
        project: { key: cfg.project_key || 'PROJ' },
        summary: input.summary,
        description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: input.description || '' }] }] },
        issuetype: { name: input.issueType || 'Task' },
        priority: input.priority ? { name: input.priority } : undefined,
        labels: input.labels ? input.labels.split(',').map((l: string) => l.trim()) : undefined,
      }
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  return `${cfg.host}/browse/${data.key}`
}

async function jiraListIssues(workspaceId: string, jql: string, maxResults = 20): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'jira')
  if (!cfg?.host || !cfg?.email || !cfg?.api_token) return null
  const auth = Buffer.from(`${cfg.email}:${cfg.api_token}`).toString('base64')
  const res = await fetch(`${cfg.host}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`, {
    headers: { 'Authorization': `Basic ${auth}`, 'Accept': 'application/json' }
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.issues || []).map((i: any) => ({
    key: i.key, summary: i.fields.summary,
    status: i.fields.status?.name, url: `${cfg.host}/browse/${i.key}`
  }))
}

// Linear
async function linearCreateIssue(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'linear')
  if (!cfg?.api_key) return null
  const priorityMap: Record<string, number> = { urgent: 1, high: 2, medium: 3, low: 4, no_priority: 0 }
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': cfg.api_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation IssueCreate($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id url identifier } } }`,
      variables: {
        input: {
          title: input.title,
          description: input.description || '',
          priority: priorityMap[input.priority || 'medium'] ?? 3,
          teamId: input.teamId || cfg.team_id,
        }
      }
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data?.data?.issueCreate?.issue?.url || null
}

async function linearListIssues(workspaceId: string, teamId?: string, state?: string): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'linear')
  if (!cfg?.api_key) return null
  const filter = teamId || cfg.team_id
    ? `team: { id: { eq: "${teamId || cfg.team_id}" } }`
    : ''
  const res = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: { 'Authorization': cfg.api_key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `query { issues(first: 25, filter: { ${filter} }) { nodes { id identifier title state { name } assignee { name } url } } }`
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  const issues = data?.data?.issues?.nodes || []
  return state ? issues.filter((i: any) => i.state?.name?.toLowerCase().includes(state.toLowerCase())) : issues
}

// HubSpot
async function hubspotCreateContact(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'hubspot')
  if (!cfg?.access_token) return null
  const properties: Record<string, string> = { email: input.email }
  if (input.firstName) properties.firstname = input.firstName
  if (input.lastName) properties.lastname = input.lastName
  if (input.company) properties.company = input.company
  if (input.phone) properties.phone = input.phone
  if (input.notes) properties.notes = input.notes
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.id || null
}

async function hubspotCreateDeal(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'hubspot')
  if (!cfg?.access_token) return null
  const properties: Record<string, string> = { dealname: input.dealName }
  if (input.amount) properties.amount = input.amount
  if (input.stage) properties.dealstage = input.stage
  if (input.closeDate) properties.closedate = input.closeDate
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ properties })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.id || null
}

async function hubspotSearchContacts(workspaceId: string, query: string): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'hubspot')
  if (!cfg?.access_token) return null
  const res = await fetch('https://api.hubapi.com/crm/v3/objects/contacts/search', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      properties: ['email', 'firstname', 'lastname', 'company'],
      limit: 10
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  return (data.results || []).map((r: any) => r.properties)
}

// Twilio
async function twilioSendSMS(workspaceId: string, to: string, message: string): Promise<boolean> {
  const cfg = await getConfig(workspaceId, 'twilio')
  if (!cfg?.account_sid || !cfg?.auth_token || !cfg?.from_number) return false
  const auth = Buffer.from(`${cfg.account_sid}:${cfg.auth_token}`).toString('base64')
  const body = new URLSearchParams({ To: to, From: cfg.from_number, Body: message })
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${cfg.account_sid}/Messages.json`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
  return res.ok
}

// Stripe
async function stripeListCustomers(workspaceId: string, limit = 10, email?: string): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'stripe')
  if (!cfg?.secret_key) return null
  const params = new URLSearchParams({ limit: String(limit) })
  if (email) params.set('email', email)
  const res = await fetch(`https://api.stripe.com/v1/customers?${params}`, {
    headers: { 'Authorization': `Bearer ${cfg.secret_key}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data || null
}

async function stripeGetRevenue(workspaceId: string, days = 30): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'stripe')
  if (!cfg?.secret_key) return null
  const since = Math.floor((Date.now() - days * 86400000) / 1000)
  const res = await fetch(`https://api.stripe.com/v1/charges?created[gte]=${since}&limit=100`, {
    headers: { 'Authorization': `Bearer ${cfg.secret_key}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  const charges = data.data || []
  const total = charges.reduce((sum: number, c: any) => sum + (c.amount_captured || 0), 0) / 100
  const successful = charges.filter((c: any) => c.status === 'succeeded').length
  return `Total revenue: $${total.toLocaleString()} across ${successful} successful charges (last ${days} days)`
}

// Airtable
async function airtableCreateRecord(workspaceId: string, baseId: string, tableName: string, fieldsJson: string): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'airtable')
  if (!cfg?.api_key) return null
  let fields: Record<string, any>
  try { fields = JSON.parse(fieldsJson) } catch { return null }
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.api_key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.id || null
}

async function airtableListRecords(workspaceId: string, baseId: string, tableName: string, filterFormula?: string, maxRecords = 20): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'airtable')
  if (!cfg?.api_key) return null
  const params = new URLSearchParams({ maxRecords: String(maxRecords) })
  if (filterFormula) params.set('filterByFormula', filterFormula)
  const res = await fetch(`https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?${params}`, {
    headers: { 'Authorization': `Bearer ${cfg.api_key}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.records || null
}

// Asana
async function asanaCreateTask(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'asana')
  if (!cfg?.access_token) return null
  const body: Record<string, any> = { name: input.name }
  if (input.notes) body.notes = input.notes
  if (input.dueDate) body.due_on = input.dueDate
  if (input.assignee) body.assignee = input.assignee
  if (input.projectId || cfg.project_id) {
    body.projects = [input.projectId || cfg.project_id]
  }
  const res = await fetch('https://app.asana.com/api/1.0/tasks', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.access_token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ data: body })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.data?.permalink_url || data.data?.gid ? `https://app.asana.com/0/${input.projectId || '0'}/${data.data.gid}` : null
}

// Trello
async function trelloCreateCard(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'trello')
  if (!cfg?.api_key || !cfg?.token) return null
  const params = new URLSearchParams({
    key: cfg.api_key, token: cfg.token,
    name: input.name, idList: input.listId,
  })
  if (input.desc) params.set('desc', input.desc)
  if (input.due) params.set('due', input.due)
  const res = await fetch(`https://api.trello.com/1/cards?${params}`, { method: 'POST' })
  if (!res.ok) return null
  const data = await res.json()
  return data.url || null
}

// Intercom
async function intercomSendMessage(workspaceId: string, userId: string, message: string, subject?: string): Promise<boolean> {
  const cfg = await getConfig(workspaceId, 'intercom')
  if (!cfg?.access_token) return false
  const body: Record<string, any> = {
    message_type: 'inapp',
    body: message,
    from: { type: 'admin', id: 'me' },
    to: userId.includes('@') ? { type: 'user', email: userId } : { type: 'user', id: userId },
  }
  if (subject) { body.message_type = 'email'; body.subject = subject }
  const res = await fetch('https://api.intercom.io/messages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.access_token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.ok
}

// Zendesk
async function zendeskCreateTicket(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'zendesk')
  if (!cfg?.subdomain || !cfg?.email || !cfg?.api_token) return null
  const auth = Buffer.from(`${cfg.email}/token:${cfg.api_token}`).toString('base64')
  const ticket: Record<string, any> = {
    subject: input.subject,
    comment: { body: input.description },
    priority: input.priority || 'normal',
  }
  if (input.requesterEmail) ticket.requester = { email: input.requesterEmail }
  if (input.tags) ticket.tags = input.tags.split(',').map((t: string) => t.trim())
  const res = await fetch(`https://${cfg.subdomain}.zendesk.com/api/v2/tickets`, {
    method: 'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticket })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.ticket ? `https://${cfg.subdomain}.zendesk.com/agent/tickets/${data.ticket.id}` : null
}

// Vercel
async function vercelListDeployments(workspaceId: string, projectName?: string, limit = 10): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'vercel')
  if (!cfg?.token) return null
  const params = new URLSearchParams({ limit: String(limit) })
  if (projectName) params.set('projectId', projectName)
  if (cfg.team_id) params.set('teamId', cfg.team_id)
  const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
    headers: { 'Authorization': `Bearer ${cfg.token}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.deployments || null
}

async function vercelGetProject(workspaceId: string, projectName: string): Promise<any | null> {
  const cfg = await getConfig(workspaceId, 'vercel')
  if (!cfg?.token) return null
  const params = cfg.team_id ? `?teamId=${cfg.team_id}` : ''
  const res = await fetch(`https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}${params}`, {
    headers: { 'Authorization': `Bearer ${cfg.token}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    name: data.name,
    framework: data.framework,
    latestDeployment: data.latestDeployments?.[0]?.state || 'none',
    url: data.targets?.production?.url ? `https://${data.targets.production.url}` : null,
  }
}

// PagerDuty
async function pagerdutyCreateIncident(workspaceId: string, input: Record<string, string>): Promise<string | null> {
  const cfg = await getConfig(workspaceId, 'pagerduty')
  const routingKey = input.serviceKey || cfg?.routing_key
  if (!routingKey) return null
  const res = await fetch('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: routingKey,
      event_action: 'trigger',
      payload: {
        summary: input.title,
        severity: input.severity || 'critical',
        source: 'Atlantir',
        custom_details: { description: input.description || '' },
      }
    })
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.dedup_key || 'triggered'
}

// Sentry
async function sentryListIssues(workspaceId: string, project?: string, query?: string, limit = 10): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'sentry')
  if (!cfg?.auth_token || !cfg?.org_slug) return null
  const params = new URLSearchParams({ limit: String(limit) })
  if (query) params.set('query', query)
  if (project) params.set('project', project)
  const res = await fetch(`https://sentry.io/api/0/organizations/${cfg.org_slug}/issues/?${params}`, {
    headers: { 'Authorization': `Bearer ${cfg.auth_token}` }
  })
  if (!res.ok) return null
  return await res.json()
}

// Cloudflare
async function cloudflareListZones(workspaceId: string): Promise<any[] | null> {
  const cfg = await getConfig(workspaceId, 'cloudflare')
  if (!cfg?.api_token) return null
  const res = await fetch('https://api.cloudflare.com/client/v4/zones', {
    headers: { 'Authorization': `Bearer ${cfg.api_token}` }
  })
  if (!res.ok) return null
  const data = await res.json()
  return data.result || null
}

async function cloudflarePurgeCache(workspaceId: string, zoneId: string, urls?: string): Promise<boolean> {
  const cfg = await getConfig(workspaceId, 'cloudflare')
  if (!cfg?.api_token) return false
  const body = urls
    ? { files: urls.split(',').map((u: string) => u.trim()) }
    : { purge_everything: true }
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.api_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.ok
}

// Web search via OpenRouter's built-in search or Serper.dev fallback
async function webSearch(query: string, numResults = 5): Promise<string> {
  // Try Serper.dev if configured
  const serperKey = process.env.SERPER_API_KEY
  if (serperKey) {
    try {
      const res = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: query, num: numResults })
      })
      if (res.ok) {
        const data = await res.json()
        const results = (data.organic || []).slice(0, numResults)
        if (results.length > 0) {
          const formatted = results.map((r: any, i: number) =>
            `${i + 1}. **${r.title}**\n${r.snippet}\n${r.link}`
          ).join('\n\n')
          return ` Web search results for "${query}":\n\n${formatted}`
        }
      }
    } catch {}
  }

  // Fallback: return instructions for the agent to use its knowledge
  return `Web search for "${query}": No search API configured (set SERPER_API_KEY for live web search). Using training knowledge to answer.`
}

// ─── Vector knowledge base search ────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2 }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

async function embedText(text: string): Promise<number[] | null> {
  try {
    // Try Anthropic voyage embeddings first, fall back to OpenRouter
    const openrouterKey = process.env.OPENROUTER_API_KEY
    if (openrouterKey) {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openrouterKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai/text-embedding-3-small', input: [text] }),
      })
      if (res.ok) {
        const data = await res.json()
        const vec = data.data?.[0]?.embedding
        if (vec?.length) return vec
      }
    }
    return null
  } catch { return null }
}

async function searchKnowledge(workspaceId: string, query: string, topK = 5): Promise<string> {
  if (!query?.trim()) return '⚠ No query provided for knowledge search.'
  const clampedK = Math.min(Math.max(topK, 1), 10)

  try {
    const sb = supabaseAdmin()

    // 1. Try Supabase pgvector native similarity search if available
    //    (requires match_file_chunks RPC function in the DB)
    const queryVec = await embedText(query)
    if (queryVec) {
      // Try pgvector RPC first — much faster at scale
      const { data: rpcResults, error: rpcErr } = await sb.rpc('match_file_chunks', {
        query_embedding: queryVec,
        match_workspace_id: workspaceId,
        match_threshold: 0.65,
        match_count: clampedK,
      })

      if (!rpcErr && rpcResults?.length) {
        return formatKnowledgeResults(rpcResults, query)
      }

      // Fall back to client-side cosine if RPC not set up yet
      const { data: chunks } = await sb
        .from('file_chunks')
        .select('content, embedding, file_id')
        .eq('workspace_id', workspaceId)
        .not('embedding', 'is', null)
        .limit(400)

      if (chunks?.length) {
        const scored = chunks
          .map((c: any) => {
            try {
              const vec: number[] = typeof c.embedding === 'string' ? JSON.parse(c.embedding) : c.embedding
              if (!Array.isArray(vec) || vec.length < 2) return null
              return { content: c.content, score: cosineSimilarity(queryVec, vec) }
            } catch { return null }
          })
          .filter((c): c is { content: string; score: number } => c !== null && c.score > 0.62)
          .sort((a, b) => b.score - a.score)
          .slice(0, clampedK)

        if (scored.length) return formatKnowledgeResults(scored, query)
      }
    }

    // 2. Lexical BM25-style fallback using Postgres full-text search
    const { data: ftResults } = await sb
      .from('file_chunks')
      .select('content')
      .eq('workspace_id', workspaceId)
      .textSearch('content', query.trim().split(/\s+/).join(' & '), { type: 'plain' })
      .limit(clampedK)

    if (ftResults?.length) return formatKnowledgeResults(ftResults.map(r => ({ content: r.content, score: 1 })), query)

    // 3. Last resort — simple ilike keyword match
    const keywords = query.trim().split(/\s+/).filter(w => w.length > 3)
    if (keywords.length) {
      const { data: kwResults } = await sb
        .from('file_chunks')
        .select('content')
        .eq('workspace_id', workspaceId)
        .ilike('content', `%${keywords[0]}%`)
        .limit(clampedK)
      if (kwResults?.length) return formatKnowledgeResults(kwResults.map(r => ({ content: r.content, score: 0.5 })), query)
    }

    return `📚 No relevant documents found in the knowledge base for: "${query}". Try uploading relevant files in the Files section.`
  } catch (err: any) {
    return `⚠ Knowledge search error: ${err?.message || 'Unknown error'}`
  }
}

function formatKnowledgeResults(results: { content: string; score?: number }[], query: string): string {
  const passages = results.map((r, i) => {
    const score = r.score !== undefined ? ` (relevance: ${(r.score * 100).toFixed(0)}%)` : ''
    return `[${i + 1}]${score}\n${r.content.trim()}`
  }).join('\n\n---\n\n')
  return `📚 Knowledge base results for "${query}":\n\n${passages}`
}
