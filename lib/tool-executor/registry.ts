import type { ToolSchema } from './types'

export const TOOL_REGISTRY: Record<string, ToolSchema> = {

  // ── Safe tools (auto-execute) ──────────────────────────────────────────────

  web_search: {
    name: 'Web Search',
    description: 'Search the web for current information using a search query. Returns a list of results with titles, snippets, and URLs.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The search query to look up.' },
        numResults: { type: 'number', description: 'Number of results to return (default: 5, max: 10).' },
      },
      required: ['query'],
    },
  },

  search_knowledge: {
    name: 'Search Knowledge Base',
    description: 'Semantic search over files and documents uploaded to the workspace knowledge base.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query to search the knowledge base.' },
        topK: { type: 'number', description: 'Number of results to return (default: 5).' },
      },
      required: ['query'],
    },
  },

  github_list_repos: {
    name: 'GitHub: List Repos',
    description: 'List GitHub repositories accessible by the configured token.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  github_list_files: {
    name: 'GitHub: List Files',
    description: 'List files and directories in a GitHub repository path.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository name in owner/repo format.' },
        path: { type: 'string', description: 'Directory path to list. Defaults to root.' },
        ref: { type: 'string', description: 'Branch, tag, or commit SHA. Defaults to default branch.' },
      },
    },
  },

  github_read_file: {
    name: 'GitHub: Read File',
    description: 'Read the contents of a file from a GitHub repository.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        filePath: { type: 'string', description: 'Path to the file within the repository.' },
        ref: { type: 'string', description: 'Branch, tag, or commit SHA.' },
      },
      required: ['filePath'],
    },
  },

  github_get_commits: {
    name: 'GitHub: Get Commits',
    description: 'List recent commits for a repository branch.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        branch: { type: 'string', description: 'Branch name.' },
        limit: { type: 'number', description: 'Number of commits to return (default: 20).' },
      },
    },
  },

  github_get_commit_detail: {
    name: 'GitHub: Get Commit Detail',
    description: 'Get detailed information about a specific commit including file diffs.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        sha: { type: 'string', description: 'The commit SHA.' },
      },
      required: ['sha'],
    },
  },

  github_list_branches: {
    name: 'GitHub: List Branches',
    description: 'List branches in a GitHub repository.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
      },
    },
  },

  github_list_issues: {
    name: 'GitHub: List Issues',
    description: 'List issues in a GitHub repository, optionally filtered by state.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        state: { type: 'string', description: 'Filter by state: open, closed, or all.', enum: ['open', 'closed', 'all'] },
        limit: { type: 'number', description: 'Number of issues to return (default: 20).' },
      },
    },
  },

  github_list_prs: {
    name: 'GitHub: List Pull Requests',
    description: 'List pull requests in a GitHub repository.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        state: { type: 'string', description: 'Filter by state: open, closed, or all.', enum: ['open', 'closed', 'all'] },
        limit: { type: 'number', description: 'Number of PRs to return (default: 20).' },
      },
    },
  },

  github_search_code: {
    name: 'GitHub: Search Code',
    description: 'Search code across GitHub repositories.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Code search query.' },
        repo: { type: 'string', description: 'Limit search to a specific repo (owner/repo).' },
      },
      required: ['query'],
    },
  },

  github_repo_info: {
    name: 'GitHub: Get Repo Info',
    description: 'Get metadata about a GitHub repository (stars, forks, languages, topics).',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
      },
    },
  },

  jira_list_issues: {
    name: 'Jira: List Issues',
    description: 'List issues from a Jira project.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Jira project key (e.g. PROJ).' },
        status: { type: 'string', description: 'Filter by status (e.g. "To Do", "In Progress", "Done").' },
        limit: { type: 'number', description: 'Number of issues to return (default: 20).' },
      },
    },
  },

  linear_list_issues: {
    name: 'Linear: List Issues',
    description: 'List issues from Linear, optionally filtered by team or state.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        teamId: { type: 'string', description: 'Team ID to filter issues.' },
        state: { type: 'string', description: 'Filter by state name.' },
        limit: { type: 'number', description: 'Number of issues to return (default: 20).' },
      },
    },
  },

  hubspot_search_contacts: {
    name: 'HubSpot: Search Contacts',
    description: 'Search for contacts in HubSpot CRM.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (name, email, company).' },
        limit: { type: 'number', description: 'Number of results to return (default: 10).' },
      },
    },
  },

  hubspot_search_deals: {
    name: 'HubSpot: Search Deals',
    description: 'Search for deals in HubSpot CRM.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query.' },
        limit: { type: 'number', description: 'Number of results to return (default: 10).' },
      },
    },
  },

  stripe_list_customers: {
    name: 'Stripe: List Customers',
    description: 'List customers from Stripe.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of customers to return (default: 10).' },
        email: { type: 'string', description: 'Filter by email address.' },
      },
    },
  },

  stripe_list_payments: {
    name: 'Stripe: List Payments',
    description: 'List recent payments from Stripe.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of payments to return (default: 10).' },
      },
    },
  },

  airtable_list_records: {
    name: 'Airtable: List Records',
    description: 'List records from an Airtable base and table.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID.' },
        tableId: { type: 'string', description: 'Table name or ID.' },
        limit: { type: 'number', description: 'Number of records to return (default: 20).' },
        filterFormula: { type: 'string', description: 'Airtable formula to filter records.' },
      },
      required: ['baseId', 'tableId'],
    },
  },

  vercel_list_deployments: {
    name: 'Vercel: List Deployments',
    description: 'List recent deployments from Vercel.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'Filter by project name.' },
        limit: { type: 'number', description: 'Number of deployments to return (default: 10).' },
      },
    },
  },

  vercel_get_project: {
    name: 'Vercel: Get Project',
    description: 'Get details about a Vercel project including latest deployment status.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        projectName: { type: 'string', description: 'The project name.' },
      },
      required: ['projectName'],
    },
  },

  sentry_list_issues: {
    name: 'Sentry: List Issues',
    description: 'List error issues from Sentry.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        project: { type: 'string', description: 'Project slug to filter.' },
        query: { type: 'string', description: 'Sentry search query.' },
        limit: { type: 'number', description: 'Number of issues to return (default: 10).' },
      },
    },
  },

  cloudflare_list_zones: {
    name: 'Cloudflare: List Zones',
    description: 'List DNS zones configured in Cloudflare.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  drive_list_files: {
    name: 'Google Drive: List Files',
    description: 'List files in Google Drive.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for file names.' },
        limit: { type: 'number', description: 'Number of files to return (default: 20).' },
      },
    },
  },

  calendar_list_events: {
    name: 'Google Calendar: List Events',
    description: 'List upcoming events from Google Calendar.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        timeMin: { type: 'string', description: 'Start of time range (ISO 8601). Defaults to now.' },
        timeMax: { type: 'string', description: 'End of time range (ISO 8601).' },
        limit: { type: 'number', description: 'Number of events to return (default: 10).' },
      },
    },
  },

  gmail_list_messages: {
    name: 'Gmail: List Messages',
    description: 'List recent Gmail messages, optionally filtered.',
    riskLevel: 'safe',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Gmail search query (e.g. "from:boss@company.com is:unread").' },
        limit: { type: 'number', description: 'Number of messages to return (default: 10).' },
      },
    },
  },

  // ── Dangerous tools (require approval) ────────────────────────────────────

  slack_post_message: {
    name: 'Slack: Post Message',
    description: 'Post a message to a Slack channel. Use for team updates, notifications, and summaries.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message text. Supports Slack markdown.' },
        channel: { type: 'string', description: 'Channel name including #, e.g. #general.' },
      },
      required: ['message'],
    },
  },

  gmail_send: {
    name: 'Gmail: Send Email',
    description: 'Send an email from the configured Gmail account.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address.' },
        subject: { type: 'string', description: 'Email subject line.' },
        body: { type: 'string', description: 'Email body. Plain text or simple HTML.' },
        cc: { type: 'string', description: 'Optional CC email address.' },
      },
      required: ['to', 'subject', 'body'],
    },
  },

  calendar_create_event: {
    name: 'Google Calendar: Create Event',
    description: 'Create a Google Calendar event.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Event title.' },
        description: { type: 'string', description: 'Event description or agenda.' },
        startTime: { type: 'string', description: 'Start time as ISO 8601 string.' },
        endTime: { type: 'string', description: 'End time as ISO 8601 string.' },
        attendees: { type: 'string', description: 'Comma-separated attendee email addresses.' },
      },
      required: ['summary'],
    },
  },

  github_create_issue: {
    name: 'GitHub: Create Issue',
    description: 'Create a new issue in a GitHub repository.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        title: { type: 'string', description: 'Issue title.' },
        body: { type: 'string', description: 'Issue body (Markdown).' },
        labels: { type: 'string', description: 'Comma-separated labels.' },
      },
      required: ['title'],
    },
  },

  github_update_issue: {
    name: 'GitHub: Update Issue',
    description: 'Update an existing issue in a GitHub repository.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        issueNumber: { type: 'number', description: 'Issue number to update.' },
        title: { type: 'string', description: 'New issue title.' },
        body: { type: 'string', description: 'New issue body.' },
        state: { type: 'string', description: 'New state: open or closed.', enum: ['open', 'closed'] },
        labels: { type: 'string', description: 'Comma-separated labels.' },
      },
      required: ['issueNumber'],
    },
  },

  github_commit_file: {
    name: 'GitHub: Commit File',
    description: 'Create or update a file in a GitHub repository with a commit.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        filePath: { type: 'string', description: 'Path to the file within the repository.' },
        content: { type: 'string', description: 'File content.' },
        commitMessage: { type: 'string', description: 'Commit message.' },
        branch: { type: 'string', description: 'Branch to commit to. Defaults to default branch.' },
      },
      required: ['filePath', 'content', 'commitMessage'],
    },
  },

  github_delete_file: {
    name: 'GitHub: Delete File',
    description: 'Delete a file from a GitHub repository.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        filePath: { type: 'string', description: 'Path to the file to delete.' },
        commitMessage: { type: 'string', description: 'Commit message for the deletion.' },
      },
      required: ['filePath', 'commitMessage'],
    },
  },

  github_create_pr: {
    name: 'GitHub: Create Pull Request',
    description: 'Create a pull request in a GitHub repository.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        repo: { type: 'string', description: 'Repository in owner/repo format.' },
        title: { type: 'string', description: 'PR title.' },
        body: { type: 'string', description: 'PR description.' },
        head: { type: 'string', description: 'The branch with the changes.' },
        base: { type: 'string', description: 'The branch to merge into. Defaults to main.' },
        draft: { type: 'boolean', description: 'Create as draft PR.' },
      },
      required: ['title', 'head'],
    },
  },

  notion_create_page: {
    name: 'Notion: Create Page',
    description: 'Create a new page in a Notion database.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Page title.' },
        content: { type: 'string', description: 'Page content in Markdown.' },
        databaseId: { type: 'string', description: 'Notion database ID. Uses configured default if omitted.' },
      },
      required: ['title', 'content'],
    },
  },

  notion_append_block: {
    name: 'Notion: Append Block',
    description: 'Append content blocks to an existing Notion page.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        pageId: { type: 'string', description: 'The Notion page ID to append to.' },
        content: { type: 'string', description: 'Content to append in Markdown.' },
      },
      required: ['pageId', 'content'],
    },
  },

  zapier_trigger: {
    name: 'Zapier: Trigger Webhook',
    description: 'Trigger an automation via a configured Zapier webhook.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        payload: { type: 'string', description: 'JSON payload to send to the Zapier webhook.' },
        webhookUrl: { type: 'string', description: 'Override webhook URL (uses configured default if omitted).' },
      },
    },
  },

  jira_create_issue: {
    name: 'Jira: Create Issue',
    description: 'Create a new issue in a Jira project.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        projectKey: { type: 'string', description: 'Jira project key (e.g. PROJ).' },
        summary: { type: 'string', description: 'Issue summary/title.' },
        description: { type: 'string', description: 'Issue description.' },
        issueType: { type: 'string', description: 'Issue type (e.g. Bug, Task, Story).', enum: ['Bug', 'Task', 'Story', 'Epic'] },
        priority: { type: 'string', description: 'Priority level.', enum: ['Lowest', 'Low', 'Medium', 'High', 'Highest'] },
      },
      required: ['summary'],
    },
  },

  linear_create_issue: {
    name: 'Linear: Create Issue',
    description: 'Create a new issue in Linear.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Issue title.' },
        description: { type: 'string', description: 'Issue description in Markdown.' },
        teamId: { type: 'string', description: 'Team ID. Uses configured default if omitted.' },
        priority: { type: 'number', description: 'Priority (0=No priority, 1=Urgent, 2=High, 3=Medium, 4=Low).' },
        estimate: { type: 'number', description: 'Story point estimate.' },
      },
      required: ['title'],
    },
  },

  hubspot_create_contact: {
    name: 'HubSpot: Create Contact',
    description: 'Create a new contact in HubSpot CRM.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Contact email address.' },
        firstName: { type: 'string', description: 'First name.' },
        lastName: { type: 'string', description: 'Last name.' },
        company: { type: 'string', description: 'Company name.' },
        phone: { type: 'string', description: 'Phone number.' },
      },
      required: ['email'],
    },
  },

  hubspot_create_deal: {
    name: 'HubSpot: Create Deal',
    description: 'Create a new deal in HubSpot CRM.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        dealname: { type: 'string', description: 'Deal name.' },
        amount: { type: 'string', description: 'Deal value.' },
        dealstage: { type: 'string', description: 'Deal pipeline stage.' },
        closedate: { type: 'string', description: 'Expected close date (ISO 8601).' },
      },
      required: ['dealname'],
    },
  },

  twilio_send_sms: {
    name: 'Twilio: Send SMS',
    description: 'Send an SMS message via Twilio.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient phone number in E.164 format (e.g. +12125551234).' },
        message: { type: 'string', description: 'SMS message content.' },
      },
      required: ['to', 'message'],
    },
  },

  stripe_create_customer: {
    name: 'Stripe: Create Customer',
    description: 'Create a new customer record in Stripe.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Customer email.' },
        name: { type: 'string', description: 'Customer name.' },
        description: { type: 'string', description: 'Customer description.' },
      },
      required: ['email'],
    },
  },

  stripe_create_invoice: {
    name: 'Stripe: Create Invoice',
    description: 'Create an invoice for a Stripe customer.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Stripe customer ID.' },
        amount: { type: 'number', description: 'Invoice amount in cents.' },
        currency: { type: 'string', description: 'Three-letter ISO currency code (default: usd).' },
        description: { type: 'string', description: 'Invoice description.' },
      },
      required: ['customerId', 'amount'],
    },
  },

  airtable_create_record: {
    name: 'Airtable: Create Record',
    description: 'Create a new record in an Airtable base and table.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        baseId: { type: 'string', description: 'Airtable base ID.' },
        tableId: { type: 'string', description: 'Table name or ID.' },
        fields: { type: 'string', description: 'JSON string of field name → value pairs.' },
      },
      required: ['baseId', 'tableId', 'fields'],
    },
  },

  asana_create_task: {
    name: 'Asana: Create Task',
    description: 'Create a new task in an Asana project.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Task name.' },
        notes: { type: 'string', description: 'Task description.' },
        projectId: { type: 'string', description: 'Project ID to assign the task to.' },
        assigneeId: { type: 'string', description: 'Assignee user ID.' },
        dueOn: { type: 'string', description: 'Due date in YYYY-MM-DD format.' },
      },
      required: ['name'],
    },
  },

  trello_create_card: {
    name: 'Trello: Create Card',
    description: 'Create a new card in a Trello board list.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Card name/title.' },
        listId: { type: 'string', description: 'Trello list ID to add the card to.' },
        desc: { type: 'string', description: 'Card description.' },
        due: { type: 'string', description: 'Due date (ISO 8601).' },
      },
      required: ['name', 'listId'],
    },
  },

  intercom_send_message: {
    name: 'Intercom: Send Message',
    description: 'Send a message to a user via Intercom.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        userId: { type: 'string', description: 'User ID or email address.' },
        message: { type: 'string', description: 'Message body.' },
        subject: { type: 'string', description: 'Subject line (only for email message type).' },
      },
      required: ['userId', 'message'],
    },
  },

  zendesk_create_ticket: {
    name: 'Zendesk: Create Ticket',
    description: 'Create a new support ticket in Zendesk.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Ticket subject.' },
        description: { type: 'string', description: 'Ticket description.' },
        priority: { type: 'string', description: 'Priority: low, normal, high, or urgent.', enum: ['low', 'normal', 'high', 'urgent'] },
        requesterEmail: { type: 'string', description: 'Requester email address.' },
        tags: { type: 'string', description: 'Comma-separated tags.' },
      },
      required: ['subject', 'description'],
    },
  },

  cloudflare_purge_cache: {
    name: 'Cloudflare: Purge Cache',
    description: 'Purge cached content from Cloudflare for a zone.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        zoneId: { type: 'string', description: 'Cloudflare zone ID.' },
        urls: { type: 'string', description: 'Comma-separated URLs to purge. If omitted, purges everything.' },
      },
      required: ['zoneId'],
    },
  },

  pagerduty_create_incident: {
    name: 'PagerDuty: Create Incident',
    description: 'Trigger a new incident in PagerDuty.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Incident title/summary.' },
        description: { type: 'string', description: 'Detailed incident description.' },
        severity: { type: 'string', description: 'Severity: critical, error, warning, or info.', enum: ['critical', 'error', 'warning', 'info'] },
        serviceKey: { type: 'string', description: 'Override service routing key.' },
      },
      required: ['title'],
    },
  },

  excel_create_file: {
    name: 'Excel: Create File',
    description: 'Create an Excel spreadsheet file with data.',
    riskLevel: 'dangerous',
    parameters: {
      type: 'object',
      properties: {
        filename: { type: 'string', description: 'Name of the Excel file.' },
        data: { type: 'string', description: 'JSON array of arrays representing rows and cells.' },
        sheetName: { type: 'string', description: 'Sheet name (default: Sheet1).' },
      },
      required: ['filename', 'data'],
    },
  },
}

const DANGEROUS_ACTION_SET = new Set(
  Object.entries(TOOL_REGISTRY)
    .filter(([, schema]) => schema.riskLevel === 'dangerous')
    .map(([name]) => name)
)

export function isActionDangerous(actionName: string): boolean {
  return DANGEROUS_ACTION_SET.has(actionName)
}

export function getToolSchema(actionName: string): ToolSchema | undefined {
  return TOOL_REGISTRY[actionName]
}
