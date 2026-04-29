/**
 * Tool Registry — unified definition of every integration tool available to agents.
 *
 * Architecture inspired by Composio (1000+ structured tool definitions),
 * ACI.dev (intent-aware tool filtering), and Nango (per-workspace credential management).
 *
 * Each tool has:
 *   - id:          unique snake_case identifier
 *   - integration: which integration type it belongs to (maps to integrations table)
 *   - name:        human-readable label
 *   - description: what it does — written for LLM consumption, precise and unambiguous
 *   - inputSchema: JSON Schema for parameters passed by the LLM via tool_use
 */

export interface ToolDef {
  id: string
  integration: string
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}

export const TOOL_REGISTRY: ToolDef[] = [

  // ── Slack ──────────────────────────────────────────────────────────────────
  {
    id: 'slack_post_message',
    integration: 'slack',
    name: 'Post Slack message',
    description: 'Post a message to a Slack channel. Use for team updates, notifications, summaries, and alerts.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message text to post. Supports Slack markdown (*bold*, _italic_, `code`).' },
        channel: { type: 'string', description: 'Channel name including #, e.g. #general. Leave blank to use the configured default channel.' },
      },
      required: ['message'],
    },
  },

  // ── Gmail ──────────────────────────────────────────────────────────────────
  {
    id: 'gmail_send',
    integration: 'gmail',
    name: 'Send email via Gmail',
    description: 'Send an email from the configured Gmail account. Use for outreach, notifications, and follow-ups.',
    inputSchema: {
      type: 'object',
      properties: {
        to:      { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body:    { type: 'string', description: 'Full email body text. Plain text or simple HTML.' },
        cc:      { type: 'string', description: 'Optional CC email address.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  // ── Google Calendar ────────────────────────────────────────────────────────
  {
    id: 'calendar_create_event',
    integration: 'google_calendar',
    name: 'Create calendar event',
    description: 'Create a Google Calendar event via the configured Make.com/Zapier webhook.',
    inputSchema: {
      type: 'object',
      properties: {
        summary:     { type: 'string', description: 'Event title.' },
        description: { type: 'string', description: 'Event description or agenda.' },
        startTime:   { type: 'string', description: 'Start time as ISO 8601 string or "tomorrow". Examples: "2024-06-15T14:00:00", "tomorrow".' },
        endTime:     { type: 'string', description: 'End time as ISO 8601 string. If omitted, defaults to 1 hour after start.' },
        attendees:   { type: 'string', description: 'Comma-separated email addresses of attendees.' },
      },
      required: ['summary'],
    },
  },

  // ── GitHub ─────────────────────────────────────────────────────────────────
  {
    id: 'github_list_repos',
    integration: 'github',
    name: 'List GitHub repositories',
    description: 'List all GitHub repositories accessible with the configured token, sorted by most recently pushed.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    id: 'github_list_files',
    integration: 'github',
    name: 'List files in GitHub repo',
    description: 'List files and directories in a GitHub repository at a given path.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in "owner/repo" format. Leave blank to auto-detect from connected account.' },
        path: { type: 'string', description: 'Path within the repo, e.g. "src/components". Leave blank for root.' },
      },
    },
  },
  {
    id: 'github_create_issue',
    integration: 'github',
    name: 'Create GitHub issue',
    description: 'Create a new issue in a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        title:  { type: 'string', description: 'Issue title.' },
        body:   { type: 'string', description: 'Issue body — use markdown for formatting.' },
        labels: { type: 'string', description: 'Comma-separated label names, e.g. "bug,enhancement".' },
        repo:   { type: 'string', description: 'Repository in "owner/repo" format. Leave blank to use default.' },
      },
      required: ['title', 'body'],
    },
  },
  {
    id: 'github_commit_file',
    integration: 'github',
    name: 'Commit file to GitHub',
    description: 'Create or update a file in a GitHub repository with a commit.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath:      { type: 'string', description: 'File path within the repo, e.g. "docs/README.md".' },
        content:       { type: 'string', description: 'Full file content.' },
        commitMessage: { type: 'string', description: 'Git commit message.' },
        repo:          { type: 'string', description: 'Repository in "owner/repo" format. Leave blank to use default.' },
      },
      required: ['filePath', 'content', 'commitMessage'],
    },
  },
  {
    id: 'github_create_pr',
    integration: 'github',
    name: 'Create GitHub pull request',
    description: 'Create a pull request in a GitHub repository.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'PR title.' },
        body:  { type: 'string', description: 'PR description — use markdown.' },
        head:  { type: 'string', description: 'Head branch name (source).' },
        base:  { type: 'string', description: 'Base branch name (target), defaults to "main".' },
        repo:  { type: 'string', description: 'Repository in "owner/repo" format. Leave blank to use default.' },
      },
      required: ['title', 'body', 'head'],
    },
  },

  // ── Notion ─────────────────────────────────────────────────────────────────
  {
    id: 'notion_create_page',
    integration: 'notion',
    name: 'Create Notion page',
    description: 'Create a new page in the connected Notion database.',
    inputSchema: {
      type: 'object',
      properties: {
        title:   { type: 'string', description: 'Page title.' },
        content: { type: 'string', description: 'Page content in plain text or markdown.' },
      },
      required: ['title', 'content'],
    },
  },
  {
    id: 'notion_append_block',
    integration: 'notion',
    name: 'Append to Notion page',
    description: 'Append content blocks to an existing Notion page by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        pageId:  { type: 'string', description: 'Notion page ID.' },
        content: { type: 'string', description: 'Text content to append.' },
      },
      required: ['pageId', 'content'],
    },
  },

  // ── Zapier ─────────────────────────────────────────────────────────────────
  {
    id: 'zapier_trigger',
    integration: 'zapier',
    name: 'Trigger Zapier webhook',
    description: 'Send a payload to the connected Zapier webhook, triggering any connected automation.',
    inputSchema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: 'Event name describing what happened.' },
        data:  { type: 'string', description: 'JSON string or plain text payload to send with the event.' },
      },
      required: ['event'],
    },
  },

  // ── Excel ──────────────────────────────────────────────────────────────────
  {
    id: 'excel_create_file',
    integration: 'excel',
    name: 'Create Excel spreadsheet',
    description: 'Generate a formatted .xlsx file and upload it. Always available — no external connection needed.',
    inputSchema: {
      type: 'object',
      properties: {
        filename:  { type: 'string', description: 'Filename without extension, e.g. "Q2_Report".' },
        sheetName: { type: 'string', description: 'Sheet tab name. Defaults to "Sheet1".' },
        data:      { type: 'string', description: 'CSV-formatted data. First line = column headers. Remaining lines = data rows. Use comma as delimiter.' },
      },
      required: ['filename', 'data'],
    },
  },

  // ── Jira ───────────────────────────────────────────────────────────────────
  {
    id: 'jira_create_issue',
    integration: 'jira',
    name: 'Create Jira issue',
    description: 'Create a new issue (story, bug, task) in Jira.',
    inputSchema: {
      type: 'object',
      properties: {
        summary:     { type: 'string', description: 'Issue summary/title.' },
        description: { type: 'string', description: 'Detailed issue description.' },
        issueType:   { type: 'string', description: 'Issue type: Story, Bug, Task, or Epic.', enum: ['Story', 'Bug', 'Task', 'Epic'] },
        priority:    { type: 'string', description: 'Priority: Highest, High, Medium, Low, Lowest.', enum: ['Highest', 'High', 'Medium', 'Low', 'Lowest'] },
        labels:      { type: 'string', description: 'Comma-separated label names.' },
      },
      required: ['summary', 'description'],
    },
  },
  {
    id: 'jira_list_issues',
    integration: 'jira',
    name: 'List Jira issues',
    description: 'Search and list Jira issues using a JQL query.',
    inputSchema: {
      type: 'object',
      properties: {
        jql:     { type: 'string', description: 'JQL query, e.g. "project = PROJ AND status = Open".' },
        maxResults: { type: 'string', description: 'Maximum number of results, defaults to 20.' },
      },
      required: ['jql'],
    },
  },

  // ── Linear ─────────────────────────────────────────────────────────────────
  {
    id: 'linear_create_issue',
    integration: 'linear',
    name: 'Create Linear issue',
    description: 'Create a new issue in a Linear team.',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Issue title.' },
        description: { type: 'string', description: 'Issue description in markdown.' },
        priority:    { type: 'string', description: 'Priority: urgent, high, medium, low, no_priority.', enum: ['urgent', 'high', 'medium', 'low', 'no_priority'] },
        teamId:      { type: 'string', description: 'Linear team ID or name. Leave blank to use default.' },
      },
      required: ['title'],
    },
  },
  {
    id: 'linear_list_issues',
    integration: 'linear',
    name: 'List Linear issues',
    description: 'List open issues in a Linear team.',
    inputSchema: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID or name. Leave blank for all teams.' },
        state:  { type: 'string', description: 'Filter by state: Todo, In Progress, Done, Cancelled.' },
      },
    },
  },

  // ── HubSpot ────────────────────────────────────────────────────────────────
  {
    id: 'hubspot_create_contact',
    integration: 'hubspot',
    name: 'Create HubSpot contact',
    description: 'Create a new contact record in HubSpot CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        email:     { type: 'string', description: 'Contact email address.' },
        firstName: { type: 'string', description: 'First name.' },
        lastName:  { type: 'string', description: 'Last name.' },
        company:   { type: 'string', description: 'Company name.' },
        phone:     { type: 'string', description: 'Phone number.' },
        notes:     { type: 'string', description: 'Notes about this contact.' },
      },
      required: ['email'],
    },
  },
  {
    id: 'hubspot_create_deal',
    integration: 'hubspot',
    name: 'Create HubSpot deal',
    description: 'Create a new deal in HubSpot CRM pipeline.',
    inputSchema: {
      type: 'object',
      properties: {
        dealName:   { type: 'string', description: 'Deal name.' },
        amount:     { type: 'string', description: 'Deal value as a number.' },
        stage:      { type: 'string', description: 'Deal stage, e.g. "appointmentscheduled", "qualifiedtobuy".' },
        closeDate:  { type: 'string', description: 'Expected close date as ISO 8601.' },
        contactEmail: { type: 'string', description: 'Email of associated contact.' },
      },
      required: ['dealName'],
    },
  },
  {
    id: 'hubspot_search_contacts',
    integration: 'hubspot',
    name: 'Search HubSpot contacts',
    description: 'Search for contacts in HubSpot by email, name, or company.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — email, name, or company.' },
      },
      required: ['query'],
    },
  },

  // ── Twilio ─────────────────────────────────────────────────────────────────
  {
    id: 'twilio_send_sms',
    integration: 'twilio',
    name: 'Send SMS via Twilio',
    description: 'Send an SMS message to a phone number using Twilio.',
    inputSchema: {
      type: 'object',
      properties: {
        to:      { type: 'string', description: 'Recipient phone number in E.164 format, e.g. +1234567890.' },
        message: { type: 'string', description: 'SMS message body (max 160 characters for single segment).' },
      },
      required: ['to', 'message'],
    },
  },

  // ── Stripe ─────────────────────────────────────────────────────────────────
  {
    id: 'stripe_list_customers',
    integration: 'stripe',
    name: 'List Stripe customers',
    description: 'List recent Stripe customers with their payment info.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'string', description: 'Number of customers to return (default 10, max 100).' },
        email: { type: 'string', description: 'Filter by email address.' },
      },
    },
  },
  {
    id: 'stripe_get_revenue',
    integration: 'stripe',
    name: 'Get Stripe revenue summary',
    description: 'Get a revenue summary from Stripe including recent charges and subscriptions.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'string', description: 'Number of past days to summarize (default 30).' },
      },
    },
  },

  // ── Airtable ───────────────────────────────────────────────────────────────
  {
    id: 'airtable_create_record',
    integration: 'airtable',
    name: 'Create Airtable record',
    description: 'Create a new record in an Airtable base and table.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId:    { type: 'string', description: 'Airtable base ID (from base URL).' },
        tableName: { type: 'string', description: 'Table name.' },
        fields:    { type: 'string', description: 'JSON object of field names and values, e.g. {"Name": "Alice", "Status": "Active"}.' },
      },
      required: ['baseId', 'tableName', 'fields'],
    },
  },
  {
    id: 'airtable_list_records',
    integration: 'airtable',
    name: 'List Airtable records',
    description: 'List records from an Airtable table with optional filtering.',
    inputSchema: {
      type: 'object',
      properties: {
        baseId:      { type: 'string', description: 'Airtable base ID.' },
        tableName:   { type: 'string', description: 'Table name.' },
        filterFormula: { type: 'string', description: 'Airtable filter formula, e.g. "{Status}=\'Active\'".' },
        maxRecords:  { type: 'string', description: 'Max records to return (default 20).' },
      },
      required: ['baseId', 'tableName'],
    },
  },

  // ── Asana ──────────────────────────────────────────────────────────────────
  {
    id: 'asana_create_task',
    integration: 'asana',
    name: 'Create Asana task',
    description: 'Create a new task in an Asana project.',
    inputSchema: {
      type: 'object',
      properties: {
        name:      { type: 'string', description: 'Task name.' },
        notes:     { type: 'string', description: 'Task description/notes.' },
        projectId: { type: 'string', description: 'Asana project ID. Leave blank to use default.' },
        dueDate:   { type: 'string', description: 'Due date as YYYY-MM-DD.' },
        assignee:  { type: 'string', description: 'Assignee email or user GID.' },
      },
      required: ['name'],
    },
  },

  // ── Trello ─────────────────────────────────────────────────────────────────
  {
    id: 'trello_create_card',
    integration: 'trello',
    name: 'Create Trello card',
    description: 'Create a new card in a Trello list.',
    inputSchema: {
      type: 'object',
      properties: {
        name:   { type: 'string', description: 'Card name/title.' },
        desc:   { type: 'string', description: 'Card description.' },
        listId: { type: 'string', description: 'Trello list ID to add the card to.' },
        due:    { type: 'string', description: 'Due date as ISO 8601.' },
        labels: { type: 'string', description: 'Comma-separated label colors: red, orange, yellow, green, blue, purple.' },
      },
      required: ['name', 'listId'],
    },
  },

  // ── Intercom ───────────────────────────────────────────────────────────────
  {
    id: 'intercom_send_message',
    integration: 'intercom',
    name: 'Send Intercom message',
    description: 'Send a message to a user via Intercom.',
    inputSchema: {
      type: 'object',
      properties: {
        userId:  { type: 'string', description: 'Intercom user ID or email.' },
        message: { type: 'string', description: 'Message to send.' },
        subject: { type: 'string', description: 'Subject line (for email messages).' },
      },
      required: ['userId', 'message'],
    },
  },

  // ── Zendesk ────────────────────────────────────────────────────────────────
  {
    id: 'zendesk_create_ticket',
    integration: 'zendesk',
    name: 'Create Zendesk ticket',
    description: 'Create a support ticket in Zendesk.',
    inputSchema: {
      type: 'object',
      properties: {
        subject:     { type: 'string', description: 'Ticket subject.' },
        description: { type: 'string', description: 'Ticket description/body.' },
        priority:    { type: 'string', description: 'Ticket priority: urgent, high, normal, low.', enum: ['urgent', 'high', 'normal', 'low'] },
        requesterEmail: { type: 'string', description: 'Requester email address.' },
        tags:        { type: 'string', description: 'Comma-separated tags.' },
      },
      required: ['subject', 'description'],
    },
  },

  // ── Vercel ─────────────────────────────────────────────────────────────────
  {
    id: 'vercel_list_deployments',
    integration: 'vercel',
    name: 'List Vercel deployments',
    description: 'List recent Vercel deployments for a project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Project name. Leave blank for all projects.' },
        limit:       { type: 'string', description: 'Number of deployments to return (default 10).' },
      },
    },
  },
  {
    id: 'vercel_get_project',
    integration: 'vercel',
    name: 'Get Vercel project info',
    description: 'Get details about a Vercel project including latest deployment status.',
    inputSchema: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Vercel project name or ID.' },
      },
      required: ['projectName'],
    },
  },

  // ── PagerDuty ──────────────────────────────────────────────────────────────
  {
    id: 'pagerduty_create_incident',
    integration: 'pagerduty',
    name: 'Create PagerDuty incident',
    description: 'Trigger a new incident in PagerDuty.',
    inputSchema: {
      type: 'object',
      properties: {
        title:       { type: 'string', description: 'Incident title.' },
        description: { type: 'string', description: 'Incident details.' },
        severity:    { type: 'string', description: 'Severity: critical, error, warning, info.', enum: ['critical', 'error', 'warning', 'info'] },
        serviceKey:  { type: 'string', description: 'PagerDuty service integration key. Leave blank to use default.' },
      },
      required: ['title'],
    },
  },

  // ── Sentry ─────────────────────────────────────────────────────────────────
  {
    id: 'sentry_list_issues',
    integration: 'sentry',
    name: 'List Sentry issues',
    description: 'List recent error issues from Sentry.',
    inputSchema: {
      type: 'object',
      properties: {
        project:  { type: 'string', description: 'Sentry project slug. Leave blank for all projects.' },
        query:    { type: 'string', description: 'Search query, e.g. "is:unresolved level:error".' },
        limit:    { type: 'string', description: 'Number of issues (default 10).' },
      },
    },
  },

  // ── Cloudflare ─────────────────────────────────────────────────────────────
  {
    id: 'cloudflare_list_zones',
    integration: 'cloudflare',
    name: 'List Cloudflare zones',
    description: 'List Cloudflare zones (domains) in the account.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    id: 'cloudflare_purge_cache',
    integration: 'cloudflare',
    name: 'Purge Cloudflare cache',
    description: 'Purge cached content for a Cloudflare zone.',
    inputSchema: {
      type: 'object',
      properties: {
        zoneId: { type: 'string', description: 'Cloudflare zone ID.' },
        urls:   { type: 'string', description: 'Comma-separated URLs to purge. Leave blank to purge everything.' },
      },
      required: ['zoneId'],
    },
  },

  // ── Web search (always available) ─────────────────────────────────────────
  {
    id: 'web_search',
    integration: 'web_search',
    name: 'Search the web',
    description: 'Search the internet for current information, news, and facts. Always available — no connection needed.',
    inputSchema: {
      type: 'object',
      properties: {
        query:   { type: 'string', description: 'Search query.' },
        numResults: { type: 'string', description: 'Number of results (default 5).' },
      },
      required: ['query'],
    },
  },

  // ── Knowledge base (always available) ─────────────────────────────────────
  {
    id: 'search_knowledge',
    integration: 'knowledge_base',
    name: 'Search workspace knowledge base',
    description: 'Semantically search documents, files, and notes uploaded to the workspace knowledge base. Use this whenever the task requires internal company information, documentation, past reports, contracts, SOPs, or any uploaded files. Returns the most relevant passages ranked by semantic similarity.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language question or topic to search for in the knowledge base.' },
        top_k: { type: 'string', description: 'Number of results to return (default 5, max 10).' },
      },
      required: ['query'],
    },
  },
]

/** Return tools for a given integration type */
export function getToolsForIntegration(integration: string): ToolDef[] {
  return TOOL_REGISTRY.filter(t => t.integration === integration)
}

/** Get connected tools for a workspace — filters registry to only connected integrations.
 *  Always includes web_search and excel (no connection needed). */
export async function getConnectedTools(workspaceId: string): Promise<ToolDef[]> {
  const { useSupabaseAdmin } = await import('./supabase')
  const sb = supabaseAdmin()
  const { data } = await sb
    .from('integrations')
    .select('type')
    .eq('workspace_id', workspaceId)
    .eq('status', 'connected')

  const connectedTypes = new Set([
    'web_search',
    'excel',
    'knowledge_base',   // always available — searches uploaded workspace files
    ...(data || []).map((i: any) => i.type)
  ])

  return TOOL_REGISTRY.filter(t => connectedTypes.has(t.integration))
}

/** Convert a ToolDef to Anthropic tool_use format */
export function toAnthropicTool(tool: ToolDef): { name: string; description: string; input_schema: object } {
  return {
    name: tool.id,
    description: tool.description,
    input_schema: tool.inputSchema,
  }
}

/** All integration display metadata for the UI */
export const INTEGRATION_META: Record<string, {
  name: string
  desc: string
  category: string
  color: string
  fields: { key: string; label: string; placeholder: string; secret?: boolean; hint?: string }[]
  steps: { title: string; body: string }[]
}> = {
  slack: {
    name: 'Slack', desc: 'Post messages and summaries to Slack channels.',
    category: 'Communication', color: '#4a154b',
    fields: [
      { key: 'webhook_url', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/…', secret: true, hint: 'From Slack App → Incoming Webhooks' },
      { key: 'channel', label: 'Default channel', placeholder: '#general' },
    ],
    steps: [
      { title: 'Go to Slack API Apps', body: 'Visit <a href="https://api.slack.com/apps" target="_blank">api.slack.com/apps</a> and click <b>Create New App → From scratch</b>.' },
      { title: 'Enable Incoming Webhooks', body: 'In the sidebar go to <b>Incoming Webhooks</b> and toggle it on.' },
      { title: 'Create a webhook URL', body: 'Click <b>Add New Webhook to Workspace</b>, choose a channel, and approve.' },
      { title: 'Copy and paste', body: 'Copy the URL starting with <b>https://hooks.slack.com/services/…</b> and paste it below.' },
    ],
  },
  gmail: {
    name: 'Gmail', desc: 'Send emails from your Gmail account.',
    category: 'Communication', color: '#ea4335',
    fields: [
      { key: 'sender_email', label: 'Gmail address', placeholder: 'you@gmail.com' },
      { key: 'app_password', label: 'App password', placeholder: 'xxxx xxxx xxxx xxxx', secret: true, hint: 'From myaccount.google.com/apppasswords' },
    ],
    steps: [
      { title: 'Enable 2-Step Verification', body: 'Go to <a href="https://myaccount.google.com/security" target="_blank">myaccount.google.com/security</a> and enable it.' },
      { title: 'Generate App Password', body: 'Go to <a href="https://myaccount.google.com/apppasswords" target="_blank">myaccount.google.com/apppasswords</a>. Select Mail → Other, generate and copy the 16-character password.' },
    ],
  },
  google_calendar: {
    name: 'Google Calendar', desc: 'Create calendar events automatically.',
    category: 'Productivity', color: '#4285f4',
    fields: [{ key: 'webhook_url', label: 'Make.com webhook URL', placeholder: 'https://hook.make.com/…', secret: true }],
    steps: [
      { title: 'Go to Make.com', body: 'Create a scenario with a <b>Webhooks → Custom webhook</b> trigger and Google Calendar action.' },
      { title: 'Connect Google', body: 'Click the Google Calendar module and sign in.' },
      { title: 'Copy webhook URL', body: 'Copy the webhook URL and paste below, then turn the scenario On.' },
    ],
  },
  github: {
    name: 'GitHub', desc: 'Create issues, commit files, and manage repos.',
    category: 'Development', color: '#24292e',
    fields: [
      { key: 'token', label: 'Personal access token', placeholder: 'github_pat_…', secret: true, hint: 'Settings → Developer settings → Fine-grained tokens' },
      { key: 'repo', label: 'Default repository', placeholder: 'owner/repo-name', hint: 'Optional — agents auto-detect if blank' },
    ],
    steps: [
      { title: 'Open GitHub token settings', body: 'Go to <b>Settings → Developer settings → Fine-grained tokens</b>.' },
      { title: 'Set permissions', body: 'Under Repository permissions, set <b>Issues</b>, <b>Pull requests</b>, and <b>Contents</b> to <b>Read & write</b>.' },
      { title: 'Copy the token', body: 'Copy the token (starts with <b>github_pat_</b>) and paste below.' },
    ],
  },
  notion: {
    name: 'Notion', desc: 'Write research and docs to Notion pages.',
    category: 'Productivity', color: '#1a1a1a',
    fields: [
      { key: 'api_key', label: 'Integration token', placeholder: 'secret_…', secret: true },
      { key: 'database_id', label: 'Database ID', placeholder: 'Paste from your Notion page URL' },
    ],
    steps: [
      { title: 'Create a Notion integration', body: 'Go to <a href="https://www.notion.so/my-integrations" target="_blank">notion.so/my-integrations</a> and click <b>+ New integration</b>.' },
      { title: 'Copy the token', body: 'Copy the <b>Internal Integration Token</b> starting with <b>secret_…</b>.' },
      { title: 'Share your database', body: 'Open your Notion database, click <b>Share</b>, invite your integration.' },
    ],
  },
  zapier: {
    name: 'Zapier', desc: 'Trigger any automation via Zapier webhooks.',
    category: 'Automation', color: '#ff4a00',
    fields: [{ key: 'webhook_url', label: 'Zapier webhook URL', placeholder: 'https://hooks.zapier.com/hooks/catch/…' }],
    steps: [
      { title: 'Create a Zap', body: 'Go to <a href="https://zapier.com" target="_blank">zapier.com</a> → Create Zap → <b>Webhooks → Catch Hook</b> as trigger.' },
      { title: 'Copy webhook URL', body: 'Zapier generates a URL starting with <b>hooks.zapier.com</b> — copy it.' },
      { title: 'Set up your action', body: 'Add your desired action app and publish the Zap.' },
    ],
  },
  jira: {
    name: 'Jira', desc: 'Create and manage Jira issues from agent tasks.',
    category: 'Development', color: '#0052cc',
    fields: [
      { key: 'host', label: 'Jira instance URL', placeholder: 'https://yourcompany.atlassian.net' },
      { key: 'email', label: 'Account email', placeholder: 'you@company.com' },
      { key: 'api_token', label: 'API token', placeholder: 'Paste from id.atlassian.com', secret: true },
      { key: 'project_key', label: 'Default project key', placeholder: 'PROJ', hint: 'The short key shown in issue IDs like PROJ-123' },
    ],
    steps: [
      { title: 'Go to Atlassian account settings', body: 'Visit <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank">id.atlassian.com</a> → Security → API tokens.' },
      { title: 'Create an API token', body: 'Click <b>Create API token</b>, give it a label, and copy the token.' },
      { title: 'Find your project key', body: 'Open Jira → your project. The key is the prefix in issue IDs (e.g. "PROJ" in PROJ-42).' },
    ],
  },
  linear: {
    name: 'Linear', desc: 'Create and track Linear issues.',
    category: 'Development', color: '#5e6ad2',
    fields: [
      { key: 'api_key', label: 'API key', placeholder: 'lin_api_…', secret: true, hint: 'From Linear Settings → API' },
      { key: 'team_id', label: 'Default team ID', placeholder: 'Paste team ID from Linear URL', hint: 'Optional' },
    ],
    steps: [
      { title: 'Get your Linear API key', body: 'In Linear go to <b>Settings → API → Personal API keys</b> and create a key.' },
      { title: 'Find your team ID', body: 'Go to your team in Linear. The team ID is in the URL: linear.app/org/<b>team-id</b>/issues.' },
    ],
  },
  hubspot: {
    name: 'HubSpot', desc: 'Manage contacts and deals in HubSpot CRM.',
    category: 'CRM', color: '#ff7a59',
    fields: [
      { key: 'access_token', label: 'Private app access token', placeholder: 'pat-na1-…', secret: true },
    ],
    steps: [
      { title: 'Create a HubSpot private app', body: 'In HubSpot go to <b>Settings → Integrations → Private Apps</b> and create a new app.' },
      { title: 'Set scopes', body: 'Enable scopes for <b>crm.objects.contacts</b> and <b>crm.objects.deals</b> (read + write).' },
      { title: 'Copy the access token', body: 'Copy the token starting with <b>pat-</b> and paste it below.' },
    ],
  },
  twilio: {
    name: 'Twilio', desc: 'Send SMS messages via Twilio.',
    category: 'Communication', color: '#f22f46',
    fields: [
      { key: 'account_sid', label: 'Account SID', placeholder: 'ACxxxx…', hint: 'From Twilio Console Dashboard' },
      { key: 'auth_token', label: 'Auth token', placeholder: '…', secret: true },
      { key: 'from_number', label: 'From phone number', placeholder: '+1234567890', hint: 'Your Twilio number in E.164 format' },
    ],
    steps: [
      { title: 'Get your credentials', body: 'Log in to <a href="https://console.twilio.com" target="_blank">console.twilio.com</a>. Find your Account SID and Auth Token on the dashboard.' },
      { title: 'Get a Twilio number', body: 'If you don\'t have one, buy a phone number in the Console under Phone Numbers.' },
    ],
  },
  stripe: {
    name: 'Stripe', desc: 'Query customers, revenue, and payments.',
    category: 'Finance', color: '#635bff',
    fields: [
      { key: 'secret_key', label: 'Secret key', placeholder: 'sk_live_… or sk_test_…', secret: true, hint: 'From Stripe Dashboard → Developers → API keys' },
    ],
    steps: [
      { title: 'Get your API key', body: 'Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank">dashboard.stripe.com/apikeys</a> and copy your <b>Secret key</b>.' },
    ],
  },
  airtable: {
    name: 'Airtable', desc: 'Create and query records in Airtable bases.',
    category: 'Productivity', color: '#18bfff',
    fields: [
      { key: 'api_key', label: 'Personal access token', placeholder: 'pat…', secret: true, hint: 'From airtable.com/create/tokens' },
    ],
    steps: [
      { title: 'Create a personal access token', body: 'Go to <a href="https://airtable.com/create/tokens" target="_blank">airtable.com/create/tokens</a>, create a token with <b>data.records:read</b> and <b>data.records:write</b> scopes.' },
    ],
  },
  asana: {
    name: 'Asana', desc: 'Create and assign tasks in Asana projects.',
    category: 'Productivity', color: '#fc636b',
    fields: [
      { key: 'access_token', label: 'Personal access token', placeholder: '1/…', secret: true, hint: 'From app.asana.com/0/developer-console' },
      { key: 'project_id', label: 'Default project ID', placeholder: 'From Asana project URL', hint: 'Optional' },
    ],
    steps: [
      { title: 'Get your token', body: 'Go to <a href="https://app.asana.com/0/developer-console" target="_blank">app.asana.com/0/developer-console</a> and create a personal access token.' },
    ],
  },
  trello: {
    name: 'Trello', desc: 'Create cards in Trello boards.',
    category: 'Productivity', color: '#0052cc',
    fields: [
      { key: 'api_key', label: 'API key', placeholder: '…', hint: 'From trello.com/app-key' },
      { key: 'token', label: 'Token', placeholder: '…', secret: true },
    ],
    steps: [
      { title: 'Get API key and token', body: 'Go to <a href="https://trello.com/app-key" target="_blank">trello.com/app-key</a> to get your API key, then click the token link to generate a token.' },
    ],
  },
  intercom: {
    name: 'Intercom', desc: 'Message users via Intercom.',
    category: 'Support', color: '#286efa',
    fields: [
      { key: 'access_token', label: 'Access token', placeholder: 'dG9rZ…', secret: true, hint: 'From Intercom Developer Hub → Your App → Authentication' },
    ],
    steps: [
      { title: 'Create an Intercom app', body: 'Go to <a href="https://developers.intercom.com" target="_blank">developers.intercom.com</a>, create an app, and copy the Access Token.' },
    ],
  },
  zendesk: {
    name: 'Zendesk', desc: 'Create support tickets in Zendesk.',
    category: 'Support', color: '#03363d',
    fields: [
      { key: 'subdomain', label: 'Zendesk subdomain', placeholder: 'yourcompany', hint: 'From yourcompany.zendesk.com' },
      { key: 'email', label: 'Agent email', placeholder: 'you@company.com' },
      { key: 'api_token', label: 'API token', placeholder: '…', secret: true, hint: 'From Admin → Apps & Integrations → APIs' },
    ],
    steps: [
      { title: 'Get your API token', body: 'In Zendesk Admin Center go to <b>Apps and Integrations → APIs → Zendesk API</b> and create a token.' },
    ],
  },
  vercel: {
    name: 'Vercel', desc: 'Monitor deployments and project status.',
    category: 'Development', color: '#000000',
    fields: [
      { key: 'token', label: 'Access token', placeholder: '…', secret: true, hint: 'From vercel.com/account/tokens' },
      { key: 'team_id', label: 'Team ID', placeholder: 'team_…', hint: 'Optional — for team accounts' },
    ],
    steps: [
      { title: 'Create a Vercel token', body: 'Go to <a href="https://vercel.com/account/tokens" target="_blank">vercel.com/account/tokens</a> and create a new token.' },
    ],
  },
  pagerduty: {
    name: 'PagerDuty', desc: 'Trigger and manage PagerDuty incidents.',
    category: 'DevOps', color: '#06ac38',
    fields: [
      { key: 'routing_key', label: 'Events API v2 routing key', placeholder: 'R…', hint: 'From PagerDuty Service → Integrations → Events API v2' },
    ],
    steps: [
      { title: 'Get your routing key', body: 'In PagerDuty go to your Service → Integrations → Add an integration → Events API v2. Copy the Integration Key.' },
    ],
  },
  sentry: {
    name: 'Sentry', desc: 'Query errors and issues from Sentry.',
    category: 'DevOps', color: '#362d59',
    fields: [
      { key: 'auth_token', label: 'Auth token', placeholder: 'sntrys_…', secret: true, hint: 'From sentry.io/settings/auth-tokens' },
      { key: 'org_slug', label: 'Organization slug', placeholder: 'my-org', hint: 'From your Sentry organization URL' },
    ],
    steps: [
      { title: 'Create an auth token', body: 'Go to <a href="https://sentry.io/settings/auth-tokens/" target="_blank">sentry.io/settings/auth-tokens</a> and create a token with <b>org:read</b> and <b>project:read</b> scopes.' },
    ],
  },
  cloudflare: {
    name: 'Cloudflare', desc: 'Manage zones, DNS, and cache purging.',
    category: 'DevOps', color: '#f48120',
    fields: [
      { key: 'api_token', label: 'API token', placeholder: '…', secret: true, hint: 'From dash.cloudflare.com/profile/api-tokens' },
    ],
    steps: [
      { title: 'Create an API token', body: 'Go to <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank">dash.cloudflare.com/profile/api-tokens</a> and create a token with Zone permissions.' },
    ],
  },
}